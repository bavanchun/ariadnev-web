import { existsSync, readFileSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { extname, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { brotliCompressSync, constants as zlibConstants } from "node:zlib";
import { enumerateDocsRoutes, loadDocsContentCatalog } from "../src/lib/content-catalog.ts";
import { resolveDocsContentRoot } from "../src/lib/docs-content-root.ts";

const appRoot = resolve(import.meta.dirname, "..");
const defaultContentRoot = resolveDocsContentRoot(appRoot);
const defaultOutRoot = resolve(appRoot, "out");
const defaultBudgetPath = resolve(appRoot, "../../tests/benchmarks/performance-budgets.json");
const defaultRatchetPath = resolve(appRoot, "../../tests/benchmarks/docs-per-route-ratchet.json");

function attribute(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return match?.[1] ?? match?.[2] ?? match?.[3];
}

function compressibleBytes(path) {
  const bytes = readFileSync(path);
  const compressedExtensions = new Set([".woff", ".woff2", ".png", ".jpg", ".jpeg", ".webp", ".avif", ".gif", ".ico"]);
  if (compressedExtensions.has(extname(path).toLowerCase())) return bytes.byteLength;
  return brotliCompressSync(bytes, { params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 9 } }).byteLength;
}

function assertInside(root, candidate) {
  const path = relative(root, candidate);
  if (path === ".." || path.startsWith(`..${sep}`) || path.includes(`..${sep}`)) throw new Error("static budget resource escapes output root");
}

function localResource(reference, basePathname, outRoot) {
  if (!reference || /^(?:data:|https?:\/\/)/i.test(reference)) return undefined;
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(reference, `https://docs.invalid${basePathname}`).pathname);
  } catch {
    throw new Error("static budget resource URL is malformed");
  }
  const candidate = resolve(outRoot, pathname.replace(/^\/+/, ""));
  assertInside(outRoot, candidate);
  if (!existsSync(candidate) || !statSync(candidate).isFile()) throw new Error(`static budget resource is missing: ${pathname}`);
  return { pathname, file: candidate };
}

function htmlReferences(html) {
  const references = [];
  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = match[0];
    const rel = (attribute(tag, "rel") ?? "").toLowerCase().split(/\s+/);
    if (rel.some((value) => ["stylesheet", "preload", "modulepreload", "icon", "manifest"].includes(value))) references.push(attribute(tag, "href"));
  }
  for (const match of html.matchAll(/<script\b[^>]*>/gi)) {
    if (/\bnomodule\b/i.test(match[0])) continue;
    references.push(attribute(match[0], "src"));
  }
  for (const match of html.matchAll(/<(?:img|source)\b[^>]*>/gi)) {
    const src = attribute(match[0], "src");
    if (src) references.push(src);
    const srcset = attribute(match[0], "srcset");
    if (srcset) references.push(srcset.split(",", 1)[0]?.trim().split(/\s+/, 1)[0]);
  }
  return references.filter(Boolean);
}

function collectRouteResources(routePathname, outRoot) {
  const entry = resolve(outRoot, routePathname.replace(/^\/+/, ""), "index.html");
  assertInside(outRoot, entry);
  if (!existsSync(entry)) throw new Error(`docs budget route is missing: ${routePathname}`);
  const queue = [{ pathname: `${routePathname}index.html`, file: entry }];
  const resources = new Map();
  while (queue.length > 0) {
    const resource = queue.shift();
    if (!resource || resources.has(resource.file)) continue;
    resources.set(resource.file, resource.pathname);
    const extension = extname(resource.file).toLowerCase();
    if (extension !== ".html" && extension !== ".css") continue;
    const source = readFileSync(resource.file, "utf8");
    const references = extension === ".html"
      ? htmlReferences(source)
      : [...source.matchAll(/url\((?:"|')?([^"')]+)(?:"|')?\)/g)].map((match) => match[1]);
    for (const reference of references) {
      const next = localResource(reference, resource.pathname, outRoot);
      if (next) queue.push(next);
    }
  }
  return [...resources.keys()];
}

// Compute per-resource-class totals for a single route.
function measureRoute(routePathname, outRoot) {
  const resources = collectRouteResources(routePathname, outRoot);
  const totals = { total: 0, js: 0, css: 0, fonts: 0, images: 0 };
  for (const path of resources) {
    const bytes = compressibleBytes(path);
    const extension = extname(path).toLowerCase();
    totals.total += bytes;
    if ([".js", ".mjs"].includes(extension)) totals.js += bytes;
    if (extension === ".css") totals.css += bytes;
    if ([".woff", ".woff2"].includes(extension)) totals.fonts += bytes;
    if ([".svg", ".png", ".jpg", ".jpeg", ".webp", ".avif", ".gif", ".ico"].includes(extension)) totals.images += bytes;
  }
  return { routePathname, resources: resources.length, ...totals };
}

