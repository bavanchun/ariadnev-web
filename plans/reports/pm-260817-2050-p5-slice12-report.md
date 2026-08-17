# Phase 5 slice 12 — re-measure all four Phase 1 performance groups

Re-ran every group after slices 5-11 landed (D14-D17 components, CLI
filter fix, search/discovery dedup) and compared like-for-like against the
frozen caps in `tests/benchmarks/performance-budgets.json` and
`tests/benchmarks/docs-per-route-ratchet.json`. No fixture updated — every
group still passes against its existing frozen cap and no measurement
moved enough to justify a ratchet-down; ratcheting requires an intentional
shrink slice, not build-id jitter.

## Group 1 — compressed transfer by representative route

`node --experimental-strip-types scripts/verify-static-budget.mjs`:
`{"routePathname":"/en/stable/get-started/installation/","total":300138,
"perRouteChecked":444,"grandfatheredRoutes":0}`. Frozen cap
(`capUnderRatchet`) is 304,000; measured 300,138 vs the last-recorded
301,929-300,151 range in prior slice reports — the ±1-2B delta matches the
already-documented build-id/chunk-hash jitter tolerance
(`jitterToleranceBytes: 64`, applied to grandfathered ceilings; here there
are zero grandfathered routes so the observed jitter is well inside the
strict-cap headroom, not a regression). `grandfathered: []` stays empty in
the ratchet manifest — no change needed.

## Group 2 — total output/file count

444 static routes (unchanged from the P5.slice3 grandfather-close-out
note). `pnpm run test:docs` — `docs-per-route-ratchet.test.mjs` and
`static-discovery.test.mjs` both pass, including the byte-identical
double-export determinism check and the two new slice 10/11 regression
tests. Route count and output file set are stable.

## Group 3 — search/discovery bytes/cardinality

`node --experimental-strip-types scripts/build-search-index.mjs` exits 0
(throws internally if any partition exceeds its cap). Direct measurement:
`en/1.1.0.json` gzip-9 = 159,996B against the frozen 160,000B
`search-index-en-compressed` cap — 4 bytes of headroom, matching the task
brief's stated "0-4B headroom on CLI partition" constraint exactly. The
slice 10 dedup fix (`D13-cli-command-retired` exclusion) does not change
this measurement today because `DEFAULT_RETIRED_ROUTES` is still empty —
it is a forward-looking correctness fix, not a current byte change. `en/
1.0.0.json` (44,886B) and both `vi/*.json` partitions (46,528B/156,935B/
156,409B) stay comfortably under their 160,000B caps.

## Group 4 — route count/build duration/peak memory

`pnpm --filter @ariadnev-web/docs build` (`/usr/bin/time -l`): 14.27s
real, 982,171,648B (≈937MB) maximum resident set size, 444 routes
generated. No prior committed baseline exists in-repo for build
duration/peak memory to ratchet against (Phase 7's Lighthouse/qualification
gates check output correctness and Core Web Vitals, not build-process
resource usage) — recorded here as the current observed measurement; no
regression signal since there is nothing to regress against.

## Verification

`pnpm --filter @ariadnev-web/docs typecheck` clean. `node --test
tests/docs/*.test.mjs` — 56/56 pass. Full `pnpm run build` (all 6
workspace packages) succeeds.
