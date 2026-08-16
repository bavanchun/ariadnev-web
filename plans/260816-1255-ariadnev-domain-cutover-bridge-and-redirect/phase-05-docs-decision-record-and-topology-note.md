---
phase: 5
title: "Docs, decision record, topology note"
status: completed
priority: P2
effort: "2h"
dependencies: [4]
---

# Phase 5: Docs, decision record, topology note

## Overview

Record why the bridge exists, the invariants that keep the frozen rollback target working, and the
conditions under which the bridge is deleted — so Phase 12 inherits intent, not archaeology.

## Requirements

- Functional: an ADR in the repo's existing `docs/decisions/` sequence.
- Functional: `topology.json` gains an additive, non-authoritative note about the interim host.
- Functional: the operator runbook covers the token file and the two management commands.
- Non-functional: no secrets, no absolute local paths in committed docs.

## Architecture

`topology.json` calls itself the single authority for deploy and rollback order and forbids silently
changing `selected`. This phase **does not** change `selected` and does not reorder units — it adds
an `interim` note recording that `ariadnev.com` is currently served by a unit outside the topology.
That is additive metadata, not a cutover decision.

The ADR must capture three things Phase 12 will otherwise have to rediscover:

1. **Why a bridge instead of one line in the frozen `wrangler.toml`** — the freeze protects a
   redeployable artifact, its binding map, and its credential namespace; adding a route mutates the
   binding map that `firstCutover.restoresLegacyBinding` exists to restore.
2. **The rename-redirect invariant** — the legacy worker hardcodes `bavanchun/vcskill` and survives
   only on GitHub's rename redirect. **Never create a repo named `bavanchun/vcskill`** until legacy
   decommission.
3. **The Phase 4 ordering result** — whether a Single Redirect beats a Workers Custom Domain, recorded
   as measured fact with the date and the exact probe used. This is undocumented by Cloudflare *and*
   previously unmeasured in this repo, so it is the project's only evidence on the question and
   Phase 12 will rely on it. Record the negative result with equal care if that is what happens.

Also record that the redirect rule and its manager **outlive** the bridge: at Phase 12 `workers/bridge/`
is deleted, but `rules/legacy-host-redirect.json` stays and its status code flips 302→301 once the
rollback window closes.

## Related Code Files

- Create: `docs/decisions/<next-number>-ariadnev-bridge-and-legacy-redirect.md` — ADR **and** operator
  runbook in one file (token location `~/.config/cloudflare/ariadnev-token` mode 600, required
  permission **Zone → Single Redirect → Edit**, the `--inspect/--apply/--remove` commands). Kept as one
  surface deliberately: four doc surfaces is too much ceremony for an interim unit.
- Modify: `deployment/topology.json` — add an `interim` block; **do not** touch `selected`, `units`, or `legacyWorker`
- Modify: `README.md` — a few lines only: canonical host is `ariadnev.com`, legacy host 302s, link to the ADR
- Do **not** touch: the four frozen files

## Implementation Steps

1. `ls docs/decisions/` to find the next ADR number; follow the existing file's heading style.
2. Write the ADR covering the three points above, plus the decommission trigger: at Phase 12 the
   bridge is deleted, `ariadnev.com` moves to `vcskill-edge-combined`, and the 302 becomes a 301 only
   after the rollback window closes.
3. Add to `topology.json`:
   ```json
   "interim": {
     "host": "ariadnev.com",
     "servedBy": "ariadnev-bridge",
     "wranglerConfig": "workers/bridge/wrangler.toml",
     "reason": "Canonical host for ariadnev@1.0.0 installs, stood up before the candidate-b cutover because install.sh and update-command.ts hardcode this domain.",
     "retireAt": "phase-12-cutover"
   }
   ```
4. Update `README.md`: canonical host, install command, and that the legacy host now 302s.
5. Record the open risk: the legacy `GH_TOKEN` PAT expiry is unknown; if it falls inside the rollback
   window, a decision-recorded manual renewal is the sanctioned exception to the freeze's letter.
6. Run `pnpm run test:qualification` — `deployment-control-plane.test.mjs` reads `topology.json`, so
   confirm the additive key does not break its schema expectations.

## Success Criteria

- [x] **(amended)** ADR exists as `docs/decisions/ariadnev-bridge-and-legacy-redirect.md`, covering
  all three points plus the decommission trigger. **Not numbered** — `docs/decisions/` uses
  descriptive filenames with no numbering (`edge-routing-topology.md`,
  `edge-routing-observations.json`). This step's "next ADR number" instruction was written against a
  convention this repository does not have; the existing convention was followed instead, per the
  same step's own "follow the existing file's heading style".
- [x] `topology.json` diff touches only the new `interim` key — `selected`, `units`, `rollbackOrder`,
  `environments`, and `legacyWorker` are byte-identical
- [x] `pnpm run test:qualification` green (control-plane test accepts the new key). Verified there is
  no schema guarding `topology.json`: every reader does plain key lookups, and the repo's JSON-schema
  validator covers only `deployment-contract.schema.json` and `cutover-record.schema.json`.
- [x] README states `ariadnev.com` as canonical and documents all three rule commands
- [x] No secret values or absolute local paths committed
- [x] Phase 4's measured ordering result is written down with its date, probe, and — added after
  advisory review — its **conditionality**: the measurement covers Custom Domains only, and
  `wrangler.combined.production.toml:24` is `routes = []`, so Phase 12 may bind the legacy host by
  route instead. The ADR prescribes a one-curl re-probe at that point rather than letting Phase 12
  inherit the result unconditionally.

## Added beyond the original scope

Advisory review surfaced three things worth recording that this phase did not originally plan:

1. **Rollback restores routing, not serving correctness.** `--remove` makes `vcskill.vchun.dev`
   reachable again, but the frozen Worker cannot serve a working 1.0.0 install: the release publishes
   only `ariadnev-*` assets, and `/download/vcskill-darwin-arm64` 404s (verified). Correct installs
   depend on the bridge staying up, so the bridge is production, not scaffolding.
2. **The drift check's two blind spots** — a dashboard edit to the rule's `description` makes it
   invisible to `locateRule` and the next `--apply` creates a second rule (`preservedRuleCount` is the
   tell); and structural comparison is churn detection, never a substitute for the live probe.
3. **A newly unblocked, deliberately untouched gate.** `edge-routing-topology.md` lists the raw
   dot-segment ingress guard as blocked on a Cloudflare token with Zone → WAF → Edit. A working
   zone-scoped token now exists, so the gate is no longer credential-blocked — but applying it is
   candidate-b work outside this plan's scope and was left alone.

## Risk Assessment

- **`topology.json` schema rejects the new key.** Signal: `deployment-control-plane.test.mjs` fails.
  Response: extend the schema additively, or move the note into the ADR only — never weaken the test.
- **ADR drifts from what was actually deployed.** Mitigation: write it after Phase 4, from observed
  results, not from this plan's predictions.
- **Docs imply the cutover is done.** Mitigation: state plainly that production `vcskill.vchun.dev`
  still runs the frozen legacy worker behind a redirect, and that candidate-b has not shipped.
