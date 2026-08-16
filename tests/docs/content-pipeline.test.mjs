import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, readdir, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { buildContentRoot, loadAuthoredPages, parseArguments, parseFrontmatter } from "../../scripts/docs-content/build-content-root.mjs";
import { code, escapeMarkdownProse, escapeMdx, renderReleaseNotes, renderSkillCatalog } from "../../scripts/docs-content/render-reference-pages.mjs";
import {
  parseDocsContentCatalog,
  resolveNavigationVisibility,
  sidebarPages,
} from "../../apps/docs/src/lib/content-catalog.ts";
import { publicMarkdown } from "../../apps/docs/src/lib/public-markdown.ts";

const repositoryRoot = resolve(import.meta.dirname, "../..");

async function tree(dir, base = dir, acc = new Map()) {
  for (const entry of (await readdir(dir, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) await tree(abs, base, acc);
    else acc.set(abs.slice(base.length + 1), await readFile(abs));
  }
  return acc;
}

test("the content root builds from the pinned release and every page is safe public Markdown", async () => {
  const out = await mkdtemp(join(tmpdir(), "ariadnev-content-"));
  try {
    const result = buildContentRoot(parseArguments(["--out", out, "--authored", "apps/docs/content/authored"]));
    const catalog = parseDocsContentCatalog(JSON.parse(await readFile(join(out, "generated/catalog.json"), "utf8")));
    assert.equal(catalog.currentStable, result.catalog.currentStable);
    assert.notEqual(catalog.previousStable, catalog.currentStable);
    for (const page of catalog.pages) {
      const source = await readFile(join(out, page.sourcePath), "utf8");
      const meta = parseFrontmatter(source, page.id);
      assert.equal(meta.title, page.title);
      assert.equal(meta.description, page.description);
      assert.doesNotThrow(() => publicMarkdown(source), `${page.id} is not safe public Markdown`);
      assert.ok(!source.includes("%ROOT%"), `${page.id} still carries an unexpanded %ROOT%`);
      // Every locale × version sibling of a page shares its canonical id.
      for (const sibling of page.siblings) {
        const target = catalog.pages.find((candidate) => candidate.id === sibling.pageId);
        assert.equal(target?.canonicalId, page.canonicalId);
      }
    }
    // Both locales carry the same authored page set at the current version.
    const ids = (locale) => catalog.pages.filter((page) => page.locale === locale && page.version === catalog.currentStable).map((page) => page.canonicalId).sort();
    assert.deepEqual(ids("en"), ids("vi"));
    // Generated reference pages exist in both editions where the projection provides them.
    for (const locale of ["en", "vi"]) {
      for (const canonicalId of ["reference/cli", "reference/providers", "reference/skills", "reference/workflows", "release-notes", "core/index"]) {
        assert.ok(catalog.pages.some((page) => page.locale === locale && page.version === catalog.currentStable && page.canonicalId === canonicalId), `${locale} ${canonicalId}`);
      }
      assert.ok(catalog.pages.some((page) => page.locale === locale && page.version === catalog.previousStable && page.canonicalId === "core/index"));
    }
  } finally {
    await rm(out, { recursive: true, force: true });
  }
});

test("the same inputs produce a byte-identical content root", async () => {
  const first = await mkdtemp(join(tmpdir(), "ariadnev-content-a-"));
  const second = await mkdtemp(join(tmpdir(), "ariadnev-content-b-"));
  try {
    buildContentRoot(parseArguments(["--out", first, "--authored", "apps/docs/content/authored"]));
    buildContentRoot(parseArguments(["--out", second, "--authored", "apps/docs/content/authored"]));
    const left = await tree(join(first, "generated"));
    const right = await tree(join(second, "generated"));
    assert.deepEqual([...left.keys()], [...right.keys()]);
    for (const [path, bytes] of left) assert.ok(bytes.equals(right.get(path)), `${path} differs between builds`);
  } finally {
    await rm(first, { recursive: true, force: true });
    await rm(second, { recursive: true, force: true });
  }
});

test("an authored page missing in one locale fails the build instead of shipping a hole", async () => {
  const authored = await mkdtemp(join(tmpdir(), "ariadnev-authored-"));
  try {
    await cp(resolve(repositoryRoot, "apps/docs/content/authored"), authored, { recursive: true });
    await mkdir(join(authored, "en/guides"), { recursive: true });
    await writeFile(join(authored, "en/guides/only-english.mdx"), "---\ntitle: \"Only English\"\ndescription: \"No sibling.\"\n---\n\n## Body\n", "utf8");
    assert.throws(() => loadAuthoredPages(authored), /both locales/);
  } finally {
    await rm(authored, { recursive: true, force: true });
  }
});

test("an authored body with an H1 is rejected because the title is the H1", () => {
  assert.throws(() => parseFrontmatter("---\ntitle: \"T\"\ndescription: \"D\"\n---\n\n# Not allowed\n", "x"), /must not contain an H1/);
});

test("bundle text is escaped so it cannot become MDX syntax", () => {
  assert.equal(escapeMdx("use <Tag> and {expr} or [x]"), "use \\<Tag\\> and \\{expr\\} or \\[x\\]");
  assert.equal(code("a `tick` b"), "``a `tick` b``");
  const page = renderSkillCatalog("en", [
    { name: "av:one", category: "cat", description: "Has <jsx/> and {curly}", argumentHint: "[x]" },
    { name: "two", category: "cat", description: "plain" },
  ]);
  assert.match(page, /### `av:one`/);
  assert.match(page, /### `av:two`/);
  assert.doesNotThrow(() => publicMarkdown(page));
});

// -------------------------------------------------- catalog metadata (P1)

// Minimal well-formed catalog for the metadata tests. Keeps the fixture close
// to the current build output so a legacy entry proves backward compatibility
// AND a new entry proves the Living Execution Atlas fields round-trip.
function metadataFixture(pages) {
  return {
    schemaVersion: 1,
    sourceRelease: {
      mode: "final",
      version: "1.1.0",
      releaseTag: "ariadnev@1.1.0",
      sourceSha: "f".repeat(40),
      generatorSha: "f".repeat(40),
      schemaDigest: `sha256:${"a".repeat(64)}`,
    },
    locales: ["en", "vi"],
    currentStable: "1.1.0",
    previousStable: "1.0.0",
    stableAlias: "stable",
    pages,
  };
}

function fixturePage(overrides) {
  return {
    id: overrides.id,
    canonicalId: overrides.canonicalId ?? overrides.id,
    locale: overrides.locale ?? "en",
    version: overrides.version ?? "1.1.0",
    slug: overrides.slug ?? [],
    sourcePath: overrides.sourcePath ?? `generated/docs/${overrides.locale ?? "en"}/${overrides.version ?? "1.1.0"}/${overrides.id}.mdx`,
    title: overrides.title ?? "Fixture page",
    description: overrides.description ?? "A page used to exercise catalog behavior.",
    siblings: overrides.siblings ?? [],
    ...(overrides.pageKind !== undefined ? { pageKind: overrides.pageKind } : {}),
    ...(overrides.screenKind !== undefined ? { screenKind: overrides.screenKind } : {}),
    ...(overrides.section !== undefined ? { section: overrides.section } : {}),
    ...(overrides.navigationVisibility !== undefined ? { navigationVisibility: overrides.navigationVisibility } : {}),
  };
}

test("legacy catalog entries without Living Atlas metadata still parse", () => {
  // Both locales × both versions need a root page; four legacy entries with
  // no pageKind/screenKind/section/navigationVisibility must parse cleanly
  // and resolve to the global-sidebar default. This proves the rollout is
  // additive: existing catalogs do not need to change to keep working.
  const catalog = parseDocsContentCatalog(metadataFixture([
    fixturePage({ id: "en-current-index", locale: "en", version: "1.1.0" }),
    fixturePage({ id: "vi-current-index", locale: "vi", version: "1.1.0" }),
    fixturePage({ id: "en-previous-index", locale: "en", version: "1.0.0" }),
    fixturePage({ id: "vi-previous-index", locale: "vi", version: "1.0.0" }),
  ]));
  for (const page of catalog.pages) {
    assert.equal(page.pageKind, undefined);
    assert.equal(page.screenKind, undefined);
    assert.equal(page.section, undefined);
    assert.equal(page.navigationVisibility, undefined);
    assert.equal(resolveNavigationVisibility(page), "global-sidebar");
  }
});

test("catalog entries with Living Atlas metadata round-trip and filter correctly", () => {
  const catalog = parseDocsContentCatalog(metadataFixture([
    // A reference-only page (like a future /reference/cli/<slug>/) plus the
    // required roots. The sidebar filter must drop the reference-only page
    // but keep the root, and the metadata fields must survive parse+freeze.
    fixturePage({
      id: "en-current-index",
      locale: "en",
      version: "1.1.0",
      pageKind: "home",
      screenKind: "D03-current-docs-home",
      section: "get-started",
      navigationVisibility: "global-sidebar",
    }),
    fixturePage({
      id: "en-current-cli-detail-adapters",
      canonicalId: "reference/cli/adapters",
      locale: "en",
      version: "1.1.0",
      slug: ["reference", "cli", "adapters"],
      pageKind: "command",
      screenKind: "D13-cli-command-detail",
      section: "reference",
      navigationVisibility: "reference-only",
    }),
    fixturePage({ id: "vi-current-index", locale: "vi", version: "1.1.0" }),
    fixturePage({ id: "en-previous-index", locale: "en", version: "1.0.0" }),
    fixturePage({ id: "vi-previous-index", locale: "vi", version: "1.0.0" }),
  ]));
  const home = catalog.pages.find((page) => page.id === "en-current-index");
  const cliDetail = catalog.pages.find((page) => page.id === "en-current-cli-detail-adapters");
  assert.equal(home.pageKind, "home");
  assert.equal(home.screenKind, "D03-current-docs-home");
  assert.equal(home.section, "get-started");
  assert.equal(home.navigationVisibility, "global-sidebar");
  assert.equal(cliDetail.navigationVisibility, "reference-only");
  assert.equal(resolveNavigationVisibility(cliDetail), "reference-only");
  const sidebar = sidebarPages(catalog, "en", "1.1.0");
  assert.equal(sidebar.length, 1, "reference-only pages must not enter the global sidebar");
  assert.equal(sidebar[0].id, "en-current-index");
  const sidebarStableAlias = sidebarPages(catalog, "en", "stable");
  assert.equal(sidebarStableAlias.length, 1, "stable alias resolves to the current version's sidebar");
});

test("catalog rejects an unknown pageKind value", () => {
  assert.throws(
    () => parseDocsContentCatalog(metadataFixture([
      fixturePage({ id: "en-current-index", pageKind: "misc" }),
      fixturePage({ id: "vi-current-index", locale: "vi" }),
      fixturePage({ id: "en-previous-index", locale: "en", version: "1.0.0" }),
      fixturePage({ id: "vi-previous-index", locale: "vi", version: "1.0.0" }),
    ])),
    /invalid/i,
  );
});

test("release-notes prose is escaped but code spans and fences are left literal", () => {
  const notes = "# 1.0.0\n\nAssets are `ariadnev-{os}-{arch}` and <b> is {c}.\n\n```bash\n# comment {x} <y>\nav install\n```\n";
  const escaped = escapeMarkdownProse(notes);
  assert.match(escaped, /^## 1\.0\.0$/m);
  assert.match(escaped, /`ariadnev-\{os\}-\{arch\}`/);
  assert.match(escaped, /\\<b> is \\\{c\\\}\./);
  assert.match(escaped, /```bash\n# comment \{x\} <y>\nav install\n```/);
  const page = renderReleaseNotes("en", notes);
  assert.doesNotThrow(() => publicMarkdown(page));
  assert.ok(!page.includes("\\{os\\}"), "braces inside a code span must not be escaped");
  assert.equal(code("--format <json|text>"), "`--format <json\\|text>`");
});
