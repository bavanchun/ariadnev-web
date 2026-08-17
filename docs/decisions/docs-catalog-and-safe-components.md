# Docs catalog metadata and safe-component boundary

Status: **Accepted — catalog half shipped; safe-component winner is approach 1 + approach 3, approach 2 rejected**
Recorded: 2026-08-17
Phase: 1 (contract gate and measurement spike)
Required by: Phase 3 (docs safety and shell), Phase 4 (authored docs), Phase 5 (generated reference)

Sources of record:

- [`apps/docs/src/lib/content-catalog.ts`](../../apps/docs/src/lib/content-catalog.ts) — the extended catalog schema, `resolveNavigationVisibility`, and `sidebarPages`
- [`tests/docs/content-pipeline.test.mjs`](../../tests/docs/content-pipeline.test.mjs) — legacy backward-compat, populated round-trip, and sidebar-filter tests
- [`apps/docs/src/lib/public-markdown.ts`](../../apps/docs/src/lib/public-markdown.ts) — the current MDX gate this decision is bounded by
- [`plans/260816-2345-ariadnev-web-uiux-upgrade/phase-01-contract-gate-and-measurement-spike.md`](../../plans/260816-2345-ariadnev-web-uiux-upgrade/phase-01-contract-gate-and-measurement-spike.md) — the phase this decision closes

## Catalog metadata (accepted)

The catalog schema gains four **additive optional** page fields:

| Field | Values | Purpose |
|---|---|---|
| `pageKind` | `home` \| `get-started` \| `concept` \| `guide` \| `reference-index` \| `release-notes` \| `not-found` \| `command` | Broad page shape from the Living Execution Atlas |
| `screenKind` | free-form identifier, e.g. `D13-cli-command-detail` | Screen-level atlas identity, one contract per screen |
| `section` | `get-started` \| `concepts` \| `guides` \| `reference` \| `release-notes` \| `meta` | Top-level shelf a global sidebar renders |
| `navigationVisibility` | `global-sidebar` \| `reference-only` \| `hidden` | Sidebar enumeration policy (default `global-sidebar`) |

Rationale — **additive** matters: the current `catalog.json` shipped by
`build-content-root.mjs` does NOT set these fields today, and the parser must
keep accepting that shape while Phase 3–5 populate pages one at a time. The
existing 26 docs pipeline tests still pass unchanged; a new legacy-backward-compat
test proves absent fields resolve to the safe default (`global-sidebar`), and a
new populated-round-trip test proves the shape survives `parseDocsContentCatalog`
+ `freezePage` and that `sidebarPages` filters `reference-only` / `hidden`
correctly, including the `stable` alias.

## Why `navigationVisibility: "reference-only"` for command pages

Command detail pages (D13 in the Living Execution Atlas) live at
`/reference/cli/<slug>/`. They must be:

- discoverable by search — one canonical result per locale/version partition
- served as static HTML and Markdown for `llms.txt` and no-JS clients
- present in `catalog.pages` so `enumerateDocsRoutes` produces the route
- **absent** from the global sidebar because 53 entries in one shelf would
  dominate the navigation and duplicate the aggregate CLI reference index

`sidebarPages(catalog, locale, version)` filters on `resolveNavigationVisibility`,
which defaults to `global-sidebar` for legacy entries and returns the declared
value otherwise. Command pages emit `"reference-only"`; the sidebar never sees
them; search, `llms.txt`, and static export still do.

## Safe-component boundary (spike concluded 2026-08-17)

Winner: **approach 1 for prose pages + approach 3 for data-driven pages**.
Approach 2 rejected. Rationale below is grounded in the current gate
[`apps/docs/src/lib/public-markdown.ts`](../../apps/docs/src/lib/public-markdown.ts)
and the shell surface
[`apps/docs/src/components/docs-shell.tsx`](../../apps/docs/src/components/docs-shell.tsx)
+ [`apps/docs/src/app/[locale]/[version]/[[...slug]]/page.tsx`](../../apps/docs/src/app/[locale]/[version]/[[...slug]]/page.tsx).

### What was measured

The gate rejects `mdxJsxFlowElement`, `mdxJsxTextElement`,
`mdxFlowExpression`, `mdxTextExpression`, `mdxjsEsm`, raw `html`, `image`,
`imageReference`, `linkReference`, `definition`, and H1 headings. It allows
every standard-Markdown block/inline node and validates link schemes to
`http | https | mailto | tel`. All existing pages already round-trip through
this gate unchanged.

The Next.js page.tsx passes `catalogPage`, `sourcePage`, and its computed
`route`/`markdownUrl` into `DocsShell`, which composes header, sidebar, TOC,
breadcrumb, copy actions, and MDX body. Approach 3 chrome slots in at the
`<article>`/`<DocsShell>` boundary, not inside MDX.

