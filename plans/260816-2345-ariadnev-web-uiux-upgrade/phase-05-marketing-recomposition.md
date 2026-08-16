---
phase: 5
title: "Marketing recomposition"
status: pending
priority: P2
effort: "4-6d"
dependencies: [2]
---

# Phase 5: Marketing recomposition

## Overview

Recompose the marketing home into five distinct macro-sections that carry the
reader from a split hero with a live execution path to a decisive terminal
action. Preserve every verified claim, metric, and URL. Convert the mobile
execution map from horizontal-scroll SVG into a vertical path native to the
viewport. Motion is finite and represents a state transition; there is no
ambient animation.

## Requirements

- Functional: (a) the home page uses **five** distinct macro-compositions in
  order — **split hero / live path**, **path narrative**, **authority
  boundary**, **evidence ledger**, **terminal action**; (b) execution map is
  the hero region's primary visual, not a second-section diagram; (c) the
  mobile execution path is vertical, not a scrollable horizontal SVG; (d)
  publication date renders through `<time datetime>` + `Intl.DateTimeFormat`;
  (e) install-command interaction uses a stable feedback slot rather than a
  row-insertion pattern; (f) hover/focus/pressed states come from Phase 2's
  token layers, not ad hoc CSS.
- Non-functional: no invented claim, metric, testimonial, or route; the
  ordered textual equivalent for the execution map is preserved (audit
  *Pass* callout); static-size budget respected; reduced-motion behavior
  honored; keyboard journey remains complete.

## Architecture

Five macro-compositions, each with a distinct information structure:

- **1 — Split hero / live path.** Verified promise and primary actions on
  one column; the execution path is the dominant visual on the other. Motion
  is a finite dispatch → gate → checkpoint state transition, played once on
  intent (viewport intersection or reduced-motion off), never looping.
- **2 — Path narrative.** Dispatch, gate, checkpoint, and path witness as a
  connected journey with copy anchored to each stage. On mobile this is the
  vertical execution path, not a squeezed horizontal SVG.
- **3 — Authority boundary.** A contrasting lane or ledger composition that
  shows what the control plane owns, what a provider owns, and where a
  human decides. This composition is genuinely different from the path
  narrative — column-based, not path-based.
- **4 — Evidence ledger.** Provenance and verified capabilities as records
  (source SHA, tag, immutable release id) rather than generic feature
  cards. Existing verified content moves here; nothing is invented.
- **5 — Terminal action.** One decisive installation or documentation path
  with a stable, compact copy-feedback slot.

Each section owns a distinct layout class (`layout--split`, `layout--path`,
`layout--boundary`, `layout--ledger`, `layout--terminal`). Docs never
consumes these — the class prefix is scoped to `apps/site/`.

## Related Code Files

- Modify: `apps/site/src/pages/index.astro`
- Modify: `apps/site/src/components/promise-section.astro`
- Modify: `apps/site/src/components/execution-map.astro` — split into a
  desktop horizontal variant and a vertical variant fed by the same source
  data; keep the ordered textual `<figcaption>` fallback
- Modify: `apps/site/src/components/install-command.astro` — stable
  feedback slot; label change on interaction
- Create: `apps/site/src/components/hero-section.astro` — split hero
  wrapper that owns the execution-path visual
- Create: `apps/site/src/components/authority-boundary.astro` — new
  section
- Modify: `apps/site/src/components/evidence-ledger.astro` — recompose to
  the ledger layout; content unchanged
- Modify: `apps/site/src/components/final-install.astro` — terminal-action
  layout
- Modify: `apps/site/src/styles/site.css` — consume Phase 2 tokens
  (state layers, medium weight, dimensions); drop ad hoc equivalents; add
  `layout--split`/`layout--path`/`layout--boundary`/`layout--ledger`/`layout--terminal`
- Modify: `tests/site/*` — extend landing-consistency to assert (a)
  execution map is above the first divider (in the hero region), (b) all
  five layout classes appear on the home in that order, (c) `<time
  datetime>` present on the publication label, (d) mobile execution path
  renders without horizontal scroll at 320px, (e) reduced-motion
  disables the state transition

## Implementation Steps

1. **Hero rework.** Move the execution map into the hero region. Keep the
   ordered list as `<figcaption>`. Verify screen-reader reading order and
   that the SVG stays `aria-hidden` when the caption covers the same info.
2. **Mobile vertical path.** Add the CSS-grid vertical variant fed by the
   same source data; hide the horizontal SVG at narrow viewports.
3. **Five sections.** Author the five section wrappers with their distinct
   layout classes. Ensure each carries a different information structure
   (path vs column vs record vs single-action), not just different padding.
4. **State motion.** Wire the finite state transition to a one-shot trigger
   on viewport intersection; honor `prefers-reduced-motion`.
5. **State layers.** Remove ad hoc hover styles; consume Phase 2 tokens.
6. **Install feedback.** Stable slot; label transforms in place.
7. **Semantic time.** `<time datetime="…">` + `Intl.DateTimeFormat`.
8. **Tests.** Extend landing-consistency; run static-size budget test.

## Success Criteria

- [ ] Home page contains all five layout classes in order:
      `layout--split`, `layout--path`, `layout--boundary`, `layout--ledger`,
      `layout--terminal`.
- [ ] Execution map is the primary visual in the hero region on desktop and
      mobile.
- [ ] Mobile execution path is vertical; no horizontal scroll at 320px.
- [ ] Publication date is a semantic `<time>` element with a locale-formatted
      label.
- [ ] Install-command feedback uses a stable slot; no row insertion.
- [ ] State transition plays once on intent and is disabled under
      `prefers-reduced-motion`.
- [ ] No verified claim, metric, or route was removed or fabricated.
- [ ] `pnpm run test:qualification` green.

## Risk Assessment

- **Moving the map breaks the ordered-list accessibility pattern.** Signal:
  screen reader announces the map twice. Response: keep the SVG
  `aria-hidden` when the textual `<figcaption>` covers the same information;
  do not add a second list.
- **Static size budget is fragile.** Signal: budget test fails after the
  new layouts. Response: audit whether the budget was set for the old
  composition; consult the deployment contract owner rather than silently
  bumping; measurement first.
- **Macro-layout classes drift into docs.** Signal: docs picks up a
  `layout--*` class accidentally. Response: keep the prefix scoped to
  `apps/site/`; docs uses shell dimensions from tokens but never marketing
  layouts.
- **State transition looks ambient rather than finite.** Signal: designers
  or QA report it "loops". Response: reduce it to a single-shot
  progress-bar-style transition; the audit and brainstorm both forbid
  ambient motion.
- **Section 3 collapses into section 2.** Signal: authority boundary reads
  as a rehash of the path narrative. Response: enforce distinct
  information structures — path narrative is sequential; authority
  boundary is columnar — and let a design review reject a boundary that
  reduces to a path in disguise.
