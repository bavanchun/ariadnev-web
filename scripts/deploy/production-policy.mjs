import { resolve } from "node:path";

import { controlPlaneError, defaultRepoRoot, sha256, stableStringify, validateSchema } from "./control-plane.mjs";

export const productionPolicySchemaPath = resolve(defaultRepoRoot, "deployment/production-policy-attestation.schema.json");
export const EXACT_PAT_POLICY = Object.freeze({
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
export const FINALIZER_PERMISSIONS = Object.freeze({ actions: "read", contents: "write" });

export function productionPolicyAttestationDigest(attestation) {
  return sha256(stableStringify(attestation));
}

export function verifyCredentialPolicy(policy, exposures = []) {
  if (stableStringify(policy) !== stableStringify(EXACT_PAT_POLICY)) throw controlPlaneError("consolidated credential policy drift", "CREDENTIAL_POLICY_FAILED");
  for (const exposure of exposures) {
    if (!EXACT_PAT_POLICY.allowedContexts.includes(exposure.context)
      || exposure.repository !== EXACT_PAT_POLICY.repository
      || exposure.secretName !== "VCSKILL_CORE_PAT") {
      throw controlPlaneError(`consolidated credential exposure is forbidden: ${exposure.context}`, "CREDENTIAL_POLICY_FAILED");
    }
  }
  return { status: "accepted-constrained-exception", exposureCount: exposures.length };
}

export async function verifyProductionPolicyAttestation(attestation, expected, options = {}) {
  await validateSchema(attestation, options.schemaPath || productionPolicySchemaPath);
  const now = Date.parse(options.now || new Date().toISOString());
  const issued = Date.parse(attestation.issuedAt);
  const expires = Date.parse(attestation.expiresAt);
  const maximumValidityMs = options.maximumValidityMs ?? 24 * 60 * 60 * 1000;
  const requireCurrent = options.requireCurrent !== false;
  if (!Number.isFinite(now) || !Number.isFinite(issued) || !Number.isFinite(expires)
    || expires <= issued || expires - issued > maximumValidityMs
    || (requireCurrent && (issued > now || expires <= now))) {
    throw controlPlaneError("production policy attestation is expired, future-dated, or overlong", "PRODUCTION_POLICY_FAILED");
  }
  if (attestation.finalizer.ref !== expected.finalizerRef || attestation.finalizer.digest !== expected.finalizerDigest) {
    throw controlPlaneError("exact finalizer ref/digest drift", "PRODUCTION_POLICY_FAILED");
  }
  if (stableStringify(attestation.finalizer.permissions) !== stableStringify(FINALIZER_PERMISSIONS)) {
    throw controlPlaneError("core finalizer permission drift", "PRODUCTION_POLICY_FAILED");
  }
  verifyCredentialPolicy(attestation.credentialPolicy, expected.credentialExposures || []);
  const digest = productionPolicyAttestationDigest(attestation);
  if (expected.digest && digest !== expected.digest) throw controlPlaneError("production policy attestation digest drift", "PRODUCTION_POLICY_FAILED");
  return { status: "production-policy-attested", digest, validUntil: attestation.expiresAt };
}
