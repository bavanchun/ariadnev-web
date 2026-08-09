import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { lstat, readFile, readdir } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import { buildIngressRule, buildIngressRuleDefinition, ingressPolicyDigest, loadIngressPolicy } from "../edge-ingress-policy.mjs";
import { reconcileIngressRule } from "../manage-edge-ingress-rule.mjs";
import { defaultTopologyAdapter } from "./cloudflare-topology-adapter.mjs";

export { defaultTopologyAdapter } from "./cloudflare-topology-adapter.mjs";

const scriptRoot = dirname(fileURLToPath(import.meta.url));
export const defaultRepoRoot = resolve(scriptRoot, "../..");
export const defaultTopologyPath = resolve(defaultRepoRoot, "deployment/topology.json");
export const defaultDeploymentSchemaPath = resolve(defaultRepoRoot, "deployment/deployment-contract.schema.json");
export const defaultCutoverSchemaPath = resolve(defaultRepoRoot, "deployment/cutover-record.schema.json");

const VERSION_VALUE = "[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}";
const VERSION_ID = new RegExp(`^${VERSION_VALUE}$`);
const VERSION_LINE = new RegExp(`^(?:Worker Version ID|Current Version ID):[ \\t]*(${VERSION_VALUE})[ \\t]*$`, "gim");
const SENSITIVE_COMMAND_ENV = /(?:^|_)(?:TOKEN|SECRET|PASSWORD|PASSWD|PRIVATE_KEY|API_KEY|ACCESS_KEY|AUTH_TOKEN|PAT|EMAIL)$/i;
const ALLOWED_COMMAND_ENV_INJECTIONS = new Set(["CLOUDFLARE_API_TOKEN", "NO_COLOR"]);
const MAX_COMMAND_STDOUT = 1024 * 1024;
const MAX_EVENTS = 256;

export function controlPlaneError(message, code = "DEPLOYMENT_CONTROL_PLANE_FAILED") {
  const error = new Error(message);
  error.code = code;
  return error;
}

export async function readJson(path) {
  try { return JSON.parse(await readFile(path, "utf8")); }
  catch { throw controlPlaneError(`unable to read JSON contract: ${relative(process.cwd(), path) || "."}`, "INVALID_JSON_CONTRACT"); }
}

export function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

export function sha256(value) { return `sha256:${createHash("sha256").update(value).digest("hex")}`; }

export function compareCodePoints(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function assertInside(root, path) {
  const target = resolve(root, path);
  if (target !== root && !target.startsWith(`${root}${sep}`)) throw controlPlaneError("topology path escapes repository root", "UNSAFE_TOPOLOGY_PATH");
  return target;
}

export async function digestPath(path) {
  const stat = await lstat(path).catch(() => null);
  if (!stat) throw controlPlaneError(`required deployment artifact is absent: ${relative(defaultRepoRoot, path)}`, "MISSING_DEPLOYMENT_ARTIFACT");
  if (stat.isSymbolicLink()) throw controlPlaneError("deployment artifacts may not be symbolic links", "UNSAFE_DEPLOYMENT_ARTIFACT");
  if (stat.isFile()) return sha256(await readFile(path));
  if (!stat.isDirectory()) throw controlPlaneError("deployment artifact must be a file or directory", "UNSAFE_DEPLOYMENT_ARTIFACT");
  const entries = [];
  async function walk(directory) {
    for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => compareCodePoints(a.name, b.name))) {
      const absolute = resolve(directory, entry.name);
      const name = relative(path, absolute).split(sep).join("/");
      if (entry.isSymbolicLink()) throw controlPlaneError("deployment output may not contain symbolic links", "UNSAFE_DEPLOYMENT_ARTIFACT");
      if (entry.isDirectory()) await walk(absolute);
      else if (entry.isFile()) entries.push([name, sha256(await readFile(absolute))]);
      else throw controlPlaneError("deployment output contains an unsupported entry", "UNSAFE_DEPLOYMENT_ARTIFACT");
    }
  }
  await walk(path);
  if (entries.length === 0) throw controlPlaneError("deployment output directory is empty", "MISSING_DEPLOYMENT_ARTIFACT");
  return sha256(stableStringify(entries));
}

function expectedRollbackCommand() {
  return ["pnpm", "exec", "wrangler", "rollback", "{rollbackWorkerVersionId}", "--config", "{config}", "--yes"];
}

function expectedDeployCommand() {
  return ["pnpm", "exec", "wrangler", "deploy", "--config", "{config}"];
}

