---
phase: 2
title: "Shared shells, interaction grammar, and archetype pilots"
status: pending
priority: P1
effort: "6-8 engineer-days"
dependencies: ["phase-01-surface-contexts-tokens-and-typography.md"]
---

# Phase 2: Shared shells, interaction grammar, and archetype pilots

## Context links

- [Plan](./plan.md)
- [Phase 1](./phase-01-surface-contexts-tokens-and-typography.md)
- [Visual verification harness](../../docs/operations/visual-verification-harness.md)

## Overview

Apply the contrast architecture to both app shells and complete three final,
representative compositions: M01 hero/system trace, D06 flagship concept, and
D12 CLI index. These gates prove the system before remaining screens multiply.

## Requirements

### Functional

- Give site/docs mastheads a measured logo preservation zone using unchanged
  assets and one approved brand backing value.
- Recompose docs header, navigation, search, switchers, drawer, TOC, pager, and
  copy feedback into one compact reference-workbench shell.
- Keep all existing no-JS links/disclosures and client enhancement cleanup.
- Finalize M01 first viewport and system-trace composition; Phase 3 builds the
  remaining marketing macros around it.
- Finalize D06 reading/instrument composition and D12 generated-reference
  density/filter composition; Phases 4-5 reuse those patterns.
- Define one state grammar across links, buttons, summary controls, search,
  filters, copy, current/selected, loading, success, error, and disabled states.

### Non-functional

- No behavior depends on hover, animation, pointer precision, or JavaScript.
- Compact docs mobile shows title/orientation/next action in first viewport;
  search placement must not recreate current header dead space.
- No global backdrop blur, gradient heading, ambient glow, broad shadow, or
  pill/card default survives.
- Migrate every inventoried application palette-step consumer to a semantic
  context/state role; zero direct palette consumption is the Phase 2 exit gate.
- The three pilots pass all existing semantic contracts before temporary proof
  approval; committed baseline updates wait for owning page-family phases.

## Architecture

```text
context tokens
   ├─ Astro base-layout + site masthead + M01 pilot
   └─ Next layout + docs shell
        ├─ navigation/search/switchers/drawer/TOC/pager/copy
        ├─ D06 reading + instrument pilot
        └─ D12 generated reference pilot
```

Framework components remain separate. Shared behavior is expressed through
tokens, state names, spacing, geometry, and acceptance tests—not a cross-app
component package.

## File inventory

| Action | File(s) | Purpose | Test impact |
|---|---|---|---|
| Modify | `apps/site/src/layouts/base-layout.astro`, `apps/site/src/components/site-header.astro` | Brand context, metadata, logo zone, compact shell | Site structure/static tests |
| Modify | `apps/site/src/components/hero-section.astro`, `apps/site/src/styles/site.css`, `apps/site/src/scripts/page-enhancer.ts` | Final M01 hero/system trace and finite enhancement | Site + M01 visuals |
| Modify | `apps/docs/src/app/layout.tsx` | Context-aware metadata/color-scheme behavior | Build/static output |
| Modify | `apps/docs/src/components/docs-shell.tsx` | Reference-workbench grid and landmarks | Shell accessibility |
| Modify | `apps/docs/src/components/search-dialog.tsx`, `locale-version-switcher.tsx`, `mobile-drawer-enhancer.tsx` | Compact utility model and no-JS parity | Docs shell/browser tests |
| Modify | `apps/docs/src/components/docs-pager.tsx`, `copy-actions.tsx`, `document-copy-enhancer.tsx`, `toc-active-observer.tsx` | Shared state grammar | Accessibility/journeys |
| Modify | `apps/docs/src/components/screen-experiences/graph-execution.tsx` | D06 pilot composition | D05-D07 structural probes |
| Modify | `apps/docs/src/components/reference/cli-command-index.tsx`, `reference-index-filter.tsx` | D12 pilot density/filter | Search/task outcomes |
| Modify | `apps/docs/src/styles/docs.css` | Shell + D06/D12 styles with context aliases only | Forbidden features, budget, visuals |
| Modify | `tests/site/structure.test.ts`, `tests/site/progressive-enhancement.test.ts` | Lock new shell/hero and logo-presentation invariants | Site suite |
| Modify | `tests/docs/shell-accessibility.test.mjs`, `tests/docs/forbidden-runtime-features.test.mjs` | Lock contexts and removed anti-patterns | Docs native suite |
| Create | Temporary pilot captures under this plan's `reports/visual-proofs/` | Review M01/D06/D12 without prematurely replacing release baselines | Human composition gate |

## Function and interface checklist

- [x] `DocsShell` preserves landmark order, current page/section, no-JS
  sidebar, breadcrumb, previous-edition notice, and TOC omission when empty.
- [x] `SearchDialog` keeps partition isolation, focus containment, Escape,
  loading/error/empty states, and localized announcements.
