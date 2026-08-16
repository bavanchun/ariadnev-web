---
phase: 6
title: "Full verification"
status: pending
priority: P1
effort: "3-5d"
dependencies: [1, 2, 3, 4, 5]
---

# Phase 6: Full verification

## Overview

Prevent regression of everything Phases 1–5 shipped. Add Playwright viewport
and keyboard journeys, screenshot baselines at five widths, `@axe-core/
playwright` a11y assertions, contrast + reduced-motion + `<html lang>` checks,
EN/VI parity, a **no-JavaScript journey**, and the brainstorm's four
mandatory **stress frames**. Wire everything into `test:qualification` so a
PR that regresses cannot merge. Close remaining P2/P3 polish and document
what the harness covers.

## Requirements

- Functional: (a) Playwright suite covers site home, docs home, one guide,
  the provider reference, the CLI index, one CLI command page, search open,
  locale/version switcher open, 404, and not-found — at 320/375/768/1280/1440
  in EN and VI where applicable; (b) the four **stress frames** run every
  time — CLI reference at 320px, provider reference at 320px, desktop CLI
  lookup and orientation, complete VI route including all product chrome;
  (c) axe assertions run per route via `@axe-core/playwright`; (d) keyboard
  journey test on site and docs (skip link → drawer/menu → target page →
  back); (e) **no-JS journey** confirms the two-click-to-CLI-command
  acceptance still holds without client JavaScript; (f) reduced-motion and
  contrast checks; (g) Lighthouse accessibility ≥95 on production output
  for both apps; (h) route generation, search index, build wall time, and
  size budgets stay green.
- Non-functional: harness runs inside `pnpm run test:qualification`. Total
  additional time budget ≤ 3 minutes on the release runner; if exceeded,
  split visual by app and run in parallel steps but still gate.

## Architecture

Playwright is already in `devDependencies`; add `@axe-core/playwright` as a
**direct** dev dep (brainstorm rule: no transitive imports for CI
assertions). Wire:

- **Suite layout.** `tests/visual/` with subfolders `site/`, `docs/`,
  `journeys/`, `stress/`. Each spec owns one route or one journey. Fixtures
  load built production output — no dev server.
- **Baselines.** Committed under `tests/visual/__baselines__/<route>/<width>.png`,
  regenerated with `pnpm run test:visual -- --update-baselines`.
  `.gitattributes` marks them binary; PR review sees diffs, not blobs.
  Baseline updates require a rationale in the PR body (enforced by
  reviewer discipline, documented in the runbook).
- **Stress frames.** Four dedicated spec files under `tests/visual/stress/`
  running on every CI run, each asserting: (1) CLI reference at 320px has
  no clipped content and exposes commands via search + index anchors; (2)
  provider reference at 320px renders `<ResponsiveTable>` inside its own
  scroll container without page overflow; (3) desktop CLI lookup — user
  finds a command in ≤ 2 keyboard interactions from the CLI index; (4) a
  complete VI route (chosen at random from the catalog) has zero English
  chrome, verified via accessible-name inspection.
- **No-JS journey.** Playwright context with `javaScriptEnabled: false`
  loads `/en/stable/reference/cli/`, follows the index link to one command
  detail page, and verifies the target page renders with server HTML
  alone. This proves the CLI index + legacy anchors are real DOM, not
  JavaScript redirects.
- **Axe assertions.** Per route, run `AxeBuilder(page).analyze()` and
  fail on any violation of `wcag2a`, `wcag2aa`, or `best-practice` tag.
  Whitelist rules by exact id only, with a written rationale in the
  runbook — never blanket-suppress.
- **Lighthouse gate.** Runs against the built static output; fails on
  accessibility <95 or on the label-content-name mismatch cleared in
  Phase 3.

## Related Code Files

- Create: `tests/visual/site/*.spec.ts` (home, 404)
- Create: `tests/visual/docs/*.spec.ts` (home EN, home VI, guide, provider,
  cli index, one cli command, search open, switcher open, not-found)
