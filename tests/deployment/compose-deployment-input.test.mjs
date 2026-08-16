import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { composeDeploymentInput } from "../../scripts/deploy/compose-deployment-input.mjs";
import { repoRoot, validateDeploymentInput } from "../../scripts/deploy/validate-deployment-input.mjs";
import { digestPolicy, loadPolicy } from "../../scripts/edge-ingress-policy.mjs";

const sha256 = (path) => `sha256:${createHash("sha256").update(readFileSync(resolve(repoRoot, path))).digest("hex")}`;

test("a composed input is fully pinned and every digest is the committed artifact's", () => {
  const pin = JSON.parse(readFileSync(resolve(repoRoot, "releases/ariadnev.json"), "utf8"));
  const input = composeDeploymentInput({
    environment: "staging",
    productSha: "1".repeat(40),
    evidenceSha: "2".repeat(40),
    units: ["docs", "edge"],
    pinPath: "releases/ariadnev.json",
  });
  assert.equal(validateDeploymentInput(input).valid, true);
  assert.deepEqual(input.release, { tag: pin.tag, version: pin.version, coreSha: pin.sourceSha });
  assert.equal(input.digests.docsBundle, sha256(pin.bundle));
  assert.equal(input.digests.docsManifest, sha256(pin.manifest));
  assert.equal(input.digests.checksums, sha256(pin.bundle.replace(/[^/]+$/, "checksums.txt")));
  assert.equal(input.ingressPolicyDigest, digestPolicy(loadPolicy(), "staging"));
  // The pin's own bundle digest is the same bytes seen from a second path.
  assert.equal(input.digests.docsBundle, `sha256:${pin.bundleSha256}`);
});
