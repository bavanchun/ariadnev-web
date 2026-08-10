# Edge routing topology decision

Status: **Candidate B selected**
Recorded: 2026-08-10
Phase: 3 (edge worker routing spike)
Required by: Phase 4 (workspace and config contracts), Phases 9–12

Sources of record:

- [`edge-routing-observations.json`](./edge-routing-observations.json) — sanitized observation source
- [`edge-routing-reprobe.json`](./edge-routing-reprobe.json) — re-runnable live probe of current state
- [`edge-staging-state.json`](./edge-staging-state.json) — retained endpoint, versions, and ownership

## Decision

The vcskill public edge uses **Candidate B**: one combined Worker owns the
protected release routes and delegates every unprotected path to an `ASSETS`
binding. Documentation remains a separate deployment. No later phase may
silently switch back to Candidate A.

## Why Candidate A fails

Cloudflare matches a Worker route pattern against the full URL *including* the
query string, and a route pattern may not itself contain a query. The frozen
Phase 1 contract requires `/install?from=docs`, `/version?source=landing`, and
`/download/checksums.txt?source=landing` to keep working, so every protected
pattern needs a terminal wildcard:

```text
staging.vcskill.vchun.dev/install*
staging.vcskill.vchun.dev/install.ps1*
staging.vcskill.vchun.dev/version*
staging.vcskill.vchun.dev/download/*
```

`/install*` also captures `/installer`, and `/version*` also captures
`/versioning`. Under a pure Candidate A split those lookalikes land on an edge
Worker that owns no site content, and there is no proven non-recursive path back
to the site deployment for them. Configuration convenience is not evidence, so
the gate fails and Candidate A is rejected.

## Why Candidate B passes

The combined Worker classifies the exact path *before* any decoding or fallback:

- Protected paths are the five exact routes plus `/download/<non-empty-segment>`.
- A wildcard-captured lookalike (`/installer`, `/versioning`, `/download`) is
  classified as unprotected and delegated to `ASSETS`, preserving frozen site
  behavior.
- `assets.run_worker_first = true` means a physical `/version`, `/install.sh`, or
  `/download/checksums.txt` file in the site output can never pre-empt the
  handler. The fixture ships exactly those colliding files to keep this honest.
- `assets.not_found_handling = "404-page"` gives an explicit physical 404. SPA
  fallback is disabled, so a machine route can never be shadowed by a 200 HTML
  page.
- Protected errors — invalid selector, malformed encoding, missing secret,
  upstream failure — never call `env.ASSETS.fetch()`.
- `applyStaticResponsePolicy()` applies the approved security and cache policy to
  unprotected asset responses, because `_headers` is not assumed to cover
  Worker-generated responses. Protected responses keep their `no-store` contract
  and are never passed through it.

## Release selector

An optional `version=<stable semver>` selector pins `/version` and
`/download/<asset>` to one exact `vcskill@<version>` release identity. Verified
live on the retained staging edge: `/version` → `0.11.0`,
`/version?version=0.10.0` → `0.10.0`.

- Absent selector keeps the frozen latest behavior.
- Empty, duplicate, encoded, malformed, prerelease, and build-metadata selectors
  are bounded 400 errors that never fall through.
- A pinned request never touches the `latest` endpoint, and a resolved release
  whose tag does not match the request fails closed.
- Installer routes ignore the selector entirely. `/install`, `/install.sh`, and
  `/install.ps1` are byte-for-byte the frozen Phase 1 behavior and make **no**
  pinning claim: the installer they return resolves its own download targets at
  run time. A fully pinned installer chain would require a separate core
  installer contract and is out of scope here.

## Rollback provenance

Composite rollback is proven by two separate observations, not one deployment:

1. **Staging binding reversal — pass.** The staging custom domain was detached
   from a stand-in and reattached to `vcskill-site-staging`; the endpoint
   returned to its retained behavior.
2. **Production read-only compatibility — pass.** The unchanged legacy
   production Worker (`vcskill`, version `e91ff904…`, tag `vcskill-0.11.0`) kept
   serving `/`, `/version`, and `/install` under its own credential context. No
   production route, domain, Worker, or secret was changed.

A third observation is retained as an **explicit failure**: the exact legacy
source returned `401` for `/install` when rehearsed on staging under the new
consolidated credential. That probe does not satisfy rollback and is not counted
as one. The production legacy credential state is frozen until the rollback
window closes.

Candidate B production uses a Worker identity and secret namespace separate from
the retained legacy Worker, so provisioning the consolidated PAT cannot
invalidate the first-cutover rollback target.

## Open gates

Two cells of the matrix do not pass and are not claimed as passing.

| Gate | Status | Blocked by |
|---|---|---|
| Raw dot-segment ingress guard | **blocked** | a Cloudflare API token with Zone → WAF → Edit |
| Held-draft token permission | **blocked** | a fine-grained PAT scoped to `bavanchun/vcskill` with Contents read + Actions write |

The ingress rule is fully source-controlled and corpus-verified in
`workers/edge/rules/raw-download-path-guard.json`; only its application to the
zone is outstanding. Apply it with:

```sh
CLOUDFLARE_API_TOKEN=… node scripts/manage-edge-ingress-rule.mjs apply staging
```

For draft access, the principal role gate passed — `bavanchun` has push access
to the private repository — but the token permission gate did not, because the
approved single-repository PAT is not provisioned. This consolidation carries
Actions write and is an operator-approved exception; it must not be described as
least privilege. Phase 9 owns the empirical held-draft proof.

## Consequences for later phases

- Phase 4 pins workspace and config contracts to the Candidate B shape: one
  combined Worker profile with an `ASSETS` binding, plus a separate docs
  deployment.
- Phase 6 replaces the fixture directory in `wrangler.combined.toml` with the
  real Astro output.
- Phases 9–12 must resolve the exact retained endpoint recorded in
  `edge-staging-state.json`, never a preview URL or a moving alias.
- Phase 12 attaches the production route to `wrangler.combined.production.toml`
  and enables the production half of the ingress rule. Until then the production
  instance stays disabled and the legacy root runtime is the rollback path.
- Phase 13 owns cleanup of the legacy root `worker.js`, `landing.html`,
  `wrangler.toml`, and `landing-consistency.test.mjs`.
