---
phase: 3
title: "Onboarding & Concepts Screens (D00–D07)"
status: completed
priority: P1
effort: "6h"
dependencies: ["phase-01-start.md"]
---

# Phase 3: Onboarding & Concepts Screens (D00–D07)

## Overview
Elevate the Home, Onboarding, and Concepts screens (D00 to D07). Transform D00 into an elevated Bilingual Hero Card, convert D01 release counts into clickable Interactive Metric Cards with a quickstart terminal launcher, harmonize warning callouts on D02, and refine SVG Topologies with human-readable screen reader labels across D03–D07.

## Integrated AgentKit Skills
- `/ak:ui-ux-pro-max`: Designs hero cards, interactive metric tiles, proof ladder tables, and exit-code status chips.
- `/ak:frontend-development`: Updates `docs-home.tsx`, `language-chooser.tsx`, `previous-home.tsx`, `topology.tsx`, and `evaluation.tsx`.
- `/ak:scenario`: Validates viewport scaling (320px mobile up to 1440px desktop) and screen reader accessibility on topological graphs.

## Requirements & Red-Team Defensive Guardrails
- Functional:
  - **D00 (Language Chooser)**: Bilingual hero card with descriptions for EN ("Guides, CLI & Reference") and VI ("Hướng dẫn, Lệnh CLI & Tham chiếu").
  - **D01 (Docs Home)**: Reorder `<dd>` metric number visually above `<dt>` label via CSS `flex-direction: column-reverse` (preserving valid HTML `<dl>` nesting to prevent hydration mismatches).
  - **D02 (Previous Home)**: Preserve the `<Callout variant="boundary">` required by `screen-experience-d02-d04.test.mjs`; style it harmoniously with the shell notice and add a styled stable return CTA.
  - **D03 (Installation)**: Render macOS Gatekeeper notice; preserve authored `<blockquote>` semantics for test assertions.
  - **D04 (First Install)**: Format doctor exit codes (`0`, `1`, `2`) with status chips (`Healthy`, `Degraded`, `Unhealthy`).
  - **D05 (Kit & Adapt Engine)**: Style authored boundary blockquotes with spectral accent borders.
  - **D06 (Graph Execution)**: Enhance 5-state execution table and graph clarity while preserving authored `<blockquote>` required by `screen-experience-d05-d07.test.mjs`.
  - **D07 (Evaluation)**: Format Proof-Boundary ledger table with copper warning accents on "Does not prove" constraints.
  - **Topology Engine (`topology.tsx`)**: Output human-readable node labels instead of raw machine IDs in the accessible adjacency table.

## Architecture & Code Changes
- Modify: `apps/docs/src/app/page.tsx` & `apps/docs/src/components/language-chooser.tsx`
- Modify: `apps/docs/src/components/screen-experiences/docs-home.tsx`
- Modify: `apps/docs/src/components/screen-experiences/previous-home.tsx`
- Modify: `apps/docs/src/components/prose/topology.tsx`
- Modify: `apps/docs/src/styles/docs.css`

## Implementation Steps
1. Refactor `language-chooser.tsx` with bilingual cards and description subtitles.
2. Update `docs-home.tsx` metric tiles to be clickable links with tabular numbers.
3. Style `previous-home.tsx` boundary callout and stable return CTA without stripping tested elements.
4. Update `topology.tsx` adjacency table to look up `node.label` by ID for accessible screen reader tables.
5. Add CSS styles for `.docs-home-counts`, `.metric-card`, `.historical-directory-section`, and `.stable-return-button`.
6. Run `pnpm run test:docs` to verify structural identity invariants on D00–D07.

## Success Criteria
- [ ] D00 presents an inviting bilingual gateway.
- [ ] D01 metrics are clickable and immediately navigate to relevant reference sections.
- [ ] D02 passes all assertions in `screen-experience-d02-d04.test.mjs`.
- [ ] SVG topology tables announce human labels to screen readers.
- [ ] All 164 docs contract tests pass.
