import { docs } from "collections/server";
import { loader } from "fumadocs-core/source";
import { resolve } from "node:path";
import { findCatalogPage, loadDocsContentCatalog } from "./content-catalog.ts";
import { resolveDocsContentRoot } from "./docs-content-root.ts";

// `next build` runs with the app directory as cwd. A `new URL(..., import.meta.url)`
// here would be treated by webpack as an asset reference and fail to resolve.
const appRoot = process.cwd();
export const docsContentRoot = resolveDocsContentRoot(appRoot);
export const docsCatalogPath = resolve(docsContentRoot, "generated/catalog.json");

const catalogPromise = loadDocsContentCatalog(docsCatalogPath, docsContentRoot);
export const fumadocsSource = loader({ baseUrl: "/", source: docs.toFumadocsSource() });

export function getDocsCatalog() {
  return catalogPromise;
}

export async function getDocsPage(locale: string, routeVersion: string, slug: readonly string[]) {
  const catalog = await getDocsCatalog();
  const catalogPage = findCatalogPage(catalog, locale, routeVersion, slug);
  if (!catalogPage) return undefined;
  const sourcePage = fumadocsSource.getPage([catalogPage.locale, catalogPage.version, ...catalogPage.slug]);
  if (!sourcePage) throw new Error(`Fumadocs source is missing catalog page ${catalogPage.id}`);
  const relativeSource = sourcePage.data.info.path.replace(/\\/g, "/");
  const expectedSuffix = catalogPage.sourcePath.replace(/^generated\/docs\//, "");
  if (relativeSource !== expectedSuffix && !relativeSource.endsWith(`/${expectedSuffix}`)) {
    throw new Error(`Fumadocs source path drift for ${catalogPage.id}`);
  }
  return { catalog, catalogPage, sourcePage };
}
