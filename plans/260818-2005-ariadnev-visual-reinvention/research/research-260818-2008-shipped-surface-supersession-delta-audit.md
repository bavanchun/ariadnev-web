# Research Report: shipped-surface and supersession delta audit

Conducted: 2026-08-18 20:08 Asia/Saigon

## Executive summary

Current shipped surface is smaller than the completed 2026-08-16 plan text suggests, but more contract-dense than a normal marketing/docs refresh. A full visual reinvention must preserve URL topology, static export, EN/VI parity, generated-source authority, no-JS critical paths, existing proof/boundary semantics, and exact brand assets (`ariadnev-logo.webp`, `favicon.png`, `apple-touch-icon.png`) across both apps. It can aggressively reinterpret composition, spacing, hierarchy, and motion as long as those contracts stay intact.

The safe reuse core is strong: generated docs catalog + screen registry + safe-public-Markdown boundary + static shell + progressive enhancement + visual/contract harness. The main debt is visual rigidity, duplicated shell/branding wiring across apps, thin token package exports, dark-only head metadata hardcoding, and plan docs whose numeric claims have drifted from the current source tree.

## Sources inspected

- Plans:
  - `plans/260816-2345-ariadnev-web-uiux-upgrade/plan.md`
  - `plans/260816-2345-ariadnev-web-uiux-upgrade/phase-01..07`
  - `plans/260818-1626-ariadnev-docs-pro-max-uiux-overhaul/plan.md`
  - `plans/260818-1626-ariadnev-docs-pro-max-uiux-overhaul/phase-01..06`
- Site source:
  - `apps/site/src/pages/index.astro`, `404.astro`
  - `apps/site/src/components/*`
  - `apps/site/src/layouts/base-layout.astro`
  - `apps/site/src/styles/site.css`
  - `apps/site/src/data/marketing-facts.ts`
- Docs source:
  - `apps/docs/src/app/*`
  - `apps/docs/src/components/*`
  - `apps/docs/src/lib/content-catalog.ts`, `public-markdown.ts`
  - `apps/docs/content/generated/catalog.json`
- Tokens/assets/tests:
  - `packages/tokens/src/tokens.json`, `index.ts`
  - `tests/benchmarks/screen-fixtures.json`
  - `tests/visual/*`
  - `tests/docs/*`

## Shipped route and screen disposition matrix

| Surface | Current route(s) | Current owner | Shipped contract to preserve | Reinvention disposition |
|---|---|---|---|---|
| M01 marketing home | `/` | `apps/site/src/pages/index.astro` + five macros | URL, structured data, install commands, docs/release links, five macro narrative, no-JS readability, local-first / telemetry-off claims only from `marketing-facts.ts` | Reinterpret hard |
| M02 marketing 404 | `/404`, unknown site paths | `apps/site/src/pages/404.astro` | Real 404 status, recovery actions, install command, broken-path concept, no fake success page for machine routes | Reinterpret moderate |
| D00 chooser | `/` on docs origin | `apps/docs/src/app/page.tsx` | Explicit EN/VI stable links, no redirect/cookie memory, marketing return link, static root | Reinterpret moderate |
| D01 current docs home | `/en/stable/`, `/vi/stable/` plus physical current version aliases | screen registry `D01-current-docs-home` | Home stays generated/current-stable authoritative, EN/VI chrome parity, current-edition identity | Reinterpret hard |
| D02 previous home | `/en/1.0.0/`, `/vi/1.0.0/` | `D02-previous-home` | Previous-stable route kept useful, clear current-stable return path, historical edition remains browsable | Reinterpret moderate |
| D03-D11 authored docs | Stable EN/VI authored guides/concepts/get-started routes | screen registry authored experiences | Page URLs/titles/source authority, safe Markdown body, TOC/pager/copy/search shell, no-JS article consumption | Reinterpret hard; preserve body semantics |
| D12 CLI index | `/[locale]/[version]/reference/cli/` incl `stable` and physical versions | `D12-cli-command-index` | Aggregate route, static search/filter, no-JS usable index, CLI namespace visibility | Reinterpret hard |
| D13 CLI detail family | 212 generated detail routes across EN/VI/current+previous | `D13-cli-command-detail` | Canonical detail URLs, static generation, search discoverability, out-of-sidebar policy | Preserve architecture, replace page visual composition |
| D14 provider reference | `/reference/providers/` per locale/version | `D14-provider-reference` | Generated matrix remains source of truth, horizontal overflow handled locally, provider jump nav | Reinterpret moderate |
| D15 skill catalog + category family | `/reference/skills/` + 30 category routes | `D15-skill-catalog`, `D15-skill-category` | Split index/category IA, static category routes, progressive filter, byte-sensitive density | Preserve IA, reinterpret visuals |
| D16 workflows | `/reference/workflows/` | `D16-workflow-reference` | Generated text remains authority; inline SVG is supplemental only | Preserve text-first model, reinterpret diagram shell |
| D17 release notes | `/release-notes/` | `D17-release-notes` | Source-faithful release body, edition metadata, highlights only when headings exist | Reinterpret light-to-moderate |
| D18 docs 404 | docs unknown routes | `apps/docs/src/app/not-found.tsx` | Real 404, dual EN/VI recovery blocks in initial HTML, no locale detector | Reinterpret light |

