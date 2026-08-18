---
phase: 5
title: "Reference, 103 Skill Catalog & Timeline (D12–D17)"
status: completed
priority: P1
effort: "8h"
dependencies: ["phase-01-start.md"]
---

# Phase 5: Reference, 103 Skill Catalog & Timeline (D12–D17)

## Overview
Elevate the Reference sections, 103-skill catalog, provider matrix, workflow map, and release notes changelog (D12 to D17). Upgrade `ReferenceIndexFilter` with a `/` hotkey, clear `✕` button, and live match counter. Transform D12 and D15 into modern Bento Grid cards, add a sticky first column to D14 provider matrix, and build a vertical timeline spine with semantic changelog badges on D17.

## Integrated AgentKit Skills
- `/ak:react-best-practices`: Applies `content-visibility: auto` and `contain-intrinsic-size` on 103-item skill catalogs to keep filter responsiveness at 60fps.
- `/ak:ui-ux-pro-max`: Designs Bento card grids, semantic changelog tags (Breaking, Security, Migration), and SVG canvas containers.
- `/ak:web-testing`: Validates keyboard navigation across search inputs and tag clouds without layout thrashing.

## Requirements
- Functional:
  - **Universal Filter (`reference-index-filter.tsx`)**: Support `/` global autofocus, `Escape` to clear, search icon prefix, clear button `✕`, and live match count badge (`Showing 4 of 24`).
  - **D12 (CLI Command Index)**: Display commands as responsive Bento Grid cards with syntax copy shortcuts and sticky namespace pills (`mcp`, `kit`, `eval`, `auth`).
  - **D13 (CLI Command Detail)**: Present terminal spec hero box with flag tags (`--json`, `-v`, `--dry-run`).
  - **D14 (Provider Reference)**: Add `position: sticky; left: 0;` on first matrix column for horizontal scrolling; render semantic status pills (`Supported` / `Skipped`).
  - **D15 (Skill Catalog)**: Transform category index into Bento Category Grid with skill count badges; apply `content-visibility: auto` to optimize rendering.
  - **D16 (Workflow Map)**: Wrap SVG in an elevated Canvas card with subtle dot-matrix background; apply semantic node/gate token colors.
  - **D17 (Release Timeline)**: Render semantic highlight badges (Breaking: Signal Fail, Security: Copper 400, Migration: Spectral 400) connected by a vertical timeline spine.

## Architecture & Code Changes
- Modify: `apps/docs/src/components/reference/reference-index-filter.tsx`
- Modify: `apps/docs/src/components/reference/cli-command-index.tsx`
- Modify: `apps/docs/src/components/reference/skill-catalog.tsx`
- Modify: `apps/docs/src/components/reference/release-timeline.tsx`
- Modify: `apps/docs/src/styles/docs.css`

## Implementation Steps
1. Refactor `reference-index-filter.tsx` with hotkey listener, clear action, and match stats.
2. Add Bento grid CSS layout for CLI commands and skill categories in `docs.css`.
3. Add sticky matrix column CSS for D14 provider tables.
4. Add vertical timeline spine and semantic highlight badge classes for D17 release notes.
5. Apply `content-visibility: auto` optimizations on skill card lists.
6. Run `pnpm run test:docs` to verify structural identity invariants on D12–D17.

## Success Criteria
- [ ] Filter bar responds instantly to `/` keypress and displays accurate match counts.
- [ ] 103 Skill Catalog scrolls and filters smoothly at 60fps.
- [ ] D14 matrix maintains readable row headers during horizontal scrolling.
- [ ] D17 changelog highlights are instantly categorized by semantic risk color.
- [ ] All 164 docs contract tests pass.
