---
title: Direction C visual reinvention system research
date: 2026-08-18 20:11 +07:00
scope: marketing + docs visual identity
status: final
---

# Direction C Visual Reinvention System Research

## Summary

Recommendation rank:
1. **Direction C: field manual / signal room**. Keep the existing logo + favicon untouched, but move the rest of the interface from "dark developer site" into a denser, editorial, operations-room language: ruled layouts, signal bands, evidence chips, modular panels, and static topology diagrams as framing devices instead of hero ornaments. This is the strongest fit with the repo's execution-cartography thesis and the cheapest path to a real reinvention without violating the no-JS/static/a11y constraints.

Why this wins:
- Strong architectural fit with [docs/execution-cartography.md](/Users/vchun/Codes/My-projects/vcskill-kit/ariadnev-web/docs/execution-cartography.md:1), existing topology semantics, and current token families.
- Distinct from generic SaaS glass/bento aesthetics.
- Implementable mostly through tokens, shell CSS, and content composition; no product-scope change required.
- Safer than a maximal poster/3D/art-direction pivot, which would fight current information density and static rendering.

Current repo read:
- Marketing already has the right semantic bones: sequential map, authority boundaries, proof ledger.
- Docs shell drifted away from the thesis: blur, gradient text, glow, pill-badge sheen, and mobile dead space. Desktop reads competent; mobile `D01-320` reads under-filled above the fold.

## Method

- Repo evidence: `docs/execution-cartography.md`, tokens manifest, site/docs CSS, representative shell/content components, Playwright baselines.
- External references, checked 2026-08-18:
  - W3C WCAG 2.2 and WAI Understanding docs for target size, reflow, focus visibility.
  - MDN `prefers-reduced-motion`.
  - Vercel Web Interface Guidelines.
  - Linear official homepage + docs.
  - Stripe official app design/style docs.

Source credibility:
- W3C/WAI: normative for accessibility.
- MDN: strong implementation reference, secondary but authoritative in practice.
- Vercel/Stripe/Linear: primary sources for current developer-tool visual/product patterns, not normative standards.

## Direction C

### Concept

**Field manual / signal room.**

Not futuristic chrome. Not notebook minimalism. It should feel like a printed operations manual that has been wired into a live signal board:
- editorial structure first;
- diagrams treated as evidence;
- chrome reduced to rules, tabs, labels, coordinates, and state markers;
- color used sparingly and semantically;
- large calm surfaces interrupted by sharp informational seams.

The emotional read should be: "precise, inspectable, operational." Not "playful", not "premium SaaS", not "terminal cosplay".

### Palette Relationship To Fixed Logo

Do not change logo/favicons. Instead, let them become the most saturated organic form on the page.

Palette system:
- Base ground stays ink/graphite/cool from current tokens.
- Spectral blue remains the active-path hue.
- Copper remains human-gate / intervention hue.
- Add no new accent family. Reinvention comes from composition and value contrast, not extra hues.

Adjustment guidance:
- Darken large-field surfaces slightly and increase value separation between `canvas`, `raised`, and `overlay` so layout strata read more like paper trays than glowing glass.
- Reduce broad spectral glow usage; reserve bright spectral for path witness bars, active coordinates, selected row rules, and actionable focus.
- Use copper in narrow vertical markers, inline stamps, and approval rails, never broad fills.
- Let the unchanged logo sit inside neutral chrome, so its green-blue energy reads intentional rather than clashing.

Result:
- Logo stays recognizably external to the system, like a mark stamped onto a disciplined instrument panel.

## Typography And Spatial System

### Typography

Keep current font families. Change usage, not assets.

- `Be Vietnam Pro` becomes an **editorial display face**, not a glossy marketing face.
  - Use bold, large, tightly tracked headings.
  - Avoid gradient fills entirely.
  - Favor stacked two-line headings and asymmetric wraps.
- `Inter` becomes the working text face.
  - Slightly denser body rhythm in docs than current marketing.
  - Keep paragraphs short and evidence-led.
