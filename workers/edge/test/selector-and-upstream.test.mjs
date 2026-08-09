import test from "node:test";

import { fetchReleaseAssetStream, getReleaseMetadata } from "../src/github-release.js";
import { parseReleaseSelector } from "../src/release-selector.js";
import { assert, checksumsBody, createMockFetch, createRelease, invokeEdge } from "./edge-test-helpers.mjs";

test("selector allows exact semver and rejects encoded key or value spellings", () => {
  const valid = new URL("https://edge.test/version?version=1.2.3");
  assert.deepEqual(parseReleaseSelector(valid.searchParams, valid.search), { mode: "pinned", version: "1.2.3", tag: "vcskill@1.2.3" });
  const invalid = [
    "?version=", "?version=01.2.3", "?version=1.2.3-rc.1", "?version=1.2.3+build",
    "?version=1.2.3&version=1.2.3", "?vers%69on=1.2.3", "?%76ersion=1.2.3",
    "?version=1%2E2.3", "?version=%31.2.3", "?version=1.2.3%00",
  ];
  for (const search of invalid) {
    const url = new URL(`https://edge.test/version${search}`);
    assert.throws(() => parseReleaseSelector(url.searchParams, url.search), /version selector/);
  }
});

test("version upstream failures have an exact empty body and selector errors stay bounded", async () => {
  const failed = await invokeEdge("/version", { mock: { latestStatus: 503 } });
  assert.equal(failed.response.status, 502);
  assert.equal(failed.body, "");
  const invalid = await invokeEdge("/version?vers%69on=1.2.3");
  assert.equal(invalid.response.status, 400);
  assert.equal(invalid.body, "");
});

test("release metadata count and bytes are bounded", async () => {
  await assert.rejects(getReleaseMetadata({
    fetchImpl: createMockFetch({ latestRelease: createRelease("vcskill@1.2.3", Array.from({ length: 201 }, (_, index) => `asset-${index}`)) }),
    token: "secret",
    selector: { mode: "latest" },
  }), /metadata invalid/);
  const oversized = createMockFetch({ latestRelease: { tag_name: "vcskill@1.2.3", assets: [], padding: "x".repeat(1_000_000) } });
  await assert.rejects(getReleaseMetadata({ fetchImpl: oversized, token: "secret", selector: { mode: "latest" } }), /too large/);
});

test("asset redirects accept approved HTTPS storage only and never forward authorization", async () => {
  for (const target of ["http://objects.githubusercontent.com/file", "https://evil.example/file"]) {
    await assert.rejects(fetchReleaseAssetStream({
      fetchImpl: createMockFetch({ redirectLocation: target }), token: "secret", assetName: "checksums.txt", selector: { mode: "latest" },
    }), /redirect origin/);
  }
  const fetchImpl = createMockFetch({ redirectLocation: "https://objects.githubusercontent.com/release/file" });
  const response = await fetchReleaseAssetStream({ fetchImpl, token: "secret", assetName: "checksums.txt", selector: { mode: "latest" } });
  assert.equal(await response.text(), checksumsBody);
  const storageCall = fetchImpl.calls.find((call) => call.url.startsWith("https://objects.githubusercontent.com/"));
  assert.equal(Object.hasOwn(storageCall.init.headers, "Authorization"), false);
});

test("download stream remains unbuffered and pinned release identity is exact", async () => {
  const stream = new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode("one-")); controller.enqueue(new TextEncoder().encode("two")); controller.close(); } });
  const result = await invokeEdge("/download/checksums.txt?version=1.2.3", { mock: { assetBody: stream }, readBody: false });
  assert.ok(result.response.body instanceof ReadableStream);
  assert.equal(await result.response.text(), "one-two");
  const taggedCall = result.fetchImpl.calls.find((call) => call.url.includes("/releases/tags/"));
  assert.ok(taggedCall.url.endsWith("/releases/tags/vcskill@1.2.3"));
  assert.equal(taggedCall.init.redirect, "manual");
});

test("the shared upstream deadline stops at response headers and never aborts a healthy stream body", async () => {
  const encoder = new TextEncoder();
  const fetchImpl = async (input, init = {}) => {
    const url = String(input);
    if (url.endsWith("/releases/latest")) return Response.json(createRelease("vcskill@0.11.0", ["checksums.txt"]));
    if (url.includes("/releases/assets/")) {
      return new Response(new ReadableStream({
        start(controller) {
          init.signal.addEventListener("abort", () => controller.error(new Error("body aborted")), { once: true });
          setTimeout(() => {
            controller.enqueue(encoder.encode("slow-but-healthy"));
            controller.close();
          }, 20);
        },
      }));
    }
    throw new Error(`unexpected URL: ${url}`);
  };

  const response = await fetchReleaseAssetStream({
    fetchImpl,
    token: "synthetic-test-token",
    assetName: "checksums.txt",
    selector: { mode: "latest" },
    timeoutMs: 5,
  });
  assert.equal(await response.text(), "slow-but-healthy");
});

test("terminal asset errors preserve status but never expose the upstream body", async () => {
  const result = await invokeEdge("/download/checksums.txt", {
    mock: { assetStatus: 401, assetBody: "credential rejected at https://private.example/path" },
  });
  assert.equal(result.response.status, 401);
  assert.equal(result.body, "asset upstream unavailable");
  assert.equal(result.body.includes("https://"), false);
  assert.equal(result.response.headers.get("cache-control"), "no-store");
});

test("installer errors retain the frozen status and headers with a bounded body", async () => {
  const result = await invokeEdge("/install", {
    mock: { shellStatus: 401, shellBody: "credential rejected at https://private.example/path" },
  });
  assert.equal(result.response.status, 401);
  assert.equal(result.body, "installer upstream unavailable");
  assert.equal(result.response.headers.get("content-type"), "text/x-shellscript; charset=utf-8");
  assert.equal(result.response.headers.get("cache-control"), "no-store");
});

test("GitHub API subrequests use manual redirect handling in the edge runtime", async () => {
  const result = await invokeEdge("/install");
  const installerCall = result.fetchImpl.calls.find((call) => call.url.includes("/contents/install.sh"));
  assert.equal(installerCall.init.redirect, "manual");
});
