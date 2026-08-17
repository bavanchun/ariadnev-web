---
phase: 5
title: "Generated reference experiences"
status: completed
priority: P1
effort: "7-9d"
dependencies: [1, 2, 3, 4]
---

# Phase 5: Generated reference experiences

## Context

- [Plan](./plan.md)
- [Screen blueprint D12–D17](../reports/brainstorm-260816-2324-living-execution-atlas.md#d12--cli-command-index)
- Phase 1 command/catalog/performance contracts.
- Phase 4 safe content components.

## Overview

Rebuild every generated reference from machine-owned release data: compact CLI
index plus command pages, provider comparison, searchable 105-skill catalog,
workflow topology, and structured release notes. Preserve deterministic output,
historical editions, static discovery, no-JS access, and URL compatibility.

## Requirements

- D12 CLI index contains summaries and every legacy anchor, not duplicated
  option tables.
- D13 emits one canonical detail page per available command and edition.
- D14 provider reference supports comparison plus provider-first mobile records.
- D15 skill catalog supports category/name/keyword/invocable filtering while the
  complete grouped list remains in initial HTML.
- D16 workflow reference renders diagram, nodes, edges, legend, and text
  equivalent for all three graphs.
- D16 remains understandable in print, CSS-disabled, and assistive contexts;
  no topology fact exists only in color, geometry, or a client-side tab.
- D17 release notes expose edition/source authority and structured changes
  without inferring classifications absent from source.
- Search returns exactly one canonical command result per locale/version and
  useful grouped results for all reference types.
- Generated sources remain deterministic, public-safe, and bundle-derived.

## Architecture

### D12/D13 CLI

Split `renderCliReference` into index and detail renderers consuming the Phase
1 command contract. The index groups by source-derived command namespace and
renders command, description, aliases, canonical link, and real legacy IDs.

The detail template order is synopsis, arguments, options, source-provided
examples/exit behavior, related commands, siblings, and edition metadata.
Missing source fields are omitted. Retired routes render the Phase 1 approved
replacement/tombstone behavior; no unrelated redirect.

Client-side index filtering is progressive enhancement. All groups and links are
server-rendered and usable without JavaScript.

### D14 providers

Render a six-provider overview plus comparison matrix from release data.
Desktop comparison uses columns only when legible; mobile uses provider-first
records. A local scroller is allowed when necessary and must expose caption,
focus, and edge affordance. Unsupported means “not verified / skipped,” not
failure.

### D15 skills

Render generated count/category index and dense skill rows. Filter enhancement
supports name, keyword, category, and user-invocable. Category-less entries use
localized “Uncategorized.” Do not create skill detail routes in this plan.

### D16 workflows

Generate one static SVG topology per workflow from nodes/edges. Shapes and text
mark start/end, effect, gate, recovery, and direction. Diagram, Nodes, and Edges
are linkable server-rendered sections; tabs are optional enhancement. Mobile
adds a vertical simplification without changing graph semantics.

### D17 release notes

Render edition metadata and source-provided change groups. Long entries remain
in initial HTML. Add links to Upgrading and versioned docs home. Highlight
breaking/security/migration only when source explicitly supplies that meaning.

## Related code files

- Modify: `scripts/docs-content/render-reference-pages.mjs`
- Modify: `scripts/docs-content/build-content-root.mjs`
- Modify: `apps/docs/src/lib/content-catalog.ts`
- Modify: `apps/docs/src/lib/search-index.ts`
- Modify: `apps/docs/src/lib/static-discovery.ts`
- Modify: `apps/docs/scripts/build-search-index.mjs`
- Create: `apps/docs/src/components/reference/cli-command-index.tsx`
- Create: `apps/docs/src/components/reference/cli-command-detail.tsx`
- Create: `apps/docs/src/components/reference/provider-reference.tsx`
- Create: `apps/docs/src/components/reference/skill-catalog.tsx`
- Create: `apps/docs/src/components/reference/workflow-map.tsx`
- Create: `apps/docs/src/components/reference/release-timeline.tsx`
- Modify: `apps/docs/src/styles/docs.css`
- Modify: `tests/docs/content-pipeline.test.mjs`
- Modify: `tests/docs/search-isolation.test.mjs`
- Modify: `tests/docs/static-discovery.test.mjs`
- Modify: `tests/docs/static-routing.test.mjs`
- Add reference-focused tests under `tests/docs/`.

## Implementation steps

1. Write route/catalog/search fixtures for all D12–D17 outputs before changing
   the renderer.
2. Split CLI renderer; preserve visible legacy index targets and emit canonical
   current plus historical detail pages.
3. Add retired-route output and prove aliases never become canonical routes.
4. Review one dense 320px and one orientation-heavy desktop composition for
   D12–D16 against the Phase 2 specimen before multiplying generated templates.
5. Implement D12 index grouping/filter and D13 semantic argument/option rows.
6. Rebuild D14 provider comparison and mobile records from the provider bundle.
7. Implement D15 static grouped catalog and progressive filters across all 105
   skills, including uncategorized entries.
8. Generate D16 diagrams from graph data and preserve node/edge/text/print
   views.
9. Recompose D17 release output without adding inferred labels.
10. Update search indexing and deduplicate canonical command results.
11. Update static discovery/`llms` outputs and route enumeration.
12. Re-measure all Phase 1 performance groups; compare like-for-like metrics.
13. Run deterministic generation twice and compare outputs byte-for-byte.

## Test scenarios

| Priority | Scenario |
|---|---|
| Critical | Every current/historical command source entry has exactly one canonical route |
| Critical | Every legacy fragment lands on a visible index row and detail link |
| Critical | No command detail appears in global sidebar |
| Critical | Search has one canonical command hit per locale/version |
| High | D14 content is not clipped; local scroller/record transform is usable at 320px |
| High | D15 all 105 skills exist in no-JS HTML and filters preserve accessible names |
| High | D16 every edge/node remains represented in visual and textual views |
| High | D17 never invents change classifications |
| Medium | EN/VI labels localize while command/provider/skill identities stay unchanged |

## Success criteria

- [ ] Current details project to +212 HTML routes and current+historical output
      matches the measured Phase 1 contract, currently projected +318.
- [ ] Every available historical command ships; no historical scope is deferred.
- [ ] Every legacy anchor and retired URL follows the approved contract.
- [ ] CLI index contains no duplicated full option tables.
- [ ] A named command is reachable in at most two purposeful interactions and
      without JavaScript.
- [ ] Provider data is complete, reachable, and not page-clipped at 320px.
- [ ] All 105 skills and category counts derive from source; filter/no-JS tests
      pass.
- [ ] All three workflow graphs have exact topology and text equivalents.
- [ ] Workflow topology remains complete in print and with CSS/JavaScript
      disabled.
- [ ] Release notes remain source-faithful and fully present in initial HTML.
- [ ] Search/discovery output is canonical, deterministic, and partition-safe.
- [ ] All four Phase 1 performance groups pass without silent budget changes.
- [ ] Every grandfathered ceiling in `tests/benchmarks/docs-per-route-ratchet.json`
      equals 300000 (i.e. the 10 over-cap reference routes now fit the frozen
      cap). Splitting `reference/skills` and `reference/cli` into per-command
      detail pages is the load-bearing lever; this criterion inherits the
      shrink obligation deferred from Phase 3 (see
      `docs/decisions/docs-performance-baselines.md#shrink-criterion-accepted-2026-08-17-re-scoped-2026-08-17`).
- [ ] `pnpm run test:qualification` passes.

## Risk assessment

- **Registry and bundle disagree.** Fail generation and return to Phase 1; do
  not guess identity.
- **Generated diagrams become unreadable.** Keep authoritative tables/text and
  simplify only layout, never graph data.
- **Skill filtering adds excessive client code.** Use a small DOM filter over
  server-rendered rows; global search remains separate.
- **Route growth exceeds output/build cap.** Optimize generation/sharding; stop
  for user decision if still over. Historical pages are not cut.
- **Reference components expose unsafe MDX.** Consume only the Phase 1/4 closed
  registry and literal props.

## Security considerations

- Normalize all generated slugs, anchors, URLs, and SVG labels.
- Escape source text; no `dangerouslySetInnerHTML`.
- Search and filters never execute source content.
