// Edge unit tests plus a Phase 1 frozen-contract adapter.
//
// The adapter re-runs the frozen public contract against the extracted edge in
// both deployment shapes: Candidate A (edge-only, no ASSETS binding, site is a
// separate deployment) and Candidate B (combined, ASSETS bound to the site
// fixture). Frozen expectations are never rewritten here — a discovered bad
// expectation returns to Phase 1.

import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { dirname, join, normalize } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import edge, { classifyRoute, isProtected } from "./index.js";
import { SelectorError, parseReleaseSelector, versionFromTag } from "./release-selector.js";
import { assertSafeAssetName } from "./github-release.js";
import { resolveInstallationToken } from "./github-app-auth.js";
import { CACHE_POLICY, SECURITY_HEADERS, applyStaticResponsePolicy } from "./static-response-policy.js";
import { TOKEN_URL, appEnv, createTestAppKey } from "../test/app-auth-harness.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const edgeRoot = join(here, "..");
const repoRoot = join(edgeRoot, "..", "..");
const fixtureRoot = join(edgeRoot, "test", "fixtures", "site-dist");
const contract = JSON.parse(readFileSync(join(repoRoot, "tests/contracts/public-edge-contracts.json"), "utf8"));

const BASE = "https://staging.ariadnev.com";
const TOKEN = "test-token";
const shellInstaller = '#!/usr/bin/env bash\nasset="ariadnev-linux-x64"\n';
const powershellInstaller = '$asset = "ariadnev-windows-x64.exe"\n';
const checksumsBody = [
  "1111111111111111111111111111111111111111111111111111111111111111  ariadnev-darwin-arm64",
  "2222222222222222222222222222222222222222222222222222222222222222  ariadnev-darwin-x64",
  "3333333333333333333333333333333333333333333333333333333333333333  ariadnev-linux-arm64",
  "4444444444444444444444444444444444444444444444444444444444444444  ariadnev-linux-x64",
  "5555555555555555555555555555555555555555555555555555555555555555  ariadnev-windows-x64.exe",
].join("\n");

// ---------------------------------------------------------------- mock upstream

const LATEST_URL = "https://api.github.com/repos/bavanchun/ariadnev-kit/releases/latest";
const TAG_URL = (tag) => `https://api.github.com/repos/bavanchun/ariadnev-kit/releases/tags/${encodeURIComponent(tag)}`;
const ASSET_URL = "https://api.github.com/assets/checksums.txt";
const PINNED_ASSET_URL = "https://api.github.com/assets/checksums-0.10.0.txt";

function releaseBody(tag, assetUrl) {
  return { tag_name: tag, assets: [{ name: "checksums.txt", url: assetUrl }] };
}

function createMockFetch(options = {}) {
  const calls = [];
  const impl = async (input, init = {}) => {
    const url = typeof input === "string" ? input : input.url;
    calls.push({ url, init });

    if (url === LATEST_URL) {
      if (options.latestOk === false) return new Response("upstream release failure", { status: options.latestStatus || 503 });
      return Response.json(releaseBody(options.latestTag || "ariadnev@0.11.0", ASSET_URL));
    }
    if (url === TAG_URL("ariadnev@0.10.0")) {
      if (options.tagOk === false) return new Response("no such release", { status: 404 });
      // `mismatchedTag` simulates a resolver returning another release identity.
      return Response.json(releaseBody(options.mismatchedTag || "ariadnev@0.10.0", PINNED_ASSET_URL));
    }
    if (url.startsWith(TAG_URL("ariadnev@").slice(0, -3))) return new Response("no such release", { status: 404 });
    if (url === ASSET_URL) return new Response(options.assetBody ?? checksumsBody, { status: options.assetStatus || 200 });
    if (url === PINNED_ASSET_URL) return new Response(options.pinnedAssetBody ?? "PINNED_0_10_0_CHECKSUMS", { status: 200 });
    if (url === "https://api.github.com/repos/bavanchun/ariadnev-kit/contents/install.sh?ref=main") {
      return new Response(options.shellBody ?? shellInstaller, { status: options.shellStatus || 200 });
    }
    if (url === "https://api.github.com/repos/bavanchun/ariadnev-kit/contents/install.ps1?ref=main") {
      return new Response(options.powershellBody ?? powershellInstaller, { status: options.powershellStatus || 200 });
    }
    throw new Error(`unexpected upstream fetch: ${url}`);
  };
  impl.calls = calls;
  return impl;
}

