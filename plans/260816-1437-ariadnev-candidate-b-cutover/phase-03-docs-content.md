# Phase 3 — Docs content pipeline + EN/VI content

**Depends on:** phase 2.
**Files:** `scripts/docs-content/build-content-root.mjs` (new), `apps/docs/content/authored/{en,vi}/**.mdx` (new), `apps/docs/content/generated/**` (gitignored build output), tests in `tests/docs/content-pipeline.test.mjs`.

## Requirements
- Input: the kit release docs bundle (`docs-bundle.tar.gz` + `docs-bundle.manifest.json` for one exact tag), verified with `packages/contracts` (verify-first atomic extractor) — never unverified content.
- Output: a content root the docs app already understands: `generated/catalog.json` (schema in `apps/docs/src/lib/content-catalog.ts`) + `generated/docs/{en,vi}/{version}/**.mdx`.
- Generated reference pages from the bundle: CLI commands (`reference/cli/commands.json`), providers (`providers.json`), skills catalog (`skills.json`, 103 entries, grouped by category), workflows (`workflows.json`), release notes (`release-notes.md`).
- Authored prose (EN + VI, same page ids, siblings linked): index, get-started/installation, get-started/first-install (providers + scope), concepts/kit-and-adapt-engine, guides/upgrading (`av update`), guides/uninstall-and-doctor, guides/migration-from-vcskill (source: kit `docs/migration-from-the-old-name.md`).
- `previousStable` from `reference/previous-stable/bootstrap.json`.
- Determinism: same bundle → byte-identical content root (test it).

## Steps
1. Read `packages/contracts` API and `content-catalog.ts` schema; write the generator.
2. Author EN pages first, then VI translations (same structure, translated headings, code blocks unchanged).
3. Wire `apps/docs` build to run the generator when `ARIADNEV_DOCS_BUNDLE=<path>` is set; `test:qualification` builds from a committed fixture bundle under `tests/docs/fixtures/`.
4. Commit(s): `feat(docs): generate the content root from the release docs bundle`, `docs(content): author the EN/VI ariadnev documentation`.

## Validation
- Build docs from the real `ariadnev@1.0.0` bundle locally; open `out/en/stable/index.html`, `out/vi/stable/reference/skills/index.html`.
- Search index contains VI terms; `static-discovery` test passes.