- [x] Switchers keep explicit links and do not remember/redirect preference.
- [x] Drawer enhancer cleans listeners, contains focus, returns focus, and
  leaves native `<details>` usable without JS.
- [x] TOC observer retains sticky-offset calculation and reduced-motion-safe
  current-location behavior.
- [x] Copy actions keep manual fallback and sighted/screen-reader confirmation.
- [x] M01 essential claim, proof, install, docs, and release facts exist in
  initial HTML.
- [x] D06 textual graph authority remains complete next to supplemental visual.
- [x] D12 remains a complete no-JS command index; filter only enhances it.

## Implementation steps

1. Add focused regression assertions for existing no-JS and semantic shell
   behavior before markup/style changes.
2. Implement brand preservation zones in both mastheads; inspect compact and
   desktop logo detail on the approved backing value.
3. Recompose docs grid and mobile header. Decide persistent vs compact search
   by first-viewport evidence, not preference.
4. Apply complete interaction states without raw color literals or broad visual
   effects. Preserve existing handlers unless behavior must change.
5. Build M01 hero/system trace from Phase 1 brief. Keep remaining macros
   temporarily compatible for Phase 3.
6. Build D06 reading/instrument pilot. Verify topology text, commands, TOC,
   print, forced colors, and route transfer.
7. Build D12 index/filter pilot. Verify no-JS command access, two-interaction
   lookup, mobile record reflow, search isolation, and route transfer.
8. Run narrow semantic/static/budget suites. Capture temporary pilot proofs in
   the plan report directory; do not rotate committed release baselines yet.
9. Run pilot composition review at 320/375/768/1280/1440. Reject any result
   that reads as recolor, old-layout reskin, or decorative dark-card insertion.

## Test scenario matrix

| Priority | Scenario | Evidence |
|---|---|---|
| Critical | Site/docs logo bytes or aspect ratio drift | Asset contract + screenshots fail |
| Critical | No-JS nav/search/index path loses content | Native shell/browser tests fail |
| Critical | M01 install/docs path moves beyond first-view action | Task outcome + visual review fail |
| Critical | D12 exact command exceeds two interactions | Task outcome fails |
| High | D06/D12 route or search budget regresses | Budget scripts fail |
| High | VI shell string/announcement parity regresses | VI parity test fails |
| High | 320/375 header obscures title or focus | Visual/a11y stress gate fails |
| High | Forced colors/reduced motion loses state meaning | Accessibility modes fail |
| Medium | Unchanged baseline family moves | Stop; diagnose context bleed |

## Dependency map

```text
Phase 1 contexts
  ├─ brand shells ──> M01 pilot ──> Phase 3
  └─ docs shell ────> D06 pilot ──> Phase 4
                   └> D12 pilot ──> Phase 5
```

## Todo

- [x] Protect current semantic/no-JS behavior with focused tests.
- [x] Implement both brand shells and complete state grammar.
- [x] Complete M01, D06, and D12 pilots.
- [x] Pass pilot accessibility, budget, and responsive reviews.
- [x] Record approved pilot proofs; defer committed baseline rotation to each
  owning page-family phase.

## Success criteria

- [x] Both shells visibly belong to one system without sharing framework code.
- [x] Logo assets remain byte-identical and legible in preservation zones.
- [x] M01, D06, and D12 are final-quality archetypes, not throwaway prototypes.
- [x] All native/static/no-JS/pilot task gates pass before temporary proofs are
  approved; committed screenshots remain unchanged until owning phases finish.
- [x] No old glass/gradient/glow/bento/pill-default pattern remains in pilots.
- [x] Application CSS contains zero direct palette-step consumers except a
  documented forced-colors/browser boundary that cannot use semantic aliases.
- [x] Remaining phases can expand page families by reusing proven context and
  composition patterns instead of inventing new visual systems.

## Risk assessment

- **Mixed old/new page:** signal: temporary compatibility creates visual seams.
  Response: isolate pilots behind explicit regions; Phase 3-5 immediately own
  multiplication, no long-lived toggle.
- **Shell rewrite breaks behavior:** signal: markup diff forces handler rewrites.
  Response: preserve component contracts and change structure minimally; add
  tests before touching enhancer code.
- **Pilot bias:** signal: M01/D06/D12 look strong but other archetypes lack a
  mapping. Response: require phase reuse matrix at review; revise tokens before
  acceptance if a context is missing.
- **Mobile search trade-off:** signal: persistent search crowds the title.
  Response: use compact trigger while retaining no-JS search/navigation path.

## Security considerations

Preserve CSP, local assets, dialog isolation, safe text rendering, and search
partition boundaries. Do not add remote scripts, analytics, runtime theme
storage, or unsafe HTML to achieve the visual direction.
