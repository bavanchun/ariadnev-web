import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

import { normalizeResponse, parseArgs, validateBaseUrl, validateOutputDate } from "../../scripts/capture-production-baseline.mjs";
import { loadLegacyWorker } from "./load-legacy-worker.mjs";

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(testDir, "..", "..");
const baselineDir = join(repoRoot, "tests", "baselines", "production-2026-08-09");
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const contract = readJson(join(testDir, "public-edge-contracts.json"));
const findabilityTasks = readJson(join(repoRoot, "tests/benchmarks/findability-tasks.json"));
const behavioralTier2 = readJson(join(repoRoot, "tests/benchmarks/behavioral-tier-2.json"));
const viewportMatrix = readJson(join(repoRoot, "tests/benchmarks/viewport-matrix.json"));
const performanceBudgets = readJson(join(repoRoot, "tests/benchmarks/performance-budgets.json"));
const performanceMatrix = readJson(join(repoRoot, "tests/benchmarks/performance-matrix.json"));
const benchmarkSchema = readJson(join(repoRoot, "tests/benchmarks/benchmark-contract.schema.json"));
const landingHtml = readFileSync(join(repoRoot, "landing.html"), "utf8");

const shellInstaller = "#!/usr/bin/env bash\nasset=\"vcskill-linux-x64\"\n";
const powershellInstaller = "$asset = \"vcskill-windows-x64.exe\"\n";
const checksumsBody = [
  "1111111111111111111111111111111111111111111111111111111111111111  vcskill-darwin-arm64",
  "2222222222222222222222222222222222222222222222222222222222222222  vcskill-darwin-x64",
  "3333333333333333333333333333333333333333333333333333333333333333  vcskill-linux-arm64",
  "4444444444444444444444444444444444444444444444444444444444444444  vcskill-linux-x64",
  "5555555555555555555555555555555555555555555555555555555555555555  vcskill-windows-x64.exe",
].join("\n");

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function bodyClass(text, method = "GET") {
  if (method === "HEAD") return "empty-head";
  if (text === landingHtml) return "landing-html";
  if (text.startsWith("#!/usr/bin/env bash")) return "installer-shell";
  if (text.startsWith("$asset = \"vcskill-windows-x64.exe\"")) return "installer-powershell";
  if (text === checksumsBody) return "download-stream";
  if (text === contract.globalBehavior.missingSecret.bodyText) return "missing-secret";
  if (text === "release lookup failed") return "release-lookup-failed";
  if (text.startsWith("asset not found: ")) return "asset-not-found";
  if (text === "") return "empty";
  if (text === "0.11.0") return "version-text";
  if (text.includes("vcskill — install:")) return "plain-install-hint";
  return "text";
}

function createMockFetch(options = {}) {
  const calls = [];
  const assetUrl = "https://api.github.com/assets/checksums.txt";
  const fetchImpl = async (input, init = {}) => {
    const url = typeof input === "string" ? input : input.url;
    calls.push({ url, init });
    if (url === "https://api.github.com/repos/bavanchun/vcskill/releases/latest") {
      if (options.latestOk === false) return new Response("upstream release failure", { status: options.latestStatus || 503 });
      return Response.json({ tag_name: options.latestTag || "vcskill@0.11.0", assets: [{ name: "checksums.txt", url: assetUrl }] });
    }
    if (url === assetUrl) return new Response(options.assetBody ?? checksumsBody, { status: options.assetStatus || 200 });
    if (url === "https://api.github.com/repos/bavanchun/vcskill/contents/install.sh?ref=main") {
      return new Response(options.shellBody ?? shellInstaller, { status: options.shellStatus || 200 });
    }
    if (url === "https://api.github.com/repos/bavanchun/vcskill/contents/install.ps1?ref=main") {
      return new Response(options.powershellBody ?? powershellInstaller, { status: options.powershellStatus || 200 });
    }
    throw new Error(`unexpected upstream fetch: ${url}`);
  };
  fetchImpl.calls = calls;
  return fetchImpl;
}

