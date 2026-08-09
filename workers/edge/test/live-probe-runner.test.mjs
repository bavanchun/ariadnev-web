import test from "node:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { rawDownloadPathNeedsIngressBlock } from "../../../scripts/edge-ingress-policy.mjs";
import { ingressPolicyDigest, loadIngressPolicy } from "../../../scripts/edge-ingress-policy.mjs";
import {
  collectLiveCandidateBProbes,
  runExternalCommand,
  writeLiveReprobeArtifact,
} from "../../../scripts/verify-edge-routing-spike.mjs";
import { validateLiveReprobeRecord } from "../../../scripts/edge-evidence-policy.mjs";
import { assert, repoRoot } from "./edge-test-helpers.mjs";

function responseFor(path, overrides = {}) {
  const isIngress = rawDownloadPathNeedsIngressBlock(path);
  const isDownload = path.startsWith("/download/") && !isIngress;
  const isMissing = path === "/not-found";
  const isLookalike = path === "/installer";
  const headers = new Map([["cf-ray", "a1b2c3d4e5f60708-SIN"]]);
  if (!isIngress) headers.set("cache-control", isLookalike ? "public, max-age=300" : "no-store");
  if (isDownload) {
    headers.set("content-type", "application/octet-stream");
    headers.set("content-disposition", "attachment; filename=\"checksums.txt\"");
  } else if (!isIngress && !isMissing && !isLookalike) {
    headers.set("content-type", "text/plain");
  }
  const body = isIngress
    ? "<!doctype html><title>Access denied</title>"
    : isDownload
      ? `${"a".repeat(64)}  vcskill-darwin-arm64.tar.gz\n`
      : isMissing
        ? ""
        : isLookalike
          ? "fixture lookalike"
          : "0.11.0";
  return {
    status: isIngress ? 403 : isMissing ? 404 : 200,
    headers,
    body: Buffer.from(body),
    ...overrides,
  };
}

const ingressDigest = ingressPolicyDigest(await loadIngressPolicy(), "staging");

function currentIngressCheck(counter = null) {
  return async () => {
    if (counter) counter.count += 1;
    return {
      status: "current",
      ref: "vcskill_raw_download_dot_segments_staging",
      policyDigest: ingressDigest,
      position: 1,
    };
  };
}

test("live Candidate B re-probe performs HTTP-derived checks instead of manufacturing passing cells", async () => {
  const calls = [];
  const ingressChecks = { count: 0 };
  const versionChecks = { count: 0 };
  const result = await collectLiveCandidateBProbes({
    baseUrl: "https://staging.vcskill.vchun.dev",
    version: "0.11.0",
    probe: async (_baseUrl, path) => {
      calls.push(path);
      return responseFor(path);
    },
    resolveVersion: async () => {
      versionChecks.count += 1;
      return "12345678-1234-1234-1234-123456789abc";
    },
    checkIngressRule: currentIngressCheck(ingressChecks),
  });
  assert.equal(calls.length, 16);
  assert.equal(result.cells.length, 16);
  assert.equal(result.cells.every((cell) => cell.pass === true), true);
  assert.deepEqual([...new Set(result.cells.map((cell) => cell.repetition))], [1, 2]);
  assert.equal(result.cells.some((cell) => cell.requestPath.includes("0.11.0")), false);
  assert.equal(ingressChecks.count, 2);
  assert.equal(versionChecks.count, 2);
  assert.match(result.ingressGuard.policyDigest, /^[0-9a-f]{64}$/);
  assert.equal(result.ingressGuard.status, "current");
  assert.equal(result.cells.every((cell) => /^[0-9a-f]{64}$/.test(cell.cfRaySha256)), true);
  assert.equal(result.workerVersionId, "12345678-1234-1234-1234-123456789abc");
  assert.equal(validateLiveReprobeRecord(result), result);
});

test("live Candidate B re-probe records a failing observation when the network result drifts", async () => {
  const result = await collectLiveCandidateBProbes({
    baseUrl: "https://staging.vcskill.vchun.dev",
    version: "0.11.0",
    probe: async (_baseUrl, path) => path === "/version" ? responseFor(path, { status: 502 }) : responseFor(path),
    resolveVersion: async () => "12345678-1234-1234-1234-123456789abc",
    checkIngressRule: currentIngressCheck(),
  });
  assert.equal(result.cells.find((cell) => cell.id === "current-version").pass, false);
});

