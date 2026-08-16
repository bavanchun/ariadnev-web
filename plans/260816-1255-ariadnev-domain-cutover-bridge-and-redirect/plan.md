---
title: "ariadnev domain cutover bridge and redirect"
description: "Serve ariadnev.com from a new bridge Worker to unblock ariadnev@1.0.0 installs, then redirect vcskill.vchun.dev to it — without touching the four frozen legacy files."
status: completed
priority: P1
effort: "1-2d"
tags: [infra, cloudflare, domain, release]
created: 2026-08-16
---

# ariadnev domain cutover bridge and redirect

## Overview

`ariadnev@1.0.0` shipped on 2026-08-16 but **cannot be installed**. `install.sh:10` and
`install.ps1:8` point at `https://ariadnev.com`, and `packages/cli/src/cli/update-command.ts:9`
hardcodes the same host as `const DOMAIN` with **no env override** — so both fresh installs and
`av update` on every already-installed copy are broken. The zone exists and is active; it simply
has no address record and nothing bound to it.

This plan stands up `ariadnev.com` on a **new bridge Worker** (additive, nothing frozen touched),
then redirects `vcskill.vchun.dev` to it with a **source-controlled Cloudflare Single Redirect**.

The full rationale, rejected options, and advisory review are in
`plans/reports/` at the workspace root:
`brainstorm-260816-1228-ariadnev-domain-cutover.md`.

## Goals

| # | Goal | Priority |
|---|------|----------|
| 1 | `curl -fsSL https://ariadnev.com/install \| bash` installs 1.0.0 on a clean machine | P1 |
| 2 | `av update` works against `ariadnev.com` | P1 |
| 3 | `vcskill.vchun.dev/*` → `ariadnev.com/*`, path-preserving | P1 |
| 4 | Legacy rollback target remains byte-identical and instantly restorable | P1 |
| 5 | Redirect is reversible by deleting one rule, with no deploy | P2 |

## Constraints

- **Frozen (do not modify or redeploy):** `worker.js`, `landing.html`, `wrangler.toml`,
  `landing-consistency.test.mjs` — `README.md:93-98`, and `deployment/topology.json`
  (`credentialMutationFrozenUntil: rollback-window-close`).
- `vcskill.vchun.dev` must keep serving until the redirect deliberately shadows it.
- Deploys are version-controlled; no dashboard-only state.
- `topology.json` is the authority for cutover order — this plan does **not** change `selected`.

## Non-goals

- Executing the Phase 12 candidate-b cutover.
- Building `apps/docs` (still a stub).
- Rebranding in-repo identity strings wholesale.
- Fixing `landing-consistency.test.mjs`'s stale pins (frozen; it correctly pins the *legacy* artifact).
- Publishing to npm.

## Verified preconditions

| Fact | Evidence |
|---|---|
| `ariadnev.com` + `vchun.dev` both **active in the same Cloudflare account** | `wrangler` OAuth, account `Hoangbavan4478@gmail.com's Account`, 4 zones |
| `ariadnev.com` has no apex address record | DoH: NOERROR/NODATA, SOA only |
| CF API token carries **Zone → Single Redirect → Edit** | **Confirmed by write in Phase 4**: `--apply` created the entrypoint ruleset and the rule with no 403. The earlier POST probe (`kind must be given`) had proved *authentication only*, since the request was rejected during body validation before phase-scoped permission was ever checked |
| `vchun.dev` has **no** `http_request_dynamic_redirect` ruleset yet | `GET /zones/<id>/rulesets` → only `http_request_sanitize`, `http_request_firewall_managed`, `ddos_l7` |
| GH PAT reads `ariadnev-kit` releases | `releases/latest` → `ariadnev@1.0.0`, 9 assets |
| Legacy worker untouched since 2026-08-08 | `wrangler deployments list --name vcskill` → `b93d9d2`, tag `vcskill-0.11.0` |
| Permission name for the rule | Cloudflare docs: **Zone → Single Redirect → Edit**, phase `http_request_dynamic_redirect` |

## Phases

| # | Phase | Status | Commit |
|---|-------|--------|--------|
| 1 | [Phase 1: Bridge worker implementation](./phase-01-start.md) | **Completed** | `bd51aeb`, `656e07d` |
| 2 | [Phase 2: Deploy bridge and provision ariadnev.com](./phase-02-deploy-bridge-and-provision-ariadnevcom.md) | **Completed** | deploy-only |
| 3 | [Phase 3: Redirect rule tooling](./phase-03-redirect-rule-tooling.md) | **Completed** | `3cc90e4`, `82fea6a` |
| 4 | [Phase 4: Apply redirect and verify ordering](./phase-04-apply-redirect-and-verify-ordering.md) | **Completed** | operational |
| 5 | [Phase 5: Docs, decision record, topology note](./phase-05-docs-decision-record-and-topology-note.md) | **Completed** | `6ff2f98` |

Phase 2 blocks 4. Phase 3 may run in parallel with 1–2; Phase 4 requires both 2 and 3.

## Success Criteria

- [x] `curl -fsSL https://ariadnev.com/install | bash` succeeds on clean darwin-arm64; sha256 verifies
- [x] `https://ariadnev.com/version` returns the 1.0.0 tag; `av update --check` resolves against it
- [x] `curl -sI https://vcskill.vchun.dev/install` → `302`, `Location: https://ariadnev.com/install`
- [x] Piped-bash install still works end-to-end *through* the old host
- [x] Deleting the redirect rule restores direct legacy serving within seconds (tested, then re-applied)
- [x] `git diff` shows zero changes to the four frozen files; `wrangler deployments list --name vcskill` still shows `b93d9d2`
- [x] `pnpm run test:qualification` green — 149 native, 158 vitest
- [x] Path-traversal attempts against `ariadnev.com/download/*` are rejected in-Worker

