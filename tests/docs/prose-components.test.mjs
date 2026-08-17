// Phase 4 Slice A — closed content component tests.
//
// These six components are plain TypeScript/TSX React components (JSX,
// `.tsx`), not `.ts`. Every other docs test that touches JSX renders a real
// built route (`screen-fixture-structural-probes.test.mjs`) because the repo
// carries no direct `.tsx`-under-`node --test` loader. Slice A intentionally
// does not wire any of these components into `docs-screen-registry.tsx` yet
// (Slice B/C/D territory), so there is no built route to probe. Rather than
// add a new devDependency or a permanent loader just for this, this file
// bundles `apps/docs/src/components/prose/index.ts` in-process with the
// `esbuild` package the workspace already carries transitively (via
// `vitest`/`vite` — see `pnpm.onlyBuiltDependencies` in the root
// `package.json`), the same JSX/TS transform Next.js itself performs at
// build time, then renders with `react-dom/server`'s `renderToStaticMarkup`
// — the literal server-render step every docs page goes through before
// hydration. No new dependency is added; the resolution walks the existing
// pnpm store.

import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import Module from "node:module";
import { resolve, dirname, join } from "node:path";
import test from "node:test";

const REPO_ROOT = resolve(import.meta.dirname, "../..");
const DOCS_ROOT = join(REPO_ROOT, "apps/docs");

function resolveEsbuild() {
  const pnpmDir = join(REPO_ROOT, "node_modules/.pnpm");
  const candidates = readdirSync(pnpmDir).filter((entry) => entry.startsWith("esbuild@")).sort();
  if (candidates.length === 0) throw new Error("esbuild not found in the pnpm store; cannot bundle prose components for testing");
  return join(pnpmDir, candidates.at(-1), "node_modules/esbuild");
}

const esbuild = Module.createRequire(import.meta.url)(resolveEsbuild());

/**
 * Bundle the closed prose component barrel with the exact JSX/TS transform
 * Next.js applies, then load it as a CommonJS module rooted inside
 * `apps/docs` so its `react` / `react-dom` imports resolve through the
 * app's own dependency tree (not this test file's).
 */
function loadProseComponents() {
  const entry = join(DOCS_ROOT, "src/components/prose/index.ts");
  const result = esbuild.buildSync({
    entryPoints: [entry],
    bundle: true,
    write: false,
    platform: "node",
    format: "cjs",
    jsx: "automatic",
    jsxImportSource: "react",
    external: ["react", "react-dom", "react-dom/server"],
    absWorkingDir: DOCS_ROOT,
    tsconfig: join(DOCS_ROOT, "tsconfig.json"),
  });
  const code = result.outputFiles[0].text;
  const virtualPath = join(DOCS_ROOT, "src/components/prose/__test-bundle__.cjs");
  const mod = new Module(virtualPath, undefined);
  mod.filename = virtualPath;
  mod.paths = Module._nodeModulePaths(dirname(virtualPath));
  mod._compile(code, virtualPath);
  const localRequire = Module.createRequire(virtualPath);
  return { components: mod.exports, React: localRequire("react"), renderToStaticMarkup: localRequire("react-dom/server").renderToStaticMarkup };
}

const { components, React, renderToStaticMarkup } = loadProseComponents();
const { Callout, CommandBlock, Procedure, Step, ResponsiveDataRegion, OperationMatrix, Topology } = components;

function render(component, props) {
  return renderToStaticMarkup(React.createElement(component, props));
}

// --- Callout ---------------------------------------------------------

test("Callout: renders each of the five named variants with a landmark role and text label", () => {
  for (const variant of ["note", "gate", "boundary", "destructive", "evidence"]) {
    const html = render(Callout, { variant, locale: "en", children: "body text" });
    assert.match(html, /role="region"/);
    assert.match(html, new RegExp(`class="callout callout-${variant}"`));
    assert.match(html, /aria-label="[^"]+"/);
    assert.match(html, /body text/);
  }
});

