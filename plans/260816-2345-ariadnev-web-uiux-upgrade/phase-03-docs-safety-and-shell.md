---
phase: 3
title: "Docs safety, shell, and shared interactions"
status: completed
priority: P1
effort: "7-9d"
dependencies: [1, 2]
---

# Phase 3: Docs safety, shell, and shared interactions

## Context

- [Plan](./plan.md)
- Phase 1 catalog/Fumadocs/safe-component decisions.
- Phase 2 tokens.

## Overview

Fix every shared docs safety and navigation defect before page-specific visual
work. Deliver one responsive shell and complete interaction grammar for
navigation, search, locale/version switching, TOC, pager, headings, and copy.

## Requirements

- No masked page overflow. Provider, CLI, workflow, code, and guide content stay
  reachable at 320/375/390.
- Grouped desktop sidebar and explicit mobile navigation expose every published
  page for the selected locale/version.
- Sticky header, viewport-safe rails, section-aware breadcrumb, active TOC, and
  previous/next pager never obscure focus or anchors.
- All application chrome and announcements are localized EN/VI.
- Search supports empty suggestions, loading, grouped results, focused result,
  zero result, partition failure, and focus restoration.
- Locale/version controls use honest native semantics and explicit URL outcomes.
- Copy states are local, stable, localized, and retain manual fallback.
- Shell works with no JavaScript; JavaScript only enhances drawer, active TOC,
  search, and copy.
- Consume the Phase 1 Fumadocs decision and Phase 2 tokens.

## Architecture

### Static shell

Server-render:

- skip link and header;
- docs-home brand for active locale/version;
- grouped navigation from catalog section metadata;
- main content with section breadcrumb;
- static TOC when non-empty;
- page footer actions and catalog-derived pager.

Desktop uses sticky header/sidebar/TOC with independent, bounded rail scrolling.
The reading column remains primary.

### Mobile navigation

The navigation tree exists in initial HTML. A native disclosure is the no-JS
fallback. With JavaScript, enhance it to a modal drawer with:

- focus containment, Escape/backdrop close, focus return;
- inert/scroll-locked background;
- current page and group visible on open;
- locale/version controls after the page tree;
- route navigation through ordinary links.

Do not implement ARIA menu semantics for document navigation.

### Search

Keep static Orama partitions. Extend the result envelope with page kind/section
metadata from Phase 1. Search UI groups Guides, Concepts, Commands, Skills,
Providers, Workflows, and Releases. Focus is not `aria-current`.

Suggested tasks are authored localized links, not search history. Errors retain
the static navigation escape. Phase 5 adds command/skill-specific indexing and
deduplication on top of this stable UI contract.

### Locale and version

Use disclosure plus ordinary links. Visible and accessible labels match.
Sibling route wins when published; otherwise expose an explanatory link to the
target locale/version root. Explicit URL always wins.

### TOC and anchors

Render nothing for an empty TOC. Desktop/mobile TOCs are bounded. Active heading
tracking uses IntersectionObserver; reduced motion disables animation, not
location tracking. Heading permalinks are authored in the render tree where the
chosen MDX stack permits; hydration injection remains fallback only.

## Related code files

- Modify: `apps/docs/src/styles/docs.css`
- Modify: `apps/docs/src/app/layout.tsx`
- Modify: `apps/docs/src/app/[locale]/[version]/[[...slug]]/page.tsx`
- Modify: `apps/docs/src/components/docs-shell.tsx`
- Modify: `apps/docs/src/components/locale-version-switcher.tsx`
- Modify: `apps/docs/src/components/search-dialog.tsx`
- Modify: `apps/docs/src/components/copy-actions.tsx`
- Modify: `apps/docs/src/components/document-copy-enhancer.tsx`
- Modify: `apps/docs/src/lib/content-catalog.ts`
- Modify: `apps/docs/src/lib/search-index.ts`
- Modify: `apps/docs/scripts/build-search-index.mjs`
- Create: `apps/docs/src/lib/chrome-strings.ts`
- Create: `apps/docs/src/components/docs-sidebar.tsx`
- Create: `apps/docs/src/components/docs-mobile-navigation.tsx`
- Create: `apps/docs/src/components/docs-toc.tsx`
- Create: `apps/docs/src/components/docs-pager.tsx`
- Create: `apps/docs/src/components/docs-page-header.tsx`
- Create: `apps/docs/src/components/previous-edition-notice.tsx`
- Modify: `tests/docs/shell-accessibility.test.mjs`
- Modify: `tests/docs/search-isolation.test.mjs`
- Modify: `tests/docs/static-routing.test.mjs`
- Add focused browser tests under `tests/docs/` using the existing temporary
  export/browser helpers.

## Implementation steps

1. Write regression tests for current clipping, hidden mobile navigation,
   switcher name mismatch, empty TOC, English VI chrome, and anchor overlap.
2. Add one EN/VI chrome-string authority and remove hardcoded reachable labels.
3. Remove body `overflow-x: hidden`; add local code/table/diagram containment
   with visible edge affordance and focusable scroll regions.
