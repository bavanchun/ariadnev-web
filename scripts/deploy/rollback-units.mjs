import { parseFlags, readInput, readSecretFromStdin, runMain, writeResult } from "./cli-helpers.mjs";
import { rollbackUnits, validateDeploymentInput } from "./control-plane.mjs";

runMain(async () => {
  const flags = parseFlags(process.argv.slice(2), ["input", "input-env", "dry-run", "first-cutover"]);
  const input = await readInput(flags);
  const { topology } = await validateDeploymentInput(input, { checkArtifacts: false });
  writeResult(await rollbackUnits({ input, topology, dryRun: flags["dry-run"] === true, firstCutover: flags["first-cutover"] === true, cloudflareToken: flags["dry-run"] ? undefined : await readSecretFromStdin() }));
});
