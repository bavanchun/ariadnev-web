// Generated-output gate.
//
// dist/*.css is committed, so it can go stale the moment someone edits
// tokens.json without rebuilding. These tests regenerate in memory and compare,
// which turns that class of drift into a build failure instead of a mystery.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { build, cssName, flattenTokens, generateCss } from "../../packages/tokens/scripts/build-tokens.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const tokensRoot = join(repoRoot, "packages", "tokens");
const tokens = JSON.parse(readFileSync(join(tokensRoot, "src", "tokens.json"), "utf8"));
const fontManifest = JSON.parse(readFileSync(join(tokensRoot, "src", "font-manifest.json"), "utf8"));
const read = (target) => readFileSync(join(tokensRoot, "dist", `${target}.css`), "utf8");

test("the committed stylesheets are not stale", () => {
  const stale = build({ check: true }).filter((result) => result.stale).map((result) => result.target);
  assert.deepEqual(stale, [], `run the token build: ${stale.join(", ")} is out of date`);
});

test("generation is deterministic across repeated runs", () => {
  for (const target of ["site", "docs"]) {
    const first = generateCss(target, tokens, fontManifest, "../assets/");
    const second = generateCss(target, tokens, fontManifest, "../assets/");
    assert.equal(first, second, `${target}.css generation is not deterministic`);
  }
});

test("no generated file embeds a timestamp, path, or environment value", () => {
  for (const target of ["site", "docs"]) {
    const css = read(target);
    assert.doesNotMatch(css, /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/, `${target}.css embeds a timestamp`);
    assert.doesNotMatch(css, /\/Users\/|\/home\/|C:\\\\/, `${target}.css embeds an absolute path`);
    assert.doesNotMatch(css, /node_modules/, `${target}.css leaks a dependency path`);
  }
});

test("every authored token reaches both entry points", () => {
  const expected = flattenTokens(tokens).map((entry) => entry.name);
  assert.ok(expected.length > 50, "the token set shrank unexpectedly");
  for (const target of ["site", "docs"]) {
    const css = read(target);
    for (const name of expected) {
      assert.ok(css.includes(`${name}:`), `${target}.css is missing ${name}`);
    }
  }
});

test("shared primitives are byte-identical and only surface aliases differ", () => {
  // Cut at the alias comment itself, which names its own target.
  const strip = (css) => css.slice(0, css.search(/^ {2}\/\* \w+ surface aliases \*\/$/m));
  assert.equal(strip(read("site")), strip(read("docs")), "the shared primitive block diverged between apps");
});

test("all four surface contexts emit identical shared custom properties", () => {
  const roles = [
    "canvas", "raised", "border", "border-strong", "text-primary", "text-muted",
    "link-default", "link-hover", "focus-ring", "selection-layer", "selection-text",
    "disabled-layer", "disabled-text", "disabled-border",
    "active-layer", "active-text", "active-indicator",
    "verified-layer", "verified-text", "verified-indicator",
    "gate-layer", "gate-text", "gate-indicator",
    "destructive-layer", "destructive-text", "destructive-indicator",
  ];
  for (const context of ["brand", "reading", "instrument", "overlay"]) {
    for (const role of roles) {
      const declaration = `--vcs-context-${context}-${role}:`;
      assert.ok(read("site").includes(declaration), `site.css missing ${declaration}`);
      assert.ok(read("docs").includes(declaration), `docs.css missing ${declaration}`);
    }
  }
  assert.ok(read("site").includes("--vcs-context-overlay-scrim:"));
  assert.ok(read("docs").includes("--vcs-context-overlay-scrim:"));
});

test("both entry points expose the documented app aliases", () => {
  for (const target of ["site", "docs"]) {
    const css = read(target);
    for (const alias of ["--vcs-app-background", "--vcs-app-foreground", "--vcs-app-measure"]) {
      assert.ok(css.includes(`${alias}:`), `${target}.css is missing ${alias}`);
    }
  }
  // Documentation reads in long form, so it alone pins a prose measure.
  assert.ok(read("docs").includes("--vcs-app-measure: var(--vcs-size-prose-max)"));
  assert.ok(read("site").includes("--vcs-app-measure: var(--vcs-size-content-max)"));
});

test("aliases are emitted as var() references rather than flattened literals", () => {
  const css = read("site");
  assert.match(css, /--vcs-surface-canvas: var\(--vcs-color-ink-900\);/);
  assert.match(css, /--vcs-text-primary: var\(--vcs-color-cool-100\);/);
});

test("reduced motion is honoured by the generated output", () => {
  for (const target of ["site", "docs"]) {
    const css = read(target);
    assert.match(css, /@media \(prefers-reduced-motion: reduce\)/, `${target}.css ignores reduced motion`);
    assert.match(css, /--vcs-motion-duration-normal: 0ms;/);
  }
});

test("custom property names are stable and namespaced", () => {
  assert.equal(cssName(["color", "ink", "900"]), "--vcs-color-ink-900");
  assert.equal(cssName(["font", "lineHeight", "tight"]), "--vcs-font-line-height-tight");
  for (const entry of flattenTokens(tokens)) {
    assert.match(entry.name, /^--vcs-[a-z0-9-]+$/, `${entry.name} is not a stable namespaced name`);
  }
});
