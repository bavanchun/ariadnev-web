import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { writeDecisionArtifacts } from "./edge-evidence-artifacts.mjs";
import { buildIngressRule, ingressPolicyDigest, loadIngressPolicy } from "./edge-ingress-policy.mjs";
import { readTokenFromStdin, reconcileIngressRule } from "./manage-edge-ingress-rule.mjs";
import {
  normalizeBaseUrl,
  REQUIRED_CELL_IDS,
  REQUIRED_CELLS,
  REQUIRED_REPETITIONS,
  sanitizeObservedCell,
  validateObservedMatrix,
  validateSanitizedDecision,
  validateStagingStateRecord,
} from "./edge-evidence-policy.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const defaultDecisionPath = resolve(repoRoot, "docs/decisions/edge-routing-topology.md");
const defaultStatePath = resolve(repoRoot, "docs/decisions/edge-staging-state.json");
const stagingWranglerPath = resolve(repoRoot, "workers/edge/wrangler.combined.toml");

export { sanitizeObservedCell, validateStagingStateRecord, writeDecisionArtifacts };

const localScenarios = {
  "candidate-a-protected-query": ["/version?source=docs", "protected-edge-response"],
  "candidate-a-lookalike-query": ["/installer?from=docs", "site-lookalike-preserved"],
  "candidate-a-malformed-download": ["/download/%E0%A4%A", "bounded-edge-error"],
  "candidate-a-route-transfer-rollback": ["/version", "no-gap"],
  "candidate-b-collision-version": ["/version", "protected-edge-response"],
  "candidate-b-physical-404": ["/not-found", "physical-404"],
  "combined-missing-secret": ["/installer", "legacy-global-secret-error"],
  "pinned-version": ["/version?version=1.2.3", "exact-release"],
  "pinned-download": ["/download/checksums.txt?version=1.2.3", "exact-release-stream"],
  "upstream-failure": ["/version", "empty-bounded-error"],
  "deploy-order-edge-then-site": ["/version", "no-gap"],
  "deploy-order-site-then-edge": ["/download/checksums.txt", "no-gap"],
  "rollback-order-edge-then-site": ["/version", "legacy-restored"],
  "rollback-order-site-then-edge": ["/download/checksums.txt", "legacy-restored"],
  "legacy-cutover-restore": ["/install", "legacy-binding-restored"],
};

export function buildDeterministicLocalMatrix({ baseUrl, profile }) {
  return {
    environment: {
      evidenceKind: "local-contract-plan",
      observedAt: "2026-08-08T00:00:00.000Z",
      baseUrl: normalizeBaseUrl(baseUrl),
      profile,
    },
    cells: REQUIRED_CELL_IDS.flatMap((id) => Array.from({ length: REQUIRED_REPETITIONS }, (_, repetition) => ({
      id,
      repetition: repetition + 1,
      requestPath: localScenarios[id][0],
      expected: localScenarios[id][1],
      expectedStatus: REQUIRED_CELLS[id][0],
      expectedContentClass: REQUIRED_CELLS[id][1],
      expectedCacheControl: REQUIRED_CELLS[id][2],
      observed: false,
      pass: null,
    }))),
  };
}

export function buildLiveProbeSpecs(version) {
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version || "")) throw new Error("--version must be a stable semver");
  return [
    { id: "current-version", path: "/version", status: 200, contentClass: "version-text", cacheControl: "no-store" },
    { id: "pinned-version", path: `/version?version=${version}`, status: 200, contentClass: "version-text", cacheControl: "no-store", bodyText: version },
    { id: "pinned-checksums", path: `/download/checksums.txt?version=${version}`, status: 200, contentClass: "download-stream", cacheControl: "no-store", disposition: "checksums.txt" },
    { id: "encoded-checksums", path: "/download/checksums%2Etxt", status: 200, contentClass: "download-stream", cacheControl: "no-store", disposition: "checksums.txt" },
    { id: "physical-404", path: "/not-found", status: 404, contentClass: "physical-404", cacheControl: "no-store" },
    { id: "site-lookalike", path: "/installer", status: 200, contentClass: "site-lookalike", cacheControl: "public, max-age=300" },
    { id: "raw-dot-segment-lower", path: "/download/%2e%2e", status: 403, contentClass: "ingress-block", cacheControl: "(absent)" },
    { id: "raw-dot-segment-mixed", path: "/download/a/%2E%2e/checksums.txt", status: 403, contentClass: "ingress-block", cacheControl: "(absent)" },
  ];
}

export function runExternalCommand(command, args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.resume();
    child.once("error", () => reject(new Error(`external command could not start: ${command}`)));
    child.once("close", (code) => {
      if (code === 0) resolvePromise(stdout);
      else reject(new Error(`external command failed: ${command}; exit=${Number.isInteger(code) ? code : "unknown"}`));
    });
  });
}

