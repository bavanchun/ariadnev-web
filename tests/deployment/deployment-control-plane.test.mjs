import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import test from "node:test";

import YAML from "yaml";

import { buildIngressRuleDefinition, ingressPolicyDigest, loadIngressPolicy } from "../../scripts/edge-ingress-policy.mjs";
import {
  defaultCommandAdapter,
  defaultTopologyAdapter,
  deployUnits,
  deploymentInputDigest,
  digestPath,
  evidenceTreeDigest,
  loadTopology,
  parseWorkerVersion,
  productOutputsDigest,
  rollbackUnits,
  sanitizeCommandEnvironment,
  sha256,
  stableStringify,
  unitSetDigest,
  validateDeploymentInput,
  validateSchema,
  verifyUnitArtifacts,
} from "../../scripts/deploy/control-plane.mjs";
import { assertLegalTransition, createCutoverRecord, deploymentIdentity, redactRecursively, verifyConvergence, verifySoak } from "../../scripts/deploy/evidence.mjs";
import {
  EXACT_PAT_POLICY,
  FINALIZER_PERMISSIONS,
  productionPolicyAttestationDigest,
  verifyCredentialPolicy,
  verifyProductionPolicyAttestation,
} from "../../scripts/deploy/production-policy.mjs";

const ROOT = resolve(import.meta.dirname, "../..");
const DEPLOYMENT_SCHEMA = resolve(ROOT, "deployment/deployment-contract.schema.json");
const CUTOVER_SCHEMA = resolve(ROOT, "deployment/cutover-record.schema.json");
const POLICY_SCHEMA = resolve(ROOT, "deployment/production-policy-attestation.schema.json");
const TOPOLOGY_PATH = resolve(ROOT, "deployment/topology.json");
const SHA_A = "a".repeat(40);
const SHA_B = "b".repeat(40);
const SHA_C = "c".repeat(40);
const D1 = `sha256:${"1".repeat(64)}`;
const D2 = `sha256:${"2".repeat(64)}`;
const D3 = `sha256:${"3".repeat(64)}`;
const version = (digit) => [digit.repeat(8), digit.repeat(4), `4${digit.repeat(3)}`, `8${digit.repeat(3)}`, digit.repeat(12)].join("-");
const VERSION_A = version("1");
const VERSION_B = version("2");
const LEGACY_VERSION = version("3");
const EVIDENCE_PATH = "tests/baselines/flagship/qualification.json";
const CLOUDFLARE_TOKEN = "x".repeat(24);
const EVIDENCE_TREE = [{ mode: "100644", type: "blob", object: SHA_C, path: EVIDENCE_PATH }];
const PASSING_SMOKE = { status: 200, headers: { "cache-control": "no-store", "content-type": "text/plain; charset=utf-8" } };
const workerOutput = (workerVersion) => `Worker Version ID: ${workerVersion}`;

function absentDocsDns() {
  return { kind: "dns", present: false, record: null, recordDigest: null };
}

function presentDocsDns(target, overrides = {}) {
  const record = {
    type: "CNAME",
    name: "docs.vcskill.vchun.dev",
    content: target,
    ttl: 1,
    proxied: true,
    comment: "restored prior docs owner",
    tags: ["surface:docs"],
    settings: {},
    ...overrides,
  };
  return { kind: "dns", present: true, record, recordDigest: sha256(stableStringify(record)) };
}

function createCloudflareTopologyHarness({ ownerService = "vcskill-docs-production", dnsRecord, detachClearsDns = true } = {}) {
  const opaque = (character) => character.repeat(32);
  const zoneId = opaque("z");
  const accountId = opaque("a");
  const hostname = "docs.vcskill.vchun.dev";
  const calls = [];
  let domainState = ownerService ? [{ id: opaque("d"), hostname, service: ownerService, zone_id: zoneId, environment: "production" }] : [];
  let dnsState = dnsRecord ? [{ id: opaque("r"), ...dnsRecord }] : [];
  const topologyFetchAdapter = async (url, options) => {
    const parsed = new URL(url);
    const method = options.method || "GET";
    const body = options.body ? JSON.parse(options.body) : null;
    calls.push({ pathname: parsed.pathname, search: parsed.search, method, body });
    let result;
    if (parsed.pathname === "/client/v4/zones" && method === "GET") {
      result = [{ id: zoneId, name: "vchun.dev", account: { id: accountId } }];
    } else if (parsed.pathname.endsWith("/workers/domains") && method === "GET") {
      result = domainState;
    } else if (parsed.pathname.endsWith("/workers/domains") && method === "PUT") {
      domainState = [{ id: opaque("n"), hostname: body.hostname, service: body.service, zone_id: body.zone_id, environment: "production" }];
      result = domainState[0];
    } else if (parsed.pathname.includes("/workers/domains/") && method === "DELETE") {
      domainState = [];
      if (detachClearsDns) dnsState = [];
      result = {};
    } else if (parsed.pathname.endsWith("/dns_records") && method === "GET") {
      result = dnsState;
    } else if (parsed.pathname.includes("/dns_records/") && method === "PUT") {
      dnsState = [{ id: dnsState[0].id, ...body, comment: body.comment ?? null }];
      result = dnsState[0];
    } else if (parsed.pathname.endsWith("/dns_records") && method === "POST") {
      dnsState = [{ id: opaque("q"), ...body, comment: body.comment ?? null }];
      result = dnsState[0];
    } else if (parsed.pathname.includes("/dns_records/") && method === "DELETE") {
      dnsState = [];
      result = {};
    } else {
      throw new Error(`unexpected Cloudflare request: ${method} ${parsed.pathname}`);
    }
    return { ok: true, status: 200, json: async () => ({ success: true, result }) };
  };
  return { calls, topologyFetchAdapter, get domainState() { return domainState; }, get dnsState() { return dnsState; } };
}

