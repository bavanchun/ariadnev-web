import assert from "node:assert/strict";

export const REQUIRED_CELLS = Object.freeze({
  "candidate-a-protected-query": [200, "version-text", "no-store"],
  "candidate-a-lookalike-query": [200, "site-lookalike", "public, max-age=300"],
  "candidate-a-malformed-download": [400, "bounded-edge-error", "(absent)"],
  "candidate-a-route-transfer-rollback": [200, "no-gap", "no-store"],
  "candidate-b-collision-version": [200, "version-text", "no-store"],
  "candidate-b-physical-404": [404, "physical-404", "no-store"],
  "combined-missing-secret": [500, "missing-secret", "(absent)"],
  "pinned-version": [200, "version-text", "no-store"],
  "pinned-download": [200, "download-stream", "no-store"],
  "upstream-failure": [502, "empty-error", "(absent)"],
  "deploy-order-edge-then-site": [200, "version-text", "no-store"],
  "deploy-order-site-then-edge": [200, "download-stream", "no-store"],
  "rollback-order-edge-then-site": [200, "version-text", "no-store"],
  "rollback-order-site-then-edge": [200, "download-stream", "no-store"],
  "legacy-cutover-restore": [200, "installer-shell", "no-store"],
});
export const REQUIRED_CELL_IDS = Object.freeze(Object.keys(REQUIRED_CELLS));
export const REQUIRED_REPETITIONS = 2;

export const LIVE_REPROBE_CELLS = Object.freeze({
  "current-version": { requestPath: "/version", status: 200, contentClass: "version-text", cacheControls: ["no-store"] },
  "pinned-version": { requestPath: "/version?[query-redacted]", status: 200, contentClass: "version-text", cacheControls: ["no-store"] },
  "pinned-checksums": { requestPath: "/download/checksums.txt?[query-redacted]", status: 200, contentClass: "download-stream", cacheControls: ["no-store"] },
  "encoded-checksums": { requestPath: "/download/checksums%2Etxt", status: 200, contentClass: "download-stream", cacheControls: ["no-store"] },
  "physical-404": { requestPath: "/not-found", status: 404, contentClass: "physical-404", cacheControls: ["no-store"] },
  "site-lookalike": { requestPath: "/installer", status: 200, contentClass: "site-lookalike", cacheControls: ["public, max-age=300"] },
  "raw-dot-segment-lower": { requestPath: "/download/%2e%2e", status: 403, contentClass: "ingress-block", cacheControls: ["(absent)", "no-store"] },
  "raw-dot-segment-mixed": { requestPath: "/download/a/%2E%2e/checksums.txt", status: 403, contentClass: "ingress-block", cacheControls: ["(absent)", "no-store"] },
});

export const REQUIRED_DEPLOYMENTS = Object.freeze({
  "candidate-a-edge-first": { environment: "staging", profile: "edge", purpose: "candidate-a-gate", retained: false },
  "candidate-a-failed": { environment: "staging", profile: "edge", purpose: "candidate-a-route-failure", retained: false },
  "candidate-a-site-first": { environment: "staging", profile: "edge", purpose: "candidate-a-gate", retained: false },
  "candidate-b-before-rehearsal": { environment: "staging", profile: "combined", purpose: "selected-prior", retained: true },
  "candidate-b-before-hardening": { environment: "staging", profile: "combined", purpose: "selected-prior-hardening", retained: true },
  "candidate-b-final": { environment: "staging", profile: "combined", purpose: "selected-final", retained: true },
  "staging-site-binding": { environment: "staging", profile: "site", purpose: "binding-rehearsal", retained: true },
  "missing-binding-control": { environment: "staging", profile: "combined", purpose: "controlled-missing-binding", retained: false },
  "upstream-failure-control": { environment: "staging", profile: "combined", purpose: "controlled-upstream-failure", retained: false },
  "legacy-new-credential-probe": { environment: "staging", profile: "legacy", purpose: "legacy-credential-compatibility", retained: false },
  "production-legacy": { environment: "production", profile: "legacy", purpose: "retained-first-cutover-rollback", retained: true },
});

