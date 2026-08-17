---
phase: 4
title: "Authored docs screen experiences"
status: substantially-complete
priority: P1
effort: "8-11d"
dependencies: [1, 2, 3]
---

<!-- 2026-08-17 status: all D01-D11 authored screens carry a page-
appropriate enrichment sourced from verified content (D01 atlas
counts + PassThrough registry, D02 previous-home identity, D03
Gatekeeper boundary blockquote, D04 doctor exit table + --dry-run,
D05 skip-not-guess boundary + pipeline sentence, D06 read-only
callout + lifecycle state-transition table, D07 proof-boundary
ledger, D08 upgrading docs-selector vs installed-version, D10
mutating-action markers, D11 migration destructive boundary).
Screen registry (docs-screen-registry.ts/.tsx) ships with a
DocsHomeExperience for D01 and PassThrough renderers for D02-D11 so
the authored MDX composition remains authoritative until per-screen
React experiences are needed. D00 language-chooser and D18 docs-
not-found are app-level (not registry-driven). Remaining plan work
routed to P7: dedicated React experience components per screen
family, screen-focused route tests. -->


# Phase 4: Authored docs screen experiences

## Context

- [Plan](./plan.md)
- [Screen blueprint D00–D11 and D18](../reports/brainstorm-260816-2324-living-execution-atlas.md#screen-by-screen-uiux-blueprint)
- Phase 1 safe-component decision; Phase 3 shell contract.

## Overview

Implement every non-reference docs screen as a purposeful experience rather
than a generic title/description/body wrapper. Preserve all verified prose and
links while changing hierarchy, content primitives, responsive composition, and
next actions.

## Requirements

- Deliver D00–D11 and D18 exactly once in both EN and VI where routes exist.
- Keep safe public Markdown, static discovery, search text, no-JS readability,
  and generated/authored ownership intact.
- Do not duplicate command/provider/release facts inside visual components.
- Every visual diagram has a text or table equivalent in initial HTML.
- Every page defines mobile composition, task completion path, destructive
  boundary where applicable, and page-kind-aware ending.
- Use the Phase 1 safe-component model. No arbitrary JSX, expressions, imports,
  handlers, or unsafe URLs in authored MDX.

## Architecture

### Screen registry

Map validated `screenKind` values to page experience components:

- `docs-home`, `previous-home`, `installation`, `first-install`;
- `kit-adapt`, `graph-execution`, `evaluation`;
- `upgrading`, `configuration`, `maintenance`, `migration`;
- app-level `language-chooser` and `docs-not-found`.

The registry selects composition; catalog metadata remains authority. Unknown
screen kinds fail build rather than falling back to a misleading generic page.

### Closed content components

Create only the shared structures required by multiple screens:

- Callout: Note, Gate, Boundary, Destructive, Evidence.
- Command block with command/output distinction and local copy status.
- Procedure/step and next-step navigation.
- Responsive data region with caption and record/table mobile strategy.
- Topology with textual equivalent.
- Operation matrix and authority layers.

Screen-specific visuals such as Proof ladder or Receipt/cache tree stay local to
their screen module. If Phase 1 rejected MDX shortcodes, mount the same
structures in page-level slots while source stays pure Markdown.

## Screen implementation matrix

| ID | Screen | Required composition | Completion evidence |
|---|---|---|---|
| D00 | Language chooser | Equal EN/VI cards, no preselection, marketing return link | Explicit stable URLs; stacked 320px; keyboard focus |
| D01 | Current docs home | Start path, execution understanding, generated reference launchers, migration boundary | Counts machine-owned; no fake recent history |
| D02 | Previous home | Persistent edition notice, only published destinations, stable return | No empty groups; historical names preserved |
| D03 | Installation | Platform commands, four-step integrity flow, Gatekeeper boundary, verify/next action | All platforms in initial HTML; no-JS and copy fallback |
| D04 | First install | Choose providers → scope → receipt rail, interactive/non-interactive modes | Both modes server-rendered; provider matrix linked |
| D05 | Kit/adapt | Kit → adapt → projection → receipt/cache system view | Skip-not-guess visible; diagrams have text equivalent |
| D06 | Graph execution | Flagship topology, lifecycle operations, five states, runtime/state matrices | Read-only boundary explicit; tables usable at 320px |
| D07 | Evaluation | Proof ladder, runtime probes, proof-boundary ledger | Every tier states proves/does-not-prove |
| D08 | Upgrading | Check → update → reinstall → doctor recipe | Docs selector not confused with installed version |
| D09 | Configuration | User/project authority layers, effective-value task, telemetry/security | Rejected keys and redaction behavior visible |
| D10 | Doctor/audit/backups/uninstall | Intent decision table, operation blocks, restore timeline, exit matrix | Mutating actions carry Gate/Destructive treatment |
| D11 | Migration | Four irreversible stages, prerequisite/evidence/stop condition, preservation list | `rm -rf` never styled as ordinary CTA |
| D18 | Docs not found | Contextual locale/version/page recovery | Real 404/noindex; localized when locale is known |

## Related code files

- Modify: `apps/docs/src/app/page.tsx`
- Modify: `apps/docs/src/app/not-found.tsx`
- Modify: `apps/docs/src/app/[locale]/[version]/[[...slug]]/page.tsx`
- Modify: `apps/docs/src/components/language-chooser.tsx`
- Create: `apps/docs/src/components/docs-screen-registry.tsx`
- Create: `apps/docs/src/components/screen-experiences/*.tsx`
- Create: `apps/docs/src/components/prose/callout.tsx`
- Create: `apps/docs/src/components/prose/command-block.tsx`
- Create: `apps/docs/src/components/prose/procedure.tsx`
- Create: `apps/docs/src/components/prose/responsive-data-region.tsx`
- Create: `apps/docs/src/components/prose/topology.tsx`
- Create: `apps/docs/src/components/prose/operation-matrix.tsx`
- Create: `apps/docs/src/components/prose/next-steps.tsx`
- Create if chosen by Phase 1: `apps/docs/mdx-components.tsx`
- Modify if chosen by Phase 1: `apps/docs/src/lib/public-markdown.ts`
- Modify: `apps/docs/content/authored/en/**/*.mdx`
- Modify: `apps/docs/content/authored/vi/**/*.mdx`
- Modify: `apps/docs/src/styles/docs.css`
- Modify: `tests/docs/content-pipeline.test.mjs`
- Modify: `tests/docs/static-discovery.test.mjs`
- Add screen-focused tests under `tests/docs/`.

## Implementation steps

1. Add failing screen-registry tests for all D00–D11/D18 routes and locale
   variants.
2. Produce responsive composition proofs for entry/recovery, onboarding,
   concept, operational, and safety-critical families. Review 320/1440 plus VI
   wrapping against the screen matrix before multiplying a family.
3. Implement the closed shared component set under the Phase 1 safety decision.
4. Prove rendered UI and clean Markdown discovery output from the same source.
5. Build D00, D01, D02, and D18 entry/recovery screens first.
6. Build D03/D04 task onboarding screens with no-JS platform/mode access.
7. Build D05/D06/D07 concept visuals from existing verified facts and textual
   equivalents.
8. Build D08/D09 operational guidance and authority hierarchy.
9. Build D10/D11 safety-critical procedure screens with destructive boundaries.
10. Recompose EN MDX, then mirror the same structural roles in VI without
   translating machine identities or commands.
11. Add page-specific next actions and verify pager interaction does not
    duplicate them.
12. Run every authored route at 320/390/1440 with JS on/off, then run static
    discovery and search tests.

## Test scenarios

| Priority | Scenario |
|---|---|
| Critical | D11 destructive commands have target explanation, preservation warning, no execution control |
| Critical | D03 all platform commands exist in no-JS HTML |
| Critical | D06 safe-change remains policy-denied and is not styled complete |
| High | D00 explicit EN/VI links and no automatic locale state |
| High | D02 only published historical destinations and persistent notice |
| High | D10 diagnostic vs mutating operations are distinguishable without color |
| High | Every topology/file tree has equivalent text/table content |
| Medium | VI heading wraps, command blocks, next actions, and callouts remain usable |

## Success criteria

- [ ] D00–D11 and D18 all have explicit screen-registry ownership.
- [ ] Every screen matrix requirement has a focused test.
- [ ] Every authored page family passes its composition proof before rollout;
      screens do not collapse into one repeated card/template rhythm.
- [ ] No page relies only on a generic page-kind wrapper.
- [ ] EN/VI structures remain equivalent while text and machine identities stay
      correct.
- [ ] Search/static discovery receive clean, useful Markdown.
- [ ] No arbitrary MDX execution path is introduced.
- [ ] Every page remains useful with JavaScript disabled.
- [ ] No clipping or hidden content at 320/375/390.
- [ ] `pnpm run test:qualification` passes within Phase 1 budgets.

## Risk assessment

- **Screen variants duplicate content.** Keep prose in MDX and visuals fed by
  catalog/release data; screen modules own composition only.
- **Safe shortcodes make discovery noisy.** Use Phase 1 plain-Markdown
  transformation or page-level slots; never emit component syntax to public
  discovery.
- **EN/VI structure drifts.** Add canonical screen-role parity tests independent
  of translated heading text.
- **D06/D10/D11 over-design harms scanability.** Keep text first, visual second;
  validate at 320px and with CSS disabled.
- **Generic primitives proliferate.** Promote only structures reused by at least
  two screens; keep one-off visuals local.

## Security considerations

- Destructive examples are inert text with copy only, never executable controls.
- Config paths, commands, and URLs remain authored or machine-owned constants.
- No visual component receives raw HTML.