async function invokeLocal(scenario, options = {}) {
  const fetchImpl = options.fetchImpl || createMockFetch(options.mock);
  const worker = await loadLegacyWorker({
    fetchImpl,
    token: Object.prototype.hasOwnProperty.call(options, "token") ? options.token : "test-token",
    landingHtml,
  });
  const request = new Request(`https://vcskill.vchun.dev${scenario.request.path}`, { method: scenario.request.method });
  const response = await worker.fetch(request);
  const bodyText = response.body ? await response.text() : "";
  const headers = {};
  for (const name of contract.allowedResponseHeaders) {
    const value = response.headers.get(name);
    if (value !== null) headers[name] = value;
  }
  return { status: response.status, headers, bodyText, bodySha256: sha256(bodyText), bodyClass: bodyClass(bodyText, scenario.request.method) };
}

function assertScenario(actual, scenario) {
  assert.equal(actual.status, scenario.expected.status, `${scenario.id} status`);
  for (const [name, expected] of Object.entries(scenario.expected.headers || {})) {
    assert.equal(actual.headers[name], expected, `${scenario.id} header ${name}`);
  }
  if (scenario.expected.body?.text !== undefined) assert.equal(actual.bodyText, scenario.expected.body.text, `${scenario.id} body`);
  if (scenario.expected.body?.class) assert.equal(actual.bodyClass, scenario.expected.body.class, `${scenario.id} body class`);
  if (!scenario.expected.machinePathMayBecomeHtml200 && actual.status === 200) {
    assert.notEqual(actual.headers["content-type"], "text/html; charset=utf-8", `${scenario.id} protected path became HTML 200`);
  }
}

async function runContract(target, scenarios) {
  for (const scenario of scenarios) assertScenario(await target(scenario), scenario);
}

function siteData() {
  const start = landingHtml.indexOf("// SITE_DATA_START");
  const end = landingHtml.indexOf("// SITE_DATA_END");
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const context = {};
  vm.runInNewContext(landingHtml.slice(start, end), context);
  return context.SITE;
}

function schemaAt(ref) {
  assert.match(ref, /^#\//);
  return ref.slice(2).split("/").reduce((value, key) => value[key.replaceAll("~1", "/").replaceAll("~0", "~")], benchmarkSchema);
}

function validateSchema(value, schema, path = "$") {
  if (schema.$ref) return validateSchema(value, schemaAt(schema.$ref), path);
  if (schema.oneOf) {
    const matches = schema.oneOf.map((candidate) => validateSchema(value, candidate, path)).filter((errors) => errors.length === 0);
    return matches.length === 1 ? [] : [`${path} must match exactly one schema`];
  }
  const errors = [];
  if (schema.const !== undefined && value !== schema.const) errors.push(`${path} must equal ${JSON.stringify(schema.const)}`);
  if (schema.enum && !schema.enum.includes(value)) errors.push(`${path} is outside enum`);
  if (schema.type === "object") {
    if (!value || typeof value !== "object" || Array.isArray(value)) return [`${path} must be object`];
    for (const key of schema.required || []) if (!Object.hasOwn(value, key)) errors.push(`${path}.${key} is required`);
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) if (!Object.hasOwn(schema.properties || {}, key)) errors.push(`${path}.${key} is not allowed`);
    }
    for (const [key, child] of Object.entries(schema.properties || {})) {
      if (Object.hasOwn(value, key)) errors.push(...validateSchema(value[key], child, `${path}.${key}`));
    }
  } else if (schema.type === "array") {
    if (!Array.isArray(value)) return [`${path} must be array`];
    if (schema.minItems !== undefined && value.length < schema.minItems) errors.push(`${path} has too few items`);
    if (schema.maxItems !== undefined && value.length > schema.maxItems) errors.push(`${path} has too many items`);
    value.forEach((item, index) => errors.push(...validateSchema(item, schema.items, `${path}[${index}]`)));
  } else if (schema.type === "string") {
    if (typeof value !== "string") return [`${path} must be string`];
    if (schema.minLength !== undefined && value.length < schema.minLength) errors.push(`${path} is too short`);
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) errors.push(`${path} does not match pattern`);
  } else if (schema.type === "number") {
    if (typeof value !== "number" || !Number.isFinite(value)) return [`${path} must be finite number`];
  } else if (schema.type === "integer") {
    if (!Number.isInteger(value)) return [`${path} must be integer`];
  }
  if (typeof value === "number") {
    if (schema.minimum !== undefined && value < schema.minimum) errors.push(`${path} is below minimum`);
    if (schema.maximum !== undefined && value > schema.maximum) errors.push(`${path} exceeds maximum`);
    if (schema.exclusiveMinimum !== undefined && value <= schema.exclusiveMinimum) errors.push(`${path} must exceed minimum`);
  }
  return errors;
}

