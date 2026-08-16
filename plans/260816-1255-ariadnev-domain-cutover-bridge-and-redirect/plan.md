---
title: "ariadnev domain cutover bridge and redirect"
description: "Serve ariadnev.com from a new bridge Worker to unblock ariadnev@1.0.0 installs, then redirect vcskill.vchun.dev to it — without touching the four frozen legacy files."
status: pending
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
| CF API token authenticates against the rulesets API | POST probe returned validation error `kind must be given`, not an auth error. **This proves authentication only** — the request was rejected during body validation before phase-scoped permission was checked, so Single-Redirect-Edit on `http_request_dynamic_redirect` is confirmed at the first real `--apply` (Phase 4), which may still 403 |
| `vchun.dev` has **no** `http_request_dynamic_redirect` ruleset yet | `GET /zones/<id>/rulesets` → only `http_request_sanitize`, `http_request_firewall_managed`, `ddos_l7` |
| GH PAT reads `ariadnev-kit` releases | `releases/latest` → `ariadnev@1.0.0`, 9 assets |
| Legacy worker untouched since 2026-08-08 | `wrangler deployments list --name vcskill` → `b93d9d2`, tag `vcskill-0.11.0` |
| Permission name for the rule | Cloudflare docs: **Zone → Single Redirect → Edit**, phase `http_request_dynamic_redirect` |

## Phases

| # | Phase | Status |
|---|-------|--------|
| 1 | [Phase 1: Bridge worker implementation](./phase-01-start.md) | Pending |
| 2 | [Phase 2: Deploy bridge and provision ariadnev.com](./phase-02-deploy-bridge-and-provision-ariadnevcom.md) | Pending |
| 3 | [Phase 3: Redirect rule tooling](./phase-03-redirect-rule-tooling.md) | Pending |
| 4 | [Phase 4: Apply redirect and verify ordering](./phase-04-apply-redirect-and-verify-ordering.md) | Pending |
| 5 | [Phase 5: Docs, decision record, topology note](./phase-05-docs-decision-record-and-topology-note.md) | Pending |

Phase 2 blocks 4. Phase 3 may run in parallel with 1–2; Phase 4 requires both 2 and 3.

## Success Criteria

- [ ] `curl -fsSL https://ariadnev.com/install | bash` succeeds on clean darwin-arm64; sha256 verifies
- [ ] `https://ariadnev.com/version` returns the 1.0.0 tag; `av update --check` resolves against it
- [ ] `curl -sI https://vcskill.vchun.dev/install` → `302`, `Location: https://ariadnev.com/install`
- [ ] Piped-bash install still works end-to-end *through* the old host
- [ ] Deleting the redirect rule restores direct legacy serving within seconds (tested, then re-applied)
- [ ] `git diff` shows zero changes to the four frozen files; `wrangler deployments list --name vcskill` still shows `b93d9d2`
- [ ] `pnpm run test:qualification` green
- [ ] Path-traversal attempts against `ariadnev.com/download/*` are rejected in-Worker

## Risks

| Risk | Signal | Pre-decided response |
|---|---|---|
| Single Redirect does **not** run before a Worker holding the host via Custom Domain | Phase 4 probe: old host still serves 200 instead of 302 | **Stop.** Do not modify frozen files. Report and re-open the options fork (defer redirect to Phase 12 is acceptable) |
| Legacy `GH_TOKEN` PAT expires inside the rollback window | GitHub PAT expiry date | Decision-recorded manual secret renewal — the one place the freeze's letter yields to its intent |
| `bavanchun/vcskill` repo recreated, breaking the rename redirect the legacy worker depends on | n/a — preventable | Record invariant: **never create `bavanchun/vcskill`** until legacy decommission |
| 301 cached by intermediaries defeats rollback | n/a | Use **302** for the whole rollback window; flip to 301 only after it closes |

## Open questions

1. Legacy `GH_TOKEN` PAT expiry date — not readable via API; needs manual check.
2. Should `www.ariadnev.com` also be bound? Plan assumes yes via a second custom domain (no extra permission needed).

<!-- slug: ariadnev-domain-cutover-bridge-and-redirect -->
