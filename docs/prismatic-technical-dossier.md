# Prismatic Technical Dossier

This is the visual authority for Ariadnev marketing and documentation. It
supersedes the dark-only presentation in
[Execution cartography](./execution-cartography.md) without changing that
document's behavioral vocabulary.

## Design read

Ariadnev is a public product narrative and an operational reference workbench
for developers and operators. Its visual language combines Swiss editorial
clarity with industrial utility. The memorable device is a system trace that
moves from explanation into commands, evidence, and human gates.

The user reads prose on a laptop in a lit workspace, then moves into darker
command and proof panels. Mixed luminance therefore separates jobs; it is not a
theme preference or a decorative section alternation.

## Surface contexts

Every owning region declares one `data-surface-context` value. Components use
the matching `--vcs-context-*` roles and inherit only inside that boundary.
Behavior code must never branch on the context.

| Context | Job | Composition |
|---|---|---|
| `brand` | Identity, masthead, primary product orientation | Solid ink field with an unmodified logo and restrained navigation |
| `reading` | Narrative, guides, tables, long-form reference | Mineral paper field, ink text, exposed editorial grid |
| `instrument` | Commands, graphs, proof, operational records | Ink field, compact evidence hierarchy, local overflow |
| `overlay` | Search, drawer, popover | Raised ink field and explicit scrim above the current context |

Each context provides canvas, raised, border, primary and muted text, link,
focus, selection, disabled, active, verified, gate, and destructive roles.
Overlay additionally provides a scrim. The compatibility `surface`, `text`,
`state`, and `content` aliases remain during migration; new composition uses
context roles.

Blue means interactive, current, or active execution. Green means verified or
successful. Red means error or destructive. Copper is restricted to human
approval, blocked, or attention states. Text, shape, or labels repeat every
state meaning; color is never the only signal.

## Type and spacing

The existing self-hosted font bytes are immutable:

| Role | Family | Use |
|---|---|---|
| Display | Be Vietnam Pro 700 | Page titles and decisive editorial statements |
| Body | Inter 400-700 | Prose, navigation, controls, tables |
| Instrument | JetBrains Mono 400-700 | Commands, identifiers, records, tabular data |

Vietnamese coverage and file digests are enforced by
`tests/tokens/font-contract.test.mjs`. Display type is not used as a costume on
labels or data. Mono type appears only where the content is genuinely
machine-oriented. Spacing stays on the existing 4px scale; no page introduces
an ad hoc spacing ladder.

## Brand asset preservation

`tests/benchmarks/brand-asset-checksums.json` owns exact paths, bytes, SHA-256
digests, intrinsic dimensions, aspect ratios, minimum rendered sizes, clear
space, and backing rules for both distinct logos and each favicon/touch icon.

- Logos render on `context.brand.canvas`, with `object-fit: contain`, visible
  overflow, and preserved aspect ratio.
- Minimum logo box is 48 by 32px with 8px clear space.
- No recolor, crop, filter, shadow, glow, mask, generated substitute, or
  cross-application deduplication is allowed.
- Favicon and touch-icon backing is baked into their immutable bytes.

## Transition grammar

A page may move once from a brand field into a reading field. Instrument
surfaces then appear as bounded evidence inside reading content. Overlays sit
above whichever context invoked them. A light section cannot be inserted
between dark sections as decoration, and a global light/dark selector cannot
stand in for explicit ownership.

Hairlines and surface tint establish depth. Broad blur, ambient glow, gradient
text, frosted glass, generic bento grids, card walls, pill-by-default controls,
and topology used as a page-ground texture are retired.

## Pilot M01: marketing home

M01 proves the product narrative before M02 inherits the grammar.

- First viewport states what Ariadnev is, why an operator uses it, and the
  direct install action. Install remains one purposeful copy interaction.
- The unchanged logo sits in a measured brand preservation zone. The hero is
  left-led or asymmetric, never a centered headline above three equal cards.
- A real system trace connects product explanation to execution, human gate,
  and verified evidence. It is not a decorative graph or fabricated dashboard.
