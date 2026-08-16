// Shared operational contract gate for the deployment control plane.
//
// Everything here runs against fixtures and mocks; no test touches Cloudflare,
// GitHub, or a real deployment. The point is that the rules the operators rely
// on are enforced by code rather than by discipline.

import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  configPathFor,
  loadTopology,
  resolveUnits,
  validateDeploymentInput,
  workerNameFor,
} from "../../scripts/deploy/validate-deployment-input.mjs";
import { deployUnits, smokeRoute } from "../../scripts/deploy/deploy-units.mjs";
import { rollbackOrder, rollbackUnits, validateRollbackPlan } from "../../scripts/deploy/rollback-units.mjs";
import { findSecrets, validateCutoverRecord, writeCutoverRecord } from "../../scripts/deploy/write-cutover-record.mjs";
import { verifyConvergence } from "../../scripts/deploy/verify-convergence.mjs";
import { REQUIRED_WINDOW_HOURS, verifySoak } from "../../scripts/deploy/verify-soak.mjs";
import { assessEnvironment, redact, verifyProductionEnvironment } from "../../scripts/deploy/verify-production-environment.mjs";

const PRODUCT_SHA = "1".repeat(40);
const EVIDENCE_SHA = "2".repeat(40);
const CORE_SHA = "3".repeat(40);
const digest = (seed) => `sha256:${seed.repeat(64).slice(0, 64)}`;

function baseInput(overrides = {}) {
  return {
    schemaVersion: 1,
    environment: "staging",
    topology: "candidate-b",
    productSha: PRODUCT_SHA,
    qualificationEvidenceSha: EVIDENCE_SHA,
    release: { tag: "ariadnev@0.12.0", version: "0.12.0", coreSha: CORE_SHA },
    digests: { docsBundle: digest("a"), docsManifest: digest("b"), docsSchema: digest("c"), checksums: digest("d") },
    units: ["docs", "edge"],
    ingressPolicyDigest: digest("e"),
    ...overrides,
  };
}

// ---------------------------------------------------------------- input gate

test("a fully pinned deployment input is accepted", () => {
  assert.equal(validateDeploymentInput(baseInput()).valid, true);
});

test("moving, partial, and drifted inputs are rejected", () => {
  const cases = [
    ["branch instead of a SHA", { productSha: "main" }],
    ["short SHA", { productSha: "1".repeat(7) }],
    ["evidence SHA equal to the product SHA", { qualificationEvidenceSha: PRODUCT_SHA }],
    ["tag alias instead of an exact release tag", { release: { tag: "latest", version: "0.12.0", coreSha: CORE_SHA } }],
    ["topology drift", { topology: "candidate-a" }],
    ["empty unit set", { units: [] }],
    ["undeclared unit", { units: ["docs", "marketing"] }],
    ["duplicate units", { units: ["docs", "docs"] }],
    ["missing digest map", { digests: { docsBundle: digest("a") } }],
    ["missing ingress digest", { ingressPolicyDigest: undefined }],
  ];
  for (const [label, overrides] of cases) {
    const input = baseInput(overrides);
    if (overrides.ingressPolicyDigest === undefined && "ingressPolicyDigest" in overrides) delete input.ingressPolicyDigest;
    assert.equal(validateDeploymentInput(input).valid, false, `${label} must be rejected`);
  }
});

test("units resolve in the topology's declared order regardless of input order", () => {
  const topology = loadTopology();
  const resolved = resolveUnits(baseInput({ units: ["edge", "docs"] }), topology);
  assert.deepEqual(resolved.map((unit) => unit.id), ["docs", "edge"]);
});

test("config path and worker name are environment-specific and never synthesized", () => {
  const topology = loadTopology();
  const edge = topology.units.find((unit) => unit.id === "edge");
  assert.equal(configPathFor(edge, "staging"), "workers/edge/wrangler.combined.toml");
  assert.equal(configPathFor(edge, "production"), "workers/edge/wrangler.combined.production.toml");
  assert.notEqual(workerNameFor(edge, "staging"), workerNameFor(edge, "production"));
});

