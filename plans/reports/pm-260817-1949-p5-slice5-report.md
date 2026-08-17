# Phase 5 (Generated reference experiences) — slices 1-5 status report

Date: 2026-08-17

## Finding: slices 1-3 were already complete on `main` before this delegation

`git log --oneline -- scripts/docs-content/render-reference-pages.mjs` showed
commits `d9c5a69` (P5.slice1 — CLI index/detail split), `5ed2e40` (P5.slice4 —
retired CLI route pipeline), `bb7e7ed`/`fd1a54a` (skills catalog splits) already
present as ancestors of `HEAD` and already on `origin/main`, despite the
"24 commits ahead" framing suggesting Phase 5 had not started. Verified by
reading the actual generator (`renderCliCommandIndex`/`renderCliCommandDetail`/
`renderRetiredCliRoute`), `build-content-root.mjs` (D13 detail metadata,
retired-route emission, `navigationVisibility: reference-only`), and running
`pnpm run test:docs` (54/54 green) before making any change. Route/catalog/
search fixtures for D12-D17 (delegation slice 1) already exist and pass.

This meant delegation slices 1-3 required no new work; slices 4-5 were the
actual remaining scope.

## Slice 4 — design-check checkpoint

No browser/Figma available in this environment. Reviewed the built HTML output
(`apps/docs/out/en/stable/reference/cli/` and `.../reference/cli/mcp-add/`)
structurally at the source level: the new filter box, group headings, and
related-commands nav all reuse existing `docs.css` tokens
(`--vc-space-*`, `--vc-size-control-minimum`, `--vc-border-radius-control`,
`--vc-color-border`) and the same table/prose rules every other reference page
already uses — no new visual pattern introduced. Documented in the commit
message per the phase-05 instruction to record the check and continue when
autonomous visual review isn't possible.

## Slice 5 — D12 index grouping/filter + D13 semantic rows

Implemented and shipped in commit `b3ec1b6`:

- `apps/docs/src/components/reference/cli-command-index.tsx` —
  `CliCommandIndexExperience`, registered for `screenKind: "D12-cli-command-index"`.
  Groups commands by source-derived namespace (subcommand families like `mcp`,
  `plan`, `journal` get one heading each; standalone commands collect under
  "Other commands"), fully server-rendered from the catalog's own
  `D13-cli-command-detail` entries (title/description/slug — same data the
  flat Markdown index already carries).
- `apps/docs/src/components/reference/reference-index-filter.tsx` —
  progressive-enhancement client filter (`"use client"`) that hides
  non-matching `<h3>`/`<table>` groups after hydration; absent with JS
  disabled, so every group/row stays visible and reachable without JS.
- `apps/docs/src/components/reference/cli-command-detail.tsx` —
  `CliCommandDetailExperience`, registered for `screenKind: "D13-cli-command-detail"`
  (moved out of the generated-passthrough list). Adds a server-rendered
  "Related commands" nav (sibling commands in the same namespace), computed
  once per request from the catalog, no client code.
- `scripts/docs-content/build-content-root.mjs` — CLI index page now carries
  `pageKind: "reference-index"`, `screenKind: "D12-cli-command-index"`,
  `section: "reference"`.
- `scripts/docs-content/render-reference-pages.mjs` — exports
  `commandNamespace` as the single source of truth for the grouping rule.
- `apps/docs/src/components/docs-screen-registry.{ts,tsx}` — D12/D13 wired
  into the closed registry.
- `apps/docs/src/styles/docs.css` — `.reference-index-filter` and
  `.cli-command-related` rules, reusing existing tokens.

### Load-bearing decision: grouping lives in React, not in the generated Markdown

First attempt added namespace H3 headings directly to
`renderCliCommandIndex`'s Markdown output (and reshaped the Arguments section
into a table). This broke the docs build:
`apps/docs/scripts/build-search-index.mjs` throws when a partition exceeds
`tests/benchmarks/performance-budgets.json#search-index-en-compressed`
(cap 160,000B) — because `content` in the search index is the raw generated
Markdown read from disk. Measurement showed the **pre-existing baseline**
(before any change in this session) already sat at 159,996B compressed for
`en/1.1.0` — 4 bytes of headroom. Any visible addition to the CLI reference
Markdown blows this frozen cap; iteratively shrinking heading text only
recovered tens of bytes (gzip already compresses repeated tokens like
`ariadnev` near-optimally, so byte savings had to come from removing
*content*, not shortening strings).

