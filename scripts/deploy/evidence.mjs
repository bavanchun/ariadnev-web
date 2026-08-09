import { defaultCutoverSchemaPath, controlPlaneError, stableStringify, validateSchema } from "./control-plane.mjs";

const REDACTED = "[redacted]";
const SENSITIVE_KEY = /(?:authorization|cookie|credential|password|private.?key|secret|signed.?url|token)/i;
const SENSITIVE_VALUE = /(?:bearer\s+[A-Za-z0-9._~-]+|gh[pousr]_[A-Za-z0-9_]+|github_pat_[A-Za-z0-9_]+|cfut_[A-Za-z0-9_-]+|npm_[A-Za-z0-9_-]+|-----BEGIN [A-Z ]*PRIVATE KEY-----)/i;
const RAW_PROVIDER_ID = /^(?:[a-f0-9]{32}|[a-f0-9]{8}-[a-f0-9-]{27,}|[1-9][0-9]{7,})$/i;
const MAX_REDACTION_DEPTH = 8;
const MAX_REDACTION_ENTRIES = 256;
const MAX_REDACTION_STRING = 4096;
const MAX_RECORD_BYTES = 1024 * 1024;
const PUBLIC_EVIDENCE_HOSTS = new Set([
  "vcskill.dev",
  "vcskill.vchun.dev",
  "docs.vcskill.vchun.dev",
  "staging.vcskill.vchun.dev",
  "staging.docs.vcskill.vchun.dev",
]);
const TRANSITIONS = Object.freeze({
  null: ["preflight"],
  preflight: ["cutover-started", "aborted"],
  "cutover-started": ["unit-deployed", "rollback-started", "aborted"],
  "unit-deployed": ["unit-deployed", "cutover-succeeded", "rollback-started", "aborted"],
  "cutover-succeeded": ["rollback-started", "soak-complete"],
  "rollback-started": ["rolled-back", "aborted"],
  "rolled-back": [],
  aborted: [],
});

export function redactRecursively(value, key = "", depth = 0) {
  if (depth > MAX_REDACTION_DEPTH) throw controlPlaneError("evidence exceeds the redaction depth limit", "UNSAFE_EVIDENCE");
  if (SENSITIVE_KEY.test(key)) return REDACTED;
  if (Array.isArray(value)) {
    if (value.length > MAX_REDACTION_ENTRIES) throw controlPlaneError("evidence array exceeds the redaction limit", "UNSAFE_EVIDENCE");
    return value.map((entry) => redactRecursively(entry, "", depth + 1));
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value);
    if (entries.length > MAX_REDACTION_ENTRIES) throw controlPlaneError("evidence object exceeds the redaction limit", "UNSAFE_EVIDENCE");
    return Object.fromEntries(entries.map(([entryKey, entryValue]) => [entryKey, redactRecursively(entryValue, entryKey, depth + 1)]));
  }
  if (typeof value !== "string") return value;
  if (value.length > MAX_REDACTION_STRING) throw controlPlaneError("evidence string exceeds the redaction limit", "UNSAFE_EVIDENCE");
  if (SENSITIVE_VALUE.test(value) || RAW_PROVIDER_ID.test(value)) return REDACTED;
  if (/[A-Za-z][A-Za-z0-9+.-]*:\/\//.test(value) && !/^[A-Za-z][A-Za-z0-9+.-]*:\/\//.test(value)) return REDACTED;
  if (!/^[A-Za-z][A-Za-z0-9+.-]*:\/\//.test(value)) {
    return value.replace(/([?&](?:signature|token|key|auth)=)[^&#\s]+/gi, `$1${REDACTED}`);
  }
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.port || url.username || url.password || url.hash
      || !PUBLIC_EVIDENCE_HOSTS.has(url.hostname.toLowerCase())) return REDACTED;
    return `${url.origin}${url.pathname}${url.search ? "?[query-redacted]" : ""}`;
  } catch {
    return REDACTED;
  }
}

export function assertLegalTransition(previousState, nextState) {
  const allowed = TRANSITIONS[String(previousState)] || [];
  if (!allowed.includes(nextState)) throw controlPlaneError(`illegal cutover transition: ${previousState ?? "initial"} -> ${nextState}`, "ILLEGAL_CUTOVER_TRANSITION");
}

export async function createCutoverRecord(source, options = {}) {
  const previous = options.previousRecord;
  if (source.previousState === null) {
    if (previous) throw controlPlaneError("initial cutover record may not have a previous record", "ILLEGAL_CUTOVER_TRANSITION");
  } else {
    if (!previous) throw controlPlaneError("non-initial cutover transition requires the previous record", "ILLEGAL_CUTOVER_TRANSITION");
    await validateSchema(previous, options.schemaPath || defaultCutoverSchemaPath);
    if (source.previousState !== previous.state) throw controlPlaneError("previous cutover state does not match", "ILLEGAL_CUTOVER_TRANSITION");
    if (stableStringify(source.identity) !== stableStringify(previous.identity)) throw controlPlaneError("cutover identity changed across lifecycle records", "CUTOVER_IDENTITY_DRIFT");
    if (Date.parse(source.recordedAt) <= Date.parse(previous.recordedAt)) throw controlPlaneError("cutover record timestamps must increase", "ILLEGAL_CUTOVER_TRANSITION");
  }
  assertLegalTransition(source.previousState ?? null, source.state);
  const record = redactRecursively(source);
  if (Buffer.byteLength(stableStringify(record)) > MAX_RECORD_BYTES) throw controlPlaneError("cutover record exceeds the byte limit", "UNSAFE_EVIDENCE");
  await validateSchema(record, options.schemaPath || defaultCutoverSchemaPath);
  return record;
}

