# vcskill-web

The public web surface for [**vcskill**](https://vcskill.vchun.dev): an Astro
marketing site, a static Fumadocs documentation product, and the Cloudflare
Worker that serves the release routes.

The vcskill source repository is private. This repository is its **only** public
face: it proxies the private repository's GitHub Releases with a server-side
token, so anyone can `curl … | bash` without touching GitHub.

```
GET /                 → marketing site
GET /install          → install.sh          (proxied from the private repo)
GET /install.sh       → install.sh
GET /install.ps1      → install.ps1
GET /version          → current release version   (?version=<semver> pins it)
GET /download/<asset> → release asset             (?version=<semver> pins it)
```

`?version=<stable semver>` pins `/version` and `/download/<asset>` to one exact
release identity. The installer routes deliberately ignore it and make no
pinning claim — the installer they return resolves its own download targets at
run time.

## Workspace

A pinned pnpm workspace. Node and pnpm versions are fixed in `package.json`;
every dependency is an exact version and `pnpm-lock.yaml` is committed.

| Package | What |
|---|---|
| `apps/site` | Astro marketing site (Phase 6) |
| `apps/docs` | Static Next/Fumadocs documentation (Phase 7) |
| `packages/contracts` | Trusted docs-bundle schema, archive policy, verify-first atomic extractor |
| `packages/tokens` | Shared design tokens (Phase 5) |
| `workers/edge` | Release edge Worker: install, version, download |

```sh
pnpm install --frozen-lockfile

pnpm run test               # vitest suites + the native contract suites
pnpm run typecheck          # strict TypeScript across the workspace
pnpm run build              # every package build
pnpm run contracts          # compatibility, deployment, and contracts suites
pnpm run test:qualification # the full gate a deploy runs
```

## Topology

Candidate B, decided in
[`docs/decisions/edge-routing-topology.md`](docs/decisions/edge-routing-topology.md).

One combined Worker owns the protected release routes and delegates every
unprotected path to an `ASSETS` binding with `run_worker_first = true`, so a
physical `/version` or `/download/<asset>` file in the site output can never
pre-empt the handler. Documentation is a separate deployment.

Candidate A was rejected: a route pattern is matched against the full URL
including the query string and cannot itself contain a query, so admitting
`/install?from=docs` requires a terminal wildcard that also captures the
unprotected lookalike `/installer`.

## Deploying

`docs/operations/deployment-and-rollback.md` is the operator contract. In short:

```sh
node scripts/deploy/validate-deployment-input.mjs deployment/inputs/<name>.json
gh workflow run deploy.yml -f environment=staging -f input_path=deployment/inputs/<name>.json
```

Inputs are immutable — one `productSha`, one exact release tag, an explicit unit
set. Branch names, tag aliases, and `latest` are not representable. Production
approval comes from the `web-production` GitHub environment.

`deployment/topology.json` is the single authority for unit order, Wrangler
config paths, build outputs, and smoke routes.

## Secrets

The edge Worker needs one secret: a fine-grained GitHub PAT with **Contents:
read** on the private `bavanchun/vcskill` repository.

```sh
wrangler secret put GH_TOKEN --config workers/edge/wrangler.combined.toml
```

Secrets live on the deployed Worker in Cloudflare, never in this repository.
The combined Worker uses a secret namespace separate from the retained legacy
Worker, so rotating one cannot invalidate the other.

## Legacy runtime

`worker.js`, `landing.html`, `wrangler.toml`, and `landing-consistency.test.mjs`
are the **current production runtime and the first-cutover rollback target**.
They stay in place, and their credential context stays frozen, until the
production cutover completes and its rollback window closes. Do not modify or
delete them before then.
