# Deployment and rollback

The durable operator contract for the vcskill web surface. The workflows and
scripts named here are the only supported path to production; anything done by
hand around them leaves no evidence and no rollback target.

## Authorities

| Question | Answered by |
|---|---|
| Which topology is live? | `deployment/topology.json` (Candidate B, decided in [`docs/decisions/edge-routing-topology.md`](../decisions/edge-routing-topology.md)) |
| What may be deployed? | `deployment/deployment-contract.schema.json` |
| What happened? | `deployment/cutover-record.schema.json` |
| Where is staging? | `docs/decisions/edge-staging-state.json` |

`deployment/topology.json` is the single source of unit order, Wrangler config
paths, build outputs, and smoke routes. No script chooses an order of its own.

## Immutable inputs

A deployment input names one commit and one release, both exactly:

- `productSha` — the web commit that is built and deployed. This is the **only**
  thing any job checks out for a build.
- `qualificationEvidenceSha` — a descendant commit carrying the evidence that
  attests `productSha`. It never changes what ships. The validator rejects an
  input where the two are equal.
- `release.tag`, `release.version`, `release.coreSha` — the exact core release.
- `digests` — docs bundle, manifest, schema, and checksums.
- `units` — the explicit unit set. There is no "all units" shorthand.

Branch names, tag aliases, `latest`, and short SHAs are not representable. Run
the gate directly with:

```sh
node scripts/deploy/validate-deployment-input.mjs deployment/inputs/<name>.json
```

## Order

Deploy runs in topology order and rollback runs in its exact reverse:

```text
deploy    docs -> edge
rollback  edge -> docs
```

`docs` goes first so the marketing site never links at a documentation host that
does not answer yet. `edge` goes last because under Candidate B it owns both the
protected release routes and the site assets, so it is the unit that takes the
apex hostname at cutover.

Every machine route is smoke-checked after its unit deploys. A route that
answers `200 text/html` has been shadowed by the site layer and fails the check
immediately, before the next unit is touched.

## Running a deployment

```sh
gh workflow run deploy.yml -f environment=staging -f input_path=deployment/inputs/<name>.json
```

Production uses the same command with `environment=production`. Approval comes
from the `web-production` GitHub environment, not from anything in the workflow
file — a caller cannot route around it.

Before any production run, the preflight verifies live policy read-only:

```sh
GITHUB_TOKEN=… node scripts/deploy/verify-production-environment.mjs
```

It fails closed on an absent or weak `web-production` or
`core-release-production` environment, missing required review, admin bypass,
permitted self-review, an unexpected finalizer workflow digest, or a core
repository that does not enforce immutable releases. It holds no release-write
authority over the core repository and never requests one.

## Pausing and aborting

Deployments are serialized per environment with `cancel-in-progress: false`. An
interrupted deploy leaves the topology half-swapped, so a run is never
cancelled midway.

- **Before the deploy job** — cancel the run; nothing was mutated.
- **After a unit deployed** — do not cancel. Let the smoke check fail the run,
  then roll back explicitly.

## Rollback

Two different recoveries share one workflow and are never conflated.

**Version rollback.** The unit already owns its hostname and only its Worker
version moves backwards. Every unit needs an explicit `targetWorkerVersionId`;
`previous` is not a value.

```sh
gh workflow run rollback.yml -f environment=production -f plan_path=deployment/plans/<name>.json
```

**First-cutover rollback.** The new topology took the apex hostname for the
first time. This is a *binding* operation, not a version rollback: the captured
legacy custom-domain and route map goes back to the legacy Worker and the new
documentation hostname is removed or reassigned. A plan with
`firstCutover: true` is rejected unless it carries `legacyBindingMap` and
`removeDocsHostname: true`.

The retained legacy Worker `vcskill` is the first-cutover rollback target. Its
credential context is **frozen** until the rollback window closes. Any plan that
would mutate it is rejected — writing it while rollback is still an available
recovery path destroys the thing being rolled back to.

## Evidence

Every attempt writes a sanitized cutover record. Records move forward only:

```text
preflight -> deploy -> soak
preflight -> deploy -> rollback
```

A rollback is terminal. Evidence may accumulate across records, but
`productSha` and `topology` may never change within one cutover — evidence
cannot alter what was deployed.

Each observation carries the `deploymentLabel` it was actually seen under.
Controlled-failure deployments and read-only legacy-production observations keep
their own labels and are never relabeled as the final deployment. A record
containing a token, an `X-Amz-Signature`, or a 32-hex account identifier is
rejected before it is written.

## Soak

```sh
node scripts/deploy/verify-soak.mjs cutover-record.json
```

The window is at least 24 continuous hours and is measured from the **most
recent reset**, not the first start. Any of `deploy`, `rollback`,
`config-change`, `smoke-failure`, or `manual` restarts it. A failed observation
inside the window defeats the soak regardless of elapsed time.

## Ownership

| Role | Owner |
|---|---|
| Deployment approval | `bavanchun` via the `web-production` environment |
| Rollback | `bavanchun` |
| Retained staging edge expiry | `bavanchun`, only after Phase 12 no longer depends on it |

## Known gaps

Two controls are source-complete but not yet applied, and are tracked in
[`edge-staging-state.json`](../decisions/edge-staging-state.json):

- The raw dot-segment ingress rule needs a Cloudflare API token with
  Zone → WAF → Edit. Until it is applied, `/download/./<asset>` still resolves
  after Cloudflare's path normalization.
- The held-draft permission gate needs the approved single-repository PAT with
  Contents read and Actions write. The principal role gate already passes.
