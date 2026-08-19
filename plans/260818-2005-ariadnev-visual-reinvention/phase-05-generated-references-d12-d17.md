---
phase: 5
title: "Generated references D12-D17"
status: pending
priority: P1
effort: "5-7 engineer-days"
dependencies:
  - "phase-01-surface-contexts-tokens-and-typography.md"
  - "phase-02-shared-shells-and-interaction-grammar.md"
  - "phase-04-authored-docs-d00-d11-d18.md"
---

# Phase 5: Generated references D12-D17

## Context links

- [Plan](./plan.md)
- [Accepted D12 pilot](./phase-02-shared-shells-and-interaction-grammar.md)
- [Generated docs pipeline](../../scripts/docs-content/render-reference-pages.mjs)
- [Migration/verification research](./research/research-260818-2014-migration-verification-rollout-strategy.md)

## Overview

Expand the accepted D12 reference-workbench pattern across command details,
provider matrices, skill catalogs/categories, workflow graphs, and release
notes. Preserve generated data and search/discovery contracts exactly while
replacing the recent bento/timeline/glow presentation.

## Requirements

### Functional

- D12 remains the accepted index pilot: complete static index, progressive
  filter, namespace orientation, exact command path in at most two interactions.
- D13 command details expose signature, aliases, options, examples, source
  edition, related commands, and pager without entering global navigation.
- D14 provider comparison supports side-by-side scanning on desktop and labeled
  records/local scrolling on mobile; skipped/unverified rationale remains clear.
- D15 index/category pages keep static category routes and fast progressive
  filtering at real catalog scale.
- D16 keeps generated text/adjacency as authority and SVG as supplemental.
- D17 keeps source-faithful release body, edition metadata, and truthful
  highlight links.
- Generated routes, search canonicalization, retired/legacy behavior, Markdown
  discovery, `llms*`, and locale/version partitions remain unchanged.

### Non-functional

- No full-prose search tokenization for command detail pages; preserve the live
  page-kind extraction contract.
- No per-record client component multiplication or decorative SVG duplication
  that threatens route/search/build budgets.
- D13 gains deterministic visual fixture coverage; all D12-D17 archetypes have
  semantic and pixel evidence.
- Filters enhance complete initial HTML and preserve localized announcements.

## Architecture

```text
verified release bundle
  -> content root + catalog/pageKind
     -> screen registry
        -> reference components
           ├─ static initial HTML + Markdown discovery
           └─ bounded filter/copy enhancement

No visual component becomes a second source of command/provider/skill/workflow data.
```

## File inventory

| Action | File(s) | Purpose | Test impact |
|---|---|---|---|
| Preserve/integrate | `apps/docs/src/components/reference/cli-command-index.tsx`, `reference-index-filter.tsx` | Accepted D12 pilot | Search/task regression |
| Modify | `cli-command-detail.tsx` | D13 command dossier | Route/search/detail visuals |
| Modify | `provider-reference.tsx` | D14 matrix/record composition | Provider task/overflow |
| Modify | `skill-catalog.tsx` | D15 index/category density | Catalog filtering/budget |
| Modify | `workflow-map.tsx` | D16 instrument graph + textual authority | Workflow task/a11y |
| Modify | `release-timeline.tsx` | D17 edition ledger, not decorative timeline | Release/source tests |
| Modify if required | `apps/docs/src/lib/chrome-strings.ts` | New visible/a11y labels with EN/VI parity | VI parity |
| Read-only by default | `apps/docs/src/lib/content-catalog.ts`, `content-source.ts`, `search-index.ts` | Existing identity/index authority; change only for proven visual metadata need | Catalog/search contracts |
| Modify | `apps/docs/src/styles/docs.css` | Reference archetype styles | Forbidden features/budget/visual |
| Modify | `tests/benchmarks/screen-fixtures.json`, `tests/visual/lib/screen-fixtures.mjs`, `tests/visual/docs/docs-screens.spec.ts` | Add representative D13 fixture | Manifest/visual suite |
| Modify | `tests/docs/screen-fixture-manifest.test.mjs`, `screen-fixture-structural-probes.test.mjs` | Lock D13 fixture ID and canonical generated route identity | Docs native suite |
| Modify | `tests/docs/docs-screen-registry.test.mjs`, `search-isolation.test.mjs`, `static-discovery.test.mjs` | Protect page-kind/search/discovery contracts | Docs native suite |
| Update/create | D12-D17 files under `tests/visual/__baselines__/docs/` | Approved reference evidence | Chromium visuals |