test("Callout: EN/VI labels resolve to distinct localized text", () => {
  const en = render(Callout, { variant: "destructive", locale: "en", children: "x" });
  const vi = render(Callout, { variant: "destructive", locale: "vi", children: "x" });
  assert.match(en, /Destructive/);
  assert.match(vi, /Hành động phá hủy/);
  assert.notEqual(en, vi);
});

test("Callout: heading and children are escaped, never raw HTML", () => {
  const html = render(Callout, { variant: "note", locale: "en", heading: "<img src=x onerror=alert(1)>", children: "<script>alert(1)</script>" });
  assert.doesNotMatch(html, /<img/);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;img/);
  assert.match(html, /&lt;script&gt;/);
});

test("Callout: identical props render byte-identical output", () => {
  const props = { variant: "gate", locale: "en", heading: "Confirm", children: "Proceed only after review." };
  assert.equal(render(Callout, props), render(Callout, { ...props }));
});

// --- Command block -----------------------------------------------------

test("CommandBlock: command is readable as plain text in a <pre><code> with a language hint, no JS required", () => {
  const html = render(CommandBlock, { locale: "en", command: "ariadnev doctor --dry-run", language: "bash" });
  assert.match(html, /<pre data-language="bash"><code>ariadnev doctor --dry-run<\/code><\/pre>/);
  assert.match(html, /Language: <code>bash<\/code>/);
  assert.doesNotMatch(html, /<script/);
});

test("CommandBlock: optional output renders as a second plain-text block", () => {
  const html = render(CommandBlock, { locale: "en", command: "ariadnev --version", output: "1.1.0" });
  assert.match(html, /<pre data-language="text"><code>1\.1\.0<\/code><\/pre>/);
  assert.match(html, /Output/);
});

test("CommandBlock: command text is escaped even when it contains shell metacharacters that look like markup", () => {
  const html = render(CommandBlock, { locale: "en", command: 'echo "<not html>" && rm -rf ./tmp' });
  assert.doesNotMatch(html, /<not html>/);
  assert.match(html, /&lt;not html&gt;/);
});

test("CommandBlock: EN/VI labels resolve", () => {
  const vi = render(CommandBlock, { locale: "vi", command: "ariadnev doctor", output: "OK" });
  assert.match(vi, /Ngôn ngữ/);
  assert.match(vi, /Kết quả/);
});

// --- Procedure / Step ---------------------------------------------------

test("Procedure/Step: renders a native ordered list with a landmark region per step and a stable, focus-restorable id", () => {
  const html = render(
    Procedure,
    {
      locale: "en",
      heading: "Migration",
      children: [
        React.createElement(Step, { key: "s1", locale: "en", title: "Back up", id: "step-1" }, "Back up first."),
        React.createElement(Step, { key: "s2", locale: "en", title: "Apply", id: "step-2" }, "Then apply."),
      ],
    },
  );
  assert.match(html, /<ol class="procedure" aria-label="Migration">/);
  assert.match(html, /<section role="region" aria-labelledby="step-1-heading" id="step-1" tabindex="-1">/);
  assert.match(html, /<section role="region" aria-labelledby="step-2-heading" id="step-2" tabindex="-1">/);
  assert.match(html, /Back up first\./);
});

test("Procedure/Step: EN/VI step kicker resolves", () => {
  const html = render(Step, { locale: "vi", title: "Sao lưu", id: "step-1", children: "content" });
  assert.match(html, /Bước/);
});

test("Procedure/Step: title is escaped", () => {
  const html = render(Step, { locale: "en", title: "<b>bold</b>", id: "s", children: "x" });
  assert.doesNotMatch(html, /<b>bold<\/b>/);
  assert.match(html, /&lt;b&gt;bold&lt;\/b&gt;/);
});

// --- Responsive data region ---------------------------------------------

const RDR_COLUMNS = [
  { key: "state", label: "State" },
  { key: "kind", label: "Kind" },
];
const RDR_ROWS = [
  { id: "idle", cells: { state: "idle", kind: "entry" } },
  { id: "running", cells: { state: "running", kind: "active" } },
];

