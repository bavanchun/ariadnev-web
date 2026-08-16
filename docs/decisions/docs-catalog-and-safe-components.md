# Docs catalog metadata and safe-component boundary

Status: **Catalog half accepted; safe-component half pending Phase 1 spike**
Recorded: 2026-08-17
Phase: 1 (contract gate and measurement spike)
Required by: Phase 3 (docs safety and shell), Phase 4 (authored docs), Phase 5 (generated reference)

Sources of record:

- [`apps/docs/src/lib/content-catalog.ts`](../../apps/docs/src/lib/content-catalog.ts) — the extended catalog schema, `resolveNavigationVisibility`, and `sidebarPages`
- [`tests/docs/content-pipeline.test.mjs`](../../tests/docs/content-pipeline.test.mjs) — legacy backward-compat, populated round-trip, and sidebar-filter tests
- [`apps/docs/src/lib/public-markdown.ts`](../../apps/docs/src/lib/public-markdown.ts) — the current MDX gate this decision is bounded by
- [`plans/260816-2345-ariadnev-web-uiux-upgrade/phase-01-contract-gate-and-measurement-spike.md`](../../plans/260816-2345-ariadnev-web-uiux-upgrade/phase-01-contract-gate-and-measurement-spike.md) — the phase this decision closes

## Catalog metadata (accepted)

The catalog schema gains four **additive optional** page fields:

| Field | Values | Purpose |
|---|---|---|
| `pageKind` | `home` \| `get-started` \| `concept` \| `guide` \| `reference-index` \| `release-notes` \| `not-found` \| `command` | Broad page shape from the Living Execution Atlas |
| `screenKind` | free-form identifier, e.g. `D13-cli-command-detail` | Screen-level atlas identity, one contract per screen |
| `section` | `get-started` \| `concepts` \| `guides` \| `reference` \| `release-notes` \| `meta` | Top-level shelf a global sidebar renders |
| `navigationVisibility` | `global-sidebar` \| `reference-only` \| `hidden` | Sidebar enumeration policy (default `global-sidebar`) |

Rationale — **additive** matters: the current `catalog.json` shipped by
`build-content-root.mjs` does NOT set these fields today, and the parser must
keep accepting that shape while Phase 3–5 populate pages one at a time. The
existing 26 docs pipeline tests still pass unchanged; a new legacy-backward-compat
test proves absent fields resolve to the safe default (`global-sidebar`), and a
new populated-round-trip test proves the shape survives `parseDocsContentCatalog`
+ `freezePage` and that `sidebarPages` filters `reference-only` / `hidden`
correctly, including the `stable` alias.

## Why `navigationVisibility: "reference-only"` for command pages

Command detail pages (D13 in the Living Execution Atlas) live at
`/reference/cli/<slug>/`. They must be:

- discoverable by search — one canonical result per locale/version partition
- served as static HTML and Markdown for `llms.txt` and no-JS clients
- present in `catalog.pages` so `enumerateDocsRoutes` produces the route
- **absent** from the global sidebar because 53 entries in one shelf would
  dominate the navigation and duplicate the aggregate CLI reference index

`sidebarPages(catalog, locale, version)` filters on `resolveNavigationVisibility`,
which defaults to `global-sidebar` for legacy entries and returns the declared
value otherwise. Command pages emit `"reference-only"`; the sidebar never sees
them; search, `llms.txt`, and static export still do.

## Safe-component boundary (pending spike)

The current gate — `apps/docs/src/lib/public-markdown.ts` — rejects **all** MDX
JSX. Phase 1 sub-step 5 compares three approaches for the Phase 4/5 screen
work, and this decision will name the winner after the spike:

1. **Pure Markdown plus global standard-element mappings.** No MDX JSX at all;
   visual chrome comes from CSS on standard headings/tables/lists. Preserves
   the safest possible source, trivial `llms.txt` output, and full backward
   compatibility with every existing test. The bet is that D03–D17 can be
   rendered richly enough from vanilla HTML alone. **Likely winner for D03,
   D04, D07–D11.**

2. **Exact-name safe MDX components with literal, schema-validated attributes
   and a deterministic plain-Markdown transform for search/`llms.txt`.**
   Each safe component has a fixed name, a strict prop schema (literal
   strings/numbers only, no expressions), and a paired plain-Markdown lowering
   that discovery + search consume. Expressions, imports/exports, arbitrary
   component names, event handlers, HTML, and URL-bearing unvalidated props
   remain forbidden. **Bet: the discovery lowering can stay deterministic and
   byte-identical across builds.** If it cannot, this approach fails the
   pipeline's `same-inputs-produce-byte-identical-content-root` test.

3. **Screen-specific React chrome outside the MDX body.** The MDX body remains
   pure prose; screen visuals attach around it in the docs shell via layout
   components picked by `pageKind`/`screenKind`. Zero MDX-syntax risk; the
   safe-component gate stays as-is. **Bet: D03–D17 fit within the shell's
   layout slots without smuggling data through the MDX body.**

Success criterion for the spike is the smallest model that implements
D03–D17 without duplicating source facts.

## Stop conditions

- **Discovery output is no longer deterministic under approach 2.** Fall back
  to approach 3; do NOT weaken the pipeline's byte-identical build test.
- **Approach 3 requires the MDX body to carry structured data through
  frontmatter or a sidecar to be renderable.** That leaks generated data into
  authored source — abandon and revisit whether a fourth approach is needed.
- **No approach passes the `public-markdown.ts` strictness gate.** Keep the
  gate; adjust the phase's screen contracts to fit what the current gate
  allows.

## Non-goals

- No relaxation of `public-markdown.ts` for arbitrary MDX or HTML.
- No JSX expressions, imports, exports, event handlers, or unvalidated URLs in
  any safe-component approach.
- No screen-specific data smuggled through catalog metadata beyond the four
  fields above; page bodies remain the source of truth for content.
