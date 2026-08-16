// Credential-acquisition tests.
//
// `index.test.mjs` mints once and then asserts route behavior against a warm
// cache; everything about how that token is obtained, cached, refreshed, and
// failed is asserted here, including through the Worker's own entry point.

import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

import edge from "./index.js";
import {
  AuthError,
  createAppJwt,
  mintInstallationToken,
  pemToDer,
  resetAuthCaches,
  resolveInstallationToken,
} from "./github-app-auth.js";
import { APP_ID, TOKEN_URL, appEnv, asPkcs1Pem, createTestAppKey } from "../test/app-auth-harness.mjs";

const { privateKeyPem, publicKey } = await createTestAppKey();
const ENV = appEnv(privateKeyPem);
const MINTED = "ghs_installation_token_fixture";
const BASE = "https://ariadnev.com";

const NOW = 1_800_000_000;
const hourFrom = (seconds) => new Date((seconds + 3600) * 1000).toISOString();

/** Upstream that answers the mint endpoint and one release lookup. */
function createMockFetch({ mintStatus = 201, mintBody, releaseStatus = 200 } = {}) {
  const calls = [];
  const impl = async (input, init = {}) => {
    const url = typeof input === "string" ? input : input.url;
    calls.push({ url, init });
    if (url === TOKEN_URL) {
      if (mintStatus >= 400) return new Response("App suspended by the account owner", { status: mintStatus });
      return Response.json(mintBody ?? { token: MINTED, expires_at: hourFrom(NOW) }, { status: mintStatus });
    }
    if (url.endsWith("/releases/latest")) {
      if (releaseStatus >= 400) return new Response("upstream failure", { status: releaseStatus });
      return Response.json({ tag_name: "ariadnev@1.0.0", assets: [] });
    }
    throw new Error(`unexpected upstream fetch: ${url}`);
  };
  impl.calls = calls;
  impl.mints = () => calls.filter((entry) => entry.url === TOKEN_URL);
  return impl;
}

async function invoke(path, { env = ENV, fetchImpl = createMockFetch() } = {}) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = fetchImpl;
  try {
    const response = await edge.fetch(new Request(`${BASE}${path}`), env);
    return { status: response.status, bodyText: await response.text(), upstream: fetchImpl };
  } finally {
    globalThis.fetch = originalFetch;
  }
}

beforeEach(() => resetAuthCaches());

// ------------------------------------------------------------------ key format

test("pemToDer accepts PKCS#8 and names every rejected key shape", () => {
  assert.ok(pemToDer(privateKeyPem).length > 100);
  // Secret stores that flatten newlines must not break the deployment.
  assert.deepEqual(pemToDer(privateKeyPem.replace(/\n/g, "\\n")), pemToDer(privateKeyPem));

  const rejected = [
    [asPkcs1Pem(privateKeyPem), "private-key-is-pkcs1"],
    ["not a key at all", "private-key-not-pem"],
    ["-----BEGIN PRIVATE KEY-----\n\n-----END PRIVATE KEY-----", "private-key-empty"],
    ["-----BEGIN PRIVATE KEY-----\n***\n-----END PRIVATE KEY-----", "private-key-not-base64"],
  ];
  for (const [pem, reason] of rejected) {
    assert.throws(
      () => pemToDer(pem),
      (error) => error instanceof AuthError && error.reason === reason,
      `${reason} must be reported explicitly`,
    );
  }
});

// ------------------------------------------------------------------------ JWT

test("app JWT is RS256, verifiable, backdated, and inside GitHub's ten-minute limit", async () => {
  const jwt = await createAppJwt({ appId: APP_ID, privateKeyPem, nowSeconds: NOW });
  const [header, payload, signature] = jwt.split(".");
  assert.equal(jwt.split(".").length, 3);

  const decode = (segment) => JSON.parse(Buffer.from(segment, "base64url").toString("utf8"));
  assert.deepEqual(decode(header), { alg: "RS256", typ: "JWT" });

  const claims = decode(payload);
  assert.equal(claims.iss, APP_ID);
  assert.ok(claims.iat < NOW, "iat must be backdated against clock drift");
  assert.ok(claims.exp - NOW <= 600, "GitHub rejects an exp more than ten minutes out");
  assert.ok(claims.exp > NOW, "jwt must still be valid when it is sent");

  const verified = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    publicKey,
    Buffer.from(signature, "base64url"),
    new TextEncoder().encode(`${header}.${payload}`),
  );
  assert.ok(verified, "signature must verify against the App's public key");
});

// -------------------------------------------------------------------- minting

test("minting posts an authenticated request and returns the token with its expiry", async () => {
  const fetchImpl = createMockFetch();
  const minted = await mintInstallationToken({ env: ENV, fetchImpl, nowSeconds: NOW });

  assert.equal(minted.token, MINTED);
  assert.equal(minted.expiresAtSeconds, NOW + 3600);

  const [call] = fetchImpl.mints();
  assert.equal(call.init.method, "POST");
  assert.match(call.init.headers.Authorization, /^Bearer [\w-]+\.[\w-]+\.[\w-]+$/);
  assert.equal(call.init.headers.Accept, "application/vnd.github+json");
  assert.equal(call.init.headers["User-Agent"], "ariadnev-edge");
});

