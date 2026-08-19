import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { contrastRatio } from "./color-contrast.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const tokens = JSON.parse(readFileSync(join(repoRoot, "packages/tokens/src/tokens.json"), "utf8"));
const manifest = JSON.parse(readFileSync(join(repoRoot, "tests/benchmarks/brand-asset-checksums.json"), "utf8"));
const CONTEXTS = ["brand", "reading", "instrument", "overlay"];

function node(path) {
  return path.split(".").reduce((value, key) => value?.[key], tokens);
}

function literal(path) {
  let current = node(path)?.$value;
  const seen = new Set();
  while (typeof current === "string") {
    const match = /^\{([A-Za-z0-9._-]+)\}$/.exec(current);
    if (match === null) return current;
    assert.ok(!seen.has(match[1]), `alias cycle at ${match[1]}`);
    seen.add(match[1]);
    current = node(match[1])?.$value;
  }
  return current;
}

function imageDimensions(bytes, extension) {
  if (extension === ".png") {
    assert.equal(bytes.subarray(1, 4).toString("ascii"), "PNG");
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  }
  assert.equal(bytes.subarray(0, 4).toString("ascii"), "RIFF");
  assert.equal(bytes.subarray(8, 12).toString("ascii"), "WEBP");
  assert.equal(bytes.subarray(12, 16).toString("ascii"), "VP8X");
  const read24LE = (offset) => bytes[offset] + bytes[offset + 1] * 256 + bytes[offset + 2] * 65536;
  return { width: read24LE(24) + 1, height: read24LE(27) + 1 };
}

export function validatePresentation(asset, candidate) {
  assert.equal(candidate.path, asset.publicPath, `${asset.id} replacement path is forbidden`);
  assert.equal(candidate.filter, "none", `${asset.id} filters are forbidden`);
  assert.equal(candidate.objectFit, "contain", `${asset.id} must use object-fit contain`);
  assert.equal(candidate.overflow, "visible", `${asset.id} must not be clipped`);
  assert.equal(candidate.crop, false, `${asset.id} must not be cropped`);
  assert.equal(candidate.preserveAspectRatio, true, `${asset.id} aspect ratio must be preserved`);
  assert.equal(candidate.backingToken, asset.backingToken, `${asset.id} backing changed`);
}

test("all four contexts expose the complete paired semantic matrix", () => {
  const required = [
    "canvas", "raised", "border", "borderStrong", "text.primary", "text.muted",
    "link.default", "link.hover", "focus.ring", "selection.layer", "selection.text",
    "disabled.layer", "disabled.text", "disabled.border",
  ];
  const statusRoles = ["active", "verified", "gate", "destructive"];
  for (const context of CONTEXTS) {
    for (const role of required) assert.ok(node(`context.${context}.${role}`)?.$value, `${context}.${role} missing`);
    for (const status of statusRoles) {
      for (const role of ["layer", "text", "indicator"]) {
        assert.ok(node(`context.${context}.${status}.${role}`)?.$value, `${context}.${status}.${role} missing`);
      }
    }
  }
  assert.ok(node("context.overlay.scrim")?.$value, "overlay.scrim missing");
});

