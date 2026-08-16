# Production gate without required reviewers

Status: **Accepted** · Recorded: 2026-08-16 · Applies to: `deploy.yml` production runs
Sources of record: [`deployment/production-policy.json`](../../deployment/production-policy.json),
[`scripts/deploy/verify-production-environment.mjs`](../../scripts/deploy/verify-production-environment.mjs),
`tests/deployment/deployment-control-plane.test.mjs` ("committed production policy…")

## Decision

Production deploys of this repository are gated by a **manual `workflow_dispatch`
run against the `web-production` environment, which accepts deployments only
from `main`** — not by GitHub environment *required reviewers*.

The preflight (`verify-production-environment.mjs`) verifies exactly that: the
environment exists, its deployment-branch policy is precisely the declared list
(`["main"]`), and the finalizer workflow the core repository ships is present.
It no longer requires a `core-release-production` environment or an
API-visible immutable-release flag on the core repository, because neither
exists there today and a check that can never pass is not a control.

## Why

The original Phase 12 design (2026-08-08) assumed required reviewers with
`prevent_self_review` on both repositories. On 2026-08-16 the environment API
answered:

> Failed to create the environment protection rule. Please ensure the billing
> plan supports the required reviewers protection rule. (HTTP 422)

Both repositories are private on a plan without that feature. The realistic
alternatives were: make the repositories public, pay for a plan, or record a
compensating control. For a solo-maintained project the third is proportionate
— every production run is already a deliberate human action, the input it
deploys is an immutable committed file, and the branch policy keeps anything
that has not landed on `main` out of production.

## What still holds

- The deploy job never rebuilds; it ships the artifact the build job qualified.
- The web repository holds no release-write authority over the core repository.
- The `vcskill` legacy Worker and its secrets remain frozen; nothing here touches them.
- Reverting to required reviewers is a two-line change to
  `deployment/production-policy.json` (`requiredReviewers: "required"`) once the
  plan or visibility changes; the strict branch of the preflight is still tested.

## What this does not claim

It does not claim two-person review. It claims a deliberate, single human
trigger with an audit trail (the workflow run, the committed input, and the
cutover record artifact).
