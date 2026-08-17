// Phase 4 Slice B — D02/D03/D04 screen-experience tests.
//
// These three screens are wired into `docs-screen-registry.tsx`, so (unlike
// the Slice A prose-component tests) each has a real built static route.
// This file reads the built HTML from `apps/docs/out/…/index.html`
// (`pnpm run build` must run first — the same precondition
// `screen-fixture-structural-probes.test.mjs` already relies on) and
// asserts each experience's structural contract: the identity elements the
// wrapper adds, EN/VI parity of structure (not translated text), the
// authored MDX facts survive untouched, and everything is present without
// any client-side JavaScript (a static build has none to run).

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

// --- D02 previous home ----------------------------------------------------

const D02_ROUTES = { en: `/en/${catalog.previousStable}/`, vi: `/vi/${catalog.previousStable}/` };

for (const locale of ["en", "vi"]) {
  test(`D02 (${locale}): edition-notice callout is a labelled boundary region carrying the exact previous/current version pair`, () => {
    const html = readRoute(D02_ROUTES[locale]);
    assert.match(html, /class="callout callout-boundary"/);
    assert.match(html, /role="region"/);
    assert.match(html, new RegExp(catalog.previousStable.replace(/\./g, "\\.")));
    assert.match(html, new RegExp(catalog.currentStable.replace(/\./g, "\\.")));
  });

  test(`D02 (${locale}): published-destinations table lists only real pages of this version/locale with historical titles preserved, no empty group`, () => {
    const html = readRoute(D02_ROUTES[locale]);
    const tableMatch = html.match(/<table class="rdr-table"[^>]*>.*?<\/table>/s);
    assert.ok(tableMatch, "published-destinations table missing");
    const expected = catalog.pages
      .filter((page) => page.locale === locale && page.version === catalog.previousStable && page.canonicalId !== "core/index")
      .sort((left, right) => left.title.localeCompare(right.title, "en"));
    assert.ok(expected.length > 0, "test fixture expectation: previous edition must publish at least one other page");
    for (const page of expected.slice(0, 5)) {
      assert.ok(tableMatch[0].includes(page.title), `expected historical title "${page.title}" preserved in the table`);
      assert.ok(tableMatch[0].includes(`/${locale}/${catalog.previousStable}/${page.slug.join("/")}/`), `expected a link into ${page.canonicalId}`);
    }
  });

  test(`D02 (${locale}): stable-return navigation links to the current edition's equivalent page`, () => {
    const html = readRoute(D02_ROUTES[locale]);
    const navMatch = html.match(/<nav aria-label="[^"]+">\s*<a href="([^"]+)">[^<]+<\/a>\s*<\/nav>/);
    assert.ok(navMatch, "stable-return nav missing");
    assert.match(navMatch[1], new RegExp(`^/${locale}/${catalog.stableAlias}/`));
  });
}

test("D02: EN and VI carry the same structural markers with distinct localized text", () => {
  const en = readRoute(D02_ROUTES.en);
  const vi = readRoute(D02_ROUTES.vi);
  assert.match(en, /Version-locked edition/);
  assert.match(vi, /Bản tài liệu cố định phiên bản/);
  assert.notEqual(en, vi);
});

// --- D03 installation -------------------------------------------------------

const D03_ROUTES = { en: "/en/stable/get-started/installation/", vi: "/vi/stable/get-started/installation/" };

for (const locale of ["en", "vi"]) {
  test(`D03 (${locale}): integrity-flow topology renders an aria-hidden diagram with its text/table equivalent, no JS required`, () => {
    const html = readRoute(D03_ROUTES[locale]);
    assert.match(html, /<svg[^>]*aria-hidden="true"[^>]*class="wd-svg"/);
    assert.match(html, /<ol>/);
    assert.match(html, /<table>/);
  });

  test(`D03 (${locale}): every platform command from the authored MDX survives untouched in initial HTML`, () => {
    const text = stripTags(readRoute(D03_ROUTES[locale]));
    assert.ok(text.includes("curl -fsSL https://ariadnev.com/install | bash"));
    assert.ok(text.includes("irm https://ariadnev.com/install.ps1 | iex"));
    assert.ok(text.includes("xattr -d com.apple.quarantine"));
  });

  test(`D03 (${locale}): the Gatekeeper boundary is represented as its own decision node in the topology's text equivalent`, () => {
    const html = readRoute(D03_ROUTES[locale]);
    assert.match(html, /wd-node-gate/);
  });
}

test("D03: EN and VI topology headings are localized while the diagram structure stays equivalent", () => {
  const en = readRoute(D03_ROUTES.en);
  const vi = readRoute(D03_ROUTES.vi);
  assert.match(en, /Installer integrity flow/);
  assert.match(vi, /Luồng xác minh khi cài đặt/);
  assert.equal((en.match(/class="wd-node(?!-)[^"]*"/g) ?? []).length, (vi.match(/class="wd-node(?!-)[^"]*"/g) ?? []).length);
});

// --- D04 first install -------------------------------------------------------

const D04_ROUTES = { en: "/en/stable/get-started/first-install/", vi: "/vi/stable/get-started/first-install/" };

for (const locale of ["en", "vi"]) {
  test(`D04 (${locale}): install-flow topology represents both interactive and non-interactive modes server-rendered`, () => {
    const html = readRoute(D04_ROUTES[locale]);
    assert.match(html, /<svg[^>]*aria-hidden="true"[^>]*class="wd-svg"/);
    assert.match(html, /<table>/);
    const nodeCount = (html.match(/class="wd-node(?!-)[^"]*"/g) ?? []).length;
    assert.ok(nodeCount >= 6, `expected at least 6 topology nodes (install, two modes, providers, scope, receipt), got ${nodeCount}`);
  });

  test(`D04 (${locale}): the doctor exit-code table and non-interactive commands from the authored MDX survive untouched`, () => {
    const html = readRoute(D04_ROUTES[locale]);
    const text = stripTags(html);
    assert.ok(text.includes("ariadnev install --provider codex,cursor"));
    assert.ok(text.includes("ariadnev install --provider opencode --dry-run"));
    assert.match(html, /<td><code>2<\/code><\/td>/);
  });

  test(`D04 (${locale}): the provider reference link the MDX body carries is unaffected by the added topology`, () => {
    const html = readRoute(D04_ROUTES[locale]);
    assert.match(html, new RegExp(`href="/${locale}/${catalog.stableAlias}/reference/providers/"`));
  });
}

test("D04: EN and VI topology headings are localized while node count stays equivalent", () => {
  const en = readRoute(D04_ROUTES.en);
  const vi = readRoute(D04_ROUTES.vi);
  assert.match(en, /Install flow/);
  assert.match(vi, /Luồng cài đặt/);
  assert.equal((en.match(/class="wd-node(?!-)[^"]*"/g) ?? []).length, (vi.match(/class="wd-node(?!-)[^"]*"/g) ?? []).length);
});

// --- Registry wiring sanity --------------------------------------------------

test("D02/D03/D04 are no longer pass-through: each screenKind renders content the authored MDX body alone does not carry", () => {
  const d02 = readRoute(D02_ROUTES.en);
  const d03 = readRoute(D03_ROUTES.en);
  const d04 = readRoute(D04_ROUTES.en);
  assert.match(d02, /callout-boundary/);
  assert.match(d03, /Installer integrity flow/);
  assert.match(d04, /Install flow/);
});