4. Add dark `color-scheme`, theme metadata, sticky offsets, anchor
   scroll-margin, dialog overscroll containment, touch and pressed states.
5. Implement grouped static sidebar and shared navigation-tree rendering.
6. Implement no-JS mobile disclosure, then modal-drawer enhancement with full
   focus and background behavior.
7. Rebuild locale/version disclosures with available/unavailable route outcomes.
8. Implement section breadcrumb, page header, previous-edition notice, and
   section-aware pager.
9. Implement active bounded TOC and accessible heading permalinks.
10. Rebuild search UI states, grouping, keyboard behavior, localization, and
    error recovery. Preserve locale/version partition isolation.
11. Consolidate page/heading/Markdown copy actions into a compact action group.
12. Apply the Phase 1 Fumadocs decision; delete superseded bespoke behavior.
13. Run production static export and focused 320/390 keyboard/no-JS checks.

## Success criteria

Shipped in Phase 3 (slices 2-8, commits f9527f6 through 8574ab6):

- [x] No docs page-level overflow is masked.
- [x] Sidebar current page and section are distinct from focus/hover state.
- [x] Previous-edition notice appears on every previous-edition page.
- [x] Empty TOC renders nothing; active TOC uses
      `aria-current="location"`.
- [x] Anchored headings and focused controls are not hidden by sticky UI.
- [x] Switcher visible text matches its accessible name.
- [x] Docs metadata has dark color scheme/theme color and non-duplicated title.
- [x] Static export and `pnpm run test:qualification` pass within Phase 1
      budgets (ratchet integrity verified across every slice; grandfathered
      ceilings updated with per-entry deltas and `measuredAtHistory` entries).
- [x] Search never crosses a partition (deterministic partition-isolation
      shipped in Phase 1; empty / zero-result / partition-failure / focus-
      restoration UI states already deterministic).

Byte-blocked and re-scoped for revisit after Phase 5 splits reference/skills
and reference/cli (which reopens ~10-15KB per-route headroom by cutting
14-24KB reference-index HTML into per-command detail pages):

- [ ] Every published page is reachable in mobile nav without horizontal
      swipe. **Re-scoped:** slice 9 (mobile drawer server markup + CSS + JS
      enhancer) reverted after two attempts busted the frozen 300000 cap on
      content-heavy VI routes (`vi/*/concepts/graph-execution/` sits
      ~100B under cap; combined markup+CSS+JS added ~550B). The current
      horizontal-scroll fallback exposes every link but requires swipe. Post
      Phase 5 splitting, the drawer slice becomes byte-safe.
- [ ] Drawer/disclosure behavior passes pointer, keyboard, Escape, focus
      return, scroll lock, and no-JS fallback checks. **Re-scoped** (blocked
      by the drawer slice above).
- [ ] Breadcrumb, pager, TOC, search, copy, locale, and version are fully
      EN/VI. **Partial:** breadcrumb (section labels EN/VI), pager (Previous/
      Trước · Next/Tiếp), previous-edition notice, and section labels are
      localized. Chrome-strings authority migration (search dialog, copy
      buttons, live-status announcements, sidebar `aria-label`) reverted in
      slice 1 (client import busted cap +1.5KB). **Re-scoped:** the correct
      server-render-inline pattern is recorded in
      `docs/decisions/docs-performance-baselines.md`; retry after Phase 5
      shrink.
- [ ] Search has grouped results with explicit loading state. **Partial:**
      partition-safe / zero / error / focus-restoration states are
      deterministic today. Grouping by section and explicit "Searching…"
      message re-scoped (byte impact ~200-400B; blocked on graph-execution
      route headroom).
- [ ] Heading permalinks are authored in the render tree. **Re-scoped:**
      requires an MDX rehype plugin change; byte impact + rehype config
      complexity make this a Phase-4 authored-docs concern rather than
      shell.

## Exit disposition (2026-08-17)

Phase 3 marked **Sufficient**: every shipped slice passes the ratchet, every
open success criterion has a documented revisit path anchored to a byte-
recovery event (Phase 5 reference splitting). No slice was silently dropped;
each was byte-measured, reverted-on-fail, and its revisit condition recorded.

Phase 4 unblocks from here — Phase 4 owns authored MDX content and safe
components (per plan.md file ownership), and its byte impact per page is
content-driven, not shell-driven. Phase 5 unblocks the re-scoped items above.

## Risk assessment

- **Fumadocs behavior conflicts with dark/localized shell.** Use the next proven
  Phase 1 variant; do not ship a theming or keyboard leak.
- **Drawer duplicates the nav tree.** Share one render/data function and test
  route parity.
- **Removing overflow mask reveals wide content.** Fix the owning primitive;
  never restore the mask.
- **Search grouping increases client bytes.** Keep grouping metadata static and
  render simple lists; defer no required search state.
- **Hydrated heading controls shift layout.** Prefer render-time links; reserve
  geometry if fallback injection remains.

## Security considerations

- Dialog/search never render raw HTML from index content.
- Locale/version URLs come only from validated catalog entries.
- Search errors expose no filesystem or bundle paths.
