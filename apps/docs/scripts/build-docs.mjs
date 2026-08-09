import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import { resolve } from "node:path";

const appRoot = resolve(import.meta.dirname, "..");

async function run(command, args) {
  await new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { cwd: appRoot, stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code, signal) => code === 0 && !signal ? resolvePromise() : reject(new Error(`${command} ${args.join(" ")} failed`)));
  });
}

await access(resolve(appRoot, "content/generated/catalog.json")).catch(() => {
  throw new Error("Phase 8 docs content is required for a full docs build; use the temporary contract build in tests for Phase 7 validation");
});
await run("pnpm", ["exec", "fumadocs-mdx", "source.config.ts", ".source"]);
await run("pnpm", ["exec", "next", "build", "--webpack"]);
await run(process.execPath, ["--experimental-strip-types", "scripts/set-static-document-language.mjs"]);
await run(process.execPath, ["--experimental-strip-types", "scripts/build-search-index.mjs"]);
await run(process.execPath, ["--experimental-strip-types", "scripts/export-static-discovery.mjs"]);
await run(process.execPath, ["--experimental-strip-types", "scripts/verify-static-budget.mjs"]);
