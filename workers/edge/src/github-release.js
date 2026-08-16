// Token-isolated GitHub access for the ariadnev public edge.
//
// Every helper here receives the token explicitly and returns only sanitized
// public responses. Upstream authorization headers, signed storage URLs, and
// GitHub error bodies never reach the client.

import { SelectorError, assertSelectorMatch, versionFromTag } from "./release-selector.js";

// Bound directly to the post-rename repository. The retained legacy Worker still
// names the pre-rename repository and survives only on GitHub's rename redirect;
// this Worker must not inherit that dependency.
export const REPO = "bavanchun/ariadnev-kit";
export const API = "https://api.github.com";

const USER_AGENT = "ariadnev-edge";
const MAX_ASSET_NAME_LENGTH = 128;
// Release asset names are flat basenames: letters, digits, dot, dash, underscore.
const SAFE_ASSET_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export function ghHeaders(token, accept) {
  return { Authorization: `Bearer ${token}`, "User-Agent": USER_AGENT, Accept: accept };
}

/**
 * Resolve one exact release identity.
 * Absent selector uses the `latest` endpoint; a pinned selector uses the exact
 * tag endpoint and never falls back to `latest`.
 */
export async function getRelease(token, selector, fetchImpl = fetch) {
  const endpoint =
    selector.mode === "pinned"
      ? `${API}/repos/${REPO}/releases/tags/${encodeURIComponent(selector.tag)}`
      : `${API}/repos/${REPO}/releases/latest`;

  const res = await fetchImpl(endpoint, { headers: ghHeaders(token, "application/vnd.github+json") });
  if (!res.ok) return { ok: false, status: res.status };

  const release = await res.json();
  // A pinned request that resolves to any other release identity fails closed.
  assertSelectorMatch(selector, release?.tag_name);
  return { ok: true, release };
}

/**
 * Installer passthrough. Identical to the frozen legacy `repoFile` behavior:
 * always `ref=main`, upstream status preserved, forced content type, `no-store`.
 *
 * This is explicitly NOT a pinned execution chain — the installer it returns
 * resolves its own download targets at run time.
 */
export async function getInstaller(token, filename, contentType, fetchImpl = fetch) {
  const res = await fetchImpl(`${API}/repos/${REPO}/contents/${filename}?ref=main`, {
    headers: ghHeaders(token, "application/vnd.github.raw"),
  });
  return new Response(res.body, {
    status: res.status,
    headers: { "content-type": contentType, "cache-control": "no-store" },
  });
}

/** Validate one decoded release-asset basename. Throws `SelectorError` on rejection. */
export function assertSafeAssetName(name) {
  if (typeof name !== "string" || name === "") throw new SelectorError("empty-asset-name");
  if (name.length > MAX_ASSET_NAME_LENGTH) throw new SelectorError("asset-name-too-long");
  if (name.includes("/") || name.includes("\\")) throw new SelectorError("asset-path-separator");
  if (name === "." || name === ".." || name.startsWith("../")) throw new SelectorError("asset-dot-segment");
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(name)) throw new SelectorError("asset-control-character");
  if (/%[0-9a-fA-F]{2}/.test(name)) throw new SelectorError("asset-double-encoded");
  if (!SAFE_ASSET_NAME.test(name)) throw new SelectorError("asset-name-charset");
  return name;
}

/**
 * Stream one exact release asset from the resolved release identity.
 * Response shape is byte-for-byte the frozen legacy contract.
 */
export async function getReleaseAsset(token, assetName, selector, fetchImpl = fetch) {
  const resolved = await getRelease(token, selector, fetchImpl);
  if (!resolved.ok) return new Response("release lookup failed", { status: 502 });

  const asset = (resolved.release.assets || []).find((candidate) => candidate.name === assetName);
  if (!asset) return new Response(`asset not found: ${assetName}`, { status: 404 });

  // GitHub returns a 302 to signed storage; the redirect is followed server-side
  // so the signed URL is never disclosed to the client.
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

/** Resolve the public `/version` text for the selected release identity. */
export async function getVersionText(token, selector, fetchImpl = fetch) {
  const resolved = await getRelease(token, selector, fetchImpl);
  if (!resolved.ok) return new Response("", { status: 502 });
  return new Response(versionFromTag(resolved.release.tag_name), {
    headers: { "content-type": "text/plain", "cache-control": "no-store" },
  });
}
