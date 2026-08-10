// Candidate B security/cache policy for unprotected static-asset responses.
//
// Under Candidate A the site is a separate deployment whose `_headers` file
// applies this policy. Under Candidate B the combined Worker generates the
// asset responses itself, and `_headers` is not assumed to cover them — so the
// same policy is applied here and parity-tested against Candidate A.
//
// Protected edge responses are never passed through this function; they keep
// the frozen `no-store` release contract.

/** Security headers applied to every unprotected response. */
export const SECURITY_HEADERS = Object.freeze({
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "x-frame-options": "DENY",
  "strict-transport-security": "max-age=31536000; includeSubDomains",
});

/** Cache policy per asset class. Mirrors the approved Candidate A site policy. */
export const CACHE_POLICY = Object.freeze({
  html: "public, max-age=300",
  immutable: "public, max-age=31536000, immutable",
  notFound: "no-store",
});

// Astro emits content-hashed files under `/_astro/`; anything else is treated
// as revalidated content rather than immutable.
const HASHED_ASSET = /^\/_astro\//;

/**
 * Classify an unprotected response for cache purposes.
 * @returns {"html"|"immutable"|"notFound"}
 */
export function classifyStaticResponse(response, pathname) {
  if (response.status === 404) return "notFound";
  if (HASHED_ASSET.test(pathname)) return "immutable";
  const contentType = response.headers.get("content-type") || "";
  if (contentType.startsWith("text/html")) return "html";
  return "immutable";
}

/**
 * Apply the approved static policy to an unprotected `ASSETS` response.
 * Returns a new Response; the input body is reused without buffering.
 */
export function applyStaticResponsePolicy(response, pathname) {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) headers.set(name, value);
  headers.set("cache-control", CACHE_POLICY[classifyStaticResponse(response, pathname)]);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
