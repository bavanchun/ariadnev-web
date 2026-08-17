---
phase: 7
title: "Full deterministic verification"
status: in-progress
priority: P1
effort: "5-7d"
dependencies: [1, 2, 3, 4, 5, 6]
---

<!-- 2026-08-17 status: bootstrap slices shipped —
- slice1: typed screen fixture manifest (tests/benchmarks/screen-
  fixtures.json) + validating gates (tests/docs/screen-fixture-
  manifest.test.mjs). Closes step 3.
- slice2: route-wide structural probes reading built HTML for every
  docs manifest fixture (lang/title/main/h1). Closes step 6 for the
  manifest-declared docs surface (full-catalog probes still route to
  the future Playwright harness).
Remaining: Playwright production config + deterministic server
lifecycle (steps 1-2), screenshot baselines (steps 4-5), cross-browser
critical journeys (step 8), no-JS + ≤2-interaction command journey
(step 9), fixed VI fixtures (step 10), axe + reflow + text-spacing +
forced-colors (step 11), task-outcome comparisons (step 12), Lighthouse
+ four-group performance gates (step 13), baseline/browser pinning
(step 14), test:qualification sharding (step 15), two-run flake
detection (step 16), runbook (step 17). Adding @axe-core/playwright
as a direct dev dep waits until the harness is in place. -->


# Phase 7: Full deterministic verification

## Context

- [Plan](./plan.md)
- Phase 1 performance baselines.
- M01–M02/D00–D18 completion evidence from Phases 3–6.

## Overview

Turn the complete redesign into deterministic release gates. Add visual
baselines, route-wide structural probes, keyboard/no-JS journeys, axe,
localization, search/route contracts, Lighthouse, and the four independent
performance budgets. This phase proves prior work; defects return to their owner
phase rather than becoming late untracked polish.

## Requirements

- Cover the exact brainstorm fixture set; never choose a random route.
- Run against built production output with tracked deterministic ports and clean
  process teardown.
- Preserve stable screenshots across CI through pinned browser/font environment.
- Test all catalog routes structurally and representative page kinds visually.
- Test generated command routes offline for cardinality/identity and sample them
  in browser.
- Run critical journeys in Chromium, Firefox, and WebKit; Chromium remains the
  sole screenshot-baseline browser.
- Verify reflow/zoom, text spacing, forced-colors semantics, and print-critical
  workflow output in addition to nominal viewport screenshots.
- Compare critical user-task outcomes with the pre-change baseline; do not call
  a visually improved path successful when it becomes harder to complete.
- Add `@axe-core/playwright` as a direct dev dependency.
- Wire required gates into `pnpm run test:qualification`.
- Keep qualification observable and shardable without making a gate optional.

## Architecture

### Deterministic fixture manifest

Create a typed manifest mapping screen IDs to canonical routes and locale:

- M01, M02;
- D00, D01, D02, D03, D06, D11, D12, one stable D13 command;
- D14, D15, D16, D17, D18.

Use 320, 768, and 1440 for every fixture. Add 375 and 1280 where a declared
breakpoint or composition materially changes. Chromium owns screenshot
baselines; semantic/keyboard tests remain browser-independent where practical.

### Route-wide probes

For every catalog route at 320/375/390:

- document language, title, landmarks, visible navigation, page identity;
- no page-level clipping/hidden overflow;
- local scrollers reachable and within viewport;
- sticky header does not cover anchor/focus target;
- VI chrome marker parity.

For every generated command route, use static contract tests for canonical ID,
search uniqueness, sidebar exclusion, sibling validity, Markdown discovery, and
retired behavior. Browser-test representative simple/dense/historical commands.

### Journeys

- Site: first viewport → Install/Docs; copy success and manual fallback.
- Docs keyboard: skip link → mobile nav → target → TOC → pager → back.
- Search: empty, loading, grouped results, exact command, zero, unavailable,
  Escape/focus return.
- Locale/version: sibling available, unavailable, previous, stable alias.
- No-JS: CLI index → command detail in ≤2 purposeful interactions.
- Previous edition: notice → historical reference → stable return.

Record deterministic outcome evidence for locale choice, installation, first
install, exact-command lookup, provider comparison, workflow understanding,
unavailable-context recovery, and migration-risk recognition. Use purposeful
interaction count, route correctness, required fact visibility, and recovery
success; elapsed time is informational unless the environment is controlled.

### Accessibility and localization

Run axe on every fixture and shared overlay state. Fail WCAG A/AA and serious/
critical best-practice violations. Any exact-rule suppression requires a
documented product rationale and expiry owner.

Use fixed VI fixtures for home, guide, CLI, provider, skills, workflow, release,
search, switcher, drawer, pager, copy, and not-found. Add static EN/VI
chrome-key parity. No random catalog selection.

### Performance

Gate the four Phase 1 metric groups independently:

- compressed transfer by representative route;
- total output/file count;
- search/discovery bytes/cardinality;
- route count/build duration/peak memory.

Lighthouse runs against production output for site and docs. Accessibility stays
at least 95 with no known critical/serious axe issue; performance/SEO/best
practice do not regress below their existing frozen or recorded baseline.

