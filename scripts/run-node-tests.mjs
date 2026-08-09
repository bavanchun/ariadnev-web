import { spawn } from "node:child_process";
import { lstat, readdir } from "node:fs/promises";
import { relative, resolve } from "node:path";
import process from "node:process";

const TEST_FILE = /\.test\.(?:mjs|js)$/;
const SKIP_DIRECTORIES = new Set([".astro", ".git", ".next", ".source", "coverage", "dist", "node_modules", "out"]);

async function collect(path, files) {
  const stat = await lstat(path).catch(() => null);
  if (!stat || stat.isSymbolicLink()) return;
  if (stat.isFile()) {
    if (TEST_FILE.test(path)) files.push(path);
    return;
  }
  if (!stat.isDirectory()) return;
  const entries = await readdir(path, { withFileTypes: true });
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    if (entry.isDirectory() && SKIP_DIRECTORIES.has(entry.name)) continue;
    await collect(resolve(path, entry.name), files);
  }
}

const roots = process.argv.slice(2);
const requested = roots.length > 0 ? roots : ["landing-consistency.test.mjs", "tests", "workers/edge/test"];
const files = [];
for (const root of requested) await collect(resolve(process.cwd(), root), files);
files.sort((left, right) => left.localeCompare(right));

if (files.length === 0) {
  console.log("No matching Node test files in requested paths.");
  process.exit(0);
}

const child = spawn(process.execPath, ["--test", ...files.map((file) => relative(process.cwd(), file))], {
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
