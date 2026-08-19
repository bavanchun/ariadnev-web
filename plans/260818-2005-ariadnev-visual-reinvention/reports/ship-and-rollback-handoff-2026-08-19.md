# Ship and rollback handoff — 2026-08-19

This is a recipe for a later authorized ship action. It does not authorize a
deployment, create a deployment input, or mutate staging/production.

## Immutable candidate pins

```text
productSha               8013949b66ed09a9c9c0e816c9f0e0151046a182
qualificationEvidenceSha 890662afb5545eccac3a96480a49fd3351313f6e
release                   ariadnev@1.1.0
release coreSha           64100bb815d1cc8fb3c70118d1cfbf5d93d32ace
topology                  candidate-b
units                     docs,edge
```

The evidence SHA is a descendant of the product SHA and is intentionally
different. The product SHA selects what is built; the evidence SHA only attests
it. Do not replace either value with a branch, short SHA, `latest`, or another
commit without requalification.

## Authorized ship recipe

From a clean checkout of the evidence commit, verify the pins before writing
any deployment artifact:

```sh
git status --porcelain=v1 --untracked-files=all
git cat-file -e 8013949b66ed09a9c9c0e816c9f0e0151046a182^{commit}
git cat-file -e 890662afb5545eccac3a96480a49fd3351313f6e^{commit}
git merge-base --is-ancestor \
  8013949b66ed09a9c9c0e816c9f0e0151046a182 \
  890662afb5545eccac3a96480a49fd3351313f6e
```

The status command must print nothing.

Only after explicit ship authorization, compose and validate the immutable
input. The suggested filename is new and does not overwrite an existing input:

```sh
pnpm run compose:input -- \
  --environment production \
  --product-sha 8013949b66ed09a9c9c0e816c9f0e0151046a182 \
  --evidence-sha 890662afb5545eccac3a96480a49fd3351313f6e \
  --units docs,edge \
  --pin releases/ariadnev.json \
  --out deployment/inputs/production-ariadnev-1.1.0-prismatic.json

node scripts/deploy/validate-deployment-input.mjs \
  deployment/inputs/production-ariadnev-1.1.0-prismatic.json
```

Review and commit that generated input in the authorized ship change. Before
production, run the existing read-only environment preflight with an operator-
supplied token; never record the token in shell history, documentation, or the
repository:

```sh
GITHUB_TOKEN=<operator-supplied> \
  node scripts/deploy/verify-production-environment.mjs
```

Then dispatch the existing protected workflow:

```sh
gh workflow run deploy.yml \
  -f environment=production \
  -f input_path=deployment/inputs/production-ariadnev-1.1.0-prismatic.json
```

The topology authority deploys `docs` first and `edge` second. Do not cancel a
run after a unit has deployed; allow smoke checks to finish and use explicit
rollback if required. Production approval remains owned by the
`web-production` GitHub environment.

## Rollback preparation

Before dispatching deploy, record the currently live Worker version UUID for
both `docs` and `edge` and capture the existing legacy custom-domain/route map.
Do not use the word `previous` as a rollback target. Create a new rollback plan
only during the authorized ship action with this required shape:

```json
{
  "schemaVersion": 1,
  "environment": "production",
  "reason": "operator-supplied incident reason",
  "units": [
    {
      "id": "docs",
      "targetWorkerVersionId": "<recorded pre-deploy docs Worker version UUID>"
    },
    {
      "id": "edge",
      "targetWorkerVersionId": "<recorded pre-deploy edge Worker version UUID>"
    }
  ],
  "firstCutover": false
}
```

Validate the plan without mutation before making it available to the workflow:

```sh
node scripts/deploy/rollback-units.mjs \
  deployment/plans/<authorized-plan-name>.json --dry-run
```

If rollback is required, dispatch:

```sh
gh workflow run rollback.yml \
  -f environment=production \
  -f plan_path=deployment/plans/<authorized-plan-name>.json
```

Rollback order is derived from topology and must remain `edge` then `docs`.
For a true first-cutover restoration, set `firstCutover` to `true`, include the
captured `legacyBindingMap`, and set `removeDocsHostname` to `true`. Never set
or perform `mutateLegacyCredential`; the retained `vcskill` Worker and its
credential context remain frozen while the rollback window is open.

## Stop conditions

Do not ship if the checkout is dirty, either SHA cannot be resolved, ancestry
fails, the composed input fails validation, production preflight fails, live
Worker version identities were not recorded, the binding map is absent for a
first-cutover rollback, or the protected environment approval is unavailable.
