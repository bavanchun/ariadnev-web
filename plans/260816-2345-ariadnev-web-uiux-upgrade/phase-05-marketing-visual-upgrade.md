---
phase: 5
title: "Marketing visual upgrade"
status: pending
priority: P2
effort: "3-5d"
dependencies: [2]
---

# Phase 5: Marketing visual upgrade

## Overview

Recompose the marketing home so the execution path is the memorable hero
visual — not a second-section diagram — and three or more distinct
macro-layout families carry the reader from hero to terminal install. Preserve
verified claims and URLs. Convert the mobile map from horizontal-scroll SVG
into a vertical path that is native to the viewport.

## Requirements

- Functional: (a) execution map appears in the hero region; (b) at least
  three distinct macro-layouts across the page (audit target: split hero,
  path narrative, boundary comparison, evidence ledger, terminal action);
  (c) mobile viewport gets a vertical execution path, not a scrollable
  horizontal SVG; (d) publication date rendered with `<time datetime>` +
  `Intl.DateTimeFormat` (no `slice(0,10)`); (e) install command has a
  stable feedback slot instead of a display-toggle row.
- Non-functional: keep the ordered textual equivalent for the execution map
  (audit *Pass* callout); preserve verified metrics/testimonials/routes —
  no invented content; static output budget respected.

## Architecture

Marketing lives in Astro; component boundaries already exist. Changes are
compositional, not framework:

- **Hero.** `execution-map.astro` becomes the hero's primary visual, either
  by moving it into `promise-section.astro` or by promoting it into a new
  `hero-section.astro` that wraps the promise copy. The ordered textual
  equivalent stays.
- **Mobile path.** Author a CSS-grid vertical variant of the map that
  renders under a media query breakpoint; the horizontal SVG becomes
  desktop-only. Both variants read the same source data structure so future
  edits happen in one place.
- **Macro-layout families.** Introduce two or three additional layout modes
  in `site.css` beyond the current full-width shell: `layout--split` (image +
  copy), `layout--path` (numbered narrative alongside a rail), and
  `layout--ledger` (compact stat band). Existing rhythm stays as the default;
  the new layouts are opt-in per section.
- **Small honest fixes.** Publication date semantics; install-command
  feedback slot; hover/focus/pressed states from Phase 2's token layers;
  intentional `touch-action` and tap-highlight.

## Related Code Files

- Modify: `apps/site/src/pages/index.astro`
- Modify: `apps/site/src/components/promise-section.astro`
- Modify: `apps/site/src/components/execution-map.astro`
- Modify: `apps/site/src/components/install-command.astro`
- Create: `apps/site/src/components/hero-section.astro` (if the map lives in
  a wrapper rather than in the promise section)
- Modify: `apps/site/src/styles/site.css` — consume Phase 2 tokens; drop
  ad hoc state styles; add `layout--split`/`layout--path`/`layout--ledger`
- Modify: `apps/site/src/components/evidence-ledger.astro` and
  `provider-projection.astro` — if either fits the new macro-layouts
- Modify: `tests/site/*` — extend landing-consistency test to assert (a)
  execution map is above the first divider, (b) at least three distinct
  layout classes appear on the home page, (c) `<time datetime>` present,
  (d) mobile execution path renders without horizontal scroll at 320px

## Implementation Steps

1. **Hero rework.** Move the execution map into the hero region; keep the
   ordered list as `<figcaption>`. Verify screen-reader reading order.
2. **Mobile vertical path.** Add the CSS-grid vertical variant; hide the
   horizontal SVG on narrow viewports; both share source data.
3. **Macro-layouts.** Author `layout--split`, `layout--path`, `layout--ledger`
   in `site.css` using Phase 2 tokens. Apply to one or two existing sections
   so the page has visible macro contrast.
4. **Copy state layers.** Remove ad hoc hover styles; consume the Phase 2
   state-layer tokens.
5. **Install command feedback.** Stable slot; label change on interaction
   instead of row insertion.
6. **Semantic time.** `<time datetime="…">` + `Intl.DateTimeFormat` on the
   publication label.
7. **Tests.** Extend landing-consistency with the four assertions above;
   run the size budget test to confirm no regression.

## Success Criteria

- [ ] Execution map is the hero region's primary visual on desktop and
      mobile.
- [ ] At least three distinct macro-layout classes appear across the home.
- [ ] Mobile execution path renders vertically without horizontal scroll at
      320px.
- [ ] Publication date is a semantic `<time>` element with a locale-formatted
      label.
- [ ] Install-command feedback replaces the row-insertion pattern.
- [ ] No verified claim, metric, or route was removed or fabricated.
- [ ] `pnpm run test:qualification` green.

## Risk Assessment

- **Moving the map breaks the ordered-list accessibility pattern.** Signal:
  screen reader announces map twice. Response: keep the SVG `aria-hidden`
  when a textual `<figcaption>` covers the same information; do not add a
  second list.
- **Static size budget is fragile.** Signal: budget test fails after the new
  layouts. Response: audit the size test's rationale; either shave (SVG
  compression, unused CSS) or, if the budget was set for the old
  composition, get the deployment contract owner to bump it explicitly.
- **Macro-layout classes drift into docs.** Signal: docs picks up a
  `layout--split` accidentally. Response: keep the class prefix scoped to
  `apps/site/`; docs uses shell dimensions from tokens but not marketing
  layouts.
