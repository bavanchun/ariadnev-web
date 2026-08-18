---
title: "ariadnev Docs Pro Max UI/UX Overhaul"
description: "Comprehensive, token-pure UI/UX Pro Max elevation of the ariadnev documentation platform across all 18 screens (D00–D17), global shell, search spotlight, and prose components."
status: completed
priority: P1
effort: "3d"
tags: ["ui-ux", "docs", "design-system", "prose", "pro-max", "web-interface-guidelines"]
created: 2026-08-18
---

# ariadnev Docs Pro Max UI/UX Overhaul

## Overview
Elevate the entire **ariadnev** documentation web application (`apps/docs`) to a world-class, modern developer platform standard (on par with Stripe, Linear, Vercel, and Tailwind Docs). The overhaul delivers rich Bento grid cards, semantic tokenized callouts, operation badges, stepper pipelines, side-by-side migration diffs, spotlight search keybindings, active TOC scrollspy styling, and enhanced SVG execution topologies.

All changes strictly uphold:
1. **Zero-JS SSR Progressive Enhancement** (100% initial HTML completeness).
2. **Token Purity** (0% raw hex colors, strict consumption of `@ariadnev-web/tokens` via `var(--vcs-*)` / `var(--vc-*)` and `color-mix`).
3. **Static Budget Ratchet Invariants** (fits within compressed byte caps in `tests/benchmarks/docs-per-route-ratchet.json`).
4. **Full Web Interface Guidelines Compliance** (WCAG 2.2 Level AA, 44px+ touch targets, `prefers-reduced-motion`, `tabular-nums`, zero layout shifts).

## Architecture & Skill Integration Map

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                              AGENTKIT (AK) SKILL INTEGRATION MATRIX                             │
├─────────┬──────────────────────────────────┬────────────────────────────────────────────────────┤
│ Phase   │ Primary AgentKit Skills          │ Core Deliverables                                  │
├─────────┼──────────────────────────────────┼────────────────────────────────────────────────────┤
│ Phase 1 │ /ak:ui-styling                   │ Core CSS definitions for Callouts (gate, boundary, │
│         │ /ak:ui-ux-pro-max                │ destructive, evidence, note), Operation Badges,    │
│         │ /ak:web-design-guidelines        │ Stepper Pipelines, Code Blocks & TOC Scrollspy.    │
├─────────┼──────────────────────────────────┼────────────────────────────────────────────────────┤
│ Phase 2 │ /ak:frontend-development         │ Search Dialog Spotlight polish with footer hints   │
│         │ /ak:react-best-practices         │ (↑↓ ↵ ESC), active Sidebar pill, Dropdown chevron. │
├─────────┼──────────────────────────────────┼────────────────────────────────────────────────────┤
│ Phase 3 │ /ak:ui-ux-pro-max                │ D00 Bilingual Hero Card, D01 Interactive Metric    │
│         │ /ak:frontend-development         │ Cards + Quickstart Box, D02 Deduplicated Notice,   │
│         │ /ak:scenario                     │ D03-D07 Accessible SVGs & Proof Ledger styling.    │
├─────────┼──────────────────────────────────┼────────────────────────────────────────────────────┤
│ Phase 4 │ /ak:frontend-development         │ D08 Upgrade Diamond gate, D09 Config Matrix cards, │
│         │ /ak:predict                      │ D10 Maintenance Badges, D11 Migration Diff Table.  │
├─────────┼──────────────────────────────────┼────────────────────────────────────────────────────┤
│ Phase 5 │ /ak:react-best-practices         │ Universal Filter with `/` shortcut & match counter,│
│         │ /ak:ui-ux-pro-max                │ D12 Bento Grid, D15 103 Skill Cards, D17 Timeline. │
├─────────┼──────────────────────────────────┼────────────────────────────────────────────────────┤
│ Phase 6 │ /ak:test                         │ 176 Vitest tests, 164 Docs Contract tests,         │
│         │ /ak:code-review                  │ Static Budget ratchet check, a11y audit & journal. │
└─────────┴──────────────────────────────────┴────────────────────────────────────────────────────┘
```

## Goals

| # | Goal | Priority |
|---|------|----------|
| 1 | Establish complete tokenized CSS foundations for all prose components in `docs.css` | P1 |
| 2 | Elevate global shell, active navigation pills, TOC scrollspy, and spotlight search | P1 |
| 3 | Upgrade Onboarding & Concepts screens (D00–D07) with hero cards & interactive metrics | P1 |
| 4 | Upgrade Guides & Operations screens (D08–D11) with migration diffs & hazard callouts | P1 |
| 5 | Upgrade Catalogs & Timeline (D12–D17) with Bento cards, filter shortcuts & timeline spine | P1 |
| 6 | Verify zero-JS fallback, static byte budget ratchets, TypeScript clean, and 100% test pass | P1 |

## Phases

| # | Phase | Status | Priority |
|---|-------|--------|----------|
| 1 | [Phase 1: Core Design System & Prose Foundations](./phase-01-start.md) | Completed | P1 |
| 2 | [Phase 2: Global Shell & Spotlight Search Experience](./phase-02-shell-search-navigation.md) | Completed | P1 |
| 3 | [Phase 3: Onboarding & Concepts Screens (D00–D07)](./phase-03-onboarding-concepts-d00-d07.md) | Completed | P1 |
| 4 | [Phase 4: Guides & Operations Screens (D08–D11)](./phase-04-guides-operations-d08-d11.md) | Completed | P1 |
| 5 | [Phase 5: Reference, 103 Skill Catalog & Timeline (D12–D17)](./phase-05-reference-catalogs-d12-d17.md) | Completed | P1 |
| 6 | [Phase 6: Verification, Static Budget & Quality Audit](./phase-06-verification-quality-audit.md) | Completed | P1 |

## Success Criteria

- [x] All 18 screens (D00–D17) render with high-craft, modern UI/UX Pro Max styling.
- [x] 0% raw hex colors in `docs.css` (enforced by `forbidden-runtime-features.test.mjs`).
- [x] All 176 Vitest tests and 164 native docs contract tests pass without failure or warnings.
- [x] Zero hydration mismatch or console errors in browser devtools.
- [x] Static budget verified across all 447 generated routes via `verify-static-budget.mjs`.

<!-- slug: ariadnev-docs-pro-max-uiux-overhaul -->