function routePathnameFor(param) {
  const suffix = param.slug.length > 0 ? `${param.slug.join("/")}/` : "";
  return `/${param.locale}/${param.version}/${suffix}`;
}

export async function verifyStaticBudget({
  contentRoot = defaultContentRoot,
  outRoot = defaultOutRoot,
  catalogPath = resolve(contentRoot, "generated/catalog.json"),
  budgetPath = defaultBudgetPath,
  ratchetPath = defaultRatchetPath,
} = {}) {
  const catalog = await loadDocsContentCatalog(catalogPath, contentRoot);
  const installation = catalog.pages.find((page) => page.locale === "en" && page.version === catalog.currentStable && page.slug.join("/") === "get-started/installation");
  const page = installation ?? catalog.pages.find((candidate) => candidate.locale === "en" && candidate.version === catalog.currentStable && candidate.slug.length === 0);
  if (!page) throw new Error("docs budget route cannot be selected from the catalog");
  const primaryRoute = `/en/stable/${page.slug.length > 0 ? `${page.slug.join("/")}/` : ""}`;
  const primary = measureRoute(primaryRoute, outRoot);

  const budgetContract = JSON.parse(await readFile(budgetPath, "utf8"));
  const caps = new Map(budgetContract.budgets.map((budget) => [budget.id, budget.cap]));
  for (const [id, actual] of [
    ["docs-total-transfer-compressed", primary.total],
    ["docs-js-compressed", primary.js],
    ["docs-css-compressed", primary.css],
    ["docs-fonts-compressed", primary.fonts],
    ["docs-images-compressed", primary.images],
  ]) {
    const cap = caps.get(id);
    if (!Number.isSafeInteger(cap) || actual > cap) throw new Error(`${id}: ${actual} bytes exceed the frozen ${cap ?? "missing"} byte budget`);
  }

  // Ratchet guard: every enumerable route must respect the frozen 300000 byte
  // cap OR its grandfathered ceiling. Grandfathered routes ratchet DOWN only:
  // a future build that grows a grandfathered route above its ceiling fails
  // the same way a non-grandfathered route failing the cap does. Phase 3
  // recovers each ceiling to the cap; only then may the grandfather entry go.
  const ratchet = JSON.parse(await readFile(ratchetPath, "utf8"));
  if (ratchet.policy !== "ratchet-down-only") throw new Error("docs per-route ratchet policy is not ratchet-down-only");
  const capUnderRatchet = ratchet.capUnderRatchet;
  const ceilings = new Map(ratchet.grandfathered.map((entry) => [entry.route, entry.ceiling]));
  const jsCap = caps.get("docs-js-compressed");
  const cssCap = caps.get("docs-css-compressed");
  const fontsCap = caps.get("docs-fonts-compressed");
  const imagesCap = caps.get("docs-images-compressed");
  const perRouteFailures = [];
  const perRouteResults = [];
  for (const param of enumerateDocsRoutes(catalog)) {
    const routePathname = routePathnameFor(param);
    const measurement = measureRoute(routePathname, outRoot);
    perRouteResults.push(measurement);
    const ceiling = ceilings.get(routePathname) ?? capUnderRatchet;
    if (measurement.total > ceiling) {
      const label = ceilings.has(routePathname) ? "grandfathered ceiling" : `frozen ${capUnderRatchet} byte cap`;
      perRouteFailures.push(`${routePathname}: ${measurement.total} bytes exceed ${label} (${ceiling})`);
    }
    if (measurement.js > jsCap) perRouteFailures.push(`${routePathname}: ${measurement.js} JS bytes exceed the frozen ${jsCap} cap`);
    if (measurement.css > cssCap) perRouteFailures.push(`${routePathname}: ${measurement.css} CSS bytes exceed the frozen ${cssCap} cap`);
    if (measurement.fonts > fontsCap) perRouteFailures.push(`${routePathname}: ${measurement.fonts} font bytes exceed the frozen ${fontsCap} cap`);
    if (measurement.images > imagesCap) perRouteFailures.push(`${routePathname}: ${measurement.images} image bytes exceed the frozen ${imagesCap} cap`);
  }
  if (perRouteFailures.length > 0) {
    throw new Error(`docs per-route budget failed ${perRouteFailures.length} check(s):\n  ${perRouteFailures.join("\n  ")}`);
  }

  return Object.freeze({
    ...primary,
    perRouteChecked: perRouteResults.length,
    grandfatheredRoutes: ceilings.size,
    perRouteResults: Object.freeze(perRouteResults),
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const result = await verifyStaticBudget();
  const { perRouteResults, ...summary } = result;
  process.stdout.write(`${JSON.stringify(summary)}\n`);
}
