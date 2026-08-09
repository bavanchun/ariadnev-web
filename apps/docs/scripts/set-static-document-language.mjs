import { readFile, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { enumerateDocsRoutes, loadDocsContentCatalog } from "../src/lib/content-catalog.ts";
import { routeUrl } from "../src/lib/static-discovery.ts";

const appRoot = resolve(import.meta.dirname, "..");

export async function setStaticDocumentLanguages({
  contentRoot = resolve(appRoot, "content"),
  outRoot = resolve(appRoot, "out"),
  catalogPath = resolve(contentRoot, "generated/catalog.json"),
} = {}) {
  const catalog = await loadDocsContentCatalog(catalogPath, contentRoot);
  const written = [];
  for (const route of enumerateDocsRoutes(catalog)) {
    const target = resolve(outRoot, routeUrl(route).slice(1), "index.html");
    const html = await readFile(target, "utf8");
    const matches = html.match(/<html\b[^>]*\blang="[^"]*"[^>]*>/g) ?? [];
    if (matches.length !== 1) throw new Error(`static document must contain one language declaration: ${routeUrl(route)}`);
    const localized = html.replace(/(<html\b[^>]*\blang=")[^"]*(")/, `$1${route.locale}$2`);
    const temporary = `${target}.language-tmp`;
    await writeFile(temporary, localized, "utf8");
    await rename(temporary, target);
    written.push(target);
  }
  return Object.freeze(written.sort());
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await setStaticDocumentLanguages();
