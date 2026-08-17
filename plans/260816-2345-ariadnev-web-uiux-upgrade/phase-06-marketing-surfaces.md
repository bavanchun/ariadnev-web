---
phase: 6
title: "Marketing surfaces"
status: substantially-complete
priority: P1
effort: "6-8d"
dependencies: [1, 2]
---

<!-- 2026-08-17 status: all five M01 macros shipped (slice2 M02,
slice3 authority-boundary, slice4 split hero, slice5 path narrative,
slice6 evidence ledger, slice7 terminal action, slice8 desktop-
horizontal hero-path). Remaining: step 3 header hover/pressed/current
polish, step 10 one-shot semantic path transition, step 12 explicit
1440 render pass. Deferred to P7 verification: cross-viewport
Playwright walkthroughs. -->


# Phase 6: Marketing surfaces

## Context

- [Plan](./plan.md)
- [Screen blueprint M01–M02](../reports/brainstorm-260816-2324-living-execution-atlas.md#m01--marketing-home)
- Phase 2 shared tokens.

## Overview

Recompose the complete marketing surface—not only the hero—into the expressive
atlas. Deliver M01 home, M02 404, shared header/footer, all existing workflow and
provider facts, native mobile path art direction, stable copy feedback, and
finite semantic motion.

## Requirements

- M01 uses five distinct macro-compositions: split hero/live path, path
  narrative, authority boundary, evidence ledger, terminal action.
- Workflow and provider content remain first-class subregions inside the
  authority-boundary macro; no verified content disappears.
- Execution path is the hero's memorable object and a vertical composition on
  mobile.
- Header preserves one-interaction Docs and Install access at every width.
- Footer preserves local-first/no-hosted-control-plane boundary.
- M02 communicates honest 404 semantics and contextual recovery.
- Page works with no JavaScript and reduced motion.
- No invented claims, source identities, metrics, testimonials, provider parity,
  or fake runtime state.

## Architecture

### Shared chrome

Keep compact logo/home, Docs, and Install; no hamburger for two actions. Add
semantic hover/focus/pressed/current states from Phase 2. Footer remains concise
unless verified link count genuinely grows.

### M01 composition

1. **Split hero/live path:** 5/7 desktop split; copy/actions/command/release pin
   beside compile→policy→execute→checkpoint→proof. Static complete diagram first.
2. **Path narrative:** sticky compact topology plus five chapters on desktop;
   one ordered vertical timeline on mobile. Each state names meaning, produced
   evidence, and claim boundary.
3. **Authority boundary:** workflow lanes and provider projection share one
   macro but remain distinct subregions. Workflow compares authority/gate/
   recovery; provider exposes six verified identities and docs matrix link.
4. **Evidence ledger:** kind, claim, source, and limit in aligned records;
   mobile field labels retain relationships.
5. **Terminal action:** platform commands, first-run path, release notes, and
   read-script-first link with stable local copy feedback.

Finite motion may advance the demonstrative path once when allowed, then stop.
It never represents a live user run.

### M02

Use a broken graphite route, concise missing-path explanation, Home primary
recovery, Docs/Release secondary, and a separately labeled installer recovery
only where useful. Preserve true 404, `noindex`, and direct links.

## Related code files

- Modify: `apps/site/src/layouts/base-layout.astro`
- Modify: `apps/site/src/pages/index.astro`
- Modify: `apps/site/src/pages/404.astro`
- Modify: `apps/site/src/components/site-header.astro`
- Modify: `apps/site/src/components/promise-section.astro`
- Modify: `apps/site/src/components/execution-map.astro`
- Modify: `apps/site/src/components/workflow-section.astro`
- Modify: `apps/site/src/components/provider-projection.astro`
- Modify: `apps/site/src/components/evidence-ledger.astro`
- Modify: `apps/site/src/components/final-install.astro`
- Modify: `apps/site/src/components/install-command.astro`
- Create: `apps/site/src/components/hero-section.astro`
- Create: `apps/site/src/components/authority-boundary.astro`
- Modify: `apps/site/src/scripts/page-enhancer.ts`
- Modify: `apps/site/src/styles/site.css`
- Modify: `tests/site/structure.test.ts`
- Modify: `tests/site/progressive-enhancement.test.ts`
- Modify: `tests/site/release-pin.test.ts`
- Modify: `tests/site/static-output.test.ts`
- Modify: `tests/site/performance-budget.test.ts`

## Implementation steps

1. Add structural tests for M01 macro order/content retention and M02 recovery.
2. Storyboard all five M01 macros and M02 at 320/1440, including reading order,
   VI wrap risk, static state, reduced-motion state, and semantic text fallback;
   review before production composition work.
3. Rework shared header/footer states and remove page-level overflow masking.
4. Build split hero with one shared execution data source and correct reading
   order.
5. Build horizontal desktop and vertical mobile path views from that source;
   retain one authoritative ordered text representation.
6. Recompose path narrative with anchors and sticky offset behavior.
7. Rebuild workflow lanes, then provider projection, inside authority boundary.
8. Recompose evidence ledger and terminal action without changing facts.
9. Implement stable copy ready/success/manual/error states.
10. Add one-shot semantic path transition; verify no-JS and reduced-motion
   immediate states.
11. Recompose M02 while retaining true status/noindex behavior.
12. Render at 320/375/390/768/1280/1440 and run site structural, accessibility,
    release-pin, static-output, and budget tests.

## Test scenarios

| Priority | Scenario |
|---|---|
| Critical | M01 retains every verified workflow, provider, evidence, install, and footer claim |
| Critical | M02 remains a real noindex 404 with direct recovery |
| High | Execution path is vertical and page does not overflow at 320px |
| High | No-JS retains install/docs links, commands, topology text, workflow/provider facts |
| High | Reduced motion shows final meaningful state without transition |
| High | Copy denied/failure exposes manual selection without layout shift |
| Medium | Semantic `<time datetime>` and locale-aware release date |

## Success criteria

- [ ] All five macro-compositions are present and structurally distinct.
- [ ] Approved 320/1440 storyboard survives implementation in hierarchy,
      reading order, truth boundaries, and responsive art direction.
- [ ] Workflow and provider subregions both remain complete.
- [ ] Hero path is static-useful, finite when animated, and vertical on mobile.
- [ ] Header exposes Docs and Install in one interaction at 320px.
- [ ] Evidence records preserve source and limit adjacency.
- [ ] Copy feedback never inserts a shifting row.
- [ ] M02 satisfies visual, semantic, status, and recovery contract.
- [ ] No page-level horizontal overflow is hidden.
- [ ] No verified fact/URL is removed or invented.
- [ ] `pnpm run test:qualification` passes within existing site budgets.

## Risk assessment

- **Five macros flatten into repeated sections.** Review information structure,
  not background variation; reject repeated card grids.
- **Authority boundary hides workflow/provider detail.** Keep separate subregion
  headings and mobile flows; structural tests assert both.
- **Hero duplicates accessible content.** SVG is decorative only when ordered
  text contains the same meaning.
- **Motion implies a live run.** Label demonstration and stop after one finite
  transition; static state remains default evidence.
- **404 redesign changes edge behavior.** Preserve path/status tests before
  styling.

## Security considerations

- Install commands remain static constants; never interpolate URL/query input.
- Clipboard code copies only authored command text.
- Structured data remains limited to verified public facts.
