// Phase 7 static EN/VI chrome-key parity (step 10).
//
// The docs shell (header, sidebar, breadcrumb, TOC, pager) renders the same
// structural markers regardless of locale — only the text inside them is
// translated. This test reads the built D01 (EN) and D01-vi (VI) home pages
// and asserts the two carry the identical set of chrome-owning class names,
// id anchors, and ARIA roles, independent of translated copy. A missing
// marker on one locale means the shell diverged structurally between EN and
// VI, which is exactly the drift this gate exists to catch.

import { test } from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const REPO_ROOT = fileURLToPath(new URL("../..", import.meta.url));
const DOCS_OUT = `${REPO_ROOT}apps/docs/out`;

const MANIFEST = JSON.parse(
  readFileSync(new URL("../benchmarks/screen-fixtures.json", import.meta.url), "utf8"),
);

function htmlFor(route) {
  const trimmed = route.replace(/^\//, "").replace(/\/$/, "");
  return trimmed === "" ? `${DOCS_OUT}/index.html` : `${DOCS_OUT}/${trimmed}/index.html`;
}

function fixture(id) {
  const match = MANIFEST.docs.find((entry) => entry.id === id);
  assert.ok(match, `manifest missing fixture ${id}`);
  return match;
}

/** Extract the locale-independent chrome markers from built HTML. */
function chromeKeys(html) {
  const classes = [...html.matchAll(/class="(docs-[a-z-]*)"/g)].map((m) => m[1]);
  const ids = [...html.matchAll(/id="(docs-[a-z-]*)"/g)].map((m) => m[1]);
  const roles = [...html.matchAll(/role="([a-z]+)"/g)].map((m) => m[1]);
  return {
    classes: new Set(classes),
    ids: new Set(ids),
    roles: new Set(roles),
  };
}

test("EN/VI docs home chrome-key parity", () => {
  const en = fixture("D01");
  const vi = fixture("D01-vi");

  const enHtml = readFileSync(htmlFor(en.route), "utf8");
  const viHtml = readFileSync(htmlFor(vi.route), "utf8");

  const enKeys = chromeKeys(enHtml);
  const viKeys = chromeKeys(viHtml);

  assert.deepEqual(
    [...enKeys.classes].sort(),
    [...viKeys.classes].sort(),
    "docs-* chrome class markers differ between EN and VI",
  );
  assert.deepEqual(
    [...enKeys.ids].sort(),
    [...viKeys.ids].sort(),
    "docs-* chrome id anchors differ between EN and VI",
  );
  assert.deepEqual(
    [...enKeys.roles].sort(),
    [...viKeys.roles].sort(),
    "chrome ARIA roles differ between EN and VI",
  );

  // A parity check that silently passes on an empty set is not a check.
  assert.ok(enKeys.classes.size > 0, "no docs-* chrome classes found in EN home — probe is broken");
});
