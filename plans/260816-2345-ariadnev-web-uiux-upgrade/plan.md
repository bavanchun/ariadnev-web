---
title: "ariadnev web UI/UX upgrade — Living Execution Atlas"
description: "Upgrade every marketing and documentation screen into one premium, static, bilingual Living Execution Atlas without weakening URLs, generated-source authority, accessibility, or performance."
status: pending
priority: P1
effort: "7-9w critical path with parallel site/docs ownership; 40-53 engineer-days"
branch: main
tags: [frontend, docs, ux, accessibility, design-system]
blockedBy: []
blocks: []
created: 2026-08-16
---

# ariadnev web UI/UX upgrade — Living Execution Atlas

## Overview

This plan implements the complete whole-site audit and screen-by-screen
brainstorm:

- [Whole-site UI/UX audit](../reports/audit-260816-2007-ui-ux-whole-site.md)
- [Living Execution Atlas brainstorm](../reports/brainstorm-260816-2324-living-execution-atlas.md)

The target has two registers:

- **Marketing is the expressive atlas:** memorable execution narrative,
  truthful topology, distinct macro-compositions, native mobile art direction.
- **Docs is the operational field manual:** fast orientation, exact lookup,
  page-specific task structures, generated references, complete EN/VI chrome.

Phase 1 is a hard implementation gate. It resolves immutable command identity,
retired URLs, Fumadocs adoption, safe MDX components, route cardinality, and
separate performance budgets before product UI changes begin.

## Delivery contract

### Outcome

- Upgrade M01–M02 and D00–D18 from the brainstorm, including shared shells,
  overlays, error states, no-JS behavior, responsive variants, and verification.
- Preserve one visual system across Astro marketing and Next/Fumadocs docs
  without sharing framework components across apps.
- Make every current docs route useful for its actual job: task completion,
  conceptual understanding, lookup, historical reference, or recovery.

### Constraints

- Preserve execution cartography: ink, graphite, cool white, spectral blue for
  live execution/witness, copper for human gates, drafted geometry.
- Dark-only in this delivery. No new accent family, decorative body gradient,
  glow, ambient loop, WebGL, Three.js, or framework migration.
- Keep Astro 7 static marketing and Next 16/React 19/Fumadocs docs unless Phase
  1 proves a narrow compatibility change is required.
- Preserve verified claims, public URLs, locale/version routing, static output,
  generated release authority, no-JS navigation, and EN/VI.
- Do not hand-edit generated MDX or token output.
- Any Radix, Motion, or other transitive capability imported by application code
  must become a direct dependency of the owning package; do not rely on a
  transitive install.
- Do not weaken existing tests or frozen budgets. A budget change requires a
  separate explicit user decision; a heavier shell alone is not justification.
- No user-approved scope item may be deferred by a phase-level risk response.

### Non-goals

- No rebrand, CMS, backend work, new locale, testimonials, invented data,
  personalization, remembered locale, or automatic locale redirect.
- No individual skill-detail pages. D15 remains a searchable static catalog.
- No alias routes for commands. Aliases are search metadata and legacy anchors.
- No visual-only replacement of semantic HTML or textual graph equivalents.

## Screen coverage

| Surface | IDs | Owning phase |
|---|---|---|
| Marketing home + site 404 | M01–M02 | 6 |
| Docs chooser, current/previous homes, authored screens, not-found | D00–D11, D18 | 4 |
| CLI index/detail, providers, skills, workflows, release notes | D12–D17 | 5 |
| Header, footer, docs shell, drawer, search, switchers, TOC, pager, copy states | Shared | 3, then consumed by 4–6 |
| Deterministic visual, keyboard, no-JS, i18n, a11y, performance gates | All | 7 |

All 36 catalog entries are route variants of these screen contracts.
Current stable has 15 catalog pages per locale: 10 authored pages including the
home plus five generated pages. Previous stable has three pages per locale.
Command-detail routes add one D13 instance per available command.

## Phases

