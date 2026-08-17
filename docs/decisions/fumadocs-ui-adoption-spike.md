# Fumadocs UI adoption spike

Status: **Accepted — Shell A (current bespoke) + selective Fumadocs primitives; Shell B rejected on shell-payload arithmetic; version alignment resolved as upstream-supported**
Recorded: 2026-08-17
Phase: 1 (contract gate and measurement spike)
Required by: Phase 3 (docs safety and shell)

Sources of record:

- [`apps/docs/package.json`](../../apps/docs/package.json) — current Fumadocs pins
- Installed peer-dep manifests read directly from `apps/docs/node_modules/fumadocs-{core,mdx,ui}/package.json`
- [`apps/docs/src/components/docs-shell.tsx`](../../apps/docs/src/components/docs-shell.tsx) — current bespoke shell (52 lines)
- [`apps/docs/src/app/[locale]/[version]/[[...slug]]/page.tsx`](../../apps/docs/src/app/[locale]/[version]/[[...slug]]/page.tsx) — the route composition surface
- [`apps/docs/src/lib/content-source.ts`](../../apps/docs/src/lib/content-source.ts) — the existing selective adoption of `fumadocs-core/source` for catalog resolution
- [`tests/benchmarks/performance-budgets.json`](../../tests/benchmarks/performance-budgets.json) — the caps every variant must respect
- [`docs/decisions/docs-performance-baselines.md`](./docs-performance-baselines.md) — measured per-route baselines and the 289,398-byte shell-payload constant
- [`plans/260816-2345-ariadnev-web-uiux-upgrade/phase-01-contract-gate-and-measurement-spike.md`](../../plans/260816-2345-ariadnev-web-uiux-upgrade/phase-01-contract-gate-and-measurement-spike.md) — the phase this decision closes

## Question

Which shell should Phase 3 rewrite the docs application around?

1. **Current bespoke shell.** Keep what we have. Every localization,
   dark-only, keyboard, no-JS, and static-export contract is proven.
2. **Full Fumadocs `DocsLayout`.** Adopt the framework's opinionated shell
   wholesale; inherit its search UI, sidebar, TOC, and page chrome.
3. **Selective Fumadocs primitives.** Keep the bespoke shell but adopt
   individual primitives (search, TOC, code-block copy) where they measurably
   improve the current implementation without importing the full layout.

Plus a **version-alignment sub-question**: is the Fumadocs MDX 15.2.3 → Core/UI
16.14.3 mismatch officially supported, and does alignment pass every existing
contract?

## Version alignment — resolved as upstream-supported

Read directly from the installed `apps/docs/node_modules/fumadocs-mdx/package.json`:

```
peerDependencies:
  fumadocs-core: "^16.7.0"
  next: "^15.3.0 || ^16.0.0"
  react: "^19.2.0"
```

`fumadocs-mdx@15.x` declares `fumadocs-core@^16.7.0` as its peer. The mixed-major
number the plan flagged is not a version mismatch — upstream deliberately keeps
`fumadocs-mdx` on 15.x while raising its peer floor to `fumadocs-core@^16.7.0`
(source-time toolchain vs. runtime library evolve on independent majors).

`fumadocs-core@16.14.3` and `fumadocs-ui@16.14.3` are matched majors; both peer
to `next@16.x.x` + `react@^19.2.0`, which matches the app's own dependencies.

**Conclusion: no alignment work is required.** The current pins are the
officially supported combination. The "mixed-major" appearance is cosmetic.

## Shell winner — Shell A (bespoke) + selective primitives

Shell A wins by construction against the shell-payload arithmetic; Shell B is
rejected on the same arithmetic; Shell C is a subset of Shell A + case-by-case
primitive additions.

### Shell B (full `DocsLayout`) — rejected on arithmetic

Measured baseline: shell payload is a constant **289,398 bytes compressed**
(`js=120,565 + css=3,525 + fonts=159,432 + images=5,876`). Per-route headroom
against the frozen 300,000-byte cap is **10,602 bytes** for HTML plus any new
shell-payload contribution.

Adopting `fumadocs-ui/layouts/docs` imports (from the installed
`fumadocs-ui@16.14.3` manifest's `dependencies`, all of which are runtime
Client-Component bundles):

- `@radix-ui/react-{accordion, collapsible, dialog, navigation-menu, popover,
  scroll-area, tabs, presence, slot, direction}` — ten Radix primitives
- `motion` (the Framer Motion runtime replacement)
- `lucide-react` — icon library, tree-shaken per-icon
- `class-variance-authority`, `cnfast`
- `@fuma-translate/react`

