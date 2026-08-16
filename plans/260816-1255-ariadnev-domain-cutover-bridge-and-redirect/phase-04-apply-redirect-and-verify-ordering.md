---
phase: 4
title: "Apply redirect and verify ordering"
status: pending
priority: P1
effort: "1h"
dependencies: [2, 3]
---

# Phase 4: Apply redirect and verify ordering

## Overview

Apply the 302 and **empirically settle the one unverified assumption in this plan**: that a Cloudflare
Single Redirect executes before a Worker that holds the hostname via a Custom Domain.

## Requirements

- Functional: `vcskill.vchun.dev/*` 302s to `ariadnev.com/*`, path and query preserved.
- Functional: piped-bash install still works *through* the old host.
- Functional: removing the rule restores direct legacy serving, proving rollback.
- Non-functional: the legacy worker is never redeployed at any point.

## Architecture

This is the plan's decision gate. Cloudflare's published docs describe the Rules execution order but
**do not state** how a dynamic redirect interacts with a hostname bound by a Workers Custom Domain —
searched and confirmed unstated. The rollback story ("delete one rule, legacy resumes instantly")
depends entirely on the redirect winning, so it is verified by observation, not assumed.

The gap is wider than the docs alone suggest: **this repo has no empirical evidence either.**
`docs/decisions/edge-routing-topology.md:105-118` lists the ingress guard as a still-open gate ("only
its application to the zone is outstanding"), and the failing traversal rows in
`docs/decisions/edge-routing-reprobe.json` failed precisely because no zone rule was ever applied.
Combined with the live check showing `vchun.dev` has no `http_request_dynamic_redirect` entrypoint at
all, this phase produces the **first datum this project will ever have** on ruleset-phase-versus-
custom-domain ordering. Record it accordingly — Phase 12 will depend on it.

If the redirect does **not** win, the correct response is to stop — not to reach for the frozen files.
Deferring the redirect to the Phase 12 cutover is an acceptable outcome; Goal 1 (installs work) is
already delivered by Phase 2 and is unaffected.

## Related Code Files

- Modify: none (operational phase)
- Runs: `scripts/manage-legacy-host-redirect.mjs`

## Implementation Steps

1. Capture the pre-state for comparison:
   ```sh
   curl -sS -o /dev/null -w 'pre /install -> %{http_code}\n' https://vcskill.vchun.dev/install
   ```
2. Apply the rule:
   ```sh
   CLOUDFLARE_API_TOKEN="$(cat ~/.config/cloudflare/ariadnev-token)" \
     node scripts/manage-legacy-host-redirect.mjs --apply
   ```
3. **The ordering probe.** Do not follow redirects:
   ```sh
   curl -sSI https://vcskill.vchun.dev/install | head -3
   ```
   - `302` + `Location: https://ariadnev.com/install` → assumption holds, continue.
   - `403` on the `--apply` in step 2 → the token lacks phase-scoped Single-Redirect-Edit (the earlier
     probe proved authentication only). Fix the token permission and retry; this is not an ordering result.
   - `200` with installer content → **do not conclude "Worker won" yet.** Rule out the two false
     positives first, in order: (a) propagation — wait ~30s and re-probe; (b) expression bug — run
     `--inspect` and confirm the rule exists with the expected host expression. Only if the rule is
     present, propagated, and still not firing is the ordering assumption disproven. Then **STOP**:
     remove the rule, record the finding in the decision record, and return to the user with the
     options fork re-opened. Do not edit `worker.js`.
4. Verify path and query preservation:
   ```sh
   curl -sSI 'https://vcskill.vchun.dev/download/checksums.txt?x=1' | head -3
   ```
5. End-to-end through the old host (this must still work for anyone with a stale bookmark):
   ```sh
   curl -fsSL https://vcskill.vchun.dev/install | bash
   ```
6. **Prove rollback.** Remove the rule, confirm the legacy worker serves directly again, then re-apply:
   ```sh
   node scripts/manage-legacy-host-redirect.mjs --remove
   curl -sS -o /dev/null -w 'after remove -> %{http_code}\n' https://vcskill.vchun.dev/install
   node scripts/manage-legacy-host-redirect.mjs --apply
   ```
7. Confirm the legacy worker still shows `b93d9d2` and no frozen file changed.

## Success Criteria

- [ ] `vcskill.vchun.dev/install` → `302` with `Location: https://ariadnev.com/install`
- [ ] Query strings survive the redirect
- [ ] `curl -fsSL https://vcskill.vchun.dev/install | bash` installs successfully end-to-end
- [ ] Rule removal restores direct 200 serving within seconds; re-apply restores the 302
- [ ] `wrangler deployments list --name vcskill` still shows `b93d9d2`
- [ ] The ordering result — whichever way it went — is written into the Phase 5 decision record

## Risk Assessment

- **Worker wins over the redirect rule** (the live assumption). Signal: step 3 returns 200. Response:
  pre-decided — remove the rule, record, stop, escalate to the user. Explicitly **not** permitted:
  editing or redeploying any frozen file to force the redirect.
- **Redirect loop** if the rule's expression accidentally matches `ariadnev.com` too. Signal: `curl -L`
  reports "Maximum redirects followed". Response: remove the rule immediately; the expression is
  host-scoped to `vcskill.vchun.dev`, so this indicates an expression bug.
- **Rule applied to the wrong zone.** Signal: `vcskill.vchun.dev` unchanged and some other host
  redirecting. Response: `--remove`, re-check `zoneName` in the policy JSON.
- **Testing rollback briefly exposes the old host directly.** Accepted: that is the intended rollback
  behavior, and the window is seconds.
