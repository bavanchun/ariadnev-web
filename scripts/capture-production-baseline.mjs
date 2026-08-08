import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import vm from "node:vm";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(scriptDir, "..");
const baselineRoot = join(repoRoot, "tests", "baselines");
const projectTimeZone = "Asia/Ho_Chi_Minh";
const defaultBaseUrl = "https://vcskill.vchun.dev";
const approvedProductionOrigin = "https://vcskill.vchun.dev";
const safeMethods = new Set(["GET", "HEAD", "OPTIONS"]);
const maxPreviewChars = 240;
const maxResponseBytes = 1_048_576;
const requestTimeoutMs = 15_000;

function localDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: projectTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export function validateOutputDate(value) {
  assert.match(value, /^\d{4}-\d{2}-\d{2}$/, "output date must be YYYY-MM-DD");
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  assert.equal(parsed.toISOString().slice(0, 10), value, "output date must be a real calendar date");
  return value;
}

export function parseArgs(argv, now = new Date()) {
  const options = {
    baseUrl: defaultBaseUrl,
    outputDate: localDate(now),
    observedAtUtc: now.toISOString(),
    allowLocal: false,
    requireBrowserEvidence: true,
  };
  for (const arg of argv) {
    if (arg.startsWith("--base-url=")) options.baseUrl = arg.slice(11);
    else if (arg.startsWith("--output-date=")) options.outputDate = arg.slice(14);
    else if (arg.startsWith("--observed-at=")) options.observedAtUtc = arg.slice(14);
    else if (arg === "--allow-local") options.allowLocal = true;
    else if (arg === "--require-browser-evidence") options.requireBrowserEvidence = true;
    else if (arg === "--allow-incomplete-browser-evidence") options.requireBrowserEvidence = false;
    else throw new Error(`unsupported argument: ${arg}`);
  }
  validateOutputDate(options.outputDate);
  assert.equal(new Date(options.observedAtUtc).toISOString(), options.observedAtUtc, "observed-at must be canonical ISO UTC");
  assert.equal(
    options.outputDate,
    localDate(new Date(options.observedAtUtc)),
    `output date must match ${projectTimeZone} observation date`,
  );
  return options;
}

export function validateBaseUrl(value, allowLocal = false) {
  const url = new URL(value);
  assert.equal(url.username, "", "base URL credentials are forbidden");
  assert.equal(url.password, "", "base URL credentials are forbidden");
  assert.equal(url.pathname, "/", "base URL must not include a path");
  assert.equal(url.search, "", "base URL must not include a query");
  assert.equal(url.hash, "", "base URL must not include a fragment");
  const localHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);
  if (localHosts.has(url.hostname)) {
    assert.equal(allowLocal, true, "local base URL requires --allow-local");
    assert.ok(["http:", "https:"].includes(url.protocol), "local base URL must use HTTP(S)");
  } else {
    assert.equal(url.origin, approvedProductionOrigin, "production capture requires the approved exact origin");
  }
  return url;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function jsonBytes(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
}

async function readBoundedBody(response, limit = maxResponseBytes) {
  const length = Number(response.headers.get("content-length"));
  if (Number.isFinite(length) && length > limit) throw new Error(`response exceeds ${limit} bytes`);
  if (!response.body) return Buffer.alloc(0);
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = Buffer.from(value);
      total += chunk.byteLength;
      if (total > limit) {
        await reader.cancel("capture byte limit exceeded");
        throw new Error(`response exceeds ${limit} bytes`);
      }
      chunks.push(chunk);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, total);
}

function bodyClass(pathname, text, contentType, method) {
  if (method === "HEAD") return "empty-head";
  if (pathname === "/" || pathname === "/index.html") return "landing-html";
  if (contentType.startsWith("text/html")) return "html-error";
  if (pathname === "/install" || pathname === "/install.sh") return "installer-shell";
  if (pathname === "/install.ps1") return "installer-powershell";
  if (pathname === "/version") return "version-text";
  if (pathname.startsWith("/download/")) return "download-stream";
  if (text.includes("vcskill — install:")) return "plain-install-hint";
  return "text";
}

