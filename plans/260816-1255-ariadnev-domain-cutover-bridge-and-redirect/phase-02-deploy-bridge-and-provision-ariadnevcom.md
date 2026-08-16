---
phase: 2
title: "Deploy bridge and provision ariadnev.com"
status: pending
priority: P1
effort: "2h"
dependencies: [1]
---

# Phase 2: Deploy bridge and provision ariadnev.com

## Overview

Put the bridge Worker live on `ariadnev.com`, letting Cloudflare auto-provision the apex DNS record
and TLS certificate. **This phase closes the 1.0.0 install blocker.**

## Requirements

- Functional: `https://ariadnev.com/{version,install,install.ps1,download/*}` all answer correctly.
- Functional: a real end-to-end install on a clean machine, with checksum verification passing.
- Non-functional: the legacy worker records zero deploys and zero secret writes.
- Non-functional: the GH PAT never lands on disk or in the transcript.

## Architecture

`custom_domain = true` makes Cloudflare create the proxied DNS record and issue the certificate as
part of `wrangler deploy` — no manual DNS step, and no `Zone.DNS:Edit` permission needed. The stored
`wrangler` OAuth token already carries `workers_scripts (write)`, `workers_routes (write)`,
`ssl_certs (write)`, and `zone (read)`, which is exactly the set this needs.

Certificate issuance is not instant; expect a short window where the host resolves but TLS is still
provisioning.

## Related Code Files

- Modify: none (deploy-only phase)
- Reads: `workers/bridge/wrangler.toml`

## Implementation Steps

1. Confirm the working tree is clean and the four frozen files are unmodified.
1b. **Cross-repo installer pre-flight.** The bridge serves `ariadnev-kit`'s installer verbatim, so the
   contract *installer → asset names → checksums.txt* is a cross-repo dependency this plan cannot fix
   if it breaks. Verify it before deploying, not at the E2E:
   ```sh
   GH="$(cat ~/.config/github/ariadnev-kit-token)"
   # asset names the installer computes
   curl -fsSL -H "Authorization: Bearer $GH" -H "Accept: application/vnd.github.raw" \
     "https://api.github.com/repos/bavanchun/ariadnev-kit/contents/install.sh?ref=main" | grep -n 'asset='
   # asset names that actually exist in the release
   gh api repos/bavanchun/ariadnev-kit/releases/latest --jq '[.assets[].name]'
   ```
   Confirm every platform the installer can compute maps to a real asset, and that `checksums.txt`'s
   format matches what the installer greps (`grep " ${asset}$"`). Pre-1.0 installers provably computed
   `vcskill-<os>-<arch>` names that no longer exist — confirm 1.0.0's do not repeat that. Repeat for
   `install.ps1` and `ariadnev-windows-x64.exe`. **If this fails, stop: the fix belongs in
   `ariadnev-kit`, outside this plan.**
2. Set the bridge secret. **The user runs this in their own terminal**, not through the agent session,
   so the PAT is never echoed:
   ```sh
   npx wrangler secret put GH_TOKEN --config workers/bridge/wrangler.toml
   ```
3. Deploy:
   ```sh
   npx wrangler deploy --config workers/bridge/wrangler.toml
   ```
4. Wait for DNS + certificate, then smoke each route:
   ```sh
   curl -sS https://ariadnev.com/version
   curl -sSI https://ariadnev.com/install
   curl -sSI https://ariadnev.com/download/checksums.txt
   ```
5. Negative check — traversal must not serve anything:
   ```sh
   curl -sS -o /dev/null -w '%{http_code}\n' 'https://ariadnev.com/download/../secrets.txt'
   ```
6. Full end-to-end install on a clean machine (or a container with no prior `ariadnev` binary):
   ```sh
   curl -fsSL https://ariadnev.com/install | bash
   ariadnev --version
   ```
7. Confirm the legacy worker is untouched:
   ```sh
   npx wrangler deployments list --name vcskill   # must still show b93d9d2
   git status --short                              # frozen files absent
   ```

## Success Criteria

- [ ] `/version` returns the 1.0.0 version string
- [ ] `/install` returns 200 with the ariadnev installer
- [ ] `/download/checksums.txt` and a platform binary both return 200
- [ ] Traversal probe returns 4xx and no file content
- [ ] Clean-machine `curl … | bash` install succeeds, checksum verifies, `ariadnev --version` prints 1.0.0
- [ ] `av update --check` resolves against `ariadnev.com`
- [ ] `wrangler deployments list --name vcskill` still shows `b93d9d2`
- [ ] `www.ariadnev.com` answers (or is deliberately deferred and noted)
- [ ] Pre-flight passed: every asset name the installers compute exists in the 1.0.0 release, and `checksums.txt`'s format matches the installer's grep

## Risk Assessment

- **Certificate provisioning lag.** Signal: TLS errors right after deploy. Response: wait and re-probe
  before concluding failure; do not roll back on the first TLS error.
- **Bridge misconfigured (`GH_TOKEN` unset) → 500 on every route.** Signal: step 4 returns 500 with
  `worker misconfigured`. Response: re-run step 2. Blast radius is `ariadnev.com` only; the old host
  is unaffected because nothing has been redirected yet.
- **Deploying to the wrong config file** would touch the legacy worker. Mitigation: every command in
  this phase passes an explicit `--config workers/bridge/wrangler.toml`. Signal: `deployments list
  --name vcskill` shows a new deployment. Response: **stop immediately**, restore the legacy worker
  from `b93d9d2`, and re-open the approach with the user.
