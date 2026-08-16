# Whole-site UI/UX audit

**Status:** complete · **Date:** 2026-08-16 · **Mode:** audit only, no product code changed

## Scope and evidence

- `apps/site`: Astro marketing home and 404.
- `apps/docs`: 69 static outputs across EN/VI, stable/current/previous versions, authored guides, generated CLI/provider/skill/workflow references, search, locale/version selection, and error states.
- Shared visual contract: `packages/tokens/src/tokens.json` and `docs/execution-cartography.md`.
- Production builds passed for both apps.
- Rendered checks: 320×900 and 1440×1024 for both products; additional mobile checks for installation, provider, and CLI references; desktop workflow reference.
- Lighthouse on local production output: site 100 accessibility / 100 best practices / 100 SEO; docs 100 / 100 / 100, with one unweighted label-content-name mismatch audit failure.
- Runtime probes: page overflow, hidden navigation, TOC size, table behavior, heading scroll offset, document language, theming, and sticky positioning.
- Standard: current [Vercel Web Interface Guidelines](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md), fetched 2026-08-16.

## Verdict

The engineering foundation is stronger than the visual result. Shared tokens, font coverage, focus rings, skip links, semantic landmarks, reduced motion, honest content, and static delivery are all good. Keep the execution-cartography identity.

The marketing site is coherent but compositionally repetitive and visually under-expressive. The docs product is the main blocker to a top-tier experience: its information architecture is flat, mobile navigation is a clipped horizontal strip, long references are difficult to traverse, tables/code lack production-grade presentation, and Vietnamese pages localize content but not application chrome.

| Area | Site | Docs | Whole-system reading |
|---|---:|---:|---|
| Accessibility baseline | 9/10 | 7/10 | Strong primitives; several semantic and locale gaps remain |
| Information architecture | 7/10 | 4/10 | Docs hierarchy is encoded in slugs but not exposed in navigation |
| Responsive UX | 8/10 | 4/10 | Site holds at 320px; docs hides discoverability behind horizontal scrolling |
| Visual hierarchy | 7/10 | 5/10 | Consistent, but too many surfaces use the same visual rhythm |
| Interaction quality | 7/10 | 5/10 | Site controls are clear; docs controls and menus feel unfinished |
| Content readability | 8/10 | 5/10 | Good prose width; long references need purpose-built primitives |
| Brand distinctiveness | 7/10 | 5/10 | Strong thesis, weak expression in docs |
| Performance foundation | 9/10 | 8/10 | Static, bounded, self-hosted; docs ships 297,860 bytes on the sampled route |

## Findings by file

### `apps/docs/src/styles/docs.css`

