---
phase: 4
title: "Content primitives and CLI reference split"
status: pending
priority: P1
effort: "5-7d"
dependencies: [2]
---

# Phase 4: Content primitives and CLI reference split

## Overview

Give MDX authors a small, documented primitive vocabulary — callout, procedure,
command block, code block, responsive table, compatibility matrix, option row,
next-step card — and split the CLI reference so each command has its own URL
generated from the same source contract. Guides support task completion,
references support lookup, and the 132-heading CLI monolith stops existing.

## Requirements

- Functional: (a) primitives ship as server-safe MDX components consumed both
  by authored content and by generated renderers; (b) `scripts/docs-content/
  render-reference-pages.mjs` emits one CLI page per command plus the index;
  (c) the catalog gains one entry per command page and the sidebar exposes
  them under Reference → CLI; (d) the old `/reference/cli/` URL either
  redirects to the new index or continues to serve the aggregate — the choice
  is made during Step 4 based on edge cost; (e) provider reference tables use
  the responsive table primitive; (f) workflow reference gains a compact
  execution-map primitive with a textual fallback.
- Non-functional: bundle contract untouched; generated MDX still passes
  `public-markdown.ts` (no HTML, no images, no JSX in the body, no H1); build
  remains deterministic (existing `content-pipeline.test.mjs` catches drift);
  no invented flags or descriptions — primitives only reformat facts the
  bundle already ships.

## Architecture

**Primitives.** A small MDX component set under
`apps/docs/src/components/prose/`, importable from authored MDX and emitted
as MDX shortcodes by generated pages. Each primitive is server-safe (no
`use client`) unless it demonstrably needs interaction; the responsive table
wrapper is server-rendered CSS-only.

Names: `<Callout kind="info|warn|gate">`, `<Procedure>` with numbered
`<Step>`, `<CommandBlock cmd="…">`, `<ResponsiveTable>` (wraps a `<table>`
and adds the horizontal scroll shell + sticky header), `<OptionRow>` for
CLI/API options, `<NextSteps>` with `<NextStep>`, `<CompatibilityMatrix>`
(used by the provider reference).

**CLI split.** The current renderer emits one Markdown page from a `commands`
list. Change: emit one page per command under `reference/cli/<command-slug>/`
plus an index page at `reference/cli/` listing commands with descriptions.
Sub-slugs stay lowercase kebab (already true of command IDs); the catalog
already accepts arbitrary slug segments, so the schema needs no change.

**URL migration.** The old `/reference/cli/` URL is where the aggregate lives
today. Two options:

1. **Redirect on the edge.** `/reference/cli/` → `/reference/cli/index/` if
   the index needs a new path, or stays as the index page unchanged. This is
   the preferred outcome — no external link breaks.
2. **Keep the aggregate.** If the redirect is unimplementable at the current
   edge, keep `/reference/cli/` serving the aggregate view for one more
   release, add `Deprecated in <version>: use /reference/cli/<cmd>/` at the
   top, and remove the aggregate in the next major.

Step 4 below picks between them based on edge behavior.

**Workflow map primitive.** Renders a compact SVG topology from the workflow
graph (nodes + edges from the bundle) with an ordered textual list as the
`<figcaption>` fallback — same accessibility pattern the marketing execution
map already uses (`execution-map.astro:46`).

## Related Code Files

- Create: `apps/docs/src/components/prose/callout.tsx`
- Create: `apps/docs/src/components/prose/procedure.tsx`
- Create: `apps/docs/src/components/prose/command-block.tsx`
- Create: `apps/docs/src/components/prose/responsive-table.tsx`
- Create: `apps/docs/src/components/prose/option-row.tsx`
- Create: `apps/docs/src/components/prose/next-steps.tsx`
- Create: `apps/docs/src/components/prose/compatibility-matrix.tsx`
- Create: `apps/docs/src/components/prose/workflow-map.tsx`
- Modify: `apps/docs/src/mdx-components.tsx` — register primitives so authored
  and generated MDX resolve them without per-page imports
- Modify: `scripts/docs-content/render-reference-pages.mjs` — emit one CLI
  page per command plus index; emit provider and workflow references using
  the new primitives; keep pure and deterministic