export const CELL_DEPLOYMENT_REFS = Object.freeze({
  "candidate-a-protected-query": "candidate-a-edge-first",
  "candidate-a-lookalike-query": "candidate-a-edge-first",
  "candidate-a-malformed-download": "candidate-a-edge-first",
  "candidate-a-route-transfer-rollback": "candidate-a-failed",
  "candidate-b-collision-version": "candidate-b-final",
  "candidate-b-physical-404": "candidate-b-final",
  "combined-missing-secret": "missing-binding-control",
  "pinned-version": "candidate-b-final",
  "pinned-download": "candidate-b-final",
  "upstream-failure": "upstream-failure-control",
  "deploy-order-edge-then-site": "candidate-a-edge-first",
  "deploy-order-site-then-edge": "candidate-a-site-first",
  "rollback-order-edge-then-site": "candidate-b-before-rehearsal",
  "rollback-order-site-then-edge": "candidate-b-before-rehearsal",
  "legacy-cutover-restore": "production-legacy",
});

const APPROVED_HOSTS = new Set(["staging.vcskill.vchun.dev", "vcskill.vchun.dev"]);
const APPROVED_GITHUB_REPOSITORY = "bavanchun/vcskill";
const APPROVED_CONTENT_CLASSES = new Set([
  ...Object.values(REQUIRED_CELLS).map((value) => value[1]),
  "site-collision",
  "upstream-auth-error",
]);
const sensitivePattern = /(?:authorization|bearer|gh_token|secret|token|password|cookie|api[-_]?key|account|zone|https?:|\b[a-z0-9-]+\.(?:com|dev|net|org)\b)/i;
const safeTextPattern = /^[A-Za-z0-9][A-Za-z0-9 .,;:=()/_*-]{0,299}$/;
const credentialShapePatterns = Object.freeze([
  /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|cfut_[A-Za-z0-9_-]{20,})\b/i,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/,
]);
const sensitiveQueryPattern = /(?:^|[?&])(?:authorization|token|secret|password|cookie|api[-_]?key)=/i;
const REQUIRED_ROUTE_BINDINGS = Object.freeze([
  ["staging.vcskill.vchun.dev", "/", "candidate-b-final"],
  ["staging.vcskill.vchun.dev", "/install*", "candidate-b-final"],
  ["staging.vcskill.vchun.dev", "/install.ps1*", "candidate-b-final"],
  ["staging.vcskill.vchun.dev", "/version*", "candidate-b-final"],
  ["staging.vcskill.vchun.dev", "/download/*", "candidate-b-final"],
  ["staging.vcskill.vchun.dev", "/", "staging-site-binding"],
  ["vcskill.vchun.dev", "/", "production-legacy"],
]);

export function fail(message) {
  const error = new Error(message);
  error.code = "EDGE_SPIKE_INVALID";
  return error;
}

export function normalizeBaseUrl(value) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.port || !APPROVED_HOSTS.has(url.hostname)) throw fail("refuse unapproved or preview base URL");
  if (url.username || url.password) throw fail("refuse credentialed base URL");
  url.pathname = "/";
  url.search = "";
  url.hash = "";
  return url.toString();
}

function containsCredentialShape(value) {
  const text = String(value || "");
  return credentialShapePatterns.some((pattern) => pattern.test(text));
}

function assertSafeFreeText(value, label, { allowEmpty = false } = {}) {
  const text = String(value || "");
  if ((allowEmpty && text === "")) return;
  if (!safeTextPattern.test(text) || sensitivePattern.test(text) || containsCredentialShape(text)) {
    throw fail(`sanitized ${label} is required`);
  }
}

export function sanitizeText(value) {
  return String(value || "")
    .replace(/\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|cfut_[A-Za-z0-9_-]{20,})\b/gi, "[credential]")
    .replace(/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, "[credential]")
    .replace(/https?:\/\/[^\s)]+/gi, "[url]")
    .replace(/\b\d{6,}\b/g, "[identifier]")
    .replace(/\b(?:GH_TOKEN|Authorization|Bearer|token|secret|account|zone)\b[^\s]*/gi, "[redacted]");
}

export function sanitizePath(value) {
  const url = new URL(String(value || "/"), "https://evidence.invalid");
  return `${url.pathname}${url.search ? "?[query-redacted]" : ""}`;
}

export function sanitizeObservedCell(cell) {
  return {
    id: cell.id,
    repetition: cell.repetition,
    requestPath: sanitizePath(cell.requestPath),
    status: cell.status,
    contentClass: APPROVED_CONTENT_CLASSES.has(cell.contentClass) ? cell.contentClass : sanitizeText(cell.contentClass),
    cacheControl: sanitizeText(cell.cacheControl),
    deploymentRef: sanitizeText(cell.deploymentRef),
    observedAt: cell.observedAt,
    cacheState: cell.cacheState,
    notes: sanitizeText(cell.notes),
    pass: cell.pass,
  };
}