- `JetBrains Mono` becomes a system annotation layer.
  - Use for coordinates, section numbers, data labels, tabular facts, path states, command affordances.
  - Never let mono dominate paragraph copy.

Hierarchy model:
- H1: poster-sized editorial statement.
- H2: sectional ledger heading.
- H3: operational subhead.
- Mono eyebrow: coordinate, phase, or source marker.

### Spatial System

Use a stricter macro-grid than current screens.

- Marketing:
  - 12-column desktop.
  - Frequent 3/9, 4/8, and 5/7 asymmetry.
  - Tall vertical rhythm with occasional compressed dense bands.
- Docs:
  - 3-rail desktop remains, but rails become more explicit and less airy.
  - Left rail = atlas/navigation.
  - Center = reading measure + embedded artifacts.
  - Right rail = local coordinates/evidence/TOC.
- Mobile:
  - Collapse to one rail immediately.
  - No decorative header occupancy above the first heading.
  - Every screen must surface title, one-line orientation, and next action inside first viewport.

Spacing character:
- Keep 4px scale contract.
- Visually bias toward larger section breaks and tighter intra-card spacing.
- More "page seams", fewer floating islands.

## Marketing Macro-Compositions

### Page Rhythm

1. **Signal masthead**
   - Thin top rule, compact mark, coordinate label, direct CTA.
   - No oversized sticky chrome.

2. **Hero: claim + live route board**
   - Left: hard claim, 3 proof bullets, install action.
   - Right: static route board rendered like an evidence panel, not a soft card.
   - Replace current soft block feel with ruled compartments and status ticks.

3. **Five-state execution strip**
   - Treat as an atlas spread.
   - One horizontal route on desktop; stacked numbered ledger on mobile.
   - Each state gets one evidence sentence, one boundary sentence, one artifact label.

4. **Authority boundary band**
   - Full-width dense band with three workflow columns.
   - Copper rails for gate semantics.
   - More compact, less card-like.

5. **Proof ledger**
   - Convert current evidence table area into a filing/registry composition.
   - Strong row rules, mono keys, source column visually heavy.

6. **Install footer as dispatch panel**
   - Minimal, practical, command-first.
   - No big "final CTA" theater.

### Shape Language

- Squared or mildly rounded corners only.
- Frequent ruled dividers and inset frames.
- No glass panes, no floating blur overlays, no ambient glows as elevation language.
- Diagrams should look drafted, not illuminated.

## Docs Shell And Content-Density Model

### Shell

Desktop docs should feel like an atlas cabinet:
- Header slimmer and more matter-of-fact.
- Remove blur-heavy sticky bar treatment.
- Brand area becomes a stamped ID strip, not a glowing lockup.
- Left nav reads like categorized drawers.
- TOC reads like local coordinates, not a second nav app.

Mobile docs must fix the current dead-space failure:
- Remove tall header occupancy and top padding debt.
- Surface document title immediately under compact brand strip.
- Move TOC behind an inline `On this page` disclosure after intro, not before content.
- Sidebar drawer summary becomes a plain utilitarian control, not a hero element.

### Content Density

Adopt **dense calm**:
- Default prose measure stays readable, but surrounding chrome becomes more informative.
- More inline labels and meta rows.
- Fewer decorative shadows.
- Tables and command blocks look like registered artifacts from the same system.

Content modules:
- `CommandBlock`: framed terminal ticket with caption row, source row, copy action aligned as utility control.
- `Callout`: vertical semantic rail + mono label + plain heading.
- `Reference tables`: strong headers, row separators, optional sticky first column on wide screens only if it does not break reflow.
- `Workflow diagrams`: static, compact, diagram-first but always followed by textual authority.

## Motion And Interaction Grammar

Use motion as confirmation, not ambience.

- Default duration: 120-220ms for micro-state changes, 240-320ms for section-level reveal.
- Motion primitives:
  - rule draw;
  - opacity in;
  - 2-6px translate;
  - active witness sweep for route emphasis;
  - no perpetual shimmer, pulse, or orbit.
