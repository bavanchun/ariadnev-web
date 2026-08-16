---
title: "ariadnev web UI/UX upgrade"
description: "Close the site/docs UX gap called out in the 2026-08-16 whole-site audit: safe mobile navigation, grouped IA, real content primitives, a per-command CLI reference, and a marketing surface that leads with execution cartography — without touching product claims, release routes, or the URL/locale contract."
status: pending
priority: P1
effort: "3-4w wall time across six phases"
tags: [web, docs, site, ux, accessibility, design-system]
created: 2026-08-16
---

# ariadnev web UI/UX upgrade

## Overview

The audit `plans/reports/audit-260816-2007-ui-ux-whole-site.md` (2026-08-16)
graded the marketing site 7–8/10 and docs 4–5/10 across information
architecture, responsive UX, hierarchy, and interaction. The engineering
foundation is strong — shared tokens, focus rings, skip links, semantic
landmarks, reduced-motion, honest content, static delivery. The blockers are
compositional and structural, concentrated in the docs product.

This plan implements the audit's five-phase roadmap in that order, with an
explicit UX-safety sweep (Phase 1) landing before design-system work (Phase 2)
so the P0 clipping/discoverability defects stop harming users on the first
merge. Two design decisions are locked and one is deliberately deferred; see
*Contract* and *Open questions* below.

## Contract (2026-08-16)

**Outcome.** The docs product supports both tasks (guides) and lookup
(references) at 320/375/390/768/1440 without clipping, hidden navigation, or
locale-untranslated chrome. The marketing site leads with the execution path
and carries distinct macro-layouts. Both surfaces share the same semantic
state vocabulary (hover/focus/pressed/selected/disabled/loading) through
tokens, not through copied framework components.

**Constraints (from the audit's *Preserve during implementation*, plus repo
rules).**

- Do not change verified product claims, release routes, generated-source
  authority (`packages/contracts`, `packages/tokens/dist/*`), or the
  locale/version URL contract.
- Do not hand-edit generated MDX under `apps/docs/content/generated/`.
- Do not replace semantic HTML with custom ARIA unless full keyboard behavior
  is implemented (roving focus, Escape, focus return, outside-click).
- Do not add a new accent family. Spectral (execution) and copper (human gates)
  already carry meaning; extend them, do not multiply them.
- Do not weaken existing token, contrast, font, static-output, or docs-content
  tests. New tests may be added; existing assertions stay.
- Every change ships through `pnpm run test:qualification` and the same
  deployment path the 1.1.0 cutover used.

**Non-goals.**

- No product content rewrite. The audit is about surface, not truth.
- No new locale beyond EN/VI.
- No swap of Astro (site) or Next+Fumadocs (docs); framework identity stays.
- No CMS. Authored content stays MDX; generated content stays bundle-derived.
- No marketing analytics or third-party embeds.

**Acceptance criteria (whole plan; each phase carries its own).**

- Zero clipped content and zero hidden discoverability at 320/375/390/768/1440
  across site, docs shell, and all 15 authored pages plus every generated page.
- All application chrome (docs shell, switcher, search dialog, breadcrumb,
  skip link, pager, empty/error states) localized for VI in addition to EN.
- CLI reference is split: an index page plus one page per command; the current
  monolith URL either redirects to the new index or continues to serve the
  aggregated view without breaking search deep-links.
- Shared design tokens define interactive state layers, code/data surfaces,
  and shell dimensions; docs and site both consume them from `packages/tokens`.
- Screenshot baselines exist at 320/375/768/1280/1440 for site home, docs
  home, one guide, one provider page, one CLI command page, the CLI index,
  search open, switcher open, 404, and not-found — and the CI harness fails
  a PR that regresses them without an explicit baseline update.
- Lighthouse ≥95 accessibility on production output for site and docs, with
  the label-content-name mismatch noted in the audit cleared.
- All existing `test:qualification` gates stay green; new tests added by this
  plan run in the same command.

## Goals

