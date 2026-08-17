import assert from "node:assert/strict";
import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { catalogFixture, temporaryContent } from "./contract-fixture.mjs";
import { parseDocsContentCatalog } from "../../apps/docs/src/lib/content-catalog.ts";
import { buildSearchPartition, compressedSearchBytes, querySearchPartition, stableJson } from "../../apps/docs/src/lib/search-index.ts";
import { publicMarkdown } from "../../apps/docs/src/lib/static-discovery.ts";

test("Orama partitions are deterministic, isolated, and within the frozen budget", async () => {
  const fixture = await temporaryContent();
  try {
    const raw = catalogFixture();
    const catalog = parseDocsContentCatalog(raw);
    const sources = await Promise.all(raw.pages.map(async (page) => ({ pageId: page.id, content: publicMarkdown(await readFile(join(fixture.root, page.sourcePath), "utf8")) })));
    const first = await buildSearchPartition(catalog, "en", "stable", sources);
    const second = await buildSearchPartition(catalog, "en", "stable", [...sources].reverse());
    assert.equal(stableJson(first), stableJson(second));
    assert.ok(compressedSearchBytes(stableJson(first)) <= 120_000);
    const english = await querySearchPartition(first, "installation-only");
    assert.equal(english.length, 1);
    assert.ok(english.every((document) => document.locale === "en" && document.version === "stable"));
    assert.deepEqual(await querySearchPartition(first, "cài-đặt-riêng"), []);
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test("retired CLI routes never produce a second search hit for an already-canonical command", async () => {
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
  const sources = catalog.pages.map((page) => ({
    pageId: page.id,
    content: page.id === retiredPage.id ? "doctor renamed retired notice" : "doctor command detail content",
  }));
  const envelope = await buildSearchPartition(catalog, locale, version, sources);
  assert.ok(!envelope.documentIds.includes(`${locale}/${version}/reference/cli/old-doctor`), "retired route must not enter the search partition");
  const hits = await querySearchPartition(envelope, "doctor");
  assert.equal(hits.filter((document) => document.url.includes("old-doctor")).length, 0);
});

test("search generation rejects duplicate source IDs and partition drift", async () => {
  const catalog = parseDocsContentCatalog(catalogFixture());
  await assert.rejects(buildSearchPartition(catalog, "en", "stable", [
    { pageId: "en/1.2.3/index", content: "one" },
    { pageId: "en/1.2.3/index", content: "two" },
  ]), /duplicate search source/i);
  const validSources = catalog.pages.map((page) => ({ pageId: page.id, content: page.title }));
  const envelope = await buildSearchPartition(catalog, "en", "stable", validSources);
  await assert.rejects(querySearchPartition({ ...envelope, partition: "vi/stable" }, "English"), /metadata mismatch/i);
});
