# CLI command identity, canonical slug, and retired-route policy

Status: **Accepted**
Recorded: 2026-08-17
Phase: 1 (contract gate and measurement spike)
Required by: Phase 3 (docs safety and shell), Phase 4 (authored docs), Phase 5 (generated reference experience)

Sources of record:

- [`packages/contracts/src/cli-command-contract.ts`](../../packages/contracts/src/cli-command-contract.ts) — types, derivations, `assertCommandContract`
- [`packages/contracts/src/cli-command-registry.ts`](../../packages/contracts/src/cli-command-registry.ts) — the repository-owned override + retired-route table
- [`packages/contracts/src/cli-command-contract.test.ts`](../../packages/contracts/src/cli-command-contract.test.ts) — 62 vitest cases proving derivations, collision policy, and the 106-record bundle round-trip
- [`apps/docs/content/generated/bundle/reference/cli/commands.json`](../../apps/docs/content/generated/bundle/reference/cli/commands.json) — the release-shipped command surface (53 records for 1.1.0)
- [`apps/docs/content/generated/bundle/reference/previous-stable/bootstrap.json`](../../apps/docs/content/generated/bundle/reference/previous-stable/bootstrap.json) — the historical projection (53 records for 1.0.0)
- [`scripts/docs-content/render-reference-pages.mjs`](../../scripts/docs-content/render-reference-pages.mjs) — the current CLI reference renderer whose fragment IDs must keep resolving

## Decision

Command identity is **repository-owned** through a committed registry keyed by
each command's source path (the release-bundle `path` field, e.g.
`"ariadnev adapters regenerate"`).

- `commandId` is stable across releases. When the registry does not override it,
  identity is derived as `cmd:<canonicalSlug>` so it is textually distinct from
  the URL slug and cannot be confused with one.
- `canonicalSlug` is derived from the source path by dropping the leading binary
  segment (`ariadnev`) and folding non-alphanumerics to dashes. The root command
  (`path: "ariadnev"`) keeps its literal name because it IS the binary. A
  registry entry may override the derived slug to disambiguate future collisions
  or preserve a pre-rename URL.
- `legacyAnchors` always includes the anchor emitted by the current
  `render-reference-pages.mjs` renderer (the whole path folded, e.g.
  `ariadnev-adapters-regenerate`). Later shell rewrites MUST keep emitting this
  anchor as a visible index target on `/reference/cli/`. Registry-added anchors
  are appended when a renderer change would otherwise lose a live fragment link.
- `aliases` are metadata. They participate in search relevance and command-page
  copy, and they NEVER become extra routes.
- Retired routes go in a separate map keyed by the OLD slug that must still
  resolve. Each entry is either `replaced` (points at the current
  `commandId` + live `canonicalSlug`) or `tombstone` (short reason). Removing an
  entry from either map is a public URL change and needs a separate decision.
- Every collision (slug, `commandId`, legacy anchor, alias, retired-route
  clash with a live slug, replaced route whose target is not live) is a hard
  test failure in `assertCommandContract`, never a warning.

## Why this shape, not upstream `commandId`

The release bundle currently ships neither a `commandId` nor any alias for any
command:

```
CURRENT 1.1.0:              total=53, collisions=0, alias-count=0
HISTORICAL projection 1.0.0: total=53, collisions=0, alias-count=0
slug delta across editions:  added=0, removed=0, shared=53
```

There is nothing upstream to trust as immutable identity. Waiting for the
release side to add one would either (a) hold Phase 3+ indefinitely, or (b)
force us to invent identity anyway and then reconcile — the same registry, one
migration later. Pinning the anchor in this repository now costs nothing and
lets every downstream phase reason about identity as if it were upstream.

The 53-record cross-edition overlap is complete today, so `DEFAULT_COMMAND_REGISTRY`
and `DEFAULT_RETIRED_ROUTES` both start empty. Every entry that later appears
in either map is a first-class code review event.

## Why alias-as-metadata, not extra routes

Two reasons.

1. **Route cardinality already stresses the docs.** The exact route arithmetic
   with the confirmed 53×2 surface produces 318 new command-detail HTML pages
   (`53 × 2 locales × 2 versions[stable+1.1.0] + 53 × 2 × 1[1.0.0]`) plus 318
   matching Markdown discovery outputs. Every alias promoted to a route would
   multiply that by the alias fanout. The plan's frozen 300KB per-route budget
   and 160KB search-partition cap have no headroom for the multiplication.
2. **Search relevance is stronger than URL variety.** Aliases as search-index
   metadata answer a reader's `av regen` query with the canonical detail page.
   Aliases as URL variants would fragment inbound links and, per contract,
   force one of the aliases to be canonical anyway.

## Why the anchor derivation matches the current renderer

`render-reference-pages.mjs#anchor` folds `text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")`.
`deriveLegacyAnchor` in the contract is byte-identical. This means every
existing fragment link into `/reference/cli/` (documentation, blog posts,
external references from the release notes and skill catalog) keeps 200-resolving
after the Phase 3 shell rewrite, without a JavaScript redirect layer and
without a mapping table. Renaming this derivation in `render-reference-pages.mjs`
without a compensating registry entry is a public URL break that the contract
test will surface.

## Stop conditions

- A future release introduces upstream `commandId` — reconcile by keeping
  `commandId` as-is where the two agree and using the registry as a rename
  table where they disagree. Do not silently swap semantics.
- A source rename produces a canonical-slug collision the derivation cannot
  resolve — register an override and record why in a comment on the entry.
- The retired-route map reaches ~50 entries — revisit whether the whole
  identity scheme should live in the release side (still zero today).

## Non-goals

- No per-alias route.
- No JavaScript redirect for legacy anchors — they remain visible DOM anchors on
  the aggregate CLI reference page.
- No global-sidebar entry for a command detail page — command pages use
  `navigationVisibility: "reference-only"` in the catalog (see
  [`docs-catalog-and-safe-components.md`](./docs-catalog-and-safe-components.md)).