Generated files under `apps/docs/content/generated/` and `apps/docs/out/` are
build products, never hand-edited.

## Function and interface checklist

- [ ] `ReferenceIndexFilter` keeps `/` focus, Escape clear, accurate visible
  count, localized live status, and complete no-JS initial records.
- [ ] CLI details use immutable command identity/canonical slug and preserve
  alias metadata without alias routes.
- [ ] Command details remain excluded from global sidebar and appear once per
  locale/version search partition.
- [ ] Provider statuses distinguish supported/skipped/unverified using text,
  shape, and source rationale.
- [ ] Skill index/category split and page-kind identities remain unchanged.
- [ ] Workflow SVG exposes no sole source of meaning; text adjacency remains
  complete and keyboard/print usable.
- [ ] Release highlight links are emitted only for headings that exist.
- [ ] Search extraction remains MIN for command details and within 160000-byte
  partition caps.

## Implementation steps

1. Add a representative D13 fixture and semantic assertions before changing
   references; do not update snapshots yet.
2. Integrate D12 pilot and identify reusable record/table/filter primitives;
   avoid a universal card abstraction that erases archetype differences.
3. Recompose D13 as a compact command dossier with signature-first hierarchy,
   option scanning, source edition, related commands, and pager.
4. Recompose D14 for comparison across wide and narrow layouts; preserve local
   overflow cues and skipped rationale.
5. Recompose D15 index/categories for real data scale using static groups and
   bounded enhancement; measure HTML and interaction cost.
6. Recompose D16 graphs as instrument evidence with complete text/print paths.
7. Recompose D17 as an edition ledger; remove decorative timeline assumptions
   not supported by source structure.
8. Regenerate content/search/discovery from the pinned bundle and inspect route
   count, canonical results, Markdown output, and partition sizes.
9. Run reference/static/search/budget tests before seeding/rotating D13-D17
   baselines. Inspect 320/375/768/1280/1440 stress frames, then rerun twice.

## Test scenario matrix

| Priority | Scenario | Evidence |
|---|---|---|
| Critical | Generated fact differs from release source | Content pipeline contract fails |
| Critical | Canonical command missing/duplicated or enters sidebar | Registry/search tests fail |
| Critical | Search partition exceeds 160000 compressed | Search budget fails |
| Critical | No-JS D12 index or D13 detail becomes unusable | Task/static journey fails |
| High | D14 at 320 loses comparison labels or clips page | Provider stress frame fails |
| High | D15 scale causes slow filter/layout or budget growth | Catalog interaction/budget fails |
| High | D16 SVG becomes sole authority | A11y/text contract fails |
| High | Generated route/discovery cardinality changes | Static routing/discovery fails |
| Medium | D13 new snapshot is unstable | Two-run visual gate fails |

## Dependency map

```text
D12 pilot
  ├─ D13 command details
  ├─ D14 provider comparison
  ├─ D15 skill index/categories
  ├─ D16 workflow evidence
  └─ D17 release ledger
       -> regenerated content/search/discovery
       -> Phase 6 qualification
```

## Todo

- [ ] Add D13 fixture and protect generated contracts.
- [ ] Recompose D13-D17 around the accepted D12 grammar.
- [ ] Regenerate and verify route/search/discovery outputs.
- [ ] Pass reference, no-JS, accessibility, and budget gates.
- [ ] Seed/rotate and stabilize all reference baselines.

## Success criteria

- [ ] D12-D17 are visually coherent but retain distinct page jobs.
- [ ] Every generated fact and route remains release-authoritative.
- [ ] Exact command/provider/workflow tasks meet current interaction outcomes.
- [ ] Search/discovery/route/budget contracts pass with no cap or ratchet change.
- [ ] D13 joins deterministic visual coverage; two full reference visual runs
  are stable.

## Risk assessment

- **Decorative markup consumes tight route budget:** signal: D06/D12/D13 crosses
  live cap. Response: remove wrappers/client behavior/SVG duplication before
  changing budgets.
- **Universal reference abstraction hides page differences:** signal: every
  page becomes the same grid/card list. Response: share low-level record/state
  grammar only; keep archetype components separate.
- **Search drift:** signal: command details duplicate results or partition grows.
  Response: preserve page-kind extraction and MIN tokenization; stop before
  changing search authority.
- **Catalog scale differs from stale plans:** signal: hardcoded 103/447 counts.
  Response: derive all counts from live catalog/build artifacts.

## Security considerations

Keep release bundle verification, safe generated Markdown, escaped content,
partition isolation, static links, and no remote runtime fetch. Do not render
command/source strings through unsafe HTML.