function makePolicyAttestation() {
  const environment = (repository, name) => ({
    repository, name, trustAnchor: "protected-github-environment", requiredReviewerCount: 1,
    preventSelfReview: true, administratorsCanBypass: false, protectedBranchesOnly: true,
  });
  return {
    schemaVersion: 1,
    schema: "https://vcskill.dev/schemas/production-policy-attestation-v1.schema.json",
    issuedAt: "2026-08-09T17:00:00Z",
    expiresAt: "2026-08-10T17:00:00Z",
    environments: [environment("bavanchun/vcskill-web", "web-production"), environment("bavanchun/vcskill", "core-release-production")],
    immutableReleasesEnabled: true,
    finalizer: {
      repository: "bavanchun/vcskill", path: ".github/workflows/finalize-release.yml", environment: "core-release-production",
      ref: `bavanchun/vcskill/.github/workflows/finalize-release.yml@${SHA_C}`, digest: D1, permissions: FINALIZER_PERMISSIONS,
    },
    credentialPolicy: EXACT_PAT_POLICY,
  };
}

async function makeIngressPrestate(environment, overrides = {}) {
  const policy = await loadIngressPolicy();
  const policyDigest = ingressPolicyDigest(policy, environment);
  const core = {
    schemaVersion: 1,
    environment,
    phase: "http_request_firewall_custom",
    policyDigest,
    definitionDigest: sha256(stableStringify(buildIngressRuleDefinition(policy, environment))),
    entrypoint: { exists: true, identityDigest: D1, metadataDigest: D2 },
    managedRule: { identityDigest: D3, index: 1, enabled: false, definitionDigest: sha256(stableStringify(buildIngressRuleDefinition(policy, environment))) },
    unrelatedRules: { count: 0, digest: sha256(stableStringify([])) },
    ...overrides,
  };
  return { ...core, stateDigest: sha256(stableStringify(core)) };
}

async function makeInput({ environment = "production", prestateOverrides, topLevel = {} } = {}) {
  const topology = await loadTopology();
  const units = [
    { id: "docs", artifactVersion: "docs-1.0.0", configDigest: D1, outputDigest: D2, rollbackWorkerVersionId: VERSION_A },
    { id: "combined-edge-site", artifactVersion: "site-1.0.0", configDigest: D2, outputDigest: D3, rollbackWorkerVersionId: VERSION_B },
  ];
  const outputDigest = productOutputsDigest(units);
  const policyAttestation = makePolicyAttestation();
  const prestate = await makeIngressPrestate(environment, prestateOverrides);
  const releaseState = environment === "production"
    ? { publicationState: "immutable-publication", draft: false, immutable: true, latest: true }
    : { publicationState: "held-draft", draft: true, immutable: false, latest: false };
  const docsPrestate = [
    { kind: "owner", ownerType: "unassigned", workerName: null },
    absentDocsDns(),
  ];
  const input = {
    schemaVersion: 1,
    schema: "https://vcskill.dev/schemas/deployment-input-v1.schema.json",
    environment,
    topologyId: "candidate-b",
    product: { repository: "bavanchun/vcskill-web", sha: SHA_A, ref: "refs/tags/vcskill-web@1.0.0", version: "1.0.0", outputDigest },
    qualification: { evidenceSha: SHA_B, productSha: SHA_A, productOutputDigest: outputDigest, evidenceDigest: evidenceTreeDigest(EVIDENCE_TREE), evidencePaths: [EVIDENCE_PATH] },
    release: {
      repository: "bavanchun/vcskill", tag: "vcskill@1.0.0", version: "1.0.0", sourceSha: SHA_C, releaseId: "123", ...releaseState,
      assetSetDigest: D1, docsManifestDigest: D2, docsBundleDigest: D3,
      finalizerWorkflowRef: policyAttestation.finalizer.ref, finalizerWorkflowDigest: D1,
    },
    productionPolicyAttestation: policyAttestation,
    productionPolicyAttestationDigest: productionPolicyAttestationDigest(policyAttestation),
    deploymentInputDigest: D1,
    digests: { topology: await digestPath(TOPOLOGY_PATH), unitSet: unitSetDigest(units), productOutputs: outputDigest },
    ingress: { policyDigest: `sha256:${prestate.policyDigest}`, prestate },
    units,
    firstCutover: {
      eligible: true,
      legacyWorker: {
        name: "vcskill", versionId: LEGACY_VERSION,
        bindingStateDigest: sha256(stableStringify(topology.firstCutover.legacyBindingState)), orderedBindingState: structuredClone(topology.firstCutover.legacyBindingState),
        credentialContext: "existing-production-unchanged", secretNamespace: "legacy-production", requiredSecretNames: ["GH_TOKEN"],
        credentialMutation: "prohibited-until-rollback-window-closes", liveReadOnlyCompatible: true,
      },
      candidateWorker: { name: "vcskill-edge-combined-production", secretNamespace: "candidate-production", requiredSecretNames: ["GH_TOKEN"], outputDigest: D3 },
      docsHost: { hostname: "docs.vcskill.vchun.dev", candidateWorkerName: "vcskill-docs-production", prestateDigest: sha256(stableStringify(docsPrestate)), orderedPrestate: docsPrestate },
    },
    ...topLevel,
  };
  input.deploymentInputDigest = deploymentInputDigest(input);
  return input;
}

function passingGit(input, entries = [{ status: "M", path: EVIDENCE_PATH }], treeEntries = EVIDENCE_TREE) {
  return async (args) => {
    if (args[0] === "merge-base") return { code: 0, stdout: "" };
    if (args[0] === "diff") return { code: 0, stdout: entries.flatMap((entry) => [entry.status, entry.path]).join("\0") + "\0" };
    if (args[0] === "ls-tree") return { code: 0, stdout: treeEntries.map((entry) => `${entry.mode} ${entry.type} ${entry.object}\t${entry.path}`).join("\0") + "\0" };
    const ref = args[1];
    if (ref.startsWith(input.product.ref) || ref.startsWith(input.product.sha)) return { code: 0, stdout: input.product.sha };
    if (ref.startsWith(input.qualification.evidenceSha)) return { code: 0, stdout: input.qualification.evidenceSha };
    return { code: 1, stdout: "" };
  };
}

