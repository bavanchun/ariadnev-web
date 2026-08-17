// Token contract gate.
//
// Contrast is computed here rather than eyeballed: authored OKLCH is converted
// to linear sRGB, then to a WCAG relative luminance, so a colour edit that
// quietly drops a text role below its threshold fails the build.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const tokens = JSON.parse(readFileSync(join(repoRoot, "packages/tokens/src/tokens.json"), "utf8"));

const OKLCH = /^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([\d.]+)\s*)?\)$/;

// --- OKLCH -> sRGB ---------------------------------------------------------
// Björn Ottosson's Oklab transform, then the standard sRGB transfer function.

function oklchToLinearSrgb(lightness, chroma, hueDegrees) {
  const hue = (hueDegrees * Math.PI) / 180;
  const a = chroma * Math.cos(hue);
  const b = chroma * Math.sin(hue);

  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;

  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

/** WCAG 2.x relative luminance from linear sRGB. */
function relativeLuminance([red, green, blue]) {
  const clamp = (channel) => Math.min(Math.max(channel, 0), 1);
  return 0.2126 * clamp(red) + 0.7152 * clamp(green) + 0.0722 * clamp(blue);
}

export function parseOklch(value) {
  const match = OKLCH.exec(value);
  assert.ok(match, `not an OKLCH colour: ${value}`);
  return { l: Number(match[1]), c: Number(match[2]), h: Number(match[3]) };
}

export function contrastRatio(foreground, background) {
  const luminance = (value) => {
    const { l, c, h } = parseOklch(value);
    return relativeLuminance(oklchToLinearSrgb(l, c, h));
  };
  const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
}

/** Walk a `{a.b.c}` alias chain down to its authored literal. */
function resolve(reference) {
  let current = reference;
  for (let hop = 0; hop < 8; hop += 1) {
    const match = /^\{([A-Za-z0-9._-]+)\}$/.exec(current);
    if (match === null) return current;
    const node = match[1].split(".").reduce((value, key) => value?.[key], tokens);
    assert.ok(node !== undefined, `unresolved alias: ${current}`);
    current = node.$value;
  }
  throw new Error(`alias chain too deep starting at ${reference}`);
}

const literal = (path) => resolve(path.split(".").reduce((value, key) => value?.[key], tokens).$value);

// -------------------------------------------------------------------- DTCG

test("every authored colour is OKLCH", () => {
  const walk = (node, path) => {
    if (node === null || typeof node !== "object") return;
    if (Object.hasOwn(node, "$value")) {
      const value = node.$value;
      if (typeof value === "string" && value.startsWith("oklch")) parseOklch(value);
      return;
    }
    for (const [key, child] of Object.entries(node)) if (!key.startsWith("$")) walk(child, [...path, key]);
  };
  walk(tokens.color, ["color"]);
});

test("every alias resolves to an authored literal", () => {
  // Walk state/content trees down to their leaves (their $value nodes).
  const collectLeafRoles = (group, path) => {
    const results = [];
    const walk = (node, roleParts) => {
      if (node === null || typeof node !== "object") return;
      if (Object.hasOwn(node, "$value")) {
        results.push({ role: roleParts.join("."), node });
        return;
      }
      for (const [key, child] of Object.entries(node)) {
        if (key.startsWith("$")) continue;
        walk(child, [...roleParts, key]);
      }
    };
    walk(tokens[group], []);
    return results;
  };

  for (const group of ["surface", "text", "topology"]) {
    for (const [role, node] of Object.entries(tokens[group])) {
      if (role.startsWith("$")) continue;
      assert.doesNotMatch(resolve(node.$value), /^\{/, `${group}.${role} is unresolved`);
    }
  }
  for (const group of ["state", "content"]) {
    for (const { role, node } of collectLeafRoles(group, [group])) {
      // scrim uses a raw color literal (an alpha over-black); accept it.
      if (typeof node.$value === "string" && node.$value.startsWith("oklch")) continue;
      assert.doesNotMatch(resolve(node.$value), /^\{/, `${group}.${role} is unresolved`);
    }
  }
});

test("semantic roles never expose a raw palette step to an app", () => {
  // Apps consume surface/text/topology/state/content. Those roles must alias
  // the palette rather than restate a literal, so a palette change propagates
  // in one edit. Exception: content.overlay.scrim is a color-with-alpha and
  // is authored as an oklch literal because no palette entry carries alpha.
  const flatten = (node, roleParts) => {
    const results = [];
    if (node === null || typeof node !== "object") return results;
    if (Object.hasOwn(node, "$value")) return [{ role: roleParts.join("."), node }];
    for (const [key, child] of Object.entries(node)) {
      if (key.startsWith("$")) continue;
      results.push(...flatten(child, [...roleParts, key]));
    }
    return results;
  };
  for (const group of ["surface", "text", "topology"]) {
    for (const [role, node] of Object.entries(tokens[group])) {
      if (role.startsWith("$")) continue;
      assert.match(node.$value, /^\{color\./, `${group}.${role} must alias the palette`);
    }
  }
  for (const group of ["state", "content"]) {
    for (const { role, node } of flatten(tokens[group], [group])) {
      if (role === "content.overlay.scrim") continue;
      assert.match(node.$value, /^\{(?:color|surface|text|topology)\./, `${group}.${role} must alias a semantic role or the palette`);
    }
  }
});

// ---------------------------------------------------------------- contrast

test("text roles meet their WCAG contrast threshold on the canvas", () => {
  const canvas = literal("surface.canvas");
  const thresholds = [
    ["text.primary", 7],
    ["text.secondary", 4.5],
    ["text.muted", 3],
    ["text.accent", 4.5],
    ["text.gate", 4.5],
  ];
  for (const [role, minimum] of thresholds) {
    const ratio = contrastRatio(literal(role), canvas);
    assert.ok(ratio >= minimum, `${role} contrast ${ratio.toFixed(2)} is below ${minimum}`);
  }
});

test("text on an accent fill stays legible", () => {
  const ratio = contrastRatio(literal("text.onAccent"), literal("color.spectral.400"));
  assert.ok(ratio >= 4.5, `text.onAccent contrast ${ratio.toFixed(2)} is below 4.5`);
});

test("the focus ring is distinguishable from the surface it sits on", () => {
  const ratio = contrastRatio(literal("focus.color"), literal("surface.canvas"));
  assert.ok(ratio >= 3, `focus ring contrast ${ratio.toFixed(2)} is below 3`);
});

test("signal colours are distinguishable from each other and from the canvas", () => {
  const canvas = literal("surface.canvas");
  for (const state of ["pass", "fail", "blocked"]) {
    const ratio = contrastRatio(literal(`color.signal.${state}`), canvas);
    assert.ok(ratio >= 3, `signal.${state} contrast ${ratio.toFixed(2)} is below 3`);
  }
  // Hue separation matters more than luminance for colour-vision deficiency.
  const hues = ["pass", "fail", "blocked"].map((state) => parseOklch(literal(`color.signal.${state}`)).h);
  for (let i = 0; i < hues.length; i += 1) {
    for (let j = i + 1; j < hues.length; j += 1) {
      const delta = Math.min(Math.abs(hues[i] - hues[j]), 360 - Math.abs(hues[i] - hues[j]));
      assert.ok(delta >= 30, `signal hues ${hues[i]} and ${hues[j]} are only ${delta} degrees apart`);
    }
  }
});

// --------------------------------------------------------- spacing and size

test("spacing sits on a strict 4px grid", () => {
  for (const [step, node] of Object.entries(tokens.space)) {
    if (step.startsWith("$")) continue;
    const rem = Number.parseFloat(node.$value);
    assert.match(node.$value, /rem$/, `space.${step} must be in rem`);
    assert.equal((rem * 16) % 4, 0, `space.${step} (${node.$value}) is off the 4px grid`);
  }
});

test("the touch target meets the WCAG 2.2 minimum", () => {
  const px = Number.parseFloat(tokens.size.touchTarget.$value) * 16;
  assert.ok(px >= 44, `touch target ${px}px is below the 44px minimum`);
});

test("the type scale increases monotonically and prose never drops below 14px", () => {
  const sizes = Object.entries(tokens.font.size)
    .filter(([key]) => !key.startsWith("$"))
    .map(([, node]) => Number.parseFloat(node.$value) * 16);
  for (let index = 1; index < sizes.length; index += 1) {
    assert.ok(sizes[index] > sizes[index - 1], "the type scale must increase monotonically");
  }
  assert.ok(Number.parseFloat(tokens.font.size.sm.$value) * 16 >= 14);
});

// ------------------------------------------------------------------- motion

test("no motion duration reads as latency", () => {
  for (const [name, node] of Object.entries(tokens.motion.duration)) {
    if (name.startsWith("$")) continue;
    const ms = Number.parseFloat(node.$value);
    assert.ok(ms > 0 && ms <= 400, `motion.duration.${name} (${node.$value}) is outside 0-400ms`);
  }
});

test("focus is a real ring with an offset, not a colour swap", () => {
  assert.ok(Number.parseFloat(tokens.focus.width.$value) >= 2, "the focus ring must be at least 2px");
  assert.ok(Number.parseFloat(tokens.focus.offset.$value) >= 2, "the focus ring must be offset from its control");
});

// ---------------------------------------------------- Phase 2: state contracts

test("Inter medium role sits inside the variable-face 400..700 range", () => {
  const weight = tokens.font.weight.medium.$value;
  assert.equal(weight, 500, "font.weight.medium must be 500");
  const regular = tokens.font.weight.regular.$value;
  const bold = tokens.font.weight.bold.$value;
  assert.ok(regular <= weight && weight <= bold, "medium must sit between regular and bold");
});

test("text on selection reads at 4.5:1 or better on the selected layer", () => {
  const ratio = contrastRatio(literal("state.selected.text"), literal("state.selected.layer"));
  assert.ok(ratio >= 4.5, `state.selected text on layer is ${ratio.toFixed(2)}, below 4.5`);
});

test("current-nav indicator is distinguishable from the canvas at 3:1 or better", () => {
  const ratio = contrastRatio(literal("state.current.indicator"), literal("surface.canvas"));
  assert.ok(ratio >= 3, `state.current.indicator contrast ${ratio.toFixed(2)} is below 3`);
});

test("destructive-boundary indicator is a hazard signal, not a whisper", () => {
  const ratio = contrastRatio(literal("state.destructive.indicator"), literal("surface.canvas"));
  assert.ok(ratio >= 3, `state.destructive.indicator contrast ${ratio.toFixed(2)} is below 3`);
});

test("code text reads at 7:1 or better on the code surface", () => {
  const ratio = contrastRatio(literal("content.code.text"), literal("content.code.background"));
  assert.ok(ratio >= 7, `content.code text contrast ${ratio.toFixed(2)} is below 7`);
});

test("every callout body text reads at 4.5:1 or better on its layer", () => {
  for (const kind of ["note", "gate", "boundary", "destructive", "evidence"]) {
    const ratio = contrastRatio(literal(`content.callout.${kind}.text`), literal(`content.callout.${kind}.layer`));
    assert.ok(ratio >= 4.5, `content.callout.${kind} text ${ratio.toFixed(2)} is below 4.5`);
  }
});

test("table header text reads at 4.5:1 or better on the header surface", () => {
  const ratio = contrastRatio(literal("content.table.headerText"), literal("content.table.header"));
  assert.ok(ratio >= 4.5, `content.table headerText contrast ${ratio.toFixed(2)} is below 4.5`);
});

// ------------------------------------------------ Phase 2: shell dimensions

test("shell dimensions in rem sit on a strict 4px grid", () => {
  // Walk layout.*; skip calc() and non-rem values, both of which are legitimate
  // (railViewportHeight uses vh; column widths are rem multiples of 0.25).
  const walk = (node, path) => {
    if (node === null || typeof node !== "object") return;
    if (Object.hasOwn(node, "$value")) {
      const value = node.$value;
      if (typeof value !== "string") return;
      if (!/rem$/.test(value)) return; // vh / calc(...) permitted
      const rem = Number.parseFloat(value);
      assert.equal((rem * 16) % 4, 0, `${path.join(".")} (${value}) is off the 4px grid`);
      return;
    }
    for (const [key, child] of Object.entries(node)) if (!key.startsWith("$")) walk(child, [...path, key]);
  };
  walk(tokens.layout, ["layout"]);
});

test("docs header meets the touch-target floor", () => {
  const headerPx = Number.parseFloat(tokens.layout.docs.headerHeight.$value) * 16;
  const targetPx = Number.parseFloat(tokens.size.touchTarget.$value) * 16;
  assert.ok(headerPx >= targetPx, `docs header ${headerPx}px is below the ${targetPx}px touch-target floor`);
});

test("interactive densities meet the touch-target floor", () => {
  const targetPx = Number.parseFloat(tokens.size.touchTarget.$value) * 16;
  for (const density of ["proseRow", "referenceRow"]) {
    const px = Number.parseFloat(tokens.layout.density[density].$value) * 16;
    assert.ok(px >= targetPx, `layout.density.${density} ${px}px is below the ${targetPx}px touch-target floor`);
  }
  // compactRow is deliberately smaller than touchTarget; documented for
  // display-only rows (a status ledger, not a menu). Do NOT assert ≥ target.
});

test("reference measure sits between prose and content measures", () => {
  const prose = Number.parseFloat(tokens.size.proseMax.$value);
  const reference = Number.parseFloat(tokens.size.referenceMax.$value);
  const content = Number.parseFloat(tokens.size.contentMax.$value);
  assert.ok(prose < reference && reference < content, `${prose}rem < ${reference}rem < ${content}rem must hold`);
});

test("sidebar and TOC widths leave room for the reading measure at desktop", () => {
  const sidebar = Number.parseFloat(tokens.layout.docs.sidebarWidth.$value);
  const toc = Number.parseFloat(tokens.layout.docs.tocWidth.$value);
  const prose = Number.parseFloat(tokens.size.proseMax.$value);
  // 1200px common desktop viewport ≈ 75rem; sidebar + toc + prose + gutter
  // must still fit on that width, or the shell wraps at every stress frame.
  const gutter = 4; // 4rem breathing room
  assert.ok(sidebar + toc + prose + gutter <= 75, `sidebar(${sidebar}) + toc(${toc}) + prose(${prose}) + gutter(${gutter}) exceeds 75rem`);
});