## Related code files

- Create: `playwright.config.ts`
- Create: `tests/visual/screen-fixtures.ts`
- Create: `tests/visual/site/*.spec.ts`
- Create: `tests/visual/docs/*.spec.ts`
- Create: `tests/visual/journeys/*.spec.ts`
- Create: `tests/visual/stress/*.spec.ts`
- Create: `tests/visual/__baselines__/**/*.png`
- Create: `tests/visual/lighthouse.mjs`
- Create: `tests/visual/performance-contract.mjs`
- Create: `tests/visual/task-outcomes.spec.ts`
- Create: `tests/visual/accessibility-modes.spec.ts`
- Modify: `tests/docs/run-browser-shell.mjs`
- Modify: `apps/docs/scripts/verify-static-budget.mjs`
- Modify: `tests/benchmarks/performance-budgets.json` only to add metric
  categories/caps established in Phase 1; never silently loosen existing caps.
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Create: `.gitattributes`
- Create: `docs/operations/visual-verification-harness.md`

## Implementation steps

1. Add direct axe dependency and production-output Playwright configuration.
2. Implement deterministic server lifecycle with fixed ports, PID ownership,
   readiness, teardown, and stale-owner diagnostics.
3. Add typed screen fixture manifest and fail if any required ID is absent.
4. Add M01/M02 screenshots and site keyboard/copy/no-JS assertions.
5. Add D00/D01/D02/D03/D06/D11/D12/D13/D14/D15/D16/D17/D18 screenshots.
6. Add route-wide 320/375/390 structural, overflow, language, and navigation
   probes across the full catalog.
7. Add shared-state journeys for drawer, search, switchers, TOC, pager, copy,
   previous edition, error, and unavailable states.
8. Run critical semantic/keyboard journeys in Chromium, Firefox, and WebKit.
9. Add no-JS and exact-command ≤2-interaction journeys.
10. Add fixed VI fixtures and static chrome-key parity tests.
11. Add axe, 200%/400% reflow, text-spacing, forced-colors, and print checks
    with a documented exact-rule suppression mechanism.
12. Add deterministic task-outcome comparisons for the eight critical tasks.
13. Add Lighthouse and four-group performance gates.
14. Add baseline update command and review policy; pin browser environment.
15. Wire deterministic shards into `test:qualification`; measure end-to-end
    time and parallelize without skipping.
16. Run from clean build twice to detect flaky screenshots, leaked processes,
    nondeterministic routes, or output drift.
17. Write runbook: local commands, CI shards, failure triage, baseline changes,
    axe policy, and process cleanup.

## Required visual fixtures

| IDs | Widths |
|---|---|
| M01, M02, D00, D01, D02, D03, D06, D11, D12, D13, D14, D15, D16, D17, D18 | 320, 768, 1440 |
| Screens crossing a declared tablet/desktop breakpoint | 375 and/or 1280 additionally |

The four mandatory stress specs run every qualification:

1. CLI index at 320px.
2. Provider reference at 320px.
3. Desktop CLI lookup/orientation.
4. Complete fixed VI route and chrome-state journey.

## Success criteria

- [ ] Fixture manifest contains every required screen ID and canonical route.
- [ ] Required screenshots are committed and deterministic.
- [ ] Full catalog structural probes pass at 320/375/390.
- [ ] Representative generated routes pass current, historical, dense, and
      retired behavior.
- [ ] All shared interaction states pass keyboard and focus restoration.
- [ ] Critical journeys pass in Chromium, Firefox, and WebKit.
- [ ] Reflow/zoom, text spacing, forced-colors, and workflow print checks pass.
- [ ] All eight critical task outcomes preserve or improve route correctness,
      interaction count, fact visibility, and recovery success.
- [ ] No-JS exact-command journey passes in ≤2 purposeful interactions.
- [ ] Fixed VI fixtures and chrome-key parity pass; no random route selection.
- [ ] Axe has no unresolved A/AA or serious/critical issue.
- [ ] Lighthouse and all four performance groups pass.
- [ ] `pnpm run test:qualification` gates every required shard.
- [ ] Two clean consecutive runs produce no flaky diff or orphan process.
- [ ] Audit P0–P3 traceability has no unowned finding.
- [ ] Verification runbook is committed.

## Risk assessment

- **Screenshot anti-aliasing noise.** Pin browser/container/font environment and
  use a small reviewed pixel threshold; never mask structural regions.
- **Runtime exceeds CI budget.** Shard site/docs/axe/Lighthouse in parallel while
  retaining all required gates.
- **Baseline update treadmill.** Require explicit update command and rationale;
  reject blanket baseline regeneration.
- **Full catalog browser loop is too slow.** Keep route-wide checks lightweight
  and static where possible; screenshots remain representative.
- **Axe false positive.** Exact-rule suppression only with evidence, rationale,
  owner, and expiry; no tag-level suppression.
- **Process leak.** Harness owns only PIDs it starts and always tears them down,
  including failure paths.

## Security considerations

- Test output and screenshots contain no tokens, home paths, private logs, or
  environment values.
- Static servers bind loopback only.
- CI artifacts expose public pages only.
