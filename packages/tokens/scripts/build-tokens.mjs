#!/usr/bin/env node
// Deterministic DTCG-to-CSS generator.
//
// Two entry points are emitted from one authored source: `site.css` for Astro
// and `docs.css` for Fumadocs. Shared primitives are byte-identical between
// them; only the documented surface aliases at the end of each file differ.
//
// Determinism is a hard requirement, not an aspiration. Traversal order follows
// the authored key order, no timestamp or environment value is ever written,
// and running the build twice must produce identical bytes. The generated files
// are committed, and a drift test fails the gate if they are stale.
//
// Usage:
//   node scripts/build-tokens.mjs [--check]

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const tokensPath = join(packageRoot, "src", "tokens.json");
const fontManifestPath = join(packageRoot, "src", "font-manifest.json");
const distDir = join(packageRoot, "dist");

const DTCG_META = new Set(["$type", "$value", "$description", "$schema", "$extensions"]);
const ALIAS = /^\{([A-Za-z0-9._-]+)\}$/;

/** Flatten the DTCG tree into ordered `[cssName, token]` pairs. */
export function flattenTokens(tree) {
  const entries = [];
  const walk = (node, path, inheritedType) => {
    const type = node.$type ?? inheritedType;
    if (Object.hasOwn(node, "$value")) {
      entries.push({ path, name: cssName(path), value: node.$value, type });
      return;
    }
    for (const [key, child] of Object.entries(node)) {
      if (DTCG_META.has(key)) continue;
      if (child === null || typeof child !== "object") continue;
      walk(child, [...path, key], type);
    }
  };
  walk(tree, [], undefined);
  return entries;
}

/** `["color","ink","900"]` becomes `--vcs-color-ink-900`. */
export function cssName(path) {
  return `--vcs-${path.map((segment) => segment.replace(/[^A-Za-z0-9]+/g, "-")).join("-").replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase()}`;
}

/** Resolve a `{a.b.c}` alias to the referenced token's CSS custom property. */
function resolveAlias(raw, byPath) {
  const match = ALIAS.exec(raw);
  if (match === null) return null;
  const target = byPath.get(match[1]);
  if (target === undefined) throw new Error(`unresolved token alias: ${raw}`);
  return `var(${target.name})`;
}

/** Render one token value as CSS, preserving aliases as `var()` references. */
export function renderValue(token, byPath) {
  const { value, type } = token;

  if (typeof value === "string") return resolveAlias(value, byPath) ?? value;
  if (typeof value === "number") return String(value);

  if (Array.isArray(value)) {
    if (type === "fontFamily") {
      return value.map((family) => (/[^A-Za-z0-9-]/.test(family) ? `"${family}"` : family)).join(", ");
    }
    if (type === "cubicBezier") return `cubic-bezier(${value.join(", ")})`;
    return value.join(", ");
  }

  if (type === "shadow" && value !== null && typeof value === "object") {
    return `${value.offsetX} ${value.offsetY} ${value.blur} ${value.spread} ${value.color}`;
  }

  throw new Error(`unsupported token value for ${token.name}`);
}

/** `@font-face` rules generated from the font manifest, not hand-written. */
export function renderFontFaces(manifest, assetBase) {
  return manifest.fonts
    .map((font) => {
      const weight = font.variable ? `${font.weights[0]} ${font.weights.at(-1)}` : String(font.weights[0]);
      const file = font.file.replace(/^assets\//, "");
      return [
        "@font-face {",
        `  font-family: "${font.family}";`,
        "  font-style: normal;",
        `  font-weight: ${weight};`,
        "  font-display: swap;",
        `  src: url("${assetBase}${file}") format("woff2");`,
        "}",
      ].join("\n");
    })
    .join("\n\n");
}

const HEADER = [
  "/*",
  " * Generated from packages/tokens/src/tokens.json by scripts/build-tokens.mjs.",
  " * Do not edit. Run `pnpm --filter @ariadnev-web/tokens run build` instead.",
  " */",
].join("\n");

/**
 * Surface aliases are the only permitted divergence between the two entry
 * points, and each one is documented here rather than discovered in an app.
 */
const SURFACE_ALIASES = {
  site: [
    ["--vcs-app-background", "var(--vcs-surface-canvas)"],
    ["--vcs-app-foreground", "var(--vcs-text-primary)"],
    ["--vcs-app-measure", "var(--vcs-size-content-max)"],
  ],
  docs: [
    ["--vcs-app-background", "var(--vcs-surface-canvas)"],
    ["--vcs-app-foreground", "var(--vcs-text-primary)"],
    // Documentation is read in long form, so it uses the prose measure and the
    // relaxed leading rather than the marketing content width.
    ["--vcs-app-measure", "var(--vcs-size-prose-max)"],
    ["--vcs-app-leading", "var(--vcs-font-line-height-relaxed)"],
  ],
};

export function generateCss(target, tokens, fontManifest, assetBase) {
  const entries = flattenTokens(tokens);
  const byPath = new Map(entries.map((entry) => [entry.path.join("."), entry]));

  const declarations = entries.map((entry) => `  ${entry.name}: ${renderValue(entry, byPath)};`).join("\n");
  const aliases = SURFACE_ALIASES[target].map(([name, value]) => `  ${name}: ${value};`).join("\n");

  return [
    HEADER,
    "",
    renderFontFaces(fontManifest, assetBase),
    "",
    ":root {",
    declarations,
    "",
    `  /* ${target} surface aliases */`,
    aliases,
    "}",
    "",
    "@media (prefers-reduced-motion: reduce) {",
    "  :root {",
    "    --vcs-motion-duration-instant: 0ms;",
    "    --vcs-motion-duration-fast: 0ms;",
    "    --vcs-motion-duration-normal: 0ms;",
    "    --vcs-motion-duration-slow: 0ms;",
    "  }",
    "}",
    "",
  ].join("\n");
}

export function build({ check = false } = {}) {
  const tokens = JSON.parse(readFileSync(tokensPath, "utf8"));
  const fontManifest = JSON.parse(readFileSync(fontManifestPath, "utf8"));
  mkdirSync(distDir, { recursive: true });

  const results = [];
  for (const target of ["site", "docs"]) {
    const css = generateCss(target, tokens, fontManifest, "../assets/");
    const outPath = join(distDir, `${target}.css`);
    if (check) {
      let current = "";
      try {
        current = readFileSync(outPath, "utf8");
      } catch {
        current = "";
      }
      results.push({ target, outPath, stale: current !== css });
    } else {
      writeFileSync(outPath, css);
      results.push({ target, outPath, bytes: Buffer.byteLength(css) });
    }
  }
  return results;
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop())) {
  const check = process.argv.includes("--check");
  const results = build({ check });
  if (check) {
    const stale = results.filter((result) => result.stale);
    if (stale.length > 0) {
      console.error(`generated token CSS is stale: ${stale.map((entry) => entry.target).join(", ")}`);
      process.exit(1);
    }
    console.log("token CSS is up to date");
  } else {
    for (const result of results) console.log(`${result.target}.css ${result.bytes} bytes`);
  }
}
