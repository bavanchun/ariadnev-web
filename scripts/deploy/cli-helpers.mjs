import { lstat, readFile } from "node:fs/promises";
import { resolve, sep } from "node:path";

import { controlPlaneError, defaultRepoRoot } from "./control-plane.mjs";

const MAX_JSON_INPUT_BYTES = 1024 * 1024;

export function parseFlags(argv, allowed) {
  const values = {};
  for (const arg of argv) {
    if (arg === "--dry-run" || arg === "--first-cutover") values[arg.slice(2)] = true;
    else if (arg.startsWith("--") && arg.includes("=")) {
      const index = arg.indexOf("=");
      values[arg.slice(2, index)] = arg.slice(index + 1);
    } else throw controlPlaneError(`unsupported argument: ${arg}`, "INVALID_ARGUMENTS");
  }
  for (const key of Object.keys(values)) if (!allowed.includes(key)) throw controlPlaneError(`unsupported argument: --${key}`, "INVALID_ARGUMENTS");
  return values;
}

export async function readInput(flags, name = "input") {
  const path = flags[name];
  const envName = flags[`${name}-env`];
  if ((path ? 1 : 0) + (envName ? 1 : 0) !== 1) throw controlPlaneError(`exactly one --${name}=PATH or --${name}-env=NAME is required`, "INVALID_ARGUMENTS");
  let raw;
  if (path) {
    const absolute = resolve(defaultRepoRoot, path);
    if (absolute !== defaultRepoRoot && !absolute.startsWith(`${defaultRepoRoot}${sep}`)) throw controlPlaneError(`${name} path escapes repository root`, "INVALID_ARGUMENTS");
    const stat = await lstat(absolute).catch(() => null);
    if (!stat?.isFile() || stat.isSymbolicLink() || stat.size < 2 || stat.size > MAX_JSON_INPUT_BYTES) throw controlPlaneError(`${name} file is absent, unsafe, or over limit`, "INVALID_ARGUMENTS");
    raw = await readFile(absolute, "utf8");
  } else raw = Reflect.get(process, "env")[envName];
  if (raw && Buffer.byteLength(raw) > MAX_JSON_INPUT_BYTES) throw controlPlaneError(`${name} input exceeds the byte limit`, "INVALID_ARGUMENTS");
  if (!raw) throw controlPlaneError(`input source is empty: ${name}`, "INVALID_ARGUMENTS");
  try { return JSON.parse(raw); } catch { throw controlPlaneError(`${name} must contain valid JSON`, "INVALID_ARGUMENTS"); }
}

export async function readSecretFromStdin() {
  if (process.stdin.isTTY) return undefined;
  let value = "";
  for await (const chunk of process.stdin) value += chunk;
  value = value.trim();
  if (!value) return undefined;
  if (value.length < 20 || value.length > 4096 || /\s/.test(value)) throw controlPlaneError("invalid secret input", "INVALID_SECRET_INPUT");
  return value;
}

export function writeResult(value) { process.stdout.write(`${JSON.stringify(value)}\n`); }
export function runMain(main) {
  main().catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
}
