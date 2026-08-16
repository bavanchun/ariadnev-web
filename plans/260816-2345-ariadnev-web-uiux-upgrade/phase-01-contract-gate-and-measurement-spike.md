---
phase: 1
title: "Contract gate and measurement spike"
status: pending
priority: P1
effort: "4-5d"
dependencies: []
---

# Phase 1: Contract gate and measurement spike

## Context

- [Plan](./plan.md)
- [Audit](../reports/audit-260816-2007-ui-ux-whole-site.md)
- [Brainstorm](../reports/brainstorm-260816-2324-living-execution-atlas.md)

## Overview

Resolve every load-bearing contract before product UI changes. This phase is a
hard gate: downstream phases cannot start until command identity, catalog
metadata, safe component boundaries, Fumadocs adoption, and independent
performance budgets have measured decisions.

## Requirements

- Define immutable command identity, canonical slug, legacy anchors, aliases,
  edition availability, siblings, navigation visibility, and retired routes.
- Define additive catalog metadata: `pageKind`, `screenKind`, `section`,
  `navigationVisibility`, and sibling semantics.
- Decide how safe docs components render while search and static discovery
  continue receiving clean Markdown.
- Compare current shell, full Fumadocs `DocsLayout`, and selective primitives.
- Investigate whether aligning Fumadocs MDX 15.2.3 with Core/UI 16.14.3 is
  officially supported and passes existing contracts.
- Measure route transfer separately from total output, search/discovery, and
  build cost.
- Record pre-change outcome evidence for the eight critical user tasks so Phase
  7 can compare usability without relying on subjective visual preference.
- Preserve all locked scope. No implementation shortcut may remove historical
  pages, aliases, locale/version variants, or no-JS behavior.

## Architecture

### Command and route contract

Each command record contains:

- immutable `commandId` from upstream, or repository-owned registry identity;
- `sourceIdentity`, collision-checked `canonicalSlug`, and `legacyAnchors`;
- aliases as metadata, never extra routes;
- locale/version availability and real previous/next siblings;
- `pageKind: "command"` and `navigationVisibility: "reference-only"`;
- retired slug → replacement/tombstone policy.

If upstream has no immutable ID, create a committed registry and retired-route
map. A rename updates the map; it never silently changes an established URL.

### Catalog contract

Extend the generated catalog schema additively. Current page behavior remains
valid while later phases gain stable page/screen metadata. Command detail pages
remain discoverable by search and static discovery but absent from global
sidebar enumeration.

### Safe component contract

Current `public-markdown.ts` rejects all MDX JSX. The spike compares:

1. Pure Markdown plus global standard-element mappings.
2. Exact-name safe MDX components with literal, schema-validated attributes and
   a deterministic plain-Markdown transform for search/`llms.txt`.
3. Screen-specific React chrome outside the MDX body.

Expressions, imports/exports, arbitrary component names, event handlers, HTML,
and URL-bearing unvalidated props stay forbidden. Choose the smallest model that
can implement D03–D17 without duplicating source facts.

### Fumadocs spike

Render all three shell variants against the four stress frames:

- CLI reference at 320px;
- provider reference at 320px;
- desktop CLI lookup/orientation;
- complete VI shell and chrome.

Measure localization, dark-only theming, keyboard behavior, no-JS fallback,
static export, per-route transfer, and implementation surface. Full
`DocsLayout` is not presumed to win.

### Performance measurements

Record:

- compressed transfer for installation, docs home, CLI index, one command,
  provider, skills, and workflow routes;
- total `apps/docs/out` bytes and file count;
- search-index bytes per locale/version partition;
- `llms.txt`, `llms-full.txt`, and Markdown discovery count/bytes;
- route cardinality, build wall time, and peak memory.

Current data projects +212 HTML routes for current-only command details and
+318 HTML plus +318 Markdown outputs when previous stable is included. Measure,
do not treat projection as proof.

### Critical task baseline

Record route correctness, purposeful interaction count, required-fact
visibility, recovery success, and controlled-environment elapsed time for:
locale choice, installation, first install, exact-command lookup, provider
comparison, workflow understanding, unavailable-context recovery, and
migration-risk recognition. Time is diagnostic, not a frozen gate unless the
measurement environment is repeatable.

## Related code files

