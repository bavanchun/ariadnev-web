const HASHED_ASSET = /(?:^|\/)[^/]+(?:[-_.])[0-9a-f]{6,}\.[a-z0-9]+$/i;

export function applyStaticResponsePolicy(response, pathname) {
  const headers = new Headers(response.headers);
  headers.set("x-content-type-options", "nosniff");
  headers.set("referrer-policy", "strict-origin-when-cross-origin");
  headers.set("x-frame-options", "DENY");

  if (response.status >= 400) {
    headers.set("cache-control", "no-store");
  } else if (HASHED_ASSET.test(pathname)) {
    headers.set("cache-control", "public, max-age=31536000, immutable");
  } else {
    const contentType = headers.get("content-type") || "";
    headers.set("cache-control", contentType.startsWith("text/html") ? "public, max-age=300" : "public, max-age=300");
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
