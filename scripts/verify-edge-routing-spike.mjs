#!/usr/bin/env node
// Execute the Phase 3 route/deploy/rollback permutation matrix against a live
// staging endpoint and emit sanitized decision evidence.
//
// Evidence rules enforced here:
//   * Every row carries the deployment label it was actually observed under.
//     A controlled-failure deployment is never relabeled as the final Worker.
//   * No credentials, account/zone identifiers, signed URLs, or preview
//     hostnames are recorded.
//   * Content is reduced to a class, never a body, so a probe cannot leak a
//     release artifact into source control.
//
// Usage:
//   node scripts/verify-edge-routing-spike.mjs \
//     --base https://staging.vcskill.vchun.dev \
//     --deployment "candidate-b:combined" \
//     [--version-id <worker-version-id>] [--out <path>]

const PROBES = [
  // id, path, expectation class
  { id: "protected-install", path: "/install", owner: "edge" },
  { id: "protected-install-sh", path: "/install.sh", owner: "edge" },
  { id: "protected-install-ps1", path: "/install.ps1", owner: "edge" },
  { id: "protected-install-query", path: "/install?from=docs", owner: "edge" },
  { id: "protected-version", path: "/version", owner: "edge" },
  { id: "protected-version-query", path: "/version?source=landing", owner: "edge" },
  { id: "protected-version-pinned", path: "/version?version=0.10.0", owner: "edge" },
  { id: "protected-download", path: "/download/checksums.txt", owner: "edge" },
  { id: "protected-download-query", path: "/download/checksums.txt?source=landing", owner: "edge" },
  { id: "protected-download-encoded", path: "/download/checksums%2Etxt", owner: "edge" },
  { id: "protected-download-pinned", path: "/download/checksums.txt?version=0.10.0", owner: "edge" },
  { id: "selector-empty", path: "/version?version=", owner: "edge" },
  { id: "selector-invalid", path: "/version?version=latest", owner: "edge" },
  { id: "selector-duplicate", path: "/version?version=0.10.0&version=0.11.0", owner: "edge" },
  { id: "colliding-static-version", path: "/version", owner: "edge", note: "fixture contains a physical /version file" },
  { id: "colliding-static-asset", path: "/download/checksums.txt", owner: "edge", note: "fixture contains a physical /download/checksums.txt" },
  { id: "raw-traversal-literal", path: "/download/../secrets.txt", owner: "blocked" },
  { id: "raw-traversal-encoded", path: "/download/%2e%2e%2fchecksums.txt", owner: "blocked" },
  { id: "raw-dot-segment", path: "/download/./checksums.txt", owner: "blocked" },
  { id: "lookalike-installer", path: "/installer", owner: "site" },
  { id: "lookalike-versioning", path: "/versioning", owner: "site" },
  { id: "lookalike-download-index", path: "/download", owner: "edge", note: "bare /download is captured by the /download/* route and answered as a bounded edge error, not site HTML" },
  { id: "lookalike-install-dir", path: "/install/", owner: "site" },
  { id: "site-root", path: "/", owner: "site" },
  { id: "site-unknown", path: "/nope", owner: "site" },
  { id: "site-hashed-asset", path: "/_astro/site.abc12345.css", owner: "site", note: "absent from the retained fixture; a site 404 still proves the edge did not claim the path" },
];

const SITE_FIXTURE_MARKER = "SITE_FIXTURE";
const MISSING_SECRET_BODY = "worker misconfigured: GH_TOKEN unset";

export function parseArgs(argv) {
  const args = { out: null, versionId: null, cache: "cold" };
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (key === "--base") args.base = value;
    else if (key === "--deployment") args.deployment = value;
    else if (key === "--version-id") args.versionId = value;
    else if (key === "--out") args.out = value;
    else if (key === "--cache") args.cache = value;
    else throw new Error(`unknown argument: ${key}`);
  }
  if (!args.base) throw new Error("--base is required");
  if (!args.deployment) throw new Error("--deployment is required");
  validateBase(args.base);
  return args;
}

/** Reject preview URLs and moving aliases: evidence must name an explicit endpoint. */
export function validateBase(base) {
  const url = new URL(base);
  if (url.protocol !== "https:") throw new Error("base must be https");
  if (url.hostname.endsWith(".workers.dev")) throw new Error("preview hostnames are not valid evidence endpoints");
  if (url.pathname !== "/") throw new Error("base must not carry a path");
  return url.origin;
}