const EXPECTED_PROTECTED_ROUTES = Object.freeze(["/install", "/install.sh", "/install.ps1", "/version", "/download/checksums.txt"]);
const EXPECTED_CREDENTIAL_POLICY = Object.freeze({
  repository: "bavanchun/vcskill",
  scope: "single-repository",
  contents: "read",
  actions: "write",
  allowedContexts: ["edge-release-read", "exact-artifact-retrieval", "protected-finalizer-dispatch"],
  forbiddenContexts: ["content", "build", "web-deploy", "cloudflare-deploy", "finalizer"],
  contentsWrite: false,
  releaseWrite: false,
  administrationWrite: false,
});
const EXPECTED_FINALIZER = Object.freeze({ repository: "bavanchun/vcskill", path: ".github/workflows/finalize-release.yml", environment: "core-release-production", permissions: { actions: "read", contents: "write" } });
const EXPECTED_WORKER_IDENTITIES = Object.freeze({
  legacy: { name: "vcskill", secretNamespace: "legacy-production", mutationPolicy: "prohibited-until-rollback-window-closes" },
  candidate: { name: "vcskill-edge-combined-production", secretNamespace: "candidate-production" },
  docs: { staging: { name: "vcskill-docs-staging" }, production: { name: "vcskill-docs-production" } },
});

function expectedUnitContract(environment, id) {
  const production = environment === "production";
  const siteHost = production ? "vcskill.vchun.dev" : "staging.vcskill.vchun.dev";
  const docsHost = production ? "docs.vcskill.vchun.dev" : "staging.docs.vcskill.vchun.dev";
  const protectedSmoke = EXPECTED_PROTECTED_ROUTES.map((route) => ({ url: `https://${siteHost}${route}`, statuses: [200] }));
  if (id === "docs") {
    return {
      config: `apps/docs/wrangler.${environment}.toml`,
      output: "apps/docs/out",
      buildCommand: ["pnpm", "--filter", "@vcskill/docs", "build"],
      deployCommand: expectedDeployCommand(),
      rollbackCommand: expectedRollbackCommand(),
      smoke: [{ url: `https://${docsHost}/`, statuses: [200] }, ...protectedSmoke],
    };
  }
  return {
    config: production ? "workers/edge/wrangler.combined.production.toml" : "workers/edge/wrangler.combined.toml",
    output: "apps/site/dist",
    buildCommand: ["pnpm", "--filter", "@vcskill/site", "build"],
    deployCommand: expectedDeployCommand(),
    rollbackCommand: expectedRollbackCommand(),
    smoke: protectedSmoke,
  };
}

export async function loadTopology(path = defaultTopologyPath, repoRoot = defaultRepoRoot) {
  const topology = await readJson(path);
  const expectedOrder = ["docs", "combined-edge-site"];
  if (topology?.schemaVersion !== 1 || topology.id !== "candidate-b" || topology.selected !== true) throw controlPlaneError("Candidate B topology authority is required", "INVALID_TOPOLOGY");
  if (stableStringify(topology.deployOrder) !== stableStringify(expectedOrder) || stableStringify(topology.rollbackOrder) !== stableStringify([...expectedOrder].reverse())) throw controlPlaneError("Candidate B unit order drift", "INVALID_TOPOLOGY");
  if (stableStringify(topology.protectedRoutes) !== stableStringify(EXPECTED_PROTECTED_ROUTES)) throw controlPlaneError("protected route inventory drift", "INVALID_TOPOLOGY");
  if (stableStringify(topology.qualificationEvidencePathPrefixes) !== stableStringify(["tests/qualification/", "tests/baselines/flagship/"])) throw controlPlaneError("qualification evidence allowlist drift", "INVALID_TOPOLOGY");
  if (stableStringify(topology.credentialPolicy) !== stableStringify(EXPECTED_CREDENTIAL_POLICY)) throw controlPlaneError("credential policy topology drift", "INVALID_TOPOLOGY");
  if (stableStringify(topology.finalizer) !== stableStringify(EXPECTED_FINALIZER)) throw controlPlaneError("finalizer topology drift", "INVALID_TOPOLOGY");
  if (stableStringify(topology.workerIdentities) !== stableStringify(EXPECTED_WORKER_IDENTITIES)) throw controlPlaneError("Worker identity topology drift", "INVALID_TOPOLOGY");
  if (stableStringify(topology.firstCutover?.restoreOperations) !== stableStringify(["restore-legacy-version", "restore-legacy-bindings", "restore-docs-prestate"])) throw controlPlaneError("first-cutover restore operation drift", "INVALID_TOPOLOGY");
  for (const environment of ["staging", "production"]) {
    const target = topology.environments?.[environment];
    if (!target || stableStringify(Object.keys(target.units || {})) !== stableStringify(expectedOrder)) throw controlPlaneError(`topology unit-set drift for ${environment}`, "INVALID_TOPOLOGY");
    if (target.githubEnvironment !== `web-${environment}`) throw controlPlaneError(`GitHub environment drift for ${environment}`, "INVALID_TOPOLOGY");
    if (stableStringify(target.ingress) !== stableStringify({ required: true, manager: "scripts/manage-edge-ingress-rule.mjs", mode: "apply", policy: "workers/edge/rules/raw-download-path-guard.json" })) throw controlPlaneError("the scoped Phase 3 ingress manager is mandatory", "INVALID_TOPOLOGY");
    for (const id of expectedOrder) {
      const unit = target.units[id];
      for (const key of ["config", "output"]) assertInside(repoRoot, unit[key]);
      if (stableStringify(unit) !== stableStringify(expectedUnitContract(environment, id))) throw controlPlaneError(`incomplete or unsafe topology unit: ${id}`, "INVALID_TOPOLOGY");
    }
  }
  return topology;
}