test("live Candidate B re-probe derives semantic classes and rejects HTML or missing Cloudflare provenance", async () => {
  for (const override of [
    { path: "/version", value: { headers: new Map([["cache-control", "no-store"], ["content-type", "text/html"], ["cf-ray", "a1b2c3d4e5f60708-SIN"]]), body: Buffer.from("<!doctype html><title>site</title>") } },
    { path: "/not-found", value: { headers: new Map([["cache-control", "no-store"], ["content-type", "text/html"], ["cf-ray", "a1b2c3d4e5f60708-SIN"]]), body: Buffer.from("<!doctype html><title>missing</title>") } },
    { path: "/installer", value: { headers: new Map([["cache-control", "public, max-age=300"]]) } },
    { path: "/installer", value: { headers: new Map([["cache-control", "public, max-age=300"], ["cf-ray", ""]]) } },
  ]) {
    const result = await collectLiveCandidateBProbes({
      baseUrl: "https://staging.vcskill.vchun.dev",
      version: "0.11.0",
      probe: async (_baseUrl, path) => path === override.path ? responseFor(path, override.value) : responseFor(path),
      resolveVersion: async () => "12345678-1234-1234-1234-123456789abc",
      checkIngressRule: currentIngressCheck(),
    });
    assert.equal(result.cells.find((cell) => cell.requestPath === override.path)?.pass, false);
  }
});

test("live Candidate B re-probe refuses a stale or unverified ingress rule", async () => {
  await assert.rejects(
    collectLiveCandidateBProbes({
      baseUrl: "https://staging.vcskill.vchun.dev",
      version: "0.11.0",
      probe: async (_baseUrl, path) => responseFor(path),
      resolveVersion: async () => "12345678-1234-1234-1234-123456789abc",
      checkIngressRule: async () => ({ status: "stale", ref: "vcskill_raw_download_dot_segments_staging", policyDigest: ingressDigest, position: 1 }),
    }),
    /not current/,
  );
});

test("live Candidate B re-probe rejects ingress drift after the HTTP observations", async () => {
  let checks = 0;
  await assert.rejects(
    collectLiveCandidateBProbes({
      baseUrl: "https://staging.vcskill.vchun.dev",
      version: "0.11.0",
      probe: async (_baseUrl, path) => responseFor(path),
      resolveVersion: async () => "12345678-1234-1234-1234-123456789abc",
      checkIngressRule: async () => {
        checks += 1;
        return {
          status: checks === 1 ? "current" : "stale",
          ref: "vcskill_raw_download_dot_segments_staging",
          policyDigest: ingressDigest,
          position: 1,
        };
      },
    }),
    /not current/,
  );
  assert.equal(checks, 2);
});

test("live Candidate B re-probe rejects a Worker version change during observations", async () => {
  let checks = 0;
  await assert.rejects(
    collectLiveCandidateBProbes({
      baseUrl: "https://staging.vcskill.vchun.dev",
      version: "0.11.0",
      probe: async (_baseUrl, path) => responseFor(path),
      resolveVersion: async () => {
        checks += 1;
        return checks === 1
          ? "12345678-1234-1234-1234-123456789abc"
          : "87654321-4321-4321-4321-cba987654321";
      },
      checkIngressRule: currentIngressCheck(),
    }),
    /version changed/,
  );
  assert.equal(checks, 2);
});

test("live re-probe writer atomically persists only schema-valid source-bound evidence", async () => {
  const result = await collectLiveCandidateBProbes({
    baseUrl: "https://staging.vcskill.vchun.dev",
    version: "0.11.0",
    probe: async (_baseUrl, path) => responseFor(path),
    resolveVersion: async () => "12345678-1234-1234-1234-123456789abc",
    checkIngressRule: currentIngressCheck(),
  });
  const directory = await mkdtemp(resolve(tmpdir(), "vcskill-reprobe-test-"));
  const path = resolve(directory, "edge-routing-reprobe.json");
  try {
    await writeLiveReprobeArtifact(path, result);
    assert.deepEqual(JSON.parse(await readFile(path, "utf8")), result);
    const invalid = structuredClone(result);
    invalid.cells[0].cfRayPresent = false;
    await assert.rejects(writeLiveReprobeArtifact(path, invalid), /complete passing/);
    assert.deepEqual(JSON.parse(await readFile(path, "utf8")), result);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("external command failures never reflect stderr", async () => {
  const credential = ["cf", "ut_", "synthetic-value-that-must-not-escape"].join("");
  await assert.rejects(
    runExternalCommand(process.execPath, ["-e", `process.stderr.write(${JSON.stringify(credential)}); process.exit(7)`]),
    (error) => error.message === `external command failed: ${process.execPath}; exit=7` && !error.message.includes(credential),
  );
});

test("re-probe write flags fail closed outside authenticated live-probe mode", async () => {
  const scriptPath = resolve(repoRoot, "scripts/verify-edge-routing-spike.mjs");
  for (const args of [
    ["--write-reprobe"],
    ["--probe-live", "--write-reprobe"],
  ]) {
    await assert.rejects(
      runExternalCommand(process.execPath, [scriptPath, ...args]),
      new RegExp(`external command failed: .*; exit=1`),
    );
  }
});
