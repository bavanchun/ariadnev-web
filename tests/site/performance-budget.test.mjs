import assert from "node:assert/strict";
import { brotliCompressSync, constants as zlibConstants } from "node:zlib";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, posix } from "node:path";
import test, { before } from "node:test";
import { fileURLToPath } from "node:url";
import { buildSiteOnce } from "./build-site-once.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const sourceRoot = join(root, "apps/site/src");
const publicRoot = join(root, "apps/site/public");
const distRoot = join(root, "apps/site/dist");
const read = (path) => readFileSync(join(root, path), "utf8");

before(() => buildSiteOnce(root));

function walk(path) {
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const child = join(path, entry.name);
    return entry.isDirectory() ? walk(child) : [child];
  });
}

function compressedBytes(path) {
  const bytes = readFileSync(path);
  const extension = extname(path).toLowerCase();
  const alreadyCompressed = new Set([".woff", ".woff2", ".png", ".jpg", ".jpeg", ".webp", ".avif", ".gif", ".ico"]);
  if (alreadyCompressed.has(extension)) return bytes.byteLength;
  return brotliCompressSync(bytes, {
    params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 9 },
  }).byteLength;
}

function builtHomeResources() {
  const origin = "https://vcskill.invalid";
  const resources = new Map();
  const queue = [{ pathname: "/index.html", file: join(distRoot, "index.html") }];

  while (queue.length > 0) {
    const resource = queue.shift();
    if (!resource || resources.has(resource.file)) continue;
    resources.set(resource.file, resource.pathname);

    const extension = extname(resource.file).toLowerCase();
    if (extension !== ".html" && extension !== ".css") continue;
    const source = readFileSync(resource.file, "utf8");
    const references = extension === ".html"
      ? [...source.matchAll(/\b(?:href|src)="([^"]+)"/g)].map((match) => match[1])
      : [...source.matchAll(/url\((?:"|')?([^"')]+)(?:"|')?\)/g)].map((match) => match[1]);

    for (const reference of references) {
      if (/^(?:#|data:|mailto:|tel:|https?:\/\/)/i.test(reference)) continue;
      const resolved = new URL(reference, `${origin}${resource.pathname}`);
      const pathname = decodeURIComponent(resolved.pathname);
      const relative = pathname.replace(/^\/+/, "");
      const candidate = join(distRoot, relative || "index.html");
      if (!existsSync(candidate) || !statSync(candidate).isFile()) continue;
      queue.push({ pathname: `/${posix.normalize(relative)}`, file: candidate });
    }
  }

  return [...resources.keys()];
}

function budgetCap(id) {
  const contract = JSON.parse(read("tests/benchmarks/performance-budgets.json"));
  const budget = contract.budgets.find((entry) => entry.id === id);
  assert.ok(budget, `${id} must exist in the Phase 1 budget contract`);
  return budget.cap;
}

test("site ships exactly one authored client enhancer with no runtime fetch", () => {
  const scripts = walk(join(sourceRoot, "scripts")).filter((path) => /\.(?:js|ts)$/.test(path));
  assert.deepEqual(scripts.map((path) => path.slice(sourceRoot.length + 1)), ["scripts/execution-map-enhancer.ts"]);
  const source = read("apps/site/src/scripts/execution-map-enhancer.ts");
  assert.doesNotMatch(source, /\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource/);
  assert.ok(Buffer.byteLength(source) < 90_000);
});

test("authored CSS and image assets stay inside Phase 1 transfer budgets", () => {
  const cssBytes = statSync(join(sourceRoot, "styles/site.css")).size;
  const imageBytes = walk(publicRoot).filter((path) => /\.(?:svg|png|jpe?g|webp|avif)$/i.test(path)).reduce((sum, path) => sum + statSync(path).size, 0);
  assert.ok(cssBytes <= 25_000, `authored CSS is ${cssBytes} bytes`);
  assert.ok(imageBytes <= 200_000, `authored images are ${imageBytes} bytes`);
});

test("built home transfer graph stays inside every Phase 1 marketing budget", () => {
  const totals = { total: 0, js: 0, css: 0, fonts: 0, images: 0 };
  const resources = builtHomeResources();
  assert.ok(resources.some((path) => extname(path) === ".css"), "built home must reference its CSS asset");
  assert.ok(resources.some((path) => extname(path) === ".woff2"), "built home must reference its local fonts");

  for (const path of resources) {
    const bytes = compressedBytes(path);
    const extension = extname(path).toLowerCase();
    totals.total += bytes;
    if ([".js", ".mjs"].includes(extension)) totals.js += bytes;
    if (extension === ".css") totals.css += bytes;
    if ([".woff", ".woff2"].includes(extension)) totals.fonts += bytes;
    if ([".svg", ".png", ".jpg", ".jpeg", ".webp", ".avif", ".gif", ".ico"].includes(extension)) totals.images += bytes;
  }

  const checks = [
    ["marketing-total-transfer-compressed", totals.total],
    ["marketing-js-compressed", totals.js],
    ["marketing-css-compressed", totals.css],
    ["marketing-fonts-compressed", totals.fonts],
    ["marketing-images-compressed", totals.images],
  ];
  for (const [id, actual] of checks) {
    assert.ok(actual <= budgetCap(id), `${id}: ${actual} bytes exceed ${budgetCap(id)} bytes`);
  }
});

test("site source contains no remote fonts, decorative effects, or competing CSS primitives", () => {
  const source = walk(sourceRoot).map((path) => readFileSync(path, "utf8")).join("\n");
  assert.doesNotMatch(source, /fonts\.googleapis|@font-face|https?:\/\/[^"']+\.(?:woff2?|ttf|otf)/i);
  assert.doesNotMatch(source, /(?:linear|radial|conic)-gradient|backdrop-filter|box-shadow:\s*0\s+[1-9]/i);
  assert.doesNotMatch(source, /#[0-9a-f]{3,8}\b/i);
  assert.doesNotMatch(source, /--(?:color|space|font|motion)-(?!vc)/i);
});