export async function normalizeResponse(response, route, options = {}) {
  const body = await readBoundedBody(response, options.maxBytes);
  const contentType = response.headers.get("content-type") || "";
  const textLike = route.readAsText || contentType.startsWith("text/") || contentType.startsWith("application/json");
  const text = textLike ? body.toString("utf8") : "";
  const headers = {};
  for (const name of ["cache-control", "content-type", "content-disposition", "content-length", "location"]) {
    const value = response.headers.get(name);
    if (value === null) continue;
    if (name === "location") {
      const location = new URL(value, approvedProductionOrigin);
      headers[name] = location.origin === approvedProductionOrigin && location.username === "" && location.password === ""
        ? `${location.pathname}${location.search}${location.hash}`
        : `[cross-origin-redacted sha256:${sha256(value)}]`;
    } else {
      headers[name] = value;
    }
  }
  const target = new URL(route.path, approvedProductionOrigin);
  const normalizedBody = {
    class: bodyClass(target.pathname, text, contentType, route.method),
    bytes: body.byteLength,
    sha256: sha256(body),
    bodyStreamPresent: response.body !== null,
    bodyReadMode: response.body === null ? "none" : "bounded-web-stream-reader",
  };
  if (route.preview === "text" && textLike) {
    normalizedBody.preview = text.replace(/\s+/g, " ").trim().slice(0, maxPreviewChars);
  }
  return {
    snapshot: {
      id: route.id,
      method: route.method,
      path: route.path,
      status: response.status,
      headers,
      redirected: response.redirected,
      body: normalizedBody,
    },
    rawText: text,
  };
}

export async function fetchSnapshot(baseUrl, route, fetchImpl = fetch) {
  assert.ok(safeMethods.has(route.method), `unsafe capture method: ${route.method}`);
  const response = await fetchImpl(new URL(route.path, baseUrl), {
    method: route.method,
    redirect: "manual",
    signal: AbortSignal.timeout(requestTimeoutMs),
  });
  return normalizeResponse(response, route);
}

function parseLocalSiteData(landingHtml) {
  const start = landingHtml.indexOf("// SITE_DATA_START");
  const end = landingHtml.indexOf("// SITE_DATA_END");
  assert.notEqual(start, -1, "SITE data start marker missing");
  assert.notEqual(end, -1, "SITE data end marker missing");
  const context = {};
  vm.runInNewContext(landingHtml.slice(start, end), context);
  return JSON.parse(JSON.stringify(context.SITE));
}

function parseChecksums(text) {
  const entries = text.trim().split("\n").filter(Boolean).map((line) => {
    const match = line.match(/^([0-9a-f]{64})\s{2}([A-Za-z0-9._-]+)$/);
    assert.ok(match, `invalid checksum row: ${line.slice(0, 80)}`);
    return { asset: match[2], sha256: match[1] };
  });
  assert.ok(entries.length > 0, "checksums route returned no entries");
  return entries;
}

function buildInventory(site, checksums, snapshots, contract, options) {
  const skillNames = [...new Set(site.lanes.flatMap((lane) => lane.skills.map(([name]) => name)))];
  assert.equal(skillNames.length, site.stats.skills, "released skill inventory count drifted");
  assert.equal(site.commands.length, contract.canonicalEvidence.commandCount, "released command inventory count drifted");
  assert.equal(site.providers.length, contract.canonicalEvidence.providerCount, "released provider inventory count drifted");
  return {
    observedOnLocal: options.outputDate,
    source: {
      productionOrigin: approvedProductionOrigin,
      localCanonicalLanding: "landing.html",
      canonicalCore: contract.canonicalEvidence.source,
    },
    release: {
      versionRoute: snapshots.find((item) => item.id === "version")?.body.preview || null,
      landingRelease: site.release,
      binaries: site.proof.release.binaries,
      checksums,
    },
    inventory: {
      skills: skillNames,
      commands: site.commands,
      workflows: contract.canonicalEvidence.workflows,
      providers: site.providers,
    },
    counts: {
      ...site.stats,
      commands: site.commands.length,
      providers: site.providers.length,
      workflows: site.proof.graph.workflows,
    },
    proofFacts: site.proof,
    proofBoundary: site.proofCaveat,
    installers: {
      unixRouteSha256: snapshots.find((item) => item.id === "install-root")?.body.sha256 || null,
      windowsRouteSha256: snapshots.find((item) => item.id === "install-ps1")?.body.sha256 || null,
    },
  };
}

async function loadBrowserObservations(path, tasks, required) {
  let observations;
  try {
    observations = JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    if (required) throw new Error(`browser observations missing: ${relative(repoRoot, path)}`);
    return null;
  }
  assert.equal(observations.schemaVersion, 1, "browser observations schema drifted");
  assert.equal(observations.tasks.length, tasks.length, "browser observation task count drifted");
  const byId = new Map(observations.tasks.map((task) => [task.id, task]));
  assert.equal(byId.size, tasks.length, "browser observations contain duplicate task IDs");
  for (const task of tasks) {
    const observed = byId.get(task.id);
    assert.ok(observed, `browser observation missing: ${task.id}`);
    assert.match(observed.status, /^observed-(pass|fail)$/);
    assert.ok(Number.isInteger(observed.actionCount) && observed.actionCount >= 0);
    assert.ok(observed.actionCount <= task.maxActions, `${task.id} exceeded action cap`);
    assert.equal(typeof observed.reason, "string");
    assert.equal(typeof observed.evidence?.artifact, "string");
  }
  return observations;
}

