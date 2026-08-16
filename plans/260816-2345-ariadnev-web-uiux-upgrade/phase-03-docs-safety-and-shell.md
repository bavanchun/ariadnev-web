---
phase: 3
title: "Docs safety and shell"
status: pending
priority: P1
effort: "7-10d"
dependencies: [1, 2]
---

# Phase 3: Docs safety and shell

## Overview

Fix the docs product's structural defects in the order the brainstorm requires:
**clipping and semantics first**, then navigation, search, active TOC,
localization, and page templates. This phase absorbs the audit's P0/P1
mobile-navigation work into the same PR range as the shell rewrite so the shell
does not merge on top of a still-clipping surface.

## Requirements

- Functional (safety, ships first inside this phase): no viewport ≤390px clips
  content; all 15 authored pages discoverable without horizontal swipe; the
  locale/version switcher's Lighthouse accessibility-name mismatch cleared;
  `role="menu"` gets full keyboard behavior *or* is replaced with a disclosure
  + `<a>`; dark `color-scheme` and `theme-color` set; anchored headings honor
  a scroll-margin token; modal has `overscroll-behavior: contain`.
- Functional (shell): sidebar groups pages under section headings and marks
  the current one; mobile drawer exposes the same grouped tree and closes on
  navigation; desktop TOC tracks the active heading via IntersectionObserver
  with prefers-reduced-motion honored; breadcrumb reads `Docs / <section> /
  <page>` in the active locale; every content page ends with a previous/next
  pager honoring section boundaries; page-kind templates render landing,
  concept, guide, reference, and release-note pages instead of forcing every
  page through one composition; sticky header does not overlap anchored
  headings.
- Functional (VI): all application chrome — sidebar section names, TOC title,
  pager labels, breadcrumb section, empty state, skip link, switcher labels,
  search dialog copy, status announcements — is localized.
- Non-functional: keyboard-only journey from skip link to any page and back;
  screen-reader landmark structure retained; consumes only Phase 2 tokens
  (no ad hoc CSS state layers); consumes the Fumadocs variant chosen by
  Phase 1's spike; static-size budget from Phase 1's measurement respected.

## Architecture

The shell splits into three responsibilities, sequenced so safety merges
first:

- **Safety pass (internal step 1).** Overflow honesty on both apps; drawer
  MVP replacing the horizontal nav strip; switcher semantics (visible ==
  accessible; disclosure + `<a>` unless full menu keyboard behavior is
  implemented); dark `color-scheme` and `theme-color`; scroll-margin on
  anchored headings; modal overscroll; chrome strings module for VI.
- **`docs-shell.tsx` (structural).** Owns the layout grid, sticky header
  slot, sidebar mount, TOC mount, breadcrumb, and pager. Reads catalog page
  metadata and current page from props; makes no fetches, no client-only
  data. Consumes Phase 2 shell-dimension tokens.
- **`docs-sidebar.tsx` (new).** Renders the grouped tree from catalog data.
  Section headings derive from the first slug segment. On desktop, groups
  are collapsible (`<details>`); the current section is always forced open
  by URL, so no memory is needed to satisfy the URL-only rule. On mobile,
  the sidebar is the drawer body.
- **`docs-toc.tsx` (new).** Reads headings from the rendered article, wires
  an IntersectionObserver to mark the active one, and renders nested `<ol>`
  by heading level. Empty TOC renders nothing.
- **`docs-pager.tsx` (new).** Derives sibling order from the catalog sort
  key on `content-catalog.ts:287`, so pager order and sidebar order share
  one authority. Section boundaries surface as
  `Next section: <localized name>` not silent jumps.
