# Edge Routing Topology Decision

Observed at: 2026-08-09T06:29:28Z
Selected candidate: B
Profile: combined
Base URL: https://staging.vcskill.vchun.dev/
Deployment version: a9c510fe-98ec-4876-82ce-fd84dba6d510
Rollback version: e91ff904-f7b7-4293-a033-dee7e5cc3fe2
Rollback result: passed-composite
Credential policy: operator-attested model=consolidated; principal-role=admin; token-scope=single-repository; repository=bavanchun/vcskill; contents=read; actions=write; contents-write=false; release-write=false; administration=false

## Rationale
Candidate A route reassignment exposed a colliding site response. Candidate B protected machine routes and passed reverse binding rehearsal.

## Route patterns
- /install*
- /install.ps1*
- /version*
- /download/*

## Observed route bindings
- staging.vcskill.vchun.dev/ (observed)
- staging.vcskill.vchun.dev/install* (observed)
- staging.vcskill.vchun.dev/install.ps1* (observed)
- staging.vcskill.vchun.dev/version* (observed)
- staging.vcskill.vchun.dev/download/* (observed)
- staging.vcskill.vchun.dev/ (observed)
- vcskill.vchun.dev/ (observed)

## Deployment provenance
- candidate-a-edge-first: staging; edge; candidate-a-gate; 392f6bc4-0326-4543-a237-c4af62b87553; binding=candidate-a-edge-first-bindings; retained=false
- candidate-a-failed: staging; edge; candidate-a-route-failure; 51d7df0d-a0f1-4293-890d-0784bb8f071c; binding=candidate-a-unbound-bindings; retained=false
- candidate-a-site-first: staging; edge; candidate-a-gate; f3333a3a-2c4c-4c45-ae9d-60d5931d8a69; binding=candidate-a-site-first-bindings; retained=false
- candidate-b-before-rehearsal: staging; combined; selected-prior; 0e6fb032-14fb-4800-921d-510b89c65f50; binding=candidate-b-bindings; retained=true
- candidate-b-final: staging; combined; selected-final; a9c510fe-98ec-4876-82ce-fd84dba6d510; binding=candidate-b-bindings; retained=true
- staging-site-binding: staging; site; binding-rehearsal; 3081658f-1ecc-454c-95f5-84d4453c4f80; binding=site-custom-domain-bindings; retained=true
- missing-binding-control: staging; combined; controlled-missing-binding; 26d898e4-f67f-4438-8c16-f869f68eb435; binding=candidate-b-bindings; retained=false
- upstream-failure-control: staging; combined; controlled-upstream-failure; d466bbd6-2e39-4a6f-ba89-a23be85bc26f; binding=candidate-b-bindings; retained=false
- legacy-new-credential-probe: staging; legacy; legacy-credential-compatibility; a0258bac-545d-46e4-858d-74c3daafe434; binding=legacy-shaped-bindings; retained=false
- production-legacy: production; legacy; retained-first-cutover-rollback; e91ff904-f7b7-4293-a033-dee7e5cc3fe2; binding=production-legacy-bindings; retained=true

## Transition provenance
- candidate-a-route-reassignment: mechanics=passed; application=failed-site-collision; restored=candidate-a-site-first
- legacy-new-credential-rehearsal: mechanics=passed; application=failed-credential-compatibility; restored=candidate-b-before-rehearsal
- candidate-b-custom-domain-reverse: mechanics=passed; application=passed; restored=candidate-b-final

## Explicit failed compatibility probe
- legacy-new-credential-installer#1: expected=200; observed=401; upstream-auth-error; retained-as-failure=true
- legacy-new-credential-installer#2: expected=200; observed=401; upstream-auth-error; retained-as-failure=true

The failed staging legacy compatibility probe does not satisfy rollback. The rollback target is the unchanged live production legacy deployment and existing credential context; mutation is prohibited until the rollback window closes.

## Commands
- wrangler deploy --dry-run workers/edge/wrangler.edge.toml
- wrangler deploy --dry-run workers/edge/wrangler.combined.toml
- wrangler deployments status vcskill-edge-combined-staging

## Observed matrix
- candidate-a-protected-query#1: passed; 200 version-text no-store /version?[query-redacted]; deployment=candidate-a-edge-first; cache=cold
- candidate-a-protected-query#2: passed; 200 version-text no-store /version?[query-redacted]; deployment=candidate-a-edge-first; cache=warm
- candidate-a-lookalike-query#1: passed; 200 site-lookalike public, max-age=300 /installer?[query-redacted]; deployment=candidate-a-edge-first; cache=cold
- candidate-a-lookalike-query#2: passed; 200 site-lookalike public, max-age=300 /installer?[query-redacted]; deployment=candidate-a-edge-first; cache=warm
- candidate-a-malformed-download#1: passed; 400 bounded-edge-error (absent) /download/%25E0%25A4%25A; deployment=candidate-a-edge-first; cache=cold
- candidate-a-malformed-download#2: passed; 400 bounded-edge-error (absent) /download/%25E0%25A4%25A; deployment=candidate-a-edge-first; cache=warm
- candidate-a-route-transfer-rollback#1: failed; 200 site-collision public, max-age=300 /version; deployment=candidate-a-failed; cache=cold; Protected route reached the site during route reassignment.
- candidate-a-route-transfer-rollback#2: failed; 200 site-collision public, max-age=300 /version; deployment=candidate-a-failed; cache=warm; Protected route reached the site during route reassignment.
- candidate-b-collision-version#1: passed; 200 version-text no-store /version; deployment=candidate-b-final; cache=cold
- candidate-b-collision-version#2: passed; 200 version-text no-store /version; deployment=candidate-b-final; cache=warm
- candidate-b-physical-404#1: passed; 404 physical-404 no-store /not-found; deployment=candidate-b-final; cache=cold
- candidate-b-physical-404#2: passed; 404 physical-404 no-store /not-found; deployment=candidate-b-final; cache=warm
- combined-missing-secret#1: passed; 500 missing-secret (absent) /install; deployment=missing-binding-control; cache=cold
- combined-missing-secret#2: passed; 500 missing-secret (absent) /install; deployment=missing-binding-control; cache=warm
- pinned-version#1: passed; 200 version-text no-store /version?[query-redacted]; deployment=candidate-b-final; cache=cold
- pinned-version#2: passed; 200 version-text no-store /version?[query-redacted]; deployment=candidate-b-final; cache=warm
- pinned-download#1: passed; 200 download-stream no-store /download/checksums.txt?[query-redacted]; deployment=candidate-b-final; cache=cold
- pinned-download#2: passed; 200 download-stream no-store /download/checksums.txt?[query-redacted]; deployment=candidate-b-final; cache=warm
- upstream-failure#1: passed; 502 empty-error (absent) /version; deployment=upstream-failure-control; cache=cold
- upstream-failure#2: passed; 502 empty-error (absent) /version; deployment=upstream-failure-control; cache=warm
- deploy-order-edge-then-site#1: passed; 200 version-text no-store /version; deployment=candidate-a-edge-first; cache=cold
- deploy-order-edge-then-site#2: passed; 200 version-text no-store /version; deployment=candidate-a-edge-first; cache=warm
- deploy-order-site-then-edge#1: passed; 200 download-stream no-store /download/checksums.txt; deployment=candidate-a-site-first; cache=cold
- deploy-order-site-then-edge#2: passed; 200 download-stream no-store /download/checksums.txt; deployment=candidate-a-site-first; cache=warm
- rollback-order-edge-then-site#1: passed; 200 version-text no-store /version?[query-redacted]; deployment=candidate-b-before-rehearsal; cache=cold
- rollback-order-edge-then-site#2: passed; 200 version-text no-store /version?[query-redacted]; deployment=candidate-b-before-rehearsal; cache=warm
- rollback-order-site-then-edge#1: passed; 200 download-stream no-store /download/checksums.txt?[query-redacted]; deployment=candidate-b-before-rehearsal; cache=cold
- rollback-order-site-then-edge#2: passed; 200 download-stream no-store /download/checksums.txt?[query-redacted]; deployment=candidate-b-before-rehearsal; cache=warm
- legacy-cutover-restore#1: passed; 200 installer-shell no-store /install; deployment=production-legacy; cache=cold
- legacy-cutover-restore#2: passed; 200 installer-shell no-store /install; deployment=production-legacy; cache=warm