- Create: `tests/visual/journeys/{site-keyboard,docs-keyboard,no-js}.spec.ts`
- Create: `tests/visual/stress/{cli-320,provider-320,desktop-cli-lookup,vi-chrome}.spec.ts`
- Create: `tests/visual/__baselines__/**/*.png`
- Create: `tests/visual/lighthouse.mjs`
- Create: `playwright.config.ts`
- Modify: `package.json` — add `@axe-core/playwright` as direct dev dep;
  add `test:visual`; extend `test:qualification` to include it after
  existing steps
- Modify: `.gitattributes` — mark `tests/visual/__baselines__/*.png` binary
- Create: `docs/operations/visual-verification-harness.md` — how to run,
  how to update baselines, budget expectations, failure triage, allowed
  axe suppressions and their rationales
- Modify: `docs/decisions/state-layers-and-shell-dimensions.md` (Phase 2)
  — append a link to the harness doc

## Implementation Steps

1. **Direct dev dep.** Install `@axe-core/playwright`; confirm nothing was
   pulling it transitively before.
2. **Baseline installer.** Land config + one trivial spec first; confirm
   baselines commit cleanly and the drift check runs locally.
3. **Site suite.** Home at five widths + keyboard journey.
4. **Docs suite.** Home EN + VI, guide, provider, CLI index, one CLI
   command, search open, switcher open, not-found — at five widths.
5. **Stress frames.** The four brainstorm-mandated specs.
6. **No-JS journey.** Verify the two-click-to-command acceptance holds
   with client JS disabled.
7. **Axe.** Add `AxeBuilder(page).analyze()` per route; fail on violations;
   document any allowlisted rule id in the runbook.
8. **Lighthouse gate.** Against built static output.
9. **Wire into `test:qualification`.** Add the step; measure end-to-end
   time; split by app if over 3 minutes.
10. **P2/P3 polish sweep.** Close remaining audit findings not resolved by
    an earlier phase (site's pressed states, `touch-action` and
    tap-highlight defaults, `document-copy-enhancer` scale on the
    132-heading page — largely moot after Phase 4's CLI split but verified).
11. **Ops doc.** Write the visual-verification-harness runbook including
    axe policy.

## Success Criteria

- [ ] `pnpm run test:qualification` runs visual, axe, and Lighthouse and
      fails on regression.
- [ ] Baselines exist at 320/375/768/1280/1440 for each named route in EN
      and (where applicable) VI.
- [ ] Keyboard journey tests exist for site and docs and pass on built
      output.
- [ ] No-JS journey passes: reader reaches a command detail page from
      `/reference/cli/` with client JavaScript disabled.
- [ ] All four stress-frame specs pass and are wired into CI.
- [ ] `@axe-core/playwright` is a direct dev dep; no transitive import;
      per-route analysis passes with only documented suppressions.
- [ ] Lighthouse accessibility ≥95 on production output for both apps;
      label-content-name mismatch cleared.
- [ ] Every P0 and P1 finding from the audit is either closed by an
      earlier phase or explicitly closed here.
- [ ] Ops doc committed and linked from the Phase 2 decision doc.

## Risk Assessment

- **Baselines produce false positives on font rendering.** Signal: pixel
  diffs from anti-aliasing on unrelated PRs. Response: use Playwright's
  built-in fuzz threshold; if not enough, render into a container with a
  known-stable font-smoothing setting.
- **Qualification runtime balloons.** Signal: >3 minutes. Response: split
  visual by app in parallel steps; move Lighthouse to a separate
  qualification job that still gates the deploy.
- **Baselines become an update treadmill.** Signal: every UI PR updates
  baselines with no scrutiny. Response: require the `--update-baselines`
  flag documented in the runbook; batching baseline updates behind a
  weekly PR is acceptable if the flow becomes noisy.
- **Axe flags an accessibility issue the design accepts.** Signal: a
  legitimate design pattern axe rules against. Response: allowlist by
  exact rule id with a written rationale in the runbook; never blanket-
  suppress a full tag.
- **No-JS journey exposes a real regression.** Signal: reader cannot
  reach a command detail page without JS. Response: this is Phase 4's
  contract failing — the legacy anchors were supposed to be visible DOM
  targets. Fix the renderer, not the test.
- **Playwright breaks on the release runner.** Signal: browser download
  fails in CI. Response: pin browser channel; cache the browser download;
  fail fast with a clear message rather than a 20-minute install log.
