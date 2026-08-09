import { parseFlags, readInput, runMain, writeResult } from "./cli-helpers.mjs";
import { controlPlaneError, validateDeploymentInput } from "./control-plane.mjs";
import { verifyProductionPolicyAttestation } from "./production-policy.mjs";

runMain(async () => {
  const flags = parseFlags(process.argv.slice(2), ["input", "input-env"]);
  const input = await readInput(flags);
  await validateDeploymentInput(input, { checkArtifacts: false });
  if (input.environment !== "production") throw controlPlaneError("production input is required", "PRODUCTION_POLICY_FAILED");
  writeResult(await verifyProductionPolicyAttestation(input.productionPolicyAttestation, {
    digest: input.productionPolicyAttestationDigest,
    finalizerRef: input.release.finalizerWorkflowRef,
    finalizerDigest: input.release.finalizerWorkflowDigest,
  }));
});