- Hover should feel like inspection:
  - border darkens/lightens;
  - label becomes active;
  - panel shifts 1-2px max.
- Focus should be explicit and rectangular, aligned with rails and rules.
- `prefers-reduced-motion` keeps meaning via instant state swaps and opacity only.

Architectural fit:
- Safe for static rendering.
- No JS dependency for essential comprehension.
- Existing progressive enhancement model remains intact.

## Responsive Strategy

### Desktop

- Lean into the atlas-room metaphor.
- Allow wide ruled compositions and lateral comparisons.
- Keep diagrams and tables bounded locally, not page-masked.

### Tablet

- Collapse 3-rail docs to 2-rail earlier than now.
- TOC can merge into content header zone.
- Marketing hero route board can stack beneath claim before it becomes cramped.

### Mobile

Principle: **first viewport must answer where am I, what is this page, what next**.

- One-column only.
- Strip decorative duplication.
- Put install/docs primary actions immediately after claim.
- Convert wide comparison surfaces into stacked records with visible labels.
- Keep command blocks copyable without JS and scroll-contained locally.
- Ensure no screen ships with empty-looking top regions like current `D01-320`.

## Explicit Anti-Patterns

- No gradient text.
- No frosted/sticky glass header.
- No broad blur backgrounds behind chrome.
- No generic bento-card explosion.
- No ambient glow used as hierarchy.
- No third accent hue.
- No giant hero illustration disconnected from source evidence.
- No hidden mobile context above the fold.
- No "AI future" cliché imagery, particle fields, or orb metaphors.
- No reliance on color alone for state.

## Trade-Offs And Adoption Risk

### Benefits

- Stronger differentiation.
- Better coherence with execution-cartography thesis.
- Better fit for dense technical documentation and proof-oriented marketing.
- Lower implementation risk than a more illustrative reinvention.

### Costs

- Requires discipline: if halfway executed, it can collapse into "plain dark docs with lines".
- Some current softened affordances will feel less friendly; copywriting and spacing must keep the tone from becoming severe.
- Marketing may feel less conventionally conversion-optimized than mainstream SaaS hero patterns.

### Adoption Risk

- **Low technical risk**: mostly CSS/token/composition work.
- **Medium design risk**: success depends on consistent editorial art direction across marketing and docs.
- **Low abandonment risk**: direction is built from existing semantic tokens and shell architecture, not a fragile visual gimmick.

## Worst-Case Failure

Worst case: the team ships only the surface cuts, removing glow/blur/gradients without replacing them with stronger compositional rhythm. Outcome: colder, flatter, more austere UI that feels unfinished rather than reinvented.

Mitigation:
- Treat composition changes as mandatory, not optional polish.
- Ship the direction in this order:
  1. shell density + spacing regime
  2. panel/rule/frame language
  3. heading/composition rewrite
  4. motion trim
  5. token tuning

## Cheapest Rollback Seam

Rollback seam:
- Keep reinvention behind shell-level classnames or token aliases first, not component API churn.
- Primary seam is `packages/tokens` semantic aliases plus top-level page-shell classes in:
  - `apps/site/src/styles/site.css`
  - `apps/docs/src/styles/docs.css`
- Secondary seam is macro composition in hero/docs-shell wrappers, not deep prose components.

Cheapest rollback path:
- Revert shell CSS + token alias adjustments while preserving content structure improvements and responsive fixes.
- Do not rewrite logo usage, route model, or content component contracts unless necessary.

## Implementation Guidance

Apply the redesign in layers:

1. **Token retune**
   - Increase neutral depth separation.
   - Reduce any accidental reliance on glow.
   - Keep accent families fixed.

2. **Shared composition primitives**
   - Rules, bands, caption rows, coordinate labels, evidence chips, rail callouts.

3. **Marketing macros**
   - Hero board, state strip, authority band, proof ledger, dispatch footer.

4. **Docs shell**
   - Header simplification, left-rail drawer discipline, mobile-above-fold fix, TOC treatment.

5. **Content modules**
   - Command blocks, callouts, tables, reference listings, workflow diagrams.

