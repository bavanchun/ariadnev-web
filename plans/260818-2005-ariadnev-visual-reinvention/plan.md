---
title: "Ariadnev visual reinvention — Prismatic Technical Dossier"
description: "Replace the shipped execution-cartography presentation across marketing and docs with one mixed-surface editorial/technical system while preserving brand assets and every public behavior contract."
status: in-progress
priority: P1
effort: "30-42 engineer-days; 6-8 weeks single stream"
issue: null
branch: main
tags: [frontend, design-system, ui-ux, accessibility, static-web]
blockedBy: []
blocks: []
created: 2026-08-18
---

# Ariadnev visual reinvention — Prismatic Technical Dossier

## Overview

Reinvent every public Ariadnev screen: Astro marketing M01-M02 and static
Next/Fumadocs documentation D00-D18. Keep the custom logo, favicon, app icons,
product truth, URLs, generated-source authority, EN/VI, no-JS paths,
accessibility, performance, and deployment topology intact.

This plan is the sole prospective authority for visual direction. The completed
[Living Execution Atlas](../260816-2345-ariadnev-web-uiux-upgrade/plan.md) and
[Docs Pro Max](../260818-1626-ariadnev-docs-pro-max-uiux-overhaul/plan.md) plans
remain historical delivery evidence; their visual rules do not constrain this
reinvention.

## Delivery contract

### Outcome

- Marketing explains the product, operational value, and proof in a shorter,
  more memorable narrative with a distinctive system trace and direct install
  path.
- Docs becomes a high-legibility reference workbench for learning, operating,
  exact lookup, and recovery across every locale/version/page family.
- Marketing and docs read as one brand even with the logo hidden, while each
  surface retains the density appropriate to its job.

### Constraints

- Preserve exact bytes, paths, aspect ratios, and identity of all logo/favicon
  assets. No recolor, redraw, crop, filter, glow compensation, regeneration, or
  cross-app asset deduplication.
- Preserve Astro, static Next/Fumadocs, public URLs, route cardinality, generated
  release authority, Markdown discovery, search partitioning, EN/VI, real 404s,
  critical no-JS paths, and current deployment units.
- Keep existing semantic distinctions: current, selected, focus, success,
  verified evidence, human approval/blocked, error, destructive, loading, and
  copy success. Color never carries meaning alone.
- No test weakening or silent budget changes. Live JSON/tests outrank stale
  narrative documents when they disagree.
- Use existing self-hosted fonts unless an explicit font-asset decision is
  approved separately.

### Non-goals

- No backend, release pipeline, installer, route, content schema, CMS, product
  capability, personalization, telemetry, or deployment-topology work.
- No theme toggle. Mixed luminance is one authored contrast architecture, not
  light/dark preferences.
- No new product claims, testimonials, metrics, fake dashboards, WebGL/3D,
  ambient animation, stock illustration, or AI-future imagery.
- No hand edits to generated token CSS or generated docs content.

## Chosen visual system

**Prismatic Technical Dossier**: a dark brand field holds the unchanged logo;
warm-neutral reading surfaces provide editorial clarity; dark instrument
surfaces are reserved for commands, graphs, proof, and operational records.

Four explicit surface contexts replace the current single dark-canvas model:

| Context | Purpose | Required semantic roles |
|---|---|---|
| `brand` | Mastheads and identity field | canvas, raised, border, primary/muted text, link, focus |
| `reading` | Prose, guides, tables, marketing narrative | canvas, raised, border, primary/muted text, link, focus, selection, disabled |
| `instrument` | Commands, graphs, proof, terminal records | canvas, raised, border, primary/muted text, active, verified, gate, destructive |
| `overlay` | Search, drawer, popover | canvas, scrim, border, text, focus, selected, disabled |

Blue means interactive/current/active execution. Green means verified/success.
Red means error/destructive. Restrained amber/copper remains only for approval,
blocked, or attention states; it is retired as a dominant brand expression.

Retire gradient text, frosted glass, broad blur, ambient glow, generic bento
grids, pill-by-default styling, repeated card walls, and topology as the global
page-ground metaphor.

## Supersession disposition

