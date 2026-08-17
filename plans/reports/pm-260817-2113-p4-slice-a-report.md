# Phase 4 Slice A — closed content components — report

Date: 2026-08-17
Plan: `plans/260816-2345-ariadnev-web-uiux-upgrade/phase-04-authored-docs-screen-experiences.md`

## Scope delivered

Built the 6 shared "closed content components" foundation named in phase-04's
Architecture "Closed content components" section, as plain TypeScript/TSX
React components under `apps/docs/src/components/prose/`, with a barrel
export and a native-test-runner test suite. Did NOT touch
`docs-screen-registry.{ts,tsx}` or any D02–D11 wiring — that stays Slice B/C/D
territory, unchanged in this slice.

## Deviation from the assignment brief (load-bearing, read this)

The brief asked to register the six components in "the closed MDX component
registry" / `mdx-components.tsx`. **No such file or registry exists in this
codebase**, and the accepted decision record
`docs/decisions/docs-catalog-and-safe-components.md` (status: Accepted,
2026-08-17) explicitly **rejects** "approach 2 — exact-name safe MDX
components" for named-drift and search-tokenization-boundary reasons, and its
"Stop conditions" section says not to smuggle this workaround back in without
a new decision record. The accepted architecture is:

- **Approach 1** — pure Markdown authored content (unchanged).
- **Approach 3** — screen-specific React chrome that wraps the authored MDX
  body from `docs-screen-registry.tsx`, reading typed data from
  TypeScript/bundle JSON, never from MDX syntax.

Consistent with `WorkflowMapExperience`/`ProviderReferenceExperience`
(existing P5 reference components), the six prose components are plain
typed React components consumed by **future screen-experience modules**
(Slice B+), not by authored `.mdx` source. `prose/index.ts` is a barrel
export for those TypeScript consumers, not an MDX registry. This is
documented in the barrel's own header comment.

## Components built

1. **Callout** (`callout.tsx`) — 5 named variants (note/gate/boundary/
   destructive/evidence, matching the exact set `packages/tokens`
   `content.callout.*` already ships and the phase-04 architecture list).
   `role="region"` + `aria-label` landmark, EN/VI labels, escaped
   heading/children (plain React children, no `dangerouslySetInnerHTML`).
2. **CommandBlock** (`command-block.tsx`) — plain `<pre><code>` structure,
   readable/selectable with JS off; copy affordance and its
   clipboard-unavailable fallback come from the existing
   `document-copy-enhancer.tsx` (attaches to every `<pre>` in the hydrated
   root already) — not reimplemented. Language hint + optional output block.
3. **Procedure/Step** (`procedure.tsx`) — native `<ol>/<li>` step-position
   semantics; each `Step` wraps in a `role="region"` landmark with a stable
   `id` + `tabIndex={-1}` for focus restoration (e.g. from a pager or a
   destructive-action confirm flow) without a prior click.
4. **ResponsiveDataRegion** (`responsive-data-region.tsx`) — one semantic
   `<table>` with `<caption>`/`<thead>`/`<tbody>`, `tabIndex={0}` matching
   the site-wide `.docs-body table[tabindex]` pattern; every `<td>` carries
   `data-label`. See "Known gap" below.
5. **Topology** (`topology.tsx`) — general-purpose static SVG diagram
   primitive (BFS-layered layout), generalizing the D16
   `reference/workflow-map.tsx` pattern for literal node/edge props instead
   of a specific bundle file. Reuses the exact `.wd-*` CSS classes D16
   already defines (zero new CSS). Always pairs the `aria-hidden` SVG with a
   legend `<ol>` and an adjacency `<table>` built from the same data, so the
   text equivalent ships in the same render, not as a caller responsibility.
6. **OperationMatrix** (`operation-matrix.tsx`) — dense operation × attribute
   grid built on `ResponsiveDataRegion`; kind (diagnostic/mutating/
   destructive) is a literal always-visible text label, never color-only,
   per the D10 test requirement.

All six: EN/VI labels via the same `Record<DocsLocale, Strings>` +
`STRINGS[locale] ?? STRINGS.en` pattern `DocsHomeExperience` already uses;
deterministic (same props → byte-identical `renderToStaticMarkup` output,
tested); accept only literal/typed props (no raw HTML anywhere).

## Known gap — responsive-data-region narrow-viewport card reflow: DEFERRED

The "record cards on narrow viewport" half of the ResponsiveDataRegion
contract (table on wide, record cards on narrow) is **not** shipped with CSS
in this slice. Root cause: `docs.css` is one stylesheet loaded by every
route (verified — a single `_next/static/css/*.css` file, no per-route
splitting), and the tightest-margin routes
(`/vi/{1.1.0,stable}/reference/workflows/`) were already at ~19 compressed
bytes of headroom under the frozen 304,000B `docs-per-route-ratchet.json`
cap *before this slice started* (P5 close state, matches prior session
memory). I iteratively minimized the Slice A CSS from an initial +721B
compressed down to +33B, cutting all Callout/CommandBlock/Procedure/
OperationMatrix visual styling to zero and even the narrow-reflow rule to 4
bare declarations — still ~33-36B over on the two vi/workflows routes. Per
this file's own history (`docs-per-route-ratchet.json` has two prior
"cap widen" entries, always framed as "a separate explicit user decision,
never unilateral"), I did not touch that file or widen the cap myself.

