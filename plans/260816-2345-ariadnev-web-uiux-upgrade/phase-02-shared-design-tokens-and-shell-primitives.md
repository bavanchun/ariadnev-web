---
phase: 2
title: "Shared design tokens and foundations"
status: pending
priority: P1
effort: "3-4d"
dependencies: [1]
---

# Phase 2: Shared design tokens and foundations

## Context

- [Plan](./plan.md)
- [Execution cartography](../../docs/execution-cartography.md)
- Phase 1 decisions: Fumadocs, safe components, and performance baselines.

## Overview

Extend the shared DTCG token system so both apps use the same semantic states,
content surfaces, dimensions, typography roles, and motion grammar. This phase
changes tokens and contracts only; Phases 3–6 consume them.

## Requirements

- Preserve ink/graphite/cool/spectral/copper semantics and all existing contrast
  guarantees.
- Add tokens for interactive states, navigation/current state, code, data,
  callouts, destructive boundaries, selection, shell dimensions, and responsive
  reading constraints.
- Add an honest medium UI role backed by the existing variable Inter asset.
  Display Be Vietnam Pro remains its shipped 700 weight.
- Keep 4px spacing, 44px touch targets, motion below 400ms, and reduced-motion
  behavior.
- Generate site/docs CSS deterministically from `tokens.json`; no hand edits.
- Produce one implementation reference specimen at the four mandatory stress
  frames before screen work: state layers, type hierarchy, code/data/callout
  surfaces, shell density, EN/VI wrapping, focus, and reduced motion.

## Architecture

### State vocabulary

- hover, pressed, selected, current, disabled, loading, success, error;
- focus ring on ink and light content surfaces;
- navigation-current distinct from keyboard focus;
- copy-success distinct from execution witness where visual meaning differs.

Not every state needs a unique color. Tokens define layer, border, text, and
indicator roles so shape/text can carry meaning alongside color.

### Content surfaces

- code and command surfaces;
- table header, row, divider, and local-scroll affordance;
- Note, Gate, Boundary, Destructive, and Evidence callouts;
- topology node, edge, gate, checkpoint, and witness;
- overlay, drawer, selection, and empty/error states.

All aliases resolve through the accepted palette. No new accent family.

### Layout dimensions

- docs header, sidebar, TOC, reading measure, wide reference measure;
- sticky offsets and viewport-safe rail height;
- table minimum/maximum column constraints;
- marketing content shell and split/path/ledger composition gaps;
- compact, prose, and reference density modes.

### Typography

Add `medium: 500` for Inter UI text. Update the font manifest contract only if
tests need to state intermediate variable-axis support; do not add another font
file. Avoid a fake semibold alias for the non-variable display face.

## Related code files

- Modify: `packages/tokens/src/tokens.json`
- Modify if needed: `packages/tokens/src/font-manifest.json`
- Regenerate: `packages/tokens/dist/site.css`
- Regenerate: `packages/tokens/dist/docs.css`
- Modify: `tests/tokens/token-contract.test.mjs`
- Modify: `tests/tokens/font-contract.test.mjs`
- Modify: `tests/tokens/generated-css.test.mjs`
- Create: `docs/decisions/state-layers-content-surfaces-and-dimensions.md`
- Create: `docs/design/living-execution-atlas-foundation-specimen.md`

## Implementation steps

1. Inventory every ad hoc state/surface/dimension in site and docs CSS; map each
   to one semantic token or mark it app-local.
2. Add token aliases without removing or changing existing token meaning.
3. Add Inter medium role and verify Vietnamese glyph rendering at 500.
4. Add state contrast tests for text, focus, selected/current indicators, and
   boundaries. Do not require decorative fills to satisfy a criterion that does
   not apply; test the actual perceivable component boundary.
5. Add content-surface and shell-dimension contract assertions.
6. Regenerate both CSS outputs and run drift/font/contrast tests.
7. Record naming, semantic meaning, and anti-patterns in the decision doc.
8. Capture the implementation specimen at CLI 320px, provider 320px, desktop
   CLI lookup, and complete VI shell. Record accepted hierarchy and responsive
   rules rather than screenshots without rationale.

## Success criteria

- [ ] Every brainstorm state and content surface has a semantic token contract.
- [ ] Site and docs generated CSS expose the same shared vocabulary.
- [ ] Inter 500 renders and passes Vietnamese/font-size budgets.
- [ ] Display font is not falsely advertised as variable or medium.
- [ ] Existing tokens retain meaning and contrast tests do not weaken.
- [ ] Generated CSS is deterministic and hand-edit-free.
- [ ] Decision record states which layout values are shared vs app-local.
- [ ] Foundation specimen passes all four stress-frame reviews and gives later
      phases one explicit visual-quality reference.
- [ ] `pnpm run test:qualification` passes.

## Risk assessment

- **Token proliferation.** Merge aliases that have identical meaning; keep
  screen composition app-local.
- **State layer fails on one parent surface.** Define on-canvas/on-raised
  variants rather than lowering contrast.
- **Inter 500 is visually indistinct.** Use size, spacing, and color hierarchy;
  do not invent a new font asset without a separate budget decision.
- **Apps accidentally consume raw palette values.** Add grep/contract checks for
  new code in later phases; shared tokens remain semantic.

## Security considerations

No runtime input or external asset is introduced. Font hashes, licenses, and
Vietnamese coverage remain enforced.
