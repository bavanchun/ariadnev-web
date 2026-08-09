import assert from "node:assert/strict";
import test from "node:test";

import { buildTokenModel } from "../../packages/tokens/scripts/build-tokens.mjs";
import { contrastRatio, oklchToLinearSrgb, readJson } from "./token-test-helpers.mjs";

const source = readJson("packages/tokens/src/tokens.json");
const model = buildTokenModel(source);
const contract = source.$extensions.vcskill;

test("source follows the frozen DTCG 2025.10 primitive contract", () => {
  assert.equal(source.$schema, "https://www.designtokens.org/schemas/2025.10/format.json");
  const supportedTypes = new Set(["color", "cubicBezier", "dimension", "duration", "fontFamily", "fontWeight", "number"]);
  for (const token of model.tokens.values()) {
    assert.ok(supportedTypes.has(token.type), token.path + " uses a non-DTCG type");
    if (token.type === "dimension" && typeof token.rawValue !== "string") {
      assert.ok(token.rawValue.unit === "px" || token.rawValue.unit === "rem", token.path + " uses an unsupported DTCG unit");
    }
  }
});

test("authored colors are private, gamut-safe OKLCH primitives", () => {
  let authoredColorCount = 0;
  for (const token of model.tokens.values()) {
    if (token.type !== "color" || typeof token.rawValue === "string") continue;
    authoredColorCount += 1;
    assert.equal(token.rawValue.colorSpace, "oklch", token.path + " must use OKLCH");
    assert.equal(token.rawValue.components.length, 3);
    assert.match(token.path, /^private\.color\./, token.path + " must remain private");
    for (const channel of oklchToLinearSrgb(token.rawValue)) {
      assert.ok(channel >= -1e-7 && channel <= 1 + 1e-7, token.path + " must remain inside sRGB gamut");
    }
  }
  assert.ok(authoredColorCount >= 12, "palette must cover the execution states");
  for (const surface of ["site", "docs"]) {
    for (const role of contract.requiredSurfaceRoles) {
      const token = model.tokens.get("surface." + surface + "." + role);
      assert.ok(token, "missing surface." + surface + "." + role);
      assert.equal(typeof token.rawValue, "string");
      assert.match(token.rawValue, /^\{[^}]+\}$/);
    }
  }
});

test("every declared contrast pair meets its WCAG contract", () => {
  for (const pair of contract.contrastPairs) {
    const foreground = model.resolve(pair.foreground).value;
    const background = model.resolve(pair.background).value;
    const ratio = contrastRatio(foreground, background);
    assert.ok(ratio + 1e-9 >= pair.minimum, pair.label + " resolved to " + ratio.toFixed(2) + ":1");
  }
});

test("contrast contracts reject transparent semantic colors", () => {
  const transparentFocus = structuredClone(source);
  transparentFocus.private.color.transparentFocus = {
    $value: { colorSpace: "oklch", components: [0.15, 0.018, 255], alpha: 0 },
  };
  transparentFocus.surface.site.color.focusContrast.$value = "{private.color.transparentFocus}";
  assert.throws(() => buildTokenModel(transparentFocus), /contrast colors must be opaque/);
  assert.throws(
    () => contrastRatio(transparentFocus.private.color.transparentFocus.$value, model.resolve("surface.site.color.canvas").value),
    /contrast colors must be opaque/,
  );
});

test("spacing, focus, touch, and reduced-motion contracts resolve measurably", () => {
  const dimensions = contract.spacingRhythm.map((path) => model.resolve(path).value);
  assert.deepEqual(dimensions.map((value) => value.unit), dimensions.map(() => "px"));
  const rhythm = dimensions.map((value) => value.value);
  assert.deepEqual(rhythm, [...rhythm].sort((left, right) => left - right));
  assert.ok(rhythm.every((value) => value % 4 === 0));

  const touch = model.resolve(contract.touchTarget.minimum).value;
  assert.equal(touch.unit, "px");
  assert.ok(touch.value >= 44);
  for (const path of [contract.focusRing.width, contract.focusRing.offset]) {
    const dimension = model.resolve(path).value;
    assert.equal(dimension.unit, "px");
    assert.ok(dimension.value >= 2);
  }
  assert.deepEqual(contract.focusRing.colors, ["color.focus", "color.focusContrast"]);
  for (const surface of ["site", "docs"]) {
    const ringColors = contract.focusRing.colors.map((role) => model.resolve("surface." + surface + "." + role).value);
    for (const backgroundRole of contract.requiredSurfaceRoles) {
      const background = model.resolve("surface." + surface + "." + backgroundRole).value;
      const bestRatio = Math.max(...ringColors.map((color) => contrastRatio(color, background)));
      assert.ok(
        bestRatio + 1e-9 >= contract.focusRing.minimumContrast,
        surface + " focus ring against " + backgroundRole + " resolved to " + bestRatio.toFixed(2) + ":1",
      );
    }
  }

  for (const [activePath, reducedPath] of Object.entries(contract.reducedMotionMap)) {
    assert.ok(model.tokens.has(activePath), "missing active motion token " + activePath);
    const reduced = model.resolve(reducedPath);
    if (reduced.type === "duration") assert.deepEqual(reduced.value, { value: 0, unit: "ms" });
    else assert.deepEqual(reduced.value, { value: 0, unit: "px" });
  }
});

test("aliases reject missing targets, cycles, and invalid color literals with exact paths", () => {
  const missing = structuredClone(source);
  missing.surface.site.color.link.$value = "{private.color.doesNotExist}";
  assert.throws(() => buildTokenModel(missing), /surface\.site\.color\.link.*private\.color\.doesNotExist/);

  const cyclic = structuredClone(source);
  cyclic.private.color.spectralBlueBright.$value = "{surface.site.color.link}";
  assert.throws(() => buildTokenModel(cyclic), /alias cycle.*private\.color\.spectralBlueBright/);

  const invalid = structuredClone(source);
  invalid.private.color.spectralBlue.$value = "#0066ff";
  assert.throws(() => buildTokenModel(invalid), /private\.color\.spectralBlue.*OKLCH/);

  const invisibleFocus = structuredClone(source);
  invisibleFocus.surface.site.color.focus.$value = "{private.color.copperBright}";
  invisibleFocus.surface.site.color.focusContrast.$value = "{private.color.copperBright}";
  assert.throws(() => buildTokenModel(invisibleFocus), /surface\.site\.color\..*dual-color focus ring contrast/);
});

test("the token vocabulary excludes prohibited visual shortcuts", () => {
  const sourceText = JSON.stringify(source).toLowerCase();
  assert.doesNotMatch(sourceText, /gradient|glass|orb|box-shadow|drop-shadow|rotating-headline/);
  const emittedNames = [...model.tokens.keys()].filter((path) => path.startsWith("shared.") || path.startsWith("surface."));
  assert.ok(emittedNames.every((path) => !path.includes("private.color")));
});
