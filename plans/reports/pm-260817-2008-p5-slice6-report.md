# Phase 5 slice 6 — D14 provider reference

Commit: `4aaff70`

Registered `D14-provider-reference` in the closed screen registry.
`apps/docs/src/components/reference/provider-reference.tsx` reads the
verified `providers.json` (current edition) or the previous-stable bootstrap
projection (previous edition) directly from the already-extracted content
root — the same trusted artifact `build-content-root.mjs` produces before
`next build` runs — and renders a server-rendered jump nav straight to each
provider's mobile record ahead of the existing comparison-matrix +
per-provider-records body. The generated Markdown is untouched: zero bytes
added to the `en/1.1.0` search partition, which had ~0B headroom per the
slice-5 report.

Verified: `pnpm --filter @ariadnev-web/docs typecheck` clean; `pnpm run
--filter @ariadnev-web/docs build` succeeds (`grandfatheredRoutes: 0`);
`pnpm run test:docs` 54/54 pass; manual inspection of built HTML for both
`en/stable/reference/providers/` and `en/1.0.0/reference/providers/`
confirms the jump nav renders correctly for both editions.
