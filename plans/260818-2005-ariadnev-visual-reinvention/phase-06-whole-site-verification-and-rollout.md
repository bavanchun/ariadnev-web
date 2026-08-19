---
phase: 6
title: "Whole-site verification and rollout"
status: completed
priority: P1
effort: "3-5 engineer-days"
dependencies:
  - "phase-03-marketing-surfaces-m01-m02.md"
  - "phase-04-authored-docs-d00-d11-d18.md"
  - "phase-05-generated-references-d12-d17.md"
---

# Phase 6: Whole-site verification and rollout

## Context links

- [Plan](./plan.md)
- [Verification research](./research/research-260818-2014-migration-verification-rollout-strategy.md)
- [Visual harness runbook](../../docs/operations/visual-verification-harness.md)
- [Deployment and rollback](../../docs/operations/deployment-and-rollback.md)
- [Qualification evidence](./reports/qualification-evidence-2026-08-19.md)
- [Ship and rollback handoff](./reports/ship-and-rollback-handoff-2026-08-19.md)

## Overview

Prove the reinvention as one system from a clean build, reconcile live contract
documentation, review all intentional baseline churn, and produce deployment-
ready evidence with explicit rollback seams. Actual production publication
remains a separate authorized ship action.

## Requirements

### Functional

- Run every token, site, docs, contract, type, build, visual, accessibility,
  journey, task-outcome, budget, and discovery gate from clean artifacts.
- Ensure visual fixtures cover M01-M02 and every D00-D18 archetype, including
  newly added D04/D05/D07-D10/D13.
- Audit immutable assets against the Phase 1 manifest and inspect logo
  preservation zones at compact/desktop sizes.
- Perform a whole-system visual review with logos temporarily hidden to prove
  typography/grid/state/context coherence.
- Reconcile stale budget prose against verified live JSON/test authority; do
  not rewrite historical decisions beyond a dated factual addendum.
- Update the visual harness runbook only for durable fixture/baseline workflow
  changes.
- Produce qualification evidence and an exact ship/rollback handoff recipe.
  Final deployment input requires authorized product/evidence commits and is
  created only in a separate ship action.

### Non-functional

- No blanket baseline acceptance. Every changed fixture maps to an owning phase
  and approved composition.
- Two consecutive clean visual runs pass on the pinned browser versions.
- Lighthouse audited routes stay at or above the repository threshold; current
  accessibility target remains 95 minimum, with regressions treated as defects.
- No dev server, watcher, or browser process remains after verification.

## Architecture

```text
clean checkout artifacts
  -> tokens/contracts/typecheck/build/native tests
  -> narrow site/docs visual slices
  -> accessibility modes + task outcomes + cross-browser journeys
  -> full visual run #1 and #2
  -> Lighthouse + budget evidence
  -> deploy-ready record

rollback seams: token commit | Astro site unit | docs static unit | edge only if host behavior changed
```

## File inventory

| Action | File(s) | Purpose | Test impact |
|---|---|---|---|
| Review/update | `tests/benchmarks/screen-fixtures.json` | Final full-archetype manifest | Manifest tests |
| Modify | Appropriate visual/accessibility probe spec plus fixture schema if needed | Add automated 390px overflow/focus probe without full screenshot matrix | Reflow/overflow gate |
| Review/update | `tests/visual/site/marketing-screens.spec.ts`, `tests/visual/docs/docs-screens.spec.ts` | Complete visual matrix | Chromium visuals |
| Review/update | `tests/visual/accessibility-modes.spec.ts`, `journeys/critical.spec.ts`, `task-outcomes.spec.ts` | Preserve semantic outcomes; add only missing acceptance evidence | Cross-browser/a11y |
| Update | `tests/visual/__baselines__/site/**`, `docs/**` | Final approved screenshots | Visual suite |
| Verify, do not weaken | `tests/benchmarks/performance-budgets.json`, `docs-per-route-ratchet.json` | Live frozen caps | Budget suites |
| Modify if stale after measurement | `docs/decisions/docs-performance-baselines.md` | Dated reconciliation to live contract values | Claim/link review |
| Modify if workflow changed | `docs/operations/visual-verification-harness.md` | Full-archetype baseline/runbook instructions | Operator validation |
| Read-only | Deployment input/evidence paths per operations doc | Describe exact later ship recipe; do not create input in this phase | Deployment contracts |

No product source changes belong here except defects discovered by verification;
those return to the owning phase and rerun its focused gate.

## Function and interface checklist

- [x] Fixture manifest and specs have one intentional owner for M01-M02 and
  every D00-D18 archetype.
- [x] Baseline helper waits for deterministic fonts/layout without arbitrary
  sleeps or hidden animation disabling beyond reduced-motion policy.
- [x] Visual servers use deterministic ports 4331/4332; existing owners are
  identified before start and only processes started by this run are stopped.
- [x] Qualification script still orders content generation, contracts,
  typecheck, build, native tests, and visual tests correctly.
