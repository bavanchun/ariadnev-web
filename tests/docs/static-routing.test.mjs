import assert from "node:assert/strict";
import { mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { catalogFixture, temporaryContent } from "./contract-fixture.mjs";
import { enumerateDocsRoutes, findCatalogPage, loadDocsContentCatalog, parseDocsContentCatalog } from "../../apps/docs/src/lib/content-catalog.ts";

test("catalog expands exact EN/VI stable/current/previous static routes", () => {
  const catalog = parseDocsContentCatalog(catalogFixture());
  assert.deepEqual(enumerateDocsRoutes(catalog).map(({ locale, version, slug }) => `${locale}/${version}/${slug.join("/")}`), [
    "en/1.1.0/", "en/1.1.0/get-started/installation", "en/1.2.3/", "en/1.2.3/get-started/installation",
    "en/stable/", "en/stable/get-started/installation", "vi/1.1.0/", "vi/1.1.0/get-started/installation",
    "vi/1.2.3/", "vi/1.2.3/get-started/installation", "vi/stable/", "vi/stable/get-started/installation",
  ]);
  assert.equal(findCatalogPage(catalog, "en", "stable", [])?.version, "1.2.3");
  assert.equal(findCatalogPage(catalog, "fr", "stable", []), undefined);
  assert.equal(findCatalogPage(catalog, "en", "0.9.0", []), undefined);
});

test("catalog rejects aliases, duplicates, unsafe paths, and undeclared siblings", () => {
  const missingPrevious = structuredClone(catalogFixture());
  missingPrevious.previousStable = missingPrevious.currentStable;
  assert.throws(() => parseDocsContentCatalog(missingPrevious), /distinct previous/i);

  const futurePrevious = structuredClone(catalogFixture());
  futurePrevious.previousStable = "2.0.0";
  assert.throws(() => parseDocsContentCatalog(futurePrevious), /must precede current stable/i);

  const duplicate = structuredClone(catalogFixture());
  duplicate.pages.push(structuredClone(duplicate.pages[0]));
  assert.throws(() => parseDocsContentCatalog(duplicate), /collide/i);

  const traversal = structuredClone(catalogFixture());
  traversal.pages[0].sourcePath = "../private.mdx";
  assert.throws(() => parseDocsContentCatalog(traversal), /safe path|normalized relative/i);

  const fallback = structuredClone(catalogFixture());
  fallback.pages[0].siblings[0].pageId = fallback.pages[1].id;
  assert.throws(() => parseDocsContentCatalog(fallback), /exact sibling/i);

  const wrongPartition = structuredClone(catalogFixture());
  wrongPartition.pages[0].sourcePath = "generated/docs/vi/1.2.3/other.mdx";
  assert.throws(() => parseDocsContentCatalog(wrongPartition), /locale\/version partition/i);

  const multilineMetadata = structuredClone(catalogFixture());
  multilineMetadata.pages[0].title = "unsafe\nheading";
  assert.throws(() => parseDocsContentCatalog(multilineMetadata), /single-line public text/i);

  const noRoot = structuredClone(catalogFixture());
  noRoot.pages[0].slug = ["start"];
  assert.throws(() => parseDocsContentCatalog(noRoot), /missing the en\/1\.2\.3 root page/i);
});

test("disk catalog loading rejects symlink escapes", async () => {
  const fixture = await temporaryContent();
  const outside = join(fixture.root, "..", `outside-${Date.now()}.mdx`);
  try {
    await writeFile(outside, "# outside\n", "utf8");
    const catalog = catalogFixture();
    const victim = join(fixture.root, catalog.pages[0].sourcePath);
    await rm(victim);
    await mkdir(join(victim, ".."), { recursive: true });
    await symlink(outside, victim);
    await writeFile(fixture.catalogPath, JSON.stringify(catalog), "utf8");
    await assert.rejects(loadDocsContentCatalog(fixture.catalogPath, fixture.root), /escapes the content root/i);
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
    await rm(outside, { force: true });
  }
});
