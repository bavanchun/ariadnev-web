// GitHub App authentication for the ariadnev public edge.
//
// The edge reads a private repository, so every upstream call carries a
// credential and the whole public install path lives or dies with it. A
// personal access token expires on a fixed date and takes `/install`,
// `/version`, and `/download/<asset>` down silently on that date; a GitHub App
// private key has no expiry, so the durable shape is:
//
//   private key (no expiry) -> app JWT (<=10 min) -> installation token (1 h)
//
// Only the last one ever reaches GitHub's release endpoints, and it is cached
// until shortly before it lapses so a burst of installs mints at most one.
//
// Secrets, all three required:
//   GH_APP_ID              — the App's application (or client) id
//   GH_APP_INSTALLATION_ID — the installation on bavanchun/ariadnev-kit
//   GH_APP_PRIVATE_KEY     — PKCS#8 PEM ("BEGIN PRIVATE KEY")
//
// GitHub hands out PKCS#1 ("BEGIN RSA PRIVATE KEY"), which WebCrypto cannot
// import; converting it once is a documented setup step and a wrong-format key
// fails with an explicit reason rather than an opaque import error.

import { API, USER_AGENT } from "./github-release.js";

// GitHub rejects an app JWT whose `exp` is more than 10 minutes out.
const JWT_LIFETIME_SECONDS = 540;
// GitHub recommends backdating `iat` to absorb clock drift against their clock.
const JWT_BACKDATE_SECONDS = 60;
// Renew this long before the hour is up, so an in-flight request never carries
// a token that expires between here and GitHub.
const REFRESH_MARGIN_SECONDS = 300;
const DEFAULT_TOKEN_LIFETIME_SECONDS = 3600;

const PKCS8_HEADER = "-----BEGIN PRIVATE KEY-----";
const PKCS8_FOOTER = "-----END PRIVATE KEY-----";
const PKCS1_HEADER = "-----BEGIN RSA PRIVATE KEY-----";