test("ResponsiveDataRegion: renders one semantic table with a caption and column headers, usable without JS", () => {
  const html = render(ResponsiveDataRegion, { locale: "en", caption: "Lifecycle states", columns: RDR_COLUMNS, rows: RDR_ROWS });
  assert.match(html, /<table class="rdr-table" tabindex="0"><caption>Lifecycle states<\/caption>/);
  assert.match(html, /<th scope="col">State<\/th>/);
  assert.match(html, /<th scope="col">Kind<\/th>/);
  assert.match(html, /idle/);
  assert.match(html, /running/);
});

test("ResponsiveDataRegion: every body cell carries a data-label for the narrow-viewport record reflow (CSS-only, no duplicated markup)", () => {
  const html = render(ResponsiveDataRegion, { locale: "en", caption: "Lifecycle states", columns: RDR_COLUMNS, rows: RDR_ROWS });
  assert.match(html, /<td data-label="State">idle<\/td>/);
  assert.match(html, /<td data-label="Kind">entry<\/td>/);
});

test("ResponsiveDataRegion: the table is keyboard-reachable without JavaScript (static tabindex, not hydration-only), matching the site-wide .docs-body table[tabindex] pattern", () => {
  const html = render(ResponsiveDataRegion, { locale: "en", caption: "x", columns: RDR_COLUMNS, rows: RDR_ROWS });
  assert.match(html, /<table class="rdr-table" tabindex="0">/);
});

test("ResponsiveDataRegion: cell content is escaped", () => {
  const html = render(ResponsiveDataRegion, {
    locale: "en",
    caption: "x",
    columns: RDR_COLUMNS,
    rows: [{ id: "r1", cells: { state: "<script>1</script>", kind: "x" } }],
  });
  assert.doesNotMatch(html, /<script>1<\/script>/);
  assert.match(html, /&lt;script&gt;1&lt;\/script&gt;/);
});

// --- Operation matrix ----------------------------------------------------

test("OperationMatrix: diagnostic vs mutating vs destructive carry a distinct, always-visible text label (not colour alone)", () => {
  const html = render(OperationMatrix, {
    locale: "en",
    caption: "Doctor operations",
    attributeColumns: [{ key: "reversible", label: "Reversible" }],
    operations: [
      { id: "check", label: "doctor --check", kind: "diagnostic", attributes: { reversible: "n/a" } },
      { id: "repair", label: "doctor --repair", kind: "mutating", attributes: { reversible: "yes" } },
      { id: "uninstall", label: "uninstall", kind: "destructive", attributes: { reversible: "no" } },
    ],
  });
  assert.match(html, /operation-matrix-diagnostic/);
  assert.match(html, />Diagnostic</);
  assert.match(html, /operation-matrix-mutating/);
  assert.match(html, />Mutating</);
  assert.match(html, /operation-matrix-destructive/);
  assert.match(html, />Destructive</);
});

test("OperationMatrix: EN/VI kind labels resolve", () => {
  const vi = render(OperationMatrix, {
    locale: "vi",
    caption: "x",
    attributeColumns: [],
    operations: [{ id: "a", label: "a", kind: "destructive", attributes: {} }],
  });
  assert.match(vi, /Phá hủy/);
});

// --- Topology -------------------------------------------------------------

const TOPOLOGY_NODES = [
  { id: "kit", label: "kit" },
  { id: "adapt", label: "adapt" },
  { id: "receipt", label: "receipt", shape: "pill" },
];
const TOPOLOGY_EDGES = [
  { from: "kit", to: "adapt" },
  { from: "adapt", to: "receipt", label: "writes" },
];

test("Topology: an aria-hidden static SVG is always paired with a text legend and adjacency table in the same render", () => {
  const html = render(Topology, { locale: "en", heading: "Kit pipeline", nodes: TOPOLOGY_NODES, edges: TOPOLOGY_EDGES });
  assert.match(html, /<svg[^>]*aria-hidden="true"[^>]*class="wd-svg"/);
  assert.match(html, /<ol>/);
  assert.match(html, /<li>kit<\/li>/);
  assert.match(html, /<li>adapt<\/li>/);
  assert.match(html, /<li>receipt<\/li>/);
  assert.match(html, /<table>/);
  assert.match(html, /<td>kit<\/td><td>adapt<\/td>/);
  assert.match(html, /writes/);
});

