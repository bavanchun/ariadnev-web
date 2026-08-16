---
phase: 4
title: "Generated reference experience"
status: pending
priority: P1
effort: "5-7d"
dependencies: [1, 2]
---

# Phase 4: Generated reference experience

## Overview

Ship the CLI reference as a compact searchable index plus one canonical detail
page per command, the provider reference through a responsive-table primitive,
and the workflow reference through an execution-map primitive with a textual
fallback. Every URL and slug comes from Phase 1's command identity contract;
this phase never invents an identity of its own.

## Requirements

- Functional: (a) `/reference/cli/` becomes a summary index with legacy
  anchors preserved as visible in-page targets that link to canonical detail
  URLs — **no JavaScript redirects**; (b) `/reference/cli/<slug>/` exists for
  every command in the current stable and (per Phase 1's historical policy)
  in every previous stable that carries it; (c) provider tables use the
  `<ResponsiveTable>`/`<CompatibilityMatrix>` primitives from the primitive
  set introduced in this phase; (d) workflow reference gains a compact
  execution-map primitive with an ordered textual `<figcaption>` fallback;
  (e) authored guides adopt the same primitives via mechanical replacement,
  no content rewrite.
- Non-functional: bundle contract untouched; generated MDX still passes
  `public-markdown.ts` (no HTML, no images, no JSX in the body except
  registered primitives, no H1); build determinism preserved; command detail
  pages stay out of the global sidebar (the brainstorm's rule) so
  navigation noise does not multiply; static output stays within the budget
  decision from Phase 1's spike.

## Architecture

**Primitives.** A closed component set under
`apps/docs/src/components/prose/`, importable from authored MDX and emitted
as MDX shortcodes by generated pages. Each primitive is server-safe unless
it demonstrably needs interaction; `<ResponsiveTable>` is CSS-only. Names:
`<Callout kind="info|warn|gate">`, `<Procedure>` + `<Step>`,
`<CommandBlock cmd="…">`, `<ResponsiveTable>` (horizontal scroll shell +
sticky header), `<OptionRow>` for CLI/API options, `<NextSteps>` +
`<NextStep>`, `<CompatibilityMatrix>`, `<WorkflowMap>`. Register in
`mdx-components.tsx` so the allowlist stays authoritative.

**CLI generator.** `renderCliReference` splits into `renderCliIndex(locale,
commands)` and `renderCliCommand(locale, command)`. Both consume the Phase
1 contract record — not the raw bundle string — so slug and legacy anchors
are the same authority as the tests. The index summarizes: name,
description, aliases, link to detail page, and legacy anchor id (so the
old `#av-install`-style fragments still land on visible targets). The
detail page repeats title, description, arguments, options, aliases from
the bundle.

**Legacy anchor preservation (brainstorm rule).** The index page keeps
every historical anchor as a real DOM id on a visible line. That line is
the command's row: `#av-install → av install → Full reference`. Deep links
from the old world land on a visible target that points at the new detail
page. No client-side redirect.

**Historical projection (brainstorm rule).** For each previous stable, the
generator emits detail pages whenever the historical bundle contains the
command. Aliases stay as searchable metadata and legacy anchors — not
extra canonical routes.

**Provider + workflow.** Provider tables wrap in `<ResponsiveTable>` and,
where a matrix is more scannable, `<CompatibilityMatrix>`. Workflow
reference emits a compact SVG topology per graph plus an ordered textual
list as `<figcaption>` (the accessibility pattern the marketing execution
map already uses).

## Related Code Files

- Create: `apps/docs/src/components/prose/callout.tsx`
- Create: `apps/docs/src/components/prose/procedure.tsx`
- Create: `apps/docs/src/components/prose/command-block.tsx`
- Create: `apps/docs/src/components/prose/responsive-table.tsx`
- Create: `apps/docs/src/components/prose/option-row.tsx`
- Create: `apps/docs/src/components/prose/next-steps.tsx`
- Create: `apps/docs/src/components/prose/compatibility-matrix.tsx`
- Create: `apps/docs/src/components/prose/workflow-map.tsx`
- Modify: `apps/docs/src/mdx-components.tsx` — register primitives; the
  `public-markdown` allowlist is extended by exact name only
- Modify: `scripts/docs-content/render-reference-pages.mjs` — split CLI
  renderer, consume Phase 1 contract, emit index + per-command pages for
  current stable and every historical stable that carries the command
- Modify: `scripts/docs-content/build-content-root.mjs` — iterate contract
  entries when adding CLI pages to the catalog; keep entries out of the
  global sidebar (`navigationVisibility: "reference-only"` from contract)
- Modify: `apps/docs/src/lib/public-markdown.ts` — extend allowlist by
  exact component name (defensive; primitives must still be side-effect
  free MDX shortcodes)
- Modify: `apps/docs/content/authored/**/*.mdx` — mechanical replacement of
  ad hoc tables and step lists with primitives in guides that already
  contain them
- Modify: `tests/docs/content-pipeline.test.mjs` — assert (a) command
  index + per-command pages exist for both locales at current stable, (b)
  every legacy anchor from Phase 1's map exists as a real DOM id on the
  index page, (c) each generated MDX still passes `public-markdown`,
  (d) determinism preserved, (e) previous-stable pages present exactly
  where the historical bundle carries the command
- Modify: `tests/docs/*` — per-primitive unit tests; 320px overflow test
  on provider and one CLI command page

## Implementation Steps

1. **Primitive skeletons.** Ship each primitive with its markup, ARIA, and
   token consumption from Phase 2. Prove `<ResponsiveTable>` clears the
   audit's provider overflow at 320px in JSDOM before wiring the renderer.
2. **Register in `mdx-components.tsx`** so generated MDX resolves shortcodes
   without imports. Extend `public-markdown` allowlist by exact name.
3. **CLI split — renderer.** Refactor `renderCliReference` into
   `renderCliIndex(locale, commands)` and `renderCliCommand(locale,
   command)`. Both take a *contract record*, not a bundle string. Index
   preserves every legacy anchor as a visible target.
4. **CLI split — catalog + sidebar rules.** Emit one catalog entry per
   command detail page under `reference/cli/<slug>/`; preserve
   `reference/cli` as the index. Command detail pages carry a catalog
   flag that keeps them out of the global sidebar (the brainstorm's rule).
5. **Historical projection.** For each previous stable in the release
   bundle, generate detail pages for every command the historical source
   contains. Do not invent siblings. Aliases remain search + anchor only.
6. **Provider + workflow.** Rewrite provider tables through
   `<ResponsiveTable>` + `<CompatibilityMatrix>`; wrap workflow reference
   tables in `<WorkflowMap>` with ordered textual fallback.
7. **Authored content sweep.** Update guides that already have tables or
   numbered steps to use primitives — mechanical, no content rewrite.
8. **Byte-budget check.** Re-measure `apps/docs/out` bytes against Phase 1's
   spike numbers. If the number diverges, update the decision doc; do not
   silently exceed the cap.
9. **Tests.** Extend `content-pipeline.test.mjs` for the new catalog shape;
   add unit tests per primitive; add a 320px overflow test on provider and
   one CLI command page; assert legacy anchors resolve.

## Success Criteria

- [ ] `apps/docs/content/generated/docs/en/1.1.0/reference/cli/` and
      `/vi/1.1.0/reference/cli/` contain `index.mdx` plus one file per
      command; catalog carries matching entries.
- [ ] For every historical stable, detail pages exist exactly where the
      bundle carries the command; no invented siblings.
- [ ] Every legacy `#anchor` from Phase 1's map exists as a real DOM id
      on the index page and links to the canonical detail page — verified
      by test, no JavaScript redirect required.
- [ ] Command detail pages are absent from the global sidebar; only the
      index appears in Reference navigation.
- [ ] Every provider table renders without horizontal scroll at 320px
      inside `<ResponsiveTable>`.
- [ ] Every primitive is registered in `mdx-components.tsx` and covered by
      a unit test.
- [ ] Generated MDX still passes `public-markdown` (no JSX in body except
      registered primitives).
- [ ] Determinism test passes; same inputs produce byte-identical output.
- [ ] Re-measured static bytes match Phase 1's budget decision, or the
      decision doc is updated with owner sign-off.
- [ ] `pnpm run test:qualification` green.

## Risk Assessment

- **Registered primitives leak arbitrary components.** Signal: someone adds
  an unsafe primitive and executable code slips into MDX. Response: the
  primitive set stays closed; `public-markdown.ts`'s allowlist extends by
  exact component name and is asserted by test.
- **Command IDs collide with existing slugs.** Signal:
  `reference/cli/install` collides with a guide slug. Response: catalog
  uniqueness test catches it before merge; Phase 1's contract already
  covers slug collision within the CLI namespace.
- **Historical bundle disagrees with contract.** Signal: a previous stable
  has a command the contract does not list. Response: Phase 1 owns the
  contract; this phase does not paper over the disagreement. Fail loud,
  reopen Phase 1's registry, patch the contract.
- **Byte budget breaks after the split.** Signal: cap exceeded despite
  Phase 1's spike prediction. Response: shrink primitive CSS first
  (defer unused states); then defer historical projection to a follow-up
  if truly unavoidable — but only with an updated decision doc, not
  silently.
- **Legacy anchors get lost during renderer refactor.** Signal: the anchor
  test fails on a known deep link. Response: the anchor test is the
  authority; the renderer must produce it. Do not weaken the test.
