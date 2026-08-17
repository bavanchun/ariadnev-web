// Phase 7 route-wide structural probes (static, no browser).
//
// For every docs fixture in the manifest that maps to a real generated
// route, read the built HTML from `apps/docs/out/…/index.html` and assert
// the page-identity contract that P7 keyboard/no-JS journeys later depend
// on: correct <html lang>, non-empty <title>, a landmark <main>, and at
// least one <h1>. This runs in the docs native suite so drift is caught
// on every build without waiting on the Playwright harness.
//
// 404-expectation fixtures are skipped here — they are exercised by the
// site progressive-enhancement 404 test and by the future browser probe.

import { test } from "node:test";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const REPO_ROOT = fileURLToPath(new URL("../..", import.meta.url));
const MANIFEST = JSON.parse(
  readFileSync(new URL("../benchmarks/screen-fixtures.json", import.meta.url), "utf8"),
);

const DOCS_OUT = `${REPO_ROOT}apps/docs/out`;

/** Convert a manifest docs route to the built HTML file path. */
function htmlFor(route) {
  const trimmed = route.replace(/^\//, "").replace(/\/$/, "");
  return trimmed === "" ? `${DOCS_OUT}/index.html` : `${DOCS_OUT}/${trimmed}/index.html`;
}

const probable = MANIFEST.docs.filter((entry) => entry.expectStatus !== 404);

for (const fixture of probable) {
  test(`${fixture.id} structural identity — ${fixture.route}`, () => {
    const path = htmlFor(fixture.route);
    if (!existsSync(path)) {
      // A missing route indicates the docs build did not generate the
      // manifest's canonical route: surface it as a real failure rather than
      // a skip so the manifest and the generator stay in agreement.
      assert.fail(`${fixture.id} route ${fixture.route} not built: ${path}`);
    }
    const html = readFileSync(path, "utf8");

    const langMatch = html.match(/<html\s+lang="([^"]+)"/i);
    assert.ok(langMatch, `${fixture.id} <html lang> missing`);
    if (fixture.locale) {
      assert.equal(langMatch[1], fixture.locale, `${fixture.id} lang expected ${fixture.locale}`);
    }

    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    assert.ok(titleMatch && titleMatch[1].trim().length > 0, `${fixture.id} title empty`);

    assert.match(html, /<main\b/i, `${fixture.id} missing <main> landmark`);
    assert.match(html, /<h1\b/i, `${fixture.id} missing an <h1>`);
  });
}
