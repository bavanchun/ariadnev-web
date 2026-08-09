import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (path) => readFileSync(join(root, path), "utf8");
const map = read("apps/site/src/components/execution-map.astro");
const enhancer = read("apps/site/src/scripts/execution-map-enhancer.ts");
const styles = read("apps/site/src/styles/site.css");

test("the complete semantic graph exists before JavaScript", () => {
  for (const state of ["Compile", "Policy", "Execute", "Checkpoint", "Proof"]) assert.match(map, new RegExp(`>${state}<`));
  assert.equal((map.match(/role="img"/g) || []).length, 2);
  assert.match(map, /map-diagram-horizontal/);
  assert.match(map, /map-diagram-vertical/);
  assert.match(map, /<desc[^>]*>Compile moves through policy, execute, checkpoint, and proof/);
  assert.match(map, /<ol class="map-steps"/);
  assert.equal((map.match(/data-map-node=/g) || []).length, 5);
  assert.equal((map.match(/<a href="#map-state-[a-z]+" data-map-node=/g) || []).length, 5);
  assert.equal((map.match(/<script\b/g) || []).length, 1);
});

test("keyboard traversal, reduced motion, and failed initialization preserve final content", () => {
  for (const key of ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "Home", "End"]) assert.match(enhancer, new RegExp(key));
  assert.match(enhancer, /IntersectionObserver/);
  assert.match(enhancer, /reducedMotion\.matches/);
  assert.match(enhancer, /clearTimeout/);
  assert.match(enhancer, /traversalTimers\.clear/);
  assert.match(enhancer, /!\("IntersectionObserver" in window\)/);
  assert.doesNotMatch(enhancer, /addEventListener\(["']scroll|requestAnimationFrame/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.doesNotMatch(styles, /opacity:\s*0\b|visibility:\s*hidden/);
  assert.doesNotMatch(styles, /transition:\s*all/);
});

test("copy fallback keeps literal commands selectable and status announced", () => {
  const promise = read("apps/site/src/components/promise-section.astro");
  const install = read("apps/site/src/components/final-install.astro");
  assert.match(promise, /<code[^>]*tabindex="0"/);
  assert.match(install, /id="copy-status"[^>]*aria-live="polite"/);
  assert.equal((`${promise}\n${install}`.match(/data-copy-target=[^>]+hidden/g) || []).length, 2);
  assert.match(enhancer, /button\.hidden = false/);
  assert.match(enhancer, /navigator\.clipboard\?\.writeText/);
  assert.match(enhancer, /selectAllChildren/);
  assert.match(enhancer, /Automatic copy is unavailable/);
});

test("focus, target size, print, and narrow-width fallbacks are explicit", () => {
  assert.match(styles, /min-height: var\(--vc-size-control-minimum\)/);
  assert.match(styles, /min-width: var\(--vc-size-control-minimum\)/);
  assert.match(styles, /\.evidence-ledger a/);
  assert.match(styles, /code\[tabindex="0"\]/);
  assert.match(styles, /outline: var\(--vc-focus-ring-width\) solid var\(--vc-color-focus\)/);
  assert.match(styles, /var\(--vc-color-focus-contrast\)/);
  assert.match(styles, /@media print/);
  assert.match(styles, /@media \(max-width: 24rem\)/);
  assert.match(styles, /overflow-x: clip/);
});
