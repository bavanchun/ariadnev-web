// Phase 7 bootstrap gate.
//
// The typed screen fixture manifest (`tests/benchmarks/screen-fixtures.json`)
// is the entry point every P7 deterministic gate consumes: route-wide probes,
// keyboard/no-JS journeys, axe, and screenshot baselines all read it so a
// verification run can never target a random route.
//
// This test enforces the shape and required IDs at parse time. It does not
// launch a browser and does not depend on Playwright, so it stays fast enough
// to run in the docs native suite while P7 harness work lands incrementally.

import { test } from "node:test";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const MANIFEST_URL = new URL("../benchmarks/screen-fixtures.json", import.meta.url);
const manifest = JSON.parse(readFileSync(fileURLToPath(MANIFEST_URL), "utf8"));

/** Screen IDs the plan's phase-07 "Required visual fixtures" table names. */
const REQUIRED_IDS = new Set([
  "M01",
  "M02",
  "D00",
  "D01",
  "D02",
  "D03",
  "D06",
  "D11",
  "D12",
  "D14",
  "D15",
  "D16",
  "D17",
  "D18",
]);

test("manifest declares 320/768/1440 as required widths", () => {
  assert.deepEqual(manifest.widths.required, [320, 768, 1440]);
});

test("manifest names every required visual fixture", () => {
  const declared = new Set([...(manifest.site ?? []), ...(manifest.docs ?? [])].map((entry) => entry.id));
  for (const id of REQUIRED_IDS) {
    assert.ok(declared.has(id), `manifest is missing required fixture ${id}`);
  }
});

test("every fixture has surface, route, and description", () => {
  for (const entry of [...manifest.site, ...manifest.docs]) {
    assert.ok(entry.id, "fixture without id");
    assert.match(entry.surface, /^(site|docs)$/, `${entry.id} bad surface ${entry.surface}`);
    assert.ok(entry.route?.startsWith("/"), `${entry.id} route must be absolute`);
    assert.ok(entry.description?.length > 0, `${entry.id} description empty`);
  }
});

test("fixtures targeting a 404 declare expectStatus 404", () => {
  const notFoundIds = new Set(["M02", "D18"]);
  const all = [...manifest.site, ...manifest.docs];
  for (const entry of all) {
    if (notFoundIds.has(entry.id)) {
      assert.equal(entry.expectStatus, 404, `${entry.id} must set expectStatus 404`);
    }
  }
});

test("stress frames reference existing fixture IDs and declare a width", () => {
  const known = new Set([...manifest.site, ...manifest.docs].map((entry) => entry.id));
  for (const frame of manifest.stressFrames) {
    assert.ok(known.has(frame.fixtureId), `stress ${frame.id} references unknown fixture ${frame.fixtureId}`);
    assert.equal(typeof frame.width, "number", `stress ${frame.id} width must be a number`);
    assert.ok(frame.width >= 320, `stress ${frame.id} width must be at least 320`);
  }
});

test("stress frames cover the four plan-mandated frames", () => {
  const ids = new Set(manifest.stressFrames.map((frame) => frame.id));
  for (const id of ["S1-cli-320", "S2-providers-320", "S3-cli-desktop", "S4-vi-journey"]) {
    assert.ok(ids.has(id), `stress frame ${id} missing`);
  }
});