- The page moves deliberately from brand to reading once; command and proof
  records use instrument context.
- At 320 and 375px the title, product fact, and next action fit before
  decorative content. At 768px the trace recomposes. At 1280 and 1440px the
  editorial grid expands without stretching prose.

Reject M01 if it reads as a recolored current page, alters product claims,
uses effects on the logo, hides install behind more than one action, or clips
at a declared stress frame.

## Pilot D06: concepts workflow model

D06 proves long-form reading and instrument evidence in the docs shell.

- The first viewport identifies locale/version, page purpose, and the next
  learning action without decorative dead space.
- Prose and TOC use reading context. Commands and topology use instrument
  context, with complete adjacent text and print meaning.
- Vietnamese headings, code, current location, focus, gate, success, error,
  copy success, and disabled states remain distinct.
- At 320 and 375px rails collapse into no-JS-recoverable controls; code and
  topology scroll or recompose locally. At 768px the reading measure remains
  primary. At 1280 and 1440px sidebar, prose, and TOC fit without shrinking.

Reject D06 if the SVG becomes the sole authority, shell recovery requires
JavaScript, focus is hidden, prose inherits a dark global canvas, or the live
per-route budget is exceeded.

## Pilot D12: CLI command index

D12 proves generated-reference density before D13-D17 multiply it.

- Complete initial HTML exposes canonical commands and Markdown discovery.
- Exact lookup takes at most two purposeful interactions. `/` focus, Escape
  clear, localized result count, and copy feedback remain intact.
- The index uses reading context for orientation and instrument context for
  command signatures and evidence. Records do not become a generic card wall.
- At 320 and 375px each record preserves command identity and local actions. At
  768px filtering and scanning stay visible. At 1280 and 1440px density grows
  through columns and dividers, not smaller text.

Reject D12 if generated content gains a second source of truth, no-JS lookup
becomes incomplete, command identity or route cardinality changes, search
partitioning drifts, or a live budget cap is widened.

## Migration inventory

Phase 2 owns elimination of direct palette consumption in application CSS.
The Phase 1 inventory below prevents new usage from disappearing into the
migration. Line numbers are intentionally omitted because selectors are the
durable identity.

| Owner | Current direct consumers | Phase 2 destination |
|---|---|---|
| Site navigation and actions | `.text-link`, `.button-primary`, `.button-secondary` | Context link, active, focus, and selection roles |
| Site execution evidence | `.proof-status`, topology node/edge/gate selectors | Instrument active, verified, gate, and destructive roles |
| Site print rules | print color/fill/stroke declarations | Explicit print-safe semantic aliases |
| Docs root compatibility aliases | `--vc-color-link-hover`, `--vc-color-selection-background` | Context link and selection roles |
| Docs header and search | `.language-chooser`, `.docs-header`, `.brand*`, `.search-control*`, `.search-footer` | Brand and overlay roles |
| Docs navigation | `.switcher-group*`, `.docs-sidebar*`, `.docs-toc*` | Reading current, active, focus, and overlay roles |
| Docs prose and home | `.docs-body*`, `.prose h1`, `.docs-home-counts*`, `.docs-pager*` | Reading text/link plus bounded instrument records |
| Docs diagrams and authored records | `.wd-*`, `.migration-diff-table`, `.callout-*`, `.operation-matrix-*`, `.procedure-step-kicker` | Instrument and semantic status roles |

No new `--vcs-color-*`, hex, or raw `oklch()` consumer may be added to an
application stylesheet. Generated token CSS is exempt because it is the source
projection. Machine-owned budget values remain in
`tests/benchmarks/performance-budgets.json` and
`tests/benchmarks/docs-per-route-ratchet.json`; those files outrank prose.

## Implementation gate

Before a page family rolls out, its pilot must pass semantic tests, asset and
font contracts, 320/375/768/1280/1440 composition review, reduced motion,
forced colors, text spacing, 400% reflow, print, keyboard focus, no-JS paths,
and its live budget. Snapshot rotation follows semantic approval and is never
blanket acceptance.