function validationOptions(input, overrides = {}) {
  return { checkArtifacts: false, policyOptions: { now: "2026-08-09T18:00:00Z" }, gitAdapter: passingGit(input), ...overrides };
}

test("schemas are strict and bind canonical policy, deployment, ingress, and first-cutover state", async () => {
  const input = await makeInput();
  await validateSchema(input, DEPLOYMENT_SCHEMA);
  await validateSchema(input.productionPolicyAttestation, POLICY_SCHEMA);
  await assert.rejects(validateSchema({ ...input, unexpected: true }, DEPLOYMENT_SCHEMA), /additional properties/);
  await validateSchema({
    schemaVersion: 1, schema: "https://vcskill.dev/schemas/cutover-record-v1.schema.json", recordId: "start-1", state: "preflight", previousState: null,
    recordedAt: "2026-08-09T18:00:00Z", identity: deploymentIdentity(input), observations: [], resets: [],
  }, CUTOVER_SCHEMA);
  await validateDeploymentInput(input, validationOptions(input));
  const drift = structuredClone(input);
  drift.ingress.prestate.managedRule.enabled = true;
  drift.deploymentInputDigest = deploymentInputDigest(drift);
  await assert.rejects(validateDeploymentInput(drift, validationOptions(drift, { verifyLineage: false })), /prestate digest drift/);
});

test("operator policy attestation verifies exact protected environments, reviewer policy, finalizer, immutable releases, timestamps, and PAT", async () => {
  const attestation = makePolicyAttestation();
  const expected = { digest: productionPolicyAttestationDigest(attestation), finalizerRef: attestation.finalizer.ref, finalizerDigest: D1 };
  assert.equal((await verifyProductionPolicyAttestation(attestation, expected, { now: "2026-08-09T18:00:00Z" })).status, "production-policy-attested");
  const mutations = [
    (value) => { value.environments[0].requiredReviewerCount = 2; },
    (value) => { value.environments[1].preventSelfReview = false; },
    (value) => { value.environments[0].administratorsCanBypass = true; },
    (value) => { value.environments[1].protectedBranchesOnly = false; },
    (value) => { value.immutableReleasesEnabled = false; },
    (value) => { value.finalizer.digest = D2; },
    (value) => { value.finalizer.permissions.actions = "write"; },
    (value) => { value.credentialPolicy.contentsWrite = true; },
  ];
  for (const mutate of mutations) {
    const invalid = structuredClone(attestation); mutate(invalid);
    await assert.rejects(verifyProductionPolicyAttestation(invalid, { ...expected, digest: productionPolicyAttestationDigest(invalid) }, { now: "2026-08-09T18:00:00Z" }), /schema|finalizer|credential|policy/i);
  }
  await assert.rejects(verifyProductionPolicyAttestation(attestation, expected, { now: "2026-08-10T17:00:00Z" }), /expired/);
  assert.equal(verifyCredentialPolicy(EXACT_PAT_POLICY, [{ context: "protected-finalizer-dispatch", repository: "bavanchun/vcskill", secretName: "VCSKILL_CORE_PAT" }]).status, "accepted-constrained-exception");
  assert.throws(() => verifyCredentialPolicy(EXACT_PAT_POLICY, [{ context: "web-deploy", repository: "bavanchun/vcskill", secretName: "VCSKILL_CORE_PAT" }]), /forbidden/);
});

test("staging accepts only held non-latest drafts and production only immutable latest publication", async () => {
  const staging = await makeInput({ environment: "staging" });
  await validateDeploymentInput(staging, validationOptions(staging));
  const stagingImmutable = structuredClone(staging);
  Object.assign(stagingImmutable.release, { publicationState: "immutable-publication", draft: false, immutable: true, latest: true });
  stagingImmutable.deploymentInputDigest = deploymentInputDigest(stagingImmutable);
  await assert.rejects(validateDeploymentInput(stagingImmutable, validationOptions(stagingImmutable)), /publication state/);
  const production = await makeInput();
  production.release.latest = false;
  production.deploymentInputDigest = deploymentInputDigest(production);
  await assert.rejects(validateDeploymentInput(production, validationOptions(production)), /publication state/);
});

test("complete product..evidence diff binds the exact nonempty Phase 11 blob inventory and content", async () => {
  const input = await makeInput();
  await validateDeploymentInput(input, validationOptions(input));
  for (const entries of [
    [],
    [{ status: "D", path: EVIDENCE_PATH }],
    [{ status: "R100", path: EVIDENCE_PATH }],
    [{ status: "M", path: ".github/workflows/deploy.yml" }],
    [{ status: "M", path: "apps/site/dist/index.html" }],
  ]) {
    await assert.rejects(validateDeploymentInput(input, validationOptions(input, { gitAdapter: passingGit(input, entries) })), /inventory|delete|rename|undeclared/);
  }
  const mismatch = structuredClone(input);
  mismatch.qualification.evidencePaths = ["tests/qualification/invented.json"];
  mismatch.deploymentInputDigest = deploymentInputDigest(mismatch);
  await assert.rejects(validateDeploymentInput(mismatch, validationOptions(mismatch)), /inventory mismatch/);

  const digestDrift = structuredClone(input);
  digestDrift.qualification.evidenceDigest = D2;
  digestDrift.deploymentInputDigest = deploymentInputDigest(digestDrift);
  await assert.rejects(validateDeploymentInput(digestDrift, validationOptions(digestDrift)), /content digest mismatch/);

  await assert.rejects(validateDeploymentInput(input, validationOptions(input, {
    gitAdapter: passingGit(input, undefined, [{ ...EVIDENCE_TREE[0], mode: "120000" }]),
  })), /regular Git blobs only/);
});