export async function validateSchema(value, schemaPath) {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  const validate = ajv.compile(await readJson(schemaPath));
  if (!validate(value)) {
    const issue = validate.errors?.[0];
    throw controlPlaneError(`schema validation failed at ${issue?.instancePath || "/"}: ${issue?.message || "invalid value"}`, "SCHEMA_VALIDATION_FAILED");
  }
  return value;
}

export async function defaultGitAdapter(args, { cwd = defaultRepoRoot } = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn("git", args, { cwd, env: sanitizeCommandEnvironment(process.env), stdio: ["ignore", "pipe", "ignore"] });
    let stdout = "";
    child.stdout.on("data", (chunk) => { if (stdout.length < MAX_COMMAND_STDOUT) stdout += String(chunk).slice(0, MAX_COMMAND_STDOUT - stdout.length); });
    child.once("error", reject);
    child.once("close", (code) => resolvePromise({ code, stdout: stdout.trim() }));
  });
}

function parseNameStatus(output) {
  const fields = output.split("\0");
  if (fields.at(-1) === "") fields.pop();
  if (fields.length % 2 !== 0) throw controlPlaneError("qualification diff inventory is malformed", "INVALID_QUALIFICATION_LINEAGE");
  const entries = [];
  for (let index = 0; index < fields.length; index += 2) entries.push({ status: fields[index], path: fields[index + 1] });
  return entries;
}

function parseEvidenceTree(output) {
  const records = output.split("\0");
  if (records.at(-1) === "") records.pop();
  const entries = records.map((record) => {
    const separator = record.indexOf("\t");
    if (separator < 0) throw controlPlaneError("qualification evidence tree is malformed", "INVALID_QUALIFICATION_LINEAGE");
    const metadata = record.slice(0, separator).split(" ");
    const path = record.slice(separator + 1);
    if (metadata.length !== 3) throw controlPlaneError("qualification evidence tree is malformed", "INVALID_QUALIFICATION_LINEAGE");
    const [mode, type, object] = metadata;
    if (!new Set(["100644", "100755"]).has(mode) || type !== "blob" || !/^[a-f0-9]{40}$/.test(object)) {
      throw controlPlaneError("qualification evidence must contain regular Git blobs only", "INVALID_QUALIFICATION_LINEAGE");
    }
    return { mode, type, object, path };
  });
  if (entries.some((entry, index) => index > 0 && compareCodePoints(entry.path, entries[index - 1].path) <= 0)) {
    throw controlPlaneError("qualification evidence tree is not a unique deterministic inventory", "INVALID_QUALIFICATION_LINEAGE");
  }
  return entries;
}

export function evidenceTreeDigest(entries) {
  return sha256(stableStringify(entries));
}