test("context aliases resolve without cycles", () => {
  for (const context of CONTEXTS) {
    const walk = (value, path) => {
      if (Object.hasOwn(value, "$value")) {
        assert.doesNotMatch(literal(path), /^\{/, `${path} is unresolved`);
        return;
      }
      for (const [key, child] of Object.entries(value)) {
        if (!key.startsWith("$")) walk(child, `${path}.${key}`);
      }
    };
    walk(tokens.context[context], `context.${context}`);
  }
});

test("context text, links, selections, and status text meet contrast policy", () => {
  for (const context of CONTEXTS) {
    const basePairs = [
      ["text.primary", "canvas", 7], ["text.muted", "canvas", 4.5],
      ["link.default", "canvas", 4.5], ["link.hover", "canvas", 4.5],
      ["selection.text", "selection.layer", 4.5],
    ];
    for (const [foreground, background, minimum] of basePairs) {
      const ratio = contrastRatio(literal(`context.${context}.${foreground}`), literal(`context.${context}.${background}`));
      assert.ok(ratio >= minimum, `${context}.${foreground}/${background} ${ratio.toFixed(2)} < ${minimum}`);
    }
    for (const status of ["active", "verified", "gate", "destructive"]) {
      const ratio = contrastRatio(literal(`context.${context}.${status}.text`), literal(`context.${context}.${status}.layer`));
      assert.ok(ratio >= 4.5, `${context}.${status} text contrast ${ratio.toFixed(2)} < 4.5`);
    }
  }
});

test("focus and status indicators remain visibly distinct", () => {
  for (const context of CONTEXTS) {
    const focus = contrastRatio(literal(`context.${context}.focus.ring`), literal(`context.${context}.canvas`));
    assert.ok(focus >= 3, `${context} focus contrast ${focus.toFixed(2)} < 3`);
    for (const status of ["active", "verified", "gate", "destructive"]) {
      const ratio = contrastRatio(literal(`context.${context}.${status}.indicator`), literal(`context.${context}.${status}.layer`));
      assert.ok(ratio >= 3, `${context}.${status} indicator contrast ${ratio.toFixed(2)} < 3`);
    }
  }
});

test("semantic hue assignments remain blue, green, copper, and red", () => {
  for (const context of CONTEXTS) {
    assert.match(node(`context.${context}.active.indicator`).$value, /spectral/);
    assert.match(node(`context.${context}.verified.indicator`).$value, /signal\.pass/);
    assert.match(node(`context.${context}.gate.indicator`).$value, /copper/);
    assert.match(node(`context.${context}.destructive.indicator`).$value, /signal\.fail/);
  }
});

test("immutable brand assets match path, bytes, digest, dimensions, and aspect", () => {
  assert.deepEqual(manifest.assets.map(({ id }) => id).sort(), [
    "docs-apple-touch-icon", "docs-favicon", "docs-logo", "site-apple-touch-icon", "site-favicon", "site-logo",
  ]);
  for (const asset of manifest.assets) {
    const bytes = readFileSync(join(repoRoot, asset.path));
    assert.equal(bytes.byteLength, asset.bytes, `${asset.id} byte length drifted`);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), asset.sha256, `${asset.id} digest drifted`);
    const dimensions = imageDimensions(bytes, extname(asset.path));
    assert.deepEqual(dimensions, { width: asset.width, height: asset.height }, `${asset.id} dimensions drifted`);
    assert.ok(Math.abs(asset.width / asset.height - asset.aspectRatio) < 1e-9, `${asset.id} aspect ratio drifted`);
    assert.ok(asset.minimumRenderedWidth > 0 && asset.minimumRenderedHeight > 0, `${asset.id} minimum size missing`);
    assert.ok(asset.clearSpacePx >= 0, `${asset.id} clear space missing`);
  }
});

test("brand presentation contract rejects filters, crops, clipping, replacement, and backing drift", () => {
  for (const asset of manifest.assets) {
    const valid = { path: asset.publicPath, backingToken: asset.backingToken, ...asset.presentation };
    validatePresentation(asset, valid);
    for (const invalid of [
      { ...valid, filter: "drop-shadow(0 0 10px blue)" },
      { ...valid, objectFit: "cover" },
      { ...valid, overflow: "hidden" },
      { ...valid, crop: true },
      { ...valid, preserveAspectRatio: false },
      { ...valid, path: "https://example.invalid/replacement.svg" },
      { ...valid, backingToken: "context.reading.canvas" },
    ]) assert.throws(() => validatePresentation(asset, invalid));
  }
});

test("application source keeps the immutable public asset paths", () => {
  const sources = [
    ["apps/site/src/components/site-header.astro", /src="\/ariadnev-logo\.webp"/],
    ["apps/site/src/layouts/base-layout.astro", /href="\/favicon\.png"/],
    ["apps/site/src/layouts/base-layout.astro", /href="\/apple-touch-icon\.png"/],
    ["apps/docs/src/components/docs-shell.tsx", /src="\/ariadnev-logo\.webp"/],
    ["apps/docs/src/app/layout.tsx", /url: "\/favicon\.png"/],
    ["apps/docs/src/app/layout.tsx", /\/apple-touch-icon\.png/],
  ];
  for (const [path, pattern] of sources) assert.match(readFileSync(join(repoRoot, path), "utf8"), pattern, `${path} asset path drifted`);
});

test("existing application palette debt is frozen until Phase 2 removes it", () => {
  const expected = new Map([
    ["apps/site/src/styles/site.css", 9],
    ["apps/docs/src/styles/docs.css", 79],
  ]);
  for (const [path, count] of expected) {
    const css = readFileSync(join(repoRoot, path), "utf8");
    const consumers = [...css.matchAll(/var\(--vcs-color-[a-z0-9-]+/g)];
    assert.equal(consumers.length, count, `${path} added or removed a direct palette consumer; update it only in Phase 2`);
  }
});

test("the one shipped logo-filter debt cannot spread before Phase 2", () => {
  const siteCss = readFileSync(join(repoRoot, "apps/site/src/styles/site.css"), "utf8");
  const docsCss = readFileSync(join(repoRoot, "apps/docs/src/styles/docs.css"), "utf8");
  assert.doesNotMatch(siteCss, /brand-logo[^{}]*\{[^}]*filter\s*:/s);
  assert.equal(
    [...docsCss.matchAll(/\.brand[^{}]*\.brand-logo\s*\{[^}]*filter\s*:/gs)].length,
    1,
    "the documented docs-logo filter debt changed before its Phase 2 removal",
  );
});