test("candidate B production uses a worker identity separate from the retained legacy worker", () => {
  const topology = loadTopology();
  const legacy = topology.environments.production.legacyWorker;
  const productionNames = topology.units.map((unit) => workerNameFor(unit, "production"));
  assert.ok(!productionNames.includes(legacy.name), "a unit must never deploy over the legacy rollback target");
  assert.equal(legacy.credentialMutationFrozenUntil, "rollback-window-close");
});

// ------------------------------------------------------------------- deploy

test("deploy halts before a later unit when an earlier unit fails", async () => {
  const attempted = [];
  const runner = (_command, args) => {
    attempted.push(args.at(-1));
    return { status: 1, stdout: "", stderr: "boom" };
  };
  await assert.rejects(
    () => deployUnits(baseInput(), { dryRun: true, runner }),
    /failed to deploy; halting/,
  );
  assert.equal(attempted.length, 1, "the second unit must never be attempted");
});

test("a machine route answering with HTML 200 fails its smoke check", async () => {
  const html = async () => new Response("<!doctype html><p>site</p>", { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });
  const shadowed = await smokeRoute("https://example.test", "/version", "edge@v1", html);
  assert.equal(shadowed.pass, false);

  const plain = async () => new Response("0.12.0", { status: 200, headers: { "content-type": "text/plain", "cache-control": "no-store" } });
  const healthy = await smokeRoute("https://example.test", "/version", "edge@v1", plain);
  assert.equal(healthy.pass, true);
  assert.equal(healthy.deploymentLabel, "edge@v1");
});

test("a document route accepts HTML 200 but a machine route never does", async () => {
  const html = async () => new Response("<!doctype html><p>docs</p>", { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });
  assert.equal((await smokeRoute("https://docs.example.test", "/en/stable/", "docs@v1", html, "document")).pass, true);
  assert.equal((await smokeRoute("https://docs.example.test", "/en/stable/", "docs@v1", html, "machine")).pass, false);
  const missing = async () => new Response("nope", { status: 404, headers: { "content-type": "text/html" } });
  assert.equal((await smokeRoute("https://docs.example.test", "/llms.txt", "docs@v1", missing, "document")).pass, false);
});

test("a smoke probe retries transport failures and 5xx within its bound, but never a 4xx", async () => {
  const noWait = { attempts: 4, delayMs: 0, sleep: async () => {} };
  let calls = 0;
  const comesUp = async () => {
    calls += 1;
    if (calls === 1) throw new TypeError("fetch failed");
    if (calls === 2) return new Response("origin error", { status: 522, headers: { "content-type": "text/plain" } });
    return new Response("1.0.0", { status: 200, headers: { "content-type": "text/plain" } });
  };
  const healthy = await smokeRoute("https://example.test", "/version", "edge@v1", comesUp, "machine", noWait);
  assert.equal(healthy.pass, true);
  assert.equal(calls, 3);

  let notFoundCalls = 0;
  const missing = async () => { notFoundCalls += 1; return new Response("nope", { status: 404, headers: { "content-type": "text/plain" } }); };
  assert.equal((await smokeRoute("https://example.test", "/version", "edge@v1", missing, "machine", noWait)).pass, false);
  assert.equal(notFoundCalls, 1, "a 4xx is a verdict, not a transient");

  const neverUp = async () => { throw new TypeError("fetch failed"); };
  await assert.rejects(() => smokeRoute("https://example.test", "/version", "edge@v1", neverUp, "machine", noWait), /fetch failed/);
});

