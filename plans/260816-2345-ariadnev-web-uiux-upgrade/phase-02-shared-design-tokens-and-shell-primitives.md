---
phase: 2
title: "Shared design tokens and shell primitives"
status: pending
priority: P1
effort: "3-4d"
dependencies: [1]
---

# Phase 2: Shared design tokens and shell primitives

## Overview

Extend `packages/tokens` so site and docs stop reinventing surface, state, and
dimension in app CSS. This phase adds tokens only — the site and docs still
render as they did after Phase 1; Phase 3 and Phase 5 consume the new tokens.
Doing it in one place keeps the drift the audit measured from returning.

## Requirements

- Functional: tokens define interactive state layers (hover/active/pressed/
  selected/current/disabled/loading/focus), typographic weight roles beyond
  regular/bold, code and data surfaces, callout roles, and docs shell
  dimensions (sidebar width, TOC width, header height, table max column,
  content prose width). Both apps consume tokens by name.
- Non-functional: `packages/tokens/src/tokens.json` remains the single source;
  `packages/tokens/dist/*.css` regenerates deterministically and stays
  hand-edit-free (existing test enforces this). Contrast budget in the
  existing token test does not weaken.

## Architecture

Three additions, each behind a stable token key:

- **State layers.** `state.hover.layer`, `state.active.layer`,
  `state.pressed.layer`, `state.selected.layer`, `state.current.layer`,
  `state.disabled.layer`, `state.loading.layer`, `state.focus.ring`. Values
  are OKLCH mixes on top of `surface.canvas` and `surface.raised`, tested for
  ≥3:1 contrast against the surface they land on (interaction), ≥4.5:1 for
  text.
- **Typographic weights.** Add a `medium` role (weight 500 when the font
  supports it; a variable-axis fallback for the self-hosted stack). Do not
  alias "semibold" to 700 anymore. Existing content that used the old
  semibold token continues to render at 700 by explicit opt-in during Phase 3.
- **Surfaces and dimensions.** `surface.code`, `surface.data`,
  `surface.callout.info`, `surface.callout.warn`, `surface.callout.gate`,
  `dim.shell.sidebarWidth`, `dim.shell.tocWidth`, `dim.shell.headerHeight`,
  `dim.content.proseWidth`, `dim.content.tableMaxColumn`. The audit's `P2` at
  `tokens.json:133` names exactly this set; no more, no less.

A short design decision doc under `docs/decisions/` captures the state-layer
palette and the "semibold no longer collapses to 700" rule so future work sees
the intent.

## Related Code Files

- Modify: `packages/tokens/src/tokens.json`
- Regenerated: `packages/tokens/dist/*.css` (via existing build; do not
  hand-edit)
- Create: `docs/decisions/state-layers-and-shell-dimensions.md`
- Modify: `tests/tokens/token-contract.test.mjs` — extend to assert the new
  keys exist and pass contrast; do not weaken existing budgets
- Modify: `tests/tokens/generated-css.test.mjs` — drift guard covers the new
  tokens automatically once regenerated

## Implementation Steps

1. Draft the state-layer values in a scratch file; verify contrast against
   `surface.canvas` and `surface.raised` using the existing contrast helper.
2. Add tokens to `tokens.json` under new namespaces so no existing key changes
   meaning. Regenerate `dist/*.css`; verify the generated CSS drift test
   passes.
3. Add the medium weight role and update the font stack fallback (self-hosted;
   no network font). Do not touch the shipped `dist` files by hand.
4. Add dimensions and code/data/callout surfaces.
5. Write the decision doc capturing rationale, contrast pairs, and the
   "semibold aliases removed" callout.
6. Extend the token contract test to assert every new key exists with the
   declared `$type` and passes the contrast expectations.
7. Do not consume the new tokens in app CSS yet — Phase 3 and Phase 5 do that.
   Keep this phase's diff isolated to tokens + tests + decision doc.

## Success Criteria

- [ ] `tokens.json` gains state layers, medium weight role, code/data/callout
      surfaces, and shell dimensions with no removed or renamed existing keys.
- [ ] Generated `dist/*.css` regenerates deterministically; drift test passes.
- [ ] Token contract test asserts new keys and their contrast pairs.
- [ ] Decision doc committed under `docs/decisions/`.
- [ ] `pnpm run test:qualification` green.

## Risk Assessment

- **A new state layer collides with existing ad hoc CSS.** Signal: docs or
  site loses hover feedback after Phase 3 consumes the tokens. Response:
  Phase 3 replaces the ad hoc styles explicitly rather than layering; do not
  patch it back into app CSS.
- **Medium weight looks like regular on the self-hosted stack.** Signal:
  visual QA in Phase 3 cannot distinguish 500 from 400. Response: raise the
  role to 550 on the variable axis; if the font shipped does not support
  variable weight, publish an explicit fallback that uses tracking + size
  contrast rather than faking a weight.
- **Contrast budget forces a color decision.** Signal: no state-layer palette
  satisfies both the ink ground and the raised surface at ≥3:1. Response:
  publish two palettes keyed by surface parent (`state.on-canvas.hover.layer`
  vs `state.on-raised.hover.layer`) rather than compromising contrast.
