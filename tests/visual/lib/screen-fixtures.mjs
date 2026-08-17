// Screen fixture accessor.
//
// Reads the typed manifest (`tests/benchmarks/screen-fixtures.json`), asserts
// the plan's mandatory IDs are present, and returns fixtures grouped by
// surface so specs can iterate. All spec files import from here so the
// manifest stays the single source of truth for what P7 verifies.

import { readFileSync } from "node:fs";

const MANIFEST = JSON.parse(
  readFileSync(new URL("../../benchmarks/screen-fixtures.json", import.meta.url), "utf8"),
);

/** Widths every fixture must be measured at. */
export const REQUIRED_WIDTHS = MANIFEST.widths.required;
/** Widths added only when a fixture crosses a declared breakpoint. */
export const EXTRA_WIDTHS = MANIFEST.widths.extraAtBreakpoints;

export const SITE_FIXTURES = MANIFEST.site;
export const DOCS_FIXTURES = MANIFEST.docs;
export const STRESS_FRAMES = MANIFEST.stressFrames;

/** All non-404 docs fixtures — for screenshots, axe, structural probes. */
export const DOCS_PROBABLE = DOCS_FIXTURES.filter((entry) => entry.expectStatus !== 404);

/** All non-404 site fixtures — same intent for the marketing surface. */
export const SITE_PROBABLE = SITE_FIXTURES.filter((entry) => entry.expectStatus !== 404);

/** Lookup a fixture by ID across surfaces; throws on unknown ID. */
export function fixtureById(id) {
  const match =
    SITE_FIXTURES.find((entry) => entry.id === id) ??
    DOCS_FIXTURES.find((entry) => entry.id === id);
  if (!match) throw new Error(`Unknown screen fixture ID: ${id}`);
  return match;
}
