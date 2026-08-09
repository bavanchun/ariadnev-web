# vcskill-web

The public web, documentation, and release edge for [**vcskill**](https://vcskill.vchun.dev). This pnpm monorepo preserves the current production Worker while the Astro site, static docs, and Candidate B combined edge/site topology are qualified.

The vcskill source repo is private. This Worker is its **only public face**: it
serves the landing page and proxies the private repo's GitHub Releases with a
server-side token, so anyone can `curl … | bash` without touching GitHub.

```
GET /                 → landing page (landing.html)
GET /install          → install.sh          (proxied from private repo)
GET /install.ps1      → install.ps1
GET /version          → latest release tag
GET /download/<asset> → release binary       (token-proxied)
```

## Workspace commands

The pinned toolchain is Node 26.0.0 and pnpm 11.0.9.

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm typecheck
pnpm build
pnpm contracts
node --test tests/deployment/deployment-control-plane.test.mjs
```

Reserved release synchronization and qualification commands fail closed until their owning phases provide the required artifacts.

## Deployment control plane

The selected production topology is Candidate B: deploy the independent docs Worker, then the combined edge + Astro assets Worker. [`deployment/topology.json`](deployment/topology.json) is the sole unit/order/config/output/command authority. [`deploy.yml`](.github/workflows/deploy.yml) and [`rollback.yml`](.github/workflows/rollback.yml) use the same scripts for staging and protected production.

Start with the [deployment and rollback runbook](docs/operations/deployment-and-rollback.md). The protected GitHub environment is the production trust anchor; a strict, expiring operator policy attestation records the otherwise non-queryable governance assertions and its canonical digest is bound into the deployment and core-finalizer inputs. Staging consumes a held non-latest draft, while production requires immutable latest publication.

The workflow validates structure and the complete Phase 11-only evidence diff before outputs exist, then builds only from the exact product SHA and verifies every output/config/unit/product digest before mutation. Phase 3 ingress activation carries the exact captured prestate and production binding envelope. Any later deploy/version/smoke failure automatically restores that prestate; explicit rollback restores units in reverse order and then calls ingress restore, never apply.

Candidate production uses Worker identity `vcskill-edge-combined-production` and secret namespace `candidate-production`, separate from legacy Worker `vcskill` and `legacy-production`; docs use the independent `vcskill-docs-production` Worker. First-cutover rollback restores the captured legacy version, ordered binding state, and prior docs owner/DNS state without generic Worker deletion or secret mutation. The accepted core PAT remains only Contents read plus Actions write in its three declared contexts and cannot enter web/build/Cloudflare/finalizer jobs.

## Legacy production and rollback

| File | What |
|---|---|
| `worker.js` | The Worker: routing + GitHub token-proxy |
| `landing.html` | Self-contained landing page, imported as a Text module, served at `/` |
| `wrangler.toml` | Worker name `vcskill`, custom domain `vcskill.vchun.dev`, HTML text-module rule |

The root `worker.js`, `landing.html`, and `wrangler.toml` remain the frozen production rollback target through the first-cutover rollback window. Preserve their exact Worker version, bindings, and existing credential context. Do not rotate the legacy secret with the candidate credential or use direct `wrangler deploy` for the new topology.

## Editing the landing page

`landing.html` is fully self-contained (inline CSS/JS, Google Fonts via `<link>`).
It is served at `/` with a 5-minute edge cache. It remains frozen while it is a rollback target.

## Notes

- Protected `/install`, `/install.sh`, `/install.ps1`, `/version`, and `/download/<asset>` behavior remains contract-frozen.
- Core release publication stays in the private repository’s protected exact-ref finalizer; the web deployment job has no release-write authority.