- **P0** `apps/docs/src/styles/docs.css:60` - `overflow-x: hidden` masks real content overflow. Provider reference measured 327px at a 320px viewport; the right edge is clipped instead of exposing the defect.
- **P0** `apps/docs/src/styles/docs.css:142` - mobile navigation turns all 15 pages into one horizontal row. Only 3 links intersect the initial 320px viewport; no category, menu button, or continuation affordance explains that 12 more exist.
- **P0** `apps/docs/src/styles/docs.css:122` - docs content has no responsive table primitive. Runtime sample: provider page has 6 tables and page-level overflow; CLI reference has 45 tables. Tables have browser-default `display: table`, `overflow-x: visible`, and `border-collapse: separate`.
- **P1** `apps/docs/src/styles/docs.css:76` - header, sidebar, and TOC are all static. On long workflow and CLI references, global navigation and local orientation disappear after the first viewport.
- **P1** `apps/docs/src/styles/docs.css:117` - anchored headings have computed `scroll-margin-top: 0px`; copied links land without a deliberate reading offset and will conflict with a future sticky header.
- **P1** `apps/docs/src/styles/docs.css:65` - generic buttons, search trigger, and switcher summaries have no hover/active treatment. Only links and heading-copy buttons define hover feedback.
- **P1** `apps/docs/src/styles/docs.css:82` - modal lacks `overscroll-behavior: contain`; touch scrolling can escape from the dialog into the document.
- **P2** `apps/docs/src/styles/docs.css:116` - code blocks only receive positioning, overflow, and top padding. No authored surface, border, syntax hierarchy, line treatment, or compact mobile strategy distinguishes code from body content.
- **P2** `apps/docs/src/styles/docs.css:125` - heading-copy controls render a visible `#` beside every heading. On long references this becomes repeated visual noise rather than a discoverable permalink affordance.
- **P2** `apps/docs/src/styles/docs.css:39` - “semibold” aliases the single 700 weight, producing a binary regular/bold hierarchy. The rendered docs feel heavy because navigation, headings, labels, and emphasized prose converge on the same weight.
- **P2** `apps/docs/src/styles/docs.css:59` - dark UI does not declare `color-scheme: dark`; computed color scheme is `normal`, so native controls and browser surfaces need not match the page.
- **P2** `apps/docs/src/styles/docs.css:59` - docs has no matching `theme-color` metadata or theme contract, unlike the marketing site.
- **P3** `apps/docs/src/styles/docs.css:64` - global control sizing establishes minimum boxes but no shared disabled, selected, pressed, loading, or error state vocabulary.
- **P3** `apps/docs/src/styles/docs.css:60` - no intentional `touch-action` or tap-highlight treatment is defined for mobile controls.

### `apps/docs/src/components/docs-shell.tsx`

- **P0** `apps/docs/src/components/docs-shell.tsx:40` - all pages render as one flat list despite catalog slugs already encoding Get Started, Concepts, Guides, and Reference. Scanning and wayfinding degrade as the catalog grows.
- **P0** `apps/docs/src/components/docs-shell.tsx:17` - mobile TOC renders even when empty and has no size strategy. Runtime samples ranged from an empty-looking “On this page” panel to 132 items on CLI reference.
- **P1** `apps/docs/src/components/docs-shell.tsx:40` - mobile docs has no explicit navigation disclosure/drawer, current-section summary, or hierarchy; horizontal overflow is the only discovery mechanism.
- **P1** `apps/docs/src/components/docs-shell.tsx:46` - desktop TOC has no active-heading state or scroll tracking, so it is a static list rather than a location aid.
- **P1** `apps/docs/src/components/docs-shell.tsx:17` - “On this page”, skip-link copy, navigation labels, and breadcrumb chrome are hardcoded in English on Vietnamese routes.
- **P2** `apps/docs/src/components/docs-shell.tsx:43` - breadcrumb repeats “Docs / EN / page title” but does not expose the content section; it consumes mobile space without strengthening hierarchy.
- **P2** `apps/docs/src/components/docs-shell.tsx:32` - docs brand links to the language chooser rather than the active locale/version root; it behaves unlike a conventional docs-home link.

### `apps/docs/src/components/locale-version-switcher.tsx`

- **P0** `apps/docs/src/components/locale-version-switcher.tsx:20` - Lighthouse detects visible/accessibility-name mismatch: visible “Language · EN” is named “Language: English”; visible “Version · 1.1.0” is named “Version: Stable 1.1.0”.
- **P1** `apps/docs/src/components/locale-version-switcher.tsx:20` - `role="menu"`/`menuitem` promises menu keyboard behavior, but arrow-key navigation, Escape handling, focus return, and roving focus are absent. Native disclosure + ordinary links would be safer unless the complete menu pattern is implemented.
- **P1** `apps/docs/src/components/locale-version-switcher.tsx:20` - Language, Version, Stable, Current, Previous stable, and unavailable text are not localized for VI.
- **P2** `apps/docs/src/components/locale-version-switcher.tsx:19` - two disclosures can remain open simultaneously and overlap because open-state coordination and outside-click behavior are absent.
- **P2** `apps/docs/src/components/locale-version-switcher.tsx:20` - the native marker is hidden in CSS without adding a persistent custom chevron or open-state indicator.

