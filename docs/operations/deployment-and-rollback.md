# Deployment and rollback

This runbook is the operator entry point for the web deployment control plane. Its executable authorities are the schemas and topology in [`deployment/`](../../deployment/), the scripts in [`scripts/deploy/`](../../scripts/deploy/), and the protected [`deploy.yml`](../../.github/workflows/deploy.yml) and [`rollback.yml`](../../.github/workflows/rollback.yml) workflows.

## Trust boundary

The `web-production` GitHub environment is the production approval trust anchor. The control plane does not claim that GitHub exposes live API fields for administrator bypass, self-review prevention, or immutable-release repository policy. Instead, an operator produces a bounded, sanitized document conforming to [`production-policy-attestation.schema.json`](../../deployment/production-policy-attestation.schema.json) after verifying both protected environments and release settings through the approved administrative process.

The attestation asserts exactly:

- `web-production` in `bavanchun/vcskill-web` and `core-release-production` in `bavanchun/vcskill`;
- one required reviewer, self-review prevention, no administrator bypass, and protected branches only;
- immutable releases enabled;
- the exact finalizer ref, SHA-256 digest, environment, and `actions: read` plus `contents: write` job permissions;
- issue and expiry timestamps no more than 24 hours apart;
- the constrained PAT policy below.

The canonical attestation digest is stored in the deployment input and is suitable for the core finalizer's `immutable_policy_attestation_digest` input. The canonical deployment-input digest excludes only its own digest field. Production ingress activation binds both digests, the Phase 3 policy digest, and the exact ingress-prestate digest.

The accepted PAT is one repository-scoped exception for `bavanchun/vcskill`: Contents read and Actions write only. It may enter only edge release reads, exact artifact retrieval, and protected finalizer dispatch. It has no Contents, release, or Administration write and never enters content/build, web/Cloudflare deployment, or the finalizer job.

## Immutable product and evidence lineage

`product.sha` is the only checkout, build, and deploy source. Its immutable tag must resolve to that exact commit. `qualification.evidenceSha` must be a descendant. The complete `product.sha..qualification.evidenceSha` diff must be a nonempty, ordered inventory matching `qualification.evidencePaths` exactly and may contain only additions or modifications under:

- `tests/qualification/`
- `tests/baselines/flagship/`

Deletes, renames, code, configuration, workflow, app output, invented inventory entries, and path-order mismatch are rejected. A canonical digest of the exact regular-blob tree (`mode`, object ID, and path) must also match `qualification.evidenceDigest`; symlinks, submodules, missing blobs, and content drift fail closed. The evidence SHA is never a build source.

Staging requires the held, non-latest draft state: `publicationState=held-draft`, `draft=true`, `immutable=false`, `latest=false`. Production requires the published immutable latest state: `publicationState=immutable-publication`, `draft=false`, `immutable=true`, `latest=true`.

## Input and clean-checkout sequence

The deployment input includes exact product/release identity, all output/config/unit/topology digests, policy-attestation digest, canonical deployment-input digest, Phase 11 evidence inventory, the strict Phase 3 ingress snapshot, explicit rollback versions, and first-cutover state. The topology validator also freezes the literal build/deploy/rollback commands, approved configs and outputs, Worker identities, protected routes, smoke URLs, GitHub environments, ingress manager, credential policy, and finalizer map before any command can receive a mutation credential.

Owner phases may not have supplied app configs or outputs yet. A clean workflow therefore runs structural, schema, policy, and lineage validation with `--skip-artifacts=true`. Deploy then builds every owner from `product.sha`, verifies each config/output digest and the aggregate unit/product digests, and only then permits mutation. Rollback performs structural validation but never rebuilds or requires current outputs.

Read-only local inspection:

```bash
node scripts/deploy/validate-deployment-input.mjs --input=path/to/deployment-input.json --skip-artifacts=true
node scripts/deploy/deploy-units.mjs --input=path/to/deployment-input.json --dry-run
node scripts/deploy/rollback-units.mjs --input=path/to/deployment-input.json --dry-run
node scripts/deploy/rollback-units.mjs --input=path/to/deployment-input.json --dry-run --first-cutover
```

Dry runs redact command arguments and never contact GitHub or Cloudflare. A real deploy still fails closed if an owner output is absent or differs after rebuilding.

## WAF transaction and deploy