test("each unit is smoked on the host and response class its topology entry declares", async () => {
  // A live (non-dry-run) deploy against a fake wrangler and a fake network:
  // the docs unit must be probed on docsBaseUrl and accept HTML, the edge
  // unit on baseUrl and reject HTML.
  const topology = loadTopology();
  const hosts = topology.environments.staging;
  const probed = [];
  const fetchImpl = async (url) => {
    probed.push(url);
    if (url.startsWith(hosts.docsBaseUrl)) return new Response("<!doctype html>", { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });
    return new Response("1.0.0", { status: 200, headers: { "content-type": "text/plain" } });
  };
  const runner = () => ({ status: 0, stdout: "Current Version ID: 00000000-0000-4000-8000-000000000000", stderr: "" });
  const result = await deployUnits(baseInput(), { runner, fetchImpl, requireOutputs: false });
  assert.equal(result.observations.every((observation) => observation.pass), true);
  const docs = topology.units.find((unit) => unit.id === "docs");
  const edge = topology.units.find((unit) => unit.id === "edge");
  for (const route of docs.smokeRoutes) assert.ok(probed.includes(`${hosts.docsBaseUrl}${route}`), `docs ${route} must be probed on docsBaseUrl`);
  for (const route of edge.smokeRoutes) assert.ok(probed.includes(`${hosts.baseUrl}${route}`), `edge ${route} must be probed on baseUrl`);
  assert.ok(!probed.some((url) => url.startsWith(`${hosts.baseUrl}/en/`)), "docs pages must not be probed on the marketing host");
});

test("a unit whose smoke base is not declared for the environment halts the deploy", async () => {
  const runner = () => ({ status: 0, stdout: "Current Version ID: 00000000-0000-4000-8000-000000000000", stderr: "" });
  const original = loadTopology();
  // Simulate an operator typo in topology.json without touching the file: the
  // guard reads the unit's `smoke.base` against the environment's host map.
  const unit = { ...original.units[0], smoke: { base: "nowhere", expects: "document" } };
  const patched = { ...original, units: [unit, original.units[1]] };
  await assert.rejects(
    () => deployUnits(baseInput({ units: ["docs"] }), { runner, fetchImpl: async () => new Response("ok"), topology: patched, requireOutputs: false }),
    /smoke base nowhere is not declared/,
  );
});

test("the deploy job ships the artifact the build job qualified", () => {
  const deploy = workflow("deploy.yml");
  const deployJob = deploy.slice(deploy.indexOf("  deploy:"));
  assert.match(deployJob, /actions\/download-artifact@[0-9a-f]{40}/, "the deploy job must download the qualified artifact by pinned SHA");
  assert.match(deployJob, /name: web-product-\$\{\{ needs\.preflight\.outputs\.product_sha \}\}/);
  assert.match(deployJob, /test -f apps\/site\/dist\/index\.html && test -f apps\/docs\/out\/index\.html/);
  assert.doesNotMatch(deployJob, /pnpm run build|pnpm run test:qualification/, "the deploy job must not rebuild");
});

test("the deploy job reads the input as of the trigger commit and proves it names the checkout", () => {
  // The input is committed after the product it names, so the productSha
  // checkout holds an older copy; deploying from that copy would record the
  // wrong product. The trigger-time file travels as an artifact instead.
  const deploy = workflow("deploy.yml");
  const preflight = deploy.slice(deploy.indexOf("  preflight:"), deploy.indexOf("  environment-policy:"));
  assert.match(preflight, /upload-artifact@[0-9a-f]{40}[\s\S]*name: deployment-input-\$\{\{ github\.run_id \}\}[\s\S]*path: \$\{\{ inputs\.input_path \}\}/);
  const deployJob = deploy.slice(deploy.indexOf("  deploy:"));
  assert.match(deployJob, /download-artifact@[0-9a-f]{40}[\s\S]*name: deployment-input-\$\{\{ github\.run_id \}\}/);
  assert.match(deployJob, /test "\$\(node -p "require\('\.\/\$INPUT'\)\.productSha"\)" = "\$\(git rev-parse HEAD\)"/);
  for (const script of ["deploy-units.mjs", "verify-convergence.mjs", "compose-cutover-record.mjs"]) {
    assert.match(deployJob, new RegExp(`${script.replace(".", "\\.")} "\\$INPUT_PATH"`), `${script} must read the trigger-time input`);
  }
  assert.doesNotMatch(deployJob.slice(deployJob.indexOf("Reconcile the source-owned")), /inputs\.input_path/, "no deploy step after the swap may read the checkout's input");
});

// ----------------------------------------------------------------- rollback

