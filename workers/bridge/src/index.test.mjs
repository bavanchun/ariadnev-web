// Bridge Worker unit tests.
//
// The bridge is an interim unit: it serves `ariadnev.com` so `ariadnev@1.0.0`
// installs work, without redeploying the frozen legacy Worker. These tests pin
// the four ways it deliberately differs from legacy (repo, tag prefix, in-Worker
// asset validation, ariadnev branding) and the response contract clients depend
// on.
//
// The traversal cases are driven from the edge ingress policy's own `mustBlock`
// and `mustAllow` lists so the bridge cannot drift from the guard the zone rule
// was written to enforce.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import bridge, { REPO, versionFromReleaseTag } from "./index.js";
import { assertSafeAssetName } from "../../edge/src/github-release.js";

const here = dirname(fileURLToPath(import.meta.url));
const bridgeRoot = join(here, "..");
const repoRoot = join(bridgeRoot, "..", "..");
const guard = JSON.parse(
  readFileSync(join(repoRoot, "workers/edge/rules/raw-download-path-guard.json"), "utf8"),
);

const BASE = "https://ariadnev.com";
const TOKEN = "test-token";

// The ingress policy predates the rename, so its asset names are still
// `vcskill-*`. Only the product prefix changes; the traversal shapes under test
// do not.
const rebrand = (path) => path.replace(/vcskill-/g, "ariadnev-");

const shellInstaller = '#!/usr/bin/env bash\nBASE="${ARIADNEV_BASE_URL:-https://ariadnev.com}"\n';
const powershellInstaller = '$Base = "https://ariadnev.com"\n';
const checksumsBody = "1111111111111111111111111111111111111111111111111111111111111111  ariadnev-darwin-arm64\n";

// ---------------------------------------------------------------- mock upstream

const LATEST_URL = `https://api.github.com/repos/${REPO}/releases/latest`;
const CONTENTS_URL = (file) => `https://api.github.com/repos/${REPO}/contents/${file}?ref=main`;
const assetUrl = (name) => `https://api.github.com/assets/${name}`;

// Every asset name reachable from the policy's `mustAllow` list, so an allowed
// request resolves rather than 404ing for an unrelated reason.
const RELEASE_ASSETS = [
  "checksums.txt",
  "ariadnev-darwin-arm64",
  "ariadnev-windows-x64.exe",
  "docs-bundle.tar.gz",
  "manifest.json.sha256",
];

function createMockFetch(options = {}) {
  const calls = [];
  const impl = async (input, init = {}) => {
    const url = typeof input === "string" ? input : input.url;
    calls.push({ url, init });

    if (url === LATEST_URL) {
      if (options.latestOk === false) return new Response("upstream failure", { status: options.latestStatus || 503 });
      return Response.json({
        tag_name: options.latestTag || "ariadnev@1.0.0",
        assets: RELEASE_ASSETS.map((name) => ({ name, url: assetUrl(name) })),
      });
    }
    if (url === CONTENTS_URL("install.sh")) {
      return new Response(options.shellBody ?? shellInstaller, { status: options.shellStatus || 200 });
    }
    if (url === CONTENTS_URL("install.ps1")) {
      return new Response(options.powershellBody ?? powershellInstaller, { status: options.powershellStatus || 200 });
    }
    if (url.startsWith("https://api.github.com/assets/")) {
      return new Response(checksumsBody, { status: options.assetStatus || 200 });
    }
    throw new Error(`unexpected upstream fetch: ${url}`);
  };
  impl.calls = calls;
  return impl;
}

async function call(path, { method = "GET", token = TOKEN, mock = {} } = {}) {
  const upstream = createMockFetch(mock);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = upstream;
  try {
    // `token: null` models the secret being genuinely absent from `env`.
    const env = token === null ? {} : { GH_TOKEN: token };
    const response = await bridge.fetch(new Request(`${BASE}${path}`, { method }), env);
    const bodyText = response.body ? await response.text() : "";
    return { response, status: response.status, bodyText, upstream };
  } finally {
    globalThis.fetch = originalFetch;
  }
}

