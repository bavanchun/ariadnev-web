import { spawnSync } from "node:child_process";
import process from "node:process";

for (const [command, args] of [
  [process.execPath, ["scripts/run-node-tests.mjs", "landing-consistency.test.mjs", "tests", "workers/edge/test"]],
  ["pnpm", ["exec", "vitest", "run"]],
]) {
  const result = spawnSync(command, args, { cwd: process.cwd(), stdio: "inherit" });
  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
}
