import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const docsApp = join(repositoryRoot, "apps/docs");

async function availablePort() {
  const server = createServer();
  await new Promise((resolvePromise, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolvePromise);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("could not reserve a local port");
  await new Promise((resolvePromise, reject) => server.close((error) => error ? reject(error) : resolvePromise()));
  return address.port;
}

async function waitForWrangler(origin, child, logs) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Wrangler exited before readiness\n${logs()}`);
    try {
      const response = await fetch(origin);
      if (response.status === 200) return;
    } catch {}
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
  }
  throw new Error(`Wrangler did not become ready\n${logs()}`);
}

async function stopWrangler(child) {
  if (child.exitCode !== null) return;
  child.kill("SIGTERM");
  await new Promise((resolvePromise) => {
    const timer = setTimeout(() => {
      if (child.exitCode === null) child.kill("SIGKILL");
    }, 5_000);
    child.once("exit", () => {
      clearTimeout(timer);
      resolvePromise();
    });
  });
}

async function writeFixture(root) {
  const out = join(root, "out");
  const files = new Map([
    ["index.html", "<!doctype html><html><body>docs</body></html>"],
    ["en/stable/index.html", "<!doctype html><html><body>stable docs</body></html>"],
    ["en/stable.md", "# Stable docs\n"],
    ["search/en/stable.json", "{}\n"],
    ["llms.txt", "# ariadnev docs\n"],
    ["llms-full.txt", "# ariadnev docs full\n"],
    ["_next/static/chunk-abc123.js", "globalThis.__ariadnevDocsAsset = true;\n"],
    ["404.html", "<!doctype html><html><body>not found</body></html>"],
  ]);
  for (const [path, body] of files) {
    const target = join(out, path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, body, "utf8");
  }
  await cp(join(docsApp, "public/_headers"), join(out, "_headers"));
  await cp(join(docsApp, "wrangler.staging.toml"), join(root, "wrangler.toml"));
}

function assertSecurityHeaders(response) {
  assert.match(response.headers.get("content-security-policy") ?? "", /default-src 'self'/);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.equal(response.headers.get("referrer-policy"), "strict-origin-when-cross-origin");
}

test("Wrangler applies docs security, cache, and content-type policy to deployed assets", { timeout: 30_000 }, async () => {
  const fixture = await mkdtemp(join(tmpdir(), "ariadnev-docs-headers-"));
  await writeFixture(fixture);
  const port = await availablePort();
  const origin = `http://127.0.0.1:${port}`;
  const wrangler = join(docsApp, "node_modules", ".bin", "wrangler");
  const child = spawn(wrangler, ["dev", "--config", join(fixture, "wrangler.toml"), "--local", "--port", String(port)], {
    cwd: repositoryRoot,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  const append = (chunk) => { output = `${output}${chunk}`.slice(-8_000); };
  child.stdout.on("data", append);
  child.stderr.on("data", append);
  try {
    await waitForWrangler(origin, child, () => output);
    const responses = await Promise.all([
      fetch(`${origin}/en/stable/`),
      fetch(`${origin}/en/stable.md`),
      fetch(`${origin}/search/en/stable.json`),
      fetch(`${origin}/llms.txt`),
      fetch(`${origin}/llms-full.txt`),
      fetch(`${origin}/_next/static/chunk-abc123.js`),
      fetch(`${origin}/not-a-published-page`),
    ]);
    const [html, markdown, search, llms, llmsFull, asset, missing] = responses;
    for (const response of responses) assertSecurityHeaders(response);
    for (const response of [html, markdown, search, llms, llmsFull, missing]) {
      assert.equal(response.headers.get("cache-control"), "public, max-age=0, must-revalidate");
    }
    assert.equal(html.status, 200);
    assert.match(html.headers.get("content-type") ?? "", /^text\/html\b/);
    assert.equal(markdown.headers.get("content-type"), "text/markdown; charset=utf-8");
    assert.equal(search.headers.get("content-type"), "application/json; charset=utf-8");
    assert.equal(llms.headers.get("content-type"), "text/plain; charset=utf-8");
    assert.equal(llmsFull.headers.get("content-type"), "text/plain; charset=utf-8");
    assert.equal(asset.headers.get("cache-control"), "public, max-age=31536000, immutable");
    assert.match(asset.headers.get("content-type") ?? "", /javascript/);
    assert.equal(missing.status, 404);
    assert.match(missing.headers.get("content-type") ?? "", /^text\/html\b/);
  } finally {
    await stopWrangler(child);
    await rm(fixture, { recursive: true, force: true });
  }
});
