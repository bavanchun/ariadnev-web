import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(root, "..", "..");
const workerPath = join(repoRoot, "worker.js");
const landingPath = join(repoRoot, "landing.html");
const importAnchor = 'import LANDING_HTML from "./landing.html";';
const exportAnchor = "export default {";

export async function loadLegacyWorker({ fetchImpl, token, landingHtml } = {}) {
  assert.equal(typeof fetchImpl, "function", "loadLegacyWorker requires fetchImpl");

  const [workerSource, landing] = await Promise.all([
    readFile(workerPath, "utf8"),
    landingHtml ? Promise.resolve(landingHtml) : readFile(landingPath, "utf8"),
  ]);

  assert.match(workerSource, /const REPO = "bavanchun\/vcskill";/, "legacy Worker repo anchor changed");
  assert.ok(workerSource.includes(importAnchor), "legacy Worker landing import anchor changed");
  assert.ok(workerSource.includes(exportAnchor), "legacy Worker export anchor changed");

  const rewritten = workerSource
    .replace(importAnchor, `const LANDING_HTML = ${JSON.stringify(landing)};`)
    .replace(exportAnchor, "return {");

  const source = `(async function () {\n${rewritten}\n})()`;
  const context = {
    fetch: fetchImpl,
    URL,
    Request,
    Response,
    Headers,
    ReadableStream,
    TextEncoder,
    TextDecoder,
    console,
  };

  const worker = await vm.runInNewContext(source, context, { filename: "legacy-worker-test-adapter.mjs" });
  assert.equal(typeof worker?.fetch, "function", "legacy Worker fetch handler missing");

  return {
    fetch(request, overrides = {}) {
      const env = { GH_TOKEN: token, ...overrides };
      return worker.fetch(request, env, {});
    },
    sourceAnchors: {
      importAnchor,
      exportAnchor,
    },
  };
}
