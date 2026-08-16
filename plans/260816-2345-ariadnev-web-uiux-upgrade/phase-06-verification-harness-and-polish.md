---
phase: 6
title: "Verification harness and polish"
status: pending
priority: P1
effort: "3-4d"
dependencies: [1, 2, 3, 4, 5]
---

# Phase 6: Verification harness and polish

## Overview

Prevent regression of everything Phases 1–5 shipped. Add Playwright viewport
and keyboard journeys, screenshot baselines at five widths, contrast and
reduced-motion checks, EN/VI parity assertions, and hook them all into the
existing `test:qualification` command so a PR that regresses cannot merge.
Then close remaining P2/P3 polish and document what the harness covers.

## Requirements

- Functional: (a) Playwright journeys cover site home, docs home, one guide,
  the provider reference, the CLI index, one CLI command page, search open,
  locale/version switcher open, 404, and not-found; (b) screenshot baselines
  at 320/375/768/1280/1440 for each of those routes; (c) keyboard journey
  test hits skip link → drawer → any page → back on both site and docs; (d)
  contrast + reduced-motion + `<html lang>` assertions run in CI; (e)
  Lighthouse accessibility ≥95 on production output for both apps.
- Non-functional: harness runs in `pnpm run test:qualification` (already the
  qualification gate). Total additional time budgeted ≤ 3 minutes on the
  release runner; if it exceeds, split screenshot suites by app.

## Architecture

Playwright is already listed in `devDependencies` (`package.json:37`) but is
not yet run in `test:qualification`. Wire it in:

- **Suite layout.** New folder `tests/visual/` with subfolders `site/` and
  `docs/` mirroring the routes. Each test file owns one route and asserts
  its screenshot baselines plus its journey behaviors. Fixtures load the
  built production output — no dev server.
- **Baselines.** Committed under `tests/visual/__baselines__/<route>/<width>.png`,
  regenerated with `pnpm run test:visual -- --update-baselines`. `.gitattributes`
  marks them binary; PR review sees only diffs, not blobs.
- **Keyboard journey.** One dedicated test file per app, using Playwright's
  keyboard API without touch or pointer. Skip link → drawer/menu → target
  page → back is the shape.
- **Locale parity.** For every docs route with a screenshot baseline, assert
  the VI equivalent also has one and that no visible English chrome remains
  in a VI screenshot (OCR-free: assert against DOM text through Playwright's
  accessible-name API).
- **Lighthouse.** Run against the built static output (Next export + Astro
  dist) using the existing `lighthouse` devDependency. Fail on accessibility
  <95 or on the label-content-name mismatch.
- **Wiring.** `test:qualification` gains one line: `pnpm run test:visual`.
  The `test:visual` script runs Playwright and Lighthouse in that order.

## Related Code Files

- Create: `tests/visual/site/*.spec.ts` (home, 404)
- Create: `tests/visual/docs/*.spec.ts` (home EN, home VI, guide, provider
  reference, cli index, one cli command, search open, switcher open,
  not-found)
- Create: `tests/visual/journeys/*.spec.ts` (site keyboard, docs keyboard)
- Create: `tests/visual/__baselines__/**/*.png`
- Create: `tests/visual/lighthouse.mjs` (spawns lighthouse against the built
  static output; exits non-zero on regression)
- Create: `playwright.config.ts`
- Modify: `package.json` — add `test:visual`; extend `test:qualification` to
  run it after existing steps
- Modify: `.gitattributes` — mark `tests/visual/__baselines__/*.png` binary
- Create: `docs/operations/visual-verification-harness.md` — one-page ops
  doc: how to run, how to update baselines, budget expectations, failure
  triage guide
- Modify: `docs/decisions/state-layers-and-shell-dimensions.md` (from Phase
  2) — append a link to the harness doc

## Implementation Steps

1. **Baseline installer.** Land the config and one trivial spec first;
   confirm baselines commit cleanly and the drift check runs locally.
2. **Site suite.** Home at five widths plus keyboard journey.
3. **Docs suite.** Home EN + VI, guide, provider reference, CLI index, one
   CLI command page, search open, switcher open, not-found — at five widths.
4. **VI parity assertion.** For each docs route, assert baseline exists in
   VI as well; add the accessible-name check that fails on residual English
   chrome.
5. **Lighthouse gate.** Run against the built static output; fail on
   accessibility <95 or on the label-content-name mismatch.
6. **Wire into `test:qualification`.** Add the step; measure end-to-end
   time; split by app if over budget.
7. **P2/P3 polish sweep.** Close remaining audit findings that did not fit
   inside a prior phase (site's ad hoc pressed state, `touch-action` and
   tap-highlight defaults, `document-copy-enhancer` scale on 132-heading
   pages, breadcrumb section exposure verification).
8. **Ops doc.** Write the visual-verification-harness runbook.

## Success Criteria

- [ ] `pnpm run test:qualification` runs the visual suite and Lighthouse
      and fails on regression.
- [ ] Baselines exist at 320/375/768/1280/1440 for each named route in EN
      and (where applicable) VI.
- [ ] Keyboard journey tests exist for site and docs and pass on the built
      output.
- [ ] Lighthouse accessibility ≥95 on production output for both apps;
      label-content-name mismatch is cleared.
- [ ] Every P0 and P1 finding from the audit is either closed by an earlier
      phase or explicitly closed here.
- [ ] Ops doc committed and linked from the Phase 2 decision doc.

## Risk Assessment

- **Baselines produce false positives on font rendering.** Signal: pixel
  diffs from anti-aliasing on unrelated PRs. Response: use Playwright's
  built-in fuzz threshold; if that isn't enough, render into a container
  with a known-stable font-smoothing setting.
- **Qualification time balloons.** Signal: end-to-end runtime > 3 minutes.
  Response: split visual by app and run in parallel steps; move Lighthouse
  to a separate qualification job that still gates the deploy but does not
  block iteration.
- **Baselines become an update treadmill.** Signal: every UI PR updates
  baselines with no scrutiny. Response: require an explicit
  `--update-baselines` flag documented in the runbook; PR reviewers demand
  a rationale for baseline changes; batching baseline updates behind a
  weekly PR is acceptable if the flow becomes noisy.
- **Playwright breaks on the release runner.** Signal: browser download
  fails in CI. Response: pin browser channel; cache the browser download;
  fail fast with a clear message rather than a 20-minute install log.