- Create conditionally: `packages/contracts/src/cli-command-registry.ts`
- Create: `packages/contracts/src/cli-command-contract.ts`
- Modify: `packages/contracts/src/index.ts`
- Modify: `apps/docs/src/lib/content-catalog.ts`
- Modify: `apps/docs/scripts/verify-static-budget.mjs` (ratchet extension, 2026-08-17)
- Create: `tests/benchmarks/docs-per-route-ratchet.json` (ratchet grandfather list, 2026-08-17)
- Create: `tests/docs/docs-per-route-ratchet.test.mjs` (manifest integrity, 2026-08-17)
- Create: `packages/contracts/src/cli-command-contract.test.ts`
  (colocated with the contract package because `pnpm run contracts` runs
  vitest on `packages/contracts/`; the plan originally proposed
  `tests/contracts/cli-command-contract.test.ts` but colocation avoids a
  duplicate test-discovery surface and the bundle-anchored integration case
  reads the same fixtures either way)
- Modify: `tests/docs/content-pipeline.test.mjs`
- Modify: `tests/docs/forbidden-runtime-features.test.mjs` (assert ratchet
  wiring stays in verify-static-budget.mjs)
- Not modified: `scripts/docs-content/build-content-root.mjs`. The plan
  originally listed this as `Modify:` for the additive catalog fields; the
  fields land as optional in `content-catalog.ts` and pass through unset
  today. Phase 3–5 populate them per page as those phases own the page
  render surfaces; the round-trip test in `content-pipeline.test.mjs`
  proves the pipeline preserves them when present.
- Create: `docs/decisions/cli-command-identity-and-retired-routes.md`
- Create: `docs/decisions/docs-catalog-and-safe-components.md`
- Create: `docs/decisions/fumadocs-ui-adoption-spike.md`
- Create: `docs/decisions/docs-performance-baselines.md`
- Create: `docs/decisions/critical-user-task-baseline.md`
- Spike only, do not merge: docs shell/reference/token experiments needed for
  measurement.

## Implementation steps

1. Baseline current route counts, route-transfer budgets, output bytes, search
   partitions, discovery outputs, build duration, and memory.
2. Enumerate 53 current and 53 historical command records; confirm path sets and
   source fields.
3. Add immutable identity or registry, slug/anchor collision checks, alias
   policy, sibling rules, and retired-route mapping.
4. Add additive catalog metadata and tests for sidebar visibility, locale,
   version, page kind, and screen kind.
5. Prototype the three safe-component approaches; prove search and discovery
   remain plain, deterministic, and public-safe.
6. Render current/full/selective Fumadocs variants against all four stress
   frames. Record bytes and behavior.
7. Test the supported Fumadocs version-alignment option. Retain mixed-major pins
   if alignment fails any gate.
8. Generate projected command routes only in the spike; collect all four
   performance metric groups.
9. Capture the eight critical-task baselines using fixed routes, queries, and
   expected facts.
10. Write five decision records with observations, winner, rejected alternatives,
   and stop conditions.
11. Merge contracts, tests, and decisions only. Remove spike product code.

## Success criteria

- [ ] Every command has immutable identity or registry identity.
- [ ] Slug, page ID, and legacy anchors are unique.
- [ ] Retired URL and historical availability behavior is tested.
- [ ] Catalog metadata supports all page kinds and navigation visibility.
- [ ] Safe-component decision preserves clean search/discovery Markdown.
- [ ] All Fumadocs variants are measured on all four stress frames.
- [ ] Version alignment is either qualified or explicitly rejected.
- [ ] Route transfer, output, search/discovery, and build budgets are separate.
- [ ] All eight critical tasks have reproducible pre-change outcome evidence.
- [ ] No frozen budget is increased and no locked scope is removed.
- [ ] `pnpm run test:qualification` passes with merged contract changes.
- [ ] Downstream implementation gate is explicitly marked pass.

## Risk assessment

- **No immutable upstream identity.** Use committed registry plus retired map.
- **No safe component model preserves discovery output.** Keep source pure
  Markdown and place visual structures outside MDX; do not relax safety.
- **No Fumadocs option passes all gates.** Keep bespoke shell and selectively
  copy only proven behavior.
- **Per-route transfer exceeds the frozen cap.** Shrink shell/client behavior;
  if still impossible, stop for user decision.
- **Output/build cost grows too far.** Optimize deterministic generation and CI
  sharding. Historical scope stays; unresolved cost blocks the phase.
- **Spike leaves background processes.** Use deterministic ports, record every
  PID, and stop all spike servers before phase completion.

## Security considerations

- Registry and catalog accept only normalized safe path segments.
- Safe components prohibit expressions, imports, event handlers, arbitrary HTML,
  and unvalidated URLs.
- Spike artifacts contain no tokens, private release data, or local paths.
