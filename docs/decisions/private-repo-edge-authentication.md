# Edge authentication for a private kit repository

Status: **Accepted** · Recorded: 2026-08-16 · Applies to: `ariadnev-edge`, `ariadnev-edge-staging`
Sources of record: [`workers/edge/src/github-app-auth.js`](../../workers/edge/src/github-app-auth.js),
`workers/edge/src/github-app-auth.test.mjs`,
[`scripts/deploy/probe-public-edge.mjs`](../../scripts/deploy/probe-public-edge.mjs),
[`.github/workflows/edge-health.yml`](../../.github/workflows/edge-health.yml)

## Decision

`bavanchun/ariadnev-kit` stays **private**. The edge Worker authenticates as a
**GitHub App** with `Contents: read` installed on that one repository: it signs
a short-lived RS256 JWT with the App private key and exchanges it for a
one-hour installation token, cached in the isolate until five minutes before it
lapses.

A **daily scheduled probe** (`edge-health.yml`) exercises `/version`,
`/version?version=<pinned>`, `/install`, `/download/checksums.txt`, and the docs
entry against the live production hosts. A failing run is the alert.

## Why

The private repository is not incidental to the install path — it *is* the
install path. `install.sh` resolves everything through `https://ariadnev.com`
(`BASE="${ARIADNEV_BASE_URL:-https://ariadnev.com}"`), the Worker owns
`/install`, `/version`, and `/download/<asset>`, and every one of those calls
carries a credential to GitHub. So the credential's lifetime is the product's
lifetime.

The Worker previously used a fine-grained PAT that the owner had deliberately
set to expire within days. On expiry, `getInstaller` passes GitHub's `401`
straight through to whoever ran `curl … | bash`, and the release routes fail
closed as `502`, while the marketing site keeps serving `200` from static
assets. Nothing in the deploy pipeline would have noticed: it only runs when
someone deploys.

Three options were weighed on 2026-08-16:

| Option | Verdict |
|---|---|
| Make the kit repository public | Rejected by the owner; the repository stays private. |
| Fine-grained PAT with no expiration | Viable (GitHub allows infinite lifetimes on a personal account), but a standing credential tied to one person's account, revocable by accident, with nothing bounding the damage if it leaks. |
| GitHub App | **Chosen.** The key that lives in the Worker has no expiry, the credential that actually travels to GitHub lives one hour, and the App is an identity of its own rather than a person's. |

## What this buys, precisely

- No dated cliff. The install path cannot break because a calendar day passed.
- A leaked installation token is stale within the hour; a leaked private key can
  be regenerated in App settings without touching the release process.
- Least privilege is unchanged and verifiable: `Contents: read`, one repository.
- Credential failures are now attributable — `github-app-auth.js` fails with a
  reason code that the Worker logs (`edge auth failed: …`), and the probe
  separates "credential dead" from "site down" because the static docs check
  keeps passing.

## What it does not claim

The App private key is still a secret in Cloudflare, and losing it still means
re-provisioning. This decision removes the *scheduled* failure, not every
failure. It also does not make the repository auditable by users: nobody can
read the installer they pipe to `bash` from source. That trade-off is the
owner's standing choice, recorded here so it stays a choice rather than an
accident.

## Preserved contracts

- The frozen Phase 1 missing-secret contract still answers `500` with
  `worker misconfigured: GH_TOKEN unset` host-wide when credentials are absent.
  The wording names a secret this Worker no longer reads; it is the observable
  public contract, so it is preserved verbatim rather than reworded.
- Unprotected paths never mint a token — the credential check is synchronous and
  the mint happens only after route classification, so serving the site costs no
  GitHub traffic.
- The retained legacy `vcskill` Worker keeps its own frozen PAT. Nothing here
  touches it.
