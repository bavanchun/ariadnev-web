# Fumadocs UI adoption spike

Status: **Skeleton; three shells not yet measured**
Recorded: 2026-08-17
Phase: 1 (contract gate and measurement spike)
Required by: Phase 3 (docs safety and shell)

Sources of record (to be filled after the spike):

- Spike branch: `spike/phase-01-fumadocs` (not yet created)
- [`apps/docs/package.json`](../../apps/docs/package.json) — current Fumadocs pin
- [`tests/benchmarks/performance-budgets.json`](../../tests/benchmarks/performance-budgets.json) — the caps every variant must respect
- [`plans/260816-2345-ariadnev-web-uiux-upgrade/phase-01-contract-gate-and-measurement-spike.md`](../../plans/260816-2345-ariadnev-web-uiux-upgrade/phase-01-contract-gate-and-measurement-spike.md) — the phase this decision closes

## Question

Which shell should Phase 3 rewrite the docs application around?

1. **Current bespoke shell.** Keep what we have. Every localization,
   dark-only, keyboard, no-JS, and static-export contract is proven.
2. **Full Fumadocs `DocsLayout`.** Adopt the framework's opinionated shell
   wholesale; inherit its search UI, sidebar, TOC, and page chrome.
3. **Selective Fumadocs primitives.** Keep the bespoke shell but adopt
   individual primitives (search, TOC, code-block copy) where they measurably
   improve the current implementation without importing the full layout.

Plus a **version-alignment sub-question**: is the Fumadocs MDX 15.2.3 → Core/UI
16.14.3 mismatch officially supported, and does alignment pass every existing
contract?

## Pre-spike stop condition (arithmetic-derived)

The current per-route budget headroom for the *installation* route is
**4,573 bytes compressed** (295,427 / 300,000). More critically, the current
CLI and skills references *already ship over cap* on 10 of 42 measured routes
by 4–13KB apiece (see
[`docs-performance-baselines.md`](./docs-performance-baselines.md)).

Any variant whose shell payload grows the observed **`js=120,565` +
`css=3,525`** by more than the smallest per-route HTML headroom fails the
frozen 300KB cap on multiple routes. **Full `DocsLayout` (variant 2) must
demonstrate an absolute shell-payload delta small enough to bring at least the
6 over-cap `/reference/cli/` routes back under 300KB** or the plan's "stop for
user decision; no silent cap increase" rule applies before the spike is even
finished. This is not a bet; it is arithmetic against measured baselines.

## Stress frames (mandated by the plan)

The spike renders each variant at exactly these four frames:

1. CLI reference at 320px viewport
2. Provider reference at 320px viewport
3. Desktop CLI lookup + orientation
4. Complete VI shell and chrome (locale, language switcher, TOC, breadcrumb)

Per-frame, the spike records:

- Localization: static `<html lang>`, VI strings on every navigation surface
- Dark-only theming: no light-mode leakage
- Keyboard behavior: skip link, focus visibility, sidebar/TOC reachability
- No-JS fallback: navigation and static content usable with JS off
- Static export: passes `next export` under the current `next.config.mjs`
- Per-route transfer: `verify-static-budget.mjs`-equivalent brotli walk
- Implementation surface: LOC delta vs the current shell

## Version alignment sub-experiment

Test the officially supported path (whatever Fumadocs' upgrade docs specify) to
align MDX 15.2.3 with Core/UI 16.14.3. If it passes typecheck + all existing
docs pipeline and shell tests + the four stress frames, align. If any fails,
keep the mixed-major pins with a decision-recorded reason.

## Winner criteria

The smallest shell that:

- passes every stress-frame contract (localization, dark-only, keyboard,
  no-JS, static export)
- does not push any measured route further over the frozen 300KB cap
- does not regress the current bespoke shell's implementation clarity by
  more than a small, justified delta

If no variant clears the bar, keep the bespoke shell and copy proven behavior
selectively — the plan explicitly names this as an acceptable outcome.

## Spike hygiene (per phase risk-list)

- Spike branch is `spike/phase-01-fumadocs`; never merged to `main`.
- Deterministic ports for every spike dev server (recorded in the branch
  README).
- Every PID stopped before the spike concludes.
- Only the contract findings + this decision doc merge back; spike product
  code is removed in Phase 1 sub-step 11.

## Non-goals

- No framework migration beyond a narrow, officially supported version
  alignment.
- No new accent family, ambient loop, decorative body gradient, glow, WebGL,
  or Three.js in any variant.
- No relaxation of the frozen budgets to make a variant fit.
