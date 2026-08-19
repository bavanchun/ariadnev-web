---
phase: 1
title: "Surface contexts, tokens, typography, and archetype gates"
status: pending
priority: P1
effort: "5-7 engineer-days"
dependencies: []
---

# Phase 1: Surface contexts, tokens, typography, and archetype gates

## Context links

- [Plan](./plan.md)
- [Shipped-surface audit](./research/research-260818-2008-shipped-surface-supersession-delta-audit.md)
- [Visual-system research](./research/research-260818-2011-direction-c-visual-reinvention-system.md)
- [Current design contract](../../docs/execution-cartography.md)
- [Current token authority](../../packages/tokens/src/tokens.json)

## Overview

Replace the single dark-canvas token assumption with the four-context
Prismatic Technical Dossier contract. Freeze immutable brand assets and define
objective M01/D06/D12 pilot gates before any page-family multiplication.

## Requirements

### Functional

- Define `brand`, `reading`, `instrument`, and `overlay` semantic contexts.
- Give every context paired canvas, raised, border, text, link, focus,
  selection, disabled, and relevant status roles. Inventory every current
  application palette-step consumer and prohibit new ones; Phase 2 owns their
  removal because it owns application CSS.
- Preserve blue=current/active, green=verified/success, red=error/destructive,
  amber/copper=approval/blocked/attention. Preserve redundant labels/shapes.
- Keep existing spacing scale and self-hosted font files; redefine how Be
  Vietnam Pro, Inter, and JetBrains Mono express hierarchy.
- Record exact checksums, path, intrinsic dimensions, minimum rendered size,
  clear space, aspect-ratio, and backing-value rules for both distinct logo
  binaries plus favicon/apple-touch assets.
- Define composition and acceptance briefs for M01, D06, and D12, including
  first-viewport facts and required responsive transformations.
- Create `docs/prismatic-technical-dossier.md` as the new evergreen visual
  authority. Keep `docs/execution-cartography.md` as historical context with a
  concise superseded notice/link; retain behavioral topology vocabulary where
  it remains product truth.

### Non-functional

- Every foreground/background pair used in shipped contexts meets the existing
  contrast policy; focus-visible remains obvious in all four contexts.
- No remote assets, new font bytes, gradient text, glow, broad blur, global
  inheritance trick, or application-level raw color literal.
- Generated CSS remains deterministic and application bundles stay inside live
  frozen budgets.

## Architecture

```text
tokens.json (DTCG source)
  ├─ primitive palette + type/spacing/motion
  ├─ context.brand.*
  ├─ context.reading.*
  ├─ context.instrument.*
  └─ context.overlay.*
          |
          v
generated site.css + docs.css
          |
          v
[data-surface-context] / semantic component classes
```

Context boundaries are explicit on owning regions. Components inherit only
within a declared context; code and topology surfaces never depend on a global
light/dark flip. Existing state names remain stable so application behavior
does not need visual-condition branches.

## File inventory

| Action | File | Purpose | Test impact |
|---|---|---|---|
| Modify | `packages/tokens/src/tokens.json` | Add context aliases; retune palette/type/elevation/motion semantics | Token snapshots, contrast, generated CSS |
| Create | `docs/prismatic-technical-dossier.md` | New evergreen contrast-architecture authority | Link/claim review |
| Modify | `docs/execution-cartography.md` | Mark visual thesis superseded and link new authority; preserve historical links | Link/claim review |
| Create | `tests/benchmarks/brand-asset-checksums.json` | Machine-owned immutable asset manifest | Brand asset contract |
| Create | `tests/tokens/surface-context-contract.test.mjs` | Assert role completeness and context contrast pairs | Native token suite |
| Modify | `package.json` | Wire the new surface-context test into explicit `test:native` ordering | Qualification suite |
| Modify | `tests/tokens/token-contract.test.mjs` | Retire dark-only assumptions; preserve spacing/motion/state invariants | Native token suite |
| Modify | `tests/tokens/generated-css.test.mjs` | Assert every context emits deterministically to both apps | Native token suite |
| Modify | `tests/tokens/font-contract.test.mjs` | Lock current font digests and Vietnamese coverage | Native token suite |
| Modify | `tests/benchmarks/screen-fixtures.json` | Add pilot metadata only if existing schema needs explicit gate tags | Fixture manifest tests |

Logo, favicon, apple-touch-icon, generated CSS, and generated docs output are
read-only inputs in this phase except generated CSS produced by the token build.