### `apps/docs/src/components/search-dialog.tsx`

- **P1** `apps/docs/src/components/search-dialog.tsx:185` - `aria-current` is used for the keyboard-focused result. Focus and “current page/item” are different states; this produces misleading assistive semantics.
- **P1** `apps/docs/src/components/search-dialog.tsx:179` - search title, label, loading/result/error copy, and close control stay English on VI pages.
- **P2** `apps/docs/src/components/search-dialog.tsx:119` - status announces only a count; it does not include the query or offer a recovery/action for zero results.
- **P2** `apps/docs/src/components/search-dialog.tsx:169` - trigger shows `/` but omits the supported Cmd/Ctrl+K shortcut, and mobile receives a desktop keyboard hint with no mobile-specific affordance.
- **P2** `apps/docs/src/components/search-dialog.tsx:183` - search input lacks a placeholder example and explicit spellcheck policy; search opens into a visually empty surface with no suggested queries or recent paths.

### `apps/docs/src/app/[locale]/[version]/[[...slug]]/page.tsx`

- **P1** `apps/docs/src/app/[locale]/[version]/[[...slug]]/page.tsx:43` - every page ends after content and copy actions; there is no previous/next navigation, section continuation, or “what to do next” path.
- **P2** `apps/docs/src/app/[locale]/[version]/[[...slug]]/page.tsx:40` - every page uses the same title/description/body composition. Guides, references, release notes, and concept pages receive no type-specific information pattern.

### `apps/docs/src/components/document-copy-enhancer.tsx`

- **P2** `apps/docs/src/components/document-copy-enhancer.tsx:42` - a DOM effect injects controls after hydration into every H2-H6. This causes a post-load visual change and scales poorly on the 132-heading CLI reference.
- **P2** `apps/docs/src/components/document-copy-enhancer.tsx:46` - visible `#` is ambiguous and tiny; the accessible label is good, but the visual affordance should use a consistent link icon or reveal on heading hover/focus-within.

### `apps/docs/src/components/copy-actions.tsx`

- **P2** `apps/docs/src/components/copy-actions.tsx:63` - the page footer exposes four equally weighted controls/links with duplicated intent (“Copy Markdown” + “Open Markdown source”, “Copy heading link” + “Open heading link”). It lacks a clear primary action and compact overflow treatment on mobile.

### `apps/docs/src/app/layout.tsx`

- **P1** `apps/docs/src/app/layout.tsx:5` - metadata lacks docs theme color and color-scheme declarations.
- **P2** `apps/docs/src/app/layout.tsx:7` - root-page title becomes “ariadnev documentation | ariadnev documentation”; the default title and template duplicate each other.
- **Pass** `apps/docs/scripts/set-static-document-language.mjs:17` correctly rewrites exported VI documents to `<html lang="vi">`; do not treat the source layout's default `lang="en"` as a shipped locale defect.

### `scripts/docs-content/render-reference-pages.mjs`

- **P1** `scripts/docs-content/render-reference-pages.mjs:233` - CLI output creates one monolithic reference page. Current build produces 132 TOC entries and 45 option tables; search helps discovery but does not replace sectional navigation or command-level deep pages.
- **P1** `scripts/docs-content/render-reference-pages.mjs:265` - provider reference emits dense data tables without a presentation contract for narrow screens.
- **P2** `scripts/docs-content/render-reference-pages.mjs:299` - workflow reference describes graph topology only as repeated tables. It misses the product's strongest visual language: actual execution maps with a textual fallback.

### `apps/site/src/styles/site.css`

