import { parseFlags, readInput, runMain, writeResult } from "./cli-helpers.mjs";
import { verifySoak } from "./evidence.mjs";

runMain(async () => {
  const flags = parseFlags(process.argv.slice(2), ["input", "input-env", "now"]);
  writeResult(verifySoak(await readInput(flags), { now: flags.now }));
});