function buildFindability(tasks, observations, inventory, options) {
  const byId = new Map((observations?.tasks || []).map((task) => [task.id, task]));
  return {
    observedOnLocal: options.outputDate,
    browser: observations?.browser || null,
    currentProofClaim: tasks.metadata.observedLegacyProof,
    futureCorpus: tasks.metadata.futureBenchmark,
    tasks: tasks.tasks.map((task) => {
      const observed = byId.get(task.id);
      return {
        id: task.id,
        observedStatus: observed?.status || "not-observed",
        actionCount: observed?.actionCount ?? null,
        maxActions: task.maxActions,
        reason: observed?.reason || "browser corpus has not been executed",
        evidence: observed?.evidence || {
          artifact: null,
          startUrl: task.startUrl,
          factSource: task.canonicalExpectedFactSource,
        },
        release: inventory.release.landingRelease,
      };
    }),
  };
}

async function listArtifacts(outputDir) {
  const artifacts = [];
  for (const directory of ["viewports", "lighthouse"]) {
    const root = join(outputDir, directory);
    async function walk(path) {
      let entries;
      try {
        entries = await readdir(path, { withFileTypes: true });
      } catch (error) {
        if (error?.code === "ENOENT") return;
        throw error;
      }
      for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
        const child = join(path, entry.name);
        assert.equal(entry.isSymbolicLink(), false, `evidence symlink forbidden: ${child}`);
        if (entry.isDirectory()) await walk(child);
        else if (entry.isFile()) {
          const bytes = await readFile(child);
          artifacts.push({ path: relative(outputDir, child), bytes: bytes.byteLength, sha256: sha256(bytes) });
        }
      }
    }
    await walk(root);
  }
  return artifacts.sort((a, b) => a.path.localeCompare(b.path));
}

function missingBrowserArtifacts(artifacts, viewportMatrix) {
  const paths = new Set(artifacts.map((artifact) => artifact.path));
  const required = [
    "viewports/findability-observations.json",
    "lighthouse/mobile/lighthouse.report.json",
    "lighthouse/desktop/lighthouse.report.json",
    "lighthouse/performance-summary.json",
    ...viewportMatrix.viewports.flatMap((viewport) => [
      `viewports/${viewport.id}.png`,
      `viewports/${viewport.id}.json`,
    ]),
    ...Array.from({ length: 5 }, (_, index) => `lighthouse/performance-run-${index + 1}.json`),
  ];
  return required.filter((path) => !paths.has(path));
}

function median(values) {
  return [...values].sort((left, right) => left - right)[Math.floor(values.length / 2)];
}

async function regeneratePerformanceSummary(outputDir, matrix, required) {
  const runs = [];
  try {
    for (let index = 1; index <= 5; index += 1) {
      runs.push(JSON.parse(await readFile(join(outputDir, "lighthouse", `performance-run-${index}.json`), "utf8")));
    }
  } catch (error) {
    if (error?.code === "ENOENT" && !required) return;
    throw error;
  }
  assert.deepEqual(runs.map((run) => `${run.routeId}#${run.run}`), matrix.legacyBaselineRunOrder);
  for (const run of runs) {
    assert.equal(run.valid, true, `performance run ${run.run} is not valid`);
    assert.equal(run.profile.network, matrix.profile.network);
    assert.equal(run.profile.cpuSlowdownMultiplier, matrix.profile.cpuSlowdownMultiplier);
    assert.deepEqual(run.profile.viewport, matrix.profile.viewport);
    assert.equal(run.profile.browserCache, matrix.profile.browserCache);
    assert.equal(run.profile.runnerRegion, matrix.runner.region);
  }
  const popValues = runs.map((run) => run.cdn.cfRay.match(/-([A-Z0-9]+)$/)?.[1]);
  assert.ok(popValues.every(Boolean), "every performance run must retain a CDN PoP suffix");
  assert.equal(new Set(popValues).size, 1, "performance runs used mixed CDN PoPs");
  const metrics = {
    lcpMs: (run) => run.metrics.lcpMs,
    cls: (run) => run.metrics.cls,
    inpMs: (run) => run.metrics.inpMs,
    totalTransferBytes: (run) => run.transfer.totalBytes,
    scriptTransferBytes: (run) => run.transfer.scriptBytes,
    cssTransferBytes: (run) => run.transfer.cssBytes,
    fontTransferBytes: (run) => run.transfer.fontBytes,
    imageTransferBytes: (run) => run.transfer.imageBytes,
  };
  const aggregation = Object.fromEntries(Object.entries(metrics).map(([key, readValue]) => {
    const samples = runs.map(readValue);
    assert.ok(samples.every(Number.isFinite), `${key} contains a non-finite sample`);
    return [key, { samples, median: median(samples), maximum: Math.max(...samples) }];
  }));
  const summary = {
    schemaVersion: 1,
    routeId: "marketing-home",
    validRuns: runs.length,
    artifacts: runs.map((run) => `lighthouse/performance-run-${run.run}.json`),
    profile: {
      network: matrix.profile.network,
      cpuSlowdownMultiplier: matrix.profile.cpuSlowdownMultiplier,
      viewport: matrix.profile.viewport,
      browserCache: matrix.profile.browserCache,
      cdnCache: matrix.profile.cdnCache,
      runnerRegion: matrix.runner.region,
      cdnPoP: popValues[0],
    },
    aggregation,
  };
  await writeFile(join(outputDir, "lighthouse", "performance-summary.json"), jsonBytes(summary));
}

