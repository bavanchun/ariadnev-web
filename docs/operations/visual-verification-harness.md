# Visual verification harness

Phase 7 shipped a Playwright-based deterministic verification harness on top
of the pre-existing vitest/Node budget gates. This document is the operator
runbook: what the harness owns, how to run it, how to update baselines, and
what to do when it fails.

## What it owns

- **Screenshot baselines** — `tests/visual/__baselines__/` — Chromium-only,
  one image per manifest fixture per required width (320/768/1440; +375/1280
  where a fixture crosses a declared breakpoint).
- **Axe A/AA gates** — WCAG 2.0 + 2.1 A/AA on every non-404 fixture.
- **Cross-browser critical journeys** — Chromium + Firefox + WebKit; 5
  semantic assertions × 3 engines.
- **Accessibility-mode gates** — SC 1.4.10 reflow at 400% and 200% zoom, SC
  1.4.12 text spacing overrides, forced-colors emulation, print media, and a
  390px overflow/visible-focus probe across every fixture.
- **Task-outcome gates** — 8 plan-critical task journeys, a local CLI-filter
  shortcut gate, and one marketing bonus.
- **No-JS browser gate** — `pnpm run test:docs:browser` covers shell layout,
  search, EN/VI switching, copy fallbacks, axe, and the JS-disabled locale path.
- **Lighthouse runner** — on-demand on M01, D01-vi, D06, D12, D14, and D18;
  not in `test:qualification`.

The four independent performance groups from Phase 1 stay gated by the
vitest and Node suites (`tests/site/performance-budget.test.ts`,
`tests/docs/docs-per-route-ratchet.test.mjs`) — the visual harness does not
duplicate them.

## Fixture manifest

`tests/benchmarks/screen-fixtures.json` is the single source of truth for
every route the harness verifies. Gated by
`tests/docs/screen-fixture-manifest.test.mjs` (schema + required IDs) and
`tests/docs/screen-fixture-structural-probes.test.mjs` (built HTML
identity). Adding a screen means adding one manifest entry; the parameterized
screen, axe, and 390px probes consume it automatically.

## Running the harness

Prerequisites (one-time):

```bash
pnpm install
pnpm exec playwright install chromium firefox webkit
```

Full visual gate (Chromium screenshots + axe + accessibility modes + task
outcomes + cross-browser journeys):

```bash
pnpm run build            # required — the harness runs against built output
pnpm run test:visual
```

The full qualification command also runs the no-JS browser gate after the
clean production build and before the visual suite:

```bash
pnpm run test:qualification
```

Individual slices during development:

```bash
pnpm exec playwright test --project=chromium tests/visual/site/
pnpm exec playwright test --project=chromium tests/visual/docs/
pnpm exec playwright test tests/visual/journeys/
```

## Updating baselines

Baselines rotate only when the design intentionally changed. Rejected
blanket regeneration: every rotation must be explained in the commit
message (which macro or component changed, and why the new pixels are the
intent).

Start with the owning spec and fixture IDs, inspect the exact image diff, and
only then run the complete visual suite unchanged:

```bash
pnpm run build
pnpm exec playwright test tests/visual/docs/docs-screens.spec.ts \
  --project=chromium --grep 'D1[2-7]' --update-snapshots=all
git diff --stat tests/visual/__baselines__/
pnpm run test:visual
```

`pnpm run test:visual:update` remains an emergency full-regeneration utility;
it is not the first acceptance step.

## Lighthouse (on-demand)

Lighthouse takes ~30s per page and depends on host CPU load, so it lives
outside `test:qualification`. Run it before shipping a design change or on a
CI schedule:

```bash
pnpm run build
node tests/visual/lib/serve.mjs &     # background the static server
pnpm run test:visual:lighthouse       # exits non-zero if accessibility < 95
kill %1                               # stop the server
```

## Environment pinning

Screenshots depend on font metrics and rasterization backend. Baselines
were seeded on:

- OS: darwin arm64 (macOS 26.x)
- Playwright: 1.62.1
- Chromium: playwright chromium 1234
- Firefox: playwright firefox 1538
- WebKit: playwright webkit 2336

CI must pin the same Playwright version (already locked in `package.json`)
and use `playwright install --with-deps chromium firefox webkit` before the
gate. Baselines seeded on Linux CI may drift from macOS dev; the diff is
small (usually 1–2 pixels on font hinting) and within the configured
threshold (0.15 / 2% max diff pixel ratio).

## Troubleshooting

- **Baseline diff on a route you did not change** — first suspect a font
  install or a Chromium version bump. Re-seed on the same environment and
  compare. Do not regenerate baselines to "make it pass".
- **`EADDRINUSE 4331` / `4332`** — a previous `node tests/visual/lib/serve.mjs`
  is still running. `lsof -i :4331 -i :4332` to identify, then stop the
  owner PID. Never randomize the port.
- **Axe reports a violation** — the violation is real. Fix it, or if it is
  a false positive, document a per-rule suppression with evidence, rationale,
  owner, and expiry.
- **Firefox/WebKit binary missing** — `pnpm exec playwright install
  firefox webkit`. The projects list them but their binaries are host-cached,
  not vendored.
- **React error #418 in the console during accessibility-modes** — expected
  Fumadocs hydration warning when emulateMedia flips before hydration;
  filtered in the collector. The DOM assertions catch real regressions.

## Ports

| Surface | Port | Origin                    |
| ------- | ---- | ------------------------- |
| site    | 4331 | http://127.0.0.1:4331     |
| docs    | 4332 | http://127.0.0.1:4332     |

Ports are defined in `tests/visual/lib/servers.mjs` — one file, one line
per surface, so a collision is a single-line edit.

## What Phase 7 did not ship

- **Baseline rebuild on Linux CI** — baselines are macOS-seeded; CI must
  either accept the current tolerance or re-seed on Linux and commit those.
- **`test:qualification` shard parallelism** — the visual step runs after
  the vitest/Node steps sequentially. Sharding is a plumbing change owned
  by CI infrastructure.
- **Two-run flake detection** — run `pnpm run test:visual` twice manually
  to prove stability; not automated in the gate.
