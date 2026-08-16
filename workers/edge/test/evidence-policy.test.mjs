import { mkdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

import { writeDecisionArtifacts } from "../../../scripts/edge-evidence-artifacts.mjs";
import { ingressPolicyDigest, loadIngressPolicy } from "../../../scripts/edge-ingress-policy.mjs";
import { CELL_DEPLOYMENT_REFS, REQUIRED_CELL_IDS, REQUIRED_CELLS, REQUIRED_REPETITIONS, sanitizeObservedCell, sanitizeText, validateStagingStateRecord } from "../../../scripts/edge-evidence-policy.mjs";
import { buildDeterministicLocalMatrix } from "../../../scripts/verify-edge-routing-spike.mjs";
import { assert, repoRoot } from "./edge-test-helpers.mjs";

const tempDir = join(repoRoot, ".tmp-edge-tests");
const versionId = "a1b2c3d4e5f60708";
const rollbackVersionId = "0102030405060708";
const ingressDigest = ingressPolicyDigest(await loadIngressPolicy(), "staging");

const deploymentFixtures = {
  "candidate-a-edge-first": ["1111111111111111", "edge", "candidate-a-gate", false, "candidate-a-edge-first-bindings", "release-read-present", "staging"],
  "candidate-a-failed": ["2222222222222222", "edge", "candidate-a-route-failure", false, "candidate-a-failed-bindings", "release-read-present", "staging"],
  "candidate-a-site-first": ["1212121212121212", "edge", "candidate-a-gate", false, "candidate-a-site-first-bindings", "release-read-present", "staging"],
  "candidate-b-before-rehearsal": ["3333333333333333", "combined", "selected-prior", true, "candidate-b-bindings", "consolidated-present", "staging"],
  "candidate-b-before-hardening": ["3434343434343434", "combined", "selected-prior-hardening", true, "candidate-b-bindings", "consolidated-present", "staging"],
  "candidate-b-final": [versionId, "combined", "selected-final", true, "candidate-b-bindings", "consolidated-present", "staging"],
  "staging-site-binding": ["4444444444444444", "site", "binding-rehearsal", true, "site-bindings", "not-applicable", "staging"],
  "missing-binding-control": ["5555555555555555", "combined", "controlled-missing-binding", false, "candidate-b-bindings", "required-binding-suppressed", "staging"],
  "upstream-failure-control": ["6666666666666666", "combined", "controlled-upstream-failure", false, "candidate-b-bindings", "controlled-invalid-upstream", "staging"],
  "legacy-new-credential-probe": ["7777777777777777", "legacy", "legacy-credential-compatibility", false, "legacy-shaped-bindings", "consolidated-present", "staging"],
  "production-legacy": [rollbackVersionId, "legacy", "retained-first-cutover-rollback", true, "production-legacy-bindings", "existing-production-unchanged", "production"],
};

function completeEvidence() {
  const baseUrl = "https://staging.vcskill.vchun.dev";
  const evidence = {
    environment: { evidenceKind: "cloudflare-live-observation", observedAt: "2026-08-09T10:00:00Z", baseUrl, profile: "combined" },
    attestation: {
      permissionModel: "consolidated", principalRole: "push", tokenScope: "single-repository", repository: "bavanchun/vcskill",
      tokenPermissions: { contents: "read", actions: "write", contentsWrite: false, releasesWrite: false, administration: false },
    },
    provenance: {
      deployments: Object.fromEntries(Object.entries(deploymentFixtures).map(([ref, [workerVersionId, profile, purpose, retained, bindingStateRef, credentialContext, environment]]) => [ref, {
        workerVersionId, profile, purpose, retained, bindingStateRef, credentialContext, environment,
        baseUrl: environment === "production" ? "https://vcskill.vchun.dev" : baseUrl,
        observedAt: "2026-08-09T09:00:00Z",
      }])),
      routeBindings: [
        ["staging.vcskill.vchun.dev", "/", "candidate-b-final"],
        ["staging.vcskill.vchun.dev", "/install*", "candidate-b-final"],
        ["staging.vcskill.vchun.dev", "/install.ps1*", "candidate-b-final"],
        ["staging.vcskill.vchun.dev", "/version*", "candidate-b-final"],
        ["staging.vcskill.vchun.dev", "/download/*", "candidate-b-final"],
        ["staging.vcskill.vchun.dev", "/", "staging-site-binding"],
        ["vcskill.vchun.dev", "/", "production-legacy"],
      ].map(([host, pattern, deploymentRef]) => ({ host, pattern, deploymentRef, observed: true })),
      transitions: [{
        id: "candidate-b-custom-domain-reverse", fromDeploymentRef: "candidate-b-before-rehearsal", viaDeploymentRef: "staging-site-binding", restoredDeploymentRef: "candidate-b-before-hardening",
        mechanicsResult: "passed", applicationResult: "passed", observedAt: "2026-08-09T09:30:00Z",
      }, {
        id: "candidate-b-source-hardening", fromDeploymentRef: "candidate-b-before-hardening", viaDeploymentRef: "candidate-b-final", restoredDeploymentRef: "candidate-b-final",
        mechanicsResult: "passed", applicationResult: "passed", observedAt: "2026-08-09T09:45:00Z",
      }],
      ingressGuard: {
        environment: "staging", phase: "http_request_firewall_custom", action: "block", enabled: true, productionEnabled: false,
        policyDigest: ingressDigest, observedAt: "2026-08-09T09:50:00Z",
      },
      compatibilityProbes: Array.from({ length: REQUIRED_REPETITIONS }, (_, index) => ({
        id: "legacy-new-credential-installer", repetition: index + 1, deploymentRef: "legacy-new-credential-probe", requestPath: "/install",
        status: 401, expectedStatus: 200, contentClass: "upstream-auth-error", cacheControl: "no-store", pass: false, observedAt: "2026-08-09T09:35:00Z",
      })),
      rollbackTarget: {
        deploymentRef: "production-legacy", secretMutationPolicy: "prohibited-until-rollback-window-closes", liveReadOnlyCompatibility: true,
        owner: "cutover owner", expiryOwner: "cleanup owner",
      },
    },
    cells: REQUIRED_CELL_IDS.flatMap((id) => Array.from({ length: REQUIRED_REPETITIONS }, (_, index) => ({
      id, repetition: index + 1, requestPath: "/version?version=1.2.3", status: REQUIRED_CELLS[id][0], contentClass: REQUIRED_CELLS[id][1], cacheControl: REQUIRED_CELLS[id][2],
      deploymentRef: CELL_DEPLOYMENT_REFS[id], observedAt: `2026-08-09T10:00:0${index}Z`, cacheState: index === 0 ? "cold" : "warm", pass: true,
    }))),
  };
  for (const cell of evidence.cells.filter((entry) => entry.id === "candidate-a-route-transfer-rollback")) {
    cell.status = 200;
    cell.contentClass = "site-collision";
    cell.cacheControl = "public, max-age=300";
    cell.notes = "Protected route reached the site during route reassignment.";
    cell.pass = false;
  }
  return evidence;
}

function artifactInput(matrix = completeEvidence()) {
  return {
    observedMatrix: matrix,
    decision: { selectedCandidate: "B", rationale: "Physical asset precedence passed.", routePatterns: ["/version*"], commands: ["wrangler deploy --dry-run workers/edge/wrangler.combined.toml"] },
    stagingState: {
      baseUrl: matrix.environment.baseUrl, workerVersionId: versionId, selectedProfile: "combined", secretNamePresence: { GH_TOKEN: true },
      rollbackOwner: "cutover owner", rollbackResult: "passed-composite", expiryOwner: "cleanup owner",
      ingressGuard: {
        environment: "staging", phase: "http_request_firewall_custom", action: "block", enabled: true, productionEnabled: false,
        policyDigest: ingressDigest, observedAt: "2026-08-09T09:50:00Z",
      },
      rollbackTarget: {
        baseUrl: "https://vcskill.vchun.dev", workerVersionId: rollbackVersionId, bindingStateRef: "production-legacy-bindings",
        secretNamePresence: { GH_TOKEN: true }, secretMutationPolicy: "prohibited-until-rollback-window-closes",
      },
    },
  };
}

test("local evidence is complete but cannot create decision artifacts", async () => {
  const local = buildDeterministicLocalMatrix({ baseUrl: "https://staging.vcskill.vchun.dev", profile: "combined" });
  assert.equal(local.cells.length, REQUIRED_CELL_IDS.length * REQUIRED_REPETITIONS);
  await assert.rejects(writeDecisionArtifacts({ ...artifactInput(), observedMatrix: { ...local, environment: { ...local.environment, mode: "live" } }, decisionPath: join(tempDir, "d.md"), statePath: join(tempDir, "s.json") }), /evidence kind/);
});

test("artifact writer requires every passing repetition and observed provenance", async () => {
  const incomplete = completeEvidence();
  incomplete.cells.pop();
  await assert.rejects(writeDecisionArtifacts({ ...artifactInput(incomplete), decisionPath: join(tempDir, "d.md"), statePath: join(tempDir, "s.json") }), /complete/);
  const failed = completeEvidence();
  failed.cells.find((cell) => cell.id === "candidate-b-collision-version").pass = false;
  await assert.rejects(writeDecisionArtifacts({ ...artifactInput(failed), decisionPath: join(tempDir, "d.md"), statePath: join(tempDir, "s.json") }), /passing/);
  const fabricated = completeEvidence();
  fabricated.cells[0].status = 418;
  await assert.rejects(writeDecisionArtifacts({ ...artifactInput(fabricated), decisionPath: join(tempDir, "d.md"), statePath: join(tempDir, "s.json") }), /passing/);
  const incoherent = artifactInput();
  incoherent.stagingState.selectedProfile = "edge";
  await assert.rejects(writeDecisionArtifacts({ ...incoherent, decisionPath: join(tempDir, "d.md"), statePath: join(tempDir, "s.json") }), /profile|candidate/);
});

test("Candidate B requires an observed A failure while Candidate A rejects one", async () => {
  const noFailure = completeEvidence();
  for (const cell of noFailure.cells.filter((entry) => entry.id === "candidate-a-route-transfer-rollback")) {
    cell.status = REQUIRED_CELLS[cell.id][0];
    cell.contentClass = REQUIRED_CELLS[cell.id][1];
    cell.cacheControl = REQUIRED_CELLS[cell.id][2];
    cell.notes = "";
    cell.pass = true;
  }
  await assert.rejects(writeDecisionArtifacts({ ...artifactInput(noFailure), decisionPath: join(tempDir, "d.md"), statePath: join(tempDir, "s.json") }), /Candidate B/);

  const selectedA = artifactInput();
  selectedA.decision.selectedCandidate = "A";
  selectedA.stagingState.selectedProfile = "edge";
  selectedA.observedMatrix.environment.profile = "edge";
  await assert.rejects(writeDecisionArtifacts({ ...selectedA, decisionPath: join(tempDir, "d.md"), statePath: join(tempDir, "s.json") }), /Candidate B|topology/);
});

test("route-binding evidence requires the complete literal protected-route set", async () => {
  const input = artifactInput();
  input.observedMatrix.provenance.routeBindings = input.observedMatrix.provenance.routeBindings.filter((binding) => binding.pattern !== "/install.ps1*");
  await assert.rejects(writeDecisionArtifacts({ ...input, decisionPath: join(tempDir, "d.md"), statePath: join(tempDir, "s.json") }), /complete observed route binding/);
});

test("complete sanitized live observations can write only caller-selected temporary artifacts", async () => {
  await rm(tempDir, { recursive: true, force: true });
  await mkdir(tempDir, { recursive: true });
  const decisionPath = join(tempDir, "edge-routing-topology.md");
  const statePath = join(tempDir, "edge-staging-state.json");
  await writeDecisionArtifacts({ ...artifactInput(), decisionPath, statePath });
  assert.match(await readFile(decisionPath, "utf8"), /Selected candidate: B/);
  assert.equal(JSON.parse(await readFile(statePath, "utf8")).workerVersionId, versionId);
});

test("committed decision artifacts are reproducible from the durable sanitized observation record", async () => {
  await rm(tempDir, { recursive: true, force: true });
  await mkdir(tempDir, { recursive: true });
  const recorded = JSON.parse(await readFile(join(repoRoot, "docs/decisions/edge-routing-observations.json"), "utf8"));
  const decisionPath = join(tempDir, "edge-routing-topology.md");
  const statePath = join(tempDir, "edge-staging-state.json");
  await writeDecisionArtifacts({
    observedMatrix: recorded,
    decision: recorded.decision,
    stagingState: recorded.stagingState,
    decisionPath,
    statePath,
  });
  assert.equal(await readFile(decisionPath, "utf8"), await readFile(join(repoRoot, "docs/decisions/edge-routing-topology.md"), "utf8"));
  assert.equal(await readFile(statePath, "utf8"), await readFile(join(repoRoot, "docs/decisions/edge-staging-state.json"), "utf8"));
});

test("sanitizers remove request values and reject preview or moving staging state", () => {
  const cell = sanitizeObservedCell({ id: "x", repetition: 1, requestPath: "/download/a?version=1.2.3&token=secret", status: 200, contentClass: "stream", cacheControl: "no-store", deploymentRef: "candidate-b-final", observedAt: "2026-08-09T10:00:00Z", cacheState: "cold", notes: "Authorization Bearer secret account 123456", pass: true });
  assert.equal(cell.requestPath.includes("1.2.3"), false);
  assert.equal(cell.notes.toLowerCase().includes("bearer"), false);
  assert.throws(() => validateStagingStateRecord({ baseUrl: "https://preview.workers.dev", workerVersionId: "latest", selectedProfile: "edge" }), /preview|version/i);
  const invalidPort = structuredClone(artifactInput().stagingState);
  invalidPort.baseUrl = "https://staging.vcskill.vchun.dev:8443";
  assert.throws(() => validateStagingStateRecord(invalidPort), /unapproved/);
  const syntheticPat = `github_pat_${"A".repeat(40)}`;
  const syntheticJwt = `eyJ${"a".repeat(12)}.${"b".repeat(14)}.${"c".repeat(16)}`;
  assert.equal(sanitizeText(`note ${syntheticPat} ${syntheticJwt}`).includes("github_pat_"), false);
  assert.equal(sanitizeText(`note ${syntheticPat} ${syntheticJwt}`).includes("eyJ"), false);
});

test("split provenance cannot hide the failed legacy compatibility probe or misattribute controls", async () => {
  const missingProbe = artifactInput();
  missingProbe.observedMatrix.provenance.compatibilityProbes = [];
  await assert.rejects(writeDecisionArtifacts({ ...missingProbe, decisionPath: join(tempDir, "d.md"), statePath: join(tempDir, "s.json") }), /legacy credential/);

  const relabeledProbe = artifactInput();
  relabeledProbe.observedMatrix.provenance.compatibilityProbes[0].pass = true;
  await assert.rejects(writeDecisionArtifacts({ ...relabeledProbe, decisionPath: join(tempDir, "d.md"), statePath: join(tempDir, "s.json") }), /failed legacy/);

  const wrongControl = artifactInput();
  wrongControl.observedMatrix.cells.find((cell) => cell.id === "upstream-failure").deploymentRef = "candidate-b-final";
  await assert.rejects(writeDecisionArtifacts({ ...wrongControl, decisionPath: join(tempDir, "d.md"), statePath: join(tempDir, "s.json") }), /complete/);
});

test("decision evidence rejects credential-bearing free-form commands and rationale", async () => {
  const input = artifactInput();
  input.decision.commands = ["wrangler deploy --dry-run X-Api-Key:supersecret"];
  await assert.rejects(writeDecisionArtifacts({ ...input, decisionPath: join(tempDir, "d.md"), statePath: join(tempDir, "s.json") }), /commands/);
  input.decision.commands = ["wrangler deploy --dry-run workers/edge/wrangler.combined.toml"];
  input.decision.rationale = "password=hunter2";
  await assert.rejects(writeDecisionArtifacts({ ...input, decisionPath: join(tempDir, "d.md"), statePath: join(tempDir, "s.json") }), /rationale/);

  const patInput = artifactInput();
  patInput.decision.rationale = `Observed ${`ghp_${"Z".repeat(36)}`}`;
  await assert.rejects(writeDecisionArtifacts({ ...patInput, decisionPath: join(tempDir, "d.md"), statePath: join(tempDir, "s.json") }), /rationale/);

  const queryInput = artifactInput();
  queryInput.observedMatrix.cells[0].requestPath = `/version?token=${`ghp_${"Q".repeat(36)}`}`;
  await assert.rejects(writeDecisionArtifacts({ ...queryInput, decisionPath: join(tempDir, "d.md"), statePath: join(tempDir, "s.json") }), /request path/);

  const ownerInput = artifactInput();
  ownerInput.stagingState.rollbackOwner = `owner ${`cfut_${"R".repeat(32)}`}`;
  await assert.rejects(writeDecisionArtifacts({ ...ownerInput, decisionPath: join(tempDir, "d.md"), statePath: join(tempDir, "s.json") }), /rollback owner/);
});

test("credential evidence requires the exact accepted consolidated permission boundary", async () => {
  const mutations = [
    (attestation) => { attestation.permissionModel = "separate"; },
    (attestation) => { attestation.repository = "bavanchun/vcskill-web"; },
    (attestation) => { attestation.tokenScope = "all-repositories"; },
    (attestation) => { attestation.tokenPermissions.actions = "read"; },
    (attestation) => { attestation.tokenPermissions.contentsWrite = true; },
    (attestation) => { attestation.tokenPermissions.releasesWrite = true; },
    (attestation) => { attestation.tokenPermissions.administration = true; },
  ];

  for (const mutate of mutations) {
    const input = artifactInput();
    mutate(input.observedMatrix.attestation);
    await assert.rejects(writeDecisionArtifacts({
      ...input,
      decisionPath: join(tempDir, "d.md"),
      statePath: join(tempDir, "s.json"),
    }), /credential|permission|repository|scope|actions|contentsWrite|releasesWrite|administration/i);
  }
});

test.after(async () => rm(tempDir, { recursive: true, force: true }));
