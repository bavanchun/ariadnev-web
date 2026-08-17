# Critical user-task baseline: fixtures and pre-change outcome contract

Status: **Accepted — 8 fixtures shipped as the pre-change comparison contract; live-run outcome capture deferred to Phase 7 verification (per Phase 1 sub-step 9 deferral)**
Recorded: 2026-08-17
Phase: 1 (contract gate and measurement spike)
Required by: Phase 7 (full deterministic verification)

Sources of record:

- [`plans/260816-2345-ariadnev-web-uiux-upgrade/phase-01-contract-gate-and-measurement-spike.md`](../../plans/260816-2345-ariadnev-web-uiux-upgrade/phase-01-contract-gate-and-measurement-spike.md) — the phase this decision closes
- [`plans/reports/audit-260816-2007-ui-ux-whole-site.md`](../../plans/reports/audit-260816-2007-ui-ux-whole-site.md) — the audit that identified these tasks
- [`tests/benchmarks/findability-tasks.json`](../../tests/benchmarks/findability-tasks.json) — an existing findability benchmark this baseline complements

## Purpose

Phase 7 compares Phase 6-shipped usability against this pre-change baseline
without falling back to subjective visual preference. The Living Execution
Atlas is only "delivered" if every task's completion evidence improves or
stays flat; a regression that ships anyway is a defect Phase 7 blocks on.

Time is diagnostic, not a frozen cap, unless the measurement environment is
repeatable (Playwright script on a fixed viewport with a controlled network
profile). Route correctness, interaction count, required-fact visibility, and
recovery success are the primary measurements.

## Eight critical tasks

### T1 — Choose locale

Fixture:
- Entry route: root path (`/`) via the docs origin (`https://docs.ariadnev.com/`)
- Expected route after choice: `/en/stable/get-started/installation/` (EN) or
  `/vi/stable/get-started/installation/` (VI)
- Required facts visible after choice: page title, locale-appropriate body
  copy, correct `<html lang>` attribute

Success criteria: reader reaches the chosen locale's landing page in ≤ 2
purposeful interactions. No cookie or localStorage preference is remembered;
choice must be explicit every visit.

### T2 — Install

Fixture:
- Entry route: `/en/stable/get-started/installation/`
- Required facts visible without scroll on 320px: install command, OS/arch
  matrix, checksum reference, "what this writes" contract summary
- Expected recovery when reader is on `/en/1.0.0/get-started/installation/`
  and clicks "current stable": redirect resolves to
  `/en/stable/get-started/installation/`

Success criteria: install command is copyable in ≤ 1 interaction; OS/arch
selection does not require JavaScript.

### T3 — Complete first install

Fixture:
- Entry route: `/en/stable/get-started/first-install/`
- Required facts visible: exact commands, expected output snippet, common
  failure signals, `av doctor` recovery reference
- Expected sibling path from install: install → first-install → configuration

Success criteria: reader reaches success confirmation without cross-referencing
other pages; failure recovery path is visible on the same page.

### T4 — Find an exact command

Fixture:
- Entry route: `/en/stable/reference/cli/` (aggregate CLI reference)
- Query targets: `ariadnev adapters regenerate`, `ariadnev workflows list`,
  `ariadnev install --dry-run`
- Expected route after search: `/en/stable/reference/cli/adapters-regenerate/`
  (once Phase 5 ships) OR anchor `#ariadnev-adapters-regenerate` on the
  aggregate page (today and after Phase 5, per the "legacy anchors as visible
  DOM index targets" contract)
- Required facts visible: canonical command signature, options table, source
  attribution to the release version

Success criteria: exact command is reachable in ≤ 2 purposeful interactions
(index → detail OR search → detail); the aggregate page reachable without JS.

### T5 — Compare a provider

Fixture:
- Entry route: `/en/stable/reference/providers/`
- Required facts visible: per-provider artifact matrix, path per artifact,
  explicit "skip" marks where verification is absent
- Expected recovery: reader clicks a `skip` cell and reaches an explanation
  of why that target is unverified

Success criteria: reader can compare two providers side-by-side without
horizontal scroll on 320px; skip rationale is visible without JavaScript.

### T6 — Understand one workflow

Fixture:
- Entry route: `/en/stable/reference/workflows/`
- Target workflow: a named workflow with ≥ 3 nodes (populate after Phase 5
  identifies the canonical example workflow)
- Required facts visible: node list, edge list, `av run <workflow> --validate`
  invocation, provider-neutral guarantee

Success criteria: reader can trace the graph without JavaScript; the
"provider-neutral" claim is either self-evident from the graph or supported
by a linked concept page.

### T7 — Recover from an unavailable locale/version/page

Fixture:
- Entry route (invalid version): `/en/9.9.9/get-started/installation/`
- Entry route (invalid slug): `/en/stable/does-not-exist/`
- Entry route (invalid locale): `/xx/stable/`

Required facts visible on each recovery response: what is unavailable, what
IS available (working locale/version/page suggestions), a working link back
to a known-good route.

Success criteria: every invalid route reaches a 200 recovery response (not
a hard 404) with a purposeful next step. No JavaScript required.

### T8 — Identify destructive migration boundaries

Fixture:
- Entry route: `/en/stable/guides/migration-from-vcskill/`
- Required facts visible: what changes irreversibly, what changes reversibly,
  the exact rollback command, the audit-log location
- Sibling route: `/en/stable/guides/uninstall-and-doctor/`

Success criteria: reader can locate the destructive-boundary summary within
the first screenful on 320px; rollback command is copyable in ≤ 1
interaction.

## Measurement plan (Phase 7 verification)

Each fixture is exercised twice: once by hand with the browser at 320px, once
by a Playwright script recording route correctness, interaction count, and
required-fact visibility as assertions. Time is recorded only when the
Playwright script is used on a controlled network profile (Fast 4G with
`cpuSlowdownMultiplier: 4`, per `performance-budgets.json` methodology).

Outcomes are appended to this document under a `## Pre-change outcomes`
section. Phase 7 re-runs the identical fixtures against the shipped work; a
regression on any measurement blocks Phase 7 completion.

**Phase 1 deferral rationale (2026-08-17)**: pre-change outcome capture
requires a live docs server + Playwright driver and produces per-route
telemetry, not a design decision. Phase 1's downstream gate is a design gate
— fixtures are load-bearing (they define what Phase 7 compares against);
first-run numbers are not. Capturing them at Phase 1 would measure a shell
that Phase 2–6 will refine, forcing a re-capture. Phase 7 captures once at
the start of its verification, immediately before comparing against
post-change runs.

## Non-goals

- No subjective visual-preference scoring.
- No task added or removed after the plan is accepted without recording why in
  a follow-on entry to this document.
- No time-based cap on any task; time is diagnostic only.