const header = (result, name) => result.response.headers.get(name);

// ================================================================ repo identity

test("every GitHub URL targets ariadnev-kit, never the renamed vcskill repo", async () => {
  assert.equal(REPO, "bavanchun/ariadnev-kit");

  const source = readFileSync(join(here, "index.js"), "utf8");
  assert.ok(!source.includes("bavanchun/vcskill"), "bridge source must not reference the pre-rename repo");

  for (const path of ["/install", "/install.sh", "/install.ps1", "/version", "/download/checksums.txt"]) {
    const result = await call(path);
    assert.ok(result.upstream.calls.length > 0, `${path} must reach upstream`);
    for (const { url } of result.upstream.calls) {
      assert.ok(
        !url.includes("bavanchun/vcskill"),
        `${path} requested ${url}, which relies on GitHub's rename redirect`,
      );
    }
  }
});

// ================================================================ version strip

test("versionFromReleaseTag strips the ariadnev tag prefix, not the legacy one", () => {
  assert.equal(versionFromReleaseTag("ariadnev@1.0.0"), "1.0.0");
  assert.equal(versionFromReleaseTag("v1.0.0"), "1.0.0");
  assert.equal(versionFromReleaseTag("1.0.0"), "1.0.0");
  // No tag in this repo carries the legacy prefix, so it is not special-cased —
  // a `vcskill@` tag would fall through to the generic `^v` strip. Pinned here so
  // the omission stays deliberate rather than becoming a silent surprise.
  assert.equal(versionFromReleaseTag("vcskill@0.11.0"), "cskill@0.11.0");
  assert.equal(versionFromReleaseTag(undefined), "");
});

test("/version serves the stripped tag as plain text with no caching", async () => {
  const result = await call("/version");
  assert.equal(result.status, 200);
  assert.equal(result.bodyText, "1.0.0");
  assert.equal(header(result, "content-type"), "text/plain");
  assert.equal(header(result, "cache-control"), "no-store");
});

test("/version reports 502 when the release lookup fails", async () => {
  const result = await call("/version", { mock: { latestOk: false } });
  assert.equal(result.status, 502);
});

// ================================================================== route table

test("installer routes proxy the repo contents API at ref=main", async () => {
  const shell = await call("/install");
  assert.equal(shell.status, 200);
  assert.equal(shell.bodyText, shellInstaller);
  assert.equal(header(shell, "content-type"), "text/x-shellscript; charset=utf-8");
  assert.equal(shell.upstream.calls[0].url, CONTENTS_URL("install.sh"));

  const alias = await call("/install.sh");
  assert.equal(alias.upstream.calls[0].url, CONTENTS_URL("install.sh"));

  const powershell = await call("/install.ps1");
  assert.equal(powershell.status, 200);
  assert.equal(powershell.bodyText, powershellInstaller);
  assert.equal(header(powershell, "content-type"), "text/plain; charset=utf-8");
  assert.equal(powershell.upstream.calls[0].url, CONTENTS_URL("install.ps1"));
});

test("an upstream installer failure never reaches the client as a shell script", async () => {
  // The body would be piped straight into bash. An expired PAT must not deliver
  // GitHub's `{"message":"Bad credentials"}` JSON as text/x-shellscript.
  const result = await call("/install", {
    mock: { shellStatus: 401, shellBody: '{"message":"Bad credentials","documentation_url":"https://docs.github.com/rest"}' },
  });

  assert.equal(result.status, 502, "a 401 must not masquerade as a client error");
  assert.equal(header(result, "content-type"), "text/plain; charset=utf-8");
  assert.equal(result.bodyText, "installer unavailable: install.sh\n");
  assert.ok(!result.bodyText.includes("Bad credentials"), "upstream error detail must not leak");

  // A genuine upstream 5xx keeps its status so clients can tell broken from gone.
  const upstreamDown = await call("/install", { mock: { shellStatus: 503, shellBody: "upstream down" } });
  assert.equal(upstreamDown.status, 503);
  assert.ok(!upstreamDown.bodyText.includes("upstream down"));
});