test("a rollback plan requires an explicit worker version for every unit", () => {
  const missing = { schemaVersion: 1, environment: "production", reason: "smoke failure", units: [{ id: "edge" }] };
  assert.equal(validateRollbackPlan(missing).valid, false);

  const explicit = {
    schemaVersion: 1,
    environment: "production",
    reason: "smoke failure",
    units: [{ id: "edge", targetWorkerVersionId: "0e2c9a6f-1111-4222-8333-444455556666" }],
  };
  assert.equal(validateRollbackPlan(explicit).valid, true);
});

test("first-cutover rollback demands the captured binding map and docs hostname removal", () => {
  const base = {
    schemaVersion: 1,
    environment: "production",
    reason: "cutover aborted",
    firstCutover: true,
    units: [{ id: "edge", targetWorkerVersionId: "0e2c9a6f-1111-4222-8333-444455556666" }],
  };
  assert.equal(validateRollbackPlan(base).valid, false, "a bare version rollback is not a first-cutover restore");

  const complete = { ...base, legacyBindingMap: { "vcskill.vchun.dev": "vcskill" }, removeDocsHostname: true };
  assert.equal(validateRollbackPlan(complete).valid, true);
});

test("a rollback that would mutate the retained legacy credential is rejected", () => {
  const plan = {
    schemaVersion: 1,
    environment: "production",
    reason: "recover",
    mutateLegacyCredential: true,
    units: [{ id: "edge", targetWorkerVersionId: "0e2c9a6f-1111-4222-8333-444455556666" }],
  };
  const { valid, errors } = validateRollbackPlan(plan);
  assert.equal(valid, false);
  assert.match(errors.join(" "), /never mutate the retained legacy credential/);
});

test("rollback runs units in the reverse of the deploy order", () => {
  const plan = {
    units: [
      { id: "docs", targetWorkerVersionId: "aaaaaaaa-1111-4222-8333-444455556666" },
      { id: "edge", targetWorkerVersionId: "bbbbbbbb-1111-4222-8333-444455556666" },
    ],
  };
  assert.deepEqual(rollbackOrder(plan).map((entry) => entry.id), ["edge", "docs"]);
});

test("a version rollback never reports itself as a legacy binding restoration", () => {
  const result = rollbackUnits(
    {
      schemaVersion: 1,
      environment: "production",
      reason: "regression",
      units: [{ id: "edge", targetWorkerVersionId: "bbbbbbbb-1111-4222-8333-444455556666" }],
    },
    { dryRun: true },
  );
  assert.equal(result.restoredLegacyBinding, false);
  assert.equal(result.removedDocsHostname, false);
  assert.equal(result.legacyCredentialMutated, false);
});

// ------------------------------------------------------------ cutover record

function baseRecord(overrides = {}) {
  return {
    schemaVersion: 1,
    recordId: "cutover-0001",
    environment: "production",
    phase: "deploy",
    input: { productSha: PRODUCT_SHA, qualificationEvidenceSha: EVIDENCE_SHA, topology: "candidate-b", units: ["docs", "edge"] },
    startedAtUtc: "2026-08-10T00:00:00Z",
    observations: [
      { unit: "edge", route: "/version", status: 200, contentClass: "text/plain", deploymentLabel: "edge@v3", pass: true },
    ],
    ...overrides,
  };
}