function validateAttestation(attestation) {
  assert.ok(["push", "maintain", "admin"].includes(attestation?.principalRole), "push-capable principal role is required");
  assert.equal(attestation?.permissionModel, "consolidated", "consolidated credential permission model is required");
  assert.equal(attestation?.repository, APPROVED_GITHUB_REPOSITORY, "exact GitHub repository scope is required");
  assert.equal(attestation?.tokenPermissions?.contents, "read", "token Contents read attestation is required");
  assert.equal(attestation?.tokenPermissions?.actions, "write", "token Actions write attestation is required");
  for (const permission of ["contentsWrite", "releasesWrite", "administration"]) {
    assert.equal(attestation.tokenPermissions[permission], false, `${permission} must be false`);
  }
  assert.equal(attestation.tokenScope, "single-repository", "single-repository token scope is required");
}

function validateImmutableVersion(value, label) {
  if (!/^(?:[0-9a-f]{8,64}|[0-9a-f]{8}-[0-9a-f-]{27,})$/i.test(value || "")) throw fail(`${label} immutable worker version ID is required`);
}

function validateDeploymentRecord(ref, deployment, expected) {
  if (!deployment || deployment.environment !== expected.environment || deployment.profile !== expected.profile || deployment.purpose !== expected.purpose || deployment.retained !== expected.retained) {
    throw fail(`${ref} deployment provenance is invalid`);
  }
  validateImmutableVersion(deployment.workerVersionId, ref);
  const baseUrl = normalizeBaseUrl(deployment.baseUrl);
  const expectedHost = deployment.environment === "production" ? "vcskill.vchun.dev" : "staging.vcskill.vchun.dev";
  if (new URL(baseUrl).hostname !== expectedHost) throw fail(`${ref} deployment environment is invalid`);
  if (!Number.isFinite(Date.parse(deployment.observedAt))) throw fail(`${ref} observed timestamp is required`);
  if (!/^[a-z0-9][a-z0-9-]{2,79}$/.test(deployment.bindingStateRef || "")) throw fail(`${ref} binding state reference is required`);
  if (deployment.credentialContext !== undefined && ![
    "release-read-present",
    "consolidated-present",
    "required-binding-suppressed",
    "controlled-invalid-upstream",
    "existing-production-unchanged",
    "not-applicable",
  ].includes(deployment.credentialContext)) {
    throw fail(`${ref} credential context is invalid`);
  }
}

