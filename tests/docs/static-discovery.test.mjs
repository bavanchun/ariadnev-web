import assert from "node:assert/strict";
import { appendFile, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { catalogFixture, temporaryContent } from "./contract-fixture.mjs";
import { enumerateDocsRoutes, parseDocsContentCatalog } from "../../apps/docs/src/lib/content-catalog.ts";
import { exportStaticDiscovery, LLMS_FULL_MAX_BYTES, publicMarkdown } from "../../apps/docs/src/lib/static-discovery.ts";
import { publicMarkdownLinks } from "../../apps/docs/src/lib/public-markdown.ts";

test("discovery export writes deterministic physical Markdown and bounded LLM files", async () => {
  const fixture = await temporaryContent();
  const first = await mkdtemp(join(tmpdir(), "ariadnev-discovery-a-"));
  const second = await mkdtemp(join(tmpdir(), "ariadnev-discovery-b-"));
  try {
    const catalog = parseDocsContentCatalog(catalogFixture());
    await appendFile(join(fixture.root, catalog.pages[0].sourcePath), "\n[Open Vietnamese](../../vi/stable/)\n", "utf8");
    for (const outRoot of [first, second]) for (const route of enumerateDocsRoutes(catalog)) {
      const directory = join(outRoot, route.locale, route.version, ...route.slug);
      await mkdir(directory, { recursive: true });
      await writeFile(join(directory, "index.html"), "<!doctype html><title>fixture</title>\n", "utf8");
    }
    const left = await exportStaticDiscovery(catalog, fixture.root, first);
    const right = await exportStaticDiscovery(catalog, fixture.root, second);
    assert.deepEqual(left, right);
    for (const url of left) assert.equal((await readFile(join(first, url.slice(1)))).compare(await readFile(join(second, url.slice(1)))), 0);
    const stableMarkdown = await readFile(join(first, "en/stable.md"), "utf8");
    assert.match(stableMarkdown, /^# English current\n/);
    assert.equal((stableMarkdown.match(/^#\s+/gm) ?? []).length, 1);
    assert.match(stableMarkdown, /overview-only/);
    assert.match(await readFile(join(first, "en/stable/get-started/installation.md"), "utf8"), /installation-only/);
    const llms = await readFile(join(first, "llms.txt"), "utf8");
    assert.match(llms, /\/en\/stable\.md/);
    assert.match(llms, /\/vi\/1\.1\.0\.md/);
    assert.ok((await stat(join(first, "llms-full.txt"))).size <= LLMS_FULL_MAX_BYTES);
  } finally {
    await Promise.all([fixture.root, first, second].map((path) => rm(path, { recursive: true, force: true })));
  }
});

test("retired CLI routes keep their static Markdown route but never join llms.txt/llms-full.txt", async () => {
  const base = catalogFixture();
  const locale = "en";
  const version = base.currentStable;
  const retiredPage = {
    id: `${locale}/${version}/reference/cli/old-doctor`,
    canonicalId: `${locale}/${version}/reference/cli/old-doctor`,
    locale,
    version,
    slug: ["reference", "cli", "old-doctor"],
    sourcePath: `generated/docs/${locale}/${version}/reference/cli/old-doctor.mdx`,
    title: "Retired: old-doctor",
    description: "This CLI URL has moved. The command still exists under a new slug.",
    siblings: [],
    pageKind: "command",
    screenKind: "D13-cli-command-retired",
    section: "reference",
    navigationVisibility: "reference-only",
  };
  const catalog = parseDocsContentCatalog({ ...base, pages: [...base.pages, retiredPage] });
  const fixture = await temporaryContent(catalog);
  await writeFile(
    join(fixture.root, retiredPage.sourcePath),
    `---\ntitle: ${retiredPage.title}\ndescription: ${retiredPage.description}\n---\n\n## Retired\n\nSee the current command.\n`,
    "utf8",
  );
  const outRoot = await mkdtemp(join(tmpdir(), "ariadnev-discovery-retired-"));
  try {
    for (const route of enumerateDocsRoutes(catalog)) {
      const directory = join(outRoot, route.locale, route.version, ...route.slug);
      await mkdir(directory, { recursive: true });
      await writeFile(join(directory, "index.html"), "<!doctype html><title>fixture</title>\n", "utf8");
    }
    const written = await exportStaticDiscovery(catalog, fixture.root, outRoot);
    assert.ok(written.includes("/en/stable/reference/cli/old-doctor.md"), "retired route keeps its static Markdown export for URL compatibility");
    const llms = await readFile(join(outRoot, "llms.txt"), "utf8");
    assert.doesNotMatch(llms, /old-doctor/, "llms.txt must not list a retired CLI route");
    const llmsFull = await readFile(join(outRoot, "llms-full.txt"), "utf8");
    assert.doesNotMatch(llmsFull, /old-doctor/, "llms-full.txt must not list a retired CLI route");
  } finally {
    await Promise.all([fixture.root, outRoot].map((path) => rm(path, { recursive: true, force: true })));
  }
});

test("public Markdown rejects executable MDX", () => {
  assert.match(publicMarkdown("## Example\n\n```json\n{\"safe\": true}\n```\n"), /\{"safe": true\}/);
  for (const source of [
    "import Secret from './secret'\n\n## Heading\n",
    "# Duplicate shell heading\n",
    "> # Nested shell heading\n",
    "- # Listed shell heading\n",
    "> - # Deeply nested shell heading\n",
    "Duplicate shell heading\n=======================\n",
    "## Heading\n\n<a href=\"/private\">raw link</a>\n",
    "## Heading\n\n![dimensionless](/image.png)\n",
    "## Heading\n\n[reference][target]\n\n[target]: /private\n",
    "## Heading\n\n<https://example.com>\n",
  ]) assert.throws(() => publicMarkdown(source), /safe public Markdown/i);
});

test("public Markdown allowlists link schemes and extracts safe destinations from the syntax tree", () => {
  const safe = "## Links\n\n[local](../guide/) [web](https://example.com/docs) [email](mailto:docs@example.com) [phone](tel:+84123456789)\n";
  assert.deepEqual(publicMarkdownLinks(safe), ["../guide/", "https://example.com/docs", "mailto:docs@example.com", "tel:+84123456789"]);
  for (const href of [
    "file:///etc/passwd",
    "ftp://example.com/archive",
    "blob:https://example.com/id",
    "javascript:alert(1)",
    "data:text/plain,secret",
    "//example.com/ambiguous",
    "C:\\private\\notes.txt",
  ]) assert.throws(() => publicMarkdown(`## Link\n\n[unsafe](${href})\n`), /safe public Markdown/i, href);
});
