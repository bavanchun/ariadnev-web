# Phase 4 Slice D — D08-D11 screen experiences + Phase 4 closure

Date: 2026-08-17

## Scope delivered

- D08 upgrading: `UpgradingExperience` — topology of `update --check` -> `update`
  -> reinstall kit -> `doctor`.
- D09 configuration: `ConfigurationExperience` — topology of the user/project
  authority-layer merge into `config prefs resolve`, with rejected-key drop and
  notification redaction drawn as its two visible outcomes.
- D10 doctor/audit/backups/uninstall: `UninstallAndDoctorExperience` —
  `OperationMatrix` intent table across all six commands with literal
  diagnostic/mutating kind badges (distinguishable without color).
- D11 migration: `MigrationFromVcskillExperience` — topology of the four
  migration stages including the old-binary-present prerequisite decision;
  `rm -rf`/`rm -f` stay inert diagram text, never a link/button.

Registry (`docs-screen-registry.tsx`/`.ts`) wires all four; the `PassThrough`
fallback became unused and was removed, since D01-D17 all now carry named
renderers (D00/D18 stay app-level by design).

31 new tests in `tests/docs/screen-experience-d08-d11.test.mjs` (structural
identity, EN/VI node-count parity, authored-fact survival, no-color
distinguishability for D10, inert-diagram-text for D11's destructive
commands).

## Post-build discovery: stale visual baselines

Running `pnpm run test:qualification` surfaced that D02, D03, and D06 (from
slices B/C, not touched this slice) had never had their Playwright baselines
rebased after their content enrichment shipped — plus D11 needed one for this
slice's new topology. All four are real, intentional content growth, not
regressions. Rebased chromium screenshots for exactly these four fixture IDs
(`git commit faf5750`); full `test:qualification` is now green: 203 (docs
suite) + 164 (native suite) native tests, and 104 Playwright tests (94
chromium + 5 firefox + 5 webkit).

## Byte budget

Cap stays frozen at 306000 (no widen this slice, as required). Slice D added
zero new CSS. `verify-static-budget.mjs` reports the tightest route
(`/en/stable/get-started/installation/`) at 301,568 bytes — ~4.4KB headroom
under cap, same as before this slice (D08-D11 sit on `guides/*` routes, not
the tightest-margin route).

## Phase 4 closure

- `phase-04-authored-docs-screen-experiences.md`: frontmatter `status`
  `substantially-complete` -> `completed`; closing HTML comment rewritten
  naming all four slices' commits and the cap-widen history (300000 -> 302000
  Phase 3 -> 306000 Phase 4 slice C, no further widen in slice D).
  All 10 Success Criteria checkboxes verified true and checked via
  `ak plan check`.
- `plan.md`: phase 4 table row updated to "Complete" with concrete evidence.

## Plan-level status — NOT closed, and deliberately left `in-progress`

The task brief asked me to flip `plan.md` frontmatter `status: in-progress` ->
`status: completed` "since all 7 phases will be complete." That premise does
not hold: `ak plan status` (which derives phase completion from each phase
file's own Success Criteria checkboxes, not the prose "Substantially
complete" labels) reports **5/7 phases done** after this slice, not 7/7:

```
ariadnev web UI/UX upgrade — Living Execution Atlas  5/7 phases done  77% complete  (67/86 tasks)
```

Phase 3 (docs safety/shell) has 5 unchecked criteria — mobile nav
reachability, drawer pointer/keyboard/focus pass, breadcrumb/pager/TOC/
search/copy/locale/version completeness, grouped search loading state
(marked "Partial" in-file), heading permalinks (marked "Re-scoped" in-file).
Phase 5 (generated reference) has 13 unchecked criteria — route projection
counts, historical command completeness, legacy-anchor contract, CLI
duplication, two-hop lookup, provider clipping, skill/workflow correctness,
print/no-JS topology, search/discovery canonicality, all four performance
groups, grandfathered-ceiling closure, `test:qualification`.

These are pre-existing gaps in files I do not own this slice (phase-03 and
phase-05 are outside Slice D's "Files you MAY modify" list) and outside my
delegated scope to fix. Marking the whole plan `completed` while those two
phase files still self-report unmet criteria would misstate verified state.
I left `plan.md` frontmatter as `status: in-progress` and updated only the
Phase 4 table row, which is the part this slice actually closes. A follow-up
decision is needed: either (a) phases 3/5's prose "Substantially complete"
labels and their unchecked boxes get reconciled (check the boxes that are
now true, or open a new slice to close the remainder), or (b) the plan
stays `in-progress` until they do.

## Commits (pushed to `main`)

- `0efaa51` feat(docs): D08-D11 purposeful screen experiences (P4 slice D)
- `faf5750` chore(p4): rebaseline D02/D03/D06/D11 visuals for authored screen enrichment
- (this closure commit, see below)

## Tests

- `pnpm --filter @ariadnev-web/docs typecheck`: pass.
- `pnpm run test:docs`: 164/164 pass.
- `pnpm run test:native`: 164/164 pass.
- `pnpm --filter @ariadnev-web/docs run build`: pass, no ratchet regression.
- `pnpm run test:qualification`: full green — 203 + 164 native, 94+5+5
  Playwright.

## Unresolved questions

- Should phases 3 and 5's own Success Criteria checkboxes be reconciled
  (checked where genuinely true, or scoped into a follow-up slice) before
  `plan.md` can honestly move to `status: completed`? This report recommends
  a targeted audit of those two phase files rather than editing them
  speculatively from this slice.