/**
 * Reduce a response body to a class. Bodies themselves are never recorded.
 */
export function classifyBody(text, contentType, { status, cacheControl } = {}) {
  if (text.includes(SITE_FIXTURE_MARKER)) return "site-fixture";
  if (text === MISSING_SECRET_BODY) return "missing-secret";
  if (text.startsWith("#!/usr/bin/env bash")) return "installer-shell";
  if (text.startsWith("$asset")) return "installer-powershell";
  if (text.startsWith("bad request:")) return "edge-client-error";
  if (text === "release lookup failed" || text === "edge request failed\n") return "edge-upstream-error";
  if (text.startsWith("asset not found:")) return "asset-not-found";
  if (/^\d+\.\d+\.\d+$/.test(text.trim()) && text.trim() !== "") return "version-text";
  if ((contentType || "").startsWith("text/html")) return "html";
  // A successful `no-store` response is the protected contract; the site layer
  // serves a public cache policy on the content it owns. Error responses are
  // excluded because the site deployment also sends `no-store` on its 404.
  if (cacheControl === "no-store" && status < 400) return "edge-contract";
  // A non-HTML 400/403 on this host is a bounded edge rejection. 404 stays
  // ambiguous because the site owns unknown paths.
  if ((status === 400 || status === 403) && !(contentType || "").startsWith("text/html")) return "edge-client-error";
  // An empty 404 on this host is genuinely ambiguous: both layers can produce
  // one. It is attributed to the site, so it can never be counted as proof that
  // an ingress guard blocked a request.
  if (text === "" && status === 404) return "ambiguous-404";
  if (text === "") return "empty";
  return "opaque";
}

// Response classes only the protected edge handler can produce. Everything else
// is attributable to the site layer, which keeps the matrix independent of
// whichever static fixture the site deployment happens to serve.
const EDGE_ONLY_CLASSES = new Set([
  "installer-shell",
  "installer-powershell",
  "version-text",
  "missing-secret",
  "edge-client-error",
  "edge-upstream-error",
  "asset-not-found",
  "release-download",
  "edge-contract",
]);

/** Did this response come from the edge handler rather than the site layer? */
export function ownerOf(bodyClass) {
  if (EDGE_ONLY_CLASSES.has(bodyClass)) return "edge";
  return "site";
}

export async function probe(base, spec, fetchImpl = fetch) {
  const response = await fetchImpl(`${base}${spec.path}`, { redirect: "follow" });
  const contentType = response.headers.get("content-type");
  const text = await response.text();
  const disposition = response.headers.get("content-disposition");
  // A streamed release asset is identified by its contract headers, never by
  // its bytes, so no artifact content is recorded.
  const bodyClass = disposition?.startsWith("attachment;")
    ? "release-download"
    : classifyBody(text, contentType, { status: response.status, cacheControl: response.headers.get("cache-control") });
  const observedOwner = ownerOf(bodyClass);

  let pass;
  if (spec.owner === "blocked") pass = response.status === 403 || response.status === 400;
  else if (spec.owner === "site") pass = observedOwner === "site";
  else pass = observedOwner === "edge" && !(response.status === 200 && (contentType || "").startsWith("text/html"));

  return {
    id: spec.id,
    path: spec.path,
    expectedOwner: spec.owner,
    observedOwner,
    status: response.status,
    contentType,
    cacheControl: response.headers.get("cache-control"),
    contentDisposition: disposition,
    bodyClass,
    bodyBytes: text.length,
    pass,
    ...(spec.note ? { note: spec.note } : {}),
  };
}

export async function runMatrix({ base, deployment, versionId, cache }, fetchImpl = fetch) {
  const rows = [];
  for (const spec of PROBES) rows.push({ ...(await probe(base, spec, fetchImpl)), deployment, workerVersionId: versionId, cache });
  return {
    schemaVersion: 1,
    capturedAtUtc: new Date().toISOString(),
    base,
    deployment,
    workerVersionId: versionId,
    cache,
    summary: { total: rows.length, passed: rows.filter((row) => row.pass).length, failed: rows.filter((row) => !row.pass).length },
    rows,
  };
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop())) {
  const args = parseArgs(process.argv.slice(2));
  const result = await runMatrix(args);
  const serialized = JSON.stringify(result, null, 2);
  if (args.out) {
    const { writeFileSync } = await import("node:fs");
    writeFileSync(args.out, `${serialized}\n`);
  }
  console.log(serialized);
  if (result.summary.failed > 0) process.exit(1);
}
