# cook — edge selector accepts `-beta.0`

**Date:** 2026-08-27 23:10–23:25 ICT
**Path:** hướng A (widen edge regex + production redeploy, giữ kit's held draft `1.2.1-beta.0`)

## Problem

Edge worker `BETA_SEMVER = /^…-beta\.[1-9]\d*$/` refused counter `.0`. Kit's held
draft `ariadnev@1.2.1-beta.0` (from `changesets pre enter beta` default) would
have been uninstallable via `av update --to 1.2.1-beta.0` — verified live before
fix: `curl … ?version=1.2.1-beta.0` → 400 "malformed".

Same class as 5 stable-only guards widened in `ariadnev-kit` last session.

## Change

`workers/edge/src/release-selector.js:14` — counter widened to `(0|[1-9]\d*)`.
Leading-zero counters (`beta.01`) stay rejected (semver violation ≠ `beta.0`).
`workers/edge/src/index.test.mjs` — `1.2.1-beta.0` moved from rejected fixture
to accepted fixture; every other malformed case preserved verbatim.

## Delivery

| | |
|---|---|
| PR | #9 https://github.com/bavanchun/ariadnev-web/pull/9 |
| Merge sha | `95e2960` |
| Pinned input | `deployment/inputs/production-ariadnev-1.1.0-95e2960.json` (`cb996dc`) |
| Evidence | `deployment/evidence/611d946….json` |
| Production deploy | run `33092681831` — success |

## Verification (post-deploy)

```
?version=1.2.1-beta.0   → HTTP/2 502 (was 400 malformed)   ← accepted shape, no such release
?version=1.2.1-beta.1   → HTTP/2 502                        ← control, no regression
/version (bare)         → 1.1.0                             ← control, no regression
?version=1.2.1-beta.01  → HTTP/2 400                        ← leading-zero still rejected
```

Unit: `node --test workers/edge/src/index.test.mjs` → 23/23 pass.

## Still open (kit side, maintainer-only)

- Sign `ariadnev@1.2.1-beta.0\n<checksums.txt>` with Ed25519 key in password
  manager (not in CI).
- Dispatch `finalize-release.yml` per handoff recipe:
  `ariadnev-kit/plans/reports/cook-260827-2110-p11-beta-cut-handoff.md`.
- After finalize: `curl … ?version=1.2.1-beta.0` should return 200 and
  `av update --to 1.2.1-beta.0` should install.
- Tick phase-11 "A `-beta` version is published and installable".

## Repos still public

Kept public per user's most recent instruction. Do not flip back to private
until finalize run has completed.
