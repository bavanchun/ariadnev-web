import { parseFlags, readInput, readSecretFromStdin, runMain, writeResult } from "./cli-helpers.mjs";
import { deployUnits, validateDeploymentInput } from "./control-plane.mjs";

runMain(async () => {
  const flags = parseFlags(process.argv.slice(2), ["input", "input-env", "dry-run"]);
  const input = await readInput(flags);
  const { topology } = await validateDeploymentInput(input, { checkArtifacts: false });
  const result = await deployUnits({ input, topology, dryRun: flags["dry-run"] === true, cloudflareToken: flags["dry-run"] ? undefined : await readSecretFromStdin() });
  writeResult(result);
});
