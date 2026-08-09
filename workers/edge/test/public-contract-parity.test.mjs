import test from "node:test";

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import siteFixture from "../src/site-fixture.js";
import { assert, contract, createAssetsBinding, invokeEdge, invokeLegacy, repoRoot, selectedHeaders } from "./edge-test-helpers.mjs";

test("extracted worker preserves every frozen Phase 1 scenario, method, response, and stream contract", async () => {
  for (const scenario of contract.scenarios) {
    const [legacy, edge] = await Promise.all([
      invokeLegacy(scenario),
      invokeEdge(scenario.request.path, { method: scenario.request.method }),
    ]);
    assert.equal(edge.response.status, legacy.response.status, `${scenario.id} status`);
    assert.deepEqual(selectedHeaders(edge.response), selectedHeaders(legacy.response), `${scenario.id} headers`);
    assert.equal(edge.body, legacy.body, `${scenario.id} body`);
  }
});

test("extracted worker preserves all frozen upstream error responses", async () => {
  const cases = [
    [contract.localMockCases.releaseLookupFailure, { latestStatus: 503 }],
    [contract.localMockCases.downloadMissingAsset, {}],
    [contract.localMockCases.versionLookupFailure, { latestStatus: 503 }],
    [contract.localMockCases.installUpstreamFailure, { shellStatus: 404, shellBody: "missing" }],
    [contract.localMockCases.powershellUpstreamFailure, { powershellStatus: 500, powershellBody: "failed" }],
    [contract.localMockCases.assetUpstreamFailure, { assetStatus: 503, assetBody: "asset upstream unavailable" }],
  ];
  for (const [scenario, mock] of cases) {
    const result = await invokeEdge(scenario.request.path, { method: scenario.request.method, mock });
    assert.equal(result.response.status, scenario.expected.status);
    if (scenario.expected.bodyText !== undefined) assert.equal(result.body, scenario.expected.bodyText);
    for (const [name, value] of Object.entries(scenario.expected.headers || {})) assert.equal(result.response.headers.get(name), value);
  }
});

test("combined topology preserves the legacy global missing-secret response", async () => {
  for (const path of ["/", "/installer", "/version", "/download/checksums.txt"]) {
    const { response, body } = await invokeEdge(path, { token: undefined, topology: "combined", assets: createAssetsBinding() });
    assert.equal(response.status, contract.globalBehavior.missingSecret.status);
    assert.equal(body, contract.globalBehavior.missingSecret.bodyText);
  }
});

test("Candidate A preserves the missing-secret error only on protected routes", async () => {
  const site = { fetch: async () => new Response("site") };
  for (const path of ["/install", "/version", "/download/checksums.txt"]) {
    const { response, body } = await invokeEdge(path, { token: undefined, site });
    assert.equal(response.status, contract.globalBehavior.missingSecret.status);
    assert.equal(body, contract.globalBehavior.missingSecret.bodyText);
  }
  const lookalike = await invokeEdge("/installer", { token: undefined, site });
  assert.equal(lookalike.response.status, 200);
  assert.equal(lookalike.body, "site");
});

test("download namespace failures are bounded and never fall through while lookalikes remain site routes", async () => {
  const assets = createAssetsBinding();
  for (const path of ["/download/", "/download/a/b", "/download/a%2Fb", "/download/%E0%A4%A", "/download/%2e%2e%2fsecret"]) {
    const { response } = await invokeEdge(path, { assets });
    assert.equal(response.status, 400, path);
  }
  assert.deepEqual(assets.calls, []);
  for (const path of ["/download", "/download-page"]) {
    const { response } = await invokeEdge(path, { assets });
    assert.equal(response.status, 200, path);
  }
  assert.deepEqual(assets.calls, ["/download", "/download-page"]);
});

test("Candidate A uses a non-recursive SITE binding and rejects direct preview hosts", async () => {
  const calls = [];
  const site = { fetch: async (request) => { calls.push(new URL(request.url).pathname); return new Response("site"); } };
  const fallback = await invokeEdge("/installer", { site });
  assert.equal(fallback.body, "site");
  assert.deepEqual(calls, ["/installer"]);
  const preview = await invokeEdge("/version", { origin: "https://preview.workers.dev", allowedHosts: "staging.vcskill.vchun.dev" });
  assert.equal(preview.response.status, 421);
  assert.equal(preview.response.headers.get("x-robots-tag"), "noindex");
  for (const origin of ["https://staging.vcskill.vchun.dev:8443", "http://staging.vcskill.vchun.dev"]) {
    const nonCanonical = await invokeEdge("/version", { origin, allowedHosts: "staging.vcskill.vchun.dev" });
    assert.equal(nonCanonical.response.status, 421, origin);
  }
});

test("Candidate A site fixture exposes collisions only behind its canonical host", async () => {
  const assets = createAssetsBinding();
  const collision = await siteFixture.fetch(new Request("https://staging.vcskill.vchun.dev/version"), {
    ALLOWED_HOSTS: "staging.vcskill.vchun.dev",
    ASSETS: assets,
  });
  assert.equal(await collision.text(), "LEAK");
  assert.equal(collision.headers.get("cache-control"), "public, max-age=300");

  const preview = await siteFixture.fetch(new Request("https://preview.workers.dev/version"), {
    ALLOWED_HOSTS: "staging.vcskill.vchun.dev",
    ASSETS: assets,
  });
  assert.equal(preview.status, 421);
  assert.deepEqual(assets.calls, ["/version"]);
});

