# Phase 5 slice 11 — static discovery / llms outputs dedup

Same "one canonical command entry" contract as slice 10, applied to the
llms.txt/llms-full.txt curated indexes. A retired CLI route's `stable`
alias route reached `exportStaticDiscovery`'s listing loop (its physical
current-version route was already excluded by the pre-existing
`route.version === catalog.currentStable` skip, but the `stable` alias
route has `route.version === "stable"` and passed through). Added a
second skip for `page.screenKind === "D13-cli-command-retired"` right
after the existing one, so a retired route's thin replaced/tombstone
notice never joins `llms.txt`/`llms-full.txt` — the route's own static
Markdown/HTML export is untouched and still resolves for URL
compatibility, only the curated discovery index drops it.

Route enumeration (`enumerateDocsRoutes`) needed no change: it already
expands every catalog page generically regardless of `screenKind`, so
retired routes keep their physical route and D12 index row/detail link
without any special-casing there.

Added `tests/docs/static-discovery.test.mjs` coverage: builds a catalog
with a synthetic `D13-cli-command-retired` page, exports it, and asserts
its `.md` file is still written (`written.includes(...)`) while neither
`llms.txt` nor `llms-full.txt` mentions it.

## Verification

`node --test tests/docs/*.test.mjs` — 56/56 pass. `pnpm --filter
@ariadnev-web/docs typecheck` clean. Full `pnpm run build` succeeds;
primary route total 300137B, `grandfatheredRoutes: 0`.
