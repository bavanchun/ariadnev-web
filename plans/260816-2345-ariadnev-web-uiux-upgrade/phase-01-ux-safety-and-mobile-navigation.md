---
phase: 1
title: "UX safety and mobile navigation"
status: pending
priority: P1
effort: "3-4d"
dependencies: []
---

# Phase 1: UX safety and mobile navigation

## Overview

Close every **P0** finding from the audit before touching design-system work.
Users currently see clipped content, discover 3 of 15 pages on a 320px viewport,
and get misleading `menu` semantics from a switcher that has no keyboard
behavior. Fixing this first means every later phase merges onto a shell that is
no longer harming readers.

## Requirements

- Functional: no viewport ≤390px clips content on any docs or site route; all
  15 authored docs pages are discoverable without horizontal swipe; the
  locale/version switcher's Lighthouse accessibility-name mismatch is cleared;
  the `role="menu"` gets full keyboard behavior *or* is replaced with a
  disclosure + `<a>` links.
- Non-functional: no test regressions; no change to `packages/tokens` (belongs
  to Phase 2); no change to the URL or catalog contract.

## Architecture

Three anchors:

- **Overflow honesty.** Replace `overflow-x: hidden` with measured containment
  on both `apps/docs/src/styles/docs.css:60` and `apps/site/src/styles/site.css:44`.
  Tables and code blocks get a scroll parent explicitly, so an unexpected
  overflow becomes a caught bug rather than a mask.
- **Mobile drawer, minimum viable.** Replace the horizontal nav strip in
  `docs-shell.tsx:40` with a disclosure button that opens a drawer listing all
  catalog pages grouped by section. The full grouped desktop rewrite is Phase
  3; this step's job is to stop hiding pages behind horizontal scroll.
- **Honest semantics.** Rework `locale-version-switcher.tsx` so visible label
  ("Language · EN") matches accessible name ("Language: English") — either by
  moving the full label into the DOM or by using `aria-label` that mirrors the
  visible text word-for-word. Same for Version. Add keyboard handling
  (Arrow/Home/End/Escape, focus return, outside-click, roving focus) *or*
  swap `role="menu"`/`menuitem` for `<details>` + real `<a>` links. Prefer the
  second — it is smaller, tested by the platform, and already localizable.

Other P0/P1 fixes fold into the same commit range: dark `color-scheme`,
`theme-color` metadata, `scroll-margin-top` on anchored headings, modal
`overscroll-behavior: contain`, table primitive (see Phase 4 for the full
component set; this phase only ships a *minimal* responsive wrapper).

## Related Code Files

- Modify: `apps/docs/src/styles/docs.css` (overflow, color-scheme, theme-color,
  scroll-margin-top, modal overscroll, table wrapper)
- Modify: `apps/docs/src/components/docs-shell.tsx` (drawer, VI chrome copy)
- Modify: `apps/docs/src/components/locale-version-switcher.tsx` (semantics +
  keyboard, or disclosure replacement; VI copy)
- Modify: `apps/docs/src/components/search-dialog.tsx` (`aria-current` fix, VI
  copy, mobile hint)
- Modify: `apps/docs/src/app/layout.tsx` (theme-color, color-scheme metadata,
  duplicated title template)
- Modify: `apps/site/src/styles/site.css` (drop body `overflow-x: hidden`;
  keep `.map__figure` containment)
- Create: `apps/docs/src/lib/chrome-strings.ts` (EN/VI copy for shell,
  switcher, search, pager placeholders — Phase 3 extends this)
- Modify: `tests/docs/*` — add or extend tests to assert: no `overflow-x:
  hidden` on docs body/html, drawer opens on click, VI page renders VI chrome
  strings, switcher's accessible name matches visible label.

## Implementation Steps

1. **Chrome strings module.** Extract every hardcoded English label reachable
   from a VI route into `chrome-strings.ts`, keyed by locale. This unblocks
   the switcher, search dialog, drawer, and skip link in one edit and gives
   Phase 3 a single place to extend.
2. **Overflow sweep.** Remove `overflow-x: hidden` from both apps' body/html
   layers. Add measured `overflow-x: auto` on `pre`, code blocks, `.docs-table`
   wrapper, and any explicit `.map__figure`-style wide asset. Run a 320px
   render pass over `provider`, `cli`, `workflows` references and every guide.
3. **Drawer.** Add a `<details>` disclosure at the top of the docs shell on
   `< md` viewports, listing catalog pages under section headings. Reuse
   section slugs (`get-started`, `concepts`, `guides`, `reference`) as
   headings — no new taxonomy invention here; Phase 3 owns grouping polish.
4. **Switcher rework.** Prefer the disclosure replacement: `<details>` +
   nested `<a href>` links per locale/version. If the visual result diverges
   from the current design too far, keep the button and add full keyboard
   handling — either way, visible == accessible.
5. **Meta and small fixes.** Add `color-scheme: dark`, docs `theme-color`,
   `scroll-margin-top` for anchored headings, `overscroll-behavior: contain`
   on the search modal, and dedupe the `layout.tsx` title template.
6. **Extend the docs test suite** to assert each of the above. Tests must
   fail if `overflow-x: hidden` returns, if a VI route renders EN chrome, if
   the switcher's `aria-label` disagrees with visible text, or if the
   `theme-color` metadata is missing.

## Success Criteria

- [ ] Provider, CLI, and workflow reference pages render without clipping at
      320px (Playwright screenshot + no scrollbar on `html`).
- [ ] All 15 catalog pages are reachable from the drawer at 320px with zero
      horizontal scroll.
- [ ] Lighthouse label-content-name mismatch cleared on the switcher.
- [ ] `role="menu"`/`menuitem` either has full keyboard behavior or is
      replaced with `<details>` + `<a>`.
- [ ] `<html lang>` is `vi` on VI routes (already true; regression guard added).
- [ ] Docs `color-scheme: dark` and `theme-color` present in production HTML.
- [ ] `pnpm run test:qualification` green with the new assertions.

## Risk Assessment

- **Overflow removal exposes a real regression.** Signal: a route that
  previously clipped now horizontal-scrolls at 320px. Response: this is the
  intended outcome; fix the actual overflow (wrap the table, tighten the code
  block, shorten a label) rather than restoring the mask.
- **Full menu keyboard behavior is bigger than expected.** Signal: PR grows
  past the phase's effort budget. Pre-decided response: swap to the
  disclosure replacement and defer roving-focus menu to Phase 3, where the
  full shell rewrite pays for the accessibility infrastructure once.
- **Chrome strings module fights an existing i18n approach.** Signal: docs
  library already ships a translations helper. Response: use that instead;
  the point is one place, not a new file.
