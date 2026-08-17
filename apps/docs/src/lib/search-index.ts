import { create, insert, load, save, search } from "@orama/orama";
import { gzipSync } from "node:zlib";
import type { DocsContentCatalog } from "./content-catalog.ts";
import { findCatalogPage } from "./content-catalog.ts";
import type { DocsLocale } from "./i18n.ts";

export const SEARCH_SCHEMA = Object.freeze({
  id: "string",
  locale: "string",
  version: "string",
  title: "string",
  description: "string",
  content: "string",
  url: "string",
} as const);

export interface SearchSourceDocument {
  readonly pageId: string;
  readonly content: string;
}

export interface SearchDocument {
  readonly id: string;
  readonly locale: DocsLocale;
  readonly version: string;
  readonly title: string;
  readonly description: string;
  readonly content: string;
  readonly url: string;
}

export interface SearchPartitionEnvelope {
  readonly schemaVersion: 1;
  readonly partition: string;
  readonly locale: DocsLocale;
  readonly version: string;
  readonly documents: number;
  readonly documentIds: readonly string[];
  readonly index: unknown;
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, child]) => [key, stableValue(child)]));
}

export function stableJson(value: unknown): string {
  return `${JSON.stringify(stableValue(value))}\n`;
}

export function compressedSearchBytes(serialized: string): number {
  return gzipSync(serialized, { level: 9 }).byteLength;
}

export async function buildSearchPartition(
  catalog: DocsContentCatalog,
  locale: DocsLocale,
  routeVersion: string,
  sources: readonly SearchSourceDocument[],
): Promise<SearchPartitionEnvelope> {
  const sourceByPage = new Map<string, string>();
  for (const source of sources) {
    if (sourceByPage.has(source.pageId)) throw new Error("duplicate search source page id");
    sourceByPage.set(source.pageId, source.content);
  }
  // Retired CLI routes (`D13-cli-command-retired`) render a thin
  // replaced/tombstone notice, not command content, and always name the same
  // command a live `D13-cli-command-detail` page already covers. Indexing
  // both would surface two search hits for one command; only the canonical
  // detail page (or, once retired, the index/tombstone as appropriate) is
  // ever a real result, so retired-route pages never enter the partition.
  const pages = catalog.pages.filter(
    (page) => page.screenKind !== "D13-cli-command-retired" && findCatalogPage(catalog, locale, routeVersion, page.slug)?.id === page.id,
  );
  const database = create({ schema: SEARCH_SCHEMA });
  const documentIds = new Set<string>();
  for (const page of [...pages].sort((left, right) => left.id.localeCompare(right.id))) {
    const content = sourceByPage.get(page.id);
    if (content === undefined) throw new Error(`search source is missing catalog page ${page.id}`);
    const id = `${locale}/${routeVersion}/${page.slug.join("/") || "index"}`;
    if (documentIds.has(id)) throw new Error("duplicate search document id");
    documentIds.add(id);
    const document: SearchDocument = {
      id,
      locale,
      version: routeVersion,
      title: page.title,
      description: page.description,
      content,
      url: `/${[locale, routeVersion, ...page.slug].join("/")}/`,
    };
    await insert(database, document);
  }
  return Object.freeze({
    schemaVersion: 1,
    partition: `${locale}/${routeVersion}`,
    locale,
    version: routeVersion,
    documents: documentIds.size,
    documentIds: Object.freeze([...documentIds].sort()),
    index: save(database),
  });
}

export async function querySearchPartition(envelope: SearchPartitionEnvelope, term: string): Promise<readonly SearchDocument[]> {
  if (envelope.partition !== `${envelope.locale}/${envelope.version}`) throw new Error("search partition metadata mismatch");
  const database = create({ schema: SEARCH_SCHEMA });
  load(database, envelope.index as never);
  const results = await search(database, { term, limit: 20, properties: ["title", "description", "content"] });
  const documents = results.hits.map((hit) => hit.document as SearchDocument);
  if (documents.some((document) => document.locale !== envelope.locale || document.version !== envelope.version)) {
    throw new Error("search result crossed its locale/version partition");
  }
  return documents;
}
