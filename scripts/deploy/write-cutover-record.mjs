import { createCutoverRecord } from "./evidence.mjs";
import { parseFlags, readInput, runMain, writeResult } from "./cli-helpers.mjs";

runMain(async () => {
  const flags = parseFlags(process.argv.slice(2), ["input", "input-env", "previous", "previous-env"]);
  const source = await readInput(flags);
  const previousRecord = flags.previous || flags["previous-env"] ? await readInput(flags, "previous") : undefined;
  writeResult(await createCutoverRecord(source, { previousRecord }));
});