function buildPerformanceCoverage(matrix, snapshots) {
  const snapshotById = new Map(snapshots.map((snapshot) => [snapshot.id, snapshot]));
  const routeEvidence = {
    "docs-en-installation": "legacy-docs-en-installation",
    "docs-vi-installation": "legacy-docs-vi-installation",
  };
  return {
    schemaVersion: 1,
    qualification: {
      status: "frozen-for-phase-11",
      runOrder: matrix.qualificationRunOrder,
      interactions: matrix.interactions.map((interaction) => interaction.id),
    },
    legacyBaseline: {
      runOrder: matrix.legacyBaselineRunOrder,
      routes: matrix.routes.map((route) => {
        if (route.legacyBaseline === "observable") {
          return {
            routeId: route.id,
            status: "observed",
            artifacts: Array.from({ length: 5 }, (_, index) => `lighthouse/performance-run-${index + 1}.json`),
            summary: "lighthouse/performance-summary.json",
          };
        }
        const snapshotId = routeEvidence[route.id];
        const snapshot = snapshotById.get(snapshotId);
        assert.ok(snapshot, `legacy route evidence missing: ${route.id}`);
        return {
          routeId: route.id,
          status: "observed-not-available",
          reason: route.legacyReason,
          routeSnapshotId: snapshotId,
          observedHttpStatus: snapshot.status,
        };
      }),
      interactions: matrix.interactions.map((interaction) => interaction.legacyBaseline === "observable"
        ? {
            interactionId: interaction.id,
            status: "observed-pass",
            artifacts: Array.from({ length: 5 }, (_, index) => `lighthouse/performance-run-${index + 1}.json`),
          }
        : {
            interactionId: interaction.id,
            status: "observed-not-available",
            reason: interaction.legacyReason,
            routeSnapshotId: routeEvidence[interaction.routeId],
          }),
    },
  };
}

function routesToCapture(contract) {
  return [
    { id: "landing-root", method: "GET", path: "/", preview: "text" },
    { id: "landing-index", method: "GET", path: "/index.html", preview: "text" },
    { id: "install-root", method: "GET", path: "/install", preview: "omit" },
    { id: "install-alias", method: "GET", path: "/install.sh", preview: "omit" },
    { id: "install-ps1", method: "GET", path: "/install.ps1", preview: "omit" },
    { id: "version", method: "GET", path: "/version", preview: "text" },
    { id: "version-head", method: "HEAD", path: "/version", preview: "omit" },
    { id: "version-options", method: "OPTIONS", path: "/version", preview: "text" },
    { id: "download-checksums", method: "GET", path: `/download/${contract.knownHappyPathAsset}`, preview: "omit", readAsText: true },
    { id: "download-query", method: "GET", path: `/download/${contract.knownHappyPathAsset}?source=landing`, preview: "omit", readAsText: true },
    { id: "download-encoded", method: "GET", path: "/download/checksums%2Etxt", preview: "omit", readAsText: true },
    { id: "unknown-route", method: "GET", path: "/unknown", preview: "text" },
    { id: "install-trailing-slash", method: "GET", path: "/install/", preview: "text" },
    { id: "malformed-download", method: "GET", path: "/download/%E0%A4%A", preview: "text" },
    { id: "install-query", method: "GET", path: "/install?from=docs", preview: "omit" },
    { id: "legacy-docs-en-installation", method: "GET", path: "/en/stable/get-started/installation/", preview: "text" },
    { id: "legacy-docs-vi-installation", method: "GET", path: "/vi/stable/get-started/installation/", preview: "text" },
  ];
}