- [x] Budget walker measures every enumerable docs route and current site assets.
- [x] Deployment input pins explicit product/evidence SHAs and existing units;
  no branch/latest aliases.
- [x] Rollback uses recorded worker/deployment identities and existing unit order.

## Implementation steps

1. Re-read all phase acceptance criteria and map each to a command, artifact,
   screenshot, or human composition check. Return gaps to owners.
2. Verify no stale process owns ports 4331/4332; record any process started and
   guarantee cleanup on success/failure.
3. Build from clean generated artifacts; run narrow token/site/docs suites,
   fixing defects in their owning phase rather than weakening assertions.
4. Review baseline diff by fixture ID. Reject churn on untouched surface or
   unexplained font/browser differences; rotate only intentional pixels.
5. Run `pnpm run test:qualification`; its final step is the first complete
   visual run, including Chromium screenshots/axe/task outcomes and
   Firefox/WebKit journeys.
6. Without source, browser, or baseline changes, run `pnpm run test:visual`
   once more. These are the required two consecutive pinned-browser runs.
7. Run on-demand Lighthouse on M01,
   D01-vi, D06, D12, D14, and D18 or the current harness-equivalent set.
8. Compare per-route, search, static output, and build-cost evidence to live
   caps/baselines. No cap moves in this phase.
9. Perform final human review: logo zones, hidden-logo system coherence,
   dark/light transition grammar, first mobile viewport, Vietnamese typography,
   and absence of retired patterns.
10. Update only affected durable runbook/decision claims, validate links, and
    produce qualification evidence plus a ship/rollback recipe. The user's
    execution advice authorized continuous commits; do not create deployment
    inputs or external publication in this phase.
11. Reconcile processes and verify ports are free or returned to their prior
    clearly owned state.

For baseline changes, use a targeted Playwright invocation with the owning spec
and fixture grep plus `--update-snapshots=all`, inspect the exact diff, then run
the full suite. Do not use the repository-wide `test:visual:update` command as
the first acceptance step because it rewrites every Chromium baseline.

## Test scenario matrix

| Priority | Scenario | Evidence |
|---|---|---|
| Critical | Any logo/favicon checksum differs | Asset contract blocks release |
| Critical | Qualification/type/build/native/contract test fails | Release blocked |
| Critical | URL, route count, search/discovery, EN/VI, no-JS contract drifts | Contract/task tests block |
| Critical | Any live cap exceeded or grandfather list grows | Budget gate blocks; user decision required |
| High | Visual run differs on second clean pass | Flake investigation blocks |
| High | 320/375/390/768/1280/1440 clips or hides focus | Visual/a11y gate blocks |
| High | Forced colors/print/reflow loses semantics | Accessibility modes block |
| High | Hidden-logo review exposes cross-app visual divergence | Composition review blocks |
| High | Unowned process remains on visual ports | Process reconciliation blocks finish |
| Medium | Durable docs claim stale contract value | Correct dated addendum before handoff |

## Dependency map

```text
P3 marketing ─┐
P4 authored ──┼─> clean qualification -> deploy-ready evidence -> optional ship
P5 reference ─┘                    |
                                    -> rollback by existing units
```

## Todo

- [x] Map every acceptance criterion to evidence.
- [x] Complete full-archetype fixture and baseline review.
- [x] Pass clean qualification, Lighthouse, and two-run stability.
- [x] Reconcile immutable assets, budgets, docs claims, and processes.
- [x] Produce qualification evidence and ship/rollback recipe without
  deployment input creation or external mutation.

## Success criteria

- [x] All six phase contracts pass with zero unresolved contradiction.
- [x] `pnpm run test:qualification` and on-demand Lighthouse pass from clean
  artifacts; visual suite passes twice consecutively.
- [x] All M01-M02/D00-D18 archetypes have intentional semantic and visual
  evidence at declared stress frames.
- [x] No immutable asset, public behavior, generated authority, locale, no-JS,
  budget, or deployment contract regresses.
- [x] No retired visual pattern remains unintentionally and hidden-logo review
  confirms one coherent system.
- [x] No background process started by verification is left running.
- [x] Deployment/rollback recipe is complete; deployment-input creation and
  production mutation await explicit ship authorization.

## Risk assessment

- **Baseline laundering:** signal: blanket snapshot update or unexplained churn.
  Response: revert unowned baselines and rerun narrow owner phase.
- **Historical docs contradict live tests:** signal: prose says 302000 while
  JSON enforces another value. Response: append measured reconciliation and
  link live authority; do not rewrite historical context silently.
- **Cross-platform raster drift:** signal: macOS/CI differs only in font edges.
  Response: use pinned versions/tolerance and semantic checks; never hide real
  layout differences by broad tolerance.
- **Verification becomes a defect dumping ground:** signal: product source is
  changed ad hoc here. Response: return defect to owning phase and rerun its
  full gate before resuming.

## Security considerations

Do not expose deployment tokens, environment values, private release metadata,
or local paths in published evidence. Preserve CSP/headers, verify static output
contains no remote runtime dependency, and use existing secret-safe deployment
workflow only after authorization.
