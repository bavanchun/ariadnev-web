# Research Report: Visual Reinvention Migration, Verification, and Rollout Strategy

---
date: 2026-08-18
scope: migration-verification-rollout
status: final
sources:
  - package.json
  - playwright.config.ts
  - vitest.config.ts
  - docs/operations/visual-verification-harness.md
  - docs/operations/deployment-and-rollback.md
  - docs/decisions/docs-performance-baselines.md
  - plans/260816-2345-ariadnev-web-uiux-upgrade/phase-07-full-deterministic-verification.md
  - tests/benchmarks/screen-fixtures.json
  - tests/benchmarks/performance-budgets.json
  - tests/benchmarks/docs-per-route-ratchet.json
  - tests/tokens/*
  - tests/site/*
  - tests/docs/*
  - tests/visual/*
---

## Summary

Recommend **rank 1: phased contract-first rollout with surface seams**:

1. shared tokens + generated CSS
2. Astro marketing visual change
3. Next/Fumadocs shell + authored docs screens
4. generated reference surfaces
5. screenshot baseline rotation
6. qualification + deployment cutover

Do **not** do a big-bang rebaseline. Current repo already has stronger-than-visual contracts on static output, no-JS, i18n, search isolation, per-route budgets, and rollback order. Safest path is to preserve those as hard authority while rotating only the intentional screenshot and route-budget evidence per phase.

Live authority for budget truth is **JSON + tests**, not prose ADR text. `docs/decisions/docs-performance-baselines.md` still narrates earlier `302000` language, but enforceable contracts now pin docs transfer at **308000 bytes** in `tests/benchmarks/performance-budgets.json`, `tests/benchmarks/docs-per-route-ratchet.json`, `tests/docs/docs-per-route-ratchet.test.mjs`, and `tests/contracts/public-edge-contract.test.mjs`. Treat the ADR as stale narrative until reconciled.

## Source Weighting

| Source class | Credibility | Use |
|---|---|---|
| Tests and runtime contracts | highest | actual release authority |
| Config and scripts | high | what CI/local runs really do |
| Operations docs | medium-high | operator intent, rollback policy |
| Decision docs | medium | rationale only when aligned with live contracts |

## Ranked Rollout Patterns

| Rank | Pattern | Fit | Trade-off | Risk |
|---|---|---|---|---|
| 1 | phase by surface seam, keep all non-visual contracts hard | best fit for Astro + static Next export + Worker topology | slower rebaseline churn | lowest rollback and diagnosis risk |
| 2 | phase by component family across both site and docs | moderate | shared design consistency sooner | mixes owners, makes failures ambiguous |
| 3 | single whole-site visual cut + bulk snapshot update | bad fit | fastest appearance change | highest risk; impossible diff triage; weak rollback evidence |

## Recommended Phase/Dependency Plan

### Phase A — Token contract freeze

Dependencies: none.

Change:
- `packages/tokens/src/tokens.json`
- generated token CSS only

Must stay green:
- `tests/tokens/token-contract.test.mjs`
- `tests/tokens/font-contract.test.mjs`
- `tests/tokens/generated-css.test.mjs`

Acceptance evidence:
- no font digest drift unless intentionally replacing font assets
- no new remote font/network dependency
- contrast/focus/touch/motion token assertions unchanged or stronger
- generated `site.css`/`docs.css` deterministic

Stop/replan if:
- token change forces logo/favicon binary replacement
- font bytes/digests change without explicit asset approval
- reduced-motion contract breaks

### Phase B — Marketing-only visual reinvention

Dependencies: Phase A.

Change:
- Astro site visuals only

Must stay authority:
- `tests/site/static-output.test.ts`
- `tests/site/progressive-enhancement.test.ts`
- `tests/site/structure.test.ts`
- `tests/site/release-pin.test.ts`
- `tests/site/performance-budget.test.ts`
- `tests/visual/site/marketing-screens.spec.ts`
- `tests/visual/journeys/critical.spec.ts` site assertions

Expected updates:
- M01/M02 Chromium baselines

Must not change:
- public URLs
- exact logo/favicon binaries
- static-only output
- one-bundle/no-runtime-fetch behavior
- no-JS essential content

Rollback seam:
- site asset/content only; docs untouched; edge topology unchanged

Stop/replan if:
- M01 overflow at `320`, `375`, `768`, `1280`, `1440`
- install/docs CTA needs more interaction than current first viewport
- site first-load budget exceeds current cap instead of staying under `marketing-total-transfer-compressed`

### Phase C — Docs shell + authored screen reinvention

Dependencies: Phase A, Phase B optional.

Change:
- shared docs shell
- D00/D01/D02/D03/D06/D11/D12/D14/D15/D16/D17/D18 visual compositions
- authored screen experiences and shell affordances

Must stay authority:
- `tests/docs/forbidden-runtime-features.test.mjs`
- `tests/docs/static-routing.test.mjs`
- `tests/docs/static-discovery.test.mjs`
- `tests/docs/search-isolation.test.mjs`
- `tests/docs/shell-accessibility.test.mjs`
- `tests/docs/vi-chrome-key-parity.test.mjs`
- `tests/docs/screen-fixture-manifest.test.mjs`
- `tests/docs/screen-fixture-structural-probes.test.mjs`
- `tests/visual/accessibility-modes.spec.ts`
- `tests/visual/journeys/critical.spec.ts`
- `tests/visual/task-outcomes.spec.ts`
- `tests/visual/docs/docs-screens.spec.ts`

Expected updates:
- D00/D01/D01-vi/D02/D03/D06/D11/D12/D14/D15/D16/D17/D18 Chromium baselines

Hard constraint:
- shell and page identity must remain no-JS navigable and bilingual

Rollback seam:
- docs static export + docs asset deploy unit only

Stop/replan if:
- `vi-chrome-key-parity` fails
- any `forbidden-runtime-features` rule requires weakening
- no-JS locale/version chooser path breaks in `tests/docs/run-browser-shell.mjs`
- shell budget pressure requires silent cap increase

### Phase D — Generated references and discovery surfaces

Dependencies: Phase C.

Change:
- generated CLI/providers/skills/workflows/reference presentation
- static markdown outputs
- search partition shape

Must stay authority:
- `tests/docs/content-pipeline.test.mjs`
- `tests/docs/static-discovery.test.mjs`
- `tests/docs/search-isolation.test.mjs`
- `tests/docs/docs-screen-registry.test.mjs`
- `tests/docs/screen-experience-d02-d04.test.mjs`
- `tests/docs/screen-experience-d05-d07.test.mjs`
- `tests/docs/screen-experience-d08-d11.test.mjs`
- `tests/visual/task-outcomes.spec.ts` tasks 4-6

Expected updates:
- D12/D14/D15/D16 visual baselines
- maybe D17 if release-notes presentation changes

Rollback seam:
- docs content build only; shell unchanged if phase isolated properly

Stop/replan if:
- search partition exceeds `160000` compressed for either locale
- retired CLI routes lose static Markdown compatibility
- `reference-only` pages leak into global sidebar
- generated route count or output shape breaks static discovery/llms contracts

### Phase E — Full qualification, baseline rotation, and deploy

Dependencies: Phases B-D.

Authority:
- `pnpm run test`
- `pnpm run test:visual`
- optional `pnpm run test:visual:lighthouse`
- deploy/rollback scripts from `package.json`

Rollback seam:
- deployment plan, not code, determines recovery
- deploy order remains `docs -> edge`
- rollback order remains `edge -> docs`

Stop/replan if:
- any production-facing route needs topology mutation outside existing unit order
- rollback plan cannot target explicit worker version IDs
- evidence record would mix product SHA/topology across attempts

## Test Scenario Matrix

| Area | Existing authority | Keep / Update |
|---|---|---|
| Token semantics, contrast, font integrity | `tests/tokens/*` | keep |
| Marketing static shape, CSP, self-hosting, no third-party runtime | `tests/site/static-output.test.ts`, `tests/site/structure.test.ts` | keep |
| Marketing no-JS, reduced motion, keyboard, copy fallback | `tests/site/progressive-enhancement.test.ts` | keep |
| Marketing visual proof | `tests/visual/site/marketing-screens.spec.ts` | update baselines only |
| Docs static-export/runtime bans | `tests/docs/forbidden-runtime-features.test.mjs` | keep |
| Docs route enumeration and sibling safety | `tests/docs/static-routing.test.mjs` | keep |
| Docs search partition isolation and cap | `tests/docs/search-isolation.test.mjs` | keep unless explicit approved budget move |
| Docs discovery/llms output | `tests/docs/static-discovery.test.mjs` | keep |
| Docs shell accessibility and no-JS fallbacks | `tests/docs/shell-accessibility.test.mjs`, `tests/docs/run-browser-shell.mjs` | keep |
| EN/VI shell parity | `tests/docs/vi-chrome-key-parity.test.mjs` | keep |
| Manifest/fixture coverage | `tests/docs/screen-fixture-manifest.test.mjs`, `tests/docs/screen-fixture-structural-probes.test.mjs` | keep, extend only if fixtures expand |
| Docs authored-screen structural contracts D02-D11 | `tests/docs/screen-experience-d02-d04.test.mjs`, `...d05-d07...`, `...d08-d11...` | keep |
| Docs visual proof D00-D18 subset | `tests/visual/docs/docs-screens.spec.ts` | update baselines for changed fixtures |
| Cross-browser critical journeys | `tests/visual/journeys/critical.spec.ts` | keep |
| Accessibility stress modes | `tests/visual/accessibility-modes.spec.ts` | keep |
| Critical tasks | `tests/visual/task-outcomes.spec.ts` | keep |
| Site pre-Lighthouse transfer budgets | `tests/site/performance-budget.test.ts` | keep |
| Docs per-route/static budgets | `apps/docs/scripts/verify-static-budget.mjs`, `tests/docs/docs-per-route-ratchet.test.mjs` | keep |
| Deploy headers/policy/rollback | `tests/docs/deployed-headers.test.mjs`, `docs/operations/deployment-and-rollback.md` | keep |

## Baseline Replacement Protocol

Use **surgical baseline rotation**, not blanket `test:visual:update` on the first pass.

Protocol:

1. Land one seam phase at a time.
2. Run `pnpm run build`.
3. Run narrow visual slice first:
   - site: `pnpm exec playwright test --project=chromium tests/visual/site/`
   - docs: `pnpm exec playwright test --project=chromium tests/visual/docs/`
4. Inspect diff set by fixture ID, not by pixel count alone.
5. Update only intended fixtures.
6. Immediately rerun:
   - affected visual slice
   - `tests/visual/accessibility-modes.spec.ts`
   - `tests/visual/task-outcomes.spec.ts`
   - relevant `tests/site/*` or `tests/docs/*`
7. Run full `pnpm run test:visual`.
8. Run full `pnpm run test`.

Rules:
- do not accept baseline churn on untouched surface
- do not rotate Chromium baselines until semantic/static gates are green
- Firefox/WebKit remain semantic journey authorities only; never add their screenshots as rollout evidence
- if M-only phase changes D baselines, or D-only phase changes M baselines, stop and diagnose shared token/shell bleed

Expected baseline churn set today:
- site: `M01`, `M02`
- docs: `D00`, `D01`, `D01-vi`, `D02`, `D03`, `D06`, `D11`, `D12`, `D14`, `D15`, `D16`, `D17`, `D18`

No baseline authority exists today for D04/D05/D07/D08/D09/D10/D13. Their authority remains structural/native tests, not screenshots.

## Performance Budget Handling

Recommended rule: **budget first, visual second** on docs shell work.

Why:
- current docs budgets are already explicit and live at `308000` bytes total transfer cap
- ratchet manifest currently has **zero grandfathered routes**
- any new over-cap route is an immediate contract failure, not a “we’ll ratchet later” situation

Handling:
- treat `tests/benchmarks/performance-budgets.json` + `tests/benchmarks/docs-per-route-ratchet.json` as frozen authority
- never widen a cap just to match screenshots
- if a visual reinvention threatens the docs cap, first remove bytes from:
  - duplicated shell markup
  - unnecessary client JS
  - repeated SVG/diagram prose
  - decorative non-load-bearing assets
- only if the user explicitly approves a cap change should `performance-budgets.json` move

Specific hotspots:
- docs tight route history is `vi/*/concepts/graph-execution/`
- reference/search changes can also hit `search-index-en-compressed` and `search-index-vi-compressed`
- marketing budgets are generous relative to current observed values; docs are the real risk

## Feature Flags and Rollback Seams

Best seam model for this repo:

| Seam | Why |
|---|---|
| token generation | shared site/docs visual change, zero URL/topology effect |
| Astro site deploy unit | marketing rollback without docs rollback |
| docs static export unit | docs rollback without edge rollback |
| edge deploy unit | only for topology/header/apex cutover, not visual-only docs/site edits |

Do not introduce runtime flags for public UX if they require JS/server branching. Static-export + no-JS posture makes build-time seams safer than runtime flags.

Safer rollout shape:
- build-time branch or commit seam for tokens
- deploy docs first when docs changed
- deploy edge only when topology/site asset host behavior changed
- rollback by workflow plan, never by ad hoc manual re-upload

## Stress Routes and Viewports

Keep these mandatory:

| Route/fixture | Widths | Why |
|---|---|---|
| `M01` | `320`, `375`, `768`, `1280`, `1440` | marketing macro sections + CTA first-view proof |
| `M02` | `320`, `768`, `1440` | recovery page integrity |
| `D01-vi` | `320`, `375`, `768`, `1280`, `1440` | i18n chrome parity and copy expansion risk |
| `D06` | `320`, `375`, `768`, `1280`, `1440` | tightest docs budget and flagship topology |
| `D12` | `320`, `375`, `768`, `1280`, `1440` | reference density + search/orientation |
| `D14` | `320`, `375`, `768`, `1280`, `1440` | wide comparison/table pressure |
| `D15` | `320`, `768`, `1440` | generated catalog density |
| `D17` | `320`, `768`, `1440` | print + release metadata correctness |
| `D18` | `320`, `768`, `1440` | no-JS recovery and 404 actionability |

Keep stress frame authority from manifest:
- `S1-cli-320`
- `S2-providers-320`
- `S3-cli-desktop`
- `S4-vi-journey`

## Stop / Replan Signals

Immediate stop:
- any proposal needs silent weakening of `tests/site/*`, `tests/docs/*`, `tests/tokens/*`, or critical Playwright semantic tests
- any budget cap increase is suggested without explicit user approval
- logo or favicon binaries would change
- public URLs or static output topology would change
- docs shell requires runtime-only state with no static/no-JS fallback
- deploy/rollback order changes from `docs -> edge` / `edge -> docs`

Replan before continuing:
- visual diff spills into both site and docs from a supposedly isolated phase
- VI parity fails while EN still passes
- generated references require search index tokenization changes that threaten `160000` partition caps
- docs baseline churn appears on unmodified fixtures because shared tokens changed too broadly
- D06 or D12 becomes the new budget wall after shell changes
- Lighthouse accessibility dips below `95` on audited routes

## Recommendation

Ship the reinvention in **four code phases plus one qualification/deploy phase**:

1. tokens
2. marketing
3. docs shell + authored screens
4. generated references
5. qualification + deploy

This is the only option that fits the repo’s architecture:
- Astro site and static Next docs are independently testable/deployable
- existing tests already encode rollback-safe seams
- screenshot churn stays diagnosable
- no-JS/i18n/perf regressions remain attributable

Rejected:
- whole-site one-shot redesign with one giant snapshot rotation
- cap changes as the primary escape hatch
- runtime feature flags that bypass static/no-JS guarantees

## Limitations

- I did not run the suites; this is repo-evidence analysis only.
- I did not inspect current built artifact bytes directly beyond the checked-in contract files.
- `docs/decisions/docs-performance-baselines.md` is partially stale relative to live JSON/test authority; recommendation assumes live contracts win.

## Unresolved Questions

- Should the stale prose in `docs/decisions/docs-performance-baselines.md` be reconciled now, or intentionally deferred until after the redesign lands?
- Does the user want D04/D05/D07/D08/D09/D10/D13 added to visual baseline coverage in this reinvention, or should they remain semantic/native-only authorities?
- Is a docs-only deploy expected during the migration window, or will rollout wait for a joint docs+site qualification?

Status: DONE
Summary: Produced a phase-by-phase migration and verification strategy with explicit authority tests, baseline-rotation rules, budget handling, rollback seams, stress routes/viewports, and stop/replan triggers. Flagged one important contract inconsistency: live JSON/tests enforce a 308000-byte docs cap while the older decision doc still narrates earlier values.
Concerns/Blockers: Decision-doc drift around docs performance budgets should be treated as stale narrative until reconciled; do not use it as rollout authority.