export function deploymentIdentity(input) {
  return {
    environment: input.environment,
    topologyId: input.topologyId,
    productSha: input.product.sha,
    qualificationEvidenceSha: input.qualification.evidenceSha,
    releaseTag: input.release.tag,
    releaseSourceSha: input.release.sourceSha,
    releaseAssetSetDigest: input.release.assetSetDigest,
    productOutputDigest: input.product.outputDigest,
    unitSetDigest: input.digests.unitSet,
    productionPolicyAttestationDigest: input.productionPolicyAttestationDigest,
    deploymentInputDigest: input.deploymentInputDigest,
    ingressPrestateDigest: input.ingress.prestate.stateDigest,
  };
}

export function verifyConvergence(expectedInput, observation, options = {}) {
  const expected = {
    identity: deploymentIdentity(expectedInput),
    release: {
      tag: expectedInput.release.tag,
      version: expectedInput.release.version,
      sourceSha: expectedInput.release.sourceSha,
      publicationState: expectedInput.release.publicationState,
      draft: expectedInput.release.draft,
      immutable: expectedInput.release.immutable,
      latest: expectedInput.release.latest,
      assetSetDigest: expectedInput.release.assetSetDigest,
      docsManifestDigest: expectedInput.release.docsManifestDigest,
      docsBundleDigest: expectedInput.release.docsBundleDigest,
    },
    units: expectedInput.units.map(({ id, artifactVersion, configDigest, outputDigest }) => ({ id, artifactVersion, configDigest, outputDigest })),
  };
  const actual = { identity: observation.identity, release: observation.release, units: observation.units };
  if (stableStringify(actual) !== stableStringify(expected)) throw controlPlaneError("deployment convergence drift", "CONVERGENCE_FAILED");
  const protectedRoutes = options.protectedRoutes;
  if (!Array.isArray(protectedRoutes) || protectedRoutes.length === 0 || new Set(protectedRoutes).size !== protectedRoutes.length
    || !Array.isArray(observation.smoke) || observation.smoke.some((probe) => probe.status !== "passed" || typeof probe.route !== "string")) {
    throw controlPlaneError("protected-route convergence smoke failed", "CONVERGENCE_FAILED");
  }
  const routeCounts = new Map();
  for (const probe of observation.smoke) routeCounts.set(probe.route, (routeCounts.get(probe.route) || 0) + 1);
  if (protectedRoutes.some((route) => routeCounts.get(route) !== 1)) throw controlPlaneError("protected-route convergence smoke inventory drift", "CONVERGENCE_FAILED");
  return { status: "converged", identity: expected.identity, units: expected.units.length };
}

export function verifySoak(record, options = {}) {
  const minimumMs = options.minimumMs ?? 24 * 60 * 60 * 1000;
  const nowMs = Date.parse(options.now || new Date().toISOString());
  const startedMs = Date.parse(record.cutoverSucceededAt);
  if (!Number.isFinite(nowMs) || !Number.isFinite(startedMs) || nowMs < startedMs) throw controlPlaneError("invalid soak timestamps", "SOAK_FAILED");
  const resets = Array.isArray(record.resets) ? record.resets : [];
  const resetTimes = [];
  for (const reset of resets) {
    const observedMs = Date.parse(reset?.observedAt);
    if (!Number.isFinite(observedMs) || observedMs < startedMs || observedMs > nowMs
      || (resetTimes.length > 0 && observedMs <= resetTimes.at(-1))) {
      throw controlPlaneError("soak reset timestamps must be valid, bounded, and strictly ordered", "SOAK_FAILED");
    }
    resetTimes.push(observedMs);
  }
  const effectiveStartMs = resetTimes.at(-1) ?? startedMs;
  if (nowMs - effectiveStartMs < minimumMs) throw controlPlaneError("continuous soak window is shorter than 24 hours", "SOAK_FAILED");
  if (!Array.isArray(record.samples) || record.samples.length < 2) throw controlPlaneError("soak requires at least two samples", "SOAK_FAILED");
  const identity = stableStringify(record.identity);
  const times = [];
  for (const sample of record.samples) {
    const observedMs = Date.parse(sample.observedAt);
    if (!Number.isFinite(observedMs) || observedMs < effectiveStartMs || observedMs > nowMs || sample.status !== "passed" || stableStringify(sample.identity) !== identity) throw controlPlaneError("soak sample drift or failure", "SOAK_FAILED");
    times.push(observedMs);
  }
  if (times.some((time, index) => index > 0 && time <= times[index - 1]) || times[0] !== effectiveStartMs || times.at(-1) !== nowMs) throw controlPlaneError("soak samples must cover the ordered continuous-window boundaries", "SOAK_FAILED");
  return { status: "soak-complete", continuousHours: (nowMs - effectiveStartMs) / 3_600_000, effectiveStart: new Date(effectiveStartMs).toISOString(), resetCount: resets.length };
}