test("clean structural validation precedes owner outputs; artifact validation remains fail-closed", async (t) => {
  const emptyRepository = await mkdtemp(resolve(tmpdir(), "vcskill-empty-deploy-"));
  t.after(() => rm(emptyRepository, { recursive: true, force: true }));
  const staging = await makeInput({ environment: "staging" });
  await validateDeploymentInput(staging, validationOptions(staging));
  await assert.rejects(validateDeploymentInput(staging, validationOptions(staging, {
    checkArtifacts: true,
    repoRoot: emptyRepository,
    schemaPath: DEPLOYMENT_SCHEMA,
    topology: await loadTopology(),
    topologyPath: TOPOLOGY_PATH,
  })), /required deployment artifact is absent/);
});

test("build verification requires exact config, output, unit, and product digests", async (t) => {
  const directory = await mkdtemp(resolve(tmpdir(), "vcskill-deploy-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const topology = JSON.parse(await readFile(TOPOLOGY_PATH, "utf8"));
  for (const environment of ["staging", "production"]) for (const id of topology.deployOrder) {
    topology.environments[environment].units[id].config = `fixtures/${environment}/${id}.toml`;
    topology.environments[environment].units[id].output = `fixtures/${environment}/${id}`;
    const configPath = resolve(directory, topology.environments[environment].units[id].config);
    const outputPath = resolve(directory, topology.environments[environment].units[id].output, "index.txt");
    await mkdir(dirname(configPath), { recursive: true }); await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(configPath, `name=${id}\n`); await writeFile(outputPath, `${environment}-${id}\n`);
  }
  await mkdir(resolve(directory, "deployment"), { recursive: true });
  const topologyPath = resolve(directory, "deployment/topology.json"); await writeFile(topologyPath, `${JSON.stringify(topology, null, 2)}\n`);
  const input = await makeInput(); input.digests.topology = await digestPath(topologyPath);
  for (const unit of input.units) {
    const spec = topology.environments.production.units[unit.id];
    unit.configDigest = await digestPath(resolve(directory, spec.config)); unit.outputDigest = await digestPath(resolve(directory, spec.output));
  }
  input.digests.unitSet = unitSetDigest(input.units); input.product.outputDigest = productOutputsDigest(input.units);
  input.qualification.productOutputDigest = input.product.outputDigest; input.digests.productOutputs = input.product.outputDigest;
  input.firstCutover.candidateWorker.outputDigest = input.units.find((unit) => unit.id === "combined-edge-site").outputDigest;
  input.deploymentInputDigest = deploymentInputDigest(input);
  await validateDeploymentInput(input, validationOptions(input, { repoRoot: directory, topologyPath, schemaPath: DEPLOYMENT_SCHEMA, topology, checkArtifacts: true }));
  await writeFile(resolve(directory, topology.environments.production.units.docs.output, "index.txt"), "drift\n");
  await assert.rejects(verifyUnitArtifacts(input, topology, "docs", directory), /output digest drift/);
});

test("deploy builds and verifies all owners before WAF mutation, then binds production authorization", async () => {
  const topology = await loadTopology(); const input = await makeInput(); const calls = [];
  const ingressAdapter = async (options) => {
    calls.push({ kind: "ingress", options });
    assert.equal(options.mode, "apply"); assert.equal(options.prestate, input.ingress.prestate); assert.equal(options.desiredEnabled, true);
    assert.deepEqual(options.productionAuthorization, {
      schemaVersion: 1, environment: "production", protectedEnvironment: "production",
      immutablePolicyAttestationDigest: input.productionPolicyAttestationDigest, deploymentInputDigest: input.deploymentInputDigest,
      ingressPolicyDigest: input.ingress.policyDigest, prestateDigest: input.ingress.prestate.stateDigest,
    });
    return { status: "updated", stateDigest: D3, rollbackRequired: true };
  };
  let deployIndex = 0;
  const commandAdapter = async (command, options = {}) => {
    calls.push({ kind: command.includes("deploy") ? "deploy" : "build", command, options });
    return { code: 0, stdout: command.includes("deploy") ? workerOutput([VERSION_A, VERSION_B][deployIndex++]) : "" };
  };
  const verified = [];
  const result = await deployUnits({ input, topology, commandAdapter, artifactVerifier: async (_input, _topology, id) => { verified.push(id); }, aggregateArtifactVerifier: async () => {}, ingressAdapter, fetchAdapter: async () => PASSING_SMOKE, cloudflareToken: CLOUDFLARE_TOKEN });
  assert.deepEqual(verified, topology.deployOrder);
  assert.ok(calls.findIndex((call) => call.kind === "ingress") > calls.map((call) => call.kind).lastIndexOf("build"));
  assert.ok(calls.filter((call) => call.kind === "build").every((call) => call.options.injectedEnvironmentVariables === undefined));
  assert.ok(calls.filter((call) => call.kind === "deploy").every((call) => call.options.injectedEnvironmentVariables.CLOUDFLARE_API_TOKEN === CLOUDFLARE_TOKEN));
  assert.equal(result.events.filter((event) => event.versionDigest).length, 2);
  assert.doesNotMatch(JSON.stringify(result), new RegExp(VERSION_A.replaceAll("-", "\\-")));
});

test("real deployment rejects a missing Cloudflare credential before any build", async () => {
  const topology = await loadTopology(); const input = await makeInput(); let commandCalled = false;
  await assert.rejects(deployUnits({ input, topology, commandAdapter: async () => { commandCalled = true; return { stdout: "" }; } }), /Cloudflare token/);
  assert.equal(commandCalled, false);
});

test("deploy accepts disabled and absent exact prestates through the ingress adapter", async () => {
  const topology = await loadTopology();
  for (const prestateOverrides of [
    {},
    { entrypoint: { exists: false, identityDigest: null, metadataDigest: null }, managedRule: null, unrelatedRules: { count: 0, digest: sha256(stableStringify([])) } },
  ]) {
    const input = await makeInput({ environment: "staging", prestateOverrides }); let seen;
    await deployUnits({ input, topology, dryRun: false, commandAdapter: async (command) => ({ stdout: command.includes("deploy") ? workerOutput(VERSION_A) : "" }), artifactVerifier: async () => {}, aggregateArtifactVerifier: async () => {}, ingressAdapter: async (options) => { seen = options.prestate; return { status: "created", stateDigest: D3, rollbackRequired: false }; }, fetchAdapter: async () => PASSING_SMOKE, cloudflareToken: CLOUDFLARE_TOKEN });
    assert.equal(seen.stateDigest, input.ingress.prestate.stateDigest);
  }
});

test("failure after WAF activation automatically restores the exact prestate", async () => {
  const topology = await loadTopology(); const input = await makeInput(); const modes = [];
  const ingressAdapter = async (options) => { modes.push(options.mode); return options.mode === "apply" ? { status: "updated", stateDigest: D3, rollbackRequired: true } : { status: "restored", stateDigest: input.ingress.prestate.stateDigest, rollbackRequired: false }; };
  let deploys = 0;
  await assert.rejects(deployUnits({ input, topology, commandAdapter: async (command) => ({ stdout: command.includes("deploy") ? (++deploys === 1 ? workerOutput(VERSION_A) : "") : "" }), artifactVerifier: async () => {}, aggregateArtifactVerifier: async () => {}, ingressAdapter, fetchAdapter: async () => PASSING_SMOKE, cloudflareToken: CLOUDFLARE_TOKEN }), /immutable Worker version/);
  assert.deepEqual(modes, ["apply", "restore"]);
});

test("restore failure is surfaced with bounded sanitized events", async () => {
  const topology = await loadTopology(); const input = await makeInput();
  const ingressAdapter = async (options) => { if (options.mode === "restore") throw new Error("provider restore failed"); return { status: "updated", stateDigest: D3, rollbackRequired: true }; };
  const error = await deployUnits({ input, topology, commandAdapter: async (command) => ({ stdout: command.includes("deploy") ? workerOutput(VERSION_A) : "" }), artifactVerifier: async () => {}, aggregateArtifactVerifier: async () => {}, ingressAdapter, fetchAdapter: async () => ({ ...PASSING_SMOKE, status: 503 }), cloudflareToken: CLOUDFLARE_TOKEN }).catch((caught) => caught);
  assert.equal(error.code, "INGRESS_RESTORE_FAILED"); assert.ok(error.events.length <= 256);
  assert.doesNotMatch(JSON.stringify(error.events), new RegExp(VERSION_A.replaceAll("-", "\\-")));
});

test("production binding drift restores prestate even when WAF apply loses its response", async () => {
  const topology = await loadTopology(); const input = await makeInput(); let deployCalled = false; let restoreCalled = false;
  await assert.rejects(deployUnits({ input, topology, cloudflareToken: CLOUDFLARE_TOKEN, commandAdapter: async (command) => { if (command.includes("deploy")) deployCalled = true; return { stdout: "" }; }, artifactVerifier: async () => {}, aggregateArtifactVerifier: async () => {}, ingressAdapter: async (options) => {
    if (options.mode === "restore") {
      restoreCalled = true;
      assert.equal(options.expectedCurrentStateDigest, undefined);
      return { status: "current", stateDigest: input.ingress.prestate.stateDigest };
    }
    assert.equal(options.productionAuthorization.deploymentInputDigest, input.deploymentInputDigest);
    throw new Error("production authorization deployment input drift");
  } }), /binding|authorization|drift/);
  assert.equal(deployCalled, false); assert.equal(restoreCalled, true);
});

test("rollback restores units in reverse order with Wrangler 4.120 positional syntax, then restores WAF without apply", async () => {
  const topology = await loadTopology(); const input = await makeInput(); const commands = []; const modes = [];
  await rollbackUnits({ input, topology, commandAdapter: async (command) => { commands.push(command); return { stdout: "" }; }, ingressAdapter: async (options) => { modes.push(options.mode); return { status: "restored", stateDigest: input.ingress.prestate.stateDigest }; }, fetchAdapter: async () => PASSING_SMOKE, cloudflareToken: CLOUDFLARE_TOKEN });
  assert.deepEqual(commands[0].slice(0, 8), ["pnpm", "exec", "wrangler", "rollback", VERSION_B, "--config", "workers/edge/wrangler.combined.production.toml", "--yes"]);
  assert.deepEqual(commands[1].slice(0, 8), ["pnpm", "exec", "wrangler", "rollback", VERSION_A, "--config", "apps/docs/wrangler.production.toml", "--yes"]);
  assert.deepEqual(modes, ["restore"]);
});

test("first-cutover rollback uses only ordered validated topology operations and supports captured prior docs owner", async () => {
  const topology = await loadTopology(); const input = await makeInput();
  input.firstCutover.docsHost.orderedPrestate = [
    { kind: "owner", ownerType: "worker", workerName: "prior-docs-worker" },
    presentDocsDns("prior-docs.example.test"),
  ];
  input.firstCutover.docsHost.prestateDigest = sha256(stableStringify(input.firstCutover.docsHost.orderedPrestate)); input.deploymentInputDigest = deploymentInputDigest(input);
  await validateDeploymentInput(input, validationOptions(input));
  const operations = [];
  await rollbackUnits({ input, topology, firstCutover: true, cloudflareToken: CLOUDFLARE_TOKEN, commandAdapter: async () => ({ stdout: "" }), fetchAdapter: async () => PASSING_SMOKE, ingressAdapter: async () => ({ status: "restored", stateDigest: input.ingress.prestate.stateDigest }), topologyAdapter: async (operation, context) => { operations.push(operation); assert.equal(context.firstCutover.docsHost.orderedPrestate[0].workerName, "prior-docs-worker"); } });
  assert.deepEqual(operations, topology.firstCutover.restoreOperations);
  await assert.rejects(defaultTopologyAdapter("delete-candidate", { commandAdapter: async () => {} }), /undeclared/);
});

test("default topology adapter restores captured docs owner and DNS without Worker deletion or secret mutation", async () => {
  const input = await makeInput();
  const target = "prior-docs.example.test";
  const desiredDns = presentDocsDns(target);
  input.firstCutover.docsHost.orderedPrestate = [
    { kind: "owner", ownerType: "worker", workerName: "prior-docs-worker" },
    desiredDns,
  ];
  const harness = createCloudflareTopologyHarness({
    dnsRecord: { ...desiredDns.record, content: "candidate.example.test", comment: null, tags: [], settings: {} },
  });
  await defaultTopologyAdapter("restore-docs-prestate", { firstCutover: input.firstCutover, cloudflareToken: CLOUDFLARE_TOKEN, topologyFetchAdapter: harness.topologyFetchAdapter, commandAdapter: async () => ({ stdout: "" }) });
  const domainPutIndex = harness.calls.findIndex((call) => call.method === "PUT" && call.pathname.endsWith("/workers/domains"));
  const dnsPutIndex = harness.calls.findIndex((call) => call.method === "PUT" && call.pathname.includes("/dns_records/"));
  assert.ok(domainPutIndex >= 0 && dnsPutIndex > domainPutIndex);
  assert.equal(harness.calls[domainPutIndex].body.environment, undefined);
  assert.ok(harness.calls.filter((call) => call.method === "GET" && call.pathname.endsWith("/workers/domains")).every((call) => call.search.includes("hostname=docs.vcskill.vchun.dev") && call.search.includes("environment=production") && call.search.includes("zone_id=")));
  assert.deepEqual(harness.dnsState.map(({ id: ignored, ...record }) => record), [desiredDns.record]);
  assert.doesNotMatch(JSON.stringify(harness.calls), /wrangler\/delete|\/secrets|secret put|secret delete/i);
});

test("docs topology restore refuses an unexpected current owner before mutation", async () => {
  const input = await makeInput();
  const harness = createCloudflareTopologyHarness({ ownerService: "unexpected-worker" });
  await assert.rejects(defaultTopologyAdapter("restore-docs-prestate", { firstCutover: input.firstCutover, cloudflareToken: CLOUDFLARE_TOKEN, topologyFetchAdapter: harness.topologyFetchAdapter, commandAdapter: async () => ({ stdout: "" }) }), /exact rollback candidate/);
  assert.equal(harness.calls.some((call) => ["PUT", "POST", "DELETE"].includes(call.method)), false);
});

test("docs detach re-reads DNS and does not delete a stale auto-removed record", async () => {
  const input = await makeInput();
  const harness = createCloudflareTopologyHarness({
    dnsRecord: presentDocsDns("candidate.example.test", { comment: null, tags: [] }).record,
    detachClearsDns: true,
  });
  await defaultTopologyAdapter("restore-docs-prestate", { firstCutover: input.firstCutover, cloudflareToken: CLOUDFLARE_TOKEN, topologyFetchAdapter: harness.topologyFetchAdapter, commandAdapter: async () => ({ stdout: "" }) });
  assert.equal(harness.domainState.length, 0); assert.equal(harness.dnsState.length, 0);
  assert.equal(harness.calls.some((call) => call.method === "DELETE" && call.pathname.includes("/dns_records/")), false);
});

test("legacy Wrangler restore commands receive only the explicit Cloudflare mutation credential", async () => {
  const input = await makeInput(); const calls = [];
  for (const operation of ["restore-legacy-version", "restore-legacy-bindings"]) {
    await defaultTopologyAdapter(operation, {
      firstCutover: input.firstCutover,
      cloudflareToken: CLOUDFLARE_TOKEN,
      commandAdapter: async (command, options) => { calls.push({ command, options }); return { stdout: "" }; },
    });
  }
  assert.equal(calls.length, 2);
  assert.ok(calls.every((call) => stableStringify(call.options.injectedEnvironmentVariables) === stableStringify({ CLOUDFLARE_API_TOKEN: CLOUDFLARE_TOKEN, NO_COLOR: "1" })));
});

test("first-cutover validation rejects secret, route order, candidate output, credential, docs state, and restore action drift", async (t) => {
  const base = await makeInput();
  for (const mutate of [
    (value) => { value.firstCutover.legacyWorker.requiredSecretNames.push("EXTRA_SECRET"); },
    (value) => { value.firstCutover.legacyWorker.orderedBindingState.reverse(); },
    (value) => { value.firstCutover.candidateWorker.outputDigest = D1; },
    (value) => { value.firstCutover.legacyWorker.credentialMutation = "rotated"; },
    (value) => { value.firstCutover.docsHost.orderedPrestate.reverse(); },
  ]) {
    const invalid = structuredClone(base); mutate(invalid); invalid.deploymentInputDigest = deploymentInputDigest(invalid);
    await assert.rejects(validateDeploymentInput(invalid, validationOptions(invalid, { verifyLineage: false })), /schema|secret|route|output|credential|docs/i);
  }
  const directory = await mkdtemp(resolve(tmpdir(), "vcskill-topology-")); t.after(() => rm(directory, { recursive: true, force: true }));
  const path = resolve(directory, "topology.json");
  for (const [mutate, expected] of [
    [(value) => value.firstCutover.restoreOperations.push("delete-candidate"), /restore operation drift/],
    [(value) => value.protectedRoutes.pop(), /protected route inventory drift/],
    [(value) => { value.environments.production.units.docs.deployCommand = ["node", "unexpected.mjs"]; }, /unsafe topology unit/],
    [(value) => { value.workerIdentities.docs.production.name = "unexpected-docs-worker"; }, /Worker identity topology drift/],
  ]) {
    const topology = await loadTopology(); mutate(topology); await writeFile(path, JSON.stringify(topology));
    await assert.rejects(loadTopology(path), expected);
  }
});

test("command adapter scrubs inherited secrets, preserves bounded stdout, and never merges stderr", async () => {
  const code = `const e=Reflect.get(process,"env");process.stdout.write(JSON.stringify({cf:Boolean(e["CLOUDFLARE_API_TOKEN"]),gh:Boolean(e["GH_TOKEN"]),npm:Boolean(e["NPM_TOKEN"])}));process.stderr.write("sensitive-stderr")`;
  const result = await defaultCommandAdapter([process.execPath, "-e", code], {
    environmentVariables: { ...Reflect.get(process, "env"), CLOUDFLARE_API_TOKEN: "placeholder-cloudflare-token", GH_TOKEN: "placeholder-github-token", NPM_TOKEN: "placeholder-npm-token" },
  });
  assert.deepEqual(JSON.parse(result.stdout), { cf: false, gh: false, npm: false });
  assert.deepEqual(sanitizeCommandEnvironment({ PATH: "/bin", GITHUB_TOKEN: "placeholder", CLIENT_SECRET: "placeholder", VCSKILL_CORE_PAT: "placeholder", CLOUDFLARE_EMAIL: "placeholder" }), { PATH: "/bin" });
  assert.equal(Object.hasOwn(result, "stderr"), false); assert.doesNotMatch(JSON.stringify(result), /sensitive-stderr/);
});

test("Worker version parser accepts one anchored Wrangler label only", () => {
  assert.equal(parseWorkerVersion(`Uploaded\nWorker Version ID: ${VERSION_A}\n`), VERSION_A);
  assert.equal(parseWorkerVersion(`Current Version ID: ${VERSION_B}\n`), VERSION_B);
  assert.equal(parseWorkerVersion(`uploaded ${VERSION_A}`), null);
  assert.equal(parseWorkerVersion(`Worker Version ID: ${VERSION_A}\nCurrent Version ID: ${VERSION_B}`), null);
});

test("protected-route smoke rejects HTML 200 and any cache policy other than exact no-store", async () => {
  const topology = await loadTopology(); const input = await makeInput({ environment: "staging" });
  for (const protectedResponse of [
    { status: 200, headers: { "cache-control": "no-store", "content-type": "text/html; charset=utf-8" } },
    { status: 200, headers: { "cache-control": "public, max-age=60", "content-type": "text/plain" } },
  ]) {
    await assert.rejects(deployUnits({
      input, topology, cloudflareToken: CLOUDFLARE_TOKEN,
      commandAdapter: async (command) => ({ stdout: command.includes("deploy") ? workerOutput(VERSION_A) : "" }),
      artifactVerifier: async () => {}, aggregateArtifactVerifier: async () => {},
      ingressAdapter: async (options) => options.mode === "restore"
        ? { status: "restored", stateDigest: input.ingress.prestate.stateDigest }
        : { status: "updated", stateDigest: D3, rollbackRequired: true },
      fetchAdapter: async (url) => topology.protectedRoutes.includes(new URL(url).pathname) ? protectedResponse : PASSING_SMOKE,
    }), /protected-route smoke contract failed/);
  }
});

test("command adapter still preserves ordinary stdout exactly", async () => {
  const code = `process.stdout.write(${JSON.stringify(VERSION_A)})`;
  const result = await defaultCommandAdapter([process.execPath, "-e", code]);
  assert.equal(result.stdout, VERSION_A); assert.equal(Object.hasOwn(result, "stderr"), false);
});

test("cutover lifecycle redacts raw IDs and binds policy/input/prestate identity", async () => {
  const input = await makeInput();
  const record = await createCutoverRecord({
    schemaVersion: 1, schema: "https://vcskill.dev/schemas/cutover-record-v1.schema.json", recordId: "start-1", state: "preflight", previousState: null,
    recordedAt: "2026-08-09T18:00:00Z", identity: deploymentIdentity(input), observations: [{ kind: "preflight", status: "passed", deploymentRef: "candidate-b", observedAt: "2026-08-09T18:00:00Z", details: { token: "hidden", providerId: VERSION_A } }], resets: [],
  });
  assert.equal(record.observations[0].details.token, "[redacted]"); assert.equal(record.observations[0].details.providerId, "[redacted]");
  assert.equal(redactRecursively("023e105f4ecef8ad9ca31a8372d0c353"), "[redacted]");
  for (const credential of ["cfut_placeholdervalue1234567890", "github_pat_placeholdervalue1234567890", "npm_placeholdervalue1234567890"]) assert.equal(redactRecursively(credential), "[redacted]");
  assert.throws(() => redactRecursively(Array.from({ length: 257 }, () => "x")), /redaction limit/);
  const next = { ...record, recordId: "start-2", state: "cutover-started", previousState: "preflight", recordedAt: "2026-08-09T18:01:00Z" };
  assert.equal((await createCutoverRecord(next, { previousRecord: record })).state, "cutover-started");
  assert.throws(() => assertLegalTransition("preflight", "soak-complete"), /illegal/);
  assert.equal(redactRecursively({ signedUrl: "value" }).signedUrl, "[redacted]");
  assert.equal(redactRecursively("https://private.example.test/internal?id=1"), "[redacted]");
  assert.equal(redactRecursively("internal endpoint: https://private.example.test"), "[redacted]");
  assert.equal(redactRecursively("https://vcskill.vchun.dev/version?cache=private"), "https://vcskill.vchun.dev/version?[query-redacted]");
});

test("convergence models held staging and immutable production exactly", async () => {
  const topology = await loadTopology();
  for (const environment of ["staging", "production"]) {
    const input = await makeInput({ environment });
    const observation = {
      identity: deploymentIdentity(input),
      release: {
        tag: input.release.tag, version: input.release.version, sourceSha: input.release.sourceSha,
        publicationState: input.release.publicationState, draft: input.release.draft, immutable: input.release.immutable, latest: input.release.latest,
        assetSetDigest: D1, docsManifestDigest: D2, docsBundleDigest: D3,
      },
      units: input.units.map(({ id, artifactVersion, configDigest, outputDigest }) => ({ id, artifactVersion, configDigest, outputDigest })),
      smoke: topology.protectedRoutes.map((route) => ({ route, status: "passed" })),
    };
    assert.equal(verifyConvergence(input, observation, { protectedRoutes: topology.protectedRoutes }).status, "converged");
    const incompleteSmoke = structuredClone(observation); incompleteSmoke.smoke.pop();
    assert.throws(() => verifyConvergence(input, incompleteSmoke, { protectedRoutes: topology.protectedRoutes }), /inventory drift/);
    observation.release.latest = !observation.release.latest;
    assert.throws(() => verifyConvergence(input, observation, { protectedRoutes: topology.protectedRoutes }), /drift/);
  }
});

test("soak remains continuous for at least 24 hours and resets on drift", async () => {
  const identity = deploymentIdentity(await makeInput());
  const record = {
    cutoverSucceededAt: "2026-08-01T00:00:00Z", identity, resets: [{ trigger: "failed-smoke", observedAt: "2026-08-01T12:00:00Z" }],
    samples: [{ observedAt: "2026-08-01T12:00:00Z", status: "passed", identity }, { observedAt: "2026-08-02T12:00:00Z", status: "passed", identity }],
  };
  assert.equal(verifySoak(record, { now: "2026-08-02T12:00:00Z" }).continuousHours, 24);
  assert.throws(() => verifySoak(record, { now: "2026-08-02T11:59:59Z" }), /shorter than 24/);
  for (const resets of [
    [{ trigger: "failed-smoke", observedAt: "not-a-date" }],
    [{ trigger: "failed-smoke", observedAt: "2026-07-31T23:59:59Z" }],
    [{ trigger: "failed-smoke", observedAt: "2026-08-03T00:00:00Z" }],
    [{ trigger: "failed-smoke", observedAt: "2026-08-01T12:00:00Z" }, { trigger: "failed-smoke", observedAt: "2026-08-01T11:00:00Z" }],
  ]) assert.throws(() => verifySoak({ ...record, resets }, { now: "2026-08-02T12:00:00Z" }), /reset timestamps/);
});

test("workflows are pinned, parity-safe, least-privilege, exact-checkout, and share one environment mutex", async () => {
  const workflows = {};
  for (const name of ["deploy", "rollback"]) {
    const text = await readFile(resolve(ROOT, `.github/workflows/${name}.yml`), "utf8"); const parsed = YAML.parse(text); workflows[name] = { text, parsed };
    const uses = [...text.matchAll(/^\s*uses:\s*([^\s#]+)$/gm)].map((match) => match[1]); assert.ok(uses.length >= 3);
    for (const action of uses) assert.match(action, /@[a-f0-9]{40}$/);
    assert.deepEqual(parsed.permissions, {}); assert.equal(parsed.concurrency.group, "web-mutation-${{ inputs.environment }}"); assert.equal(parsed.concurrency["cancel-in-progress"], false);
    const job = parsed.jobs[name]; assert.deepEqual(job.permissions, { contents: "read" }); assert.match(text, /ref: \$\{\{ inputs\.product_sha \}\}/);
    assert.match(text, /--skip-artifacts=true/); assert.doesNotMatch(text, /VCSKILL_CORE_PAT|contents:\s*write|deployments:\s*write/);
    assert.doesNotMatch(text, /immutable-releases|prevent_self_review|can_admins_bypass|reviewer\.id|caller\.id/);
    assert.match(text, /unset CLOUDFLARE_API_TOKEN/); assert.match(text, /export -n cloudflare_token/);
    assert.ok(text.indexOf("unset CLOUDFLARE_API_TOKEN") < text.indexOf(`node scripts/deploy/${name}-units.mjs`));
    assert.doesNotMatch(text, /printf[^\n]+\$CLOUDFLARE_API_TOKEN[^\n]+node scripts\/deploy/);
  }
  assert.match(workflows.deploy.text, /deploy-units\.mjs/); assert.match(workflows.rollback.text, /rollback-units\.mjs/);
});

test("source-controlled topology and attestation schema bind the Phase 2 finalizer contract portably", async () => {
  const topology = await loadTopology();
  assert.deepEqual(topology.finalizer, {
    repository: "bavanchun/vcskill",
    path: ".github/workflows/finalize-release.yml",
    environment: "core-release-production",
    permissions: FINALIZER_PERMISSIONS,
  });
  const attestation = makePolicyAttestation();
  await validateSchema(attestation, POLICY_SCHEMA);
  assert.deepEqual(attestation.finalizer.permissions, topology.finalizer.permissions);
});

test("all deployment CLIs parse as ESM without cloud or network mutation", async () => {
  const names = ["validate-deployment-input", "deploy-units", "rollback-units", "write-cutover-record", "verify-convergence", "verify-soak", "verify-production-environment"];
  for (const name of names) assert.match(await readFile(resolve(ROOT, `scripts/deploy/${name}.mjs`), "utf8"), /runMain/);
});

test("production policy CLI rejects caller-controlled time", () => {
  const result = spawnSync(process.execPath, [resolve(ROOT, "scripts/deploy/verify-production-environment.mjs"), "--now=2026-08-09T18:00:00Z"], { encoding: "utf8" });
  assert.equal(result.status, 1); assert.match(result.stderr, /unsupported argument: --now/);
});
