---
phase: 6
title: "Verification, Static Budget & Quality Audit"
status: completed
priority: P0
effort: "4h"
dependencies: ["phase-02-shell-search-navigation.md", "phase-03-onboarding-concepts-d00-d07.md", "phase-04-guides-operations-d08-d11.md", "phase-05-reference-catalogs-d12-d17.md"]
---

# Phase 6: Verification, Static Budget & Quality Audit

## Overview
Execute full verification passes across the entire workspace. Validate that all 176 Vitest tests and 164 native docs contract tests pass, ensure TypeScript strict typechecking reports 0 errors, confirm 0% raw hex colors in stylesheets, verify static byte ratchet budgets across all 447 generated routes, and record a durable technical journal entry via `/ak:journal`.

## Integrated AgentKit Skills
- `/ak:test` & `/ak:web-testing`: Executes unit, integration, and contract test suites.
- `/ak:code-review`: Reviews git diffs for token violations and accidental side effects.
- `/ak:web-design-guidelines`: Performs final Web Interface Guidelines compliance audit.
- `/ak:journal`: Creates the permanent engineering journal entry documenting all design elevations.

## Requirements
- Functional:
  - Verify all 164 tests in `pnpm run test:docs` pass without error.
  - Verify all 176 tests in `pnpm run test` (Vitest) pass without error.
  - Verify strict TypeScript compilation via `pnpm run typecheck`.
  - Verify static per-route byte budgets via `apps/docs/scripts/verify-static-budget.mjs`.
  - Verify full build of docs and site via `pnpm run build`.
- Non-functional:
  - Zero hydration errors on all routes.
  - 0% raw hex color codes in `apps/docs/src/styles/docs.css`.

## Implementation Steps
1. Run `pnpm run typecheck` to guarantee strict TypeScript type safety.
2. Run `pnpm run test:docs` to check all 164 native docs contract tests.
3. Run `pnpm run test` to verify Vitest tests and toolchain compatibility.
4. Execute `pnpm run build` to generate all static HTML pages and assert zero build failures.
5. Create technical journal entry with `ak journal create`.

## Success Criteria
- [ ] 176/176 Vitest tests pass.
- [ ] 164/164 docs contract tests pass.
- [ ] TypeScript typecheck passes with 0 errors.
- [ ] Static budget ratchet passes with 0 route cap overflows.
- [ ] Technical journal entry recorded.
