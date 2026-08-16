---
phase: 3
title: "Redirect rule tooling"
status: completed
priority: P2
effort: "3h"
dependencies: []
---

# Phase 3: Redirect rule tooling

## Overview

Build the source-controlled definition and manager for the `vcskill.vchun.dev` → `ariadnev.com`
Single Redirect, mirroring the existing ingress-rule pattern so the rule lives in Cloudflare but its
definition lives in git.

## Requirements

- Functional: declarative JSON policy + a script that reconciles it (inspect / apply / remove).
- Functional: create the `http_request_dynamic_redirect` entrypoint ruleset when absent — verified
  absent on `vchun.dev` today.
- Non-functional: never print the API token; redact `Bearer` in any error output.
- Non-functional: unit-tested against a fake fetch, no live calls in tests.

## Architecture

`topology.json` already declares a zone rule as required infrastructure
(`workers/edge/rules/raw-download-path-guard.json` + `scripts/manage-edge-ingress-rule.mjs`). This
phase mirrors that shape exactly, so the repo gains a second zone rule without a second pattern.

Differences from the ingress rule:

| | Ingress guard (existing) | Redirect (new) |
|---|---|---|
| Ruleset phase | `http_request_firewall_custom` | `http_request_dynamic_redirect` |
| Token permission | Zone → WAF → Edit | **Zone → Single Redirect → Edit** |
| Action | `block` | `redirect` |

Rule body:

```json
{
  "action": "redirect",
  "action_parameters": {
    "from_value": {
      "target_url": { "expression": "concat(\"https://ariadnev.com\", http.request.uri.path)" },
      "status_code": 302,
      "preserve_query_string": true
    }
  },
  "expression": "(http.host eq \"vcskill.vchun.dev\")",
  "description": "ariadnev: redirect legacy host to ariadnev.com"
}
```

**302, not 301** — a 301 caches indefinitely in browsers and intermediaries and cannot be recalled,
which would partially defeat a first-cutover rollback to `vcskill.vchun.dev`. curl does not cache
redirects, so machine clients are indifferent. Flip to 301 only after the rollback window closes.

Path-preserving and blanket, including `/download/*`: every documented flow uses `curl -fsSL`
(follows redirects), and pre-1.0 `install.sh` copies compute `vcskill-<os>-<arch>` asset names that
do not exist in the 1.0.0 release — they are already broken regardless of any redirect, so there is
nothing on the old host worth carving out.

Token is read from `~/.config/cloudflare/ariadnev-token` (mode 600) into `CLOUDFLARE_API_TOKEN`
at call time; it is never committed and never printed.

## Related Code Files

- Create: `rules/legacy-host-redirect.json` — policy definition. **Deliberately not under
  `workers/bridge/`**: the redirect outlives the bridge. It persists through the Phase 12 cutover and
  is what flips 302→301 after the rollback window closes, whereas `workers/bridge/` is deleted at
  Phase 12. Filing it under the bridge would miscode its lifetime and drag it into that deletion.
- Create: `scripts/manage-legacy-host-redirect.mjs` — reconciler, modelled on `scripts/manage-edge-ingress-rule.mjs`
- Create: `scripts/legacy-host-redirect.test.mjs` — `node --test`, fake fetch
- Modify: `package.json` — add the test to `test:native`
- Reads (pattern reference, do not modify): `scripts/manage-edge-ingress-rule.mjs`

## Implementation Steps

1. Read `scripts/manage-edge-ingress-rule.mjs` end to end; copy its structure (`request` wrapper with
   Bearer redaction, `locateRule`, `reconcile`, `--apply` gating, zone-id resolution by name).
2. Write `rules/legacy-host-redirect.json` with `zoneName: "vchun.dev"`,
   `rulesetPhase: "http_request_dynamic_redirect"`, the rule body above, and a `mustRedirect` list of
   probe paths (`/install`, `/install.sh`, `/version`, `/download/checksums.txt`, `/`).
3. Write the test suite first: entrypoint-absent → creates ruleset with `kind: "zone"`;
   entrypoint-present → PUTs merged rules without dropping existing ones; idempotent re-apply is a
   no-op; token absent → clear error; `Bearer` never appears in thrown messages.
4. Implement `scripts/manage-legacy-host-redirect.mjs` with `--inspect` (default, read-only),
   `--apply`, and `--remove`.
5. Add the test to `test:native`; run `pnpm run test:native`.
6. Dry-run `--inspect` against the live zone to confirm it reports "entrypoint absent, would create".

## Success Criteria

- [x] `pnpm run test:native` green with the new suite — 149/149, 20 of them this suite
- [x] `--inspect` runs read-only against the live zone and reports the planned change — reported
  `entrypointPresent: false, action: create`, exit 2, zero non-GET requests
- [x] Re-running `--apply` twice produces no second rule (idempotent) — verified live: second run
  `action: noop, applied: false`
- [x] `--remove` deletes only this rule, leaving other rules in the ruleset intact; and deletes the
  entrypoint ruleset outright when this rule was its only occupant, because Cloudflare rejects an
  entrypoint with an empty `rules` array
- [x] No token value appears in any output, including error paths

## Execution note — a bug the live dry-run caught

The first `--inspect` after applying reported permanent `action_parameters` drift on a rule that
matched exactly. Cloudflare echoes `action_parameters` back with its keys in **its own alphabetical
order**, and the original comparison was `JSON.stringify`, which is order-sensitive. The effect was
not cosmetic: `--inspect` would have exited 2 forever (useless as a CI gate) and `--apply` would have
re-PUT the ruleset on every run.

Replaced with `matchesDeclared`, a recursive subset test over declared keys only. Everything the
policy states is still compared exactly — including `status_code`, so the 302 → 301 flip at
rollback-window close still registers as drift — while key ordering and any server-side default the
policy does not declare no longer cause churn. Both failure shapes are now pinned by tests. Fixed in
`82fea6a`.

## Risk Assessment

- **Clobbering an existing ruleset's other rules.** The zone has no dynamic-redirect entrypoint today,
  but that can change. Mitigation: merge-by-description like the ingress manager does, never PUT a
  bare single-rule array. Signal: test "entrypoint-present preserves existing rules" fails. Response:
  fix the merge, do not weaken the test.
- **Wrong expression syntax silently matching nothing.** Signal: Phase 4 probe returns 200 not 302.
  Response: treat as an expression bug first — before concluding the Workers-ordering assumption failed.
- **Token file missing on a fresh machine.** Signal: clear "CLOUDFLARE_API_TOKEN is not set" error.
  Response: documented in Phase 5.