function validateRouteBindings(bindings, deployments) {
  if (!Array.isArray(bindings) || bindings.length !== REQUIRED_ROUTE_BINDINGS.length) throw fail("complete observed route binding provenance is required");
  const expected = new Set(REQUIRED_ROUTE_BINDINGS.map((entry) => entry.join("|")));
  for (const binding of bindings) {
    if (!APPROVED_HOSTS.has(binding?.host) || !/^\/[A-Za-z0-9/*._-]*$/.test(binding.pattern || "") || binding.observed !== true || !deployments[binding.deploymentRef]) {
      throw fail("sanitized observed route binding provenance is required");
    }
    if (!expected.delete([binding.host, binding.pattern, binding.deploymentRef].join("|"))) {
      throw fail("complete observed route binding provenance is required");
    }
  }
  if (expected.size) throw fail("complete observed route binding provenance is required");
}

function validateTransitions(transitions) {
  if (!Array.isArray(transitions)) throw fail("observed topology transitions are required");
  for (const transition of transitions) {
    for (const field of ["id", "fromDeploymentRef", "viaDeploymentRef", "restoredDeploymentRef"]) {
      if (!/^[a-z0-9][a-z0-9-]{2,79}$/.test(transition?.[field] || "")) throw fail("sanitized topology transition is required");
    }
    if (!/^(?:passed|failed-[a-z0-9-]+)$/.test(transition.mechanicsResult || "") || !/^(?:passed|failed-[a-z0-9-]+)$/.test(transition.applicationResult || "") || !Number.isFinite(Date.parse(transition.observedAt))) {
      throw fail("sanitized topology transition is required");
    }
  }
  const reverse = transitions.find((entry) => entry.id === "candidate-b-custom-domain-reverse");
  if (!reverse || reverse.fromDeploymentRef !== "candidate-b-before-rehearsal" || reverse.viaDeploymentRef !== "staging-site-binding" || reverse.restoredDeploymentRef !== "candidate-b-before-hardening" || reverse.mechanicsResult !== "passed" || reverse.applicationResult !== "passed" || !Number.isFinite(Date.parse(reverse.observedAt))) {
    throw fail("passing Candidate B reverse binding transition is required");
  }
  const hardening = transitions.find((entry) => entry.id === "candidate-b-source-hardening");
  if (!hardening || hardening.fromDeploymentRef !== "candidate-b-before-hardening" || hardening.viaDeploymentRef !== "candidate-b-final" || hardening.restoredDeploymentRef !== "candidate-b-final" || hardening.mechanicsResult !== "passed" || hardening.applicationResult !== "passed" || !Number.isFinite(Date.parse(hardening.observedAt))) {
    throw fail("passing Candidate B source hardening transition is required");
  }
}

function validateIngressGuard(guard) {
  if (guard?.environment !== "staging" || guard.phase !== "http_request_firewall_custom" || guard.action !== "block" || guard.enabled !== true || guard.productionEnabled !== false || !/^[0-9a-f]{64}$/.test(guard.policyDigest || "") || !Number.isFinite(Date.parse(guard.observedAt))) {
    throw fail("active source-bound staging ingress guard is required");
  }
}

export function validateLiveReprobeRecord(record) {
  if (record?.environment?.evidenceKind !== "cloudflare-live-reprobe") throw fail("verified live re-probe evidence kind is required");
  const baseUrl = normalizeBaseUrl(record.environment.baseUrl);
  if (new URL(baseUrl).hostname !== "staging.vcskill.vchun.dev" || record.environment.profile !== "combined") {
    throw fail("live re-probe must target the retained combined staging endpoint");
  }
  validateImmutableVersion(record.workerVersionId, "live re-probe");
  const environmentObservedAt = Date.parse(record.environment.observedAt);
  const checkedBeforeAt = Date.parse(record.ingressGuard?.checkedBeforeAt);
  const checkedAfterAt = Date.parse(record.ingressGuard?.checkedAfterAt);
  const versionCheckedBeforeAt = Date.parse(record.workerVersionVerification?.checkedBeforeAt);
  const versionCheckedAfterAt = Date.parse(record.workerVersionVerification?.checkedAfterAt);
  if (
    record.ingressGuard?.status !== "current"
    || record.ingressGuard.ref !== "vcskill_raw_download_dot_segments_staging"
    || !/^[0-9a-f]{64}$/.test(record.ingressGuard.policyDigest || "")
    || record.ingressGuard.position !== 1
    || !Number.isFinite(checkedBeforeAt)
    || !Number.isFinite(checkedAfterAt)
    || checkedBeforeAt > checkedAfterAt
    || !Number.isFinite(environmentObservedAt)
    || environmentObservedAt < checkedAfterAt
  ) throw fail("source-bound live re-probe ingress verification is required");
  if (
    record.workerVersionVerification?.status !== "stable"
    || !Number.isFinite(versionCheckedBeforeAt)
    || !Number.isFinite(versionCheckedAfterAt)
    || versionCheckedBeforeAt > versionCheckedAfterAt
    || environmentObservedAt < versionCheckedAfterAt
  ) throw fail("stable live re-probe Worker version verification is required");

  if (!Array.isArray(record.cells)) throw fail("complete live re-probe cells are required");
  const expected = new Set(Object.keys(LIVE_REPROBE_CELLS).flatMap((id) => (
    Array.from({ length: REQUIRED_REPETITIONS }, (_, index) => `${id}#${index + 1}`)
  )));
  for (const cell of record.cells) {
    const frozen = LIVE_REPROBE_CELLS[cell?.id];
    const key = `${cell?.id}#${cell?.repetition}`;
    const observedAt = Date.parse(cell?.observedAt);
    if (
      !frozen
      || !expected.delete(key)
      || cell.requestPath !== frozen.requestPath
      || cell.status !== frozen.status
      || cell.contentClass !== frozen.contentClass
      || !frozen.cacheControls.includes(cell.cacheControl)
      || !/^[0-9a-f]{64}$/.test(cell.bodySha256 || "")
      || cell.cfRayPresent !== true
      || !/^[0-9a-f]{64}$/.test(cell.cfRaySha256 || "")
      || cell.pass !== true
      || !Number.isFinite(observedAt)
      || observedAt < checkedBeforeAt
      || observedAt > checkedAfterAt
      || observedAt < versionCheckedBeforeAt
      || observedAt > versionCheckedAfterAt
    ) throw fail("complete passing live re-probe cells are required");
  }
  if (expected.size) throw fail("complete live re-probe cells are required");
  return record;
}

function validateCompatibilityProbes(probes) {
  if (!Array.isArray(probes) || probes.length !== REQUIRED_REPETITIONS) throw fail("legacy credential compatibility observations are required");
  for (const [index, probe] of probes.entries()) {
    if (probe.id !== "legacy-new-credential-installer" || probe.repetition !== index + 1 || probe.deploymentRef !== "legacy-new-credential-probe" || probe.requestPath !== "/install" || probe.status !== 401 || probe.expectedStatus !== 200 || probe.cacheControl !== "no-store" || probe.contentClass !== "upstream-auth-error" || probe.pass !== false || !Number.isFinite(Date.parse(probe.observedAt))) {
      throw fail("failed legacy new-credential probe must remain explicit");
    }
  }
}

function validateRollbackTarget(target, deployments) {
  if (target?.deploymentRef !== "production-legacy" || !deployments[target.deploymentRef] || target.secretMutationPolicy !== "prohibited-until-rollback-window-closes" || target.liveReadOnlyCompatibility !== true || !target.owner || !target.expiryOwner) {
    throw fail("retained composite rollback target is required");
  }
}

function validateBoundedFailure(cell) {
  if (!Number.isInteger(cell.status) || cell.status < 100 || cell.status > 599) throw fail("bounded failed observation status is required");
  for (const value of [cell.contentClass, cell.cacheControl, cell.notes]) {
    if (!safeTextPattern.test(String(value || "")) || sensitivePattern.test(String(value || ""))) {
      throw fail("sanitized failed observation details are required");
    }
  }
}

function validateCellSafety(cell) {
  const requestPath = String(cell.requestPath || "");
  if (!requestPath.startsWith("/") || requestPath.length > 500 || containsCredentialShape(requestPath) || sensitiveQueryPattern.test(requestPath)) {
    throw fail("sanitized observed request path is required");
  }
  assertSafeFreeText(cell.notes, "observation notes", { allowEmpty: true });
}

export function validateObservedMatrix(matrix, selectedCandidate = "B") {
  if (selectedCandidate !== "B") throw fail("the durable artifact writer supports only the selected Candidate B topology");
  if (matrix?.environment?.evidenceKind !== "cloudflare-live-observation") throw fail("verified live evidence kind is required");
  normalizeBaseUrl(matrix.environment.baseUrl);
  if (!["edge", "combined", "spike"].includes(matrix.environment.profile)) throw fail("observed profile is required");
  if (!Number.isFinite(Date.parse(matrix.environment.observedAt))) throw fail("valid observed timestamp is required");
  validateAttestation(matrix.attestation);
  const deployments = matrix.provenance?.deployments;
  if (!deployments || typeof deployments !== "object" || Array.isArray(deployments)) throw fail("deployment provenance map is required");
  for (const [ref, expectedDeployment] of Object.entries(REQUIRED_DEPLOYMENTS)) validateDeploymentRecord(ref, deployments[ref], expectedDeployment);
  if (Object.keys(deployments).length !== Object.keys(REQUIRED_DEPLOYMENTS).length) throw fail("unexpected deployment provenance is not allowed");
  validateRouteBindings(matrix.provenance?.routeBindings, deployments);
  validateTransitions(matrix.provenance?.transitions);
  validateIngressGuard(matrix.provenance?.ingressGuard);
  validateCompatibilityProbes(matrix.provenance?.compatibilityProbes);
  validateRollbackTarget(matrix.provenance?.rollbackTarget, deployments);
  if (!Array.isArray(matrix.cells)) throw fail("complete observed live matrix is required");
  const expected = new Set(REQUIRED_CELL_IDS.flatMap((id) => Array.from({ length: REQUIRED_REPETITIONS }, (_, index) => `${id}#${index + 1}`)));
  let candidateAFailures = 0;
  for (const cell of matrix.cells) {
    const key = `${cell.id}#${cell.repetition}`;
    const frozen = REQUIRED_CELLS[cell.id];
    if (!expected.delete(key) || !frozen || !cell.requestPath || cell.deploymentRef !== CELL_DEPLOYMENT_REFS[cell.id]) {
      throw fail("complete passing observed live matrix is required");
    }
    if (!Number.isFinite(Date.parse(cell.observedAt)) || cell.cacheState !== (cell.repetition === 1 ? "cold" : "warm")) throw fail("cold and warm observation provenance is required");
    validateCellSafety(cell);
    const candidateAFailure = selectedCandidate === "B" && cell.id === "candidate-a-route-transfer-rollback" && cell.pass === false;
    if (candidateAFailure) {
      validateBoundedFailure(cell);
      candidateAFailures += 1;
    } else if (cell.pass !== true || cell.status !== frozen[0] || cell.contentClass !== frozen[1] || cell.cacheControl !== frozen[2]) {
      throw fail("complete passing observed live matrix is required");
    }
    if (!deployments[cell.deploymentRef]) throw fail("cell deployment reference must exist");
  }
  if (expected.size) throw fail("complete observed live matrix is required");
  if (candidateAFailures !== REQUIRED_REPETITIONS) throw fail("Candidate B requires every repeated Candidate A rollback gate to retain its observed failure");
}

export function validateStagingStateRecord(record) {
  assert.ok(["edge", "combined", "spike"].includes(record?.selectedProfile), "selectedProfile is required");
  validateImmutableVersion(record.workerVersionId, "retained staging");
  if (!record.rollbackOwner || !record.expiryOwner || record.rollbackResult !== "passed-composite") throw fail("rollback result and ownership are required");
  if (record.secretNamePresence?.GH_TOKEN !== true) throw fail("GH_TOKEN secret-name presence is required");
  assertSafeFreeText(record.rollbackOwner, "rollback owner");
  assertSafeFreeText(record.expiryOwner, "expiry owner");
  validateIngressGuard(record.ingressGuard);
  validateImmutableVersion(record.rollbackTarget?.workerVersionId, "rollback target");
  const rollbackUrl = normalizeBaseUrl(record.rollbackTarget?.baseUrl);
  if (new URL(rollbackUrl).hostname !== "vcskill.vchun.dev" || record.rollbackTarget?.bindingStateRef !== "production-legacy-bindings" || record.rollbackTarget?.secretNamePresence?.GH_TOKEN !== true || record.rollbackTarget?.secretMutationPolicy !== "prohibited-until-rollback-window-closes") {
    throw fail("production rollback target state is required");
  }
  return {
    baseUrl: normalizeBaseUrl(record.baseUrl),
    workerVersionId: record.workerVersionId,
    selectedProfile: record.selectedProfile,
    secretNamePresence: { GH_TOKEN: true },
    rollbackOwner: sanitizeText(record.rollbackOwner),
    rollbackResult: "passed-composite",
    expiryOwner: sanitizeText(record.expiryOwner),
    ingressGuard: {
      environment: "staging",
      phase: "http_request_firewall_custom",
      action: "block",
      enabled: true,
      productionEnabled: false,
      policyDigest: record.ingressGuard.policyDigest,
      observedAt: record.ingressGuard.observedAt,
    },
    rollbackTarget: {
      baseUrl: rollbackUrl,
      workerVersionId: record.rollbackTarget.workerVersionId,
      bindingStateRef: "production-legacy-bindings",
      secretNamePresence: { GH_TOKEN: true },
      secretMutationPolicy: "prohibited-until-rollback-window-closes",
    },
  };
}

export function validateSanitizedDecision(decision) {
  if (decision?.selectedCandidate !== "B") throw fail("the durable topology decision must select Candidate B");
  assertSafeFreeText(decision.rationale, "rationale");
  if (!Array.isArray(decision.routePatterns) || decision.routePatterns.length === 0 || decision.routePatterns.some((value) => !/^\/[A-Za-z0-9/*._-]*$/.test(value))) {
    throw fail("sanitized routePatterns are required");
  }
  if (!Array.isArray(decision.commands) || decision.commands.length === 0 || decision.commands.some((value) => containsCredentialShape(value) || !/^wrangler (?:deploy --dry-run|versions view|deployments status)(?: [A-Za-z0-9./_-]+)*$/.test(value))) {
    throw fail("sanitized commands are required");
  }
}
