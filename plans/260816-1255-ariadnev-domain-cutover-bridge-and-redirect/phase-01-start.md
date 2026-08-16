---
phase: 1
title: "Bridge worker implementation"
status: completed
priority: P1
effort: "4h"
dependencies: []
---

# Phase 1: Bridge worker implementation

## Overview

Add a new, self-contained Worker that serves the ariadnev release edge, so `ariadnev.com` can be
bound to it without redeploying or editing the frozen legacy worker.

## Requirements

- Functional: serve `/install`, `/install.sh`, `/install.ps1`, `/version`, `/download/<asset>`, `/`,
  and a branded 404 — matching the legacy response contract byte-for-byte where clients depend on it.
- Functional: read releases from `bavanchun/ariadnev-kit` directly (not via GitHub's rename redirect).
- Non-functional: reject path-traversal asset names **in-Worker** — `ariadnev.com` has no zone
  ingress guard, so the legacy worker's reliance on one does not carry over.
- Non-functional: its own `GH_TOKEN` secret namespace, separate from the legacy worker's.
- Non-functional: file <200 LOC, kebab-case, comments explain *why*.

## Architecture

`workers/bridge/` mirrors the legacy worker's route table but differs deliberately in four places:

| Concern | Legacy (frozen) | Bridge |
|---|---|---|
| Repo | `bavanchun/vcskill` (works only via rename redirect) | `bavanchun/ariadnev-kit` |
| Version strip | `^vcskill@` (no longer matches) | `^ariadnev@` |
| Asset safety | relies on zone ingress rule | `assertSafeAssetName()` in-Worker |
| Landing / 404 body | vcskill branding, old host | ariadnev branding, `https://ariadnev.com/install` |

`/install` and `/install.ps1` proxy the repo **Contents API at `?ref=main`** (same as legacy), so the
installer served is whatever is on `ariadnev-kit` main — already correct today.

`/version` returns the tag with the `ariadnev@` prefix stripped. Note `update-command.ts:26` already
strips `^ariadnev@` itself, so stripped and unstripped both parse correctly; strip for cleanliness.

Reuse `assertSafeAssetName` from `workers/edge/src/github-release.js:59` — it is a pure validator and
is **not** a frozen file. Do not import anything else from candidate-b (its `REPO` constant carries
the same stale-repo bug being avoided here).

No landing page asset is duplicated: the bridge serves a minimal inline HTML holding page at `/`.
The real marketing site arrives with candidate-b at Phase 12; duplicating `landing.html` would fork
a frozen file's content.

## Related Code Files

- Create: `workers/bridge/wrangler.toml` — `name = "ariadnev-bridge"`, `main = "src/index.js"`,
  `routes = [{ pattern = "ariadnev.com", custom_domain = true }, { pattern = "www.ariadnev.com", custom_domain = true }]`
- Create: `workers/bridge/src/index.js` — handler
- Create: `workers/bridge/src/index.test.mjs` — `node --test` suite
- Create: `workers/bridge/package.json` — mirrors `workers/edge/package.json`, wrangler `4.120.0`
- Modify: `package.json` — append the new test file to the `test:native` list
- Modify: `pnpm-workspace.yaml` — **(added during execution)** register `workers/bridge` so its
  wrangler `4.120.0` is a pinned workspace dependency rather than an unpinned `npx` download. The
  bridge declares no `build` script, so the root `pnpm -r run build` skips it and the build graph is
  unchanged; qualification passing after the change confirms it.
- Do **not** touch: `worker.js`, `landing.html`, `wrangler.toml`, `landing-consistency.test.mjs`

## Implementation Steps

1. Write `workers/bridge/src/index.test.mjs` first (TDD, per `CLAUDE.md`). Cover:
   route table; `ariadnev-kit` in every GitHub URL; `^ariadnev@` strip; 500 when `GH_TOKEN` unset;
   404 body naming `https://ariadnev.com/install`; and **both** lists from
   `workers/edge/rules/raw-download-path-guard.json`:
   - every `mustBlock` case is rejected, and
   - every `mustAllow` case is **accepted** — this is not symmetry for its own sake. `mustAllow`
     contains `/download/checksums%2Etxt`, and `assertSafeAssetName` rejects any residual `%xx` as
     `asset-double-encoded`. The bridge is only correct if it **decodes before validating**, matching
     `workers/edge/src/index.js:70-75`. A `mustBlock`-only suite cannot catch that over-blocking
     regression, and it would break checksum verification for any client that percent-encodes.
   Substitute `ariadnev-*` asset names for the list's legacy `vcskill-*` ones.
2. Scaffold `workers/bridge/package.json` from `workers/edge/package.json`, pinning wrangler `4.120.0`.
3. Implement `src/index.js`, adapting `worker.js` structure and importing `assertSafeAssetName`.
4. Write `wrangler.toml` with both custom domains and a comment naming the required secret.
5. Append `workers/bridge/src/index.test.mjs` to `test:native` in root `package.json`.
6. Run `pnpm run test:native`, then `pnpm run test:qualification`.

## Success Criteria

- [x] `pnpm run test:native` green, new suite included — 128/128, then 149/149 after Phase 3
- [x] `pnpm run test:qualification` green — contracts, typecheck, build, 128 native, 158 vitest
- [x] No GitHub URL in `workers/bridge/` contains `bavanchun/vcskill`
- [x] **(amended)** Every `mustBlock` path yields either a 4xx or serves only a `mustAllow` asset
  name that passes `assertSafeAssetName`; the percent-encoded family is rejected `400` in-Worker with
  zero upstream calls.

  The original wording — "every `mustBlock` case is rejected by the bridge's own validation" — rests
  on a false premise and cannot be satisfied. Cloudflare and the WHATWG URL parser both collapse
  literal RFC 3986 dot segments before any handler reads the path, so `/download/./checksums.txt` and
  `/download/nested/../checksums.txt` arrive already normalized to `/download/checksums.txt`, which is
  itself a `mustAllow` entry. No in-Worker check can distinguish them. This is consistent with
  `raw-download-path-guard.json:5`, which says in-Worker validation *cannot* observe raw forms — that
  is why the zone rule exists for candidate-b. The phase-01 criterion misapplied that rationale.
  Measured behavior is recorded as an explicit 8-row table in the test file.
- [x] Every `mustAllow` case is accepted, including the percent-encoded `checksums%2Etxt` form
  (proves decode-before-validate ordering) — also confirmed live: `200`, 716 bytes
- [x] **(added)** Hostile vectors beyond the policy list are rejected: double-encoding, encoded
  backslash, `%00`, CRLF `content-disposition` injection, overlong UTF-8, leading dot. All seven
  verified against the deployed Worker as well as the unit suite.
- [x] `git diff --stat` shows zero lines changed in the four frozen files

## Risk Assessment

- **Duplication drifts from candidate-b.** Accepted and bounded: the bridge is deleted at Phase 12.
  Signal: Phase 12 starts. Response: delete `workers/bridge/` rather than reconciling it.
- **Importing from candidate-b couples a temporary unit to cutover code.** Limited to one pure
  function with no I/O. If Phase 12 refactors it, the bridge is already gone or trivially inlined.
- **Missing a traversal vector the zone rule caught.** Mitigated by reusing the rule's own `mustBlock`
  list as test cases. Signal: a case passes that the rule would block. Response: fix the validator, not the test.
