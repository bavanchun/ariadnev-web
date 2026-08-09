import { spawnSync } from "node:child_process";
import process from "node:process";

const command = process.argv[2];
const packageOrder = command === "build" || command === "typecheck"
  ? ["@vcskill/contracts", "@vcskill/tokens", "@vcskill/site", "@vcskill/docs"]
  : null;

if (!packageOrder) {
  console.error("usage: run-workspace-command.mjs <build|typecheck>");
  process.exit(2);
}

for (const packageName of packageOrder) {
  const result = spawnSync("pnpm", ["--filter", packageName, "run", command], {
    cwd: process.cwd(),
    stdio: "inherit",
  });
  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
}
