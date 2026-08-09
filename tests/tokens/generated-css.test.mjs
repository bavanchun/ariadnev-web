import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";

import { buildTokens } from "../../packages/tokens/scripts/build-tokens.mjs";
import { ROOT, cssDeclarations, readJson } from "./token-test-helpers.mjs";

const inputPath = resolve(ROOT, "packages/tokens/src/tokens.json");
const fontManifestPath = resolve(ROOT, "packages/tokens/src/font-manifest.json");
const trackedOutputDir = resolve(ROOT, "packages/tokens/dist");
const source = readJson("packages/tokens/src/tokens.json");
const generatedFiles = ["site.css", "docs.css", "tokens.json"];
const temporaryDirectories = [];

function temporaryDirectory(prefix) {
  const directory = mkdtempSync(resolve(tmpdir(), prefix));
  temporaryDirectories.push(directory);
  return directory;
}

test.after(() => {
  for (const directory of temporaryDirectories) rmSync(directory, { recursive: true, force: true });
});

function readOutputs(directory) {
  return Object.fromEntries(generatedFiles.map((file) => [file, readFileSync(resolve(directory, file), "utf8")]));
}

test("two explicit builds are byte-identical and match committed output", () => {
  const first = temporaryDirectory("vcskill-tokens-a-");
  const second = temporaryDirectory("vcskill-tokens-b-");
  buildTokens({ inputPath, fontManifestPath, outputDir: first });
  buildTokens({ inputPath, fontManifestPath, outputDir: second });
  assert.deepEqual(readOutputs(first), readOutputs(second));
  assert.deepEqual(readOutputs(first), readOutputs(trackedOutputDir));
  buildTokens({ inputPath, fontManifestPath, outputDir: trackedOutputDir, check: true });
});

test("check mode identifies the exact stale generated path", () => {
  const output = temporaryDirectory("vcskill-tokens-stale-");
  buildTokens({ inputPath, fontManifestPath, outputDir: output });
  const stalePath = resolve(output, "site.css");
  writeFileSync(stalePath, readFileSync(stalePath, "utf8") + "/* stale */\n");
  assert.throws(() => buildTokens({ inputPath, fontManifestPath, outputDir: output, check: true }), /site\.css.*stale/);
});

test("site and docs expose equal shared primitives and only frozen surface differences", () => {
  const siteCss = readFileSync(resolve(trackedOutputDir, "site.css"), "utf8");
  const docsCss = readFileSync(resolve(trackedOutputDir, "docs.css"), "utf8");
  const site = cssDeclarations(siteCss);
  const docs = cssDeclarations(docsCss);
  assert.deepEqual([...site.keys()], [...docs.keys()]);
  const allowedDifferences = new Set(source.$extensions.vcskill.surfaceAliases.map((path) => "--vc-" + path.replaceAll(".", "-")));
  for (const [name, value] of site) {
    if (value !== docs.get(name)) assert.ok(allowedDifferences.has(name), name + " is not a documented surface alias");
  }
  for (const name of allowedDifferences) assert.ok(site.has(name) && docs.has(name), "missing surface alias " + name);
});

test("generated CSS is local, static, accessible, and free of prohibited decoration", () => {
  for (const file of ["site.css", "docs.css"]) {
    const css = readFileSync(resolve(trackedOutputDir, file), "utf8");
    assert.ok(css.startsWith("/* Generated from src/tokens.json and src/font-manifest.json. Do not edit. */\n"));
    assert.equal((css.match(/@font-face/g) || []).length, 3);
    assert.equal((css.match(/font-display:\s*swap/g) || []).length, 3);
    assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
    assert.doesNotMatch(css, /@import|https?:|file:|\/Users\/|\\\\Users\\\\/);
    assert.doesNotMatch(css.toLowerCase(), /gradient|glass|orb|box-shadow|drop-shadow/);
    for (const match of css.matchAll(/url\("([^"]+)"\)/g)) assert.match(match[1], /^\.\.\/assets\/fonts\/[a-z-]+\.woff2$/);
  }
});

test("generator has no network, environment, locale, clock, or host-path input", () => {
  const generator = readFileSync(resolve(ROOT, "packages/tokens/scripts/build-tokens.mjs"), "utf8");
  assert.doesNotMatch(generator, /node:(?:http|https|net|tls)|\bfetch\s*\(|process\.env|localeCompare|toLocale|new Date|Date\.now/);
});

test("execution cartography guideline freezes the visual and accessibility contract", () => {
  const guideline = readFileSync(resolve(ROOT, "docs/execution-cartography.md"), "utf8").toLowerCase();
  for (const heading of ["layout", "topology", "typography", "palette", "focus", "motion", "responsive", "anti-patterns"]) {
    assert.match(guideline, new RegExp("^## .*" + heading, "m"));
  }
  for (const prohibited of ["gradients", "glassmorphism", "decorative orbs", "generic card grids", "broad drop shadows", "agentkit surface copy"]) {
    assert.ok(guideline.includes(prohibited), "missing explicit ban: " + prohibited);
  }
});
