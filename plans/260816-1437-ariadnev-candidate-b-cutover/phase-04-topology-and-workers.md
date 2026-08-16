# Phase 4 — Retarget topology and Worker configs to ariadnev hosts

**Depends on:** 1, 2.
**Files:** `deployment/topology.json`, `workers/edge/wrangler.combined*.toml`, `workers/edge/src/github-release.js` (`REPO`), `workers/edge/rules/*.json`, `apps/docs/wrangler.docs*.toml`, `scripts/deploy/*.mjs` (only host/name constants), `tests/deployment/**`, `tests/contracts/public-edge-contracts.json`, `README.md`, package scope rename `@vcskill-web/*` → `@ariadnev-web/*`.

## Requirements
- `environments.staging` → `https://staging.ariadnev.com` / `https://staging.docs.ariadnev.com`; `production` → `https://ariadnev.com` / `https://docs.ariadnev.com`. Keep `production.legacyWorker` exactly as is (frozen).
- Unit worker names: `ariadnev-docs[-staging]`, `ariadnev-edge[-staging]`.
- Edge Worker: `REPO = "bavanchun/ariadnev-kit"` (no rename-redirect dependency, same as the bridge), `versionFromReleaseTag` strips `ariadnev@`; production config binds `ariadnev.com` + `www.ariadnev.com` as Custom Domains, `run_worker_first = true`, `[assets] directory = "../../apps/site/dist"` (topology says `apps/site/dist`; the current file says `../../dist/site` — reconcile to one).
- Ingress rule policy targets the `ariadnev.com` zone.
- Interim block: mark `host.retireAt` unchanged; add `retirementProcedure` pointer to phase 6.
- Contract tests updated to the new hosts; the frozen `landing-consistency.test.mjs` untouched.

## Validation
- `pnpm run contracts` + `pnpm run test:qualification` green.
- `wrangler deploy --dry-run --config workers/edge/wrangler.combined.production.toml` and the docs config validate.