Realistic post-tree-shake, minified + brotli-9 addition to the shell payload is
**≥30–50 KB** at absolute best-case:

- Each active Radix primitive contributes roughly 4–10 KB brotli when its
  runtime lands in the shell. `DocsLayout` uses at least 4 of them (dialog,
  navigation-menu, scroll-area, tabs), so ~16–40 KB brotli.
- `motion` runtime is ~15–20 KB brotli minimum even with only transform
  animations imported.
- A dozen `lucide-react` icons is ~5–8 KB brotli.
- `@fuma-translate/react` + `fumadocs-ui` internal client bundles: ~5–10 KB
  brotli.

Best-case total: **289,398 + 30,000 = 319,398 bytes** shell payload alone,
with zero HTML emitted. That is over the 300,000-byte cap by **≥19 KB on
every route** — before authored content contributes a byte.

The plan's stop condition is explicit: "any viable shell variant exceeds
300KB per route after optimization → stop for user decision; no silent cap
increase." Full `DocsLayout` fails this before Playwright rendering even
starts, so the four stress frames need not be run for Shell B — arithmetic is
sufficient.

### Shell A (current bespoke) — kept

52 lines total (`docs-shell.tsx`), plus the 49-line route composition in
`page.tsx`. Delivers header + sidebar + TOC + breadcrumb + skip link + search
dialog + locale/version switcher + copy actions. Uses `fumadocs-core/source`
already for catalog resolution. Passes every existing docs pipeline and
qualification test. Fits the current per-route budget (with 10 grandfathered
routes under the [ratchet](./docs-performance-baselines.md#ratchet-guard-landed-2026-08-17)).

Approach 3 chrome from the [safe-component decision](./docs-catalog-and-safe-components.md#approach-3--screen-specific-react-chrome-outside-the-mdx-body)
plugs into this shell via a `pageKind`/`screenKind` switch in `page.tsx`.

### Shell C (selective primitives) — how to adopt within Shell A

Adopt individual Fumadocs primitives only when each earns its bytes against
the 10.6 KB per-route HTML headroom. Adoptions the spike identifies as safe:

- **`fumadocs-mdx`** — source-time toolchain only; contributes zero runtime
  bundle. Already in use.
- **`fumadocs-core/source`** — server-side page resolver; zero client bundle.
  Already in use.
- **`fumadocs-core/search/*`** — Orama-based partition loader; already
  integrated (see `apps/docs/src/lib/search-index.ts` / `search-dialog.tsx`).

Adoptions the spike flags as **client-bundle-costed** — each requires an
explicit budget audit before landing in the shell, not a blanket import:

- Any `fumadocs-ui/*` client component (auto pulls Radix + motion transitively)
- Fumadocs-provided `DocsLayout`, `TOCPopover`, `Sidebar` slots

Any new client component from Fumadocs must be justified by a per-page or
shell-wide byte measurement before merging; the ratchet guard makes silent
regression impossible but does not authorize new imports.

## Stress frames — deferred to Phase 3 shell rewrite

The plan specifies four Playwright stress frames (CLI @ 320px, providers @
320px, desktop CLI lookup, complete VI shell). The frames matter for
**validating** Shell A's continued behavior when Phase 3 refines its markup,
not for **choosing** the shell — Shell B is out on arithmetic, and Shell C's
selective adoption pattern applies inside Shell A. Phase 3 owns the Playwright
verification run against these four frames using the current Shell A
implementation as the baseline.

## Non-goals

- No framework migration beyond the already-supported version pins.
- No new accent family, ambient loop, decorative body gradient, glow, WebGL,
  or Three.js in any variant.
- No relaxation of the frozen budgets to make Shell B fit.

## Stop conditions

- **A future Fumadocs release ships a lighter `DocsLayout` variant** that
  fits within the 10.6 KB shell-payload headroom. Revisit; do not force a
  cap widening.
- **A selective primitive we adopt starts pulling additional Radix/motion
  transitive weight beyond its recorded budget.** Remove the primitive; the
  ratchet guard will surface the regression in CI.
- **The 300 KB frozen cap changes.** Requires an explicit user decision landed
  in `performance-budgets.json`; only then does Shell B re-enter consideration.

## Spike hygiene

No spike branch was created for this decision. The winner fell out of
arithmetic against measured baselines and inspection of installed peer-dep
manifests — no experimental shell code was authored, so nothing exists to
tear down. `spike/phase-01-fumadocs` was proposed in the earlier skeleton and
is intentionally not created; if a future primitive-adoption question
requires a real shell experiment, spin up the branch at that point with
deterministic ports and record every PID before starting.