| Preserve | Reinterpret | Replace | Retire |
|---|---|---|---|
| URLs, generated truth, static/no-JS architecture, EN/VI, semantic states, test harness, logo/favicon bytes | Tokens, typography use, shell dimensions, diagrams, filters, tables, callouts, motion | Marketing compositions, docs shell presentation, all page-family visual composition | Dark-only thesis, glass/blur/glow, gradient headings, bento/pill defaults, stale plan counts |

Detailed evidence: [shipped-surface audit](./research/research-260818-2008-shipped-surface-supersession-delta-audit.md),
[visual-system research](./research/research-260818-2011-direction-c-visual-reinvention-system.md),
and [migration/verification research](./research/research-260818-2014-migration-verification-rollout-strategy.md).

## Phases

| # | Phase | Depends on | Status |
|---|---|---|---|
| 1 | [Surface contexts, tokens, typography, and archetype gates](./phase-01-surface-contexts-tokens-and-typography.md) | — | Pending |
| 2 | [Shared shells and interaction grammar](./phase-02-shared-shells-and-interaction-grammar.md) | 1 | Pending |
| 3 | [Marketing surfaces M01-M02](./phase-03-marketing-surfaces-m01-m02.md) | 1, 2 | Pending |
| 4 | [Authored docs D00-D11 and D18](./phase-04-authored-docs-d00-d11-d18.md) | 1, 2 | Pending |
| 5 | [Generated references D12-D17](./phase-05-generated-references-d12-d17.md) | 1, 2, 4 | Pending |
| 6 | [Whole-site verification and rollout](./phase-06-whole-site-verification-and-rollout.md) | 3, 4, 5 | Pending |

```text
P1 context contract + M01/D06/D12 proofs
                 |
                 v
P2 site/docs shells + interaction grammar
            /              \
           v                v
P3 M01/M02             P4 D00-D11/D18
                            |
                            v
                       P5 D12-D17
            \              /
             v            v
               P6 qualification + rollout
```

## Pilot gates

- **M01:** proves expressive marketing composition, logo preservation zone,
  dark-to-light transition grammar, mobile first viewport, and install path.
- **D06:** proves the reading/instrument contrast architecture with prose,
  topology, commands, TOC, shell, Vietnamese-capable typography, and the tight
  docs transfer budget.
- **D12:** proves generated-reference density, filter behavior, exact command
  lookup, mobile records, and no-JS index usability before D13-D17 multiply.

No page-family rollout starts until its pilot passes 320/375/768/1280/1440
composition review, semantic tests, accessibility stress modes, and applicable
budget gates.

## Whole-plan acceptance

- [ ] Logo/favicon checksums and paths match the recorded immutable manifest;
  logo detail remains legible at compact and desktop sizes without CSS effects.
- [ ] M01-M02 and D00-D18 have an intentional composition and all required
  states; no unchanged screen survives by accident.
- [ ] With logos hidden, marketing and docs still share typography, grid,
  state shapes, accent semantics, and context transition grammar.
- [ ] The first mobile viewport answers where the user is, what the page does,
  and the next action; no decorative dead space precedes the title.
- [ ] Exact command lookup remains at most two purposeful interactions; install
  copy remains at most one; locale/version/recovery paths remain no-JS usable.
- [ ] No clipping or hidden page overflow at 320/375/390/768/1280/1440;
  tables/code/graphs scroll or recompose locally and remain keyboard reachable.
- [ ] EN/VI chrome parity, focus visibility, forced colors, text spacing,
  400% reflow, print, reduced motion, and cross-browser journeys remain green.
- [ ] Frozen site/docs/search budgets remain green; no new grandfathered route
  or cap increase is introduced without a separate user decision.
- [ ] Baselines rotate surgically only after semantic/static gates pass; no
  unrelated fixture churn is accepted.
- [ ] `pnpm run test:qualification` passes from a clean build; its visual step
  is run #1, an unchanged immediate `pnpm run test:visual` is run #2, then the
  on-demand Lighthouse gate passes.

## Highest risks and stop conditions

- If the contrast architecture requires global light/dark inheritance instead
  of explicit contexts, stop and repair the token model before page work.
- If either logo loses detail on the brand backing value, adjust the neutral
  backing or preservation zone; never alter the asset.