async function verifyLineage(input, topology, gitAdapter) {
  for (const [name, ref, expected] of [
    ["productSha", `${input.product.sha}^{commit}`, input.product.sha],
    ["immutable product ref", `${input.product.ref}^{commit}`, input.product.sha],
    ["qualificationEvidenceSha", `${input.qualification.evidenceSha}^{commit}`, input.qualification.evidenceSha],
  ]) {
    const result = await gitAdapter(["rev-parse", ref]);
    if (result.code !== 0 || result.stdout !== expected) throw controlPlaneError(`${name} is not an exact immutable commit`, "IMMUTABLE_SOURCE_REQUIRED");
  }
  const ancestor = await gitAdapter(["merge-base", "--is-ancestor", input.product.sha, input.qualification.evidenceSha]);
  if (ancestor.code !== 0) throw controlPlaneError("qualificationEvidenceSha must descend from productSha", "INVALID_QUALIFICATION_LINEAGE");
  const diff = await gitAdapter(["diff", "--name-status", "-z", "--no-renames", input.product.sha, input.qualification.evidenceSha, "--"]);
  if (diff.code !== 0) throw controlPlaneError("unable to resolve complete qualification diff", "INVALID_QUALIFICATION_LINEAGE");
  const entries = parseNameStatus(diff.stdout);
  if (entries.length === 0) throw controlPlaneError("qualification evidence inventory may not be empty", "INVALID_QUALIFICATION_LINEAGE");
  for (const entry of entries) {
    if (!new Set(["A", "M"]).has(entry.status) || !topology.qualificationEvidencePathPrefixes.some((prefix) => entry.path.startsWith(prefix)) || entry.path.includes("..") || entry.path.startsWith("/")) {
      throw controlPlaneError("qualification diff contains a delete, rename, or undeclared path", "INVALID_QUALIFICATION_LINEAGE");
    }
  }
  const actual = entries.map((entry) => entry.path);
  if (stableStringify(actual) !== stableStringify([...input.qualification.evidencePaths].sort()) || stableStringify(actual) !== stableStringify([...actual].sort())) {
    throw controlPlaneError("qualification evidence path inventory mismatch", "INVALID_QUALIFICATION_LINEAGE");
  }
  const tree = await gitAdapter(["ls-tree", "-rz", "--full-tree", input.qualification.evidenceSha, "--", ...actual]);
  if (tree.code !== 0) throw controlPlaneError("unable to resolve qualification evidence tree", "INVALID_QUALIFICATION_LINEAGE");
  const treeEntries = parseEvidenceTree(tree.stdout);
  if (stableStringify(treeEntries.map((entry) => entry.path)) !== stableStringify(actual)) {
    throw controlPlaneError("qualification evidence tree inventory mismatch", "INVALID_QUALIFICATION_LINEAGE");
  }
  if (evidenceTreeDigest(treeEntries) !== input.qualification.evidenceDigest) {
    throw controlPlaneError("qualification evidence content digest mismatch", "INVALID_QUALIFICATION_LINEAGE");
  }
}

export function unitSetDigest(units) { return sha256(stableStringify(units.map(({ id, artifactVersion, configDigest, outputDigest, rollbackWorkerVersionId }) => ({ id, artifactVersion, configDigest, outputDigest, rollbackWorkerVersionId })))); }
export function productOutputsDigest(units) { return sha256(stableStringify(units.map(({ id, outputDigest }) => ({ id, outputDigest })))); }
export function deploymentInputDigest(input) { const { deploymentInputDigest: ignored, ...bound } = input; return sha256(stableStringify(bound)); }

function verifyPublicationState(input) {
  const actual = [input.release.publicationState, input.release.draft, input.release.immutable, input.release.latest];
  const expected = input.environment === "production" ? ["immutable-publication", false, true, true] : ["held-draft", true, false, false];
  if (stableStringify(actual) !== stableStringify(expected)) throw controlPlaneError(`release publication state is invalid for ${input.environment}`, "RELEASE_IDENTITY_DRIFT");
}

function verifyFirstCutover(input, topology) {
  const legacy = input.firstCutover.legacyWorker;
  const candidate = input.firstCutover.candidateWorker;
  if (legacy.name === candidate.name || legacy.secretNamespace === candidate.secretNamespace) throw controlPlaneError("candidate Worker must not share legacy identity or secrets", "LEGACY_IDENTITY_MUTATION");
  if (stableStringify(legacy.requiredSecretNames) !== stableStringify(topology.firstCutover.requiredSecretNames) || stableStringify(candidate.requiredSecretNames) !== stableStringify(topology.firstCutover.requiredSecretNames)) throw controlPlaneError("first-cutover required secret-name set drift", "LEGACY_IDENTITY_MUTATION");
  if (stableStringify(legacy.orderedBindingState) !== stableStringify(topology.firstCutover.legacyBindingState) || legacy.bindingStateDigest !== sha256(stableStringify(legacy.orderedBindingState))) throw controlPlaneError("legacy route/domain ordered state drift", "FIRST_CUTOVER_STATE_DRIFT");
  if (input.firstCutover.docsHost.prestateDigest !== sha256(stableStringify(input.firstCutover.docsHost.orderedPrestate))) throw controlPlaneError("docs hostname prestate digest drift", "FIRST_CUTOVER_STATE_DRIFT");
  const [owner, dns] = input.firstCutover.docsHost.orderedPrestate;
  const docsCandidateName = input.firstCutover.docsHost.candidateWorkerName;
  if (docsCandidateName !== topology.workerIdentities.docs.production.name
    || (owner.ownerType === "unassigned") !== (owner.workerName === null)
    || (owner.ownerType === "worker" && owner.workerName === docsCandidateName)
    || (dns.present === false) !== (dns.record === null && dns.recordDigest === null)
    || (dns.present === true && (dns.recordDigest !== sha256(stableStringify(dns.record))
      || dns.record.name !== input.firstCutover.docsHost.hostname
      || stableStringify(dns.record.tags) !== stableStringify([...dns.record.tags].sort(compareCodePoints))))) {
    throw controlPlaneError("docs hostname captured prestate is inconsistent", "FIRST_CUTOVER_STATE_DRIFT");
  }
  const combined = input.units.find((unit) => unit.id === "combined-edge-site");
  if (candidate.outputDigest !== combined.outputDigest) throw controlPlaneError("candidate output digest drift", "PRODUCT_OUTPUT_DRIFT");
  if (input.firstCutover.eligible && (legacy.credentialMutation !== "prohibited-until-rollback-window-closes" || !legacy.liveReadOnlyCompatible)) throw controlPlaneError("legacy credential context is not rollback-eligible", "LEGACY_IDENTITY_MUTATION");
}

