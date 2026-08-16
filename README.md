# ariadnev-web

The public web surface for **ariadnev** (formerly vcskill): an Astro marketing
site, a static Fumadocs documentation product, and the Cloudflare Worker that
serves the release routes.

**The canonical host is [`ariadnev.com`](https://ariadnev.com).**

```sh
curl -fsSL https://ariadnev.com/install | bash
```

`vcskill.vchun.dev` is the legacy host. It answers with a `302` to the matching
path on `ariadnev.com`, so old bookmarks and piped-bash callers keep working.
The redirect is a source-controlled Cloudflare Single Redirect, not a deploy:

```sh
CLOUDFLARE_API_TOKEN=… node scripts/manage-legacy-host-redirect.mjs --inspect   # read-only, default
CLOUDFLARE_API_TOKEN=… node scripts/manage-legacy-host-redirect.mjs --apply
CLOUDFLARE_API_TOKEN=… node scripts/manage-legacy-host-redirect.mjs --remove    # instant rollback
```

Behind the redirect, `vcskill.vchun.dev` still runs the frozen legacy Worker
described under [Legacy runtime](#legacy-runtime). Since 2026-08-16 the
candidate-b topology is live: `ariadnev.com` is the combined edge Worker
(`ariadnev-edge`) serving the Astro site and the release routes, and
`docs.ariadnev.com` is the documentation Worker (`ariadnev-docs`). The cutover
is recorded in [`plans/260816-1437-ariadnev-candidate-b-cutover/`](./plans/260816-1437-ariadnev-candidate-b-cutover/plan.md)
and `deployment/records/`; the interim bridge that first served the apex is
retired (see
[`docs/decisions/ariadnev-bridge-and-legacy-redirect.md`](./docs/decisions/ariadnev-bridge-and-legacy-redirect.md)).

The ariadnev source repository (`bavanchun/ariadnev-kit`) is private. This
repository is its **only** public face: it proxies the private repository's
GitHub Releases with a server-side token, so anyone can `curl … | bash` without
touching GitHub.

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
| `apps/site` | Astro marketing site |
| `apps/docs` | Static Next/Fumadocs documentation, EN + VI, versioned by release |
| `packages/contracts` | Trusted docs-bundle schema, archive policy, verify-first atomic extractor |
| `packages/tokens` | Shared design tokens |
| `workers/edge` | Release edge Worker: install, version, download, plus the site assets under candidate B |
| `workers/bridge` | Interim Worker that served `ariadnev.com` until the 2026-08-16 cutover; kept redeployable as an emergency rollback |
| `releases/` | The release pin (`ariadnev.json`) and the synchronised docs bundle it names |
| `scripts/docs-content/` | Turns the pinned release bundle + authored EN/VI pages into the docs content root |

```sh
pnpm install --frozen-lockfile

pnpm run test               # vitest suites + the native contract suites
pnpm run typecheck          # strict TypeScript across the workspace
pnpm run build              # every package build
pnpm run contracts          # compatibility, deployment, and contracts suites
pnpm run test:qualification # the full gate a deploy runs
pnpm run docs:content       # regenerate apps/docs/content/generated from the release pin
```

## Documentation content

`apps/docs` builds from a content root, never from ad-hoc files:

- `releases/ariadnev.json` pins one exact release and names the committed
  `docs-bundle.tar.gz` + manifest synchronised from it. Nothing is fetched at
  build time.
- `scripts/docs-content/build-content-root.mjs` verifies that bundle with
  `packages/contracts`, renders the reference pages (CLI, providers, skills,
  workflows, release notes) from it, and merges the authored pages under
  `apps/docs/content/authored/{en,vi}/`. Every authored page must exist in both
  locales, must not carry an H1, and links to sibling pages with `%ROOT%`.
- The output under `apps/docs/content/generated/` is gitignored and
  byte-reproducible; `tests/docs/content-pipeline.test.mjs` asserts it.

Bumping to a new release is: download the release's `docs-bundle.tar.gz` and
`docs-bundle.manifest.json` into `releases/ariadnev-<version>/`, update the
pin, rebuild, and let the tests tell you what the new reference changed.

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

Inputs are composed, never typed: `pnpm run compose:input -- --environment … --product-sha … --evidence-sha … --out …`.
Every successful run uploads a `cutover-record-<environment>` artifact; the
records of the 1.0.0 cutover live under `deployment/records/`. Production runs
are gated as `deployment/production-policy.json` declares (see
`docs/decisions/production-gate-without-required-reviewers.md`).

Inputs are immutable — one `productSha`, one exact release tag, an explicit unit
set. Branch names, tag aliases, and `latest` are not representable. Production
approval comes from the `web-production` GitHub environment.

`deployment/topology.json` is the single authority for unit order, Wrangler
config paths, build outputs, and smoke routes.

## Secrets

The kit repository is private, so the edge Worker authenticates every upstream
read. It does so as a **GitHub App** with **Contents: read** on
`bavanchun/ariadnev-kit` — a private key with no expiry date, exchanged at run
time for a one-hour installation token. A personal access token would take the
public install path down on its expiry date; see
[`docs/decisions/private-repo-edge-authentication.md`](docs/decisions/private-repo-edge-authentication.md).

```sh
wrangler secret put GH_APP_ID --config workers/edge/wrangler.combined.toml
wrangler secret put GH_APP_INSTALLATION_ID --config workers/edge/wrangler.combined.toml
wrangler secret put GH_APP_PRIVATE_KEY --config workers/edge/wrangler.combined.toml
```

`GH_APP_PRIVATE_KEY` must be **PKCS#8** (`BEGIN PRIVATE KEY`). GitHub issues
PKCS#1; convert it once with
`openssl pkcs8 -topk8 -inform PEM -outform PEM -nocrypt -in <downloaded>.pem`.

Secrets live on the deployed Worker in Cloudflare, never in this repository.
The combined Worker uses a secret namespace separate from the retained legacy
Worker, so rotating one cannot invalidate the other.

`edge-health.yml` probes the live install path daily
(`pnpm run probe:edge` runs the same check locally), because a credential that
stops working is otherwise invisible until someone tries to install.

## Legacy runtime

`worker.js`, `landing.html`, `wrangler.toml`, and `landing-consistency.test.mjs`
are the **current production runtime and the first-cutover rollback target**.
They stay in place, and their credential context stays frozen, until the
production cutover completes and its rollback window closes. Do not modify or
delete them before then.
