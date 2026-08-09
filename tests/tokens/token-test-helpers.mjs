import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export const ROOT = resolve(import.meta.dirname, "../..");

export function readJson(relativePath) {
  return JSON.parse(readFileSync(resolve(ROOT, relativePath), "utf8"));
}

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function compareCodePoints(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function corpusCodePoints(corpus) {
  if (corpus.schemaVersion !== 1 || typeof corpus.profileId !== "string") {
    throw new Error("invalid glyph corpus identity");
  }
  const codePoints = new Set();
  for (const key of Object.keys(corpus.segments).sort(compareCodePoints)) {
    for (const character of corpus.segments[key]) codePoints.add(character.codePointAt(0));
  }
  for (const value of corpus.combiningCodePoints) {
    if (!/^U\+[0-9A-F]{4,6}$/.test(value)) throw new Error("invalid corpus code point " + value);
    codePoints.add(Number.parseInt(value.slice(2), 16));
  }
  return [...codePoints].sort((left, right) => left - right);
}

export function parseOklch(value) {
  if (
    value === null ||
    typeof value !== "object" ||
    value.colorSpace !== "oklch" ||
    !Array.isArray(value.components) ||
    value.components.length !== 3 ||
    value.components.some((component) => typeof component !== "number" || !Number.isFinite(component))
  ) {
    throw new Error("invalid DTCG OKLCH value");
  }
  const alpha = value.alpha ?? 1;
  if (typeof alpha !== "number" || !Number.isFinite(alpha) || alpha < 0 || alpha > 1) {
    throw new Error("invalid DTCG OKLCH alpha");
  }
  return { lightness: value.components[0], chroma: value.components[1], hue: value.components[2], alpha };
}

export function oklchToLinearSrgb(value) {
  const { lightness, chroma, hue } = parseOklch(value);
  const radians = hue * Math.PI / 180;
  const a = chroma * Math.cos(radians);
  const b = chroma * Math.sin(radians);
  const lPrime = lightness + 0.3963377774 * a + 0.2158037573 * b;
  const mPrime = lightness - 0.1055613458 * a - 0.0638541728 * b;
  const sPrime = lightness - 0.0894841775 * a - 1.291485548 * b;
  const l = lPrime ** 3;
  const m = mPrime ** 3;
  const s = sPrime ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

export function relativeLuminance(value) {
  const color = parseOklch(value);
  if (color.alpha !== 1) throw new Error("contrast colors must be opaque");
  const [red, green, blue] = oklchToLinearSrgb(value);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

export function contrastRatio(foreground, background) {
  const values = [relativeLuminance(foreground), relativeLuminance(background)].sort((left, right) => right - left);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

export function cssDeclarations(css) {
  const base = css.split("@media (prefers-reduced-motion: reduce)")[0];
  return new Map([...base.matchAll(/^\s+(--vc-[a-z0-9-]+):\s*(.+);$/gm)].map((match) => [match[1], match[2]]));
}