## Component-level disposition matrix

| Area | Files | Keep exactly | Reinterpret | Replace/retire |
|---|---|---|---|---|
| Brand assets | `apps/site/public/ariadnev-logo.webp`, `apps/site/public/favicon.png`, `apps/site/public/apple-touch-icon.png`, same in `apps/docs/public/` | Asset bytes and paths | Placement/scale/frame only | No recolor, redraw, crop, filter, regen |
| Marketing shell | `base-layout.astro`, `site-header.astro`, `site.css` | Skip link, CSP-compatible local assets, `/install`/docs actions fit at mobile | Header density, footer composition, typographic hierarchy | Any decorative assumptions tied to current atlas styling |
| Marketing macros | `hero-section.astro`, `execution-map.astro`, `authority-boundary.astro`, `evidence-ledger.astro`, `final-install.astro` | Claim set, source links, install commands, textual equivalents for diagrams | Layout, ordering within macro, visual language, diagram styling | Current exact split/box/card treatment |
| Marketing enhancement | `page-enhancer.ts` | Additive-only behavior, reduced-motion respect, no content creation, copy fallback | Emphasis styling and event UX | One-shot observer specifics if a cleaner progressive enhancement exists |
| Marketing facts authority | `marketing-facts.ts` | Single-source claims discipline, protected routes, docs source links | none | Do not duplicate claims into component literals |
| Docs root/404 | `app/page.tsx`, `app/not-found.tsx` | Explicit locale choice, dual-language recovery, no redirect memory | Visual framing | none |
| Docs shell | `docs-shell.tsx`, `locale-version-switcher.tsx`, `search-dialog.tsx`, `mobile-drawer-enhancer.tsx`, `docs-pager.tsx`, `copy-actions.tsx`, `document-copy-enhancer.tsx`, `toc-active-observer.tsx` | Static-first nav/search/switch/copy contracts; accessibility roles; no-JS drawer/search fallbacks; EN/VI chrome keys | Visual styling, grouping, control affordances, mobile shell composition | Any layout coupled too tightly to current dark atlas chrome |
| Docs screen registry | `docs-screen-registry.ts`, `.tsx` | Closed screen ownership model, generated-pass-through separation | none | Do not collapse into ad hoc route conditionals |
| Authored screen experiences | `components/screen-experiences/*.tsx` | Data/body authority split; structural probes that tests expect semantically | Hero/card/topology wrappers and dense comparison UI | Any over-specific “pro-max” treatment that adds bytes without contract value |
| Generated reference experiences | `components/reference/*.tsx` | Category split, CLI detail family, provider/workflow/release source linkage | Visual density, filter chrome, matrix cosmetics | Any bento/timeline branding assumptions not tied to tests |
| Safe content pipeline | `lib/public-markdown.ts`, `lib/content-catalog.ts`, `lib/content-source.ts`, `lib/static-discovery.ts` | No MDX JSX/HTML/images; static catalog authority; safe link validation | none | Do not weaken to support visual ideas |
| Tokens | `packages/tokens/src/tokens.json` | Semantic token roles, cartography vocabulary, asset-independent theme contract | Token values and some role additions if additive | `packages/tokens/src/index.ts` placeholder should be replaced with real exports eventually |

