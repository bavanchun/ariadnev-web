---
phase: 4
title: "Guides & Operations Screens (D08–D11)"
status: completed
priority: P1
effort: "6h"
dependencies: ["phase-01-start.md"]
---

# Phase 4: Guides & Operations Screens (D08–D11)

## Overview
Elevate the Guides and Operational runbook screens (D08 to D11). Introduce a side-by-side migration comparison diff component for D11 (`vcskill` $\to$ `ariadnev`), format D10 CLI maintenance operations with high-contrast pill badges, upgrade D09 authority matrix with visual token chips, and adjust D08 upgrade topologies with conditional diamond decision nodes.

## Integrated AgentKit Skills
- `/ak:frontend-development`: Builds `MigrationDiffTable` in `components/screen-experiences/` (protecting the closed prose barrel export invariant in `prose-components.test.mjs`).
- `/ak:predict`: Evaluates UX hazards around destructive CLI commands (`rm -rf`, `uninstall`, `backups restore`) and places high-visibility danger callouts.
- `/ak:ui-ux-pro-max`: Designs side-by-side before/after comparison tables, authority matrices, and exit-code ledgers.

## Requirements & Red-Team Defensive Guardrails
- Functional:
  - **D08 (Upgrading)**: Set `check` node shape to `diamond` in topology; preserve authored `<blockquote>` for test assertions.
  - **D09 (Configuration)**: Distinguish user-only keys vs project-allowed keys with high-contrast chip badges; visually indicate dropped security keys in SVG.
  - **D10 (Uninstall & Doctor)**: Render `.operation-matrix-diagnostic` (Spectral), `.operation-matrix-mutating` (Copper), and `.operation-matrix-destructive` (Signal Fail) with distinct pill styling; style file-deletion commands with destructive accents while preserving `<blockquote>`.
  - **D11 (Migration from vcskill)**: Provide a structured **Side-by-Side Migration Diff Table** (`MigrationDiffTable` placed inside `apps/docs/src/components/screen-experiences/migration-from-vcskill.tsx`, NOT inside `components/prose/` to avoid breaking `prose-components.test.mjs`); preserve authored `<blockquote>` for `rm -rf ~/.vcskill`.

## Architecture & Code Changes
- Modify: `apps/docs/src/components/screen-experiences/upgrading.tsx`
- Modify: `apps/docs/src/components/screen-experiences/configuration.tsx`
- Modify: `apps/docs/src/components/screen-experiences/uninstall-and-doctor.tsx`
- Modify: `apps/docs/src/components/screen-experiences/migration-from-vcskill.tsx`
- Modify: `apps/docs/src/styles/docs.css`

## Implementation Steps
1. Update `upgrading.tsx` topology node shapes (`shape: "diamond"` on `check`).
2. Add `MigrationDiffTable` inside `migration-from-vcskill.tsx` with side-by-side old/new column comparisons.
3. Enhance `configuration.tsx` with structured config layer badges.
4. Style `.migration-diff-table`, `.config-matrix-card`, and destructive command blockquotes in `docs.css`.
5. Run `pnpm run test:docs` to verify structural identity invariants on D08–D11.

## Success Criteria
- [ ] D11 provides an instant, high-clarity side-by-side migration comparison table.
- [ ] Prose barrel export test (`prose-components.test.mjs`) passes with exactly 7 closed components.
- [ ] Destructive file operations (`rm -rf`) are immediately recognizable via high-contrast danger styling.
- [ ] Node count and text assertion invariants in `screen-experience-d08-d11.test.mjs` pass 100%.