6. **Motion pass**
   - Remove ambient effects; preserve meaningful confirmation.

## External Findings That Matter

- WCAG 2.2 makes target size, reflow, and focus visibility directly relevant to this redesign; the current repo already declares these constraints, so the direction should intensify them rather than trade them away.
- Vercel’s interface guidance aligns with several needed corrections here: visible focus, matching hit targets, mobile input sizing, no dead ends, redundant status cues.
- Stripe’s app design docs reinforce a useful principle: strong system identity comes from constrained surfaces plus selective brand expression, not arbitrary custom styling everywhere.
- Linear’s current marketing/docs posture shows the market reward for sharp editorial pacing and operational tone, but ariadnev should go denser and more evidentiary than Linear, not mimic its soft cinematic polish.

## Recommendation

Ship **Direction C: field manual / signal room**.

This is the only direction that is:
- a true visual reinvention;
- grounded in the repo’s documented thesis;
- compatible with unchanged logo/favicon assets;
- credible for both marketing and docs;
- achievable without violating static rendering, no-JS comprehension, accessibility, or performance.

## Sources

- Repo thesis: [docs/execution-cartography.md](/Users/vchun/Codes/My-projects/vcskill-kit/ariadnev-web/docs/execution-cartography.md:1)
- Tokens: [packages/tokens/src/tokens.json](/Users/vchun/Codes/My-projects/vcskill-kit/ariadnev-web/packages/tokens/src/tokens.json:1)
- Font contract: [packages/tokens/src/font-manifest.json](/Users/vchun/Codes/My-projects/vcskill-kit/ariadnev-web/packages/tokens/src/font-manifest.json:1)
- Marketing CSS: [apps/site/src/styles/site.css](/Users/vchun/Codes/My-projects/vcskill-kit/ariadnev-web/apps/site/src/styles/site.css:1)
- Docs CSS: [apps/docs/src/styles/docs.css](/Users/vchun/Codes/My-projects/vcskill-kit/ariadnev-web/apps/docs/src/styles/docs.css:1)
- Docs shell: [apps/docs/src/components/docs-shell.tsx](/Users/vchun/Codes/My-projects/vcskill-kit/ariadnev-web/apps/docs/src/components/docs-shell.tsx:1)
- Marketing hero: [apps/site/src/components/hero-section.astro](/Users/vchun/Codes/My-projects/vcskill-kit/ariadnev-web/apps/site/src/components/hero-section.astro:1)
- W3C WCAG 2.2: https://www.w3.org/TR/WCAG22/
- WAI Understanding Reflow: https://www.w3.org/WAI/WCAG22/Understanding/reflow.html
- WAI What’s New in WCAG 2.2: https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/
- MDN `prefers-reduced-motion`: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/%40media/prefers-reduced-motion
- Vercel Web Interface Guidelines: https://vercel.com/design/guidelines
- Vercel Design / Geist: https://vercel.com/design and https://vercel.com/geist/stack
- Stripe app design docs: https://docs.stripe.com/stripe-apps/design and https://docs.stripe.com/stripe-apps/style
- Linear homepage: https://linear.app/homepage
- Linear docs: https://linear.app/docs

## Limitations

- I did not inspect every docs screen component individually; recommendation is based on shell architecture, shared prose components, CSS, and visual baselines.
- I did not benchmark current CSS/render cost; performance guidance here stays architectural, not measured.
- External references were used for pattern and standards calibration, not to prescribe visual imitation.

## Unresolved Questions

- Whether the existing logo green should remain the only visible green across the entire experience, or whether success-state green should be further muted so the mark stays unique.
- Whether docs mobile should keep a persistent top search control or demote search behind a compact utility trigger to recover first-viewport content space.

Status: DONE
Summary: Produced one implementation-aware visual reinvention direction for marketing + docs, tied to repo evidence, current baselines, and official accessibility/interface sources. Included palette logic, type/space system, macro compositions, docs density model, motion grammar, responsive strategy, anti-patterns, failure mode, and rollback seam.
Concerns/Blockers: None.
