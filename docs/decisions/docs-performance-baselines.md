# Docs performance baselines and the four independent budgets

Status: **Baselines observed; projected-route measurement pending Phase 1 spike**
Recorded: 2026-08-17
Phase: 1 (contract gate and measurement spike)
Required by: every downstream phase (frozen caps)

Sources of record:

- [`tests/benchmarks/performance-budgets.json`](../../tests/benchmarks/performance-budgets.json) — the frozen budget contract
- [`apps/docs/scripts/verify-static-budget.mjs`](../../apps/docs/scripts/verify-static-budget.mjs) — the per-route walker
- [`apps/docs/out/`](../../apps/docs/out) — the production build measured
- [`plans/260816-2345-ariadnev-web-uiux-upgrade/phase-01-contract-gate-and-measurement-spike.md`](../../plans/260816-2345-ariadnev-web-uiux-upgrade/phase-01-contract-gate-and-measurement-spike.md) — the phase this decision closes

## Four independent budgets, not one

Phase 1 confirmed the plan's four-metric separation is necessary: adding routes
grows *total output*, *search-partition bytes*, and *build cost* without
changing *per-route transfer*, and the four sources of pressure need distinct
caps so no single cap silently absorbs another's growth.

| Group | Metric | Current observation | Frozen cap |
|---|---|---|---|
| Per-route transfer | brotli-compressed HTML+CSS+JS+fonts+images along one route | see route table below | 300000 bytes (`docs-total-transfer-compressed`) |
| Total static output | bytes on disk under `apps/docs/out` | see baseline | none yet |
| Search / discovery | brotli-compressed search partition, en/vi × stable/1.1.0/1.0.0 | see partition table | 160000 bytes each (`search-index-{en,vi}-compressed`) |
| Discovery outputs | `llms.txt` + `llms-full.txt` + per-page `.md` | see baseline | none yet |
| Build cost | route count, wall time, peak memory | see baseline | none yet |

## Per-route transfer, all 42 measured routes

Measurement: sampled every locale × version × plan-mandated route family
(installation, docs home, CLI index, providers, skills, workflows,
release-notes, concept-eval, guide-config) with the same walker logic
`verify-static-budget.mjs` uses. Compression parity: brotli quality 9,
pre-compressed extensions (fonts, images) count raw.

| Metric | Value |
|---|---|
| Routes measured | 42 |
| Max total transfer | **313,235 bytes** (`/{vi,en}/{stable,1.1.0,1.0.0}/reference/skills/`) |
| Min total transfer | 292,950 bytes (`/en/1.0.0/`) |
| p50 total transfer | 295,336 bytes |
| Budget cap | 300,000 bytes |
| **Routes over cap** | **10 of 42** |

**Finding**: `verify-static-budget.mjs` currently enforces the 300KB cap on
`/en/stable/get-started/installation/` alone. The 10 over-cap routes have been
shipping over-cap because the check never visited them:

- all four `/reference/skills/` variants at ~313KB — over by ~13KB
- all six `/reference/cli/` variants at ~304KB — over by ~4KB

This is a **discovered pre-Phase-1 baseline violation**, not a Phase-1-induced
overrun. The plan's "no silent budget increase" rule stands; a Phase 1
follow-on optimization (or an explicit user decision to widen the cap for the
skills+cli reference routes) must land before Phase 3 begins.

Every measured route shares the same shell payload budget consumption:
`js=120,565`, `css=3,525`, `fonts=159,432`, `images=5,876`, `html=variable`.
The over-cap routes exceed cap purely on HTML size — 14–23KB of route-specific
markup vs the 4–6KB the smaller pages emit. Compression on HTML for the
reference indexes therefore governs the frozen-cap decision.

## Total static output

| Metric | Value |
|---|---|
| Files under `apps/docs/out` | 447 |
| HTML routes (index.html) | 70 |
| Markdown discovery outputs | 66 |
| Search partitions | 6 (2 locales × 3 versions) |
| llms.txt | 6,219 bytes |
| llms-full.txt | 200,964 bytes |

Route breakdown by locale/version:

| Locale/version | HTML routes |
|---|---|
| `en/stable`, `vi/stable` | 15 each |
| `en/1.1.0`, `vi/1.1.0` | 15 each |
| `en/1.0.0`, `vi/1.0.0` | 3 each |
| `_not-found` + `404` | 1 each |

## Search partition bytes

| Partition | Bytes | Cap | Headroom |
|---|---|---|---|
| `en/stable`, `en/1.1.0` | 588,277 (uncompressed) → observed compressed 124,960 in baselines JSON | 160,000 compressed | ~35,040 (~28%) |
| `vi/stable`, `vi/1.1.0` | 548,171 → observed compressed 121,535 | 160,000 compressed | ~38,465 (~32%) |
| `en/1.0.0` | 120,300 (uncompressed) | 160,000 compressed | comfortable |
| `vi/1.0.0` | 122,857 | 160,000 compressed | comfortable |

The observed compressed values were recorded on 2026-08-16 when the cap moved
from 120k → 160k (rationale in `performance-budgets.json`). Adding 318
command-detail pages will grow the search partitions; **the exact projected
increase is deferred to task #7 (Phase 1 sub-step 8)** because it depends on
the safe-component decision and how much command-page prose the indexer
tokenizes.

## Route arithmetic (projected)

53 current + 53 historical commands, no aliases, no cross-edition slug drift:

- Current-edition command routes: 53 × 2 locales × 2 versions[`stable`+`1.1.0`] = **212**
- Historical-edition command routes: 53 × 2 locales × 1 version[`1.0.0`] = **106**
- **Total new HTML routes: 318**
- **Total new Markdown discovery outputs: 318**

This lands squarely inside the plan's projected `+212 to +530` range: 212 if
historical is dropped, 318 with historical retained. Historical retention is
locked scope in the plan, so 318 is the working number for Phase 1 sub-step 8.

## Build cost baseline

Deferred to task #7. A production build's wall time and peak memory can only
be measured meaningfully during the spike (task #7 loops `build-content-root.mjs`
with the projected +318 pages injected); today's steady-state build number
would not reflect the pressure the plan is testing for.

## Stop conditions

- **Route transfer**: any viable shell variant exceeds 300KB per route after
  optimization. Stop for user decision; no silent cap increase, no scope cut.
  **The 10 currently over-cap routes are a pre-existing state that must be
  resolved before Phase 3 begins**, either by optimization or by an explicit
  user decision to widen the cap for reference routes.
- **Total output / build cost**: unresolvable growth after optimization and
  CI sharding. Historical scope stays; unresolved cost blocks Phase 1.
- **Search partitions**: cross 160,000 compressed on any partition. First
  response is to compress the tokenizer output further (drop stop-word
  variants, deduplicate common substrings); if still over, revisit whether
  command aliases should be indexed at all (currently they aren't, because
  aliases are empty in the release).

## Non-goals

- No cap change without an explicit user decision, per plan text.
- No baseline extension to include Lighthouse LCP/INP/CLS in this decision —
  those live in `performance-budgets.json` already and are outside Phase 1
  scope.
