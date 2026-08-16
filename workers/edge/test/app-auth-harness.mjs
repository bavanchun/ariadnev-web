// Test-only GitHub App signing material.
//
// The signing key is generated per run rather than committed: a repository that
// bans committed secrets should not make an exception for a key that happens to
// be worthless, and a generated key also proves the PKCS#8 path end to end.

const KEY_ALGORITHM = Object.freeze({
  name: "RSASSA-PKCS1-v1_5",
  modulusLength: 2048,
  publicExponent: new Uint8Array([1, 0, 1]),
  hash: "SHA-256",
});

function toPem(der, label) {
  let binary = "";
  for (const byte of der) binary += String.fromCharCode(byte);
  const base64 = btoa(binary).replace(/(.{64})/g, "$1\n");
  return `-----BEGIN ${label}-----\n${base64}\n-----END ${label}-----\n`;
}

/** A PKCS#8 PEM plus the public key needed to verify what the Worker signed. */
export async function createTestAppKey() {
  const pair = await crypto.subtle.generateKey(KEY_ALGORITHM, true, ["sign", "verify"]);
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey("pkcs8", pair.privateKey));
  return { privateKeyPem: toPem(pkcs8, "PRIVATE KEY"), publicKey: pair.publicKey };
}

/** The same bytes in the PKCS#1 wrapper GitHub actually hands out. */
export function asPkcs1Pem(pkcs8Pem) {
  const body = pkcs8Pem.replace(/-----(BEGIN|END) PRIVATE KEY-----/g, "").trim();
  return `-----BEGIN RSA PRIVATE KEY-----\n${body}\n-----END RSA PRIVATE KEY-----\n`;
}

export const APP_ID = "1234567";
export const INSTALLATION_ID = "89101112";
export const TOKEN_URL = `https://api.github.com/app/installations/${INSTALLATION_ID}/access_tokens`;

export function appEnv(privateKeyPem) {
  return { GH_APP_ID: APP_ID, GH_APP_INSTALLATION_ID: INSTALLATION_ID, GH_APP_PRIVATE_KEY: privateKeyPem };
}