- **Page-kind templates.** `page.tsx` picks a template from the catalog
  entry's `pageKind` (from Phase 1's contract): `landing`, `concept`,
  `guide`, `reference`, `release-note`. Each template composes title,
  description, primary action, and body slots differently. Command detail
  pages stay out of the global sidebar to avoid navigation noise (per the
  brainstorm's CLI contract).

If Phase 1's spike picked full `DocsLayout` or primitive-level Fumadocs
adoption, the file list below reduces: sidebar, TOC, or code block ships as
a Fumadocs primitive; the wrapper stays local for section grouping and VI
chrome.

## Related Code Files

- Modify: `apps/docs/src/styles/docs.css` — overflow, `color-scheme: dark`,
  `theme-color`, scroll-margin token, modal `overscroll-behavior`, table
  wrapper, consume Phase 2 tokens for shell dimensions and state layers;
  drop ad hoc equivalents
- Modify: `apps/docs/src/components/docs-shell.tsx`
- Modify: `apps/docs/src/components/locale-version-switcher.tsx` — either
  full menu keyboard behavior or `<details>` + `<a>` replacement; VI copy
- Modify: `apps/docs/src/components/search-dialog.tsx` — `aria-current` fix,
  VI copy, mobile hint, zero-state suggested queries
- Modify: `apps/docs/src/app/layout.tsx` — `theme-color`, `color-scheme`
  metadata, dedupe title template
- Modify: `apps/docs/src/app/[locale]/[version]/[[...slug]]/page.tsx` — mount
  pager and breadcrumb, pick page-kind template
- Modify: `apps/docs/src/components/document-copy-enhancer.tsx` — reveal
  heading link on hover/focus-within instead of the persistent `#` marker
- Modify: `apps/docs/src/lib/content-catalog.ts` — derive `section` and
  siblings if not already present; keep contract additive
- Create: `apps/docs/src/lib/chrome-strings.ts` — EN/VI copy for every
  chrome surface listed under VI Requirements
- Create: `apps/docs/src/components/docs-sidebar.tsx`
- Create: `apps/docs/src/components/docs-toc.tsx`
- Create: `apps/docs/src/components/docs-pager.tsx`
- Create: `apps/docs/src/components/page-templates/{landing,concept,guide,reference,release-note}.tsx`
- Modify: `tests/docs/*` — extend for overflow guard, drawer focus trap,
  active TOC tracking, pager section boundaries, VI chrome parity,
  switcher accessible name matches visible label, page-kind template
  routing

## Implementation Steps

### Safety first (internal step 1, ships early in the phase)

1. **Chrome strings module.** Extract every hardcoded English label reachable
   from a VI route into `chrome-strings.ts` keyed by locale. This unblocks
   switcher, search dialog, drawer, and pager in one place.
2. **Overflow sweep.** Remove `overflow-x: hidden` from both apps' body/html.
   Add measured `overflow-x: auto` on `pre`, code blocks, `.docs-table`
   wrapper, and every explicit wide asset. 320px render pass over provider,
   CLI, workflows references and every guide.
3. **Drawer MVP.** `<details>` disclosure at the top of the docs shell on
   `< md`, listing catalog pages under section headings. This is the safety
   floor; the polished grouped sidebar replaces it later in the same phase.
4. **Switcher rework.** Prefer disclosure + `<a>` links; keep the menu only
   if full keyboard handling (Arrow/Home/End/Escape/focus return/roving)
   ships in the same edit. Either way, visible label == accessible name.
5. **Meta.** `color-scheme: dark`, docs `theme-color`, scroll-margin token
   on anchored headings, `overscroll-behavior: contain` on modal, dedupe
   `layout.tsx` title template.

### Shell (internal step 2)

6. **Catalog derivations.** Add `section` and sibling links to catalog if
   not derived already, additively.
7. **Sidebar.** Ship the grouped desktop tree using `<details open>` per
   section with the current section forced open; replace the drawer MVP
   with the same grouped tree in mobile.
8. **Drawer polish.** Add focus trap on open, restore focus on close,
   dismiss on route change.
9. **TOC.** Client component with IntersectionObserver; falls back to
   static list without tracking dot if JS is disabled or reduced-motion
   is set.
10. **Pager.** Consume sibling metadata from the catalog; section boundaries
    surface with a localized `Next section:` label.
11. **Breadcrumb + heading link.** Rewrite breadcrumb to expose section;
    swap the persistent `#` for a reveal-on-hover/focus icon.

### Page-kind templates (internal step 3)

12. **Templates.** One component per page kind (`landing`, `concept`,
    `guide`, `reference`, `release-note`). `page.tsx` picks by
    `catalog[currentPage].pageKind` from Phase 1's contract.
13. **Consume Phase 2 tokens** everywhere; delete surviving ad hoc CSS.
14. **Fumadocs adoption** to the level Phase 1's spike decided. If
    `DocsLayout` won, wrap it and inject the grouped sidebar + VI chrome
    strings; if primitive-level won, adopt TOC / code block / callout
    from Fumadocs and keep the rest local; if bespoke won, ship as
    designed above.

### Tests (internal step 4)

15. Extend the docs test suite for: no `overflow-x: hidden` on docs body,
    drawer opens on click and traps focus, VI route renders VI chrome
    strings, switcher's `aria-label` == visible text, `theme-color`
    present, sidebar grouped tree in catalog order, TOC updates active
    heading on simulated scroll, pager crosses section boundaries with
    labeled hint, page-kind template routes correctly.

## Success Criteria

- [ ] Provider, CLI, and workflow references render without clipping at 320px.
- [ ] All 15 catalog pages reachable from the drawer at 320px with zero
      horizontal scroll.
- [ ] Lighthouse label-content-name mismatch cleared.
- [ ] `role="menu"` either has full keyboard behavior or has been replaced
      with `<details>` + `<a>`.
- [ ] `<html lang="vi">` on VI routes with a regression guard.
- [ ] Docs `color-scheme: dark` and `theme-color` present in production HTML.
- [ ] Sidebar groups all 15 pages under section headings in catalog order;
      current page and section marked.
- [ ] Mobile drawer traps focus, restores focus on close, dismisses on route
      change.
- [ ] Desktop TOC marks the active heading; empty TOC does not render.
- [ ] Every content page ends with a working previous/next pager respecting
      section boundaries.
- [ ] Breadcrumb reads section + title in the active locale.
- [ ] Sticky header does not overlap anchored headings; scroll-margin honors
      the header-height token.
- [ ] VI chrome complete across sidebar, TOC, pager, breadcrumb, switcher,
      search, and empty states.
- [ ] Page-kind templates route from `pageKind` metadata; each kind
      renders a distinct composition.
- [ ] `pnpm run test:qualification` green; static-size budget respects
      Phase 1's decision.

## Risk Assessment

- **Fumadocs adoption arrives with unresolved theming leaks.** Signal: dark-
  only guarantee breaks under `DocsLayout`. Response: fall back to the next
  spike variant Phase 1 measured; the decision doc names it.
- **Overflow removal exposes a real regression.** Signal: a route
  horizontal-scrolls at 320px. Response: this is the intended outcome; fix
  the underlying overflow (wrap the table, shorten a label) rather than
  restoring the mask.
- **Sidebar collapse state fights the URL-only rule.** Signal: users lose
  expanded groups on navigation. Response: current section always forced
  open by URL; other sections default closed. No memory needed.
- **TOC IntersectionObserver mis-tracks on long single-section pages.**
  Signal: two headings appear active. Response: use root-margin plus a
  first-in-viewport tiebreak; document the algorithm in code.
- **Static output budget breaks from added TS.** Signal: Wrangler size test
  fails. Response: consult Phase 1's budget decision doc first; do not
  silently bump.
- **Page-kind template count balloons.** Signal: designs demand a sixth or
  seventh kind. Response: reuse the existing five; new kinds require a
  written justification in the Phase 1 contract, not template proliferation
  in this phase.
