---
phase: 3
title: "Docs shell: grouped navigation, mobile drawer, active TOC, pager"
status: pending
priority: P1
effort: "5-7d"
dependencies: [1, 2]
---

# Phase 3: Docs shell — grouped nav, mobile drawer, active TOC, pager

## Overview

Rewrite the docs shell so the hierarchy that already exists in catalog slugs
(Get Started, Concepts, Guides, Reference) becomes visible chrome instead of a
flat list. Add sticky header, grouped/collapsible desktop sidebar, real mobile
drawer with search entry, sticky TOC with active-heading tracking, breadcrumbs
that expose the section, and previous/next pager. This phase makes the docs
product usable as a real reference product rather than a rendered catalog.

## Requirements

- Functional: (a) sidebar groups pages under section headings and marks the
  current one; (b) mobile drawer exposes the same grouped tree and closes on
  navigation; (c) desktop TOC tracks the active heading via IntersectionObserver
  with prefers-reduced-motion honored; (d) breadcrumb reads `Docs / <section>
  / <page>` in the active locale; (e) every content page ends with a
  previous/next pager honoring section boundaries; (f) sticky header stays
  visible on scroll and does not overlap anchored headings (uses the token
  from Phase 2).
- Non-functional: keyboard-only journey from skip link to any page and back;
  screen-reader landmark structure retained; no new framework component
  library added; VI chrome complete; no regression to static output budgets.

## Architecture

The shell splits into three responsibilities:

- **`docs-shell.tsx` (structural).** Owns the layout grid, sticky header
  slot, sidebar mount, TOC mount, breadcrumb, and pager. Reads catalog page
  metadata and current page from props; makes no fetches, no client-only data.
- **`docs-sidebar.tsx` (new).** Renders the grouped tree from catalog data.
  Section headings derive from the first slug segment; unlisted or hidden
  pages surface via a documented `hidden: true` flag on the catalog entry
  (added if not already present). On desktop, groups are collapsible
  (`<details>`), state persisted per session (URL-only per plan contract; no
  localStorage). On mobile, the sidebar is the drawer body.
- **`docs-toc.tsx` (new).** Reads headings from the rendered article, wires
  an IntersectionObserver to mark the active one, and renders nested `<ol>`
  by heading level. Empty TOC renders nothing (audit P0 on `docs-shell.tsx:17`).

Pager derives sibling order from the catalog itself — that ordering is
already the sort key on `content-catalog.ts:287` — so pager order and sidebar
order are the same authority, never divergent.

Chrome strings from Phase 1 extend: `section.getStarted`, `section.concepts`,
`section.guides`, `section.reference`, `pager.previous`, `pager.next`,
`toc.title`, `sidebar.title`, plus per-section descriptions for the empty
state on section index pages.

## Related Code Files

- Modify: `apps/docs/src/components/docs-shell.tsx`
- Create: `apps/docs/src/components/docs-sidebar.tsx`
- Create: `apps/docs/src/components/docs-toc.tsx`
- Create: `apps/docs/src/components/docs-pager.tsx`
- Modify: `apps/docs/src/lib/content-catalog.ts` — add optional `section` and
  `siblings` derivations if not already present; keep contract additive
- Modify: `apps/docs/src/lib/chrome-strings.ts` (from Phase 1) — extend keys
- Modify: `apps/docs/src/styles/docs.css` — consume Phase 2 tokens for shell
  dimensions, state layers, medium weight; delete ad hoc equivalents
- Modify: `apps/docs/src/app/[locale]/[version]/[[...slug]]/page.tsx` — mount
  pager, pass section metadata to breadcrumb
- Modify: `apps/docs/src/components/document-copy-enhancer.tsx` — reveal
  heading link on hover/focus-within instead of the persistent `#` marker
  (audit P2)
- Modify: `tests/docs/*` — extend tests for grouped nav, active TOC, pager
  ordering, keyboard journey, VI chrome parity

## Implementation Steps

1. **Catalog derivations.** Confirm slug-based section derivation is safe;
   if `content-catalog.ts` needs a `section` field, add it as a derived
   attribute (not a schema break) and update tests.
2. **Sidebar.** Ship the grouped desktop tree first, using
   `<details open>` per section with the current section forced open. Verify
   catalog order matches audit expectation (`get-started` → `concepts` →
   `guides` → `reference`).
3. **Drawer.** Reuse the sidebar body inside the Phase 1 disclosure; add
   focus trap on open, restore focus on close, dismiss on route change.
4. **TOC.** Client component with IntersectionObserver; falls back to static
   list without the tracking dot if JS is disabled or reduced-motion is set.
5. **Pager.** Consume sibling metadata from the catalog. Section boundaries
   surface as "Next section: <name>" instead of jumping into an unrelated
   area.
6. **Breadcrumb + heading link.** Rewrite breadcrumb to expose section;
   swap the persistent `#` for a reveal-on-hover/focus icon that still
   exposes an accessible name.
7. **Consume Phase 2 tokens.** Replace ad hoc CSS with shell dimension and
   state-layer tokens; delete dead rules.
8. **Tests.** Add: sidebar renders grouped tree in catalog order; drawer
   traps and restores focus; TOC updates active heading on scroll (JSDOM +
   simulated scroll); pager crosses section boundaries with labeled hint;
   VI route renders VI chrome for section names and pager labels.
9. **(Conditional) Light mode.** Only if the open question resolves in favor
   of light mode: land the toggle here, gated behind the explicit user
   control, backed by tokens that pass the same contrast budget. If deferred,
   this step is skipped.

## Success Criteria

- [ ] Sidebar groups all 15 pages under section headings in catalog order;
      current page and section are visually and semantically marked.
- [ ] Mobile drawer opens on tap, traps focus, restores focus on close, and
      dismisses on route change.
- [ ] Desktop TOC marks the active heading; empty TOC does not render.
- [ ] Every content page ends with a working previous/next pager that
      respects section boundaries.
- [ ] Breadcrumb reads section + title in the active locale.
- [ ] Sticky header does not overlap anchored headings; scroll-margin honors
      the header height token.
- [ ] Keyboard-only journey from skip link → drawer → any page → back exists
      and is tested.
- [ ] VI chrome is complete (sidebar section names, TOC title, pager labels,
      breadcrumb section, empty-state copy).
- [ ] `pnpm run test:qualification` green; static-size budget not regressed
      or, if regressed, the deployment contract owner explicitly bumped it.

## Risk Assessment

- **Sidebar collapse state fights the URL-only rule.** Signal: users lose
  their expanded groups on navigation. Response: the current section is
  always forced open by URL; other sections default closed. No memory is
  required to satisfy the audit.
- **TOC IntersectionObserver mis-tracks on long single-section pages.**
  Signal: two headings appear active. Response: use root-margin plus a
  first-in-viewport tiebreak; document the algorithm in a comment.
- **Static output budget breaks from added TS.** Signal: the Wrangler size
  test fails. Response: keep client components small; move server-only logic
  into `lib/`. If still too large, split the sidebar into a server tree +
  client disclosure controller.
- **Light-mode decision arrives mid-phase.** Signal: user chooses light mode
  after tokens land. Response: this phase treats it as additive (Step 9);
  its absence does not block the rest.
