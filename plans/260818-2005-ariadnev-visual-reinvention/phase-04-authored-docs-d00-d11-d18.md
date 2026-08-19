---
phase: 4
title: "Authored docs D00-D11 and D18"
status: in-progress
priority: P1
effort: "7-9 engineer-days"
dependencies:
  - "phase-01-surface-contexts-tokens-and-typography.md"
  - "phase-02-shared-shells-and-interaction-grammar.md"
---

# Phase 4: Authored docs D00-D11 and D18

## Context links

- [Plan](./plan.md)
- [Accepted D06 pilot](./phase-02-shared-shells-and-interaction-grammar.md)
- [Screen registry](../../apps/docs/src/components/docs-screen-registry.ts)
- [Safe content decision](../../docs/decisions/docs-catalog-and-safe-components.md)

## Overview

Expand the D06 reading/instrument archetype into every root, home, onboarding,
concept, guide, operations, migration, and recovery screen. Each route keeps
authored/generated authority and gains a job-specific composition.

## Requirements

### Functional

- D00: explicit EN/VI gateway with immediate locale purpose and no remembered
  preference.
- D01-D02: current and previous edition homes expose orientation, release facts,
  task paths, and historical boundary without generic metric-card treatment.
- D03-D04: installation/first-install prioritize commands, writes, expected
  output, common failures, and next step in initial HTML.
- D05-D07: concept pages use diagrams as evidence with complete text adjacency;
  D06 pilot remains the archetype.
- D08-D11: guides emphasize decisions, config authority, destructive boundaries,
  rollback, and migration comparison using context-appropriate records.
- D18: real 404 with bilingual recovery facts/actions in initial HTML.
- Preserve pure authored Markdown, safe component registry, source attribution,
  breadcrumbs, TOC, copy source/heading, pager, and edition notice.

### Non-functional

- No page archetype duplicates machine-owned facts or hand-edits generated MDX.
- EN/VI content and chrome remain complete; Vietnamese wraps/diacritics receive
  independent review.
- Every screen is usable at 320px, 400% reflow, forced colors, print, no-JS,
  and text-spacing override.
- Add visual fixture coverage for currently semantic-only D04, D05, D07, D08,
  D09, and D10 so D00-D11/D18 all have archetype pixel evidence.

## Architecture

```text
route + catalog page
  -> docs-screen-registry (closed ownership)
     -> screen-experience component (composition only)
        -> safe prose primitives
           -> authored Markdown body remains public authority
```

Screen components may structure and summarize facts already present in catalog
metadata or safe source data. They must not fork content into manually copied
constants.

## File inventory

| Action | File(s) | Purpose | Test impact |
|---|---|---|---|
| Modify | `apps/docs/src/components/language-chooser.tsx` | D00 gateway | Root/static/no-JS visuals |
| Modify | `screen-experiences/docs-home.tsx`, `previous-home.tsx` | D01-D02 edition orientation | D02-D04 probes |
| Modify | `installation.tsx`, `first-install.tsx` | D03-D04 task-first onboarding | D02-D04 probes/task outcomes |
| Modify | `kit-adapt.tsx`, `evaluation.tsx` | D05/D07 concept compositions | D05-D07 probes |
| Preserve/integrate | `graph-execution.tsx` | Accepted D06 archetype | Pilot regression |
| Modify | `upgrading.tsx`, `configuration.tsx`, `uninstall-and-doctor.tsx`, `migration-from-vcskill.tsx` | D08-D11 decision/operation compositions | D08-D11 probes/task outcomes |
| Modify if needed | `apps/docs/src/components/prose/*.tsx` | Additive semantic wrappers only; closed barrel remains intentional | Prose component tests |
| Modify | `apps/docs/src/app/not-found.tsx` | D18 bilingual recovery | Static routing/visual |
| Modify | `apps/docs/src/styles/docs.css` | Authored archetype composition | Forbidden features/budget/visual |
| Modify | `tests/benchmarks/screen-fixtures.json`, `tests/visual/lib/screen-fixtures.mjs`, `tests/visual/docs/docs-screens.spec.ts` | Add D04/D05/D07-D10 coverage | Manifest/visual suite |
| Modify | `tests/docs/screen-fixture-manifest.test.mjs`, `screen-fixture-structural-probes.test.mjs` | Make new fixture IDs and route identities mandatory | Docs native suite |
| Modify | `tests/docs/screen-experience-d02-d04.test.mjs`, `...d05-d07...`, `...d08-d11...` | Lock semantic outcomes, not old decoration | Docs native suite |
| Update/create | D00-D11/D18 files under `tests/visual/__baselines__/docs/` | Approved authored-screen evidence | Chromium visuals |

