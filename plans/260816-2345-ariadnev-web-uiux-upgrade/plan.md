---
title: "ariadnev web UI/UX upgrade — Living Execution Atlas"
description: "Rebuild the public web surface as a Living Execution Atlas — an expressive marketing atlas plus an operational field manual — following the delivery sequence in plans/reports/brainstorm-260816-2324-living-execution-atlas.md. Starts with a machine-owned contract gate before touching visuals, and ends with a verification harness the release gate runs on every PR."
status: pending
priority: P1
effort: "3-4w wall time across six phases"
tags: [web, docs, site, ux, accessibility, design-system]
created: 2026-08-16
---

# ariadnev web UI/UX upgrade — Living Execution Atlas

## Overview

Two documents drive this plan:

1. **`plans/reports/audit-260816-2007-ui-ux-whole-site.md`** — the
   whole-site UI/UX audit that graded the marketing site 7–8/10 and docs
   4–5/10, and enumerated every P0–P3 finding with file paths.
2. **`plans/reports/brainstorm-260816-2324-living-execution-atlas.md`** —
   the direction-setting brainstorm that named the target ("Living
   Execution Atlas"), the delivery sequence, the CLI contract this plan
   must respect, and Kongming's NO-GO for implementation until a
   contract-and-measurement phase passes.

The plan implements the brainstorm's six-step sequence. Phase 1 is the
contract gate — no visuals move until command identity, retired-route
behavior, Fumadocs adoption, and static bundle budget are measured and
committed as decisions. Phase 3 folds the audit's mobile-safety fixes in
front of the shell rewrite in the same phase so shell work never merges on
top of a clipping surface.

## Contract (2026-08-16)

**Outcome.** The docs product supports both tasks (guides) and lookup
(references) at 320/375/390/768/1440 without clipping, hidden navigation, or
locale-untranslated chrome. The marketing site leads with a live execution
path across five distinct macro-compositions. Both surfaces share the same
semantic state vocabulary through tokens, not through copied framework
components.

**Constraints.**

- Preserve execution-cartography identity: ink, graphite, cool white,
  spectral blue for live execution, copper for human gates, drafted
  geometry. No new accent families, decorative gradients, glows, or
  meaningless looping motion.
- Preserve public URLs, verified claims, generated-source authority
  (`packages/contracts`, `packages/tokens/dist/*`), locale/version
  contracts, static delivery, and existing performance and accessibility
  gates.
- Continue supporting EN and VI with complete application-chrome
  localization.
- Treat real content scale as a design input: 132 TOC entries and 45 tables
  on the CLI reference; +318 projected HTML routes with historical
  projection; sampled 297,860 bytes against the 300,000-byte cap.
- **Keep this redesign dark-only.** Light mode is a separate product and
  token-system decision, not an incidental addition (brainstorm-locked).
- Do not hand-edit generated MDX or `packages/tokens/dist/*`.
- Do not replace semantic HTML with custom ARIA unless full keyboard
  behavior is implemented (roving focus, Escape, focus return,
  outside-click).
- Do not weaken existing token, contrast, font, static-output, or
  docs-content tests. New tests may be added; existing assertions stay.
- Every change ships through `pnpm run test:qualification` and the same
  deployment path the 1.1.0 cutover used.

**Non-goals.**

- No rebrand, new positioning, invented metrics, testimonials, or backend
  work.
- No framework migration for prestige alone (Astro for site, Next+Fumadocs
  for docs stay).
- No cinematic WebGL/Three.js, perpetual animation, or dependency-heavy
  interaction system.
- No new locale beyond EN/VI.
- No CMS. Authored content stays MDX; generated content stays
  bundle-derived.

**Acceptance criteria (whole plan; each phase carries its own).**

- Zero clipped content at 320/375/390/768/1440 across site, docs shell,
  and all 15 authored pages plus every generated page.
- All application chrome localized for VI in addition to EN.
- CLI reference is split per Phase 1's contract: index at `/reference/cli/`
  preserves every legacy anchor as a visible DOM target; per-command
  detail at `/reference/cli/<slug>/`; historical stables carry detail
  pages only where the source contains the command; no JavaScript
  redirect.
- Shared design tokens define state layers, code/data surfaces, and shell
  dimensions; docs and site both consume them from `packages/tokens`.
- Screenshot baselines exist at 320/375/768/1280/1440 for the routes
  named in Phase 6; the harness fails a PR that regresses them without
  an explicit baseline update.
- The four brainstorm-mandated stress frames pass every run: CLI at
  320px, provider at 320px, desktop CLI lookup, complete VI route.
- Lighthouse accessibility ≥95 on production output for both apps.
- A no-JavaScript journey reaches a CLI command detail page from
  `/reference/cli/` in server HTML alone.
- All existing `test:qualification` gates stay green; new tests added by
  this plan run in the same command.

## Goals

| # | Goal | Priority |
|---|------|----------|
| 1 | Prove the CLI command contract, historical policy, Fumadocs adoption, and static bundle budget with measurement — no visuals until this passes | P1 |
| 2 | Extend shared tokens so site and docs stop diverging invisibly | P1 |
| 3 | Fix the docs product's P0 clipping/discoverability defects and ship the real shell in the same range | P1 |
| 4 | Ship generated references through primitives with a per-command CLI URL and preserved legacy anchors | P1 |
| 5 | Recompose the marketing home into five distinct macro-sections led by the execution path | P2 |
| 6 | Prevent regression with a real screenshot + axe + no-JS + stress-frame harness | P1 |

## Phases

| # | Phase | Depends on | Status |
|---|-------|------------|--------|
| 1 | [Contract gate & measurement spike](./phase-01-contract-gate-and-measurement-spike.md) | — | Pending |
| 2 | [Shared design tokens and shell primitives](./phase-02-shared-design-tokens-and-shell-primitives.md) | 1 | Pending |
| 3 | [Docs safety and shell](./phase-03-docs-safety-and-shell.md) | 1, 2 | Pending |
| 4 | [Generated reference experience](./phase-04-generated-reference-experience.md) | 1, 2 | Pending |
| 5 | [Marketing recomposition](./phase-05-marketing-recomposition.md) | 2 | Pending |
| 6 | [Full verification](./phase-06-full-verification.md) | 1, 2, 3, 4, 5 | Pending |

Phase 1 is Kongming's NO-GO gate: nothing downstream begins without its
decision docs. Phases 3, 4, and 5 may run in parallel after Phases 1 and 2
land — file ownership is disjoint (docs shell, generated renderer,
marketing components). Phase 6 is deliberately last; adding a screenshot
harness during composition churn produces churn, not signal.

## Locked decisions

- **Living Execution Atlas as target direction.** Marketing is the
  expressive atlas; docs is the operational field manual. Same tokens,
  typography, geometry, state vocabulary, and topology language; different
  section templates and motion intensity (brainstorm-locked).
- **Dark-only for this redesign.** Light mode is deliberately out of
  scope. It becomes a separate product decision with its own token,
  contrast, and metadata work — not an incidental addition here
  (brainstorm-locked).
- **CLI reference split per command with the aggregate preserved as an
  index.** Every command has a canonical `/reference/cli/<slug>/`. The
  aggregate at `/reference/cli/` becomes a summary index and keeps every
  legacy `#anchor` as a visible DOM target linking to the canonical
  detail. No JavaScript redirect (brainstorm-locked; user-confirmed
  2026-08-16).
- **VI locale is URL-only.** No cookie, no localStorage, no auto-redirect.
  Deep links stay predictable and there is no cookie-banner question
  to litigate (brainstorm-locked; user-confirmed 2026-08-16).
- **Historical projection.** Detail pages are generated whenever the
  historical bundle contains the command. Aliases stay as searchable
  metadata + legacy anchors, not additional canonical routes
  (brainstorm-locked; formalized in Phase 1's contract).
- **`@axe-core/playwright` is a direct dev dep.** Not a transitive import
  (brainstorm-locked; wired in Phase 6).

## Open questions

None blocking. Phase 1's spike may surface follow-ups — a Fumadocs adoption
level that requires a token addition, a byte-budget outcome that requires
shrinking the shell — but those resolve inside Phase 1's decision docs and
propagate to later phases mechanically.

## Cost and honesty notes

- **Byte budget is thin.** Docs page sampled at **297,860 bytes** against a
  **300,000-byte cap** — ~2KB headroom before Phase 1's measurement. If
  Phase 1's spike reports the +318 detail pages plus new shell primitives
  break the cap, Phase 1's decision doc names the response (shrink,
  parallelize, or bump with owner sign-off) and every later phase respects
  that decision.
- **Contract gate is not optional.** Kongming returned **GO with concerns**
  for planning and **NO-GO for implementation** until Phase 1 passes. The
  binding concerns are CLI identity, retired-route behavior, content-scale
  proof, and bundle headroom — not visual ambition. Skipping Phase 1 to
  "start faster" would rework Phases 2–4 after they merge.
- **Phase 3 is intentionally large.** It touches `docs-shell.tsx`,
  `locale-version-switcher.tsx`, `page.tsx`, `layout.tsx`, `docs.css`,
  and creates the sidebar/TOC/pager plus page-kind templates in one
  phase. Splitting further would push shell releases before keyboard/menu
  semantics were fixed, which is the opposite of the audit's intent.
- **Phase 4's CLI split is a URL-shape change.** The current
  `/reference/cli/` URL is referenced from search indexes and external
  links. The brainstorm's rule — legacy anchors as visible in-page
  targets, no JavaScript redirect — is the cheapest way to preserve those
  links; Phase 6's no-JS journey test enforces it.
- **Phase 6 pays for itself only if it runs after composition churn.**
  Adding it earlier would cost baseline resets on every phase.

## Success Criteria

- [ ] Every phase's own acceptance criteria met and checked off.
- [ ] Phase 1's three decision docs (CLI identity + retired routes,
      Fumadocs UI adoption spike, static budget after CLI split) exist and
      are consumed by later phases.
- [ ] `pnpm run test:qualification` green with the visual, axe, and
      Lighthouse steps wired in (Phase 6).
- [ ] Screenshot baselines at 320/375/768/1280/1440 exist and gate CI.
- [ ] All four stress-frame specs pass on every run.
- [ ] No-JS journey to a CLI command detail page passes.
- [ ] Lighthouse ≥95 accessibility on docs production output.
- [ ] Zero P0 findings from the audit remain open.
- [ ] All P1 findings are either closed or explicitly deferred with a
      written trade-off.
- [ ] `docs.ariadnev.com/en/stable/` and `/vi/stable/` present a shell that
      exposes all 15 pages without horizontal swiping on 320px.
- [ ] `ariadnev.com` uses the five brainstorm-named macro-compositions in
      order.

<!-- slug: ariadnev-web-uiux-upgrade -->
