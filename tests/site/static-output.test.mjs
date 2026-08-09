import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { cp, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { buildSiteOnce, withSiteBuildLock } from "./build-site-once.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const dist = join(root, "apps/site/dist");
const read = (path) => readFileSync(join(root, path), "utf8");

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

before(() => buildSiteOnce(root));

test("static build emits every required physical artifact and no server bundle", () => {
  for (const path of ["index.html", "404.html", "robots.txt", "sitemap-index.xml", "site.webmanifest", "_headers", "social-card.svg"]) {
    assert.ok(existsSync(join(dist, path)), `${path} missing`);
  }
  assert.equal(existsSync(join(dist, "server")), false);
  assert.equal(existsSync(join(dist, "_worker.js")), false);
});

test("built home carries canonical metadata, six sections, one H1, and one enhancer", () => {
  const html = read("apps/site/dist/index.html");
  assert.equal((html.match(/<section\b[^>]*data-site-section/g) || []).length, 6);
  assert.equal((html.match(/<h1\b/g) || []).length, 1);
  assert.equal((html.match(/<script type="module"(?: src="[^"]+")?>/g) || []).length, 1);
  assert.match(html, /<html lang="en">/);
  assert.match(html, /rel="canonical" href="https:\/\/vcskill\.vchun\.dev\/"/);
  assert.match(html, /property="og:image:width" content="1200"/);
  assert.match(html, /property="og:image:height" content="630"/);
  assert.match(html, /name="twitter:card" content="summary_large_image"/);
  assert.match(html, /application\/ld\+json/);
  assert.doesNotMatch(html, /https:\/\/fonts\.|fonts\.googleapis|fetch\s*\(/i);
});

test("robots, sitemap, manifest, headers, and Candidate A config are bounded", () => {
  assert.match(read("apps/site/dist/robots.txt"), /Sitemap: https:\/\/vcskill\.vchun\.dev\/sitemap-index\.xml/);
  assert.match(read("apps/site/dist/sitemap-0.xml"), /https:\/\/vcskill\.vchun\.dev\//);
  const manifest = JSON.parse(read("apps/site/dist/site.webmanifest"));
  assert.equal(manifest.name, "vcskill");
  assert.equal(manifest.start_url, "/");
  const headers = read("apps/site/dist/_headers");
  for (const policy of ["Content-Security-Policy", "Permissions-Policy", "Referrer-Policy", "X-Content-Type-Options", "X-Frame-Options"]) assert.match(headers, new RegExp(policy));
  assert.match(headers, /\/\*[\s\S]*Cache-Control: no-store/);
  assert.match(headers, /\n\/\n\s+! Cache-Control\s+Cache-Control: public, max-age=300/);
  assert.match(headers, /\/_astro\/\*[\s\S]*! Cache-Control[\s\S]*max-age=31536000, immutable/);
  assert.doesNotMatch(headers, /\/404\.html/);
  const wrangler = read("apps/site/wrangler.toml");
  assert.match(wrangler, /name = "vcskill-site-staging"/);
  assert.match(wrangler, /directory = "\.\/dist"/);
  assert.match(wrangler, /not_found_handling = "404-page"/);
  assert.doesNotMatch(wrangler, /account_id|secret|main\s*=/i);
});

test("Candidate A applies exact HTML, hashed-asset, and arbitrary 404 cache policy", { timeout: 30_000 }, async () => {
  const fixture = await mkdtemp(join(tmpdir(), "vcskill-site-headers-"));
  await withSiteBuildLock(root, () => cp(dist, join(fixture, "dist"), { recursive: true }));
  await writeFile(join(fixture, "wrangler.toml"), read("apps/site/wrangler.toml"), "utf8");
  const port = await availablePort();
  const origin = `http://127.0.0.1:${port}`;
  const wrangler = join(root, "node_modules", ".bin", "wrangler");
  const child = spawn(wrangler, ["dev", "--config", join(fixture, "wrangler.toml"), "--local", "--port", String(port), "--env="], {
    cwd: root,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  const append = (chunk) => { output = `${output}${chunk}`.slice(-8_000); };
  child.stdout.on("data", append);
  child.stderr.on("data", append);
  try {
    await waitForWrangler(origin, child, () => output);
    const assetName = readdirSync(join(fixture, "dist", "_astro")).find((name) => name.endsWith(".js"));
    assert.ok(assetName, "built enhancer asset missing");
    const [home, asset, missing] = await Promise.all([
      fetch(`${origin}/`),
      fetch(`${origin}/_astro/${assetName}`),
      fetch(`${origin}/not-a-published-page`),
    ]);
    assert.equal(home.headers.get("cache-control"), "public, max-age=300");
    assert.equal(asset.headers.get("cache-control"), "public, max-age=31536000, immutable");
    assert.equal(missing.status, 404);
    assert.equal(missing.headers.get("cache-control"), "no-store");
    assert.equal(missing.headers.get("x-content-type-options"), "nosniff");
  } finally {
    await stopWrangler(child);
    await rm(fixture, { recursive: true, force: true });
  }
});

test("Astro owns no protected machine route", () => {
  const files = readdirSync(join(root, "apps/site/src/pages"));
  assert.deepEqual(files.sort(), ["404.astro", "index.astro"]);
  const html = read("apps/site/dist/index.html");
  for (const route of ["/install", "/install.sh", "/install.ps1", "/version", "/download/"]) {
    assert.equal(existsSync(join(dist, route.replace(/^\//, ""))), false, `${route} was emitted as a page`);
  }
  assert.match(html, /href="https:\/\/vcskill\.vchun\.dev\/install"/);
});
