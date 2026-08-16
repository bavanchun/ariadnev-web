# Docs performance baselines and the four independent budgets

Status: **Baselines observed; projected-route measurement pending Phase 1 spike**
Recorded: 2026-08-17
Phase: 1 (contract gate and measurement spike)
Required by: every downstream phase (frozen caps)

Sources of record:

- [`tests/benchmarks/performance-budgets.json`](../../tests/benchmarks/performance-budgets.json) — the frozen budget contract
- [`tests/benchmarks/docs-per-route-ratchet.json`](../../tests/benchmarks/docs-per-route-ratchet.json) — the ratchet-down-only grandfather list (2026-08-17)
- [`apps/docs/scripts/verify-static-budget.mjs`](../../apps/docs/scripts/verify-static-budget.mjs) — the per-route walker (now walks every enumerable route)
- [`tests/docs/docs-per-route-ratchet.test.mjs`](../../tests/docs/docs-per-route-ratchet.test.mjs) — manifest schema + file-existence integrity
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

**Finding**: `verify-static-budget.mjs` previously enforced the 300KB cap on
`/en/stable/get-started/installation/` alone. The 10 over-cap routes have been
shipping over-cap because the check never visited them:

- all four `/reference/skills/` variants at ~313KB — over by ~13KB
- all six `/reference/cli/` variants at ~304KB — over by ~4KB

This is a **discovered pre-Phase-1 baseline violation**, not a Phase-1-induced
overrun.

### Ratchet guard (landed 2026-08-17)

`verify-static-budget.mjs` now walks every route `enumerateDocsRoutes(catalog)`
returns (66 today) instead of only `installation`. Ten routes are grandfathered
at their measured 2026-08-17 values in `tests/benchmarks/docs-per-route-ratchet.json`.
Policy is **ratchet-down-only**: a future build that grows any grandfathered
route above its ceiling fails the same way a non-grandfathered route failing
the 300000 cap does. Silence is over; regression is impossible without an
explicit ratchet-file edit that the code review process will catch.

The frozen `docs-total-transfer-compressed` cap is unchanged at 300000. The
grandfather list is a temporary enforcement device, not a cap change, and
lives in its own file so nothing in `performance-budgets.json` moved.

### Shrink criterion (PENDING FORK — awaiting user decision)

The recommended fork amends the earlier "must land before Phase 3 begins"
language to **"must land before Phase 3 completes"**. Rationale:

- The shell payload is a constant 289,398 bytes compressed
  (`js=120,565 + css=3,525 + fonts=159,432 + images=5,876`). Per-route HTML
  headroom against 300000 is ~10,600 bytes.
- Shrinking the reference-index HTML alone cannot recover the over-cap routes;
  the levers are **fonts subsetting** and **JS bundle reduction** — both
  squarely Phase 2/3 shell-rewrite work.
- The ratchet guard means nothing worsens in the interim. An entry criterion
  would force optimizing markup that Phase 5's regenerator throws away.
- A cap widening (an explicit user decision that lands in
  `performance-budgets.json` first) remains available as a fallback if shell
  shrink demonstrably cannot reach the frozen cap.

If accepted, the "Stop conditions" section below reads "unresolved after
Phase 3 completion" instead of "before Phase 3 begins." Not applied yet:
the caller stopped for user go-ahead per the "no silent stop-condition edit"
rule. Task tracker item `P1.L`.

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
locked scope in the plan.

## Projected +318 route cost (Phase 1 sub-step 8, spike measurement)

Measured 2026-08-17 on the current build via a spike script that reads the
per-doc unit cost of every search partition and multiplies against the
318-route arithmetic. Three worst-case indexer-tokenization strategies were
compared per partition against the frozen 160,000 byte search cap:

| Partition | + 53 docs FULL prose | + 53 docs HALF (title+desc+options) | + 53 docs MIN (title+desc+aliases) |
|---|---|---|---|
| en/stable | 381,436 (OVER by 221k) | 232,788 (OVER by 73k) | **113,870 (under by 46k)** |
| en/1.1.0 | 381,558 (OVER by 222k) | 232,863 (OVER by 73k) | **113,907 (under by 46k)** |
| en/1.0.0 | 293,944 (OVER by 134k) | 154,845 (under by 5k) | **43,567 (under by 116k)** |
| vi/stable | 355,814 (OVER by 196k) | 217,151 (OVER by 57k) | **106,221 (under by 54k)** |
| vi/1.1.0 | 356,050 (OVER by 196k) | 217,295 (OVER by 57k) | **106,291 (under by 54k)** |
| vi/1.0.0 | 299,710 (OVER by 140k) | 157,883 (under by 2k) | **44,421 (under by 116k)** |

**MANDATORY constraint**: command detail pages **must be indexed with the MIN
strategy** (title + description + aliases only, NO full-prose tokenization).
Every other tokenization strategy busts at least the two `/stable/` partitions
by tens of KB. This falls out of Phase 5's generated-reference build: the
indexer differentiates by `pageKind: "command"` and switches its extraction
policy accordingly.

**Per-route transfer for one command detail page**:

- Shell payload constant: **289,398** bytes compressed
- Detail HTML (title header + one command's fragment + navigation): **~2,337**
- Projected total per route: **291,735** bytes compressed
- Headroom vs 300,000 cap: **8,265 bytes**

This clears the cap but is tight. Any per-page JS/CSS added by the
safe-component decision (see
[`docs-catalog-and-safe-components.md`](./docs-catalog-and-safe-components.md))
must fit inside the 8,265-byte headroom or the command detail routes join the
ratchet's grandfather list.

**Output byte growth (unbounded, no cap today)**:

- Current 66 MD files: 361,064 raw / 127,992 compressed (avg 5,471 / 1,939)
- Worst-case +318 MD @ full-size: +1,739,778 raw / ~+617k compressed
- Projected total MD output: ~2.1 MB raw / ~745 KB compressed. Acceptable.

**Build cost**: not directly measured; route count 66 → 384 (5.8x). MDX
compilation is the load-bearing step. A full-build wall-time measurement is
deferred to Phase 5 where the actual command-detail rendering path lands and
the number reflects real work, not a projected loop.

## Build cost baseline

Deferred to task #7. A production build's wall time and peak memory can only
be measured meaningfully during the spike (task #7 loops `build-content-root.mjs`
with the projected +318 pages injected); today's steady-state build number
would not reflect the pressure the plan is testing for.

## Stop conditions

- **Route transfer**: any viable shell variant exceeds 300KB per route after
  optimization. Stop for user decision; no silent cap increase, no scope cut.
  **The 10 currently over-cap routes are held under the ratchet guard**; the
  recommended amendment above defers final shrink to Phase 3 completion.
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