| # | Phase | Depends on | Status |
|---|---|---|---|
| 1 | [Contract gate and measurement spike](./phase-01-contract-gate-and-measurement-spike.md) | — | In progress (session 1: contract, catalog, decisions #1 + baselines shipped; session 2: spikes) |
| 2 | [Shared design tokens and foundations](./phase-02-shared-design-tokens-and-shell-primitives.md) | 1 | Pending |
| 3 | [Docs safety, shell, and shared interactions](./phase-03-docs-safety-and-shell.md) | 1, 2 | Pending |
| 4 | [Authored docs screen experiences](./phase-04-authored-docs-screen-experiences.md) | 1, 2, 3 | Pending |
| 5 | [Generated reference experiences](./phase-05-generated-reference-experience.md) | 1, 2, 3, 4 | Pending |
| 6 | [Marketing surfaces](./phase-06-marketing-surfaces.md) | 1, 2 | Pending |
| 7 | [Full deterministic verification](./phase-07-full-deterministic-verification.md) | 1–6 | Pending |

Phases 3→4→5 are sequential because they share catalog metadata, safe MDX
components, search, and page templates. Phase 6 may run after Phase 2 in
parallel with the docs sequence because it owns only `apps/site` and site tests.
Phase 7 integrates both surfaces after composition stabilizes.

The 7–9 week wall-time estimate assumes Phase 6 has an independent site owner
after Phase 2. A single implementation stream is approximately 8–11 weeks.
These ranges include design checkpoints and deterministic verification, not
only coding time.

## Locked decisions

- Living Execution Atlas; same tokens and semantics, different marketing/docs
  expression.
- Dark-only.
- Explicit locale URLs; no cookie, localStorage, or redirect preference.
- CLI aggregate stays at `/reference/cli/`; command details use
  `/reference/cli/<slug>/`.
- Existing CLI fragments remain visible index targets; no JavaScript redirect.
- Historical detail pages ship whenever historical source contains the command.
  If budgets fail, stop and replan; do not cut historical scope.
- Command identity is immutable. Prefer upstream `commandId`; otherwise use a
  committed registry plus retired-route map.
- Command pages stay out of global sidebar and produce exactly one canonical
  search result per locale/version partition.
- Fumadocs UI is evaluated as behavior substrate, not adopted as a visual
  template by default.
- `@axe-core/playwright` becomes a direct dev dependency only in Phase 7.

## Performance contract

Phase 1 records four independent baselines and caps:

1. **Per-route compressed transfer:** current budget script semantics; measure
   installation plus representative shell-heavy/reference routes.
2. **Total static output:** HTML + Markdown discovery output on disk.
3. **Search/discovery:** bytes per locale/version index, `llms.txt` and
   `llms-full.txt` size/cardinality.
4. **Build cost:** route count, build wall time, and peak memory.

The observed 297,860-byte value is per sampled route and referenced assets,
not total `apps/docs/out`. Added routes primarily affect output, search, and
build metrics; Fumadocs/client-shell choices affect route transfer.

## Whole-plan acceptance

- Every M01–M02/D00–D18 contract has an owning phase, related files, test
  scenarios, and observable completion evidence.
- No clipping or hidden page-level overflow at 320/375/390/768/1280/1440.
  Local table/code scrollers are visible, keyboard reachable, and fully usable.
- All docs navigation is discoverable without a horizontal link strip.
- Complete VI application chrome and announcements; static `<html lang>`
  remains correct.
- A named CLI command reaches canonical detail in at most two purposeful
  interactions at 320px and without JavaScript.
- Legacy fragments and retired command URLs remain useful.
- Search returns one canonical command result per locale/version; generated
  command pages stay out of global navigation.
- Marketing has five distinct macro-compositions while retaining workflow,
  provider, evidence, install, shared header/footer, and M02 recovery content.
- Every audit P0/P1 closes. Every P2/P3 maps to an implementation phase or an
  explicit product-owner decision; verification is not a dumping ground for
  unfinished polish.
- Representative composition proofs are reviewed at the four mandatory stress
  frames before a page family is multiplied. The review checks hierarchy,
  task path, content truth, EN/VI fit, responsive art direction, and avoidance
  of repeated-card-grid sameness.
- Critical task outcomes are benchmarked before and after implementation:
  choose locale, install, complete first install, find an exact command,
  compare a provider, understand one workflow, recover from an unavailable
  locale/version/page, and identify destructive migration boundaries.
- `pnpm run test:qualification` includes deterministic visual, axe, keyboard,
  no-JS, i18n, route, search, Lighthouse, and budget gates.

## File ownership

| Phase | Exclusive primary ownership |
|---|---|
| 1 | command/catalog contracts, spike fixtures, decision records |
| 2 | `packages/tokens`, token tests, foundation decision |
| 3 | docs shell, global docs CSS, shared interactions, catalog shell metadata |
| 4 | language/not-found screens, authored MDX, authored screen components, safe component registry |
| 5 | generated reference renderer, generated reference components, search indexing |
| 6 | `apps/site` pages/components/styles/scripts and site tests |
| 7 | Playwright/Lighthouse harness, baselines, qualification wiring, verification runbook |

Later phases may consume earlier files but do not reopen their contracts without
failing the owning phase and updating its decision record.

## Audit traceability

- Phase 1: contract, route, Fumadocs, performance uncertainty.
- Phase 2: token state, type, code/data/callout surfaces, shell dimensions.
- Phase 3: audit P0/P1 shell, mobile nav, clipping, switcher/search semantics,
  sticky navigation, TOC, breadcrumb, pager, VI chrome.
- Phase 4: D00–D11/D18 and authored-content-specific P2/P3.
- Phase 5: D12–D17, generated reference scale, CLI anchors/routes/search.
- Phase 6: marketing composition, 404, header/footer, pressed/touch/copy states.
- Phase 7: regression proof only; defects found return to their owner phase.

## Risks and stop conditions

- Phase 1 cannot establish immutable command identity or retired-route behavior:
  stop; do not generate canonical detail URLs.
- No Fumadocs variant passes static export, localization, keyboard, and transfer
  gates: keep bespoke shell and document why.
- Safe MDX components cannot retain clean Markdown discovery output: keep source
  pure Markdown and implement screen visuals outside MDX; do not weaken the
  public-Markdown boundary.
- A frozen budget cannot be met after measured optimization: stop and request a
  user decision. No silent budget increase or scope cut.
- A screen-specific visual duplicates machine-owned facts: replace its data
  source before merge.

## Open questions

None blocking. Phase 1 resolves implementation choices through measured decision
records; any outcome requiring a scope or frozen-budget change returns to the
user.

## Success criteria

- [ ] All seven phase contracts pass.
- [ ] M01–M02 and D00–D18 coverage matrix has no unowned item.
- [ ] All locked decisions remain consistent across every phase.
- [ ] Full qualification passes from a clean production build.
- [ ] Whole-plan consistency sweep reports zero unresolved contradictions.

<!-- slug: ariadnev-web-uiux-upgrade -->
