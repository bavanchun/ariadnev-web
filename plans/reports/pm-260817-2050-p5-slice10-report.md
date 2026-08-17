# Phase 5 slice 10 — search dedup + D12 filter bug fix

## D12 filter bug fix

`ReferenceIndexFilter` walked only `root.children`, expecting `<h3>`/
`<table>` pairs directly under the root. `CliCommandIndexExperience` wraps
each namespace group in a `<div>`, so the filter never found any heading/
table and silently did nothing. Fixed by switching to
`root.querySelectorAll("h3, table")`, which walks matching descendants in
document order regardless of an intermediate wrapper — same pairing logic,
same hide/show behavior, no rewrite of the filter's matching semantics.

## Slice 10 — search dedup

`DEFAULT_RETIRED_ROUTES` is empty today (`packages/contracts/src/
cli-command-registry.ts`), so no live duplicate currently reaches search.
The pipeline was still one rename/removal away from emitting a second
search hit for an already-canonical command: `buildSearchPartition`
indexed every catalog page in a locale/version partition, and a retired
CLI route (`D13-cli-command-retired`) always names the same command a live
`D13-cli-command-detail` page already covers — its body is a thin
replaced/tombstone notice, not command content.

Fixed in `search-index.ts` by excluding `screenKind ===
"D13-cli-command-retired"` pages from the indexed page set. Retired routes
keep their own static HTML/Markdown route (URL compatibility, D12 index
row, detail link) — only the search partition drops them, so "one
canonical command hit per locale/version" holds even once the registry
retires a command.

Added a regression test in `tests/docs/search-isolation.test.mjs`
constructing a catalog with a real command page plus a synthetic retired
sibling that both mention "doctor"; asserts the retired page's id never
enters `envelope.documentIds` and a `"doctor"` query returns zero hits
whose URL contains the retired slug.

## Verification

`node --test tests/docs/*.test.mjs` — 55/55 pass (was 54 before the new
test). `pnpm --filter @ariadnev-web/docs typecheck` clean.