const SIGNING_ALGORITHM = Object.freeze({ name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" });

/** Credential failure. Carries a stable reason for logs; never carries key material. */
export class AuthError extends Error {
  constructor(reason, status) {
    super(`github app auth failed: ${reason}`);
    this.name = "AuthError";
    this.reason = reason;
    this.status = status;
  }
}

/** All three secrets present. Checked synchronously, before any network work. */
export function hasAppCredentials(env) {
  return Boolean(env?.GH_APP_ID && env?.GH_APP_INSTALLATION_ID && env?.GH_APP_PRIVATE_KEY);
}

function base64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const encodeSegment = (value) => base64Url(new TextEncoder().encode(JSON.stringify(value)));

/**
 * PEM text to DER bytes.
 * Secret stores differ in how they carry newlines, so an escaped `\n` is
 * accepted: a key that survives a copy-paste is worth more than a strict parse.
 */
export function pemToDer(pem) {
  const normalized = String(pem).replace(/\\n/g, "\n").replace(/\r/g, "").trim();
  if (normalized.includes(PKCS1_HEADER)) throw new AuthError("private-key-is-pkcs1");
  if (!normalized.includes(PKCS8_HEADER)) throw new AuthError("private-key-not-pem");
  const body = normalized.slice(normalized.indexOf(PKCS8_HEADER) + PKCS8_HEADER.length);
  const base64 = body.slice(0, body.indexOf(PKCS8_FOOTER) === -1 ? undefined : body.indexOf(PKCS8_FOOTER)).replace(/\s+/g, "");
  if (base64 === "") throw new AuthError("private-key-empty");
  let binary;
  try {
    binary = atob(base64);
  } catch {
    throw new AuthError("private-key-not-base64");
  }
  const der = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) der[index] = binary.charCodeAt(index);
  return der;
}

// Importing a key costs a few milliseconds; an isolate reuses the same PEM for
// its whole life, so it is imported once.
const keyCache = new Map();

async function importSigningKey(pem) {
  const cached = keyCache.get(pem);
  if (cached) return cached;
  let key;
  try {
    key = await crypto.subtle.importKey("pkcs8", pemToDer(pem), SIGNING_ALGORITHM, false, ["sign"]);
  } catch (error) {
    if (error instanceof AuthError) throw error;
    throw new AuthError("private-key-import-rejected");
  }
  keyCache.set(pem, key);
  return key;
}

/** RS256 app JWT. Identifies the App itself, never an installation. */
export async function createAppJwt({ appId, privateKeyPem, nowSeconds }) {
  const key = await importSigningKey(privateKeyPem);
  const header = encodeSegment({ alg: "RS256", typ: "JWT" });
  const payload = encodeSegment({
    iat: nowSeconds - JWT_BACKDATE_SECONDS,
    exp: nowSeconds + JWT_LIFETIME_SECONDS,
    iss: String(appId),
  });
  const signingInput = `${header}.${payload}`;
  const signature = await crypto.subtle.sign(SIGNING_ALGORITHM.name, key, new TextEncoder().encode(signingInput));
  return `${signingInput}.${base64Url(new Uint8Array(signature))}`;
}

/**
 * Exchange the app JWT for a one-hour installation token.
 * GitHub's error body may describe the App; it is never surfaced or logged.
 */
export async function mintInstallationToken({ env, fetchImpl = fetch, nowSeconds }) {
  const jwt = await createAppJwt({
    appId: env.GH_APP_ID,
    privateKeyPem: env.GH_APP_PRIVATE_KEY,
    nowSeconds,
  });
  const response = await fetchImpl(`${API}/app/installations/${encodeURIComponent(env.GH_APP_INSTALLATION_ID)}/access_tokens`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwt}`,
      "User-Agent": USER_AGENT,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!response.ok) throw new AuthError("installation-token-rejected", response.status);

  let body;
  try {
    body = await response.json();
  } catch {
    throw new AuthError("installation-token-unreadable", response.status);
  }
  if (typeof body?.token !== "string" || body.token === "") throw new AuthError("installation-token-absent", response.status);

  const parsed = Date.parse(body.expires_at ?? "");
  return {
    token: body.token,
    // An unparsable `expires_at` degrades to GitHub's documented one hour rather
    // than to an unbounded cache entry.
    expiresAtSeconds: Number.isNaN(parsed) ? nowSeconds + DEFAULT_TOKEN_LIFETIME_SECONDS : Math.floor(parsed / 1000),
  };
}

// One entry per installation. A concurrent burst shares the in-flight mint
// instead of each request opening its own.
const tokenCache = new Map();

/** Test seam: isolates cannot be recycled between cases in-process. */
export function resetAuthCaches() {
  tokenCache.clear();
  keyCache.clear();
}

/**
 * The credential to send upstream. Cached until the refresh margin, so steady
 * traffic mints roughly once an hour per isolate.
 */
export async function resolveInstallationToken(env, fetchImpl = fetch, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (!hasAppCredentials(env)) throw new AuthError("credentials-absent");

  const cacheKey = `${env.GH_APP_ID}/${env.GH_APP_INSTALLATION_ID}`;
  const entry = tokenCache.get(cacheKey);
  if (entry?.token && entry.expiresAtSeconds - REFRESH_MARGIN_SECONDS > nowSeconds) return entry.token;
  if (entry?.pending) return entry.pending;

  const pending = mintInstallationToken({ env, fetchImpl, nowSeconds })
    .then((minted) => {
      tokenCache.set(cacheKey, { token: minted.token, expiresAtSeconds: minted.expiresAtSeconds });
      return minted.token;
    })
    .catch((error) => {
      // A failed mint must not pin a rejected promise in the cache; the next
      // request retries from scratch.
      tokenCache.delete(cacheKey);
      throw error;
    });

  tokenCache.set(cacheKey, { pending });
  return pending;
}