## Preserve / replace / retire summary

### Preserve

- Exact public URL patterns and static-export model for marketing and docs.
- Generated docs authority: catalog, search partitioning, release notes, provider/workflow/CLI reference source ownership.
- EN/VI parity and explicit locale URLs.
- No-JS critical paths:
  - marketing readable with script absent
  - docs chooser usable with plain links
  - docs sidebar via `<details>`
  - copy actions with manual fallback
  - TOC/article readable without client helpers
- Accessibility/perf contracts already encoded in tests:
  - no body overflow masking
  - local overflow regions
  - reduced-motion respect
  - forced-colors/print/reflow coverage
  - real 404 statuses
- Exact brand asset files/paths named above.

### Replace

- Current “Living Execution Atlas” surface styling as the dominant visual metaphor. It is safe to replace the look, not the truth model.
- Current macro compositions and docs shell spacing/hierarchy.
- Current diagram paint language where text equivalent already exists.
- Placeholder token package JS export surface in `packages/tokens/src/index.ts`.

### Retire

- Old-plan assumptions that the current checkout no longer proves:
  - 447 generated docs routes
  - 103-skill framing
  - “grandfathered retired CLI route” active surface
  - some plan-era test-count numbers
- Any lingering plan language implying Fumadocs visual ownership; source shows bespoke docs shell.

## Stale or unverified claims in prior completed plans

| Claim | Source plan | Current evidence | Disposition |
|---|---|---|---|
| “route count 66→444” / “447 generated routes” | 2026-08-16 plan + 2026-08-18 docs overhaul phase 06 | `apps/docs/content/generated/catalog.json` has 278 total pages: 83 EN current, 56 EN previous, 83 VI current, 56 VI previous | Stale |
| “103 skill catalog” | 2026-08-18 phase 05 title | Current category routes are 30 and search partition has 16 skill routes in EN current; the plan title number is no longer source-backed in this checkout | Stale/unverified |
| “D13 retired route pipeline active” / generated pass-through retired details | 2026-08-16 phase 05 language | `apps/docs/src/components/docs-screen-registry.ts` still names `D13-cli-command-retired`, but current catalog count is `0` retired pages | Stale in shipped surface |
| “176 Vitest tests and 164 docs contract tests pass” | 2026-08-18 phase 06 | Not re-run in this audit; test files exist, but pass count is not re-verified here | Unverified in this report |
| “all 18 screens D00-D17 render with Pro Max styling” | 2026-08-18 plan/phase success text | D18 exists in current fixtures/tests; plan framing excludes it while shipped verification includes it | Incomplete naming, not a code bug |
| “Fumadocs docs shell” implied in older plan context | 2026-08-16 master plan | Current shipped shell is bespoke (`docs-shell.tsx`, custom search/switcher/drawer); Fumadocs remains substrate, not visible template | Superseded |

## Reusable architecture

- `apps/docs/content/generated/catalog.json` as the authoritative route/screen/version map.
- Screen registry split:
  - metadata-only `docs-screen-registry.ts`
  - JSX dispatcher `docs-screen-registry.tsx`
- Safe-public-Markdown enforcement in `public-markdown.ts`.
- Static shell + progressive enhancement pattern in both apps.
- Visual fixture manifest `tests/benchmarks/screen-fixtures.json`.
- Existing docs/site contract and visual tests as reinvention guardrails.
- Semantic design token vocabulary in `packages/tokens/src/tokens.json`.

## Visual debt and reinvention pressure points

- Site and docs both use the same logo files but wire head/icon behavior separately; consistency exists, abstraction does not.
- Docs root layout hardcodes `themeColor: "#181818"` instead of deriving from tokens.
- Token package runtime export surface is effectively a stub; CSS/token consumption is stronger than TS/runtime ergonomics.
- Visual identity is coherent but overly uniform:
  - many bordered panels
  - repeated mono/kicker rhythms
  - dark-only assumptions baked into docs metadata and many component comments
