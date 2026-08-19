---
phase: 3
title: "Marketing surfaces M01-M02"
status: completed
priority: P1
effort: "4-6 engineer-days"
dependencies:
  - "phase-01-surface-contexts-tokens-and-typography.md"
  - "phase-02-shared-shells-and-interaction-grammar.md"
---

# Phase 3: Marketing surfaces M01-M02

## Context links

- [Plan](./plan.md)
- [Phase 2 M01 pilot](./phase-02-shared-shells-and-interaction-grammar.md)
- [Marketing facts authority](../../apps/site/src/data/marketing-facts.ts)

## Overview

Complete M01 around the accepted hero/system-trace pilot and reinvent M02 as a
concise recovery dossier. Marketing becomes a short product narrative rather
than a technical specification wall, without deleting verified claims.

## Requirements

### Functional

- Preserve the five content responsibilities: promise/system trace, execution
  lifecycle, authority/workflow/provider boundary, evidence, and install.
- Recompose them into distinct macro rhythms: editorial opening, instrument
  trace, operational outcomes, registry/evidence band, dispatch panel.
- Keep all claims sourced from `marketing-facts.ts` or linked docs; change
  hierarchy/condensation, not truth.
- Preserve macOS/Linux and PowerShell commands, copy/manual fallback, release
  pin, docs, first-run, release-notes, and source links.
- M02 keeps real 404 status, unavailable-path explanation, recovery actions,
  and install path without mimicking a successful product route.
- Motion remains finite and state-caused; every effect has an immediate
  reduced-motion equivalent.

### Non-functional

- Essential content and all navigation exist in initial HTML.
- First mobile viewport contains product promise and primary install/docs path.
- Section density varies intentionally; no repeated card-grid or identical
  heading/prose/rule pattern across all macros.
- M01/M02 remain within marketing transfer budget and current CSP.

## Architecture

```text
marketing-facts.ts
  ├─ M01 page
  │   ├─ accepted hero/system trace
  │   ├─ lifecycle + operational outcomes
  │   ├─ authority/provider proof
  │   ├─ evidence registry
  │   └─ install dispatch
  └─ M02 recovery dossier

initial HTML is complete -> page-enhancer adds copy/finite emphasis only
```

## File inventory

| Action | File | Purpose | Test impact |
|---|---|---|---|
| Modify | `apps/site/src/pages/index.astro` | Final macro ordering and landmarks | Static structure |
| Modify | `apps/site/src/pages/404.astro` | M02 recovery composition | M02 visual/static status |
| Modify | `apps/site/src/components/execution-map.astro` | Lifecycle as editorial/instrument spread | No-JS/visual |
| Modify | `apps/site/src/components/authority-boundary.astro` | Full-width authority band | Structure/visual |
| Modify | `apps/site/src/components/workflow-section.astro` | Operational outcomes, not repeated cards | Source-link tests |
| Modify | `apps/site/src/components/provider-projection.astro` | Compact provider proof registry | Fact consistency |
| Modify | `apps/site/src/components/evidence-ledger.astro` | Evidence dossier/registry | Fact/source tests |
| Modify | `apps/site/src/components/final-install.astro`, `install-command.astro` | Command-first dispatch panel | Copy/progressive enhancement |
| Modify | `apps/site/src/styles/site.css` | Final M01/M02 composition and responsive art direction | Structure/budget/visual |
| Modify if needed | `apps/site/src/scripts/page-enhancer.ts` | Finite witness/copy states only | Reduced motion/no-JS |
| Read-only by default | `apps/site/src/data/marketing-facts.ts` | Claim authority; modify only to remove duplication, never invent facts | Release/fact tests |
| Modify | `tests/site/structure.test.ts`, `progressive-enhancement.test.ts`, `static-output.test.ts` | Lock macro diversity and unchanged contracts | Site suite |
| Update | M01/M02 files under `tests/visual/__baselines__/site/` | Approved final pixels only | Chromium visuals |

