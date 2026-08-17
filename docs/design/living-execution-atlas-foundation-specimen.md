# Living Execution Atlas — foundation specimen

Status: **Accepted — visual-quality reference for Phase 3–6 screen work**
Recorded: 2026-08-17
Phase: 2 (shared design tokens and foundations)
Feeds: Phase 3 (docs safety and shell), Phase 4 (authored docs), Phase 5 (generated reference), Phase 6 (marketing)

Purpose: pin the accepted visual hierarchy and responsive rules across the
four mandatory stress frames **before** any screen work starts. Later phases
compare their output against this contract; a screen that reads correctly on
paper here but wrong in the browser is the screen's failure, not this
specimen's.

## The four stress frames

Every screen in the Living Execution Atlas is measured at these exact frames.
This document is authored to be readable and correct at every one.

1. **CLI reference at 320px** — the narrowest interactive width; command
   detail pages, options tables, one-column reference layout
2. **Provider reference at 320px** — the same width but with tabular data
   compared side-by-side; a scrollable local table pattern that never
   overflows the page
3. **Desktop CLI lookup** — a wide viewport where the reader is searching
   an aggregate CLI reference; sidebar + content + right-rail TOC three-
   column shell
4. **Complete VI shell** — full Vietnamese chrome: locale/version switcher,
   sidebar, TOC, breadcrumb, page title, prose body, callouts, and code
   surfaces all in vi-VN

## Accepted hierarchy (all frames)

### Type hierarchy

Font roles: `display` (Be Vietnam Pro 700), `body` (Inter variable 400..700
including new medium 500), `mono` (JetBrains Mono 400/700).

| Role | Font | Weight | Size (rem) | Line-height | Where |
|---|---|---|---|---|---|
| Page title | display | 700 | 3xl → 4xl at desktop | tight (1.15) | H1 for the page (existing `#page-title`) |
| Section | body | 500 (medium) | 2xl | snug (1.35) | H2 |
| Sub-section | body | 500 (medium) | xl | snug | H3 |
| Prose | body | 400 | md | normal (1.6) at desktop, relaxed (1.75) in docs body | paragraph, list |
| Reference-cap | body | 500 | sm | snug | callout labels, table headers, breadcrumb, TOC entries |
| Overline | body | 500 | xs | snug | eyebrow labels above section titles |
| Code (inline) | mono | 400 | sm | normal | inline `code` |
| Code (block) | mono | 400 | sm | normal | fenced code |

### Colour hierarchy

Dark ground everywhere. Every surface is drawn on `surface.canvas`
(`color.ink.900`), never on pure black. Text roles from the accepted set:

- Primary body text → `text.primary` (cool.100) at 12.1:1 contrast
- Secondary/metadata → `text.secondary` (cool.300) at 8.8:1
- Muted labels → `text.muted` (graphite.400) at 4.5:1
- Accent-linked → `text.accent` (spectral.400)
- Human-gate → `text.gate` (copper.400)

Never invent an "info blue" or a "warning yellow"; the palette is:
ink / graphite / cool / spectral (live execution) / copper (human gate) /
signal (pass, fail, blocked). Everything else is a composition.

### Spacing hierarchy

4px grid. Between sections: `space.6` (2rem). Between sibling
paragraphs: `space.4` (1rem). Between line items in a list: `space.2`
(0.5rem). Callout body inset: `space.4`. Code block inset: `space.3`.

## Frame 1 — CLI reference at 320px

**Layout**: one column. No sidebar, no right rail. Header collapses to a
single-row bar with hamburger + logo + search. Breadcrumb wraps if needed.

**Reading measure**: full viewport width minus `space.4` gutters on each
side; effectively 296px inner width at 320px viewport.

**Content adaptations**:
- Options table becomes a stacked list: each option is a card at
  `layout.density.referenceRow` (3rem) with the flag on top and the
  description below. Horizontal scroll is banned.
- Command signature is a single-line `mono` block that wraps at natural
  break points (spaces around `--flags`).
- Copy button sits above the code block, right-aligned; not overlapping the
  first line of code (48px height + 8px gap).

**Focus behavior**: tab order = skip-link → header → search → language →
version → breadcrumb → title → options-list → copy-actions → footer.

**Reduced motion**: transitions removed everywhere (existing
`motion.duration.*` → 0ms rule generates this automatically).

## Frame 2 — Provider reference at 320px

Same shell as Frame 1. The provider comparison table is the load-bearing
surface here.

**Table treatment**:
- The table itself scrolls horizontally inside its own container
  (`overflow-x: auto`); the page body never scrolls horizontally
- Sticky first column (provider name) with `content.table.scrollAffordance`
  border-right so the reader knows it's frozen
- Column widths bounded by `layout.table.columnMin` (8rem) and
  `layout.table.columnMax` (22rem) — smaller columns collapse toward min,
  larger cells wrap
- Skip cells (unverified artifacts) render `state.disabled.text` + a small
  "skip: reason" tooltip; the "why skip" link is inline text, not a
  hover-only reveal (no JS required)
- Header uses `content.table.header` + `content.table.headerText`; rows use
  `content.table.row` with NO stripe by default (see decision doc)

## Frame 3 — Desktop CLI lookup

Three-column shell: sidebar + content + right TOC. Header full-width.