Candidate B builds docs and the combined edge/site unit, verifies all artifacts, activates the Phase 3 ingress rule with `desiredEnabled=true`, and deploys docs followed by combined edge/site. Every changed unit is smoked immediately. Protected routes must return a non-HTML content type and the exact `cache-control: no-store` policy; an HTML `200` is a hard failure.

The deployment input carries the exact captured Phase 3 prestate, including absent and disabled states. Production apply also carries the exact binding envelope described above. The committed Phase 3 manager remains responsible for idempotency, preserving unrelated rules, and exact-state comparison.

After ingress activation, any artifact verification, deploy command, immutable-version extraction, or smoke failure automatically attempts to restore the exact captured prestate before the original failure is surfaced. A restore failure is a separate hard failure. Evidence is bounded and stores digests and sanitized route names, never credentials, raw provider IDs, reviewer identity, private URLs, or command stderr.

Both workflows use the same `web-mutation-${environment}` concurrency group, so deploy and rollback cannot mutate one environment concurrently. The Cloudflare token is read through stdin, removed from the workflow process environment before Node starts, scrubbed from every child-command base environment, and injected only into explicit Wrangler mutation commands. Build commands never inherit Cloudflare, GitHub, package-registry, or consolidated PAT credentials.

## Exact rollback and first cutover

Normal rollback runs Wrangler 4.120's positional form for each unit in reverse order:

```text
wrangler rollback VERSION --config CONFIG --yes
```

After unit restoration and smoke, rollback calls Phase 3 `restore` with the original ingress snapshot. It never calls ingress `apply`.

First-cutover input additionally binds:

- the exact legacy Worker version;
- the ordered custom-domain and route-set state plus canonical digest;
- unchanged legacy credential context and exact `GH_TOKEN` secret-name set;
- distinct legacy/candidate Worker names and secret namespaces;
- the separate current docs Worker identity `vcskill-docs-production`;
- the candidate output digest;
- the exact docs hostname, prior Worker ownership (including an assigned prior owner), and the complete mutable DNS prestate/digest: type, name, content, TTL, proxy mode, comment, tags, and supported settings.

The source-controlled restore sequence is: legacy version, legacy bindings from frozen `wrangler.toml`, then captured docs owner/DNS state. The docs adapter queries only the exact production hostname and zone, first proves the current owner is the separate `vcskill-docs-production` Worker, then restores or detaches ownership. It re-reads DNS after the Custom Domain mutation before deciding whether a record still needs an update or deletion, and verifies the final canonical state. It does not use generic Worker deletion. No cutover or rollback operation puts, deletes, copies, or rotates a secret. Secret-set drift, route/domain order drift, candidate-output drift, legacy credential mutation, inconsistent docs state, and undeclared restore operations fail closed.

## Evidence, convergence, and soak

[`write-cutover-record.mjs`](../../scripts/deploy/write-cutover-record.mjs) enforces legal lifecycle transitions, increasing timestamps, stable identity, schema bounds, and recursive redaction. Identity includes the policy-attestation, deployment-input, and ingress-prestate digests.

Convergence compares the exact environment-specific release state, product/release identity, unit/config/output digests, and passing smoke. Every protected route must appear exactly once in the convergence observation; one passing route cannot stand in for the complete inventory. Staging converges on the held draft; production converges on immutable latest publication. Soak requires ordered passing samples at both boundaries of a continuous window of at least 24 hours. Reset timestamps must be valid, bounded by cutover and observation time, and strictly ordered. Deployment, binding, credential, release, output, smoke, or convergence resets restart the window.

```bash
node scripts/deploy/write-cutover-record.mjs --input=path/to/initial-record.json > sanitized-initial-record.json
node scripts/deploy/write-cutover-record.mjs --input=path/to/next-record.json --previous=sanitized-initial-record.json > sanitized-next-record.json
node scripts/deploy/verify-convergence.mjs --input=path/to/deployment-input.json --observation=path/to/live-observation.json
node scripts/deploy/verify-soak.mjs --input=path/to/soak-observation.json --now=2026-08-10T00:00:00Z
```

## Local verification

```bash
node --test tests/deployment/deployment-control-plane.test.mjs
```

Tests and implementation work do not mutate GitHub or Cloudflare. Staging qualification and production cutover remain protected operator actions.