export async function resolveCurrentStagingVersion(runCommand = runExternalCommand) {
  const raw = await runCommand("npx", ["wrangler", "deployments", "status", "--config", stagingWranglerPath, "--json"]);
  const deployment = JSON.parse(raw);
  const active = Array.isArray(deployment.versions) ? deployment.versions.filter((entry) => entry.percentage === 100) : [];
  const version = active.length === 1 ? active[0].version_id : null;
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(version || "")) throw new Error("one exact active staging Worker version is required");
  return version;
}

function parseHeaders(rawHeaders) {
  const blocks = rawHeaders.split(/\r?\n\r?\n/).filter((block) => /^HTTP\//.test(block));
  const lines = (blocks.at(-1) || "").split(/\r?\n/).slice(1);
  const headers = new Map();
  for (const line of lines) {
    const separator = line.indexOf(":");
    if (separator > 0) headers.set(line.slice(0, separator).toLowerCase(), line.slice(separator + 1).trim());
  }
  return headers;
}

async function curlProbe(baseUrl, requestPath) {
  const probeDir = await mkdtemp(resolve(tmpdir(), "vcskill-edge-probe-"));
  const headersPath = resolve(probeDir, "headers.txt");
  const bodyPath = resolve(probeDir, "body.bin");
  try {
    const statusText = await runExternalCommand("curl", [
      "--silent", "--show-error", "--path-as-is", "--max-time", "30", "--max-filesize", "2000000",
      "--dump-header", headersPath, "--output", bodyPath, "--write-out", "%{http_code}", `${baseUrl.replace(/\/$/, "")}${requestPath}`,
    ]);
    const [rawHeaders, body] = await Promise.all([readFile(headersPath, "utf8"), readFile(bodyPath)]);
    return { status: Number(statusText), headers: parseHeaders(rawHeaders), body };
  } finally {
    await rm(probeDir, { recursive: true, force: true });
  }
}

const stableVersionPattern = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/;
const fixtureLeakPattern = /(?:Edge Routing Spike Fixture|Fixture Download Landing|SHOULD NOT LEAK|fixture home)/i;

function isChecksumManifest(bodyText) {
  const lines = bodyText.trim().split(/\r?\n/).filter(Boolean);
  return lines.length > 0 && lines.every((line) => /^[a-f0-9]{64}\s{2}\S+$/i.test(line));
}

export function deriveLiveContentClass(observation) {
  const contentType = observation.headers.get("content-type") || "";
  const disposition = observation.headers.get("content-disposition") || "";
  const bodyText = observation.body.toString("utf8");
  const trimmedBody = bodyText.trim();
  const cfRayPresent = observation.headers.has("cf-ray");

  if (observation.status === 403 && cfRayPresent && !fixtureLeakPattern.test(bodyText)) return "ingress-block";
  if (observation.status === 404 && observation.body.byteLength === 0 && contentType === "") return "physical-404";
  if (observation.status === 200 && contentType.startsWith("text/plain") && stableVersionPattern.test(trimmedBody)) return "version-text";
  if (
    observation.status === 200
    && contentType.startsWith("application/octet-stream")
    && disposition === 'attachment; filename="checksums.txt"'
    && isChecksumManifest(bodyText)
  ) return "download-stream";
  if (observation.status === 200 && trimmedBody === "fixture lookalike") return "site-lookalike";
  return "unexpected-response";
}

function classifyLiveProbe(spec, observation) {
  const cacheControl = observation.headers.get("cache-control") || "(absent)";
  const disposition = observation.headers.get("content-disposition") || "";
  const bodyText = observation.body.toString("utf8");
  const contentClass = deriveLiveContentClass(observation);
  const bodyMatches = spec.bodyText === undefined || bodyText.trim() === spec.bodyText;
  const dispositionMatches = spec.disposition === undefined || disposition === `attachment; filename=\"${spec.disposition}\"`;
  const cacheMatches = spec.contentClass === "ingress-block"
    ? ["(absent)", "no-store"].includes(cacheControl)
    : cacheControl === spec.cacheControl;
  return {
    id: spec.id,
    requestPath: spec.path.includes("?") ? `${spec.path.split("?", 1)[0]}?[query-redacted]` : spec.path,
    status: observation.status,
    contentClass,
    cacheControl,
    bodySha256: createHash("sha256").update(observation.body).digest("hex"),
    cfRayPresent: observation.headers.has("cf-ray"),
    observedAt: new Date().toISOString(),
    pass: observation.status === spec.status
      && contentClass === spec.contentClass
      && cacheMatches
      && bodyMatches
      && dispositionMatches
      && observation.headers.has("cf-ray"),
  };
}

function validateIngressCheck(result, expectedRule, expectedDigest) {
  if (
    result?.status !== "current"
    || result.ref !== expectedRule.ref
    || result.policyDigest !== expectedDigest
    || result.position !== 1
  ) throw new Error("source-controlled staging ingress rule is not current");
}

export async function collectLiveCandidateBProbes({
  baseUrl,
  version,
  probe = curlProbe,
  resolveVersion = resolveCurrentStagingVersion,
  checkIngressRule,
}) {
  if (typeof checkIngressRule !== "function") throw new Error("live re-probe requires a remote staging ingress-rule check");
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const specs = buildLiveProbeSpecs(version);
  const policy = await loadIngressPolicy();
  const expectedRule = buildIngressRule(policy, "staging");
  const expectedDigest = ingressPolicyDigest(policy, "staging");
  const checkedBeforeAt = new Date().toISOString();
  validateIngressCheck(await checkIngressRule(), expectedRule, expectedDigest);
  const workerVersionId = await resolveVersion();
  const cells = [];
  for (const spec of specs) cells.push(classifyLiveProbe(spec, await probe(normalizedBaseUrl, spec.path)));
  validateIngressCheck(await checkIngressRule(), expectedRule, expectedDigest);
  const checkedAfterAt = new Date().toISOString();
  return {
    environment: {
      evidenceKind: "cloudflare-live-reprobe",
      observedAt: new Date().toISOString(),
      baseUrl: normalizedBaseUrl,
      profile: "combined",
    },
    ingressGuard: {
      status: "current",
      ref: expectedRule.ref,
      policyDigest: expectedDigest,
      position: 1,
      checkedBeforeAt,
      checkedAfterAt,
    },
    workerVersionId,
    cells,
  };
}

function parseArgs(argv) {
  const options = {
    baseUrl: "https://staging.vcskill.vchun.dev",
    profile: "spike",
    liveInputPath: null,
    probeLive: false,
    checkIngress: false,
    version: null,
    writeArtifacts: false,
    decisionPath: defaultDecisionPath,
    statePath: defaultStatePath,
  };
  for (const arg of argv) {
    if (arg === "--write-artifacts") options.writeArtifacts = true;
    else if (arg === "--probe-live") options.probeLive = true;
    else if (arg === "--check-ingress") options.checkIngress = true;
    else if (arg.startsWith("--base-url=")) options.baseUrl = arg.slice(11);
    else if (arg.startsWith("--profile=")) options.profile = arg.slice(10);
    else if (arg.startsWith("--live-input=")) options.liveInputPath = resolve(repoRoot, arg.slice(13));
    else if (arg.startsWith("--version=")) options.version = arg.slice(10);
    else if (arg.startsWith("--decision-path=")) options.decisionPath = resolve(repoRoot, arg.slice(16));
    else if (arg.startsWith("--state-path=")) options.statePath = resolve(repoRoot, arg.slice(13));
    else throw new Error(`unsupported argument: ${arg}`);
  }
  return options;
}

async function loadMatrix(options) {
  if (!options.liveInputPath) return buildDeterministicLocalMatrix(options);
  return JSON.parse(await readFile(options.liveInputPath, "utf8"));
}

async function main(argv) {
  const options = parseArgs(argv);
  if (options.probeLive) {
    if (options.liveInputPath || options.writeArtifacts) throw new Error("live re-probe cannot be combined with recorded artifact input");
    if (!options.checkIngress) throw new Error("live re-probe requires --check-ingress and a Cloudflare token on stdin");
    const token = await readTokenFromStdin();
    const observations = await collectLiveCandidateBProbes({
      ...options,
      checkIngressRule: () => reconcileIngressRule({ mode: "check", environment: "staging", token }),
    });
    process.stdout.write(`${JSON.stringify(observations, null, 2)}\n`);
    if (observations.cells.some((cell) => cell.pass !== true)) process.exitCode = 1;
    return;
  }
  const matrix = await loadMatrix(options);
  if (options.liveInputPath) {
    validateSanitizedDecision(matrix.decision);
    validateObservedMatrix(matrix, matrix.decision.selectedCandidate);
    validateStagingStateRecord(matrix.stagingState);
  }
  if (options.writeArtifacts) {
    if (!options.liveInputPath) throw new Error("artifact writing requires a controller-provided live observation file");
    await writeDecisionArtifacts({
      decisionPath: options.decisionPath,
      statePath: options.statePath,
      observedMatrix: matrix,
      decision: matrix.decision,
      stagingState: matrix.stagingState,
    });
  }
  const cells = options.liveInputPath ? matrix.cells.map(sanitizeObservedCell) : matrix.cells;
  const environment = {
    mode: options.liveInputPath ? "recorded-live" : "local-contract-plan",
    observedAt: matrix.environment.observedAt,
    baseUrl: normalizeBaseUrl(matrix.environment.baseUrl),
    profile: ["edge", "combined", "spike"].includes(matrix.environment.profile) ? matrix.environment.profile : "[invalid-profile]",
  };
  process.stdout.write(`${JSON.stringify({ environment, cells }, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