- Search, switchers, pager, and drawer feel contract-correct but visually incremental rather than intentionally reinvented.
- Marketing page is honest and well-structured but compositionally linear; major reinvention headroom exists without changing facts.

## Likely implementation files by phase

### Phase A: freeze contracts and fixtures before visual work

- `tests/benchmarks/screen-fixtures.json`
- `tests/visual/site/marketing-screens.spec.ts`
- `tests/visual/docs/docs-screens.spec.ts`
- `tests/visual/accessibility-modes.spec.ts`
- `tests/docs/docs-screen-registry.test.mjs`
- `tests/docs/static-routing.test.mjs`
- `tests/docs/shell-accessibility.test.mjs`

### Phase B: shared tokens and cross-app brand shell

- `packages/tokens/src/tokens.json`
- `packages/tokens/src/index.ts`
- `apps/site/src/layouts/base-layout.astro`
- `apps/docs/src/app/layout.tsx`
- `apps/site/public/*` and `apps/docs/public/*` for reference only, not mutation of logo/favicon imagery

### Phase C: marketing reinvention

- `apps/site/src/pages/index.astro`
- `apps/site/src/pages/404.astro`
- `apps/site/src/components/*.astro`
- `apps/site/src/styles/site.css`
- `apps/site/src/scripts/page-enhancer.ts`
- `apps/site/src/data/marketing-facts.ts` only if claim wiring, not for decorative changes

### Phase D: docs shell reinvention

- `apps/docs/src/components/docs-shell.tsx`
- `apps/docs/src/components/search-dialog.tsx`
- `apps/docs/src/components/locale-version-switcher.tsx`
- `apps/docs/src/components/docs-pager.tsx`
- `apps/docs/src/components/mobile-drawer-enhancer.tsx`
- `apps/docs/src/components/copy-actions.tsx`
- `apps/docs/src/components/document-copy-enhancer.tsx`
- `apps/docs/src/components/toc-active-observer.tsx`
- `apps/docs/src/styles/docs.css`

### Phase E: authored docs screen compositions

- `apps/docs/src/components/screen-experiences/*.tsx`
- `apps/docs/src/components/prose/*.tsx` only if visual wrappers or semantics need additive support

### Phase F: generated reference compositions

- `apps/docs/src/components/reference/*.tsx`
- `apps/docs/src/lib/chrome-strings.ts`
- `apps/docs/src/lib/content-catalog.ts` only if metadata additions are required

### Phase G: final verification and plan cleanup

- `tests/visual/__baselines__/*`
- `docs/operations/visual-verification-harness.md` if commands or evidence workflow change
- prior plan docs only if the user explicitly wants stale numeric claims corrected

## Ranked recommendation

1. Keep the current architecture, replace the visual layer aggressively.
   - Best fit because the hard parts already exist: static routing, generated authority, accessibility fallbacks, EN/VI parity, and verification harness.
   - Lowest adoption risk: avoids reopening the content/build/search contracts.
2. Unify tokens and shared brand/head rules before touching page-specific styling.
   - Prevents site/docs divergence during the reinvention.
3. Rebuild marketing first, then docs shell, then screen/reference compositions.
   - Marketing has the most creative headroom and the least generated-content coupling.
   - Docs shell next gives the biggest visible change with lower content risk than per-screen rewrites.

## Limitations

- I did not run the test suite, so any statement about current green counts stays “unverified in this report”.
- I did not diff image binaries; preservation guidance is path/ownership-based from source inspection.
- I did not inspect every generated D13 page individually; audit treats that family through catalog counts and route architecture, which is the correct level for reinvention planning.

## Unresolved questions

- Whether the reinvention should keep dark-only presentation or broaden to light-mode support without changing existing accessibility/perf budgets.
- Whether old completed plan docs should be corrected now, or left as historical records and superseded only by the new reinvention plan.

Status: DONE
Summary: Audited shipped site/docs surface, compared it to both completed plan sets, and wrote a disposition report with route families, component ownership, stale-plan deltas, reusable architecture, and likely phase files.
Concerns/Blockers: Prior plan docs contain stale numeric claims; if they remain uncorrected, future planning can accidentally overfit to 2026-08-16/18 assumptions instead of current source.