### Approach 1 — pure Markdown plus global standard-element mappings

- Cost: **zero** additional engineering. Already what the gate accepts and
  what every page emits today.
- Fits: D03 orientation, D04 installation, D07–D11 concept/guide narrative,
  D14–D17 workflow/provider narrative sections. Tables and code blocks
  already survive the gate; CSS/theme drives visual richness.
- Discovery: trivial. Body is plain Markdown by construction; `publicMarkdown`
  returns it verbatim.
- Byte-identical build: proven by the existing content-pipeline suite.

### Approach 3 — screen-specific React chrome outside the MDX body

- Cost: **one Server Component switch statement in `page.tsx`** keyed on
  `catalogPage.pageKind` (or `screenKind` for finer variants), plus one
  small chrome component per screen kind that reads bundle JSON directly.
  No changes to `public-markdown.ts`, no changes to the safe-component gate,
  no new MDX syntax.
- Fits: D13 command detail (bundle JSON drives the header, options table,
  examples, aliases pill row, sibling nav); D15 provider comparison when
  interactive comparison chrome is warranted; D16 workflow diagrams when
  those become live. MDX body remains optional prose that renders inside
  the chrome or is omitted entirely for pure-data pages.
- Discovery: still trivial. Chrome data is bundle JSON — the search indexer
  reads it from the source of truth, not from a lowered MDX transform.
  MIN-tokenization from
  [`docs-performance-baselines.md`](./docs-performance-baselines.md#projected-318-route-cost-phase-1-sub-step-8-spike-measurement)
  works naturally: title/description/aliases live in the bundle record.
- Byte-identical build: same content-pipeline guarantee; chrome-emitted HTML
  is a deterministic function of catalog fields + bundle JSON.

### Approach 2 — exact-name safe MDX components with deterministic lowering

**Rejected.** Two independent feasibility gates stack, and both must hold
every release:

1. **Byte-identical Markdown lowering across `@mdx-js/mdx` minor bumps.**
   Position offsets, whitespace normalization, and prop ordering are not
   part of MDX's stability contract. Any drift breaks the pipeline's
   `same-inputs-produce-byte-identical-content-root` test, and the failure
   mode is silent HTML diff during a routine dependency bump.
2. **Delimited section preservation for MIN search tokenization** (constraint
   from sub-step 8): the lowering must emit clearly-carveable
   title/description/aliases boundaries. That constrains component design
   choices independently of visual intent.

Both gates cover capabilities approaches 1+3 already provide without either
gate: approach 1 keeps sections in frontmatter and body Markdown; approach 3
keeps them in bundle JSON. Per KISS + "prefer the approach cheapest to
abandon when a load-bearing assumption cannot be resolved now" (opening
brainstorm rule), approach 2 loses on cost, on drift risk, and on the
absence of a screen it uniquely enables.

### Combined coverage of D03–D17

| Screen | Approach | Why |
|---|---|---|
| D03 orientation | 1 | Pure narrative + links |
| D04 installation | 1 | Prose + standard code fences |
| D07–D11 concepts/guides | 1 | Prose + tables + code |
| D13 command detail | 3 | Bundle JSON → deterministic chrome; MIN search fits |
| D14 workflows | 1 or 3 | Prose today (1); chrome when interactive (3) |
| D15 providers | 1 or 3 | Prose comparison (1); interactive filter (3) |
| D16 comparisons | 1 or 3 | Same pattern as D15 |
| D17 release notes | 1 | Prose changelog |

No screen requires approach 2. No screen forces bundle data into the MDX
body (the approach-3 stop condition below stays theoretical, not observed).

## Stop conditions

- **A future screen genuinely needs authored structured data mid-prose** that
  approach 3's chrome cannot carry via bundle JSON or catalog metadata. That
  is the trigger to revisit approach 2 or design a fourth model; do NOT
  smuggle generated data into authored MDX bodies as a workaround.
- **Approach 3 chrome starts duplicating source facts** (e.g. bundle option
  names retyped into a chrome component). Fix by binding chrome to the
  bundle JSON at build time; do not accept the duplication.
- **The `public-markdown.ts` strictness gate weakens**. It must not. Any
  request to unlock JSX blocks must land as an explicit decision record
  overriding this one.

## Non-goals

- No relaxation of `public-markdown.ts` for arbitrary MDX or HTML.
- No JSX expressions, imports, exports, event handlers, or unvalidated URLs in
  any safe-component approach.
- No screen-specific data smuggled through catalog metadata beyond the four
  fields above; page bodies remain the source of truth for content.