test("a failed asset download never reaches the client as octet-stream", async () => {
  // Storage-layer XML written to disk as a "binary" is worse than a clean error.
  const result = await call("/download/checksums.txt", { mock: { assetStatus: 403 } });

  assert.equal(result.status, 502);
  assert.equal(header(result, "content-type"), "text/plain; charset=utf-8");
  assert.equal(result.bodyText, "asset download failed: checksums.txt\n");
});

test("/download serves the release asset as an attachment", async () => {
  const result = await call("/download/checksums.txt");
  assert.equal(result.status, 200);
  assert.equal(result.bodyText, checksumsBody);
  assert.equal(header(result, "content-type"), "application/octet-stream");
  assert.equal(header(result, "content-disposition"), 'attachment; filename="checksums.txt"');
  assert.equal(header(result, "cache-control"), "no-store");
});

test("/download reports 404 for an asset absent from the release", async () => {
  const result = await call("/download/ariadnev-linux-riscv64");
  assert.equal(result.status, 404);
});

test("/download reports 502 when the release lookup fails", async () => {
  const result = await call("/download/checksums.txt", { mock: { latestOk: false } });
  assert.equal(result.status, 502);
});

// ================================================================ branding

test("/ serves an ariadnev holding page naming the canonical install command", async () => {
  const result = await call("/");
  assert.equal(result.status, 200);
  assert.match(header(result, "content-type"), /text\/html/);
  assert.match(result.bodyText, /ariadnev/);
  assert.match(result.bodyText, /https:\/\/ariadnev\.com\/install/);
  assert.ok(!result.bodyText.includes("vcskill.vchun.dev"), "holding page must not advertise the legacy host");

  const indexHtml = await call("/index.html");
  assert.equal(indexHtml.status, 200);
});

test("unknown paths 404 with the ariadnev install hint", async () => {
  const result = await call("/nope");
  assert.equal(result.status, 404);
  assert.match(result.bodyText, /https:\/\/ariadnev\.com\/install/);
  assert.ok(!result.bodyText.includes("vcskill"), "404 body must not name the old product");
});

// ================================================================ misconfiguration

test("every route fails closed with 500 when GH_TOKEN is unset", async () => {
  for (const path of ["/install", "/install.sh", "/install.ps1", "/version", "/download/checksums.txt", "/", "/nope"]) {
    const result = await call(path, { token: null });
    assert.equal(result.status, 500, `${path} must fail closed without a token`);
    assert.equal(result.bodyText, "worker misconfigured: GH_TOKEN unset");
  }
});

// ================================================================ traversal guard

// `ariadnev.com` has no zone ingress rule, so in-Worker validation is the only
// guard. It is not equivalent to the zone rule, and this table records exactly
// where the two differ.
//
// Cloudflare — and the WHATWG URL parser these tests exercise — collapse literal
// RFC 3986 dot segments before any handler reads the path. Three of the policy's
// `mustBlock` entries therefore cannot reach the Worker in traversal form at
// all: `/download/./checksums.txt` and `/download/nested/../checksums.txt`
// arrive already normalized to `/download/checksums.txt`, which is itself a
// `mustAllow` entry. No in-Worker check can distinguish them, which is precisely
// why the policy's own rationale calls for a zone-level control *in addition to*
// `assertSafeAssetName()`.
//
// What the Worker must — and does — reject is the percent-encoded family, which
// survives normalization intact and would otherwise escape the flat-basename
// asset namespace.
const BLOCK_EXPECTATIONS = {
  "/download/../secrets.txt": { status: 404, reason: "normalized to /secrets.txt, an unprotected path" },
  "/download/./checksums.txt": { status: 200, reason: "normalized to the allowed /download/checksums.txt" },
  "/download/nested/../checksums.txt": { status: 200, reason: "normalized to the allowed /download/checksums.txt" },
  "/download/%2e%2e%2fchecksums.txt": { status: 400, reason: "survives normalization; rejected in-Worker" },
  "/download/%2E%2E/checksums.txt": { status: 404, reason: "normalized to /checksums.txt, an unprotected path" },
  "/download/sub%2Fchecksums.txt": { status: 400, reason: "survives normalization; rejected in-Worker" },
  "/download/..": { status: 200, reason: "normalized to /, the holding page" },
  "/download/.": { status: 404, reason: "normalized to bare /download/, which is not an asset route" },
};