function verifyIngressPrestate(prestate, input, policy) {
  if (prestate.environment !== input.environment || prestate.policyDigest !== input.ingress.policyDigest.slice("sha256:".length)) throw controlPlaneError("ingress prestate identity drift", "INGRESS_POLICY_FAILED");
  if (prestate.definitionDigest !== sha256(stableStringify(buildIngressRuleDefinition(policy, input.environment)))) throw controlPlaneError("ingress prestate definition drift", "INGRESS_POLICY_FAILED");
  const { stateDigest, ...prestateCore } = prestate;
  if (stateDigest !== sha256(stableStringify(prestateCore))) throw controlPlaneError("ingress prestate digest drift", "INGRESS_POLICY_FAILED");
  if (!prestate.entrypoint.exists) {
    if (prestate.entrypoint.identityDigest !== null || prestate.entrypoint.metadataDigest !== null || prestate.managedRule !== null || prestate.unrelatedRules.count !== 0 || prestate.unrelatedRules.digest !== sha256(stableStringify([]))) throw controlPlaneError("absent ingress prestate is inconsistent", "INGRESS_POLICY_FAILED");
  } else if (prestate.managedRule && (prestate.managedRule.index > prestate.unrelatedRules.count + 1 || prestate.managedRule.definitionDigest !== prestate.definitionDigest)) {
    throw controlPlaneError("managed ingress prestate is inconsistent", "INGRESS_POLICY_FAILED");
  }
}

export async function validateDeploymentInput(input, options = {}) {
  const repoRoot = options.repoRoot || defaultRepoRoot;
  const topologyPath = options.topologyPath || resolve(repoRoot, "deployment/topology.json");
  const schemaPath = options.schemaPath || resolve(repoRoot, "deployment/deployment-contract.schema.json");
  const topology = options.topology || await loadTopology(topologyPath, repoRoot);
  await validateSchema(input, schemaPath);
  if (input.release.tag !== `vcskill@${input.release.version}`) throw controlPlaneError("release tag/version drift", "RELEASE_IDENTITY_DRIFT");
  verifyPublicationState(input);
  if (input.qualification.productSha !== input.product.sha) throw controlPlaneError("qualification productSha drift", "INVALID_QUALIFICATION_LINEAGE");
  if (input.qualification.productOutputDigest !== input.product.outputDigest) throw controlPlaneError("qualification changed product outputs", "PRODUCT_OUTPUT_DRIFT");
  if (stableStringify(input.units.map((unit) => unit.id)) !== stableStringify(topology.deployOrder)) throw controlPlaneError("deployment unit set/order drift", "UNIT_SET_DRIFT");
  if (input.digests.unitSet !== unitSetDigest(input.units)) throw controlPlaneError("unit-set digest drift", "UNIT_SET_DRIFT");
  if (input.digests.productOutputs !== productOutputsDigest(input.units) || input.digests.productOutputs !== input.product.outputDigest) throw controlPlaneError("product output digest drift", "PRODUCT_OUTPUT_DRIFT");
  const topologyDigest = await digestPath(topologyPath);
  if (input.digests.topology !== topologyDigest) throw controlPlaneError("topology digest drift", "TOPOLOGY_DRIFT");
  if (input.deploymentInputDigest !== deploymentInputDigest(input)) throw controlPlaneError("deployment input digest drift", "DEPLOYMENT_INPUT_DRIFT");
  verifyFirstCutover(input, topology);
  const { productionPolicyAttestationDigest, productionPolicySchemaPath, verifyProductionPolicyAttestation } = await import("./production-policy.mjs");
  await validateSchema(input.productionPolicyAttestation, productionPolicySchemaPath);
  if (input.productionPolicyAttestationDigest !== productionPolicyAttestationDigest(input.productionPolicyAttestation)) throw controlPlaneError("production policy attestation digest drift", "PRODUCTION_POLICY_FAILED");
  await verifyProductionPolicyAttestation(input.productionPolicyAttestation, { digest: input.productionPolicyAttestationDigest, finalizerRef: input.release.finalizerWorkflowRef, finalizerDigest: input.release.finalizerWorkflowDigest }, { ...options.policyOptions, requireCurrent: input.environment === "production" });
  if (options.checkIngress !== false) {
    const policy = await (options.ingressPolicyLoader || loadIngressPolicy)();
    const rule = buildIngressRule(policy, input.environment, { enabled: true });
    if (rule.enabled !== true || input.ingress.policyDigest !== `sha256:${ingressPolicyDigest(policy, input.environment)}`) throw controlPlaneError("ingress policy digest or desired state drift", "INGRESS_POLICY_FAILED");
    verifyIngressPrestate(input.ingress.prestate, input, policy);
  }
  if (options.verifyLineage !== false) await verifyLineage(input, topology, options.gitAdapter || defaultGitAdapter);
  if (options.checkArtifacts !== false) await verifyAllUnitArtifacts(input, topology, repoRoot);
  return { input, topology, topologyDigest };
}