- **P1** `apps/site/src/styles/site.css:44` - body-level `overflow-x: hidden` can hide future regressions. Current 320px output has no page overflow; the wide SVG is already correctly contained by `.map__figure` at line 316.
- **P2** `apps/site/src/styles/site.css:179` - section composition repeats the same full-width shell, eyebrow, heading, lede, and ruled list rhythm. The consistency is strong, but the page has little macro-layout contrast from hero to evidence ledger.
- **P2** `apps/site/src/styles/site.css:634` - copy feedback disappears with `display:none` while empty, then adds a row after interaction. The local status is useful, but the control could reserve a stable compact feedback slot or transform label to avoid vertical movement.
- **P3** `apps/site/src/styles/site.css:238` - controls have hover/focus but no authored pressed/active state.
- **P3** `apps/site/src/styles/site.css:43` - no intentional `touch-action` or tap-highlight treatment is defined for mobile controls.

### `apps/site/src/components/promise-section.astro`

- **P1** `apps/site/src/components/promise-section.astro:15` - the hero is copy-led but visually has the same basic composition as every later section. The strongest brand object, the execution path, appears only after the first divider.
- **P2** `apps/site/src/components/promise-section.astro:39` - publication date is rendered with `slice(0, 10)` instead of `Intl.DateTimeFormat` and lacks semantic `<time datetime>` markup.

### `apps/site/src/components/execution-map.astro`

- **P2** `apps/site/src/components/execution-map.astro:46` - the most distinctive brand asset is a fixed horizontal SVG that becomes a scrollable technical diagram on mobile. Functional, but it does not adapt compositionally to a vertical mobile path.
- **Pass** `apps/site/src/components/execution-map.astro:46` provides an ordered textual equivalent and marks the duplicate SVG decorative; preserve this accessibility pattern in a redesign.

### `packages/tokens/src/tokens.json`

- **P1** `packages/tokens/src/tokens.json:85` - only regular and bold weights exist. A premium docs hierarchy needs at least a deliberate medium/semibold role or a variable-weight scale, not aliases that collapse to 700.
- **P2** `packages/tokens/src/tokens.json:45` - semantic tokens cover canvas/raised/overlay but not interactive state layers, selection/current navigation, data-table surfaces, code surfaces, or content-callout roles.
- **P2** `packages/tokens/src/tokens.json:133` - only content/prose/touch sizes are shared; app shell widths, sidebar/TOC widths, header height, and readable table constraints live ad hoc in app CSS.
- **Pass** `packages/tokens/src/tokens.json:5` uses a restrained OKLCH palette with tested contrast, semantic accents, a 4px spacing scale, bounded motion, and Vietnamese-capable fonts. Preserve these contracts.

## Cross-surface gaps

1. **One brand, two maturity levels.** Marketing applies execution cartography intentionally; docs mostly inherits colors and fonts without translating topology, gates, checkpoints, or evidence into documentation components.
2. **No shared shell behavior.** Header proportions, brand linking, control states, page transitions, footer behavior, and mobile navigation differ between site and docs.
3. **No content-component system.** There are no documented primitives for callouts, warnings, steps, tabs, command blocks, option tables, compatibility matrices, empty states, or next actions.
4. **No visual regression gate.** Existing tests protect tokens, output, contrast, and size budgets, but not screenshots, mobile navigation discoverability, clipped content, menu semantics, or keyboard journeys.
5. **Dark-only contract needs an explicit decision.** The accepted design contract says the ground is ink. Keep it for redesign unless the product owner explicitly chooses a light reading mode for docs; do not drift into an accidental second palette.

## Recommended target direction

**Keep:** execution cartography, ink/graphite ground, spectral live paths, copper human gates, honest evidence-led copy, self-hosted Vietnamese-capable type, square drafted geometry, and restrained motion.

**Evolve it into a “living execution atlas”:** marketing becomes the cinematic overview of a run; docs becomes the precise field manual. They should feel related without sharing identical page composition.

### Marketing target

