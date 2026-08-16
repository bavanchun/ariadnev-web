// ariadnev public edge — release routes extracted from the legacy root Worker.
//
// Two deployment profiles share this handler:
//   Candidate A (wrangler.edge.toml)     — edge owns only the protected routes;
//                                          a separate site Custom Domain serves
//                                          everything else.
//   Candidate B (wrangler.combined.toml) — one Worker owns the protected routes
//                                          and delegates unprotected paths to an
//                                          `ASSETS` binding with
//                                          `run_worker_first = true`.
//
// Invariants:
//   * Route classification happens before any decoding or fallback.
//   * A protected route never delegates to site assets — not on parse errors,
//     not on upstream failure, not on missing secret.
//   * The frozen Phase 1 public contract for `/install`, `/install.sh`,
//     `/install.ps1`, `/version`, and `/download/<asset>` is preserved exactly.
//
// Requires one secret: GH_TOKEN — a fine-grained PAT with Contents: read on
// bavanchun/ariadnev-kit. Under Candidate B this lives in a Worker secret namespace
// separate from the retained legacy Worker.

import { SelectorError, parseReleaseSelector } from "./release-selector.js";
import { assertSafeAssetName, getInstaller, getReleaseAsset, getVersionText } from "./github-release.js";
import { applyStaticResponsePolicy } from "./static-response-policy.js";

const MISSING_SECRET_BODY = "worker misconfigured: GH_TOKEN unset";
const FALLTHROUGH_BODY = "ariadnev — install:  curl -fsSL https://ariadnev.com/install | bash\n";

const DOWNLOAD_PREFIX = "/download/";

/** Exact protected paths. Lookalikes such as `/installer` are deliberately absent. */
const EXACT_ROUTES = new Map([
  ["/install", { kind: "installer", file: "install.sh", contentType: "text/x-shellscript; charset=utf-8" }],
  ["/install.sh", { kind: "installer", file: "install.sh", contentType: "text/x-shellscript; charset=utf-8" }],
  ["/install.ps1", { kind: "installer", file: "install.ps1", contentType: "text/plain; charset=utf-8" }],
  ["/version", { kind: "version" }],
]);

/**
 * Classify a raw pathname before any decoding.
 * @returns {{kind: "installer"|"version"|"download"|"unprotected", ...}}
 */
export function classifyRoute(pathname) {
  const exact = EXACT_ROUTES.get(pathname);
  if (exact) return exact;
  // Bare `/download` and `/download/` are not protected asset routes; the
  // suffix must be a non-empty single segment.
  if (pathname.startsWith(DOWNLOAD_PREFIX)) {
    const rawAsset = pathname.slice(DOWNLOAD_PREFIX.length);
    if (rawAsset !== "") return { kind: "download", rawAsset };
  }
  return { kind: "unprotected" };
}

export function isProtected(route) {
  return route.kind !== "unprotected";
}

function clientError(reason) {
  return new Response(`bad request: ${reason}\n`, {
    status: 400,
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
  });
}

/** Decode exactly one layer of percent-encoding, as a bounded client error. */
function decodeAssetName(rawAsset) {
  let decoded;
  try {
    decoded = decodeURIComponent(rawAsset);
  } catch {
    throw new SelectorError("malformed-encoding");
  }
  return assertSafeAssetName(decoded);
}

async function handleProtected(route, url, token, fetchImpl) {
  if (route.kind === "installer") {
    // Installer routes ignore the selector entirely and make no pinning claim.
    return getInstaller(token, route.file, route.contentType, fetchImpl);
  }

  const selector = parseReleaseSelector(url.searchParams);

  if (route.kind === "version") return getVersionText(token, selector, fetchImpl);
  return getReleaseAsset(token, decodeAssetName(route.rawAsset), selector, fetchImpl);
}

/**
 * Serve an unprotected path.
 * Candidate B delegates to `ASSETS` and applies the approved static policy.
 * Candidate A's edge-only profile has no `ASSETS` binding and preserves the
 * frozen legacy plain-text fallthrough so no route can silently 404 as HTML.
 */
async function handleUnprotected(request, env, pathname) {
  if (env.ASSETS && typeof env.ASSETS.fetch === "function") {
    return applyStaticResponsePolicy(await env.ASSETS.fetch(request), pathname);
  }
  return new Response(FALLTHROUGH_BODY, { status: 404, headers: { "content-type": "text/plain" } });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const route = classifyRoute(url.pathname);

    // Preserve the frozen host-wide missing-secret contract. Under Candidate B
    // this keeps the combined host's observed behavior identical to legacy.
    const token = env.GH_TOKEN;
    if (!token) return new Response(MISSING_SECRET_BODY, { status: 500 });

    if (!isProtected(route)) return handleUnprotected(request, env, url.pathname);

    try {
      return await handleProtected(route, url, token, fetch);
    } catch (error) {
      // Protected routes fail closed. Never fall through to site assets, and
      // never surface upstream authorization or URL detail.
      if (error instanceof SelectorError) return clientError(error.reason);
      return new Response("edge request failed\n", {
        status: 502,
        headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
      });
    }
  },
};
