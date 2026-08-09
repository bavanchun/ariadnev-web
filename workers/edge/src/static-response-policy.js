const HASHED_ASSET = /(?:^|\/)[^/]+(?:[-_.])[0-9a-f]{6,}\.[a-z0-9]+$/i;
const ASTRO_ASSET = /^\/_astro\/[^/]+$/;
const CONTENT_SECURITY_POLICY = "default-src 'self'; base-uri 'self'; connect-src 'self'; font-src 'self'; form-action 'self'; frame-ancestors 'none'; img-src 'self' data:; object-src 'none'; script-src 'self'; style-src 'self'";
const PERMISSIONS_POLICY = "camera=(), geolocation=(), microphone=(), payment=(), usb=()";

export function applyStaticResponsePolicy(response, pathname) {
  const headers = new Headers(response.headers);
  headers.set("content-security-policy", CONTENT_SECURITY_POLICY);
  headers.set("permissions-policy", PERMISSIONS_POLICY);
  headers.set("x-content-type-options", "nosniff");
  headers.set("referrer-policy", "strict-origin-when-cross-origin");
  headers.set("x-frame-options", "DENY");

  if (response.status >= 400) {
    headers.set("cache-control", "no-store");
  } else if (ASTRO_ASSET.test(pathname) || HASHED_ASSET.test(pathname)) {
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