- Make the execution path the hero's memorable visual element, not a second-section diagram.
- Use 3-4 distinct macro-layout families across the page: split hero, path narrative, boundary comparison, evidence ledger, terminal action.
- Preserve facts and routes; improve visual storytelling, hierarchy, whitespace, and responsive adaptation.
- Convert the mobile map into a vertical path rather than requiring horizontal exploration.
- Add purposeful state motion only where it explains path progression; keep reduced-motion behavior.

### Docs target

- Build a real docs shell: sticky header, grouped/collapsible desktop sidebar, mobile drawer, sticky/active TOC, breadcrumbs with section, and previous/next pager.
- Add page-kind templates for guide, concept, reference, release notes, and landing/index pages.
- Add first-class content primitives: command block, code block, responsive table, callout/gate, numbered procedure, compatibility matrix, API/CLI option row, and “next step”.
- Split or virtualize the CLI reference experience: command index + filtered command sections, or command-level pages generated from the same source contract.
- Localize all application chrome and announcements, not only document bodies.
- Keep search as a command palette with suggestions, keyboard semantics, query feedback, and section-aware results.

## Delivery roadmap

### Phase 1 - UX safety and mobile navigation

- Replace masked overflow with measured containment.
- Introduce grouped docs navigation and a mobile drawer.
- Add responsive table/code primitives.
- Fix switcher semantics, accessible-name mismatch, heading offsets, dark color scheme, dialog overscroll, and VI chrome.
- Acceptance: no clipped content at 320/375/390; all 15 pages discoverable without horizontal swiping; keyboard and screen-reader menu behavior matches semantics.

### Phase 2 - Shared design-system expansion

- Extend tokens for interactive states, docs shell dimensions, code/data surfaces, and medium/semibold hierarchy.
- Define shared control, link, focus, pressed, selected, disabled, loading, and feedback states.
- Keep framework components separate; share tokens/contracts only, per workspace architecture.
- Acceptance: site and docs use the same semantic state vocabulary without copying framework components.

### Phase 3 - Docs product redesign

- Implement sticky/grouped navigation, active TOC, page templates, content primitives, pager, and refined search.
- Recompose generated CLI/provider/workflow content for scanability without changing machine-owned facts.
- Acceptance: guides support task completion; references support lookup; CLI page no longer presents 132 undifferentiated TOC links.

### Phase 4 - Marketing visual upgrade

- Recompose hero and sections around a living execution path while retaining verified claims and URLs.
- Add responsive visual art direction and restrained semantic motion.
- Acceptance: every section has a distinct information structure; no invented metrics/testimonials; mobile path is native to the viewport.

### Phase 5 - Verification and polish

- Add Playwright viewport and keyboard journeys for site home, docs home, guide, provider table, CLI reference, search, locale/version switcher, 404, and not-found.
- Add screenshot baselines at 320, 375, 768, 1280, and 1440; add overflow and visible-navigation assertions.
- Run Lighthouse, contrast tests, reduced-motion checks, build budgets, and EN/VI parity.
- Acceptance: zero critical accessibility defects, zero clipped content, stable screenshots, and no regression to static-size budgets without an explicit decision.

## Preserve during implementation

- Do not change verified product claims, release routes, generated-source authority, or locale/version URL contracts for visual reasons.
- Do not hand-edit generated MDX or `packages/tokens/dist/*`.
- Do not replace semantic HTML with custom ARIA widgets unless full keyboard behavior is implemented.
- Do not weaken existing token, contrast, font, static-output, or docs-content tests.
- Do not add a new accent family; spectral and copper already carry defined meaning.

## Unresolved decisions

1. Keep docs dark-only as the current design contract specifies, or deliberately add a user-selectable light reading mode?
2. Keep CLI reference as one URL with in-page filtering, or generate one URL per command while preserving the aggregate index?
3. Should Vietnamese become the remembered/default docs locale for returning Vietnamese readers, or remain an explicit URL choice only?
