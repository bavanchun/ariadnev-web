// Phase 4 Slice C — D05/D06/D07 screen-experience tests.
//
// Mirrors `screen-experience-d02-d04.test.mjs`: reads the built HTML from
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

// --- D05 kit and adapt engine ------------------------------------------------

const D05_ROUTES = {
  en: `/en/${catalog.stableAlias}/concepts/kit-and-adapt-engine/`,
  vi: `/vi/${catalog.stableAlias}/concepts/kit-and-adapt-engine/`,
};

for (const locale of ["en", "vi"]) {
  test(`D05 (${locale}): kit-to-system topology renders an aria-hidden diagram with its text/table equivalent, no JS required`, () => {
    const html = readRoute(D05_ROUTES[locale]);
    assert.match(html, /<svg[^>]*aria-hidden="true"[^>]*class="wd-svg"/);
    assert.match(html, /<ol>/);
    assert.match(html, /<table>/);
  });

  test(`D05 (${locale}): the topology draws kit, adapt, projection, and both terminal artifacts`, () => {
    const html = readRoute(D05_ROUTES[locale]);
    assert.ok(nodeCount(html) >= 5, `expected at least 5 topology nodes (kit, adapt, projection, receipt, cache), got ${nodeCount(html)}`);
  });

  test(`D05 (${locale}): the authored skip-not-guess boundary and artifact/target table survive untouched in initial HTML`, () => {
    const text = stripTags(readRoute(D05_ROUTES[locale]));
    assert.ok(text.includes("Skip, do not guess") || text.includes("Bỏ qua, không đoán"));
    assert.ok(text.includes(".claude/skills/"));
    assert.ok(text.includes(".claude/hooks/av/*.cjs"));
  });

  test(`D05 (${locale}): the provider-reference link from the authored MDX is unaffected by the added topology`, () => {
    const html = readRoute(D05_ROUTES[locale]);
    assert.match(html, new RegExp(`href="/${locale}/${catalog.stableAlias}/reference/providers/"`));
  });
}

test("D05: EN and VI topology headings are localized while node count stays equivalent", () => {
  const en = readRoute(D05_ROUTES.en);
  const vi = readRoute(D05_ROUTES.vi);
  assert.match(en, /Kit to installed system/);
  assert.match(vi, /Từ kit đến hệ thống đã cài/);
  assert.equal(nodeCount(en), nodeCount(vi));
});

// --- D06 graph execution ------------------------------------------------------

const D06_ROUTES = {
  en: `/en/${catalog.stableAlias}/concepts/graph-execution/`,
  vi: `/vi/${catalog.stableAlias}/concepts/graph-execution/`,
};

for (const locale of ["en", "vi"]) {
  test(`D06 (${locale}): the authored read-only boundary blockquote survives untouched in initial HTML`, () => {
    const html = readRoute(D06_ROUTES[locale]);
    assert.match(html, /<blockquote>/);
    const text = stripTags(html);
    assert.ok(text.includes("Public active execution is read-only") || text.includes("Thực thi active công khai là read-only"));
  });

  test(`D06 (${locale}): the flagship-pipeline topology renders as an aria-hidden diagram with its text/table equivalent, no JS required`, () => {
    const html = readRoute(D06_ROUTES[locale]);
    assert.match(html, /<svg[^>]*aria-hidden="true"[^>]*class="wd-svg"/);
    assert.match(html, /<table>/);
    assert.ok(nodeCount(html) >= 4, `expected at least 4 topology nodes (compile, policy, run, provider), got ${nodeCount(html)}`);
  });

  test(`D06 (${locale}): the policy step is represented as a decision node in the topology`, () => {
    const html = readRoute(D06_ROUTES[locale]);
    assert.match(html, /wd-node-gate/);
  });

  test(`D06 (${locale}): the authored five-state table and lifecycle commands survive untouched in initial HTML`, () => {
    const text = stripTags(readRoute(D06_ROUTES[locale]));
    assert.ok(text.includes("av run read-only-delivery --validate --json"));
    assert.ok(text.includes("av --dry-run run read-only-delivery --runtime claude-code --json"));
  });

  test(`D06 (${locale}): the workflow-reference link from the authored MDX is unaffected by the added topology`, () => {
    const html = readRoute(D06_ROUTES[locale]);
    assert.match(html, new RegExp(`href="/${locale}/${catalog.stableAlias}/reference/workflows/"`));
  });
}

test("D06: EN and VI topology headings are localized while node count stays equivalent", () => {
  const en = readRoute(D06_ROUTES.en);
  const vi = readRoute(D06_ROUTES.vi);
  assert.match(en, /active execution is read-only/i);
  assert.match(vi, /Thực thi active công khai là read-only/);
  assert.match(en, /Public execution pipeline/);
  assert.match(vi, /Pipeline thực thi/);
  assert.equal(nodeCount(en), nodeCount(vi));
});

// --- D07 evaluation ------------------------------------------------------------

const D07_ROUTES = {
  en: `/en/${catalog.stableAlias}/concepts/evaluation/`,
  vi: `/vi/${catalog.stableAlias}/concepts/evaluation/`,
};

for (const locale of ["en", "vi"]) {
  test(`D07 (${locale}): the proof-ladder topology renders as an aria-hidden diagram with its text/table equivalent, no JS required`, () => {
    const html = readRoute(D07_ROUTES[locale]);
    assert.match(html, /<svg[^>]*aria-hidden="true"[^>]*class="wd-svg"/);
    assert.match(html, /<ol>/);
    assert.ok(nodeCount(html) >= 5, `expected at least 5 ladder nodes (static, tier1, tier2, tier3, probes), got ${nodeCount(html)}`);
  });

  test(`D07 (${locale}): the opt-in judge tier is drawn on a dashed edge, distinguishing it from the mandatory tiers`, () => {
    const html = readRoute(D07_ROUTES[locale]);
    assert.match(html, /stroke-dasharray="4 3"/);
  });

  test(`D07 (${locale}): the authored proof-boundary ledger table survives untouched in initial HTML`, () => {
    const text = stripTags(readRoute(D07_ROUTES[locale]));
    assert.ok(text.includes("Static contracts") || text.includes("Hợp đồng tĩnh"));
    assert.ok(text.includes("General provider parity") || text.includes("Đồng đẳng provider tổng quát") || text.includes("tổng quát"));
  });

  test(`D07 (${locale}): the authored eval-suite command survives untouched in initial HTML`, () => {
    const text = stripTags(readRoute(D07_ROUTES[locale]));
    assert.ok(text.includes("ariadnev eval --suite"));
  });
}

test("D07: EN and VI topology headings are localized while node count stays equivalent", () => {
  const en = readRoute(D07_ROUTES.en);
  const vi = readRoute(D07_ROUTES.vi);
  assert.match(en, /Proof ladder/);
  assert.match(vi, /Nấc thang bằng chứng/);
  assert.equal(nodeCount(en), nodeCount(vi));
});

// --- Registry wiring sanity --------------------------------------------------

test("D05/D06/D07 are no longer pass-through: each screenKind renders content the authored MDX body alone does not carry", () => {
  const d05 = readRoute(D05_ROUTES.en);
  const d06 = readRoute(D06_ROUTES.en);
  const d07 = readRoute(D07_ROUTES.en);
  assert.match(d05, /Kit to installed system/);
  assert.match(d06, /Public execution pipeline/);
  assert.match(d07, /Proof ladder/);
});
