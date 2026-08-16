# Phase 2 — Port the docs platform onto `main`

**Source:** `origin/archive/feat/web-workspace-contracts` (tip `b46cfb5`) — `apps/docs/**`, `tests/docs/**`, `scripts/run-owner-command.mjs`, `scripts/run-node-tests.mjs` if absent on main.
**Files touched on main:** `apps/docs/**`, `tests/docs/**`, `pnpm-lock.yaml`, root `package.json` scripts if needed, `apps/docs/wrangler.docs.toml` (topology expects this path and `apps/docs/out`).

## Steps
1. `git checkout origin/archive/feat/web-workspace-contracts -- apps/docs tests/docs` then diff against `origin/archive/feat/fumadocs-platform` to make sure the WIP commit did not regress anything (it added `docs-content-root.ts` + test hardening).
2. Rename package scope `@vcskill/*` → `@vcskill-web/*` (main's scope); env `VCSKILL_DOCS_CONTENT_ROOT` → `ARIADNEV_DOCS_CONTENT_ROOT`; strings "vcskill" in UI chrome → "ariadnev".
3. Add missing deps to the lockfile with exact versions (`pnpm install` — the workspace pins exact versions; check `.npmrc`).
4. Provide `apps/docs/wrangler.docs.toml` (+ staging variant if the archived `wrangler.staging.toml`/`wrangler.production.toml` split is what topology's `wranglerConfig` should point at — reconcile topology in phase 4, not here).
5. Build with the test fixture content (`tests/docs/contract-fixture.mjs` → `run-temporary-export.mjs`) and run `tests/docs`.
6. Commit: `feat(docs): land the static Fumadocs documentation product`.

## Validation
- `pnpm --filter @vcskill-web/docs typecheck && pnpm exec node scripts/run-node-tests.mjs tests/docs` green.
- `apps/docs/out/en/1.2.3/index.html` exists from the fixture build; `/llms.txt` emitted.
