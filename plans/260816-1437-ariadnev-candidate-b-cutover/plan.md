---
title: "ariadnev candidate-b cutover: real site, real docs, controlled production"
description: "Take ariadnev.com from the interim holding page to the Phase 12 candidate-b topology: rebranded Astro site, the Fumadocs docs product with EN/VI content, and a deploy-workflow-driven staging → production cutover that retires the bridge."
status: in-progress
priority: P1
effort: "4-6d"
tags: [web, docs, cloudflare, cutover, rebrand]
created: 2026-08-16
---

# ariadnev candidate-b cutover

## Outcome

`https://ariadnev.com/` serves the rebranded marketing site, `https://docs.ariadnev.com/`
serves versioned EN/VI documentation built from the kit's signed docs bundle, and both are
deployed by `deploy.yml` from an immutable input — not by hand. The interim
`ariadnev-bridge` Worker is retired; `vcskill.vchun.dev` keeps redirecting.

## Why B, not "serve the site from the bridge"

The bridge is documented as temporary (`workers/bridge/src/index.js:9-10`,
`topology.json` `interim.host.retireAt: phase-12-cutover`). Bolting assets onto it
would ship a second ad-hoc production surface and leave the deploy control plane
(`deploy.yml`, `deploy-units.mjs`, cutover records, rollback) still never exercised.
The user chose the full path on 2026-08-16.

## Decisions taken in this plan (flag if wrong)

| Decision | Choice | Basis |
|---|---|---|
| Docs hostname | `docs.ariadnev.com` (staging: `staging.docs.ariadnev.com`, `staging.ariadnev.com`) | mirrors the existing `docs.<apex>` convention in `topology.json` |
| Source repos | stay **private**; site/docs carry no "view source" links | both repos are PRIVATE today; nothing in scope changes that |
| Docs locales | EN + VI, versioned, `stable` alias | already decided 2026-08-08 (journal) and encoded in the archived docs platform |
| Docs platform | port `apps/docs` + `tests/docs` from `archive/feat/web-workspace-contracts` (its most complete tip) | already written and tested; only package names and paths drift from `main` |
| Worker names | new `ariadnev-docs[-staging]`, `ariadnev-edge[-staging]` | fresh Workers, no collision with the frozen `vcskill` Worker or the bridge |
| Legacy decommission | **not** in this plan | topology says it waits for the rollback window to close |

## Constraints (unchanged from the repo)

- Frozen, do not touch: `worker.js`, `landing.html`, `wrangler.toml`, `landing-consistency.test.mjs`, the `vcskill` Worker's secrets/bindings.
- `topology.json` stays `selected: candidate-b`; unit order docs → edge; rollback edge → docs.
- Deploy inputs are immutable (`productSha` + exact release tag); no `latest`, no branch names.
- Production requires the `web-production` GitHub environment approval.
- Every phase ends in at least one focused conventional commit and green `pnpm run test:qualification`.

## Phases

| # | Phase | Depends on | Status |
|---|---|---|---|
| 1 | [Rebrand `apps/site` to ariadnev](phase-01-rebrand-site.md) | — | pending |
| 2 | [Port the docs platform onto `main`](phase-02-port-docs-platform.md) | — | pending |
| 3 | [Docs content pipeline + EN/VI content](phase-03-docs-content.md) | 2 | pending |
| 4 | [Retarget topology and Worker configs to ariadnev hosts](phase-04-topology-and-workers.md) | 1, 2 | pending |
| 5 | [Provision the deploy control plane and ship staging](phase-05-control-plane-and-staging.md) | 3, 4 | pending |
| 6 | [Production cutover, bridge retirement, records](phase-06-production-cutover.md) | 5 | pending |

Phases 1 and 2 are independent and may run in parallel (disjoint files: `apps/site/**` +
`tests/site/**` vs `apps/docs/**` + `tests/docs/**`).

## Acceptance criteria

1. `curl -s https://ariadnev.com/ | grep -c vcskill` → `0`; page is the Astro site, not the holding page.
2. `https://docs.ariadnev.com/en/stable/` and `/vi/stable/` render; `/llms.txt` answers.
3. `/install`, `/install.sh`, `/install.ps1`, `/version`, `/download/checksums.txt` on `ariadnev.com` are served by the combined edge Worker (`cf-worker` header / `wrangler deployments list --name ariadnev-edge`), not the bridge.
4. `wrangler deployments list --name ariadnev-bridge` → Worker deleted.
5. `wrangler deployments list --name vcskill` still shows `b93d9d2`; `vcskill.vchun.dev/install` still 302s.
6. A `cutover-record-production` artifact exists on the successful `deploy.yml` run; `deployment/inputs/production-*.json` is committed.
7. `pnpm run test:qualification` green on `main`; `grep -rI vcskill apps/ workers/edge workers/bridge tests/site tests/docs` matches only historical-record allowlisted lines.

## Risks

- **Custom-domain handoff**: `ariadnev.com` is bound to `ariadnev-bridge` as a Custom Domain. Wrangler refuses to bind the same hostname to a second Worker non-interactively. Phase 6 must detach it from the bridge (or delete the bridge) *immediately before* the edge unit deploys — a short window where `/install` answers 5xx unless the redirect-safe order in phase 6 is followed. Mitigation: deploy the edge Worker first **without** the apex route (workers.dev), verify, then swap the Custom Domain in one wrangler step.
- **Docs content honesty**: marketing/docs must describe ariadnev 1.0.0 as shipped (kit installer + skills, not the old "graph executor" copy). Source of truth: the release docs bundle + kit README.
- **Secrets**: `CLOUDFLARE_DEPLOY_TOKEN`, `CLOUDFLARE_WAF_TOKEN`, `CORE_POLICY_READ_TOKEN`, Worker `GH_TOKEN` must be created out-of-band by the account owner; the plan records names, scopes, and where they go, never values.

## Rollback

Per unit: `rollback.yml` / `scripts/deploy/rollback-units.mjs`. First-cutover rollback restores the legacy binding map (topology `firstCutover`); the bridge is redeployable from `workers/bridge/` in one command until it is deleted, and stays deployable from git after.
