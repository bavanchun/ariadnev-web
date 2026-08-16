---
phase: 1
title: "Contract gate & measurement spike"
status: pending
priority: P1
effort: "3-4d"
dependencies: []
---

# Phase 1: Contract gate & measurement spike

## Overview

Prove the machine-owned facts the rest of the plan depends on **before** any
token, shell, or visual work lands. Kongming (via the Living Execution Atlas
brainstorm) returned NO-GO for implementation until this phase passes: the
binding concerns are CLI command identity, retired-route behavior, real
content scale, and static bundle headroom. Every downstream phase adjusts
based on numbers this phase measures.

## Requirements

- Functional: (a) a committed, machine-owned CLI command contract with
  immutable identity, unique slug, and legacy anchor mapping; (b) a Fumadocs
  UI spike that measures `DocsLayout` and primitive-level adoption against
  localization, theming, keyboard, static-export, and size gates; (c)
  measured route cardinality and byte budget for the projected +318 HTML
  routes plus +318 Markdown discovery outputs; (d) a written historical
  policy: when to generate per-command detail pages for previous stable.
- Non-functional: no product code merged from the spike — the spike's
  output is measurement and a recommendation. Only the contract files
  (fixture, schema, retired-route mapping, historical policy) merge.

## Architecture

Three separate but co-committed artifacts:

- **Command identity contract.** A machine-owned record per command with
  `sourceIdentity`, immutable `commandId`, `canonicalSlug` (collision-checked
  against the identity), zero or more `legacyAnchors`, per-locale/version
  `availability`, `siblings` where they truly exist, `pageKind`, and
  `navigationVisibility`. If the upstream release bundle cannot supply
  `commandId`, this phase commits a slug registry under
  `packages/contracts/src/cli-command-registry.ts` plus a retired-path map,
  and downstream phases treat that as authority.
- **Fumadocs UI spike.** A throwaway branch renders the same reference page
  three ways: (1) current bespoke shell, (2) full `DocsLayout` adoption,
  (3) primitive-level adoption for TOC, sidebar, code block, callout, tab.
  Each variant measured against: (a) EN + VI chrome parity, (b) dark-only
  theming without a light-mode leak, (c) keyboard journey (skip link → nav
  → any page → back), (d) static export success on both apps, (e) shipped
  bytes per route. The spike merges as a *decision doc*, not code — one
  variant wins and Phase 3 knows which.
- **Cardinality + budget measurement.** Generate the +318 detail pages
  behind a feature flag in the spike branch, measure actual `apps/docs/out`
  bytes, search-index size, `llms.txt` line count, and build wall time.
  Compare to the current 300,000-byte cap and to the sampled 297,860-byte
  observation. Write the numbers into the decision doc; propose a budget
  bump only if the measurement forces it.

## Related Code Files

- Create: `packages/contracts/src/cli-command-registry.ts` (only if the
  release bundle cannot supply immutable `commandId`)
- Create: `packages/contracts/src/cli-command.schema.ts` — schema for the
  contract record, one export consumed by the docs content generator and
  by the contract test
- Create: `tests/contracts/cli-command-contract.test.ts` — asserts slug +
  legacy-anchor uniqueness, no orphaned aliases, historical policy
  consistency
- Create: `docs/decisions/cli-command-identity-and-retired-routes.md`
- Create: `docs/decisions/fumadocs-ui-adoption-spike.md` — spike results,
  the winning variant, and the exact reason it won
- Create: `docs/decisions/docs-static-budget-after-cli-split.md` — measured
  cardinality and bytes; explicit budget decision (keep vs bump vs shrink
  shell)
- Modify (spike branch only, not merged): `scripts/docs-content/
  render-reference-pages.mjs`, `apps/docs/src/components/docs-shell.tsx`,
  `packages/tokens/src/tokens.json` — enough to measure the three variants

## Implementation Steps

1. **Command identity survey.** Enumerate every command the current release
   bundle carries. If the bundle already supplies an immutable identity,
   consume it. Otherwise stand up the slug registry and populate it from
   the current 53 commands plus the 53 historical.
2. **Legacy anchor mapping.** Read the current `/reference/cli/` monolith;
   extract every `#anchor` a reader could deep-link to. Write the map
   canonical → new detail URL. Legacy anchors stay as index targets in the
   monolith; no JavaScript redirect.
3. **Historical policy.** Codify the report's rule: generate detail pages
   whenever the historical source contains the command; command aliases
   remain searchable metadata and legacy anchors, not additional canonical
   routes. Add this to the decision doc.
4. **Contract test.** Assert slug + legacy-anchor uniqueness, alias
   correctness, historical availability consistency, and that no test
   fixture invents a sibling for a command a version does not have.
5. **Fumadocs spike branch.** Render one representative reference page
   three ways. Run the five gates against each. Record numbers and
   qualitative observations.
6. **Cardinality + budget measurement.** In the spike branch, generate
   +318 detail pages behind a flag. Measure end-to-end. Compare to cap.
7. **Decision docs.** Three files: CLI identity, spike winner, budget
   decision. Each names the observation that forced the choice.
8. **Merge.** Only the contract, schema, tests, and decision docs merge.
   The spike branch is preserved as a git ref for review, not merged.

## Success Criteria

- [ ] CLI command contract exists with immutable identity per command and
      passes uniqueness/consistency tests.
- [ ] Legacy anchor map committed; every current `#anchor` maps to exactly
      one canonical detail URL.
- [ ] Historical policy written and consumed by the contract test.
- [ ] Fumadocs UI spike decision doc names the winning variant and the
      exact gate that decided it.
- [ ] Budget decision doc reports actual measured bytes, search-index
      growth, build wall time, and one of: **hold** (fits), **shrink**
      shell (fits after trim), or **bump** (owner-approved).
- [ ] `pnpm run test:qualification` green with the new contract test.
- [ ] No production `apps/docs` code merged from the spike branch; only
      contracts and decision docs.

## Risk Assessment

- **Upstream bundle has no immutable command identity.** Signal: the
  release bundle only ships command names as strings that could be
  renamed. Pre-decided response: commit the slug registry as authority
  and treat renames as retired-route events; the historical policy already
  accepts that shape.
- **Fumadocs full adoption fails one gate; primitive-level fails another.**
  Signal: no variant passes cleanly. Response: rank the failing gates by
  cost to fix; pick the variant with the cheapest gate-repair; if all
  three are cheap, keep the bespoke shell to avoid new transitive
  dependencies.
- **Measured bytes blow the budget.** Signal: docs page exceeds
  300,000-byte cap with +318 detail pages. Pre-decided response, in order:
  (1) shrink the shell (drop transitions, defer non-critical CSS,
  virtualize sidebar); (2) reduce concurrent chunk load; (3) as a last
  resort, propose a budget bump and require the deployment contract
  owner to approve it explicitly — do not bump silently.
- **Build wall time grows past the release runner's budget.** Signal:
  qualification job doubles. Response: parallelize per-locale generation
  in `build-content-root.mjs`; do not skip the historical projection to
  paper over cost.
