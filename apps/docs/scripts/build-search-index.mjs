import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { buildSearchPartition, compressedSearchBytes, stableJson } from "../src/lib/search-index.ts";
import { loadDocsContentCatalog, primaryVersions } from "../src/lib/content-catalog.ts";
import { resolveDocsContentRoot } from "../src/lib/docs-content-root.ts";
import { publicMarkdown } from "../src/lib/static-discovery.ts";

const appRoot = resolve(import.meta.dirname, "..");
const contentRoot = resolveDocsContentRoot(appRoot);
const outRoot = resolve(appRoot, "out/search");
const budgetPath = resolve(appRoot, "../../tests/benchmarks/performance-budgets.json");

export async function buildSearchIndexes({ catalogPath = resolve(contentRoot, "generated/catalog.json"), contentDirectory = contentRoot, outputDirectory = outRoot } = {}) {
  const catalog = await loadDocsContentCatalog(catalogPath, contentDirectory);
  const budgetContract = JSON.parse(await readFile(budgetPath, "utf8"));
  const caps = new Map(budgetContract.budgets.map((budget) => [budget.id, budget.cap]));
  const sources = await Promise.all(catalog.pages.map(async (page) => ({ pageId: page.id, content: publicMarkdown(await readFile(resolve(contentDirectory, page.sourcePath), "utf8")) })));
  const seenDocumentIds = new Set();
  const outputs = [];
  for (const locale of catalog.locales) {
    const cap = caps.get(`search-index-${locale}-compressed`);
    if (!Number.isSafeInteger(cap) || cap <= 0) throw new Error(`missing compressed search budget for ${locale}`);
    for (const version of primaryVersions(catalog)) {
      const envelope = await buildSearchPartition(catalog, locale, version, sources);
      const raw = stableJson(envelope);
      if (compressedSearchBytes(raw) > cap) throw new Error(`compressed search partition exceeds the frozen ${locale} budget`);
      for (const id of envelope.documentIds) {
        if (seenDocumentIds.has(id)) throw new Error("search document id crosses partitions");
        seenDocumentIds.add(id);
      }
      const target = resolve(outputDirectory, locale, `${version}.json`);
      await mkdir(resolve(outputDirectory, locale), { recursive: true });
      await writeFile(target, raw, "utf8");
      outputs.push(target);
      // Mirror to public/search so `next dev` can serve search partitions locally
      const publicTarget = resolve(appRoot, "public/search", locale, `${version}.json`);
      await mkdir(resolve(appRoot, "public/search", locale), { recursive: true });
      await writeFile(publicTarget, raw, "utf8");
    }
  }
  return outputs.sort();
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await buildSearchIndexes();
