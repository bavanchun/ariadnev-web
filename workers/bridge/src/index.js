// ariadnev release bridge — the interim public face of `ariadnev.com`.
//
// `ariadnev@1.0.0` hardcodes `https://ariadnev.com` in install.sh, install.ps1,
// and update-command.ts, so the host must serve releases before anything else
// can ship. The legacy Worker on `vcskill.vchun.dev` is the first-cutover
// rollback target and is frozen, so this is a separate, additive unit rather
// than a new route on that Worker.
//
// This unit is deliberately temporary: the Phase 12 candidate-b cutover moves
// `ariadnev.com` to `workers/edge` and deletes `workers/bridge/`.
//
// Requires one secret: GH_TOKEN — a fine-grained PAT with Contents: read on
// bavanchun/ariadnev-kit, in this Worker's own secret namespace.

import { assertSafeAssetName } from "../../edge/src/github-release.js";
import { SelectorError } from "../../edge/src/release-selector.js";

// Bound directly to the post-rename repo. The legacy Worker still names the
// pre-rename repo and survives only on GitHub's rename redirect; the bridge must
// not inherit that dependency.
export const REPO = "bavanchun/ariadnev-kit";

const API = "https://api.github.com";
const USER_AGENT = "ariadnev-bridge";
const DOWNLOAD_PREFIX = "/download/";
const MISSING_SECRET_BODY = "worker misconfigured: GH_TOKEN unset";
const INSTALL_HINT = "ariadnev — install:  curl -fsSL https://ariadnev.com/install | bash\n";

const INSTALLERS = new Map([
  ["/install", { file: "install.sh", contentType: "text/x-shellscript; charset=utf-8" }],
  ["/install.sh", { file: "install.sh", contentType: "text/x-shellscript; charset=utf-8" }],
  ["/install.ps1", { file: "install.ps1", contentType: "text/plain; charset=utf-8" }],
]);

// A holding page, not the marketing site. Duplicating the frozen `landing.html`
// would fork a rollback-target file; the real site arrives with candidate-b.
const HOLDING_PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ariadnev</title>
<style>
:root { color-scheme: light dark; }
body { margin: 0; min-height: 100vh; display: grid; place-items: center;
  font: 16px/1.6 ui-monospace, SFMono-Regular, Menlo, monospace; padding: 2rem; }
main { max-width: 40rem; }
h1 { font-size: 1.5rem; letter-spacing: .02em; margin: 0 0 1rem; }
code { display: block; padding: 1rem; border: 1px solid currentColor; overflow-x: auto; }
p { opacity: .75; }
</style>
</head>
<body>
<main>
<h1>ariadnev</h1>
<code>curl -fsSL https://ariadnev.com/install | bash</code>
<p>Agent skill kit. Documentation is on its way.</p>
</main>
</body>
</html>
`;

function ghHeaders(token, accept) {
  return { Authorization: `Bearer ${token}`, "User-Agent": USER_AGENT, Accept: accept };
}

/**
 * Normalize a GitHub `tag_name` into the public `/version` text.
 * Strips the `ariadnev@` release prefix; the legacy `vcskill@` prefix is
 * deliberately not handled, because no tag in this repo carries it.
 */
export function versionFromReleaseTag(tagName) {
  return String(tagName || "").replace(/^ariadnev@/, "").replace(/^v/, "");
}

async function latestRelease(token, fetchImpl) {
  const res = await fetchImpl(`${API}/repos/${REPO}/releases/latest`, {
    headers: ghHeaders(token, "application/vnd.github+json"),
  });
  return res.ok ? { ok: true, release: await res.json() } : { ok: false };
}

/** Proxy one repo file at `ref=main`, preserving the upstream status. */
async function installerResponse(token, file, contentType, fetchImpl) {
  const res = await fetchImpl(`${API}/repos/${REPO}/contents/${file}?ref=main`, {
    headers: ghHeaders(token, "application/vnd.github.raw"),
  });
  return new Response(res.body, {
    status: res.status,
    headers: { "content-type": contentType, "cache-control": "no-store" },
  });
}

async function versionResponse(token, fetchImpl) {
  const resolved = await latestRelease(token, fetchImpl);
  if (!resolved.ok) return new Response("", { status: 502 });
  return new Response(versionFromReleaseTag(resolved.release.tag_name), {
    headers: { "content-type": "text/plain", "cache-control": "no-store" },
  });
}

async function assetResponse(token, assetName, fetchImpl) {
  const resolved = await latestRelease(token, fetchImpl);
  if (!resolved.ok) return new Response("release lookup failed", { status: 502 });

  const asset = (resolved.release.assets || []).find((candidate) => candidate.name === assetName);
  if (!asset) return new Response(`asset not found: ${assetName}`, { status: 404 });

  // GitHub answers with a 302 to signed storage; following it server-side keeps
  // the signed URL from reaching the client.
  const bin = await fetchImpl(asset.url, {
    headers: ghHeaders(token, "application/octet-stream"),
    redirect: "follow",
  });
  return new Response(bin.body, {
    status: bin.status,
    headers: {
      "content-type": "application/octet-stream",
      "content-disposition": `attachment; filename="${assetName}"`,
      "cache-control": "no-store",
    },
  });
}

/**
 * Decode exactly one layer of percent-encoding, then validate.
 *
 * Order matters. `assertSafeAssetName` rejects residual `%xx` as
 * `asset-double-encoded`, so validating first would over-block the legitimate
 * `/download/checksums%2Etxt` form. Decoding first is also what catches
 * `%2e%2e%2f`, which survives path normalization and is the traversal family
 * that actually reaches this Worker — `ariadnev.com` has no zone ingress rule.
 */
function decodeAssetName(rawAsset) {
  let decoded;
  try {
    decoded = decodeURIComponent(rawAsset);
  } catch {
    throw new SelectorError("malformed-encoding");
  }
  return assertSafeAssetName(decoded);
}

export default {
  async fetch(request, env) {
    const token = env.GH_TOKEN;
    // Host-wide fail-closed, matching the legacy contract: a misconfigured
    // Worker never serves a stale or partial surface.
    if (!token) return new Response(MISSING_SECRET_BODY, { status: 500 });

    const { pathname } = new URL(request.url);

    try {
      const installer = INSTALLERS.get(pathname);
      if (installer) return await installerResponse(token, installer.file, installer.contentType, fetch);

      if (pathname === "/version") return await versionResponse(token, fetch);

      if (pathname.startsWith(DOWNLOAD_PREFIX)) {
        const rawAsset = pathname.slice(DOWNLOAD_PREFIX.length);
        // Bare `/download/` is not an asset route; fall through to the 404.
        if (rawAsset !== "") return await assetResponse(token, decodeAssetName(rawAsset), fetch);
      }

      if (pathname === "/" || pathname === "/index.html") {
        return new Response(HOLDING_PAGE, {
          headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300" },
        });
      }

      return new Response(INSTALL_HINT, { status: 404, headers: { "content-type": "text/plain" } });
    } catch (error) {
      // Rejected asset names are client errors; everything else fails closed as
      // an upstream failure without disclosing GitHub detail.
      if (error instanceof SelectorError) {
        return new Response(`bad request: ${error.reason}\n`, {
          status: 400,
          headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
        });
      }
      return new Response("bridge request failed\n", {
        status: 502,
        headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
      });
    }
  },
};