## Outcome

Goals 1–5 all delivered. The ordering assumption the plan was written to settle **holds**: a Single
Redirect executes before a Worker holding the host via a Custom Domain. The decision record scopes
that finding to Custom Domains and prescribes a re-probe if Phase 12 binds the legacy host by route.

Two corrections the execution forced, both recorded in their phase files:

- **Phase 1's `mustBlock` criterion was unsatisfiable as written** and was amended to the property
  that is actually provable. Literal dot segments are collapsed before any handler reads the path, so
  two `mustBlock` entries normalize into a `mustAllow` entry.
- **A drift-detection bug in the Phase 3 manager**, caught only by running `--inspect` against the
  live zone: Cloudflare re-serializes `action_parameters` in its own key order, and the original
  `JSON.stringify` comparison would have made `--inspect` exit 2 forever and `--apply`
  non-idempotent.

Scope added beyond the plan: `workers/bridge` registered in `pnpm-workspace.yaml` so wrangler is
pinned rather than an `npx` download; seven hostile-vector tests covering the previously untested
`malformed-encoding` branch and a CRLF `content-disposition` injection.

## Risks

| Risk | Signal | Pre-decided response |
|---|---|---|
| Single Redirect does **not** run before a Worker holding the host via Custom Domain | Phase 4 probe: old host still serves 200 instead of 302 | **Stop.** Do not modify frozen files. Report and re-open the options fork (defer redirect to Phase 12 is acceptable) |
| Legacy `GH_TOKEN` PAT expires inside the rollback window | GitHub PAT expiry date | Decision-recorded manual secret renewal — the one place the freeze's letter yields to its intent |
| `bavanchun/vcskill` repo recreated, breaking the rename redirect the legacy worker depends on | n/a — preventable | Record invariant: **never create `bavanchun/vcskill`** until legacy decommission |
| 301 cached by intermediaries defeats rollback | n/a | Use **302** for the whole rollback window; flip to 301 only after it closes |

## Open questions

1. **Still open.** Legacy `GH_TOKEN` PAT expiry date — not readable via API; needs manual check. If it
   expires inside the rollback window the rollback target fails closed with `502`. Recorded in the
   decision record as the one sanctioned exception to the freeze's letter.
2. **Resolved.** `www.ariadnev.com` is bound, as a second custom domain in the same deploy. No
   pre-existing `www` record conflicted; it answers `200`.

## Code review (`4bec80b`)

A post-implementation review found nine issues; eight were confirmed and fixed,
one did not reproduce.

| Severity | Finding | Outcome |
|---|---|---|
| High | The redirect defanged `verify-convergence.mjs` — it followed the 302 and validated the bridge instead of the production unit; the pinned-selector check became a tautology | Fixed: `redirect: "manual"`, 3xx is a hard failure naming the target |
| High | `CLOUDFLARE_ZONE_ID` was trusted unverified before a `DELETE` | Fixed: zone identity asserted against the policy; reported `zoneName` now comes from the API |
| High | `mustRedirect`/`mustNotRedirect` had no verifier — decorative, unlike the pattern it mirrors | Fixed: corpus evaluated against the rule's own expression, gating `--apply` before any network call |
| Medium | `locateRule` took the first match with no `kind` filter; duplicates ambiguous; TOCTOU before `DELETE` | Fixed: `kind: "zone"` only, ambiguity is an error, re-read before delete |
| Medium | Bridge forwarded upstream error bodies verbatim — an expired PAT would pipe GitHub's JSON into bash as `text/x-shellscript` | Fixed: non-2xx collapses to a self-authored plain-text failure |
| Medium | Drift detection blind to rule ordering, though dynamic redirect is first-match-wins | Fixed: `rulePosition` and `ruleCount` in the outcome |
| Medium | A test name promised more than it pinned | Fixed: renamed to what it measures |
| Low | ADR cited cross-repo paths without qualifying them | Fixed: `ariadnev-kit:` prefix and a note |
| — | **Did not reproduce:** stripping a foreign rule's `id` before a `PUT` was said to recreate it | Measured live: the id was **preserved**. Rejected with evidence; recorded in the ADR |

Accepted and recorded rather than fixed: the bridge sits outside the deployment
control plane (`topology.json.units`, CI, contract snapshot). Wiring it in means
touching `units`, which this plan promised not to do. Documented as an open risk.

## Follow-ups this work surfaced (out of scope, not actioned)

- The raw dot-segment ingress guard in `edge-routing-topology.md` is listed as blocked on a Cloudflare
  token with Zone → WAF → Edit. A working zone-scoped token now exists, so the gate is no longer
  credential-blocked — but applying it is candidate-b work.
- Pre-rename `vcskill` 0.11.x clients cannot self-update: the 1.0.0 release publishes only
  `ariadnev-*` assets, so their computed `vcskill-<os>-<arch>` names 404. Manual reinstall is the only
  path. Broken by the rename itself, not by this work.
- `update-command.ts:9` hardcodes `const DOMAIN` with no environment override, which is why the domain
  was mandatory rather than a preference. Worth an override for testability, in `ariadnev-kit`.

<!-- slug: ariadnev-domain-cutover-bridge-and-redirect -->
