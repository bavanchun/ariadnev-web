# P4 Slice B report — D02-D04 purposeful screen experiences

Date: 2026-08-17
Commit: `bdc90e1` (pushed to `origin/main`)

## Scope delivered

Replaced `PassThroughExperience` with real screen-experience components for
D02 (previous-home), D03 (installation), D04 (first-install), per
`plans/260816-2345-ariadnev-web-uiux-upgrade/phase-04-authored-docs-screen-experiences.md`
screen matrix.

### D02 — `apps/docs/src/components/screen-experiences/previous-home.tsx`

- `Callout` (boundary) with the exact previous/current version pair, derived
  from `catalog.previousStable`/`catalog.currentStable` (not hardcoded, never
  drifts from the validated version pair).
- `ResponsiveDataRegion` listing every other page published in the same
  version/locale (query against the catalog, historical titles preserved
  verbatim, omitted entirely when empty — no empty-group render).
- Explicit stable-return `<nav>` using `findDeclaredSibling(catalog, page,
  locale, catalog.stableAlias)`.

### D03 — `apps/docs/src/components/screen-experiences/installation.tsx`

- `Topology` diagram: resolve version → download binary+checksums → verify
  sha256 → macOS Gatekeeper decision (diamond node) → link `av` alias, with
  a second edge from verify straight to link for non-macOS platforms. Every
  node/edge is a generic structural label, not a restated command/URL — the
  Gatekeeper boundary is represented structurally instead of duplicating the
  MDX blockquote text.

### D04 — `apps/docs/src/components/screen-experiences/first-install.tsx`

- `Topology` diagram: `av install` → Interactive / Non-interactive (parallel
  pill nodes) → choose providers (diamond) → choose scope (diamond) →
  receipt written (pill).

All three: zero `dangerouslySetInnerHTML`, zero new `docs.css` rules (reuse
Slice A prose components + existing `.wd-*`/`.rdr-table` classes, matching the
frozen "unstyled-but-functional, visual polish deferred" decision recorded in
`docs.css` around Slice A). No MDX content file touched.

## Files created/modified

- Create: `apps/docs/src/components/screen-experiences/previous-home.tsx`
- Create: `apps/docs/src/components/screen-experiences/installation.tsx`
- Create: `apps/docs/src/components/screen-experiences/first-install.tsx`
- Modify: `apps/docs/src/components/docs-screen-registry.tsx` (wire the 3
  imports/renderers, replacing `PassThroughExperience` for D02-D04)
- Modify: `apps/docs/src/components/docs-screen-registry.ts` (comment update
  only — no metadata/behavior change; `REGISTERED_SCREEN_KINDS` unchanged)
- Add: `tests/docs/screen-experience-d02-d04.test.mjs` (22 tests)

## Tests

- `pnpm --filter @ariadnev-web/docs typecheck` — pass.
- `pnpm run test:docs` — 103/103 pass (81 pre-existing + 22 new).
- `pnpm run build` — clean; `grandfatheredRoutes: 0`, `perRouteChecked: 444`;
  no ratchet regression.

New test file asserts, per screen and per locale (EN+VI):
- D02: boundary-callout region + exact version pair; published-destinations
  table content matches a live catalog query (titles + hrefs); stable-return
  nav href; EN/VI localized text differs, structure identical.
- D03: topology SVG + legend `<ol>` + adjacency `<table>` all present;
  platform commands (`curl -fsSL …`, `irm … | iex`, `xattr -d
  com.apple.quarantine`) survive untouched in initial HTML (checked via a
  tag-stripped text extraction, because shiki syntax-highlighting splits
  each command into adjacent `<span>` tokens with no inserted whitespace —
  naive space-joining tag stripping corrupts URLs like `https://`, so the
  test strips tags to `""`, not `" "`); Gatekeeper diamond node present;
  EN/VI node counts equal.
- D04: topology node count ≥ 6; non-interactive commands and the doctor
  `2`/unhealthy exit-code table row survive untouched; provider-reference
  link unaffected; EN/VI node counts equal.
- One sanity test confirms all three screenKinds render content the MDX
  body alone does not carry (i.e., are genuinely no longer pass-through).

## Byte-budget impact (built HTML, uncompressed, per route)

| Route | Bytes (post-slice) |
|---|---|
| `/en/1.0.0/` (D02) | 41,548 |
| `/vi/1.0.0/` (D02) | 42,327 |
| `/en/stable/get-started/installation/` (D03) | 55,166 |
| `/vi/stable/get-started/installation/` (D03) | 56,077 |
| `/en/stable/get-started/first-install/` (D04) | 56,716 |
| `/vi/stable/get-started/first-install/` (D04) | 58,382 |

Per-route ratchet (`tests/benchmarks/docs-per-route-ratchet.json`,
`capUnderRatchet: 304000`) cap applies to full resource weight (HTML + JS +
CSS + fonts + images); the tightest-margin route
(`/en/stable/get-started/installation/`) measured 301,566 bytes total at
build time — ~2.4KB headroom remaining, `grandfatheredRoutes: 0`. No prior
per-route byte baseline was captured before this slice for a precise delta;
the build's own ratchet check (part of `pnpm run build`) is the source of
truth and passed clean with no route requiring grandfathering.

## Deviations / notes

- Directory used: `apps/docs/src/components/screen-experiences/` (existing
  convention already housing `docs-home.tsx`), not a new `components/screens/`
  directory — matches D01's actual location and the "check existing patterns
  first" instruction.
- D02's "stable return" affordance is additive to the existing
  `LocaleVersionSwitcher` (header `<details>` menu) — not a duplicate of it;
  it surfaces the same target as an always-visible in-content CTA rather than
  a collapsed menu, which the D02 completion-evidence row explicitly requires.
- Did not add a Callout restating the D03 Gatekeeper warning text (already
  present as an MDX blockquote) — representing it as the topology's diamond
  decision node instead, to avoid duplicating the exact command/URL facts per
  the phase-04 "do not duplicate command/provider/release facts" constraint.
- Did not add a next-action CTA link for D03→D04 or D04→(providers/skills) —
  `DocsPager` (page-level, pre-existing) already renders that as the sequence
  Next link; adding a second one would duplicate pager interaction (the exact
  risk phase-04 step 11 calls out).

Status: DONE
Summary: D02/D03/D04 shipped real screen experiences replacing PassThrough; 22 new tests, 103/103 docs tests green, typecheck clean, build clean with zero ratchet regression; committed and pushed to main.
Screens shipped: D02, D03, D04
Files created/modified: apps/docs/src/components/screen-experiences/{previous-home,installation,first-install}.tsx (new); apps/docs/src/components/docs-screen-registry.{ts,tsx} (modified); tests/docs/screen-experience-d02-d04.test.mjs (new)
Tests: typecheck pass; test:docs 103/103 pass; build clean (grandfatheredRoutes: 0)
Commit pushed: bdc90e1
Byte-budget impact: see table above; tightest-margin route (installation) at 301,566/304,000 bytes total resource weight, ~2.4KB headroom, no grandfathering needed
Next natural checkpoint: Slice C (D05-D07) unblocked
