# Phase 1 — Rebrand `apps/site` to ariadnev

**Files:** `apps/site/**`, `tests/site/**`, `releases/*.json` fixture (if present), `apps/site/wrangler.toml`.
**Do not touch:** `landing.html`, `worker.js`, `wrangler.toml` (root), `landing-consistency.test.mjs`.

## Requirements
- Every identity fact in `apps/site/src/data/marketing-facts.ts` says ariadnev: name, title, tagline, `origin=https://ariadnev.com`, `docsOrigin=https://docs.ariadnev.com`, install commands (`curl -fsSL https://ariadnev.com/install | bash`, `irm https://ariadnev.com/install.ps1 | iex`), `~/.ariadnev`, `av` alias.
- Claims describe ariadnev 1.0.0 as shipped (installer, 103 skills, 6 providers, doctor/update/uninstall, receipt) — source: kit README + release docs bundle. Drop or rewrite copy about the old graph executor unless the bundle proves it (`reference/workflows/*.json` exists → keep the three workflows as "workflows", nothing about runs on disk).
- Repository/licence links removed or pointed at a public surface (repos are private).
- `astro.config.mjs` `site`, `public/site.webmanifest`, `og:*`, `404.astro`, `sitemap.xml`, `robots.txt`, `_headers` all on the new hosts.
- `tests/site/*` updated to assert the new facts; `release-pin.test.ts` pins `ariadnev@1.0.0`.

## Steps
1. Read `marketing-facts.ts`, every component, `tests/site/*`, `tests/contracts/public-edge-contracts.json` (site parts only).
2. Rewrite facts; keep the "no mutable inventory counts" rule from the file header (counts come from the release bundle at build time, or are omitted).
3. `pnpm --filter @vcskill-web/site build && pnpm exec vitest run tests/site`.
4. Commit: `feat(site): rebrand the marketing site to ariadnev`.

## Validation
- `grep -rIn vcskill apps/site tests/site` → only the workspace package scope `@vcskill-web/*` (renamed in phase 4) or nothing.
- Built `dist/index.html` contains `ariadnev.com/install`, no `vchun.dev`.
