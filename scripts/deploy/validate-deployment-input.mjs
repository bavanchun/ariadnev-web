import { parseFlags, readInput, runMain, writeResult } from "./cli-helpers.mjs";
import { validateDeploymentInput } from "./control-plane.mjs";

runMain(async () => {
  const flags = parseFlags(process.argv.slice(2), ["input", "input-env", "skip-artifacts"]);
  const input = await readInput(flags);
  const result = await validateDeploymentInput(input, { checkArtifacts: flags["skip-artifacts"] !== "true" });
  writeResult({ status: "valid", environment: input.environment, topologyId: input.topologyId, productSha: input.product.sha, qualificationEvidenceSha: input.qualification.evidenceSha, unitCount: input.units.length, topologyDigest: result.topologyDigest });
});