function substitute(command, values) {
  return command.map((part) => String(part).replace(/\{([A-Za-z]+)\}/g, (_, key) => {
    if (!(key in values)) throw controlPlaneError(`missing topology command substitution: ${key}`, "INVALID_TOPOLOGY_COMMAND");
    return values[key];
  }));
}

export async function defaultCommandAdapter(command, options = {}) {
  return new Promise((resolvePromise, reject) => {
    const environment = sanitizeCommandEnvironment(options.environmentVariables || process.env);
    for (const [key, value] of Object.entries(options.injectedEnvironmentVariables || {})) {
      if (!ALLOWED_COMMAND_ENV_INJECTIONS.has(key) || typeof value !== "string" || value.length === 0) {
        reject(controlPlaneError("command environment injection is not allowlisted", "UNSAFE_COMMAND_ENVIRONMENT"));
        return;
      }
      environment[key] = value;
    }
    const child = spawn(command[0], command.slice(1), { cwd: options.cwd || defaultRepoRoot, env: environment, stdio: [options.stdin ? "pipe" : "ignore", "pipe", "pipe"] });
    let stdout = "";
    child.stdout.on("data", (chunk) => { if (stdout.length < MAX_COMMAND_STDOUT) stdout += String(chunk).slice(0, MAX_COMMAND_STDOUT - stdout.length); });
    child.stderr.on("data", () => {});
    if (options.stdin) child.stdin.end(options.stdin);
    child.once("error", reject);
    child.once("close", (code) => code === 0 ? resolvePromise({ code, stdout: stdout.trim() }) : reject(controlPlaneError(`command failed: ${command[0]} (exit ${code})`, "DEPLOYMENT_COMMAND_FAILED")));
  });
}

export function sanitizeCommandEnvironment(environment = {}) {
  return Object.fromEntries(Object.entries(environment).filter(([key]) => !SENSITIVE_COMMAND_ENV.test(key)));
}

function cloudflareCommandOptions(cloudflareToken) {
  return { injectedEnvironmentVariables: { CLOUDFLARE_API_TOKEN: cloudflareToken, NO_COLOR: "1" } };
}

function requireCloudflareToken(cloudflareToken, dryRun) {
  if (!dryRun && (typeof cloudflareToken !== "string" || cloudflareToken.length < 20 || cloudflareToken.length > 4096 || /\s/.test(cloudflareToken))) {
    throw controlPlaneError("a bounded Cloudflare token is required for mutation", "INVALID_SECRET_INPUT");
  }
}

export function parseWorkerVersion(output) {
  const matches = [...String(output || "").matchAll(new RegExp(VERSION_LINE.source, VERSION_LINE.flags))].map((match) => match[1].toLowerCase());
  const versions = [...new Set(matches)];
  return versions.length === 1 && VERSION_ID.test(versions[0]) ? versions[0] : null;
}

export async function defaultFetchAdapter(url, options = {}) {
  const response = await fetch(url, { method: "GET", redirect: "error", signal: AbortSignal.timeout(options.timeoutMs || 15_000), headers: { "user-agent": "vcskill-deployment-control-plane/1" } });
  return {
    status: response.status,
    headers: {
      "cache-control": response.headers.get("cache-control"),
      "content-type": response.headers.get("content-type"),
    },
  };
}