Rather than widen `performance-budgets.json` (outside this delegation's file
ownership, and precedent in `docs-per-route-ratchet.json` shows cap widening
in this repo is treated as an explicit user decision, not something to do
silently mid-slice), the fix was architectural: **revert the generated
Markdown to be byte-identical to `HEAD`** (verified via `git diff` — the only
diff left is the new `commandNamespace` export, a pure addition with zero
effect on generated output) and **compose the namespace grouping in the React
experience from catalog data instead**. The catalog already carries
`title`/`description`/`slug` for every `D13-cli-command-detail` page — exactly
what the flat Markdown table needs — so grouping is genuinely
"server-rendered, source-derived, and no-JS-usable" (satisfying every D12
architecture requirement) while adding zero bytes to the indexed search
content. This only affects the rendered HTML (governed by
`docs-per-route-ratchet.json`, which has multi-KB headroom on this route), not
the search partition.

## Verification

- `node scripts/docs-content/build-content-root.mjs` — succeeds, 278 pages.
- `pnpm --filter @ariadnev-web/docs typecheck` — clean.
- `pnpm --filter @ariadnev-web/docs build` — succeeds: 447 static pages,
  `grandfatheredRoutes: 0`, search partitions within budget.
- `pnpm run test:docs` — 54/54 pass (native docs suite, includes D12/D13/D14/
  D15/D16/D17 structural-identity probes against the real build output).
- `pnpm run test` — 203 native + 54 docs + 176 vitest, all pass.
- Manual inspection of built HTML confirms grouped `<h3>`/`<table>` structure
  on `/en/stable/reference/cli/` and the "Related commands" nav on
  `/en/stable/reference/cli/mcp-add/`.

## Files touched

- `scripts/docs-content/render-reference-pages.mjs` (pure addition: `commandNamespace` export)
- `scripts/docs-content/build-content-root.mjs` (D12 catalog metadata only)
- `apps/docs/src/components/docs-screen-registry.ts`
- `apps/docs/src/components/docs-screen-registry.tsx`
- `apps/docs/src/components/reference/cli-command-index.tsx` (new)
- `apps/docs/src/components/reference/cli-command-detail.tsx` (new)
- `apps/docs/src/components/reference/reference-index-filter.tsx` (new)
- `apps/docs/src/styles/docs.css`

Not touched: `packages/tokens/**`, `apps/site/**`, `workers/**`,
`scripts/deploy/**`, `.github/**`, any P4/P6 D-series component outside
`reference/`.

## Status

Status: DONE
Summary: Slices 1-3 were already shipped on `main`/`origin` before this delegation; slice 4 (design-check) documented; slice 5 (D12 grouping/filter + D13 related commands) implemented, tested, committed (`b3ec1b6`), and pushed.
Slices completed: [1, 2, 3, 4, 5]
Commits pushed: [b3ec1b6]
Concerns/Blockers: `tests/benchmarks/performance-budgets.json#search-index-en-compressed` has 0-4 bytes of headroom for the `en/1.1.0` and `en/stable` CLI-reference-containing partitions. Any future slice that adds visible text to the generated `reference/cli/*.mdx` (or any other page sharing that search partition) will need either a genuine content trim elsewhere or an explicit user decision to widen the cap — same pattern already used for `docs-per-route-ratchet.json`. Flagging now so slice 6+ (providers/skills/workflows/release-notes enrichment) budgets this in.
Next natural checkpoint: Slice 6 (D14 provider comparison/mobile records) — already has a generator (`renderProviderReference`) but no dedicated React component per phase-05's "Related code files" (`provider-reference.tsx` not yet created); same search-budget constraint applies if any provider-reference Markdown grows.
