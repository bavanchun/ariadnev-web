# Phase 5 slice 13 — deterministic generation, run twice, byte-for-byte

No drift found; no source change needed.

## What ran twice, independently, and was diffed byte-for-byte

1. **Content generation** (`node scripts/docs-content/build-content-root.mjs
   --out <scratch-a> --authored apps/docs/content/authored` vs an
   independent `<scratch-b>` run against the same pinned release bundle):
   278 pages each, identical `bundleDigest`. `diff -rq
   <scratch-a>/generated <scratch-b>/generated` — zero differences across
   every generated `.mdx` file and `catalog.json`.
2. **Search index build** (`scripts/build-search-index.mjs` pointed at
   `<scratch-a>` then `<scratch-b>` via `ARIADNEV_DOCS_CONTENT_ROOT`, each
   run's `out/search/` moved aside before the next): `diff -rq` on the two
   `en/*.json` + `vi/*.json` partition trees — zero differences (full
   6-partition scale, not just the unit-fixture scale
   `search-isolation.test.mjs` already covers).
3. **Static discovery export** (`exportStaticDiscovery`) — already covered
   at the unit-fixture level by `tests/docs/static-discovery.test.mjs`'s
   existing "discovery export writes deterministic physical Markdown and
   bounded LLM files" test, which runs two independent exports into two
   output roots and asserts every written file's bytes match; this test
   passed with the slice 10/11 changes in place (56/56 `test:docs` pass).

Content generation and search indexing are the two stages this phase's
slices 10-11 touched; both are confirmed byte-for-byte stable at full
release-bundle scale, not just fixture scale.

## Known, pre-existing, non-renderer non-determinism — not touched

The Next.js production build (`next build --webpack`) itself carries
documented ±1-2 byte jitter across clean rebuilds of an identical source
tree from its own chunk-hash/build-id machinery (see
`docs-per-route-ratchet.json`'s `jitterToleranceBytes: 64`, already
accepted and tolerated for grandfathered ceilings prior to this phase).
This is upstream Next.js/webpack build-artifact non-determinism, not
Markdown/JSON content generation — out of the "renderer" scope this slice
targets, and not something a sort/normalize hack in this codebase could
fix without patching Next.js internals. Per the stop-condition guidance
("determinism drift caused by upstream bundle, not renderer — report, do
not paper over"), this is reported rather than masked; the accepted
`jitterToleranceBytes` tolerance already covers it for the one place it
could affect a frozen budget (grandfathered ceilings, currently empty).

## Verification

`pnpm --filter @ariadnev-web/docs typecheck` clean. `node --test
tests/docs/*.test.mjs` — 56/56 pass. Full `pnpm run build` succeeds.