function validateBenchmarkSemantics(value) {
  const matrix = value.performanceMatrix;
  if (!Array.isArray(matrix?.routes) || !Array.isArray(matrix?.interactions)) return [];
  const errors = [];
  const routeIds = matrix.routes.map((route) => route.id);
  const interactionIds = matrix.interactions.map((interaction) => interaction.id);
  if (new Set(routeIds).size !== routeIds.length) errors.push("performance routes must have unique IDs");
  if (new Set(interactionIds).size !== interactionIds.length) errors.push("performance interactions must have unique IDs");
  const declaredRoutes = new Set(routeIds);
  for (const interaction of matrix.interactions) {
    if (!declaredRoutes.has(interaction.routeId)) errors.push(`${interaction.id} references undeclared route ${interaction.routeId}`);
  }
  const expectedQualification = Array.from({ length: 5 }, (_, index) => routeIds.map((id) => `${id}#${index + 1}`)).flat();
  if (JSON.stringify(matrix.qualificationRunOrder) !== JSON.stringify(expectedQualification)) {
    errors.push("qualification run order must cover every declared route exactly five times in frozen order");
  }
  const observableRouteIds = matrix.routes.filter((route) => route.legacyBaseline === "observable").map((route) => route.id);
  const expectedLegacy = observableRouteIds.flatMap((id) => Array.from({ length: 5 }, (_, index) => `${id}#${index + 1}`));
  if (JSON.stringify(matrix.legacyBaselineRunOrder) !== JSON.stringify(expectedLegacy)) {
    errors.push("legacy run order must cover every observable route exactly five times");
  }
  return errors;
}

function validateBenchmarkContract(value) {
  return [...validateSchema(value, benchmarkSchema), ...validateBenchmarkSemantics(value)];
}

test("local route contract preserves status, headers, methods, query, encoding, and fallthrough", async () => {
  await runContract((scenario) => invokeLocal(scenario), contract.scenarios.filter((scenario) => scenario.mode !== "production-only"));
});

test("missing secret and malformed decode preserve handler and public-ingress layers", async () => {
  const missing = await invokeLocal(contract.scenarios[0], { token: undefined });
  assert.equal(missing.status, contract.globalBehavior.missingSecret.status);
  assert.equal(missing.bodyText, contract.globalBehavior.missingSecret.bodyText);
  await assert.rejects(
    invokeLocal({ request: { method: "GET", path: "/download/%E0%A4%A" } }),
    (error) => error?.name === contract.globalBehavior.malformedDownloadDecode.localErrorName,
  );
  assert.equal(contract.globalBehavior.malformedDownloadDecode.publicAuthority, "production-ingress");
});

test("upstream release, asset, Unix installer, and PowerShell failures remain exact", async () => {
  const cases = contract.localMockCases;
  const release = await invokeLocal(cases.releaseLookupFailure, { mock: { latestOk: false, latestStatus: 503 } });
  assert.equal(release.status, cases.releaseLookupFailure.expected.status);
  assert.equal(release.bodyText, cases.releaseLookupFailure.expected.bodyText);
  const missing = await invokeLocal(cases.downloadMissingAsset);
  assert.equal(missing.status, cases.downloadMissingAsset.expected.status);
  assert.equal(missing.bodyText, cases.downloadMissingAsset.expected.bodyText);
  const version = await invokeLocal(cases.versionLookupFailure, { mock: { latestOk: false, latestStatus: 500 } });
  assert.equal(version.status, cases.versionLookupFailure.expected.status);
  const install = await invokeLocal(cases.installUpstreamFailure, { mock: { shellStatus: 404, shellBody: "missing" } });
  assertScenario(install, { id: "install-upstream", expected: cases.installUpstreamFailure.expected });
  const powershell = await invokeLocal(cases.powershellUpstreamFailure, { mock: { powershellStatus: 500, powershellBody: "failed" } });
  assertScenario(powershell, { id: "powershell-upstream", expected: cases.powershellUpstreamFailure.expected });
  const asset = await invokeLocal(cases.assetUpstreamFailure, { mock: { assetStatus: 503, assetBody: cases.assetUpstreamFailure.expected.bodyText } });
  assertScenario(asset, { id: "asset-upstream", expected: cases.assetUpstreamFailure.expected });
});