test("Candidate B protects collisions and applies the same bounded static response policy", async () => {
  const assets = createAssetsBinding();
  const protectedResult = await invokeEdge("/version", { assets, topology: "combined" });
  assert.equal(protectedResult.body, "0.11.0");
  assert.deepEqual(assets.calls, []);
  const missing = await invokeEdge("/missing", { assets, topology: "combined" });
  assert.equal(missing.response.status, 404);
  assert.equal(missing.response.headers.get("cache-control"), "no-store");
  assert.equal(missing.response.headers.get("x-content-type-options"), "nosniff");
});

test("Candidate A SITE and Candidate B ASSETS match HTML, hashed asset, and 404 response policy", async () => {
  const assets = createAssetsBinding();
  const policyHeaders = ["cache-control", "x-content-type-options", "referrer-policy", "x-frame-options"];
  const site = {
    async fetch(request) {
      const path = new URL(request.url).pathname;
      const status = path === "/missing" ? 404 : 200;
      const headers = new Headers({
        "cache-control": status === 404 ? "no-store" : path.includes("abc123") ? "public, max-age=31536000, immutable" : "public, max-age=300",
        "content-type": path === "/" ? "text/html; charset=utf-8" : "text/plain",
        "x-content-type-options": "nosniff", "referrer-policy": "strict-origin-when-cross-origin", "x-frame-options": "DENY",
      });
      return new Response("site", { status, headers });
    },
  };
  for (const path of ["/", "/assets/app-abc123.js", "/missing"]) {
    const [candidateA, candidateB] = await Promise.all([invokeEdge(path, { site }), invokeEdge(path, { assets, topology: "combined" })]);
    for (const name of policyHeaders) assert.equal(candidateB.response.headers.get(name), candidateA.response.headers.get(name), `${path} ${name}`);
  }
});

test("all Wrangler profiles disable previews and declare coherent topology bindings", async () => {
  const edge = await readFile(join(repoRoot, "workers/edge/wrangler.edge.toml"), "utf8");
  const combined = await readFile(join(repoRoot, "workers/edge/wrangler.combined.toml"), "utf8");
  const spike = await readFile(join(repoRoot, "workers/edge/wrangler.spike.toml"), "utf8");
  const site = await readFile(join(repoRoot, "workers/edge/wrangler.site-spike.toml"), "utf8");
  const edgeUnbound = await readFile(join(repoRoot, "workers/edge/wrangler.edge-unbound-spike.toml"), "utf8");
  const productionCombined = await readFile(join(repoRoot, "workers/edge/wrangler.combined.production.toml"), "utf8");
  for (const source of [edge, combined, spike, site]) {
    assert.match(source, /workers_dev = false/);
    assert.match(source, /preview_urls = false/);
    assert.match(source, /ALLOWED_HOSTS = /);
    assert.ok(source.indexOf("routes = [") < source.indexOf("[vars]"), "routes must remain in top-level TOML scope");
  }
  assert.match(edge, /binding = "SITE"/);
  assert.match(edge, /service = "vcskill-site-staging"/);
  assert.doesNotMatch(edge, /environment = /);
  assert.match(edgeUnbound, /name = "vcskill-edge-staging"/);
  assert.match(edgeUnbound, /binding = "SITE"/);
  assert.match(edgeUnbound, /routes = \[\]/);
  assert.match(site, /custom_domain = true/);
  assert.match(combined, /custom_domain = true/);
  assert.match(combined, /ALLOWED_HOSTS = "staging\.vcskill\.vchun\.dev"/);
  assert.doesNotMatch(combined, /ALLOWED_HOSTS = "[^"]*vcskill\.vchun\.dev,/);
  for (const pattern of ["install\\*", "install\\.ps1\\*", "version\\*", "download\\/\\*"]) {
    assert.match(combined, new RegExp(`staging\\.vcskill\\.vchun\\.dev/${pattern}`));
  }
  for (const source of [combined, spike]) {
    assert.match(source, /binding = "ASSETS"/);
    assert.match(source, /run_worker_first = true/);
    assert.match(source, /not_found_handling = "none"/);
    assert.match(source, /TOPOLOGY_MODE = "combined"/);
  }
  assert.match(combined, /directory = "\.\.\/\.\.\/apps\/site\/dist"/);
  assert.doesNotMatch(combined, /test\/fixtures/);
  assert.match(spike, /directory = "\.\/test\/fixtures\/site-dist"/);
  assert.match(site, /binding = "ASSETS"/);
  assert.match(site, /run_worker_first = true/);
  assert.match(site, /not_found_handling = "none"/);
  assert.match(productionCombined, /name = "vcskill-edge-combined-production"/);
  assert.doesNotMatch(productionCombined, /name = "vcskill"/);
  assert.match(productionCombined, /ALLOWED_HOSTS = "vcskill\.vchun\.dev"/);
  assert.doesNotMatch(productionCombined, /staging\.vcskill\.vchun\.dev/);
  assert.match(productionCombined, /directory = "\.\.\/\.\.\/apps\/site\/dist"/);
  assert.doesNotMatch(productionCombined, /test\/fixtures/);
  assert.match(productionCombined, /run_worker_first = true/);
  assert.match(productionCombined, /not_found_handling = "none"/);
});
