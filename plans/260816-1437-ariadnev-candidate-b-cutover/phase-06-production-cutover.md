# Phase 6 — Production cutover, bridge retirement, records

**Depends on:** 5. Outward-facing: each step below that mutates production is confirmed with the user before running.

## Ordered steps
1. `deployment/inputs/production-ariadnev-1.0.0.json` (same productSha as the qualified staging input); commit.
2. Capture bridge state: `wrangler deployments list --name ariadnev-bridge` → record id in the cutover notes.
3. **Docs unit** first: `deploy.yml` production (approval) — but the edge unit will fail on the apex Custom Domain while the bridge still owns it. So the input for the first production run is `units: [docs]` only; verify `docs.ariadnev.com`.
4. **Edge unit**: deploy `ariadnev-edge` to production **without** the apex bound (config profile with `routes = []`), set `GH_TOKEN`, smoke on `ariadnev-edge.<account>.workers.dev`.
5. Swap the apex: delete the `ariadnev-bridge` Worker (`wrangler delete --name ariadnev-bridge`) → Custom Domains released; immediately `wrangler deploy` the edge with the production config that binds `ariadnev.com` + `www`. Expected gap: seconds. Verify all machine routes + `/`.
6. `verify-convergence.mjs` production; `write-cutover-record.mjs`; commit the record pointer.
7. `topology.json`: `interim.host` → `retiredAt: <date>`, `servedBy: ariadnev-edge`; decision record addendum in `docs/decisions/ariadnev-bridge-and-legacy-redirect.md`; README "Legacy runtime" paragraph now says the cutover shipped and the rollback window is open; journal entry.
8. `verify-soak.mjs` for the agreed window; legacy decommission (302→301, delete `vcskill` Worker) is a later, separate decision.

## Rollback
- Before step 5: nothing public changed; `rollback.yml` per unit.
- After step 5: `wrangler deploy --config workers/bridge/wrangler.toml` restores the bridge on the apex in one command (its `GH_TOKEN` must be re-set); or first-cutover rollback restores the legacy binding map per topology.