test("download proxy follows upstream redirects and streams the asset body", async () => {
  const chunks = [Buffer.from("first-"), Buffer.from("second")];
  const stream = new ReadableStream({
    pull(controller) {
      const chunk = chunks.shift();
      if (chunk) controller.enqueue(chunk);
      else controller.close();
    },
  });
  const fetchImpl = createMockFetch({ assetBody: stream });
  const scenario = contract.scenarios.find((item) => item.id === "download-checksums");
  const worker = await loadLegacyWorker({ fetchImpl, token: "test-token", landingHtml });
  const response = await worker.fetch(new Request(`https://vcskill.vchun.dev${scenario.request.path}`));
  assert.ok(response.body instanceof ReadableStream);
  assert.equal(await response.text(), "first-second");
  const assetCall = fetchImpl.calls.find((call) => call.url.includes("/assets/checksums.txt"));
  assert.equal(assetCall.init.redirect, "follow");
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("benchmark assets validate as one JSON Schema contract", () => {
  const value = { findability: findabilityTasks, behavioralTier2, viewportMatrix, performanceBudgets, performanceMatrix };
  assert.deepEqual(validateBenchmarkContract(value), []);
  assert.equal(new Set(findabilityTasks.tasks.map((task) => task.id)).size, 15);
  assert.equal(new Set(behavioralTier2.journeys.map((journey) => journey.id)).size, behavioralTier2.journeys.length);

  const missingRunner = structuredClone(value);
  delete missingRunner.performanceMatrix.runner.region;
  assert.notDeepEqual(validateBenchmarkContract(missingRunner), []);
  const openProfile = structuredClone(value);
  openProfile.performanceMatrix.profile.unfrozen = true;
  assert.notDeepEqual(validateBenchmarkContract(openProfile), []);
  const missingReason = structuredClone(value);
  delete missingReason.performanceBudgets.budgets.find((budget) => budget.id === "docs-lcp").baseline.reason;
  assert.notDeepEqual(validateBenchmarkContract(missingReason), []);
  const malformedStep = structuredClone(value);
  malformedStep.performanceMatrix.interactions[0].steps[0].key = "Enter";
  assert.notDeepEqual(validateBenchmarkContract(malformedStep), []);
  const undeclaredRoute = structuredClone(value);
  undeclaredRoute.performanceMatrix.interactions[0].routeId = "ghost-route";
  assert.notDeepEqual(validateBenchmarkContract(undeclaredRoute), []);
  const duplicateRoute = structuredClone(value);
  duplicateRoute.performanceMatrix.routes[0].id = "docs-en-installation";
  assert.notDeepEqual(validateBenchmarkContract(duplicateRoute), []);
  const reorderedRun = structuredClone(value);
  [reorderedRun.performanceMatrix.qualificationRunOrder[0], reorderedRun.performanceMatrix.qualificationRunOrder[1]] =
    [reorderedRun.performanceMatrix.qualificationRunOrder[1], reorderedRun.performanceMatrix.qualificationRunOrder[0]];
  assert.notDeepEqual(validateBenchmarkContract(reorderedRun), []);
  const changedCache = structuredClone(value);
  changedCache.performanceMatrix.profile.browserCache = "shared browser cache";
  assert.notDeepEqual(validateBenchmarkContract(changedCache), []);
});

test("frozen routes, viewports, run order, aggregation, interactions, and caps cannot drift silently", () => {
  assert.deepEqual(viewportMatrix.viewports.map((viewport) => viewport.width), [320, 375, 390, 768, 1280, 1440]);
  assert.equal(performanceBudgets.methodology.coldCacheRuns, 5);
  assert.equal(performanceBudgets.methodology.networkProfile, "Fast 4G");
  assert.equal(performanceBudgets.methodology.cpuSlowdownMultiplier, 4);
  assert.deepEqual(performanceMatrix.routes.map((route) => route.path), [
    "/", "/en/stable/get-started/installation/", "/vi/stable/get-started/installation/",
  ]);
  assert.deepEqual(
    performanceMatrix.qualificationRunOrder,
    Array.from({ length: 5 }, (_, index) => performanceMatrix.routes.map((route) => `${route.id}#${index + 1}`)).flat(),
  );
  assert.deepEqual(performanceMatrix.legacyBaselineRunOrder, Array.from({ length: 5 }, (_, index) => `marketing-home#${index + 1}`));
  assert.deepEqual(performanceMatrix.perRouteAggregation, { requiredValidSamples: 5, gate: "median", report: ["median", "maximum"] });
  const frozenCaps = Object.fromEntries(performanceBudgets.budgets.map((budget) => [budget.id, budget.cap]));
  assert.deepEqual(frozenCaps, {
    "marketing-lcp": 1800, "docs-lcp": 1000, cls: 0.02, inp: 150,
    "marketing-total-transfer-compressed": 450000, "marketing-js-compressed": 90000,
    "marketing-css-compressed": 25000, "marketing-fonts-compressed": 180000,
    "marketing-images-compressed": 200000, "docs-total-transfer-compressed": 306000,
    "docs-js-compressed": 140000, "docs-css-compressed": 50000,
    "docs-fonts-compressed": 180000, "docs-images-compressed": 120000,
    "search-index-en-compressed": 160000, "search-index-vi-compressed": 160000,
  });
});

test("capture rejects unsafe origins, path dates, and mismatched local dates", () => {
  assert.equal(validateOutputDate("2026-08-09"), "2026-08-09");
  for (const value of ["../2026-08-09", "2026-02-30", "20260809"]) assert.throws(() => validateOutputDate(value));
  assert.equal(validateBaseUrl("https://vcskill.vchun.dev").origin, "https://vcskill.vchun.dev");
  for (const value of ["http://vcskill.vchun.dev", "https://vcskill.vchun.dev/path", "https://token@vcskill.vchun.dev", "https://example.com"]) {
    assert.throws(() => validateBaseUrl(value));
  }
  assert.throws(() => validateBaseUrl("http://127.0.0.1:8787"));
  assert.equal(validateBaseUrl("http://127.0.0.1:8787", true).port, "8787");
  assert.deepEqual(contract.observation, {
    observedDateUtc: "2026-08-08",
    observedDateLocal: "2026-08-09",
    timeZone: "Asia/Ho_Chi_Minh",
  });
  assert.throws(() => parseArgs(["--output-date=2026-08-10"], new Date("2026-08-08T19:00:00.000Z")));
  const defaults = parseArgs(["--output-date=2026-08-09"], new Date("2026-08-08T19:00:00.000Z"));
  assert.equal(defaults.outputDate, "2026-08-09");
  assert.equal(defaults.requireBrowserEvidence, true);
  assert.equal(parseArgs(["--output-date=2026-08-09", "--allow-incomplete-browser-evidence"], new Date("2026-08-08T19:00:00.000Z")).requireBrowserEvidence, false);
});

test("method coverage separates safe live evidence from unsafe local-only probes", () => {
  assert.deepEqual(contract.globalBehavior.methodCoverage.productionSafeMethods, ["GET", "HEAD", "OPTIONS"]);
  const post = contract.scenarios.find((scenario) => scenario.id === "version-post");
  assert.equal(post.mode, "local-only");
  assert.match(post.productionEvidenceReason, /not a safe read-only production probe/);
  const options = contract.scenarios.find((scenario) => scenario.id === "version-options");
  assert.equal(options.mode, "local-and-production");
  assert.equal(options.request.method, "OPTIONS");
});

test("response normalization bounds bytes and never retains installer previews", async () => {
  await assert.rejects(
    normalizeResponse(new Response("12345"), { id: "bounded", method: "GET", path: "/version", preview: "text" }, { maxBytes: 4 }),
    /exceeds 4 bytes/,
  );
  const normalized = await normalizeResponse(
    new Response(shellInstaller, { headers: { "content-type": "text/x-shellscript; charset=utf-8" } }),
    { id: "install-root", method: "GET", path: "/install", preview: "omit" },
  );
  assert.equal(Object.hasOwn(normalized.snapshot.body, "preview"), false);
  assert.equal(normalized.snapshot.body.sha256, sha256(shellInstaller));
  assert.equal(normalized.snapshot.body.bodyStreamPresent, true);
  assert.equal(normalized.snapshot.body.bodyReadMode, "bounded-web-stream-reader");

  const crossOrigin = await normalizeResponse(
    new Response(null, { status: 302, headers: { location: "https://private.example.invalid/signed?token=secret" } }),
    { id: "redirect", method: "GET", path: "/version", preview: "omit" },
  );
  assert.match(crossOrigin.snapshot.headers.location, /^\[cross-origin-redacted sha256:[a-f0-9]{64}\]$/);
  assert.doesNotMatch(JSON.stringify(crossOrigin), /private\.example|token=secret/);
});

test("production snapshots cover every public scenario and the ingress discrepancy", () => {
  const snapshots = readJson(join(baselineDir, "routes.json"));
  const byId = new Map(snapshots.map((snapshot) => [snapshot.id, snapshot]));
  for (const scenario of contract.scenarios.filter((item) => item.mode !== "local-only")) {
    const snapshot = byId.get(scenario.id);
    assert.ok(snapshot, `production snapshot missing ${scenario.id}`);
    assert.equal(snapshot.status, scenario.expected.status, `${scenario.id} production status`);
    for (const [name, expected] of Object.entries(scenario.expected.headers || {})) {
      assert.equal(snapshot.headers[name], expected, `${scenario.id} production header ${name}`);
    }
    assert.equal(snapshot.body.class, scenario.expected.body.class, `${scenario.id} production body class`);
  }
  assert.equal(byId.get("malformed-download").status, contract.globalBehavior.malformedDownloadDecode.productionObservedStatus);
  for (const id of ["install-root", "install-alias", "install-ps1", "install-query"]) {
    assert.equal(Object.hasOwn(byId.get(id).body, "preview"), false, `${id} leaked executable preview`);
  }
});

test("released inventory contains attributable identities rather than counts alone", () => {
  const inventory = readJson(join(baselineDir, "inventory.json"));
  const site = siteData();
  assert.equal(inventory.release.versionRoute, site.release);
  assert.equal(inventory.inventory.skills.length, site.stats.skills);
  assert.equal(inventory.inventory.commands.length, site.commands.length);
  assert.deepEqual(inventory.inventory.workflows, contract.canonicalEvidence.workflows);
  assert.equal(inventory.inventory.providers.length, site.providers.length);
  assert.equal(inventory.release.checksums.length, site.proof.release.binaries);
  assert.deepEqual(inventory.proofFacts, JSON.parse(JSON.stringify(site.proof)));
});

test("generated evidence is browser-observed, complete, and bound by file bytes", () => {
  const manifest = readJson(join(baselineDir, "manifest.json"));
  assert.deepEqual(manifest.pendingArtifacts, []);
  assert.deepEqual(manifest.warnings, []);
  assert.equal(manifest.observedDateLocal, "2026-08-09");
  assert.equal(manifest.observedTimeZone, "Asia/Ho_Chi_Minh");
  assert.equal(manifest.observedDateUtc, contract.observation.observedDateUtc);
  assert.equal(manifest.observedDateLocal, contract.observation.observedDateLocal);
  for (const name of ["routes.json", "inventory.json", "findability.json", "performance-coverage.json"]) {
    const bytes = readFileSync(join(baselineDir, name));
    assert.equal(manifest.files[name].bytes, bytes.byteLength);
    assert.equal(manifest.files[name].sha256, sha256(bytes));
  }
  const paths = new Set(manifest.artifacts.map((artifact) => artifact.path));
  for (const viewport of viewportMatrix.viewports) {
    assert.ok(paths.has(`viewports/${viewport.id}.png`));
    assert.ok(paths.has(`viewports/${viewport.id}.json`));
    const evidence = readJson(join(baselineDir, `viewports/${viewport.id}.json`));
    const png = readFileSync(join(baselineDir, `viewports/${viewport.id}.png`));
    const pixelWidth = png.readUInt32BE(16);
    const pixelHeight = png.readUInt32BE(20);
    assert.equal(pixelWidth, viewport.width, `${viewport.id} screenshot width drifted`);
    assert.ok(pixelHeight > viewport.height, `${viewport.id} is not a full-page screenshot`);
    assert.deepEqual(evidence.screenshot, {
      source: "playwright",
      version: performanceMatrix.tools.playwright,
      channel: "chrome",
      fullPage: true,
      pixelWidth,
      pixelHeight,
    });
  }
  assert.ok(paths.has("lighthouse/mobile/lighthouse.report.json"));
  assert.ok(paths.has("lighthouse/desktop/lighthouse.report.json"));
  for (let run = 1; run <= 5; run += 1) assert.ok(paths.has(`lighthouse/performance-run-${run}.json`));
  for (const artifact of manifest.artifacts) {
    const bytes = readFileSync(join(baselineDir, artifact.path));
    assert.equal(artifact.bytes, bytes.byteLength, `${artifact.path} byte count drifted`);
    assert.equal(artifact.sha256, sha256(bytes), `${artifact.path} digest drifted`);
  }
  const coverage = readJson(join(baselineDir, "performance-coverage.json"));
  assert.deepEqual(coverage.qualification.runOrder, performanceMatrix.qualificationRunOrder);
  assert.equal(coverage.qualification.runOrder.length, 15);
  assert.deepEqual(coverage.legacyBaseline.runOrder, performanceMatrix.legacyBaselineRunOrder);
  assert.deepEqual(coverage.legacyBaseline.routes.map((route) => route.routeId), performanceMatrix.routes.map((route) => route.id));
  assert.deepEqual(coverage.legacyBaseline.interactions.map((interaction) => interaction.interactionId), performanceMatrix.interactions.map((interaction) => interaction.id));
  for (const route of coverage.legacyBaseline.routes) {
    if (route.status === "observed") assert.equal(route.artifacts.length, 5);
    else {
      assert.equal(route.status, "observed-not-available");
      assert.ok(route.reason);
      assert.equal(route.observedHttpStatus, 404);
    }
  }
  for (const interaction of coverage.legacyBaseline.interactions) {
    if (interaction.status === "observed-pass") assert.equal(interaction.artifacts.length, 5);
    else assert.ok(interaction.reason);
  }
  const runs = Array.from({ length: 5 }, (_, index) => readJson(join(baselineDir, `lighthouse/performance-run-${index + 1}.json`)));
  assert.deepEqual(runs.map((run) => `${run.routeId}#${run.run}`), performanceMatrix.legacyBaselineRunOrder);
  for (const run of runs) {
    assert.equal(run.valid, true);
    assert.equal(run.profile.network, performanceMatrix.profile.network);
    assert.equal(run.profile.cpuSlowdownMultiplier, performanceMatrix.profile.cpuSlowdownMultiplier);
    assert.deepEqual(run.profile.viewport, performanceMatrix.profile.viewport);
    assert.equal(run.profile.browserCache, performanceMatrix.profile.browserCache);
    assert.equal(run.profile.runnerRegion, performanceMatrix.runner.region);
    assert.equal(run.interactions.installCtaNavigation, "pass");
    assert.equal(run.interactions.marketingGraphKeyboardTraversal, "pass");
  }
  const summary = readJson(join(baselineDir, "lighthouse/performance-summary.json"));
  assert.equal(summary.profile.browserCache, performanceMatrix.profile.browserCache);
  assert.equal(summary.profile.cdnCache, performanceMatrix.profile.cdnCache);
  const median = (values) => [...values].sort((left, right) => left - right)[Math.floor(values.length / 2)];
  for (const [summaryKey, readValue] of [
    ["lcpMs", (run) => run.metrics.lcpMs],
    ["cls", (run) => run.metrics.cls],
    ["inpMs", (run) => run.metrics.inpMs],
    ["totalTransferBytes", (run) => run.transfer.totalBytes],
  ]) {
    const values = runs.map(readValue);
    assert.equal(summary.aggregation[summaryKey].median, median(values));
    assert.equal(summary.aggregation[summaryKey].maximum, Math.max(...values));
  }
  for (const device of ["mobile", "desktop"]) {
    const report = readJson(join(baselineDir, `lighthouse/${device}/lighthouse.report.json`));
    assert.equal(report.lighthouseVersion, performanceMatrix.tools.lighthouse);
    for (const category of ["accessibility", "best-practices", "seo", "agentic-browsing"]) {
      assert.equal(report.categories[category].score, 1, `${device} ${category} score drifted`);
    }
  }
  const findability = readJson(join(baselineDir, "findability.json"));
  assert.equal(findability.tasks.length, 15);
  for (const task of findability.tasks) {
    assert.match(task.observedStatus, /^observed-(pass|fail)$/);
    assert.ok(task.evidence.artifact, `${task.id} lacks browser artifact`);
  }
});

test("capture source preserves browser directories and avoids unbounded buffering", () => {
  const source = readFileSync(join(repoRoot, "scripts/capture-production-baseline.mjs"), "utf8");
  assert.doesNotMatch(source, /\brm\s*\(/);
  assert.doesNotMatch(source, /arrayBuffer\s*\(/);
});
