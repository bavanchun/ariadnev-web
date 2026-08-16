// Tests for the standing public-edge probe.
//
// The probe exists to catch a credential that died between deployments, so the
// cases that matter are the ones where the host still answers but the
// install path no longer works.

import assert from "node:assert/strict";
import test from "node:test";

import {
  checkChecksums,
  checkDocsEntry,
  checkInstaller,
  probePublicEdge,
  resolveProbeTargets,
} from "../../scripts/deploy/probe-public-edge.mjs";

const BASE = "https://ariadnev.com";
const DOCS = "https://docs.ariadnev.com";
const VERSION = "1.0.0";

const CHECKSUMS = [
  "1111111111111111111111111111111111111111111111111111111111111111  ariadnev-darwin-arm64",
  "2222222222222222222222222222222222222222222222222222222222222222  ariadnev-linux-x64",
].join("\n");

const html = (body) => new Response(body, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });

function createMockFetch(overrides = {}) {
  const responses = {
    [`${BASE}/version`]: () => new Response(VERSION),
    [`${BASE}/version?version=${VERSION}`]: () => new Response(VERSION),
    [`${BASE}/install`]: () => new Response("#!/usr/bin/env bash\n"),
    [`${BASE}/download/checksums.txt`]: () => new Response(CHECKSUMS),
    [`${DOCS}/en/stable/`]: () => html("<!doctype html><title>ariadnev</title>"),
    ...overrides,
  };
  return async (url) => {
    const respond = responses[url];
    if (!respond) throw new Error(`unexpected probe fetch: ${url}`);
    return respond();
  };
}

const probe = (overrides) =>
  probePublicEdge({ baseUrl: BASE, docsBaseUrl: DOCS, version: VERSION, fetchImpl: createMockFetch(overrides) });

const checkNamed = (result, name) => result.checks.find((check) => check.check === name);

test("a fully healthy edge passes every check", async () => {
  const result = await probe();
  assert.equal(result.healthy, true);
  assert.deepEqual(
    result.checks.map((check) => check.check),
    ["release-version", "pinned-selector", "installer", "checksums", "docs-entry"],
  );
});

test("an expired credential is caught on the routes that need it", async () => {
  // What a dead credential actually looks like: the contents passthrough
  // returns GitHub's 401 verbatim, and the release routes fail closed as 502.
  const dead = await probe({
    [`${BASE}/install`]: () => new Response('{"message":"Bad credentials"}', { status: 401 }),
    [`${BASE}/version`]: () => new Response("edge request failed\n", { status: 502 }),
    [`${BASE}/download/checksums.txt`]: () => new Response("edge request failed\n", { status: 502 }),
  });

  assert.equal(dead.healthy, false);
  assert.equal(checkNamed(dead, "installer").pass, false);
  assert.equal(checkNamed(dead, "release-version").pass, false);
  assert.equal(checkNamed(dead, "checksums").pass, false);
  // Static docs need no credential and must still report healthy, so the
  // failure is attributable rather than a blanket "site down".
  assert.equal(checkNamed(dead, "docs-entry").pass, true);
});

test("a 200 that is not actually the installer fails", async () => {
  // The fallthrough case: a route stops being protected and the site's HTML
  // is served under /install with a perfectly healthy status code.
  const result = await checkInstaller(BASE, createMockFetch({ [`${BASE}/install`]: () => html("<!doctype html>") }));
  assert.equal(result.pass, false);
  assert.equal(result.status, 200);
});

test("a truncated or non-checksum download fails", async () => {
  for (const body of ["", "not a checksum file\n", "abc  ariadnev-linux-x64\n"]) {
    const result = await checkChecksums(BASE, createMockFetch({ [`${BASE}/download/checksums.txt`]: () => new Response(body) }));
    assert.equal(result.pass, false, `${JSON.stringify(body)} must not pass`);
  }
});

test("a stale release version and an unreachable docs entry are both reported", async () => {
  const stale = await probe({ [`${BASE}/version`]: () => new Response("0.12.0") });
  assert.equal(stale.healthy, false);
  assert.equal(checkNamed(stale, "release-version").observed, "0.12.0");

  const docsDown = await checkDocsEntry(DOCS, createMockFetch({ [`${DOCS}/en/stable/`]: () => new Response("nope", { status: 522 }) }));
  assert.equal(docsDown.pass, false);
  assert.equal(docsDown.status, 522);
});

test("probe targets come from the committed topology and release pin", () => {
  const production = resolveProbeTargets("production");
  assert.equal(production.baseUrl, "https://ariadnev.com");
  assert.equal(production.docsBaseUrl, "https://docs.ariadnev.com");
  assert.match(production.version, /^\d+\.\d+\.\d+$/);

  assert.equal(resolveProbeTargets("staging").baseUrl, "https://staging.ariadnev.com");
  assert.throws(() => resolveProbeTargets("nowhere"), /unknown environment/);
});