## Function and interface checklist

- [x] Structured data remains limited to verified software name, description,
  URL, category, and operating systems.
- [x] `InstallCommand` preserves explicit label, code text, copy target, status
  region, and no-JS manual selection.
- [x] `page-enhancer.ts` creates no essential content and cleans observers/listeners.
- [x] Execution visuals retain adjacent textual lifecycle/evidence/boundary
  equivalents.
- [x] Provider/workflow claims still resolve through `marketing-facts.ts` and
  authoritative docs links.
- [x] M02 response stays 404 while offering working recovery links.

## Implementation steps

1. Add assertions for required facts/actions/landmarks and M02 status before
   changing remaining macros.
2. Map every existing claim to its final macro; remove repeated explanation but
   retain the sole authoritative occurrence and source.
3. Recompose execution lifecycle and operational outcomes using asymmetric
   reading/instrument seams proven in M01.
4. Recompose authority/provider content as a dense registry band; keep human
   gate semantics amber/copper and verified evidence green.
5. Recompose evidence as a scannable dossier with claim/source/limit hierarchy.
6. Finish install dispatch and footer; keep commands and primary next steps
   reachable at all widths.
7. Rebuild M02 with the same brand/reading/instrument grammar and explicit
   broken-path recovery.
8. Audit finite enhancements, tab order, focus, forced colors, text spacing,
   reduced motion, and no-JS output.
9. Run focused site/build/budget tests, inspect five required viewports, then
   rotate only M01/M02 baselines and rerun twice.

## Test scenario matrix

| Priority | Scenario | Evidence |
|---|---|---|
| Critical | Install command/URL or release pin drifts | Release-pin/static tests fail |
| Critical | JS disabled removes claim, diagram meaning, or recovery action | Progressive-enhancement test fails |
| Critical | M02 returns success or dead-end | Static status/journey fails |
| High | 320/375 CTA or command clips | Visual + overflow probe fails |
| High | Macro composition repeats old card/rule rhythm | Human composition review rejects |
| High | CSP, remote asset, or runtime fetch introduced | Structure/static tests fail |
| High | Transfer cap exceeded | Marketing budget test fails |
| Medium | Copy status loses sighted/a11y feedback | Keyboard/copy journey fails |

## Dependency map

```text
Phase 2 M01 pilot
  ├─ lifecycle/outcomes
  ├─ authority/provider
  ├─ evidence registry
  ├─ install dispatch
  └─ M02 recovery
       -> Phase 6 site qualification
```

## Todo

- [x] Protect marketing facts and no-JS contracts.
- [x] Complete all M01 macro compositions.
- [x] Complete M02 recovery composition.
- [x] Verify responsive/accessibility/performance behavior.
- [x] Rotate and stabilize M01/M02 baselines.

## Success criteria

- [x] M01 presents five distinct macro rhythms and materially shorter perceived
  reading effort without removing required facts.
- [x] Promise, install, docs, release evidence, authority limits, and telemetry
  boundary remain accurate and discoverable.
- [x] M02 is visually intentional, returns 404, and offers purposeful recovery.
- [x] Site tests, budget, a11y modes, journeys, and two visual runs pass.

## Risk assessment

- **Condensation removes nuance:** signal: a required limit/source disappears.
  Response: use expandable visual hierarchy with all content in initial HTML,
  not deletion or JS-only disclosure.
- **Editorial direction weakens conversion:** signal: primary install/docs path
  falls below first viewport. Response: restore CTA hierarchy without generic
  hero theater.
- **SVG becomes decorative excess:** signal: textual equivalent no longer maps
  one-to-one. Response: simplify or remove supplemental geometry.
- **Shared token bleed affects docs:** signal: docs baselines move in site-only
  phase. Response: stop and repair app-local composition aliases.

## Security considerations

Keep structured data truthful, external links explicit, CSP unchanged, and copy
behavior local. Do not add analytics, remote media, form submission, or new
script origins.
