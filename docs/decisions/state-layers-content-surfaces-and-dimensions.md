# State layers, content surfaces, and shell dimensions

Status: **Accepted**
Recorded: 2026-08-17
Phase: 2 (shared design tokens and foundations)
Required by: Phase 3–6 (all consuming screens)

Sources of record:

- [`packages/tokens/src/tokens.json`](../../packages/tokens/src/tokens.json) — the authored token set
- [`packages/tokens/dist/site.css`](../../packages/tokens/dist/site.css) + [`packages/tokens/dist/docs.css`](../../packages/tokens/dist/docs.css) — generated CSS, byte-identical shared primitives
- [`tests/tokens/token-contract.test.mjs`](../../tests/tokens/token-contract.test.mjs) — contrast + dimension + semantic-role assertions
- [`plans/260816-2345-ariadnev-web-uiux-upgrade/phase-02-shared-design-tokens-and-shell-primitives.md`](../../plans/260816-2345-ariadnev-web-uiux-upgrade/phase-02-shared-design-tokens-and-shell-primitives.md) — the phase this decision closes

## Guiding principle

**Not every state gets a unique colour.** The token set carries meaning in a
four-role structure — `layer`, `border`, `text`, and `indicator` — so
shape/text can share the burden with colour. A colour-blind reader who cannot
distinguish spectral from copper still perceives the current-nav indicator
from its position, the destructive boundary from its label, and the selected
state from its filled chip against an outlined unselected sibling.

## State layers

Ten state groups under `state.*`. Every one is composed from the accepted
palette (ink / graphite / cool / spectral / copper / signal); no new accent
family, no new hue.

| State | Roles | Semantics |
|---|---|---|
| `hover` | layer, border | Subtle raise; sits on top of surface.canvas / surface.raised |
| `pressed` | layer, border | Deeper depression; feels one click of extra weight over hover |
| `selected` | layer, border, text | Held selection (a chosen row, a picked filter); bright chip pattern with text.onAccent |
| `current` | indicator, text | Reader's own position in nav/breadcrumb/sibling/TOC; **indicator only, never a fill** |
| `disabled` | layer, text, border | Non-interactive; contrast intentionally drops (WCAG 2.2 exempts disabled controls) |
| `loading` | indicator, track | In-flight work; spectral matches live-execution semantics |
| `success` | text, border, layer | Persistent outcome-confirmed status |
| `error` | text, border, layer | Persistent failed-operation status |
| `destructive` | text, border, indicator | **Boundary before action** — rm/drop/force-push warnings; MUST render before the action fires |
| `copySuccess` | indicator | Transient clipboard witness; distinct from `state.success` and from execution `topology.witness` |

### Semantic distinctions that MUST NOT collide

- **`state.current` vs `state.selected`**: current is the reader's own
  position (breadcrumb, active-nav, TOC); selected is a chosen value
  (a picked filter, a chosen row). Current is a left/inline indicator bar,
  never a fill; selected is a fill. Rendering both the same way makes
  breadcrumbs look like radio buttons.
- **`state.destructive` vs `state.error`**: destructive is a boundary marker
  **before** the reader triggers an action; error is the state **after** an
  operation failed. Same hue, different UX moment.
- **`state.copySuccess` vs `state.success` vs `topology.witness`**:
  copySuccess is a transient toast ("copied to clipboard"); success is the
  persistent status of a completed operation; witness is the record that a
  given execution edge actually fired. Three separate UI moments — three
  separate tokens.
- **`focus.color` vs `state.selected.border`**: focus is keyboard-visibility;
  selected is a held choice. A focused-but-not-selected control shows both a
  focus ring **and** an unselected border; a selected control that has focus
  shows both a focus ring **and** the selected fill+border.

## Content surfaces

Ten role groups under `content.*`.

| Surface | Roles | Where |
|---|---|---|
| `code` | background, text, border, prompt | Fenced code blocks, command lines |
| `codeInline` | background, text | Inline `code` chips |
| `table` | header, headerText, row, rowStripe, divider, scrollAffordance | Data tables; rows do NOT stripe by default |
| `callout.note` | layer, border, text, label | Informational aside |
| `callout.gate` | layer, border, text, label | Copper-forward; a human decision is required |
| `callout.boundary` | layer, border, text, label | Architectural boundary marker (locale/version, edition transition) |
| `callout.destructive` | layer, border, text, label | Irreversible-action warning |
| `callout.evidence` | layer, border, text, label | Proof/citation surface, signal-pass label |
| `overlay` | background, border, scrim | Modal, drawer, popover |
| `selection` | background, text | Text selection background (the one browser default we override) |
| `empty` | text, border | Empty-state surface (no rows, no matches) |
| `errorSurface` | layer, border, text, label | Non-inline error panel; distinct from `state.error` control alias |