test("Topology: node/edge labels are escaped", () => {
  const html = render(Topology, {
    locale: "en",
    heading: "x",
    nodes: [{ id: "a", label: "<b>a</b>" }, { id: "b", label: "b" }],
    edges: [{ from: "a", to: "b", label: "<i>via</i>" }],
  });
  assert.doesNotMatch(html, /<b>a<\/b>/);
  assert.doesNotMatch(html, /<i>via<\/i>/);
});

test("Topology: identical node/edge props lay out deterministically (byte-identical render)", () => {
  const props = { locale: "en", heading: "Kit pipeline", nodes: TOPOLOGY_NODES, edges: TOPOLOGY_EDGES };
  assert.equal(render(Topology, props), render(Topology, { ...props }));
});

test("Topology: EN/VI diagram heading resolves", () => {
  const vi = render(Topology, { locale: "vi", heading: "x", nodes: [{ id: "a", label: "a" }], edges: [] });
  assert.match(vi, /Sơ đồ: x/);
});

// --- Component-level byte sanity (not the P5 per-route ratchet) --------
//
// These six components are not yet wired into any authored screen — they
// have no route, so `tests/docs/docs-per-route-ratchet.test.mjs` cannot see
// them. This is an early-warning sanity cap on a single representative
// composed rendering, generous on purpose (well under the smallest P5
// per-route headroom measured at Phase 5 close): a Slice B/C/D author
// composing these into a real page still owns proving the actual route
// stays inside its frozen search-index/byte budget.
const BYTE_SANITY_CAP = 6000;

test("composed rendering of all six components stays comfortably under a component-level byte sanity cap", () => {
  const composed = React.createElement(
    "div",
    null,
    React.createElement(Callout, { variant: "gate", locale: "en", heading: "Confirm", children: "Review before continuing." }),
    React.createElement(CommandBlock, { locale: "en", command: "ariadnev doctor --dry-run", output: "OK" }),
    React.createElement(
      Procedure,
      { locale: "en", heading: "Migration" },
      React.createElement(Step, { locale: "en", title: "Back up", id: "step-1" }, "Back up first."),
      React.createElement(Step, { locale: "en", title: "Apply", id: "step-2" }, "Then apply."),
    ),
    React.createElement(ResponsiveDataRegion, { locale: "en", caption: "Lifecycle states", columns: RDR_COLUMNS, rows: RDR_ROWS }),
    React.createElement(OperationMatrix, {
      locale: "en",
      caption: "Doctor operations",
      attributeColumns: [{ key: "reversible", label: "Reversible" }],
      operations: [{ id: "repair", label: "doctor --repair", kind: "mutating", attributes: { reversible: "yes" } }],
    }),
    React.createElement(Topology, { locale: "en", heading: "Kit pipeline", nodes: TOPOLOGY_NODES, edges: TOPOLOGY_EDGES }),
  );
  const html = renderToStaticMarkup(composed);
  const byteLength = Buffer.byteLength(html, "utf8");
  assert.ok(byteLength < BYTE_SANITY_CAP, `composed prose-component render is ${byteLength} bytes, expected under ${BYTE_SANITY_CAP}`);
});

test("prose barrel exports exactly the six closed components (no undeclared export creeps into the closed set)", () => {
  const exported = Object.keys(components).sort();
  assert.deepEqual(exported, ["Callout", "CommandBlock", "OperationMatrix", "Procedure", "ResponsiveDataRegion", "Step", "Topology"]);
});

// Sanity check that this test file itself has not silently drifted from the
// prose directory's actual file list — a seventh component added without a
// matching barrel export/test would otherwise go unnoticed.
test("every .tsx file under components/prose is re-exported from the barrel", () => {
  const proseDir = join(DOCS_ROOT, "src/components/prose");
  const files = readdirSync(proseDir).filter((entry) => entry.endsWith(".tsx"));
  const barrel = readFileSync(join(proseDir, "index.ts"), "utf8");
  for (const file of files) {
    const stem = file.replace(/\.tsx$/, "");
    assert.match(barrel, new RegExp(`"\\./${stem}\\.tsx"`), `${file} is not re-exported from prose/index.ts`);
  }
});