test("a well-formed record validates and writes", () => {
  const dir = mkdtempSync(join(tmpdir(), "cutover-"));
  try {
    const out = join(dir, "record.json");
    writeCutoverRecord(baseRecord(), out);
    assert.equal(JSON.parse(readFileSync(out, "utf8")).recordId, "cutover-0001");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("secrets, tokens, and account identifiers are refused", () => {
  assert.ok(findSecrets({ note: "ghp_abcdefghijklmnopqrstuvwxyz" }).length > 0);
  assert.ok(findSecrets({ note: "Bearer abcdefghijklmnopqrstuvwx" }).length > 0);
  assert.ok(findSecrets({ accountId: "0123456789abcdef0123456789abcdef" }).length > 0);
  assert.ok(findSecrets({ url: "https://x.test/a?X-Amz-Signature=deadbeef" }).length > 0);
  assert.equal(findSecrets({ workerVersionId: "0e2c9a6f-1111-4222-8333-444455556666" }).length, 0);
});

test("an observation with no deployment label is not evidence", () => {
  const record = baseRecord({ observations: [{ unit: "edge", route: "/version", status: 200, deploymentLabel: "" }] });
  assert.equal(validateCutoverRecord(record).valid, false);
});

test("lifecycle transitions only move forward and a rollback is terminal", () => {
  const preflight = baseRecord({ phase: "preflight" });
  assert.equal(validateCutoverRecord(baseRecord({ phase: "deploy" }), preflight).valid, true);
  assert.equal(validateCutoverRecord(preflight, baseRecord({ phase: "deploy" })).valid, false);
  assert.equal(
    validateCutoverRecord(baseRecord({ phase: "deploy" }), baseRecord({ phase: "rollback", rollback: { reason: "x", restoredLegacyBinding: true, removedDocsHostname: true } })).valid,
    false,
  );
});

test("evidence may accumulate but may never change the deployed product", () => {
  const previous = baseRecord({ phase: "preflight" });
  const drifted = baseRecord({ phase: "deploy", input: { ...previous.input, productSha: "9".repeat(40) } });
  const { valid, errors } = validateCutoverRecord(drifted, previous);
  assert.equal(valid, false);
  assert.match(errors.join(" "), /productSha changed/);
});

// --------------------------------------------------------------- convergence

test("convergence passes only when the live release matches the declared input", async () => {
  const responder = (version) => async (url) => {
    if (String(url).includes("/version")) return new Response(version, { status: 200 });
    return new Response("{}", { status: 200 });
  };
  const converged = await verifyConvergence(baseInput({ units: ["edge"] }), {
    baseUrl: "https://staging.test",
    fetchImpl: responder("0.12.0"),
  });
  assert.equal(converged.converged, true);

  const drifted = await verifyConvergence(baseInput({ units: ["edge"] }), {
    baseUrl: "https://staging.test",
    fetchImpl: responder("0.11.0"),
  });
  assert.equal(drifted.converged, false);
});

test("a redirecting baseUrl fails convergence instead of validating the redirect target", async () => {
  // Since the legacy host 302s to ariadnev.com, a redirect-following probe would
  // report the interim bridge's answer as proof that the unit deployed at
  // baseUrl converged. The pinned-selector check is the sharper hazard: the
  // bridge ignores ?version= entirely, so a followed probe becomes a tautology
  // that passes whenever latest happens to equal the expected version.
  const redirectingHost = async (url, init) => {
    assert.equal(init.redirect, "manual", `${url} must not follow redirects`);
    return new Response(null, { status: 302, headers: { location: "https://ariadnev.com/version" } });
  };

  const result = await verifyConvergence(baseInput({ units: ["edge"] }), {
    baseUrl: "https://vcskill.vchun.dev",
    fetchImpl: redirectingHost,
  });

  assert.equal(result.converged, false);
  for (const check of result.checks) {
    assert.equal(check.pass, false, `${check.check} must not pass through a redirect`);
    assert.match(check.reason, /redirects to https:\/\/ariadnev\.com/);
  }
});

// ---------------------------------------------------------------------- soak

test("a soak is measured from the most recent reset, not the first start", () => {
  const now = new Date("2026-08-11T00:00:00Z");
  const reset = verifySoak(
    baseRecord({ phase: "soak", soak: { windowHours: 24, startedAtUtc: "2026-08-01T00:00:00Z", lastResetAtUtc: "2026-08-10T20:00:00Z", resetTriggers: ["deploy"] } }),
    now,
  );
  assert.equal(reset.satisfied, false, "a redeploy restarts the window");
  assert.ok(reset.elapsedHours < REQUIRED_WINDOW_HOURS);

  const complete = verifySoak(
    baseRecord({ phase: "soak", soak: { windowHours: 24, startedAtUtc: "2026-08-09T00:00:00Z", resetTriggers: [] } }),
    now,
  );
  assert.equal(complete.satisfied, true);
});

test("a failed observation inside the window defeats the soak", () => {
  const record = baseRecord({
    phase: "soak",
    soak: { windowHours: 24, startedAtUtc: "2026-08-01T00:00:00Z", resetTriggers: [] },
    observations: [{ unit: "edge", route: "/version", status: 502, deploymentLabel: "edge@v3", pass: false }],
  });
  assert.equal(verifySoak(record, new Date("2026-08-11T00:00:00Z")).satisfied, false);
});

// ----------------------------------------------- production environment gate

test("a weak or absent environment is rejected", () => {
  assert.deepEqual(assessEnvironment(null, "web-production"), ["web-production environment is absent"]);

  const bypassable = {
    protection_rules: [{ type: "required_reviewers", reviewers: [{ type: "User" }], prevent_self_review: false }],
    can_admins_bypass: true,
    deployment_branch_policy: { protected_branches: true },
  };
  const findings = assessEnvironment(bypassable, "web-production");
  assert.match(findings.join(" "), /bypass required review/);
  assert.match(findings.join(" "), /self-review/);

  const strong = {
    protection_rules: [{ type: "required_reviewers", reviewers: [{ type: "User" }], prevent_self_review: true }],
    can_admins_bypass: false,
    deployment_branch_policy: { protected_branches: true },
  };
  assert.deepEqual(assessEnvironment(strong, "web-production"), []);
});

test("the environment preflight fails closed on a missing immutable-release policy", async () => {
  const strong = {
    protection_rules: [{ type: "required_reviewers", reviewers: [{ type: "User" }], prevent_self_review: true }],
    can_admins_bypass: false,
    deployment_branch_policy: { protected_branches: true },
  };
  const fetchImpl = async (url) => {
    const path = String(url);
    if (path.includes("/environments/")) return Response.json(strong);
    if (path.includes("/contents/")) return Response.json({ content: Buffer.from("name: finalize\n").toString("base64") });
    return Response.json({ immutable_releases: false });
  };
  const strictPolicy = {
    schemaVersion: 1,
    web: { repo: "o/web", environment: "web-production", humanGate: "required-reviewers", requiredReviewers: "required" },
    core: { repo: "o/core", environment: "core-release-production", finalizerWorkflow: ".github/workflows/finalize-release.yml", immutableReleases: "required" },
  };
  const result = await verifyProductionEnvironment({ token: "t", fetchImpl, policy: strictPolicy });
  assert.equal(result.ready, false);
  assert.match(result.findings.join(" "), /immutable releases/);
});

test("the committed production policy accepts the workflow-dispatch gate only with an exact branch policy", async () => {
  // Required reviewers are unavailable for a private repository on the current
  // plan; the committed policy declares the compensating control (manual
  // dispatch + deployments only from main) and names its decision record.
  const policy = JSON.parse(readFileSync(join(process.cwd(), "deployment/production-policy.json"), "utf8"));
  assert.equal(policy.web.requiredReviewers, "unavailable-on-plan");
  assert.deepEqual(policy.web.deploymentBranches, ["main"]);
  assert.match(readFileSync(join(process.cwd(), policy.decisionRecord), "utf8"), /workflow_dispatch/);

  const environment = { protection_rules: [{ type: "branch_policy" }], can_admins_bypass: true, deployment_branch_policy: { protected_branches: false, custom_branch_policies: true } };
  const client = (branches) => async (url) => {
    const path = String(url);
    if (path.endsWith("/deployment-branch-policies")) return Response.json({ branch_policies: branches.map((name) => ({ name, type: "branch" })) });
    if (path.includes("/environments/")) return Response.json(environment);
    if (path.includes("/contents/")) return Response.json({ content: Buffer.from("name: finalize\n").toString("base64") });
    return Response.json({ immutable_releases: null });
  };
  const ready = await verifyProductionEnvironment({ token: "t", coreToken: "c", fetchImpl: client(["main"]), policy });
  assert.deepEqual(ready.findings, []);
  assert.equal(ready.humanGate, "workflow-dispatch");

  const widened = await verifyProductionEnvironment({ token: "t", coreToken: "c", fetchImpl: client(["main", "dev"]), policy });
  assert.match(widened.findings.join(" "), /deployment branches/);

  const unrestricted = await verifyProductionEnvironment({ token: "t", coreToken: "c", fetchImpl: async (url) => String(url).includes("/environments/") ? Response.json({ ...environment, deployment_branch_policy: null }) : client([])(url), policy });
  assert.match(unrestricted.findings.join(" "), /any branch/);

  // The strict gate is unchanged: without the compensating declaration, no reviewers is a finding.
  assert.match(assessEnvironment(environment, "web-production").join(" "), /no required reviewers/);
});

test("the deploy workflow is human-triggered only and its policy job reads two scoped credentials", () => {
  const deploy = workflow("deploy.yml");
  assert.match(deploy, /^on:\n  workflow_dispatch:/m);
  assert.doesNotMatch(deploy, /^\s+(push|pull_request|schedule):/m);
  const policyJob = deploy.slice(deploy.indexOf("  environment-policy:"), deploy.indexOf("  build:"));
  assert.match(policyJob, /GITHUB_TOKEN: \$\{\{ github\.token \}\}/);
  assert.match(policyJob, /CORE_POLICY_READ_TOKEN: \$\{\{ secrets\.CORE_POLICY_READ_TOKEN \}\}/);
});

test("an unexpected finalizer workflow digest blocks the cutover", async () => {
  const strong = {
    protection_rules: [{ type: "required_reviewers", reviewers: [{ type: "User" }], prevent_self_review: true }],
    can_admins_bypass: false,
    deployment_branch_policy: { protected_branches: true },
  };
  const fetchImpl = async (url) => {
    const path = String(url);
    if (path.includes("/environments/")) return Response.json(strong);
    if (path.includes("/contents/")) return Response.json({ content: Buffer.from("name: tampered\n").toString("base64") });
    return Response.json({ immutable_releases: true });
  };
  const result = await verifyProductionEnvironment({ token: "t", fetchImpl, expectedFinalizerDigest: `sha256:${"0".repeat(64)}` });
  assert.equal(result.ready, false);
  assert.match(result.findings.join(" "), /does not match the expected/);
});

test("a missing token fails closed and errors stay redacted", async () => {
  await assert.rejects(() => verifyProductionEnvironment({ fetchImpl: async () => Response.json({}) }), /GITHUB_TOKEN is not set/);
  assert.equal(redact("failed with Bearer ghp_abcdefghijklmnopqrst"), "failed with Bearer [redacted]");
});

// ------------------------------------------------------- workflow permissions

const workflow = (name) => readFileSync(join(import.meta.dirname, "..", "..", ".github", "workflows", name), "utf8");
const usesRefs = (yaml) => [...yaml.matchAll(/^\s*-?\s*uses:\s*(\S+)\s*$/gm)].map((match) => match[1]);

test("every workflow action is pinned to a full commit SHA", () => {
  for (const name of ["deploy.yml", "rollback.yml"]) {
    for (const ref of usesRefs(workflow(name))) {
      assert.match(ref, /@[0-9a-f]{40}$/, `${name} uses an unpinned action: ${ref}`);
    }
  }
});

test("no workflow inherits write permission, and checkout never persists credentials", () => {
  for (const name of ["deploy.yml", "rollback.yml"]) {
    const yaml = workflow(name);
    assert.match(yaml, /^permissions: \{\}$/m, `${name} must declare an empty top-level permission map`);
    const checkouts = (yaml.match(/actions\/checkout@/g) ?? []).length;
    const disabled = (yaml.match(/persist-credentials: false/g) ?? []).length;
    assert.equal(disabled, checkouts, `${name} must disable persisted credentials on every checkout`);
  }
});

test("no job grants itself contents write", () => {
  for (const name of ["deploy.yml", "rollback.yml"]) {
    assert.doesNotMatch(workflow(name), /contents:\s*write/, `${name} must not grant contents write`);
  }
});

test("the consolidated core credential never reaches a build or deploy job", () => {
  // The single-repository Contents-read/Actions-write PAT is admissible only in
  // edge release reads, artifact retrieval, and protected dispatch. A web build
  // or Cloudflare deploy job that could see it would exceed Phase 2's model.
  const deploy = workflow("deploy.yml");
  const buildJob = deploy.slice(deploy.indexOf("  build:"), deploy.indexOf("  deploy:"));
  const deployJob = deploy.slice(deploy.indexOf("  deploy:"));
  for (const [label, body] of [["build", buildJob], ["deploy", deployJob]]) {
    assert.doesNotMatch(body, /CORE_POLICY_READ_TOKEN|CONSOLIDATED_PAT|GH_RELEASE_TOKEN/, `${label} job must not receive a core credential`);
  }
});

test("the deploy workflow builds only the immutable product commit", () => {
  const deploy = workflow("deploy.yml");
  assert.match(deploy, /ref: \$\{\{ needs\.preflight\.outputs\.product_sha \}\}/);
  // A branch or tag checkout would let the deployed bytes drift from the input.
  assert.doesNotMatch(deploy, /ref:\s*(main|refs\/heads|\$\{\{ github\.ref)/);
});

test("deployments are serialized per environment and never cancelled midway", () => {
  for (const name of ["deploy.yml", "rollback.yml"]) {
    const yaml = workflow(name);
    assert.match(yaml, /group: deploy-\$\{\{ inputs\.environment \}\}/);
    assert.match(yaml, /cancel-in-progress: false/);
  }
});

test("production deployment is gated on a protected GitHub environment", () => {
  assert.match(workflow("deploy.yml"), /environment: \$\{\{ inputs\.environment == 'production' && 'web-production'/);
});

// ------------------------------------------------------------- cutover record composition

test("the deploy-phase record is composed from the control plane's own outputs and validates", async () => {
  const { composeCutoverRecord, recordIdFor } = await import("../../scripts/deploy/compose-cutover-record.mjs");
  const input = baseInput();
  const deployResult = {
    environment: "staging",
    topology: "candidate-b",
    deployments: [
      { unit: "docs", workerName: "ariadnev-docs-staging", ok: true, workerVersionId: "11111111-1111-4111-8111-111111111111" },
      { unit: "edge", workerName: "ariadnev-edge-staging", ok: true, workerVersionId: "22222222-2222-4222-8222-222222222222" },
    ],
    observations: [
      { unit: "docs", route: "/en/stable/", status: 200, contentClass: "html", cacheControl: "public, max-age=0, must-revalidate", bodyBytes: 1234, deploymentLabel: "docs@1111", pass: true },
      { unit: "edge", route: "/version", status: 200, contentClass: "text/plain", cacheControl: "no-store", bodyBytes: 5, deploymentLabel: "edge@2222", pass: true },
    ],
  };
  const record = composeCutoverRecord({ input, deployResult, convergence: { converged: true }, startedAtUtc: "2026-08-16T09:00:00Z", completedAtUtc: "2026-08-16T09:05:00Z" });
  assert.equal(record.result, "pass");
  assert.equal(record.recordId, recordIdFor(input));
  assert.match(record.recordId, /^[a-z0-9][a-z0-9-]{7,63}$/);
  assert.equal(validateCutoverRecord(record).valid, true, validateCutoverRecord(record).errors?.join("; "));
  // Runtime-only detail never reaches the record; the version id is attached from the deployment.
  assert.equal("bodyBytes" in record.observations[0], false);
  assert.equal(record.observations[1].workerVersionId, "22222222-2222-4222-8222-222222222222");
  // A failed convergence or observation marks the record fail, never silently pass.
  assert.equal(composeCutoverRecord({ input, deployResult, convergence: { converged: false }, startedAtUtc: "2026-08-16T09:00:00Z" }).result, "fail");
});

test("the deploy workflow composes the record from tee'd machine outputs under pipefail", () => {
  const deploy = workflow("deploy.yml");
  assert.match(deploy, /set -o pipefail\n\s+date -u[^\n]*deploy-started-at\.txt\n\s+node scripts\/deploy\/deploy-units\.mjs "\$INPUT_PATH" \| tee deploy-result\.json/);
  assert.match(deploy, /compose-cutover-record\.mjs "\$INPUT_PATH"[\s\S]*--deploy-result deploy-result\.json --convergence convergence\.json/);
  assert.doesNotMatch(deploy, /\.record\.json/, "no step may expect a hand-written record file");
});
