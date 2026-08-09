import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const owners = Object.freeze({
  contracts: { packageName: "@vcskill/contracts", ready: "packages/contracts/src/docs-bundle-manifest.ts" },
  docs: { packageName: "@vcskill/docs", ready: "apps/docs/next.config.mjs" },
  site: { packageName: "@vcskill/site", ready: "apps/site/astro.config.mjs" },
  tokens: { packageName: "@vcskill/tokens", ready: "packages/tokens/scripts/build-tokens.mjs" },
});
const allowedCommands = new Set(["build", "check", "test", "typecheck"]);

const [ownerName, command] = process.argv.slice(2);
const owner = owners[ownerName];
if (!owner || !allowedCommands.has(command)) {
  console.error("usage: run-owner-command.mjs <contracts|docs|site|tokens> <build|check|test|typecheck>");
  process.exit(2);
}

if (!existsSync(resolve(workspaceRoot, owner.ready))) {
  console.log(`${owner.packageName} ${command} pending its owner implementation (${owner.ready})`);
  process.exit(0);
}

const child = spawn("pnpm", ["--filter", owner.packageName, "run", `${command}:owner`], {
  cwd: workspaceRoot,
  stdio: "inherit",
});
child.once("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.once("exit", (code, signal) => {
  process.exitCode = signal ? 1 : (code ?? 1);
});
