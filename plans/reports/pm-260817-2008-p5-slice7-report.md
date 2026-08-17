# Phase 5 slice 7 — D15 skill catalog

Commit: `d63574e`

## What shipped

- `D15-skill-catalog` (index page) registered with a thin
  `SkillCatalogExperience` wrapper — formalises identity, composition
  unchanged (same role `PassThroughExperience`/D02 plays).
- `D15-skill-category` (per-category detail page) graduated out of
  `GENERATED_PASSTHROUGH_SCREEN_KINDS` into `SkillCategoryExperience`:
  wraps the already-generated dense table with a progressive-enhancement
  name/description filter (`ReferenceIndexFilter`, reused from D12), no-JS
  safe, all rows visible without JavaScript.

## Load-bearing finding: single-page catalog does not fit the byte cap

First attempt rendered every one of the 105 skills (grouped by category,
including Uncategorized) on the index page from `skills.json`, bypassing
the generated Markdown entirely (same "compose from source data, zero cost
to search index" pattern as D12). Measured build output:
`/en/stable/reference/skills/` = 312–315KB against the frozen 304000-byte
per-route cap — confirmed by two iterations (first with visible keyword/
invocable lines, second with those stripped and markup compacted to a
single dense cell per row) that a full single-page catalog of all 105
skills' real descriptions cannot fit under the cap no matter how tight the
markup gets; description length is the dominant cost and is source text,
not something to shorten without inventing content.

Reverted to the existing architecture instead: the compact index +
per-category dense pages (the load-bearing shrink from an earlier slice)
stay as-is; D15 filtering lives on each category's own page, where the
dense rows already are. This satisfies "complete grouped list in initial
HTML" and "filtering across all 105 skills" distributed across the
category pages a reader reaches from the index — not literally one script
tag on one page — and stays inside every frozen budget.

## Discovered defect (not in this delegation's file ownership)

While verifying the filter's DOM contract, found that D12's
`CliCommandIndexExperience` wraps each namespace group in its own `<div>`
(`<div><h3/><table/></div>`), but `ReferenceIndexFilter` only inspects
`root.children` for `<h3>`/`<table>` *directly* — so on the live CLI index
page the filter input renders but the `root.children` walk never finds an
`<H3>`/`<TABLE>` tag (they're one level deeper, inside `<div>`), and typing
in the filter currently hides nothing. Confirmed by reading the actual
built `en/stable/reference/cli/` HTML.

This does not affect my slice 7 work — `SkillCategoryExperience` was
built as a `Fragment`, not a wrapping `<div>`, specifically to keep the
filter and the table true siblings under `#rendered-markdown`, and I
verified that structure in the built HTML. But `cli-command-index.tsx`
and `reference-index-filter.tsx` are both outside this delegation's file
ownership (slices 6-9 own `provider-reference.tsx`, `skill-catalog.tsx`,
`workflow-map.tsx`, `release-timeline.tsx`), so I did not fix it. Needs a
follow-up: either stop wrapping each CLI group in a `<div>`, or make
`ReferenceIndexFilter` walk `querySelectorAll` instead of `root.children`.

## Verification

`pnpm --filter @ariadnev-web/docs typecheck` clean; `pnpm run --filter
@ariadnev-web/docs build` succeeds (`grandfatheredRoutes: 0`, per-route
budget passes); `pnpm run test:docs` 54/54 pass; manual inspection of
`en/stable/reference/skills/utilities/index.html` confirms the filter
input and the `<table>` are true siblings under `#rendered-markdown`.
