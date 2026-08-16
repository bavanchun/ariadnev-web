# Phase 5 — Provision the deploy control plane and ship staging

**Depends on:** 3, 4.

## Out-of-band by the account owner (names only, never values)
| Where | Name | Scope |
|---|---|---|
| GitHub env `web-staging` | `CLOUDFLARE_DEPLOY_TOKEN` | Workers Scripts:Edit, Workers Routes:Edit, Zone:Read on `ariadnev.com` |
| GitHub env `web-staging` | `CLOUDFLARE_WAF_TOKEN` | Zone WAF:Edit on `ariadnev.com` |
| GitHub env `web-production` (required reviewer = owner) | same two names | same |
| repo secret | `CORE_POLICY_READ_TOKEN` | fine-grained PAT, `bavanchun/ariadnev-kit` Administration:Read + Contents:Read (what `verify-production-environment.mjs` needs) |
| Worker secret `ariadnev-edge[-staging]` | `GH_TOKEN` | fine-grained PAT, `ariadnev-kit` Contents:Read (its own namespace, like the bridge) |

## Steps
1. `gh api` create environments `web-staging`, `web-production` (reviewer on production).
2. Owner sets secrets (checklist above); `gh secret list -e …` confirms names.
3. Write `deployment/inputs/staging-ariadnev-1.0.0.json` — `productSha` = the main commit after phase 4, release tag `ariadnev@1.0.0`, units `[docs, edge]`; `validate-deployment-input.mjs` passes.
4. `gh workflow run deploy.yml -f environment=staging -f input_path=…`; watch; smoke every route on `staging.ariadnev.com` and `staging.docs.ariadnev.com`.
5. Fix whatever the first real run exposes (the kit's 1.0.0 journal shows this always happens); commit fixes; rerun.
6. Commit: `chore(deploy): add the staging ariadnev 1.0.0 deployment input`.

## Validation
- Successful `deploy.yml` staging run with `cutover-record-staging` artifact.
- `verify-convergence.mjs` green against staging.

## Findings from the first run (2026-08-16)

- `gh api PUT /environments/web-production` with `reviewers` → **422 "billing plan does not support required reviewers"** (private repo, free plan). `web-staging` and `web-production` exist without protection rules. `scripts/deploy/verify-production-environment.mjs` requires required reviewers + `prevent_self_review` + a branch policy on both `web-production` (this repo) and `core-release-production` (`ariadnev-kit`, which has **no environments** and reports `immutable_releases: null`). Options: (a) make the repos public (reviewers available on free plan), (b) upgrade the plan, (c) relax the policy check to accept `workflow_dispatch` + branch policy as the human gate for a solo-maintained private repo, recorded as a decision. Owner decides.
- Docs unit deployed to staging locally via `deploy-units.mjs` (Cloudflare OAuth); DNS/cert for the Custom Domain took ~1 minute, during which the smoke fetch fails and the run halts — re-running is idempotent and passed 5/5.
