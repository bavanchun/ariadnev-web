// Pure release-selector parsing for the ariadnev public edge.
//
// The optional `version=<semver>` selector pins `/version` and `/download/<asset>`
// to one exact `ariadnev@<version>` release identity. It never applies to the
// installer routes, and an invalid selector always fails closed rather than
// silently resolving `latest`.

// Stable release policy: MAJOR.MINOR.PATCH only. Prerelease and build metadata
// are rejected because the current release policy does not publish them.
const STABLE_SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const MAX_SELECTOR_LENGTH = 32;

export const SELECTOR_PARAM = "version";
export const TAG_PREFIX = "ariadnev@";

/** Routes that accept the selector. Installer routes are deliberately absent. */
export const SELECTOR_ROUTES = Object.freeze(["version", "download"]);

export class SelectorError extends Error {
  constructor(reason) {
    super(`invalid version selector: ${reason}`);
    this.name = "SelectorError";
    this.reason = reason;
    this.status = 400;
  }
}

/**
 * Parse the optional release selector.
 *
 * @param {URLSearchParams} searchParams
 * @returns {{mode: "latest"}|{mode: "pinned", version: string, tag: string}}
 * @throws {SelectorError} when the selector is present but not a single stable semver.
 */
export function parseReleaseSelector(searchParams) {
  if (!searchParams || typeof searchParams.getAll !== "function") return { mode: "latest" };

  const values = searchParams.getAll(SELECTOR_PARAM);
  if (values.length === 0) return { mode: "latest" };
  if (values.length > 1) throw new SelectorError("duplicate");

  const raw = values[0];
  if (raw === "") throw new SelectorError("empty");
  if (raw.length > MAX_SELECTOR_LENGTH) throw new SelectorError("too-long");
  // URLSearchParams already decodes once. A second encoding layer (`%32.0.0`)
  // must not be decoded again into a valid value.
  if (/%[0-9a-fA-F]{2}/.test(raw)) throw new SelectorError("encoded");
  if (/[/\\\s\u0000-\u001f\u007f]/.test(raw)) throw new SelectorError("illegal-character");
  if (raw.includes("-") || raw.includes("+")) throw new SelectorError("prerelease-or-build-unsupported");

  const normalized = raw.startsWith(TAG_PREFIX) ? raw.slice(TAG_PREFIX.length) : raw;
  if (!STABLE_SEMVER.test(normalized)) throw new SelectorError("malformed");

  return { mode: "pinned", version: normalized, tag: `${TAG_PREFIX}${normalized}` };
}

/**
 * Normalize a GitHub `tag_name` into the public `/version` text.
 * Mirrors the frozen legacy behavior exactly.
 */
export function versionFromTag(tagName) {
  return String(tagName || "").replace(/^ariadnev@/, "").replace(/^v/, "");
}

/**
 * Fail closed when the resolved release does not match a pinned request.
 * Prevents any path where a requested tag silently degrades to `latest`.
 */
export function assertSelectorMatch(selector, tagName) {
  if (selector.mode !== "pinned") return;
  if (versionFromTag(tagName) !== selector.version) {
    throw new SelectorError("resolved-release-mismatch");
  }
}
