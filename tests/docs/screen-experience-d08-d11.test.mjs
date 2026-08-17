// Phase 4 Slice D — D08/D09/D10/D11 screen-experience tests.
//
// Mirrors `screen-experience-d05-d07.test.mjs`: reads the built HTML from
// `apps/docs/out/…/index.html` (`pnpm run build` must run first) and asserts
// each experience's structural contract — the identity elements the wrapper
// adds, EN/VI parity of structure (not translated text), the authored MDX
// facts survive untouched, and everything is present without any
// client-side JavaScript (a static build has none to run).

import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const REPO_ROOT = fileURLToPath(new URL("../..", import.meta.url));
const DOCS_OUT = `${REPO_ROOT}apps/docs/out`;
const catalog = JSON.parse(readFileSync(`${REPO_ROOT}apps/docs/content/generated/catalog.json`, "utf8"));

function readRoute(route) {
  const trimmed = route.replace(/^\//, "").replace(/\/$/, "");
  const path = trimmed === "" ? `${DOCS_OUT}/index.html` : `${DOCS_OUT}/${trimmed}/index.html`;
  if (!existsSync(path)) assert.fail(`route ${route} not built at ${path}; run "pnpm run build" first`);
  return readFileSync(path, "utf8");
}

// Fenced code blocks render through shiki, which wraps every syntax token in
// its own adjacent `<span>` with no inserted whitespace — the literal
// command string only exists once every tag is removed, not once tags are
// replaced by a separating space (that would insert whitespace shiki never
// emits, e.g. splitting `https://` into `https: //`).
function stripTags(html) {
  return html.replace(/<[^>]+>/g, "");
}

function nodeCount(html) {
  return (html.match(/class="wd-node(?!-)[^"]*"/g) ?? []).length;
}

// --- D08 upgrading -----------------------------------------------------------

const D08_ROUTES = {
  en: `/en/${catalog.stableAlias}/guides/upgrading/`,
  vi: `/vi/${catalog.stableAlias}/guides/upgrading/`,
};

for (const locale of ["en", "vi"]) {
  test(`D08 (${locale}): the upgrade-recipe topology renders as an aria-hidden diagram with its text/table equivalent, no JS required`, () => {
    const html = readRoute(D08_ROUTES[locale]);
    assert.match(html, /<svg[^>]*aria-hidden="true"[^>]*class="wd-svg"/);
    assert.match(html, /<ol>/);
    assert.match(html, /<table>/);
    assert.ok(nodeCount(html) >= 4, `expected at least 4 topology nodes (check, update, reinstall, doctor), got ${nodeCount(html)}`);
  });

  test(`D08 (${locale}): the authored docs-selector-is-not-installed-version boundary survives untouched in initial HTML`, () => {
    const html = readRoute(D08_ROUTES[locale]);
    assert.match(html, /<blockquote>/);
    const text = stripTags(html);
    assert.ok(text.includes("docs version selector is not the installed version") || text.includes("Bộ chọn phiên bản tài liệu không phải là phiên bản đã cài"));
  });

  test(`D08 (${locale}): the authored update commands survive untouched in initial HTML`, () => {
    const text = stripTags(readRoute(D08_ROUTES[locale]));
    assert.ok(text.includes("ariadnev update"));
    assert.ok(text.includes("ariadnev update --check"));
  });
}

test("D08: EN and VI topology headings are localized while node count stays equivalent", () => {
  const en = readRoute(D08_ROUTES.en);
  const vi = readRoute(D08_ROUTES.vi);
  assert.match(en, /Upgrade recipe/);
  assert.match(vi, /Quy trình nâng cấp/);
  assert.equal(nodeCount(en), nodeCount(vi));
});

// --- D09 configuration ---------------------------------------------------------

const D09_ROUTES = {
  en: `/en/${catalog.stableAlias}/guides/configuration/`,
  vi: `/vi/${catalog.stableAlias}/guides/configuration/`,
};

for (const locale of ["en", "vi"]) {
  test(`D09 (${locale}): the config-resolution topology renders as an aria-hidden diagram with its text/table equivalent, no JS required`, () => {
    const html = readRoute(D09_ROUTES[locale]);
    assert.match(html, /<svg[^>]*aria-hidden="true"[^>]*class="wd-svg"/);
    assert.match(html, /<table>/);
    assert.ok(nodeCount(html) >= 6, `expected at least 6 topology nodes (user, project, resolve, effective, rejected, redacted), got ${nodeCount(html)}`);
  });

  test(`D09 (${locale}): the rejected-key and redaction outcomes are drawn on dashed edges out of the resolver`, () => {
    const html = readRoute(D09_ROUTES[locale]);
    assert.match(html, /stroke-dasharray="4 3"/);
  });

  test(`D09 (${locale}): the authored may-set/may-not-set table and rejected-key sentence survive untouched in initial HTML`, () => {
    const text = stripTags(readRoute(D09_ROUTES[locale]));
    assert.ok(text.includes("privacyBlock"));
    assert.ok(text.includes("redacted"));
  });
}

test("D09: EN and VI topology headings are localized while node count stays equivalent", () => {
  const en = readRoute(D09_ROUTES.en);
  const vi = readRoute(D09_ROUTES.vi);
  assert.match(en, /Config resolution/);
  assert.match(vi, /Giải quyết cấu hình/);
  assert.equal(nodeCount(en), nodeCount(vi));
});

// --- D10 doctor/audit/backups/uninstall -----------------------------------------

const D10_ROUTES = {
  en: `/en/${catalog.stableAlias}/guides/uninstall-and-doctor/`,
  vi: `/vi/${catalog.stableAlias}/guides/uninstall-and-doctor/`,
};

for (const locale of ["en", "vi"]) {
  test(`D10 (${locale}): the intent matrix carries a literal, always-visible kind label per operation, distinguishable without color`, () => {
    const html = readRoute(D10_ROUTES[locale]);
    assert.match(html, /operation-matrix-diagnostic/);
    assert.match(html, /operation-matrix-mutating/);
    const text = stripTags(html);
    assert.ok(text.includes("Diagnostic") || text.includes("Chẩn đoán"));
    assert.ok(text.includes("Mutating") || text.includes("Thay đổi trạng thái"));
  });

  test(`D10 (${locale}): the intent matrix renders as a caption table with data-label cells, no JS required`, () => {
    const html = readRoute(D10_ROUTES[locale]);
    assert.match(html, /<table class="rdr-table"/);
    assert.match(html, /<caption>/);
    assert.match(html, /data-label="/);
  });

  test(`D10 (${locale}): the authored mutating blockquotes and exit-code table survive untouched in initial HTML`, () => {
    const text = stripTags(readRoute(D10_ROUTES[locale]));
    assert.ok(text.includes("ariadnev doctor"));
    assert.ok(text.includes("ariadnev backups restore"));
    assert.ok(text.includes("ariadnev uninstall"));
  });
}

test("D10: EN and VI intent matrices carry the same operation count", () => {
  const en = readRoute(D10_ROUTES.en);
  const vi = readRoute(D10_ROUTES.vi);
  const enRows = (en.match(/operation-matrix-(diagnostic|mutating|destructive)/g) ?? []).length;
  const viRows = (vi.match(/operation-matrix-(diagnostic|mutating|destructive)/g) ?? []).length;
  assert.ok(enRows >= 6, `expected at least 6 operation-kind badges, got ${enRows}`);
  assert.equal(enRows, viRows);
});

// --- D11 migration ---------------------------------------------------------------

const D11_ROUTES = {
  en: `/en/${catalog.stableAlias}/guides/migration-from-vcskill/`,
  vi: `/vi/${catalog.stableAlias}/guides/migration-from-vcskill/`,
};

for (const locale of ["en", "vi"]) {
  test(`D11 (${locale}): the migration-stages topology renders as an aria-hidden diagram with its text/table equivalent, no JS required`, () => {
    const html = readRoute(D11_ROUTES[locale]);
    assert.match(html, /<svg[^>]*aria-hidden="true"[^>]*class="wd-svg"/);
    assert.match(html, /<ol>/);
    assert.ok(nodeCount(html) >= 6, `expected at least 6 topology nodes, got ${nodeCount(html)}`);
  });

  test(`D11 (${locale}): the old-binary-present prerequisite is drawn as a decision node`, () => {
    const html = readRoute(D11_ROUTES[locale]);
    assert.match(html, /wd-node-gate/);
  });

  test(`D11 (${locale}): removal commands stay inert text inside the diagram, never a link or button`, () => {
    const html = readRoute(D11_ROUTES[locale]);
    const svgMatch = html.match(/<svg[^>]*class="wd-svg"[\s\S]*?<\/svg>/);
    assert.ok(svgMatch, "expected the topology svg to be present");
    assert.doesNotMatch(svgMatch[0], /<a\b/);
    assert.doesNotMatch(svgMatch[0], /<button\b/);
  });

  test(`D11 (${locale}): the authored destructive blockquote and rm -rf commands survive untouched in initial HTML`, () => {
    const html = readRoute(D11_ROUTES[locale]);
    assert.match(html, /<blockquote>/);
    const text = stripTags(html);
    assert.ok(text.includes("rm -rf ~/.vcskill"));
    assert.ok(text.includes("Destructive") || text.includes("Có tính phá hủy"));
  });
}

test("D11: EN and VI topology headings are localized while node count stays equivalent", () => {
  const en = readRoute(D11_ROUTES.en);
  const vi = readRoute(D11_ROUTES.vi);
  assert.match(en, /Migration stages/);
  assert.match(vi, /Các giai đoạn di trú/);
  assert.equal(nodeCount(en), nodeCount(vi));
});

// --- Registry wiring sanity --------------------------------------------------

test("D08/D09/D10/D11 are no longer pass-through: each screenKind renders content the authored MDX body alone does not carry", () => {
  const d08 = readRoute(D08_ROUTES.en);
  const d09 = readRoute(D09_ROUTES.en);
  const d10 = readRoute(D10_ROUTES.en);
  const d11 = readRoute(D11_ROUTES.en);
  assert.match(d08, /Upgrade recipe/);
  assert.match(d09, /Config resolution/);
  assert.match(d10, /operation-matrix-diagnostic/);
  assert.match(d11, /Migration stages/);
});
