import { createHash } from "node:crypto";
import test from "node:test";

import {
  buildIngressRule,
  buildIngressRuleDefinition,
  ingressPolicyDigest,
  loadIngressPolicy,
  rawDownloadPathNeedsIngressBlock,
} from "../../../scripts/edge-ingress-policy.mjs";
import { assert } from "./edge-test-helpers.mjs";

test("raw dot-segment guard catches every URL-normalization escape without blocking valid encoded filenames", () => {
  const blocked = [
    "/download/.",
    "/download/%2e",
    "/download/..",
    "/download/%2E%2e",
    "/download/.%2E/checksums.txt",
    "/download/a/%2e./checksums.txt",
    "/download/a/../checksums.txt?version=1.2.3",
  ];
  const allowed = [
    "/download/checksums.txt",
    "/download/checksums%2Etxt",
    "/download/a..b",
    "/download/%252e%252e",
    "/download/%2e%2fsecret",
    "/download",
    "/Download/%2e%2e",
  ];
  for (const path of blocked) assert.equal(rawDownloadPathNeedsIngressBlock(path), true, path);
  for (const path of allowed) assert.equal(rawDownloadPathNeedsIngressBlock(path), false, path);
});

test("Cloudflare rule is staging-only until production cutover and uses raw pre-normalization fields", async () => {
  const policy = await loadIngressPolicy();
  const staging = buildIngressRule(policy, "staging");
  const production = buildIngressRule(policy, "production");
  assert.equal(staging.enabled, true);
  assert.equal(production.enabled, false);
  assert.match(staging.expression, /raw\.http\.request\.uri\.path/);
  assert.match(staging.expression, /starts_with\(raw\.http\.request\.uri\.path, \"\/download\/\"\)/);
  assert.doesNotMatch(staging.expression, /starts_with\(lower\(raw\.http\.request\.uri\.path\)/);
  assert.match(staging.expression, /staging\.vcskill\.vchun\.dev/);
  assert.doesNotMatch(staging.expression, /vcskill\.vchun\.dev\" and.*production/);
  assert.match(production.expression, /http\.host eq \"vcskill\.vchun\.dev\"/);
  assert.match(ingressPolicyDigest(policy, "staging"), /^[0-9a-f]{64}$/);
  assert.deepEqual(
    buildIngressRule(policy, "production", { enabled: true }),
    { ...buildIngressRuleDefinition(policy, "production"), enabled: true },
  );
  assert.equal(
    ingressPolicyDigest(policy, "production"),
    createHash("sha256").update(JSON.stringify({
      phase: policy.phase,
      definition: buildIngressRuleDefinition(policy, "production"),
    })).digest("hex"),
    "activation state must not change the immutable rule-definition digest",
  );
});