- Modify: `scripts/docs-content/build-content-root.mjs` — iterate command IDs
  when adding CLI pages to the catalog
- Modify: `workers/edge/src/index.ts` (or equivalent) — add the
  `/reference/cli/` redirect if Step 4 picks Option 1; otherwise leave and
  document
- Modify: `apps/docs/content/authored/**/*.mdx` — replace ad hoc tables and
  step lists with primitives where they already exist (guides only; no rewrite)
- Modify: `tests/docs/content-pipeline.test.mjs` — assert (a) command index +
  per-command pages exist for both locales at current stable, (b) generated
  MDX still passes `public-markdown` rules, (c) determinism check still holds
- Modify: `tests/docs/*.test.mjs` — add tests per primitive; add table
  overflow assertion at 320px

## Implementation Steps

1. **Primitive skeletons.** Ship each primitive with its markup, ARIA, and
   token consumption. Prove `<ResponsiveTable>` clears the audit's provider
   overflow at 320px in JSDOM before wiring it into the renderer.
2. **Register in `mdx-components.tsx`.** Names resolve globally so generated
   MDX can use them as shortcodes without imports.
3. **CLI split — renderer.** Refactor `renderCliReference` into
   `renderCliIndex(locale, commands)` and `renderCliCommand(locale, command)`.
   Each command page repeats title/description/arguments/options/aliases from
   the bundle; the index carries a scannable list with descriptions and links.
4. **CLI split — catalog.** Emit one catalog entry per command page under
   `reference/cli/<slug>/`; preserve the existing `reference/cli` entry as
   the index. Extend the historical projection so `previousStable` gets the
   same treatment when its bundle carries commands.
5. **URL migration decision.** Try the edge redirect against a staging Worker
   version. If it lands cleanly, ship it. If not, fall back to Option 2 and
   annotate the aggregate page.
6. **Provider + workflow.** Rewrite provider tables through
   `<ResponsiveTable>` + `<CompatibilityMatrix>`; wrap the workflow
   reference's tables in `<WorkflowMap>` with an ordered textual fallback.
7. **Authored content sweep.** Update guides that already have tables or
   numbered steps to use the primitives — mechanical replacement only, no
   content rewrite.
8. **Tests.** Extend `content-pipeline.test.mjs` for the new catalog shape,
   add unit tests for each primitive, add a 320px overflow test on the
   provider page and the new CLI command pages.

## Success Criteria

- [ ] `apps/docs/content/generated/docs/en/1.1.0/reference/cli/` and
      `/vi/1.1.0/reference/cli/` each contain an `index.mdx` plus one file
      per command; catalog carries matching entries.
- [ ] The old `/reference/cli/` URL either redirects to the new index or
      serves the annotated aggregate; no known external link 404s.
- [ ] Every provider table renders without horizontal scroll at 320px inside
      `<ResponsiveTable>`.
- [ ] Every primitive is registered in `mdx-components.tsx` and covered by a
      unit test.
- [ ] Generated MDX still passes `public-markdown` (no JSX in body except
      the registered primitives, no HTML, no images).
- [ ] Determinism test still passes; the same inputs produce byte-identical
      output.
- [ ] `pnpm run test:qualification` green.

## Risk Assessment

- **Registered primitives leak arbitrary components into generated MDX.**
  Signal: someone adds an unsafe primitive; MDX injects executable code.
  Response: keep the primitive set closed; `public-markdown.ts`'s existing
  allowlist stays authoritative and is extended by exact component name.
- **Command IDs collide with existing slugs.** Signal:
  `reference/cli/install` collides with a guide slug. Response: the reference
  namespace is `/reference/cli/`, guides live under `/guides/`; verify with
  the catalog uniqueness test before merge.
- **Edge redirect not implementable.** Signal: Cloudflare Worker under the
  current topology cannot express the path rewrite without a
  Content-Security-Policy or cache regression. Response: pre-decided Option
  2 (annotated aggregate) — do not invent a third option in flight.
- **`packages/tokens` doesn't yet carry a callout surface Phase 2 didn't
  include.** Signal: primitive design needs a surface not in Phase 2's set.
  Response: extend Phase 2's decision doc rather than defining a token in
  app CSS.
