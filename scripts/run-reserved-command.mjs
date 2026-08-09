import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";

const commands = Object.freeze({
  qualification: "tests/qualification/run-qualification.mjs",
  "sync-release": "scripts/ingestion/sync-tagged-release.mjs",
});
const name = process.argv[2];
const entrypoint = commands[name];
if (!entrypoint) {
  console.error("usage: run-reserved-command.mjs <qualification|sync-release>");
  process.exit(2);
}
if (!existsSync(resolve(process.cwd(), entrypoint))) {
  console.error(`${name} is reserved but not implemented yet (${entrypoint})`);
  process.exit(1);
}
const child = spawn(process.execPath, [entrypoint, ...process.argv.slice(3)], {
  cwd: process.cwd(),
  stdio: "inherit",
});
child.once("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.once("exit", (code, signal) => {
  process.exitCode = signal ? 1 : (code ?? 1);
});
