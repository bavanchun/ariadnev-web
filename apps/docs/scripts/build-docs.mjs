import { spawn } from "node:child_process";
import { copyFile, realpath, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { loadDocsContentCatalog } from "../src/lib/content-catalog.ts";
import { DOCS_CONTENT_ROOT_ENV, resolveDocsContentRoot } from "../src/lib/docs-content-root.ts";

const appRoot = resolve(import.meta.dirname, "..");

function requestedContentRoot(args) {
  let value;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument !== "--content-root") throw new Error(`unsupported docs build argument: ${argument}`);
    if (value !== undefined || !args[index + 1] || args[index + 1].startsWith("--")) throw new Error("--content-root requires one explicit path");
    value = args[index + 1];
    index += 1;
  }
  return value;
}

const requestedRoot = requestedContentRoot(process.argv.slice(2));
// With no explicit root (flag or ARIADNEV_DOCS_CONTENT_ROOT) this is a product
// build: generate the content root from the pinned release bundle first, so the
// docs can never be built from stale generated files.
let releaseManifestPath;
if (requestedRoot === undefined && !process.env[DOCS_CONTENT_ROOT_ENV]) {
  const { buildContentRoot, parseArguments } = await import("../../../scripts/docs-content/build-content-root.mjs");
  const result = buildContentRoot(parseArguments([]));
  releaseManifestPath = result.manifestPath;
  process.stdout.write(`docs content root: ${result.pageCount} pages for ${result.catalog.currentStable} (previous ${result.catalog.previousStable})\n`);
}
const unresolvedContentRoot = requestedRoot === undefined ? resolveDocsContentRoot(appRoot) : resolve(requestedRoot);
const contentRoot = await realpath(unresolvedContentRoot).catch(() => { throw new Error("docs content root does not exist"); });
if (!(await stat(contentRoot)).isDirectory()) throw new Error("docs content root must be a directory");
const catalogPath = resolve(contentRoot, "generated/catalog.json");
await loadDocsContentCatalog(catalogPath, contentRoot);
const childEnvironment = { ...process.env, [DOCS_CONTENT_ROOT_ENV]: contentRoot };

async function run(command, args) {
  await new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { cwd: appRoot, env: childEnvironment, stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code, signal) => code === 0 && !signal ? resolvePromise() : reject(new Error(`${command} ${args.join(" ")} failed`)));
  });
}

await run("pnpm", ["exec", "fumadocs-mdx", "source.config.ts", ".source"]);
await run("pnpm", ["exec", "next", "build", "--webpack"]);
await run(process.execPath, ["--experimental-strip-types", "scripts/set-static-document-language.mjs"]);
await run(process.execPath, ["--experimental-strip-types", "scripts/build-search-index.mjs"]);
await run(process.execPath, ["--experimental-strip-types", "scripts/export-static-discovery.mjs"]);
await run(process.execPath, ["--experimental-strip-types", "scripts/verify-static-budget.mjs"]);
// A product build serves the detached release manifest verbatim at
// /docs-bundle.manifest.json; scripts/deploy/verify-convergence.mjs compares
// its digest with the deployment input, which is how a deploy proves the docs
// it published came from the release it claims.
if (releaseManifestPath) await copyFile(releaseManifestPath, resolve(appRoot, "out", "docs-bundle.manifest.json"));