| # | Goal | Priority |
|---|------|----------|
| 1 | Kill the P0 UX defects — clipped provider table, invisible mobile pages, misleading `menu` semantics — before doing anything else | P1 |
| 2 | Extend shared tokens so site and docs stop diverging invisibly | P1 |
| 3 | Give docs a real shell (grouped nav, mobile drawer, active TOC, pager) | P1 |
| 4 | Ship a first-class content primitive set and split the CLI reference | P1 |
| 5 | Recompose the marketing home so the execution path is the hero | P2 |
| 6 | Prevent regressions with a real screenshot + keyboard verification harness | P1 |

## Phases

| # | Phase | Depends on | Status |
|---|-------|------------|--------|
| 1 | [UX safety and mobile navigation](./phase-01-ux-safety-and-mobile-navigation.md) | — | Pending |
| 2 | [Shared design tokens and shell primitives](./phase-02-shared-design-tokens-and-shell-primitives.md) | 1 | Pending |
| 3 | [Docs shell: grouped navigation, mobile drawer, active TOC, pager](./phase-03-docs-shell-grouped-navigation-mobile-drawer-active-toc-pager.md) | 1, 2 | Pending |
| 4 | [Content primitives and CLI reference split](./phase-04-content-primitives-and-cli-reference-split.md) | 2 | Pending |
| 5 | [Marketing visual upgrade](./phase-05-marketing-visual-upgrade.md) | 2 | Pending |
| 6 | [Verification harness and polish](./phase-06-verification-harness-and-polish.md) | 1, 2, 3, 4, 5 | Pending |

Phase 1 exists so users stop being harmed before design-system work starts.
Phases 4 and 5 both depend on Phase 2 but not on each other — they may run in
parallel once tokens are in. Phase 6 is deliberately last; adding a screenshot
harness during composition churn produces churn, not signal.

## Locked decisions

- **Split CLI reference into one URL per command.** The monolith renders 132
  TOC entries and 45 option tables; filter-in-place would only hide them.
  Phase 4 emits `/reference/cli/` as the index and `/reference/cli/<command>/`
  per command from the same source contract. Old `/reference/cli/` keeps
  redirect parity or serves the aggregate — resolved during Phase 4.
- **VI locale is URL-only, no memory.** No cookie, no localStorage, no
  auto-redirect. Deep links stay predictable and there is no cookie-banner
  question to litigate.

## Open questions

1. **Docs light mode.** Default to keep dark-only, matching the current design
   contract. Revisit before Phase 3 lands. If light mode ships, it lands as a
   Phase 3 addition, gated behind an explicit user toggle (not
   `prefers-color-scheme`), and tokens for both must satisfy the same contrast
   budget the current palette does.

Both locked decisions (CLI split, VI URL-only) were confirmed by the user on
2026-08-16.

## Cost and honesty notes

- The docs shell rewrite (Phase 3) is the largest single change. It touches
  `docs-shell.tsx`, `locale-version-switcher.tsx`, `page.tsx`, `layout.tsx`,
  and `docs.css` at once. Splitting it further would push the release before
  keyboard/menu semantics were fixed, which is the opposite of the audit's
  intent.
- The CLI split (Phase 4) is a URL-shape change. The current `/reference/cli/`
  URL is referenced from search indexes and external links. The plan preserves
  a redirect path rather than breaking those links; if the redirect turns out
  to be unimplementable at the edge, the aggregate view stays and the
  per-command pages become additive.
- Phase 6 pays for itself only if it runs *after* the composition churn is
  over. Adding it earlier would cost baseline resets on every phase.

## Success Criteria

- [ ] Every phase's own acceptance criteria met and checked off.
- [ ] `pnpm run test:qualification` green.
- [ ] Screenshot baselines at 320/375/768/1280/1440 exist and gate CI (Phase 6).
- [ ] Lighthouse ≥95 accessibility on docs production output.
- [ ] Zero P0 findings from the audit remain open.
- [ ] All P1 findings are either closed or explicitly deferred with a written
      trade-off.
- [ ] `docs.ariadnev.com/en/stable/` and `/vi/stable/` present a shell that
      exposes all 15 pages without horizontal swiping on 320px.
- [ ] `ariadnev.com` uses ≥3 distinct macro-layouts across the home page.

<!-- slug: ariadnev-web-uiux-upgrade -->