**Resolution applied**: shipped `ResponsiveDataRegion` with zero net CSS
delta (confirmed: compressed `docs.css` measured 5,013B before and after,
byte-identical). The component already renders the `data-label`-annotated
markup a card-reflow rule needs; `docs.css` carries a comment documenting
the exact deferred rule and why. Until the cap is widened (precedent: two
prior +2,000B widens for similar full-stop situations) or a later slice
frees matching headroom, the table gets the site-wide `.docs-body table`
local-scroll treatment at every width — no clipped or hidden content at
320px, just horizontal scroll instead of stacked cards. This is a
**documented, tracked deferral**, not a silent gap: see the comment above
`.rdr-table` in `docs.css` and the header comment in
`responsive-data-region.tsx`.

Same reasoning removed all Callout/OperationMatrix color-coding in this
slice (kept only Callout-destructive's border color, using an already-common
CSS variable for near-zero compression cost) — text labels alone already
satisfy the D10 "distinguishable without color" requirement; color is a
Slice B+ visual-polish addition once budget allows.

## Files created

- `apps/docs/src/components/prose/callout.tsx`
- `apps/docs/src/components/prose/command-block.tsx`
- `apps/docs/src/components/prose/procedure.tsx`
- `apps/docs/src/components/prose/responsive-data-region.tsx`
- `apps/docs/src/components/prose/topology.tsx`
- `apps/docs/src/components/prose/operation-matrix.tsx`
- `apps/docs/src/components/prose/index.ts`
- `tests/docs/prose-components.test.mjs` (24 tests: identity/determinism,
  escaping, no-JS fallback structure, EN/VI label resolution, per-component;
  uses an in-process esbuild bundle + `react-dom/server` render — see the
  test file header for why, since no `.tsx`-under-`node --test` loader
  exists elsewhere in this repo)

## Files modified

- `apps/docs/src/styles/docs.css` (+35 lines, net **zero** compressed-byte
  delta — the added lines are a documentation comment, no new rules ship)

## Files explicitly NOT touched (per brief)

- `apps/docs/src/components/docs-screen-registry.{ts,tsx}`
- Any `content/**/*.mdx`
- `apps/docs/src/components/reference/**`
- `packages/tokens/**`
- No `mdx-components.tsx` was created (see Deviation section)

## Tests / gates

- `pnpm --filter @ariadnev-web/docs typecheck` — pass
- `pnpm run test:docs` — 81/81 pass (24 new + 57 pre-existing, all green)
- `pnpm --filter @ariadnev-web/docs run build` — pass, exit 0,
  `docs-per-route-ratchet` gate passes (0 failures), `docs.css` compressed
  size unchanged at 5,013B (baseline == after)

## Byte-budget impact

**Unchanged.** `docs.css` compressed size: 5,013B before and after (measured
via the exact brotli-quality-9 method `verify-static-budget.mjs` uses).
No route's total changed. No component is wired into any route yet
(Slice B+), so HTML-side impact is currently zero regardless.

## Next natural checkpoint

Slice B (first batch of D02–D11 screen experiences consuming these
primitives) is unblocked. Whoever picks up Slice B should:

1. Read the `.rdr-table` deferral comment in `docs.css` before deciding
   whether the narrow-card CSS should land then (if a slice's own content
   changes free enough headroom, or if a cap widen is separately approved).
2. Reuse `.wd-*` for any further Topology usage exactly as `topology.tsx`
   does — do not reintroduce a parallel diagram class set.
3. Any new prose-component CSS must be measured against the current
   ~19-25B headroom on `/vi/{1.1.0,stable}/reference/workflows/` before
   landing; that pair is the binding constraint on shared `docs.css` growth
   until either a cap widen or a content-side shrink lands.

Status: DONE_WITH_CONCERNS
Summary: All 6 components built, tested (24/24 green, 81/81 docs suite),
typecheck clean, build green with zero net byte-budget impact. One
documented, tracked scope reduction: the ResponsiveDataRegion
narrow-viewport card-reflow CSS is deferred (not implemented) because the
shared stylesheet's tightest-margin routes had ~19B headroom before this
slice started and could not absorb it even after aggressive minimization;
markup is ready for the deferred rule with zero future component changes.
Concerns/Blockers: the near-zero per-route byte budget on
`/vi/*/reference/workflows/` will block essentially any further shared
`docs.css` growth in later slices until a cap widen (user decision, per
precedent) or a content-side shrink is chosen.