// ------------------------------------------------------------- ASSETS fixture

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};

/**
 * Static-assets binding over the site fixture with explicit physical-404
 * behavior. There is no SPA fallback: an unknown path is a real 404.
 */
function createAssetsBinding() {
  const served = [];
  return {
    served,
    async fetch(request) {
      const { pathname } = new URL(request.url);
      served.push(pathname);
      const clean = normalize(pathname).replace(/^(\.\.[/\\])+/, "");
      const candidates = [join(fixtureRoot, clean), join(fixtureRoot, clean, "index.html"), `${join(fixtureRoot, clean)}.html`];
      for (const candidate of candidates) {
        if (!candidate.startsWith(fixtureRoot)) continue;
        let stat;
        try {
          stat = statSync(candidate);
        } catch {
          continue;
        }
        if (!stat.isFile()) continue;
        const ext = candidate.slice(candidate.lastIndexOf("."));
        return new Response(readFileSync(candidate), {
          status: 200,
          headers: { "content-type": CONTENT_TYPES[ext] || "application/octet-stream" },
        });
      }
      return new Response(readFileSync(join(fixtureRoot, "404.html")), {
        status: 404,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    },
  };
}

// ---------------------------------------------------------------- invocation

// Every case below asserts route behavior, not credential acquisition, so the
// installation token is minted once here and served from cache for the rest of
// the file. Upstream call lists therefore contain release traffic only, and an
// unexpected mint would surface as `createMockFetch` throwing.
// Acquisition itself is covered by `github-app-auth.test.mjs`.
const { privateKeyPem } = await createTestAppKey();
const APP_ENV = appEnv(privateKeyPem);
await resolveInstallationToken(APP_ENV, async (url) => {
  assert.equal(url, TOKEN_URL);
  return Response.json({ token: TOKEN, expires_at: new Date(Date.now() + 3_600_000).toISOString() });
});

/** `token: null` models the Worker deployed without its App secrets. */
async function call(path, { method = "GET", token = TOKEN, mock = {}, assets = null, fetchImpl } = {}) {
  const upstream = fetchImpl || createMockFetch(mock);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = upstream;
  try {
    const env = token === null ? {} : { ...APP_ENV };
    if (assets) env.ASSETS = assets;
    const response = await edge.fetch(new Request(`${BASE}${path}`, { method }), env);
    const bodyText = method === "HEAD" || !response.body ? "" : await response.text();
    return { response, status: response.status, bodyText, upstream };
  } finally {
    globalThis.fetch = originalFetch;
  }
}

const header = (result, name) => result.response.headers.get(name);

// ============================================================ selector parsing

test("parseReleaseSelector accepts absent and canonical stable selectors", () => {
  assert.deepEqual(parseReleaseSelector(new URLSearchParams("")), { mode: "latest" });
  assert.deepEqual(parseReleaseSelector(new URLSearchParams("source=landing")), { mode: "latest" });
  assert.deepEqual(parseReleaseSelector(new URLSearchParams("version=0.10.0")), {
    mode: "pinned",
    version: "0.10.0",
    tag: "ariadnev@0.10.0",
  });
  assert.deepEqual(parseReleaseSelector(new URLSearchParams("version=ariadnev@0.10.0")).tag, "ariadnev@0.10.0");
});

/**
 * A beta is installed by naming its exact version — there is no channel concept
 * in the CLI, so this selector is the whole opt-in. It does not make a beta
 * reachable by accident: `/version` answers from the latest release, and a
 * prerelease is never marked latest, so the bare install and bare update paths
 * never arrive here.
 */
test("parseReleaseSelector accepts a beta version, bare or tagged", () => {
  for (const [query, version] of [
    ["version=2.0.0-beta.1", "2.0.0-beta.1"],
    ["version=ariadnev@2.0.0-beta.1", "2.0.0-beta.1"],
    ["version=0.1.0-beta.12", "0.1.0-beta.12"],
    // `changesets pre enter beta` emits `-beta.0` on the first Version PR.
    ["version=1.2.1-beta.0", "1.2.1-beta.0"],
  ]) {
    const selector = parseReleaseSelector(new URLSearchParams(query));
    assert.deepEqual(selector, { mode: "pinned", version, tag: `ariadnev@${version}` });
  }
});

test("parseReleaseSelector rejects every invalid selector shape", () => {
  const cases = [
    ["version=", "empty"],
    ["version=0.10.0&version=0.11.0", "duplicate"],
    ["version=%25300.10.0", "encoded"],
    ["version=0.10", "malformed"],
    ["version=latest", "malformed"],
    ["version=v0.10.0", "malformed"],
    ["version=0.10.0.0", "malformed"],
    ["version=01.2.3", "malformed"],
    // `-beta.N` is selectable now; every other prerelease word is not. These
    // fall through to the shape check rather than a prerelease-specific one,
    // because there is no longer a blanket prerelease rule to hit.
    ["version=1.0.0-rc.1", "malformed"],
    ["version=1.0.0-alpha.1", "malformed"],
    ["version=1.0.0-beta", "malformed"],
    ["version=1.0.0-beta.01", "malformed"],
    ["version=1.0.0-beta.1.2", "malformed"],
    // `+` in a raw query decodes to a space, so the literal build-metadata form
    // must be sent percent-encoded to reach the build-metadata guard.
    ["version=1.0.0%2Bbuild.5", "build-metadata-unsupported"],
    ["version=1.0.0-beta.1%2Bbuild.5", "build-metadata-unsupported"],
    ["version=1.0.0+build.5", "illegal-character"],
    ["version=../../etc/passwd", "illegal-character"],
    [`version=${"9".repeat(40)}`, "too-long"],
  ];
  for (const [query, reason] of cases) {
    assert.throws(
      () => parseReleaseSelector(new URLSearchParams(query)),
      (error) => error instanceof SelectorError && error.reason === reason,
      `${query} must be rejected as ${reason}`,
    );
  }
});

test("versionFromTag normalizes both frozen tag shapes", () => {
  assert.equal(versionFromTag("ariadnev@0.11.0"), "0.11.0");
  assert.equal(versionFromTag("v0.11.0"), "0.11.0");
  assert.equal(versionFromTag(undefined), "");
});

test("assertSafeAssetName rejects traversal, separators, and control characters", () => {
  assert.equal(assertSafeAssetName("checksums.txt"), "checksums.txt");
  assert.equal(assertSafeAssetName("ariadnev-windows-x64.exe"), "ariadnev-windows-x64.exe");
  for (const bad of ["", "..", "../checksums.txt", "a/b", "a\\b", "a b", "a%2Eb", ".hidden", "x".repeat(200)]) {
    assert.throws(() => assertSafeAssetName(bad), SelectorError, `${JSON.stringify(bad)} must be rejected`);
  }
});

// ============================================================ route classification

test("classifyRoute identifies protected routes and preserves lookalikes", () => {
  for (const path of ["/install", "/install.sh", "/install.ps1", "/version", "/download/checksums.txt"]) {
    assert.ok(isProtected(classifyRoute(path)), `${path} must be protected`);
  }
  for (const path of ["/", "/index.html", "/installer", "/versioning", "/download", "/download/", "/install/", "/versions", "/install.sh.txt"]) {
    assert.equal(isProtected(classifyRoute(path)), false, `${path} must stay unprotected`);
  }
});

// ============================================================ frozen contract adapter

/**
 * Map a frozen scenario onto the extracted edge. Unprotected scenarios are the
 * site's responsibility under the new topology, so they are asserted against
 * the deployment shape that actually owns them.
 */
function bodyClassOf(text, method) {
  if (method === "HEAD") return "empty-head";
  if (text.startsWith("#!/usr/bin/env bash")) return "installer-shell";
  if (text.startsWith('$asset = "ariadnev-windows-x64.exe"')) return "installer-powershell";
  if (text === checksumsBody) return "download-stream";
  if (text === contract.globalBehavior.missingSecret.bodyText) return "missing-secret";
  if (text === "release lookup failed") return "release-lookup-failed";
  if (text.startsWith("asset not found: ")) return "asset-not-found";
  if (text === "") return "empty";
  if (text === "0.11.0") return "version-text";
  if (text.includes("ariadnev — install:")) return "plain-install-hint";
  if (text.includes("SITE_FIXTURE")) return "site-fixture-html";
  return "text";
}

const PROTECTED_SCENARIOS = contract.scenarios.filter(
  (scenario) => scenario.mode !== "production-only" && isProtected(classifyRoute(new URL(`${BASE}${scenario.request.path}`).pathname)),
);
const UNPROTECTED_SCENARIOS = contract.scenarios.filter(
  (scenario) => scenario.mode !== "production-only" && !isProtected(classifyRoute(new URL(`${BASE}${scenario.request.path}`).pathname)),
);

async function assertProtectedScenario(scenario, options) {
  const result = await call(scenario.request.path, { method: scenario.request.method, ...options });
  assert.equal(result.status, scenario.expected.status, `${scenario.id} status`);
  for (const [name, expected] of Object.entries(scenario.expected.headers || {})) {
    assert.equal(header(result, name), expected, `${scenario.id} header ${name}`);
  }
  if (scenario.expected.body?.text !== undefined) assert.equal(result.bodyText, scenario.expected.body.text, `${scenario.id} body`);
  if (scenario.expected.body?.class) {
    assert.equal(bodyClassOf(result.bodyText, scenario.request.method), scenario.expected.body.class, `${scenario.id} body class`);
  }
  assert.notEqual(header(result, "content-type"), "text/html; charset=utf-8", `${scenario.id} protected path returned HTML`);
  return result;
}

test("Candidate A edge-only preserves every frozen protected contract", async () => {
  assert.ok(PROTECTED_SCENARIOS.length >= 9, "protected scenario coverage shrank");
  for (const scenario of PROTECTED_SCENARIOS) await assertProtectedScenario(scenario);
});

test("Candidate B combined preserves every frozen protected contract with ASSETS bound", async () => {
  for (const scenario of PROTECTED_SCENARIOS) {
    const assets = createAssetsBinding();
    await assertProtectedScenario(scenario, { assets });
    assert.deepEqual(assets.served, [], `${scenario.id} must never reach ASSETS`);
  }
});

test("edge-only unprotected paths keep the frozen plain-text fallthrough", async () => {
  for (const scenario of UNPROTECTED_SCENARIOS) {
    if (scenario.expected.body?.class === "landing-html") continue; // owned by the site deployment
    const result = await call(scenario.request.path, { method: scenario.request.method });
    assert.equal(result.status, scenario.expected.status, `${scenario.id} status`);
    assert.equal(bodyClassOf(result.bodyText, scenario.request.method), scenario.expected.body.class, `${scenario.id} body class`);
  }
});

test("frozen local mock failure cases are preserved exactly", async () => {
  const cases = contract.localMockCases;
  const failures = [
    ["releaseLookupFailure", { latestOk: false }],
    ["downloadMissingAsset", {}],
    ["versionLookupFailure", { latestOk: false }],
    ["installUpstreamFailure", { shellStatus: 404 }],
    ["powershellUpstreamFailure", { powershellStatus: 500 }],
    ["assetUpstreamFailure", { assetStatus: 503, assetBody: "asset upstream unavailable" }],
  ];
  for (const [id, mock] of failures) {
    const expected = cases[id].expected;
    const result = await call(cases[id].request.path, { method: cases[id].request.method, mock });
    assert.equal(result.status, expected.status, `${id} status`);
    if (expected.bodyText !== undefined) assert.equal(result.bodyText, expected.bodyText, `${id} body`);
    for (const [name, value] of Object.entries(expected.headers || {})) {
      assert.equal(header(result, name), value, `${id} header ${name}`);
    }
  }
});

test("missing secret preserves the frozen host-wide contract in both profiles", async () => {
  const bare = await call("/version", { token: null });
  assert.equal(bare.status, contract.globalBehavior.missingSecret.status);
  assert.equal(bare.bodyText, contract.globalBehavior.missingSecret.bodyText);

  const assets = createAssetsBinding();
  const combined = await call("/", { token: null, assets });
  assert.equal(combined.status, contract.globalBehavior.missingSecret.status);
  assert.equal(combined.bodyText, contract.globalBehavior.missingSecret.bodyText);
  assert.deepEqual(assets.served, [], "missing-secret must not fall through to assets");
});

// ============================================================ selector behavior

test("pinned selector resolves one exact release identity for /version and /download", async () => {
  const version = await call("/version?version=0.10.0");
  assert.equal(version.status, 200);
  assert.equal(version.bodyText, "0.10.0");
  assert.ok(
    version.upstream.calls.every((entry) => !entry.url.endsWith("/releases/latest")),
    "pinned request must not touch the latest endpoint",
  );

  const asset = await call("/download/checksums.txt?version=0.10.0");
  assert.equal(asset.status, 200);
  assert.equal(asset.bodyText, "PINNED_0_10_0_CHECKSUMS");
  assert.equal(header(asset, "content-disposition"), 'attachment; filename="checksums.txt"');
  assert.equal(header(asset, "cache-control"), "no-store");
});

test("pinned selector never falls back and fails closed on mismatch or unknown tag", async () => {
  const mismatch = await call("/version?version=0.10.0", { mock: { mismatchedTag: "ariadnev@0.11.0" } });
  assert.equal(mismatch.status, 400);
  assert.match(mismatch.bodyText, /resolved-release-mismatch/);

  const unknown = await call("/version?version=9.9.9");
  assert.equal(unknown.status, 502);
  assert.equal(unknown.bodyText, "");
});

test("installer routes ignore the selector and stay backward compatible", async () => {
  for (const path of ["/install?version=0.10.0", "/install.sh?version=0.10.0", "/install.ps1?version=0.10.0"]) {
    const result = await call(path);
    assert.equal(result.status, 200, `${path} status`);
    assert.ok(
      result.upstream.calls.every((entry) => entry.url.includes("?ref=main")),
      `${path} must resolve the installer from ref=main only`,
    );
  }
});

test("invalid selectors are bounded client errors with no fallthrough", async () => {
  const assets = createAssetsBinding();
  for (const path of ["/version?version=", "/version?version=latest", "/download/checksums.txt?version=1.0.0-rc.1"]) {
    const result = await call(path, { assets });
    assert.equal(result.status, 400, `${path} status`);
    assert.equal(header(result, "cache-control"), "no-store");
    assert.notEqual(header(result, "content-type"), "text/html; charset=utf-8");
  }
  assert.deepEqual(assets.served, [], "selector errors must never reach ASSETS");
});

test("malformed and unsafe download paths are bounded edge errors", async () => {
  const assets = createAssetsBinding();
  for (const path of ["/download/%E0%A4%A", "/download/%2e%2e%2fchecksums.txt", "/download/nested%2Fpath.txt"]) {
    const result = await call(path, { assets });
    assert.equal(result.status, 400, `${path} status`);
    assert.notEqual(header(result, "content-type"), "text/html; charset=utf-8");
  }
  assert.deepEqual(assets.served, [], "malformed protected paths must never reach ASSETS");
});

test("upstream authorization and signed URLs never reach the client", async () => {
  const result = await call("/download/checksums.txt");
  const serialized = JSON.stringify([...result.response.headers]);
  assert.ok(!serialized.includes("Authorization"), "authorization header leaked");
  assert.ok(!serialized.includes("api.github.com"), "upstream URL leaked");
  assert.ok(!result.bodyText.includes(TOKEN), "token leaked into body");
});

// ============================================================ Candidate B assets

test("colliding static files can never pre-empt a protected route", async () => {
  const collisions = [
    ["/version", "0.11.0"],
    ["/download/checksums.txt", checksumsBody],
    ["/install.sh", shellInstaller],
  ];
  for (const [path, expected] of collisions) {
    const assets = createAssetsBinding();
    const result = await call(path, { assets });
    assert.equal(result.status, 200, `${path} status`);
    assert.equal(result.bodyText, expected, `${path} must come from the edge, not the colliding fixture file`);
    assert.ok(!result.bodyText.includes("SITE_FIXTURE"), `${path} served the colliding static file`);
    assert.deepEqual(assets.served, [], `${path} must not consult ASSETS`);
  }
});

test("only unprotected paths reach ASSETS, and unknown paths are physical 404s", async () => {
  const assets = createAssetsBinding();
  const home = await call("/", { assets });
  assert.equal(home.status, 200);
  assert.match(home.bodyText, /SITE_FIXTURE_HOME/);

  for (const [path, marker] of [
    ["/installer", "SITE_FIXTURE_INSTALLER_LOOKALIKE"],
    ["/versioning", "SITE_FIXTURE_VERSIONING_LOOKALIKE"],
    ["/download", "SITE_FIXTURE_DOWNLOAD_INDEX"],
    ["/install/", "SITE_FIXTURE_INSTALL_DIR_INDEX"],
  ]) {
    const result = await call(path, { assets });
    assert.equal(result.status, 200, `${path} status`);
    assert.match(result.bodyText, new RegExp(marker), `${path} lookalike behavior drifted`);
  }

  const missing = await call("/nope", { assets });
  assert.equal(missing.status, 404);
  assert.match(missing.bodyText, /SITE_FIXTURE_404/, "unknown paths must be physical 404s, not SPA fallback");
  assert.ok(assets.served.includes("/nope"));
});

test("static response policy gives HTML, hashed assets, and 404s the approved headers", async () => {
  const assets = createAssetsBinding();
  const html = await call("/", { assets });
  assert.equal(header(html, "cache-control"), CACHE_POLICY.html);

  const hashed = await call("/_astro/site.abc12345.css", { assets });
  assert.equal(hashed.status, 200);
  assert.equal(header(hashed, "cache-control"), CACHE_POLICY.immutable);

  const notFound = await call("/nope", { assets });
  assert.equal(header(notFound, "cache-control"), CACHE_POLICY.notFound);

  for (const result of [html, hashed, notFound]) {
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      assert.equal(header(result, name), value, `missing ${name}`);
    }
  }
});

test("protected responses keep the edge contract instead of the static policy", async () => {
  const assets = createAssetsBinding();
  const version = await call("/version", { assets });
  assert.equal(header(version, "cache-control"), "no-store");
  assert.equal(version.response.headers.get("x-frame-options"), null, "static policy leaked onto a protected response");
});

test("applyStaticResponsePolicy preserves body and status while replacing cache policy", async () => {
  const source = new Response("body", { status: 200, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "max-age=1" } });
  const policed = applyStaticResponsePolicy(source, "/about");
  assert.equal(policed.status, 200);
  assert.equal(policed.headers.get("cache-control"), CACHE_POLICY.html);
  assert.equal(await policed.text(), "body");
});

// ============================================================ method coverage

test("frozen safe and unsafe method coverage is preserved on protected routes", async () => {
  for (const method of contract.globalBehavior.methodCoverage.productionSafeMethods.concat("POST")) {
    const result = await call("/version", { method });
    assert.equal(result.status, 200, `${method} /version status`);
    if (method !== "HEAD") assert.equal(result.bodyText, "0.11.0", `${method} /version body`);
  }
});