test("an unusable mint response fails closed and never carries GitHub's body", async () => {
  const cases = [
    [{ mintStatus: 401 }, "installation-token-rejected", 401],
    [{ mintBody: { expires_at: hourFrom(NOW) } }, "installation-token-absent", 201],
  ];
  for (const [options, reason, status] of cases) {
    await assert.rejects(
      mintInstallationToken({ env: ENV, fetchImpl: createMockFetch(options), nowSeconds: NOW }),
      (error) => {
        assert.ok(error instanceof AuthError);
        assert.equal(error.reason, reason);
        assert.equal(error.status, status);
        assert.ok(!error.message.includes("suspended"), "upstream body leaked into the error");
        return true;
      },
    );
  }
});

test("an expires_at GitHub did not send degrades to the documented hour", async () => {
  const fetchImpl = createMockFetch({ mintBody: { token: MINTED, expires_at: "not a date" } });
  const minted = await mintInstallationToken({ env: ENV, fetchImpl, nowSeconds: NOW });
  assert.equal(minted.expiresAtSeconds, NOW + 3600);
});

// --------------------------------------------------------------------- caching

test("a cached token is reused until the refresh margin, then renewed", async () => {
  const fetchImpl = createMockFetch();
  assert.equal(await resolveInstallationToken(ENV, fetchImpl, NOW), MINTED);
  assert.equal(await resolveInstallationToken(ENV, fetchImpl, NOW + 60), MINTED);
  assert.equal(fetchImpl.mints().length, 1, "a warm cache must not mint again");

  // Inside the five-minute margin the token is still valid upstream, and is
  // replaced anyway so no request leaves here holding one about to lapse.
  await resolveInstallationToken(ENV, fetchImpl, NOW + 3600 - 120);
  assert.equal(fetchImpl.mints().length, 2, "an almost-expired token must be renewed");
});

test("a concurrent burst mints once and a failed mint is not cached", async () => {
  const fetchImpl = createMockFetch();
  const burst = await Promise.all(Array.from({ length: 8 }, () => resolveInstallationToken(ENV, fetchImpl, NOW)));
  assert.deepEqual(new Set(burst), new Set([MINTED]));
  assert.equal(fetchImpl.mints().length, 1, "eight simultaneous installs must share one mint");

  resetAuthCaches();
  const failing = createMockFetch({ mintStatus: 500 });
  await assert.rejects(resolveInstallationToken(ENV, failing, NOW), AuthError);
  await assert.rejects(resolveInstallationToken(ENV, failing, NOW), AuthError);
  assert.equal(failing.mints().length, 2, "a failure must not pin a rejected promise in the cache");
});

test("absent credentials are refused before any network call", async () => {
  const fetchImpl = createMockFetch();
  for (const env of [{}, { GH_APP_ID: APP_ID }, { ...ENV, GH_APP_PRIVATE_KEY: "" }]) {
    await assert.rejects(
      resolveInstallationToken(env, fetchImpl, NOW),
      (error) => error instanceof AuthError && error.reason === "credentials-absent",
    );
  }
  assert.equal(fetchImpl.calls.length, 0);
});

// ----------------------------------------------------------- through the Worker

test("a protected route mints once and sends the installation token upstream", async () => {
  const result = await invoke("/version");
  assert.equal(result.status, 200);
  assert.equal(result.bodyText, "1.0.0");

  const mints = result.upstream.mints();
  assert.equal(mints.length, 1);
  const release = result.upstream.calls.find((entry) => entry.url.endsWith("/releases/latest"));
  assert.equal(release.init.headers.Authorization, `Bearer ${MINTED}`);

  // A second request on the same isolate reuses the cached token.
  const again = await invoke("/version", { fetchImpl: result.upstream });
  assert.equal(again.status, 200);
  assert.equal(result.upstream.mints().length, 1);
});

test("an unprotected path never mints a token", async () => {
  const assets = { fetch: async () => new Response("<html>site</html>", { headers: { "content-type": "text/html" } }) };
  const fetchImpl = createMockFetch();
  const result = await invoke("/", { env: { ...ENV, ASSETS: assets }, fetchImpl });
  assert.equal(result.status, 200);
  assert.equal(fetchImpl.calls.length, 0, "serving the site must not touch GitHub");
});

test("a dead credential fails closed as 502 without leaking why", async () => {
  const result = await invoke("/version", { fetchImpl: createMockFetch({ mintStatus: 401 }) });
  assert.equal(result.status, 502);
  assert.equal(result.bodyText, "edge request failed\n");
  assert.ok(!result.bodyText.includes("suspended"));
});

test("a Worker deployed without App secrets keeps the frozen missing-secret contract", async () => {
  const fetchImpl = createMockFetch();
  const result = await invoke("/version", { env: {}, fetchImpl });
  assert.equal(result.status, 500);
  assert.equal(result.bodyText, "worker misconfigured: GH_TOKEN unset");
  assert.equal(fetchImpl.calls.length, 0);
});