**Grid**:
- Sidebar: `layout.docs.sidebarWidth` (16rem)
- Content: fluid, `size.referenceMax` (56rem) cap for CLI reference-index
  pages; `size.proseMax` (38rem) for guide/concept prose
- TOC: `layout.docs.tocWidth` (13rem)
- Gap between columns: `space.5` (1.5rem)
- Total at 1200px: 16 + 1.5 + 56 + 1.5 + 13 = 88rem doesn't fit; the actual
  desktop composition uses `size.proseMax` as content default and
  `size.referenceMax` only when the page is a reference-index. Assertion in
  `token-contract.test.mjs`: sidebar + toc + proseMax + gutter ≤ 75rem.

**Sticky behavior**:
- Header sticks at top (0)
- Sidebar sticks at `layout.docs.stickyOffset` (4rem)
- TOC sticks at `layout.docs.stickyOffset` (4rem)
- Both rails scroll independently inside `layout.docs.railViewportHeight`
  (`calc(100vh - 4rem)`)

**Current-nav treatment**:
- Sidebar current entry: `state.current.indicator` bar on the leading
  edge, `state.current.text`, no fill
- TOC current entry: same treatment
- Breadcrumb current: `aria-current="page"`, no visual change beyond the
  text-primary contrast (breadcrumb is a linear path; current is
  necessarily last)

**Search dialog**: opens as an overlay using `content.overlay.background` +
`content.overlay.scrim` (0.65 alpha over ink); dismissable via Esc, click
on scrim, or the close button. Search results are keyboard-navigable
(existing `search-dialog.tsx`).

## Frame 4 — Complete VI shell

The entire Frame 3 layout, but every string in Vietnamese. Verifies:

- `<html lang="vi">` on every vi route
- All chrome copy (skip link, header brand, search placeholder,
  language/version switcher labels, sidebar section headers, TOC "On this
  page", breadcrumb "Docs" etc., copy-action button labels) has a vi
  translation
- Vietnamese diacritics render correctly across all three fonts —
  guaranteed by `tests/tokens/font-contract.test.mjs` which parses the
  woff2 cmap tables and asserts full Vietnamese repertoire coverage
- Wrapping: Vietnamese words are on average longer than English; sidebar
  entries wrap gracefully (no truncation with ellipsis for nav — nav must
  be fully readable), TOC entries may truncate with an accessible full
  title in `title` / `aria-label`
- The `₫` dong sign is present in the body font (asserted by the font
  contract test)

## Callout treatment (all frames)

Every callout uses its layer + border + label + text roles:

```
┌─ [LABEL in coloured cap]
│  Body text at text.primary on the callout's layer.
│  Multi-paragraph is fine; body inherits the reading measure.
└─
```

The vertical bar on the leading edge is the callout's semantic anchor;
the border colour identifies the callout kind (note → graphite, gate →
copper, boundary → graphite with spectral label, destructive → signal.fail,
evidence → graphite with signal.pass label). Colour alone never carries
meaning — the label word ("NOTE", "GATE", "BOUNDARY", "DESTRUCTIVE",
"EVIDENCE") is always present.

Vietnamese callouts translate the label ("GHI CHÚ", "CỔNG", "RANH GIỚI",
"NGUY HIỂM", "BẰNG CHỨNG") but keep the same visual treatment.

## Code surface treatment

- Fenced blocks use `content.code.background` (ink.800) + `content.code.text`
  (cool.100) at 7:1 contrast (asserted)
- CLI prompts use `content.code.prompt` (spectral.400) for the `$` /
  `av ` prefix
- Inline `code` uses `content.codeInline.background` + `text`
- Copy button (existing `PageCopyActions`) sits above the block for full-
  page copy; per-block copy is right-aligned above the first line

## Focus treatment (all frames)

- `focus.width` (2px), `focus.offset` (2px), `focus.color` (spectral.400)
- Focus rings never removed
- Focus visible on skip-link, header controls, sidebar/TOC entries,
  breadcrumb, all copy actions, all links inside prose, all form inputs
- Focus on selection-chip elements composes with `state.selected.border`
  — reader sees both rings

## Reduced-motion behavior (all frames)

- Every `motion.duration.*` token drops to 0ms under
  `@media (prefers-reduced-motion: reduce)` (already generated)
- No layout shift on focus (rings use `outline`, not `border`)
- No transform-on-hover for sidebar entries; use `state.hover.layer` fill
  swap only

## What this specimen does NOT prescribe

- No screenshots. Every measurable property is a token value or an
  assertion in `tests/tokens/`; the specimen describes composition rules,
  not pixel-for-pixel mockups. Later phases render screens against these
  rules and compare with Playwright at the four frames.
- No frame-specific accent colour, ambient loop, decorative gradient,
  or glow. The palette is closed.
- No new component names. Phase 3 owns the shell component surface; this
  specimen only describes what those components must look like when
  composed with the accepted tokens.

## Related

- [`state-layers-content-surfaces-and-dimensions.md`](../decisions/state-layers-content-surfaces-and-dimensions.md) — the token contract
- [`docs-catalog-and-safe-components.md`](../decisions/docs-catalog-and-safe-components.md) — the approach 1 + approach 3 winner shaping how screens compose these tokens
- [`docs-performance-baselines.md`](../decisions/docs-performance-baselines.md) — the 289KB shell payload constant that constrains what visuals can add