export async function defaultIngressAdapter(options) { return reconcileIngressRule(options); }

export async function verifyUnitArtifacts(input, topology, id, repoRoot = defaultRepoRoot) {
  const unit = topology.environments[input.environment].units[id];
  const expected = input.units.find((candidate) => candidate.id === id);
  if (await digestPath(assertInside(repoRoot, unit.config)) !== expected.configDigest) throw controlPlaneError(`configuration digest drift after build: ${id}`, "CONFIGURATION_DRIFT");
  if (await digestPath(assertInside(repoRoot, unit.output)) !== expected.outputDigest) throw controlPlaneError(`output digest drift after build: ${id}`, "PRODUCT_OUTPUT_DRIFT");
}

export async function verifyAllUnitArtifacts(input, topology, repoRoot = defaultRepoRoot) {
  for (const id of topology.deployOrder) await verifyUnitArtifacts(input, topology, id, repoRoot);
  if (unitSetDigest(input.units) !== input.digests.unitSet || productOutputsDigest(input.units) !== input.product.outputDigest) throw controlPlaneError("rebuilt aggregate digest drift", "PRODUCT_OUTPUT_DRIFT");
}

function pushEvent(events, event) { if (events.length < MAX_EVENTS) events.push(event); }

function responseHeader(response, name) {
  if (typeof response?.headers?.get === "function") return response.headers.get(name);
  return response?.headers?.[name] ?? response?.headers?.[name.toLowerCase()] ?? null;
}

async function smokeUnit(unit, protectedRoutes, fetchAdapter, events, dryRun) {
  for (const probe of unit.smoke) {
    const route = new URL(probe.url).pathname;
    if (dryRun) pushEvent(events, { type: "smoke", route, status: "dry-run" });
    else {
      const response = await fetchAdapter(probe.url, { timeoutMs: 15_000 });
      if (!probe.statuses.includes(response.status)) throw controlPlaneError(`smoke failed: ${route} status=${response.status}`, "SMOKE_FAILED");
      if (protectedRoutes.includes(route)) {
        const contentType = String(responseHeader(response, "content-type") || "").trim().toLowerCase();
        const cacheControl = String(responseHeader(response, "cache-control") || "").trim().toLowerCase();
        if (!contentType || contentType.includes("html") || cacheControl !== "no-store") {
          throw controlPlaneError(`protected-route smoke contract failed: ${route}`, "SMOKE_FAILED");
        }
      }
      pushEvent(events, { type: "smoke", route, status: response.status });
    }
  }
}

async function runCommand(command, commandAdapter, events, type, dryRun, options = {}) {
  if (dryRun) { pushEvent(events, { type, command: [command[0], "[arguments-redacted]"] }); return { stdout: "" }; }
  const result = await commandAdapter(command, options);
  pushEvent(events, { type, command: [command[0], "[arguments-redacted]"], status: "passed" });
  return result;
}

function productionAuthorization(input) {
  return {
    schemaVersion: 1,
    environment: "production",
    protectedEnvironment: "production",
    immutablePolicyAttestationDigest: input.productionPolicyAttestationDigest,
    deploymentInputDigest: input.deploymentInputDigest,
    ingressPolicyDigest: input.ingress.policyDigest,
    prestateDigest: input.ingress.prestate.stateDigest,
  };
}

async function restoreIngress({ input, ingressAdapter, cloudflareToken, expectedCurrentStateDigest, events, reason }) {
  const restored = await ingressAdapter({ mode: "restore", environment: input.environment, token: cloudflareToken, prestate: input.ingress.prestate, expectedCurrentStateDigest });
  pushEvent(events, { type: "ingress-restore", status: restored.status, stateDigest: restored.stateDigest, reason });
}

function transactionFailure(error, restoreError, events) {
  const wrapped = controlPlaneError(restoreError ? `${error.message}; exact ingress restore also failed` : error.message, restoreError ? "INGRESS_RESTORE_FAILED" : error.code);
  wrapped.events = events.slice(0, MAX_EVENTS);
  wrapped.cause = error;
  if (restoreError) wrapped.restoreCause = restoreError;
  return wrapped;
}