**Callout count is locked at five.** Adding a sixth requires an accepted
addendum to this decision doc; the five carry distinct semantics (info,
human-gate, architectural boundary, hazard, evidence) that map onto the
Living Execution Atlas without leftovers.

**Table rowStripe exists but is not the default.** Most data-tables in
Ariadnev are short enough that alternating rows adds visual noise without
scan-line help. Long options tables opt in via `content.table.rowStripe`.

## Shell dimensions

### Shared (both apps consume)

| Token | Value | Meaning |
|---|---|---|
| `layout.docs.headerHeight` | 3.5rem (56px) | ≥ 44px touch-target floor |
| `layout.docs.sidebarWidth` | 16rem (256px) | Left rail; matches Fumadocs convention |
| `layout.docs.tocWidth` | 13rem (208px) | Right rail; narrower than sidebar because TOC entries are shorter |
| `layout.docs.stickyOffset` | 4rem (64px) | Top offset for sticky elements below the header |
| `layout.docs.railViewportHeight` | `calc(100vh - 4rem)` | Sidebar/TOC max height so they don't overrun a short viewport |
| `layout.table.columnMin` | 8rem (128px) | Minimum column width before horizontal scroll takes over |
| `layout.table.columnMax` | 22rem (352px) | Maximum column width; wider means split into two columns |
| `layout.density.compactRow` | 2rem (32px) | Display-only rows (a status ledger, not a menu); **not** touch-safe |
| `layout.density.proseRow` | 2.75rem (44px) | Interactive list rows; = touchTarget |
| `layout.density.referenceRow` | 3rem (48px) | CLI options tables where the row is a copy-line-of-code target |
| `size.referenceMax` | 56rem | Wider measure for options tables; sits between prose (38rem) and content (72rem) |

### App-local (site only)

| Token | Value | Meaning |
|---|---|---|
| `layout.marketing.splitGap` | 2rem | Split-composition gap |
| `layout.marketing.pathGap` | 3rem | Path-composition gap |
| `layout.marketing.ledgerGap` | 1.5rem | Ledger-composition gap |

Docs never composes marketing gaps; docs renders in a reader shell, not a
marketing shell. Keeping these under `layout.marketing.*` documents the
boundary explicitly rather than hoping later authors respect it by memory.

### Constraint verified by test

`sidebar (16rem) + toc (13rem) + prose (38rem) + gutter (4rem) = 71rem ≤
75rem` (≈ 1200px desktop). The three-column desktop docs shell fits without
wrapping on a common desktop viewport; the token contract test asserts this.

## Typography: `font.weight.medium: 500`

Inter is a variable face pinned 400..700 in the font manifest; 500 is a real
axis position, not a fake alias. Body-role type gets a proper medium weight
without a new font file.

**Do NOT add a display-medium role.** Be Vietnam Pro is a single 700 asset.
A fake `display-medium` alias would render at 700 with a made-up name,
which is the exact "false weight" trap the plan bans. Use size, spacing,
and colour hierarchy for display-face emphasis; do not add another font.

## Anti-patterns

- Using `color.spectral.500` directly in an app instead of
  `state.selected.layer` or `state.loading.indicator`. Semantic roles
  exist so a palette shift propagates in one edit; raw palette use loses
  that property.
- Rendering `state.current` as a fill instead of an indicator. Makes nav
  look like a chip carousel.
- Adding a sixth callout without a decision-doc addendum. Five is not a
  budget; it's a claim about the semantic coverage.
- Assigning `state.copySuccess.indicator` to `state.success.text` and
  vice versa. They render the same colour today (both signal.pass) but
  mean different things; a future design shift may separate them, and
  code that conflates them will need a scavenger hunt.
- Composing marketing gaps in docs, or docs sticky-offsets in a marketing
  landing page. The app-local scoping is meaningful.

## Stop conditions

- **A screen requires a state role not in this list.** Extend the token
  set with a decision-doc addendum; do not sneak an ad hoc role into
  the app CSS.
- **A palette entry gets consumed directly by an app** past this phase.
  Grep-based contract check in Phase 3+ shell rewrite; violations block
  the review.
- **A callout's label colour fails 4.5:1 on its layer for a future
  palette shift.** Contrast is asserted per-callout in the token contract
  test; a failure blocks the token build, not a downstream visual review.

## Non-goals

- No new accent family (per plan).
- No display-face variable pretense (Be Vietnam Pro stays 700-only).
- No new spacing scale (4px grid preserved).
- No motion above 400ms (preserved).
