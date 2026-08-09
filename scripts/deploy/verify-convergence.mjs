import { parseFlags, readInput, runMain, writeResult } from "./cli-helpers.mjs";
import { validateDeploymentInput } from "./control-plane.mjs";
import { verifyConvergence } from "./evidence.mjs";

runMain(async () => {
  const flags = parseFlags(process.argv.slice(2), ["input", "input-env", "observation", "observation-env"]);
  const input = await readInput(flags);
  const { topology } = await validateDeploymentInput(input, { checkArtifacts: false });
  writeResult(verifyConvergence(input, await readInput(flags, "observation"), { protectedRoutes: topology.protectedRoutes }));
});