export async function deployUnits({ input, topology, commandAdapter = defaultCommandAdapter, fetchAdapter = defaultFetchAdapter, ingressAdapter = defaultIngressAdapter, artifactVerifier = verifyUnitArtifacts, aggregateArtifactVerifier = verifyAllUnitArtifacts, dryRun = false, cloudflareToken }) {
  requireCloudflareToken(cloudflareToken, dryRun);
  const target = topology.environments[input.environment];
  const events = [];
  for (const id of topology.deployOrder) {
    const unit = target.units[id];
    await runCommand(substitute(unit.buildCommand, { config: unit.config }), commandAdapter, events, "build", dryRun);
    if (!dryRun) await artifactVerifier(input, topology, id);
  }
  if (!dryRun) await aggregateArtifactVerifier(input, topology);
  let applied;
  let ingressAttempted = false;
  try {
    if (dryRun) pushEvent(events, { type: "ingress-apply", status: "dry-run", prestateDigest: input.ingress.prestate.stateDigest });
    else {
      ingressAttempted = true;
      applied = await ingressAdapter({ mode: "apply", environment: input.environment, token: cloudflareToken, prestate: input.ingress.prestate, desiredEnabled: true, ...(input.environment === "production" ? { productionAuthorization: productionAuthorization(input) } : {}) });
      pushEvent(events, { type: "ingress-apply", status: applied.status, stateDigest: applied.stateDigest, prestateDigest: input.ingress.prestate.stateDigest });
    }
    for (const id of topology.deployOrder) {
      const unit = target.units[id];
      const unitInput = input.units.find((candidate) => candidate.id === id);
      const result = await runCommand(substitute(unit.deployCommand, { config: unit.config }), commandAdapter, events, "deploy", dryRun, cloudflareCommandOptions(cloudflareToken));
      const versionId = dryRun ? null : parseWorkerVersion(result.stdout);
      if (!dryRun && !VERSION_ID.test(versionId || "")) throw controlPlaneError(`deploy did not return an immutable Worker version: ${id}`, "MISSING_WORKER_VERSION");
      pushEvent(events, { type: "unit", id, artifactVersion: unitInput.artifactVersion, ...(versionId ? { versionDigest: sha256(versionId) } : {}) });
      await smokeUnit(unit, topology.protectedRoutes, fetchAdapter, events, dryRun);
    }
    return { mode: dryRun ? "dry-run" : "deployed", productSha: input.product.sha, events };
  } catch (error) {
    let restoreError;
    if (!dryRun && (ingressAttempted || applied?.rollbackRequired)) {
      try { await restoreIngress({ input, ingressAdapter, cloudflareToken, expectedCurrentStateDigest: applied?.stateDigest, events, reason: "automatic-failure-restore" }); }
      catch (caught) { restoreError = caught; pushEvent(events, { type: "ingress-restore", status: "failed", reason: "automatic-failure-restore" }); }
    }
    throw transactionFailure(error, restoreError, events);
  }
}

export async function rollbackUnits({ input, topology, commandAdapter = defaultCommandAdapter, fetchAdapter = defaultFetchAdapter, ingressAdapter = defaultIngressAdapter, topologyAdapter = defaultTopologyAdapter, dryRun = false, firstCutover = false, cloudflareToken }) {
  requireCloudflareToken(cloudflareToken, dryRun);
  const target = topology.environments[input.environment];
  const events = [];
  let rollbackError;
  try {
    for (const id of topology.rollbackOrder) {
      const unit = target.units[id];
      const unitInput = input.units.find((candidate) => candidate.id === id);
      await runCommand(substitute(unit.rollbackCommand, { config: unit.config, rollbackWorkerVersionId: unitInput.rollbackWorkerVersionId }), commandAdapter, events, "rollback", dryRun, cloudflareCommandOptions(cloudflareToken));
      await smokeUnit(unit, topology.protectedRoutes, fetchAdapter, events, dryRun);
    }
    if (firstCutover) {
      if (input.environment !== "production" || !input.firstCutover.eligible) throw controlPlaneError("first-cutover restore is not eligible", "ROLLBACK_NOT_ELIGIBLE");
      for (const operation of topology.firstCutover.restoreOperations) {
        if (dryRun) pushEvent(events, { type: "topology-restore", operation, status: "dry-run" });
        else {
          await topologyAdapter(operation, { firstCutover: input.firstCutover, commandAdapter, cloudflareToken });
          pushEvent(events, { type: "topology-restore", operation, status: "passed" });
        }
      }
    }
  } catch (error) { rollbackError = error; }
  let restoreError;
  try {
    if (dryRun) pushEvent(events, { type: "ingress-restore", status: "dry-run", prestateDigest: input.ingress.prestate.stateDigest });
    else await restoreIngress({ input, ingressAdapter, cloudflareToken, events, reason: "explicit-rollback" });
  } catch (error) { restoreError = error; pushEvent(events, { type: "ingress-restore", status: "failed", reason: "explicit-rollback" }); }
  if (rollbackError || restoreError) throw transactionFailure(rollbackError || restoreError, restoreError && rollbackError ? restoreError : undefined, events);
  return { mode: dryRun ? "dry-run" : "rolled-back", events };
}