## Function and interface checklist

- [ ] DTCG resolver supports aliases across all four contexts without cycles.
- [ ] Generated custom-property names are identical in `site.css` and
  `docs.css` for shared roles.
- [ ] Existing state aliases keep their behavioral names and distinctions.
- [ ] Asset checksum test covers both app-specific logo binaries separately.
- [ ] Static presentation tests reject logo filters, clipping/cropping, invalid
  object-fit/aspect-ratio behavior, or generated/replaced asset URLs.
- [ ] Font contract confirms no font file, weight range, or Vietnamese coverage
  drift.
- [ ] M01/D06/D12 pilot briefs specify exact content facts, contexts, states,
  viewport transforms, and rejection conditions.

## Implementation steps

1. Capture live enforceable budget values, current generated token output, and
   immutable asset metadata. Treat JSON/tests as authority over stale ADR prose.
2. Write failing tests for asset checksums, context role completeness, contrast,
   focus, selection, disabled states, and generated CSS parity.
3. Define the four context matrices and remap existing semantic states without
   deleting approval/blocked distinctions.
4. Retune typography roles and spatial/elevation/motion rules. Keep font files
   and the 4px spacing contract unchanged.
5. Build tokens; inspect generated diffs. Application CSS must not be edited to
   hide missing aliases.
6. Write the new evergreen design contract with logo preservation zone,
   dark-to-light transition grammar, context examples, and anti-patterns; mark
   the old execution-cartography visual thesis superseded without deleting it.
7. Write M01/D06/D12 composition briefs against real content and mandatory
   stress frames. Obtain visual review before Phase 2.
8. Run token/package tests and compare compressed generated CSS delta to the
   live route headroom.

## Test scenario matrix

| Priority | Scenario | Evidence |
|---|---|---|
| Critical | Any immutable brand asset byte/path changes | Checksum manifest test fails |
| Critical | CSS filters/crops/replaces a logo without changing bytes | Static logo-presentation contract fails |
| Critical | Context role missing or alias cycle introduced | Surface-context contract fails |
| Critical | Text/link/focus contrast regresses in any context | Contrast assertions fail |
| High | Generated site/docs context variables diverge | Generated CSS parity test fails |
| High | Font digest or Vietnamese coverage changes | Font contract fails |
| High | CSS delta consumes D06/D12 route headroom | Static budget measurement blocks gate |
| Medium | Motion/radius/spacing leaves accepted scale | Existing token invariants fail |

## Dependency map

```text
asset manifest ─┐
context tests ──┼─> tokens + design contract ─> Phase 2 shells/pilots
pilot briefs ───┘
```

## Todo

- [ ] Freeze asset and live-budget evidence.
- [ ] Add context-first tests.
- [ ] Implement and generate context tokens.
- [ ] Update visual authority document.
- [ ] Approve M01/D06/D12 pilot briefs.
- [ ] Pass phase test and budget gates.

## Success criteria

- [ ] Four explicit contexts cover every existing semantic state; every current
  raw application palette consumer has a file/selector migration entry and no
  new consumer is introduced. Absolute zero is a Phase 2/whole-plan gate.
- [ ] Logo/favicon checksums, paths, aspect ratios, minimum sizes, clear space,
  and backing-value gate are machine/durably recorded.
- [ ] All token/font/generated-CSS tests pass.
- [ ] M01/D06/D12 briefs can be implemented without new product claims,
  runtime-only content, or budget changes.
- [ ] A reviewer can distinguish the new system from the old dark-only thesis
  before seeing a completed page.

## Risk assessment

- **Context explosion:** components gain visual branches. Signal: selectors
  duplicate per context. Response: keep context roles semantic and inherited;
  stop if behavior code checks context.
- **Logo loses dark-green detail:** signal: compact-size pilot review fails.
  Response: adjust neutral backing/clear space, never asset bytes or filters.
- **Token CSS growth threatens docs:** signal: D06/D12 projected transfer lacks
  safe headroom. Response: remove duplicate/raw aliases and decorative roles;
  replan before widening budgets.
- **Reinvention collapses to recolor:** signal: pilot briefs retain old macro
  composition. Response: reject briefs and revise hierarchy before Phase 2.

## Security considerations

No new network, user data, auth, or script source. Preserve CSP-compatible local
assets and generated-output discipline. Asset hashes are public integrity
metadata, not secrets.