## Function and interface checklist

- [ ] Registry still maps each `pageKind/screenId` deterministically and has no
  pass-through fallback for owned authored screens.
- [ ] Safe prose barrel exports remain explicit and public Markdown remains
  free of JSX/HTML/image/runtime dependencies.
- [ ] Topology retains accessible adjacency/text and marks SVG supplemental.
- [ ] Responsive data regions retain visible overflow cue, focusable local
  scroller, caption/label, and stacked alternative where appropriate.
- [ ] Operation matrix distinguishes diagnostic/mutating/destructive in text
  and shape, not color alone.
- [ ] Migration diff and destructive commands preserve exact command text and
  rollback/source facts.
- [ ] D18 keeps bilingual content without locale detection or redirect.

## Implementation steps

1. Add missing D04/D05/D07-D10 fixtures and current-behavior semantic probes
   before visual changes; do not seed new baselines yet.
2. Recompose D00-D02 around explicit orientation and edition boundaries using
   brand/reading contexts, not hero cards or metric tiles.
3. Recompose D03-D04 as task sheets with command tickets, writes, verification,
   failure/recovery, and visible continuation.
4. Apply the accepted D06 concept grammar to D05/D07 while preserving unique
   page jobs and textual diagram authority.
5. Recompose D08-D11 as decision/operation dossiers. Keep destructive and
   approval semantics separate.
6. Recompose D18 with truthful bilingual recovery and known-good links.
7. Audit screen registry, safe prose boundary, heading/TOC/pager/copy actions,
   EN/VI parity, and previous-edition behavior.
8. Run authored docs native tests and representative route budgets first.
9. Review every screen at required widths; seed/rotate only approved authored
   baselines, then run a second clean visual pass.

## Test scenario matrix

| Priority | Scenario | Evidence |
|---|---|---|
| Critical | Authored Markdown/generated authority is duplicated or weakened | Content pipeline/public Markdown tests fail |
| Critical | Install/migration/destructive facts disappear | Task outcomes + structural probes fail |
| Critical | Invalid locale/version/page loses truthful recovery | Static routing/D18 journey fails |
| High | VI route wraps/clips or chrome differs | D01-vi visuals + parity test fail |
| High | New visual-only fixture lacks semantic owner | Manifest/registry tests fail |
| High | 320px table/code/topology creates page overflow | A11y/overflow probes fail |
| High | Print/forced-color/reflow loses decision boundaries | Accessibility modes fail |
| Medium | D04/D05/D07-D10 new screenshots are unstable | Two-run gate fails |

## Dependency map

```text
D06 pilot + shared shell
  ├─ D00-D02 orientation
  ├─ D03-D04 onboarding
  ├─ D05-D07 concepts
  ├─ D08-D11 operations
  └─ D18 recovery
       -> Phase 5 references consume same prose/data primitives
       -> Phase 6 qualification
```

## Todo

- [ ] Expand fixture coverage to every authored archetype.
- [ ] Recompose D00-D05, D07-D11, and D18.
- [ ] Preserve/integrate D06 pilot.
- [ ] Pass safe-content, EN/VI, no-JS, accessibility, and budget gates.
- [ ] Seed/rotate and stabilize authored-screen baselines.

## Success criteria

- [ ] D00-D11 and D18 each have a distinct job-aligned composition and visual
  evidence at required widths.
- [ ] All authored body/source/route contracts remain unchanged.
- [ ] Installation, first install, destructive migration, edition recovery, and
  bilingual recovery task outcomes pass.
- [ ] No old gradient/glass/glow/bento/pill-default treatment remains.
- [ ] Native docs tests, budgets, accessibility modes, and two visual runs pass.

## Risk assessment

- **Visual wrappers duplicate content:** signal: strings/facts appear in both
  MDX and TSX. Response: derive from catalog/source or keep visual structure
  outside body; never copy machine-owned facts.
- **Coverage expansion causes flaky snapshots:** signal: new routes depend on
  runtime timing. Response: use static fixtures, deterministic fonts, existing
  wait helpers, and semantic assertions before snapshots.
- **Dense calm becomes cramped:** signal: Vietnamese or text-spacing mode clips.
  Response: loosen context spacing tokens/page archetype; do not truncate copy.
- **D06 pilot over-constrains other concepts:** signal: irrelevant graph shell
  appears everywhere. Response: share context grammar, not identical layout.

## Security considerations

Preserve safe Markdown validation, no raw HTML, no runtime content fetch,
localized static links, and escaped user-independent search/copy content. No
new data collection or external assets.
