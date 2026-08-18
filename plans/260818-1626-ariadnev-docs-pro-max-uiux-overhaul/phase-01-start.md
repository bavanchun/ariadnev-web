---
phase: 1
title: "Core Design System & Prose Foundations"
status: completed
priority: P1
effort: "6h"
dependencies: []
---

# Phase 1: Core Design System & Prose Foundations

## Overview
Wire and activate token-based CSS styling for all prose components in `apps/docs/src/styles/docs.css`. This establishes the visual foundation for Callouts (`gate`, `boundary`, `destructive`, `evidence`, `note`), Operation Matrix Badges (`diagnostic`, `mutating`, `destructive`), Procedure Stepper Pipelines, enhanced Table card reflows, and the TOC Active Scrollspy indicator.

## Integrated AgentKit Skills
- `/ak:ui-styling`: Maps DTCG tokens from `@ariadnev-web/tokens` (`--vcs-*`) into crisp CSS rules.
- `/ak:ui-ux-pro-max`: Provides WCAG 2.2 AAA color pairs, typography rhythm, and micro-interaction states.
- `/ak:web-design-guidelines`: Enforces `prefers-reduced-motion`, `tabular-nums` on metrics, and focus replacements.

## Requirements
- Functional:
  - Add complete CSS definitions for `.callout`, `.callout-kicker`, `.callout-note`, `.callout-gate`, `.callout-boundary`, `.callout-destructive`, and `.callout-evidence`.
  - Add complete CSS definitions for `.operation-matrix-diagnostic`, `.operation-matrix-mutating`, and `.operation-matrix-destructive` pill badges.
  - Add complete CSS definitions for `.procedure`, `.procedure > li`, and `.procedure-step-kicker` with vertical stem connectors.
  - Add active scrollspy highlight for `.docs-toc a[aria-current="location"]`.
  - Add subtle hover state and active pill style for `.docs-sidebar a[aria-current="page"]`.
- Non-functional:
  - Zero raw hex colors (strict `var(--vc-*)`, `var(--vcs-*)`, `color-mix`).
  - Total stylesheet addition must not exceed ~1.2KB uncompressed (<300B brotli).

## Architecture & Code Changes
- Modify: `apps/docs/src/styles/docs.css`
  - Define `.callout-*` styles consuming `--vcs-content-callout-*` and `--vcs-color-*` tokens.
  - Define `.operation-matrix-*` badges consuming `--vcs-color-spectral-*`, `--vcs-color-copper-*`, `--vcs-color-signal-fail`.
  - Define `.procedure` stepper with `::before` connecting stem lines and glowing step pill kickers.
  - Define `.docs-toc a[aria-current="location"]` and `.docs-sidebar a[aria-current="page"]`.

## Implementation Steps
1. Add `.callout` container and 5 variant styles (`note`, `gate`, `boundary`, `destructive`, `evidence`) with left accent stripes.
2. Add `.operation-matrix-*` pill badges with semantic border and background tints.
3. Add `.procedure` numbered list connector styles with counter circles.
4. Add `.docs-toc a[aria-current="location"]` active state with spectral border and background tint.
5. Add `.docs-sidebar a[aria-current="page"]` active pill indicator.
6. Verify against `forbidden-runtime-features.test.mjs` and run `pnpm run test:docs`.

## Success Criteria
- [ ] Callouts render with distinct, high-contrast semantic borders and kickers across both light and dark backgrounds.
- [ ] Operation badges are immediately distinguishable without color alone (uppercase bold text + border + fill).
- [ ] Active TOC links visibly highlight when scrolling through document sections.
- [ ] 0% raw hex colors in `docs.css`.
- [ ] `pnpm run test:docs` passes completely.