- If a pilot reads as a recolor or stripped-down old design rather than a new
  composition, reject it before multiplication.
- If D06 or D12 exceeds the live transfer/search cap, remove decorative bytes
  or reduce client behavior; do not widen the cap silently.
- If an isolated site phase changes docs baselines, or vice versa, diagnose
  shared-token bleed before accepting snapshots.
- If public behavior, generated authority, route count, no-JS, or deployment
  topology must change, stop and request a scope decision.

## Cross-plan dependencies

None. Both overlapping plans are completed. This plan visually supersedes them
without reopening their behavioral or architectural contracts.

## Open questions

One execution-governance question remains: who gives the visual approval for
the M01/D06/D12 pilot proofs before their page-family rollouts begin. Phase 1
resolves exact backing values, minimum logo size, clear space, and mobile search
placement through measured archetype proofs.

## Red Team Review

### Session — 2026-08-18

**Findings:** 7 (7 accepted, 0 rejected)  
**Severity:** 0 Critical, 6 High, 1 Medium

| # | Finding | Severity | Disposition | Applied to |
|---|---|---|---|---|
| 1 | New context test was absent from explicit `test:native` command (`package.json:13`) | High | Accept | Phase 1 |
| 2 | Token runtime export work had no required consumer (`packages/tokens/src/index.ts:1`) | Medium | Accept | Phase 1 |
| 3 | Replacing the historical execution-cartography file would break/blur existing authority links (`apps/site/src/styles/site.css:10`) | High | Accept | Phase 1 |
| 4 | Byte checks alone would miss CSS logo filtering already present (`apps/docs/src/styles/docs.css:102`) | High | Accept | Phases 1-2 |
| 5 | Pilot baseline rotation would be repeated when shared CSS changes in owner phases; runbook rejects unexplained churn (`docs/operations/visual-verification-harness.md:62`) | High | Accept | Phase 2 |
| 6 | New fixture IDs were not added to the required-ID contract (`tests/docs/screen-fixture-manifest.test.mjs:20`) | High | Accept | Phases 4-5 |
| 7 | Phase 6 would run visuals three times because qualification already includes them (`package.json:14`) | High | Accept | Phase 6 |

### Whole-Plan Consistency Sweep

- Files reread: `plan.md` and all six phase files.
- Decision deltas checked: 7.
- Reconciled stale references: token export, design-authority ownership, logo
  presentation, pilot baseline timing, fixture contracts, visual-run count.
- Unresolved contradictions: 0.

### Advisory follow-up — 2026-08-18

- Phase 1 now inventories existing raw palette consumers; Phase 2 owns the
  achievable zero-consumer gate.
- Exactly two visual runs are defined: qualification run #1, unchanged repeat
  run #2.
- 390px now requires an automated overflow/focus probe, not a full screenshot
  matrix.
- Phase 6 produces qualification evidence and a ship recipe only; commits and
  deployment inputs require later authorization.
- Remaining validation fork: approval owner for M01/D06/D12 pilot proofs.

## Validation Log

### Structural verification — 2026-08-18

- Validation tier: Full (six phases, cross-app visual/public-contract scope).
- `ak plan validate --json --no-interactive`: valid, zero schema errors.
- Claims checked: 92. Verified against repository evidence: 89. Planned-create
  artifacts confirmed as intentional: 3. Failed: 0. Unverified: 0.
- Existing-path/pattern checks: 72 verified. The three absent paths are owned
  Phase 1 outputs: the brand-asset checksum manifest, surface-context contract
  test, and Prismatic design-authority document.
- Contract checks confirmed: explicit native/qualification/visual scripts;
  fixture IDs and 320/768/1440 required widths plus 375/1280 breakpoint widths;
  docs screen-registry ownership; current dark-only browser metadata; current
  logo filter, blur, gradient, and pill patterns targeted by the supersession.
- Dependency sweep: Phase 1 -> Phase 2 -> Phases 3/4 -> Phase 5 -> Phase 6 is
  internally consistent; no unfinished predecessor plan blocks execution.
- Process reconciliation: no dev server, watcher, researcher, or reviewer
  process from planning remains active.
- Pending human validation: designate the M01/D06/D12 pilot approval owner.

<!-- slug: ariadnev-visual-reinvention -->