export async function captureProductionBaseline(options, dependencies = {}) {
  assert.equal(options.outputDate, localDate(new Date(options.observedAtUtc)), "output date and local observation date differ");
  const baseUrl = validateBaseUrl(options.baseUrl, options.allowLocal);
  const outputDir = join(baselineRoot, `production-${validateOutputDate(options.outputDate)}`);
  assert.equal(resolve(outputDir).startsWith(`${resolve(baselineRoot)}/`), true, "baseline output escaped its root");
  const contractPath = join(repoRoot, "tests", "contracts", "public-edge-contracts.json");
  const tasksPath = join(repoRoot, "tests", "benchmarks", "findability-tasks.json");
  const viewportPath = join(repoRoot, "tests", "benchmarks", "viewport-matrix.json");
  const performanceMatrixPath = join(repoRoot, "tests", "benchmarks", "performance-matrix.json");
  const landingPath = join(repoRoot, "landing.html");
  const [contract, tasks, viewportMatrix, performanceMatrix, landingHtml] = await Promise.all([
    readFile(contractPath, "utf8").then(JSON.parse),
    readFile(tasksPath, "utf8").then(JSON.parse),
    readFile(viewportPath, "utf8").then(JSON.parse),
    readFile(performanceMatrixPath, "utf8").then(JSON.parse),
    readFile(landingPath, "utf8"),
  ]);
  assert.equal(tasks.tasks.length, 15, "findability corpus must remain 15 tasks");
  const captures = [];
  for (const route of routesToCapture(contract)) {
    captures.push(await fetchSnapshot(baseUrl, route, dependencies.fetchImpl || fetch));
  }
  const snapshots = captures.map((capture) => capture.snapshot);
  const checksumCapture = captures.find((capture) => capture.snapshot.id === "download-checksums");
  const site = parseLocalSiteData(landingHtml);
  const inventory = buildInventory(site, parseChecksums(checksumCapture.rawText), snapshots, contract, options);
  const observationPath = join(outputDir, "viewports", "findability-observations.json");
  const observations = await loadBrowserObservations(observationPath, tasks.tasks, options.requireBrowserEvidence);
  const findability = buildFindability(tasks, observations, inventory, options);
  const performanceCoverage = buildPerformanceCoverage(performanceMatrix, snapshots);
  const files = {
    "routes.json": jsonBytes(snapshots),
    "inventory.json": jsonBytes(inventory),
    "findability.json": jsonBytes(findability),
    "performance-coverage.json": jsonBytes(performanceCoverage),
  };
  await mkdir(outputDir, { recursive: true });
  await Promise.all(Object.entries(files).map(([name, bytes]) => writeFile(join(outputDir, name), bytes)));
  await regeneratePerformanceSummary(outputDir, performanceMatrix, options.requireBrowserEvidence);
  const artifacts = await listArtifacts(outputDir);
  const pendingArtifacts = missingBrowserArtifacts(artifacts, viewportMatrix);
  if (options.requireBrowserEvidence && pendingArtifacts.length > 0) {
    throw new Error(`browser evidence incomplete: ${pendingArtifacts.join(", ")}`);
  }
  const manifest = {
    schemaVersion: 1,
    generatedForDirectory: `production-${options.outputDate}`,
    generatedAtUtc: options.observedAtUtc,
    observedDateUtc: options.observedAtUtc.slice(0, 10),
    observedDateLocal: options.outputDate,
    observedTimeZone: projectTimeZone,
    baseUrl: baseUrl.origin,
    tool: { script: "scripts/capture-production-baseline.mjs", node: process.version },
    files: Object.fromEntries(Object.entries(files).map(([name, bytes]) => [name, { bytes: bytes.byteLength, sha256: sha256(bytes) }])),
    artifacts,
    pendingArtifacts,
    warnings: pendingArtifacts.length ? ["Browser evidence remains incomplete; do not complete Phase 1."] : [],
  };
  await writeFile(join(outputDir, "manifest.json"), jsonBytes(manifest));
  return { outputDir, manifest, snapshots, inventory, findability };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await captureProductionBaseline(parseArgs(process.argv.slice(2)));
}