// Named for what it actually pins. Five of the eight policy paths are *not*
// blocked by the bridge — they are neutralized by normalization into a harmless
// request — so a name promising "every mustBlock path is rejected" would be
// coverage theater. The load-bearing rejection tests are the two below this one.
test("each mustBlock path resolves to its measured, harmless outcome", async () => {
  assert.deepEqual(
    Object.keys(BLOCK_EXPECTATIONS).sort(),
    [...guard.mustBlock].sort(),
    "expectation table must cover exactly the policy's mustBlock list",
  );

  for (const path of guard.mustBlock) {
    const expected = BLOCK_EXPECTATIONS[path];
    const result = await call(path);
    assert.equal(result.status, expected.status, `${path}: ${expected.reason}`);

    // The invariant that actually matters: whatever the status, the bridge never
    // attaches a filename that escapes the flat release-asset namespace.
    const disposition = header(result, "content-disposition");
    if (disposition) {
      const filename = disposition.match(/filename="(.*)"$/)[1];
      assert.doesNotThrow(() => assertSafeAssetName(filename), `${path} served unsafe filename ${filename}`);
    }
  }
});

test("percent-encoded traversal is rejected before any upstream call", async () => {
  for (const path of ["/download/%2e%2e%2fchecksums.txt", "/download/sub%2Fchecksums.txt"]) {
    const result = await call(path);
    assert.equal(result.status, 400);
    assert.equal(result.upstream.calls.length, 0, `${path} must not reach GitHub`);
  }
});

// The policy list was written for the zone rule and stops at the shapes that
// rule can express. The in-Worker guard covers strictly more, so these vectors
// are pinned here rather than left implied — most importantly the CRLF case,
// which would otherwise be a `content-disposition` header injection.
test("hostile asset names beyond the policy list are rejected in-Worker", async () => {
  const vectors = [
    ["/download/%252e%252e%252fchecksums.txt", "asset-double-encoded"],
    ["/download/..%2fchecksums.txt", "asset-path-separator"],
    ["/download/%2e%2e%5cchecksums.txt", "asset-path-separator"],
    ["/download/checksums%00.txt", "asset-control-character"],
    ["/download/a%0d%0aX-Injected:%20yes", "asset-control-character"],
    // Invalid percent sequences survive URL parsing but throw in decodeURIComponent.
    ["/download/%c0%ae%c0%ae", "malformed-encoding"],
    ["/download/.hidden", "asset-name-charset"],
  ];

  for (const [path, reason] of vectors) {
    const result = await call(path);
    assert.equal(result.status, 400, `${path} must be a bounded client error`);
    assert.equal(result.bodyText, `bad request: ${reason}\n`, `${path} must be rejected as ${reason}`);
    assert.equal(result.upstream.calls.length, 0, `${path} must not reach GitHub`);
  }
});

test("every mustAllow path is accepted, proving decode happens before validation", async () => {
  for (const raw of guard.mustAllow) {
    const path = rebrand(raw);
    const result = await call(path);
    assert.notEqual(result.status, 400, `${path} must not be rejected as a bad request`);

    if (path.startsWith("/download/")) {
      // `/download/checksums%2Etxt` is the load-bearing case: `assertSafeAssetName`
      // rejects any residual `%xx` as `asset-double-encoded`, so this only passes
      // if the bridge decodes the segment *before* validating it. A validate-first
      // implementation would over-block and break checksum verification for any
      // client that percent-encodes.
      assert.equal(result.status, 200, `${path} must resolve to a release asset`);
      assert.equal(
        header(result, "content-disposition"),
        `attachment; filename="${decodeURIComponent(path.slice("/download/".length))}"`,
      );
    }
  }
});
