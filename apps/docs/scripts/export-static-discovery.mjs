import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { loadDocsContentCatalog } from "../src/lib/content-catalog.ts";
import { resolveDocsContentRoot } from "../src/lib/docs-content-root.ts";
import { exportStaticDiscovery } from "../src/lib/static-discovery.ts";

const appRoot = resolve(import.meta.dirname, "..");

export async function runStaticDiscovery({ contentRoot = resolveDocsContentRoot(appRoot), outRoot = resolve(appRoot, "out"), catalogPath = resolve(contentRoot, "generated/catalog.json") } = {}) {
  return exportStaticDiscovery(await loadDocsContentCatalog(catalogPath, contentRoot), contentRoot, outRoot);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await runStaticDiscovery();
