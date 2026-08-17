import assert from "node:assert/strict";
import { existsSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const repoRoot = resolve(import.meta.dirname, "../..");
const ratchetPath = resolve(repoRoot, "tests/benchmarks/docs-per-route-ratchet.json");
const outRoot = resolve(repoRoot, "apps/docs/out");

test("the per-route ratchet manifest is a well-formed ratchet-down-only contract", async () => {
  const ratchet = JSON.parse(await readFile(ratchetPath, "utf8"));
  assert.equal(ratchet.schemaVersion, 1);
  assert.equal(ratchet.policy, "ratchet-down-only");
  assert.equal(ratchet.capUnderRatchet, 306000);
  // jitterToleranceBytes: absorbs Next.js build-id non-determinism on the
  // grandfathered ceilings only. Small values (≤128) keep the guard useful;
  // 0 or missing means the ceiling is enforced exactly.
  if (ratchet.jitterToleranceBytes !== undefined) {
    assert.ok(Number.isSafeInteger(ratchet.jitterToleranceBytes) && ratchet.jitterToleranceBytes >= 0 && ratchet.jitterToleranceBytes <= 128, "jitterToleranceBytes must be an integer in [0, 128]");
  }
  assert.match(ratchet.measuredAt, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(Array.isArray(ratchet.grandfathered));
  const seen = new Set();
  for (const entry of ratchet.grandfathered) {
    assert.match(entry.route, /^\/[a-z]{2}\/[a-z0-9.-]+\/.*\/$/);
    assert.ok(Number.isSafeInteger(entry.ceiling), `${entry.route} ceiling must be a safe integer`);
    // A grandfathered ceiling that is ≤ the frozen cap does not belong on this
    // list — it should just respect the cap directly. Keeping such an entry
    // would let a future build regress silently to the ceiling.
    assert.ok(entry.ceiling > ratchet.capUnderRatchet, `${entry.route} ceiling (${entry.ceiling}) is not above the ${ratchet.capUnderRatchet} cap`);
    assert.ok(typeof entry.note === "string" && entry.note.length > 0, `${entry.route} missing note`);
    assert.ok(!seen.has(entry.route), `${entry.route} appears twice in the ratchet manifest`);
    seen.add(entry.route);
  }
});

test("every grandfathered route in the ratchet manifest points at a real output file", async () => {
  const ratchet = JSON.parse(await readFile(ratchetPath, "utf8"));
  // If out/ does not exist, this test is a no-op — the qualification pipeline
  // builds it before verify-static-budget runs, and the ratchet manifest is
  // measured against that build. A CI environment that hasn't built yet
  // would false-positive; skip in that case.
  if (!existsSync(outRoot)) return;
  for (const entry of ratchet.grandfathered) {
    const indexHtml = resolve(outRoot, entry.route.replace(/^\/+/, ""), "index.html");
    assert.ok(existsSync(indexHtml), `${entry.route} → ${indexHtml} does not exist under out/`);
    assert.ok(statSync(indexHtml).isFile(), `${entry.route} → ${indexHtml} is not a file`);
  }
});
