import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const PACKAGE_ROOT = resolve(dirname(SCRIPT_PATH), "..");
const DEFAULT_INPUT_PATH = resolve(PACKAGE_ROOT, "src/tokens.json");
const DEFAULT_FONT_MANIFEST_PATH = resolve(PACKAGE_ROOT, "src/font-manifest.json");
const DEFAULT_OUTPUT_DIR = resolve(PACKAGE_ROOT, "dist");
const GENERATED_BANNER = "/* Generated from src/tokens.json and src/font-manifest.json. Do not edit. */";
const GENERATED_NOTICE = "Generated from src/tokens.json and src/font-manifest.json. Do not edit.";
const ALIAS = /^\{([A-Za-z0-9._-]+)\}$/;
const TOKEN_KEY = /^[A-Za-z0-9_-]+$/;
const DIMENSION_UNITS = new Set(["px", "rem"]);
const DURATION_UNITS = new Set(["ms", "s"]);
const GENERIC_FONT_FAMILIES = new Set([
  "cursive",
  "fantasy",
  "monospace",
  "sans-serif",
  "serif",
  "system-ui",
  "ui-monospace",
  "ui-sans-serif",
  "ui-serif",
]);

/**
 * @typedef {Record<string, any>} JsonObject
 * @typedef {{ path: string, type: string, rawValue: any }} Token
 * @typedef {Token & { value: any }} ResolvedToken
 * @typedef {{ tokens: Map<string, Token>, resolve: (path: string) => ResolvedToken }} TokenModel
 * @typedef {{
 *   role: string,
 *   cssFamily: string,
 *   sourceFamily: string,
 *   style: string,
 *   weight: { min: number, max: number },
 *   file: string
 * }} FontEntry
 * @typedef {{
 *   inputPath?: string,
 *   fontManifestPath?: string,
 *   outputDir?: string,
 *   check?: boolean
 * }} BuildOptions
 * @typedef {"inputPath" | "fontManifestPath" | "outputDir"} PathOption
 */

/** @param {string} left @param {string} right */
function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

/** @param {unknown} value @returns {value is JsonObject} */
function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** @param {string} path @param {string} message @returns {never} */
function fail(path, message) {
  throw new Error((path || "<root>") + ": " + message);
}

/** @param {JsonObject} value */
function sortedKeys(value) {
  return Object.keys(value).sort(compareText);
}

/** @param {number} value */
function formatNumber(value) {
  return Object.is(value, -0) ? "0" : String(value);
}

/** @param {unknown} value @param {string} path */
function parseOklch(value, path) {
  if (!isObject(value) || value.colorSpace !== "oklch" || !Array.isArray(value.components) || value.components.length !== 3) {
    fail(path, "color values must be DTCG OKLCH objects or aliases");
  }
  const allowedKeys = new Set(["alpha", "colorSpace", "components"]);
  if (Object.keys(value).some((key) => !allowedKeys.has(key))) fail(path, "OKLCH value contains unsupported properties");
  const [lightness, chroma, hue] = value.components;
  if (![lightness, chroma, hue].every((component) => typeof component === "number" && Number.isFinite(component))) {
    fail(path, "OKLCH components must be finite numbers");
  }
  if (lightness < 0 || lightness > 1) fail(path, "OKLCH lightness must be between 0 and 1");
  if (chroma < 0 || chroma > 0.4) fail(path, "OKLCH chroma must be between 0 and 0.4");
  if (hue < 0 || hue >= 360) fail(path, "OKLCH hue must be between 0 and less than 360");
  if (value.alpha !== undefined && (typeof value.alpha !== "number" || value.alpha < 0 || value.alpha > 1)) {
    fail(path, "OKLCH alpha must be between 0 and 1");
  }
  return { lightness, chroma, hue, alpha: value.alpha ?? 1 };
}

/** @param {unknown} value @param {string} path @returns {[number, number, number]} */
function oklchToLinearSrgb(value, path) {
  const { lightness, chroma, hue } = parseOklch(value, path);
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

/** @param {unknown} value @param {string} path */
function relativeLuminance(value, path) {
  const color = parseOklch(value, path);
  if (color.alpha !== 1) fail(path, "contrast colors must be opaque");
  const [red, green, blue] = oklchToLinearSrgb(value, path);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

/** @param {unknown} foreground @param {unknown} background @param {string} path */
function contrastRatio(foreground, background, path) {
  const values = [
    relativeLuminance(foreground, path + ".foreground"),
    relativeLuminance(background, path + ".background"),
  ].sort((left, right) => right - left);
  return ((values[0] ?? 0) + 0.05) / ((values[1] ?? 0) + 0.05);
}

/** @param {unknown} value @param {Set<string>} units @param {string} path */
function validateUnitValue(value, units, path) {
  if (!isObject(value) || typeof value.value !== "number" || !Number.isFinite(value.value)) {
    fail(path, "expected a finite numeric value and unit");
  }
  if (typeof value.unit !== "string" || !units.has(value.unit)) fail(path, "unsupported unit");
}

/** @param {Token} token */
function validateRawValue(token) {
  const { path, type, rawValue } = token;
  if (typeof rawValue === "string" && ALIAS.test(rawValue)) return;
  switch (type) {
    case "color": {
      const channels = oklchToLinearSrgb(rawValue, path);
      if (channels.some((channel) => channel < -1e-7 || channel > 1 + 1e-7)) {
        fail(path, "OKLCH value must remain inside the sRGB gamut");
      }
      break;
    }
    case "dimension":
      validateUnitValue(rawValue, DIMENSION_UNITS, path);
      break;
    case "duration":
      validateUnitValue(rawValue, DURATION_UNITS, path);
      if (rawValue.value < 0) fail(path, "duration cannot be negative");
      break;
    case "fontFamily":
      if (!Array.isArray(rawValue) || rawValue.length < 2 || rawValue.some((value) => typeof value !== "string" || value.length === 0)) {
        fail(path, "fontFamily must be a non-empty fallback list");
      }
      break;
    case "fontWeight":
      if (typeof rawValue !== "number" || !Number.isFinite(rawValue) || rawValue < 1 || rawValue > 1000) {
        fail(path, "fontWeight must be between 1 and 1000");
      }
      break;
    case "number":
      if (typeof rawValue !== "number" || !Number.isFinite(rawValue)) fail(path, "number must be finite");
      break;
    case "cubicBezier":
      if (!Array.isArray(rawValue) || rawValue.length !== 4 || rawValue.some((value) => typeof value !== "number" || !Number.isFinite(value))) {
        fail(path, "cubicBezier must contain four finite numbers");
      }
      if (Number(rawValue[0]) < 0 || Number(rawValue[0]) > 1 || Number(rawValue[2]) < 0 || Number(rawValue[2]) > 1) {
        fail(path, "cubicBezier x coordinates must be between 0 and 1");
      }
      break;
    default:
      fail(path, "unsupported DTCG type " + type);
  }
}

/** @param {string} segment */
function kebabSegment(segment) {
  return segment.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}

/** @param {string} path */
function tokenPathToCssSuffix(path) {
  return path.split(".").map(kebabSegment).join("-");
}

/** @param {string} path */
function tokenPathToDocumentedAlias(path) {
  return path.split(".").map(kebabSegment).join(".");
}

/** @param {string} path */
function cssVariableName(path) {
  const segments = path.split(".");
  if (segments[0] === "shared") return "--vc-" + tokenPathToCssSuffix(segments.slice(1).join("."));
  if (segments[0] === "surface" && (segments[1] === "site" || segments[1] === "docs")) {
    return "--vc-" + tokenPathToCssSuffix(segments.slice(2).join("."));
  }
  fail(path, "only shared and surface tokens can be emitted");
}

/** @param {Token | ResolvedToken} source @param {Token | ResolvedToken} target */
function assertSameType(source, target) {
  if (source.type !== target.type) {
    fail(source.path, "alias type " + source.type + " does not match " + target.path + " (" + target.type + ")");
  }
}

/** @param {JsonObject} document @param {TokenModel} model */
function validateContracts(document, model) {
  const contract = document.$extensions && document.$extensions.vcskill;
  if (!isObject(contract)) fail("$extensions.vcskill", "contract is required");
  if (!Array.isArray(contract.requiredSurfaceRoles) || contract.requiredSurfaceRoles.length === 0) {
    fail("$extensions.vcskill.requiredSurfaceRoles", "must be a non-empty array");
  }
  const expectedSurfacePaths = new Set(contract.requiredSurfaceRoles);
  for (const surface of ["site", "docs"]) {
    const prefix = "surface." + surface + ".";
    const actual = new Set(
      [...model.tokens.keys()]
        .filter((path) => path.startsWith(prefix))
        .map((path) => path.slice(prefix.length)),
    );
    if (actual.size !== expectedSurfacePaths.size || [...expectedSurfacePaths].some((path) => !actual.has(path))) {
      fail("surface." + surface, "semantic roles do not match requiredSurfaceRoles");
    }
  }

  if (!Array.isArray(contract.surfaceAliases)) fail("$extensions.vcskill.surfaceAliases", "must be an array");
  const documentedAliases = new Set(contract.surfaceAliases);
  const expectedAliases = new Set(contract.requiredSurfaceRoles.map(tokenPathToDocumentedAlias));
  if (documentedAliases.size !== expectedAliases.size || [...expectedAliases].some((name) => !documentedAliases.has(name))) {
    fail("$extensions.vcskill.surfaceAliases", "must document every emitted surface role");
  }

  if (!Array.isArray(contract.contrastPairs)) fail("$extensions.vcskill.contrastPairs", "must be an array");
  for (let index = 0; index < contract.contrastPairs.length; index += 1) {
    const pair = contract.contrastPairs[index];
    const path = "$extensions.vcskill.contrastPairs." + index;
    if (!isObject(pair) || typeof pair.label !== "string" || typeof pair.foreground !== "string" || typeof pair.background !== "string") {
      fail(path, "invalid contrast pair");
    }
    if (typeof pair.minimum !== "number" || pair.minimum < 3) fail(path, "minimum contrast must be at least 3");
    const foreground = model.resolve(pair.foreground);
    const background = model.resolve(pair.background);
    if (foreground.type !== "color" || background.type !== "color") fail(path, "contrast endpoints must be colors");
    const ratio = contrastRatio(foreground.value, background.value, path);
    if (ratio + 1e-9 < pair.minimum) fail(path, pair.label + " contrast is " + ratio.toFixed(2) + ":1");
  }

  if (!Array.isArray(contract.spacingRhythm)) fail("$extensions.vcskill.spacingRhythm", "must be an array");
  let prior = -Infinity;
  for (const path of contract.spacingRhythm) {
    const token = model.resolve(path);
    if (token.type !== "dimension" || token.value.unit !== "px" || token.value.value % 4 !== 0 || token.value.value <= prior) {
      fail(path, "spacing rhythm must be ascending 4px multiples");
    }
    prior = token.value.value;
  }

  const touch = model.resolve(contract.touchTarget.minimum);
  if (touch.type !== "dimension" || touch.value.unit !== "px" || touch.value.value < 44) {
    fail(contract.touchTarget.minimum, "touch target must be at least 44px");
  }
  for (const path of [contract.focusRing.width, contract.focusRing.offset]) {
    const token = model.resolve(path);
    if (token.type !== "dimension" || token.value.unit !== "px" || token.value.value < 2) {
      fail(path, "focus dimension must be at least 2px");
    }
  }
  const focusColors = contract.focusRing.colors;
  if (!Array.isArray(focusColors) || focusColors.length !== 2 || new Set(focusColors).size !== 2) {
    fail("$extensions.vcskill.focusRing.colors", "must name two distinct semantic color roles");
  }
  for (const role of focusColors) {
    if (typeof role !== "string") fail("$extensions.vcskill.focusRing.colors", "roles must be strings");
  }
  if (typeof contract.focusRing.minimumContrast !== "number" || contract.focusRing.minimumContrast < 3) {
    fail("$extensions.vcskill.focusRing.minimumContrast", "must be at least 3");
  }
  /** @type {string[]} */
  const focusColorRoles = focusColors;
  for (const surface of ["site", "docs"]) {
    /** @type {unknown[]} */
    const ringColors = focusColorRoles.map((role) => {
      const token = model.resolve("surface." + surface + "." + role);
      if (token.type !== "color") fail("surface." + surface + "." + role, "focus ring role must be a color");
      return token.value;
    });
    for (const backgroundRole of contract.requiredSurfaceRoles) {
      const background = model.resolve("surface." + surface + "." + backgroundRole);
      if (background.type !== "color") continue;
      const bestRatio = Math.max(...ringColors.map((color) => contrastRatio(
        color,
        background.value,
        "$extensions.vcskill.focusRing." + surface + "." + backgroundRole,
      )));
      if (bestRatio + 1e-9 < contract.focusRing.minimumContrast) {
        fail(
          "surface." + surface + "." + backgroundRole,
          "dual-color focus ring contrast is " + bestRatio.toFixed(2) + ":1",
        );
      }
    }
  }

  if (!isObject(contract.reducedMotionMap) || Object.keys(contract.reducedMotionMap).length !== 6) {
    fail("$extensions.vcskill.reducedMotionMap", "must map all entrance, feedback, and traversal motion");
  }
  for (const [activePath, reducedPath] of Object.entries(contract.reducedMotionMap)) {
    const active = model.resolve(activePath);
    const reduced = model.resolve(reducedPath);
    assertSameType(active, reduced);
    if (reduced.type === "duration" && (reduced.value.value !== 0 || reduced.value.unit !== "ms")) {
      fail(reducedPath, "reduced duration must be 0ms");
    }
    if (reduced.type === "dimension" && (reduced.value.value !== 0 || reduced.value.unit !== active.value.unit)) {
      fail(reducedPath, "reduced motion distance must preserve its unit and resolve to zero");
    }
    if (reduced.type !== "duration" && reduced.type !== "dimension") fail(reducedPath, "unsupported reduced motion type");
  }
}

/** @param {unknown} document @returns {TokenModel} */
export function buildTokenModel(document) {
  if (!isObject(document)) fail("", "token document must be an object");
  /** @type {Map<string, Token>} */
  const tokens = new Map();

  /** @param {JsonObject} node @param {string[]} parts @param {string | undefined} inheritedType */
  function walk(node, parts, inheritedType) {
    const path = parts.join(".");
    if (!isObject(node)) fail(path, "token groups and leaves must be objects");
    if (node.$type !== undefined && typeof node.$type !== "string") fail(path, "$type must be a string");
    const type = node.$type || inheritedType;
    if (Object.prototype.hasOwnProperty.call(node, "$value")) {
      if (!path) fail(path, "root cannot be a token");
      if (!type) fail(path, "token requires an explicit or inherited $type");
      for (const key of Object.keys(node)) {
        if (!key.startsWith("$")) fail(path, "token leaves cannot contain child key " + key);
      }
      const token = { path, type, rawValue: node.$value };
      validateRawValue(token);
      if (tokens.has(path)) fail(path, "duplicate token path");
      tokens.set(path, token);
      return;
    }
    for (const key of sortedKeys(node)) {
      if (key.startsWith("$")) continue;
      if (!TOKEN_KEY.test(key)) fail(path, "invalid token key " + key);
      walk(node[key], [...parts, key], type);
    }
  }

  for (const group of ["private", "shared", "surface"]) {
    if (!isObject(document[group])) fail(group, "required token group is missing");
    walk(document[group], [group], undefined);
  }

  /** @type {Map<string, ResolvedToken>} */
  const memo = new Map();
  /** @param {string} path @param {string[]} stack @returns {ResolvedToken} */
  function resolveToken(path, stack = []) {
    const cached = memo.get(path);
    if (cached) return cached;
    const token = tokens.get(path);
    if (!token) fail(path, "token does not exist");
    if (stack.includes(path)) throw new Error("alias cycle at " + path + ": " + [...stack, path].join(" -> "));
    const match = typeof token.rawValue === "string" ? ALIAS.exec(token.rawValue) : null;
    let value = token.rawValue;
    if (match) {
      const targetPath = match[1];
      if (!targetPath) fail(path, "alias target is empty");
      const target = tokens.get(targetPath);
      if (!target) fail(path, "alias target " + targetPath + " does not exist");
      const resolvedTarget = resolveToken(targetPath, [...stack, path]);
      assertSameType(token, resolvedTarget);
      value = resolvedTarget.value;
    }
    /** @type {ResolvedToken} */
    const resolvedToken = { ...token, value };
    memo.set(path, resolvedToken);
    return resolvedToken;
  }

  const model = { tokens, resolve: resolveToken };
  for (const path of [...tokens.keys()].sort(compareText)) resolveToken(path);
  validateContracts(document, model);
  return model;
}

/** @param {string} value */
function quoteCssString(value) {
  return '"' + value.replaceAll("\\", "\\\\").replaceAll('"', '\\"') + '"';
}

/** @param {ResolvedToken} token */
function serializeValue(token) {
  const { type, value } = token;
  switch (type) {
    case "color": {
      const color = parseOklch(value, token.path);
      const base = "oklch(" + formatNumber(color.lightness) + " " + formatNumber(color.chroma) + " " + formatNumber(color.hue);
      return base + (color.alpha === 1 ? ")" : " / " + formatNumber(color.alpha) + ")");
    }
    case "dimension":
    case "duration":
      return formatNumber(value.value) + value.unit;
    case "fontFamily": {
      /** @type {string[]} */
      const families = value;
      return families.map((family) => GENERIC_FONT_FAMILIES.has(family) ? family : quoteCssString(family)).join(", ");
    }
    case "fontWeight":
    case "number":
      return formatNumber(value);
    case "cubicBezier":
      return "cubic-bezier(" + value.map(formatNumber).join(", ") + ")";
    default:
      fail(token.path, "cannot serialize type " + type);
  }
}

/** @param {TokenModel} model @param {string} prefix @returns {Map<string, string>} */
function collectDeclarations(model, prefix) {
  /** @type {Map<string, string>} */
  const declarations = new Map();
  for (const path of [...model.tokens.keys()].filter((value) => value.startsWith(prefix)).sort(compareText)) {
    const name = cssVariableName(path);
    if (declarations.has(name)) fail(path, "duplicate CSS variable " + name);
    declarations.set(name, serializeValue(model.resolve(path)));
  }
  return declarations;
}

/** @param {Map<string, string>} shared @param {Map<string, string>} surface @returns {Map<string, string>} */
function mergeDeclarations(shared, surface) {
  const merged = new Map(shared);
  for (const [name, value] of surface) {
    if (merged.has(name)) fail(name, "surface variable collides with shared variable");
    merged.set(name, value);
  }
  return new Map([...merged.entries()].sort(([left], [right]) => compareText(left, right)));
}

/** @param {unknown} manifest @param {TokenModel} model @returns {FontEntry[]} */
function validateFontManifest(manifest, model) {
  if (!isObject(manifest) || manifest.schemaVersion !== 1 || !Array.isArray(manifest.fonts)) {
    fail("font-manifest.json", "invalid manifest");
  }
  /** @type {FontEntry[]} */
  const entries = manifest.fonts;
  const roles = entries.map((entry) => entry.role);
  if (roles.join(",") !== "body,display,mono") fail("font-manifest.json.fonts", "roles must be body, display, mono");
  for (const entry of entries) {
    const path = "font-manifest.json.fonts." + entry.role;
    if (!isObject(entry.weight) || typeof entry.weight.min !== "number" || typeof entry.weight.max !== "number" || entry.weight.min > entry.weight.max) {
      fail(path + ".weight", "invalid weight range");
    }
    if (entry.style !== "normal") fail(path + ".style", "only normal font assets are supported");
    if (typeof entry.cssFamily !== "string" || !/^VC [A-Za-z ]+$/.test(entry.cssFamily)) fail(path + ".cssFamily", "invalid CSS family");
    if (typeof entry.file !== "string" || !/^assets\/fonts\/[a-z-]+\.woff2$/.test(entry.file)) fail(path + ".file", "invalid local WOFF2 path");
    const familyToken = model.resolve("shared.font.family." + entry.role);
    if (familyToken.type !== "fontFamily" || familyToken.value[0] !== entry.cssFamily) {
      fail(path + ".cssFamily", "must match shared.font.family." + entry.role);
    }
  }
  return [...entries].sort((left, right) => compareText(left.role, right.role));
}

/** @param {FontEntry[]} fonts */
function renderFontFaces(fonts) {
  return fonts.map((font) => [
    "@font-face {",
    "  font-family: " + quoteCssString(font.cssFamily) + ";",
    "  font-style: " + font.style + ";",
    "  font-weight: " + formatNumber(font.weight.min) + " " + formatNumber(font.weight.max) + ";",
    "  font-display: swap;",
    "  src: url(\"../" + font.file + "\") format(\"woff2\");",
    "}",
  ].join("\n")).join("\n\n");
}

/** @param {Map<string, string>} declarations */
function renderDeclarationBlock(declarations) {
  return [...declarations.entries()].map(([name, value]) => "  " + name + ": " + value + ";").join("\n");
}

/** @param {JsonObject} document @param {TokenModel} model */
function renderReducedMotion(document, model) {
  /** @type {[string, string][]} */
  const mappings = Object.entries(document.$extensions.vcskill.reducedMotionMap)
    .map(([activePath, reducedPath]) => /** @type {[string, string]} */ ([
      cssVariableName(activePath),
      serializeValue(model.resolve(reducedPath)),
    ]))
    .sort(([left], [right]) => compareText(left, right));
  return [
    "@media (prefers-reduced-motion: reduce) {",
    "  :root {",
    ...mappings.map(([name, value]) => "    " + name + ": " + value + ";"),
    "  }",
    "}",
  ].join("\n");
}

/** @param {Iterable<[string, string]>} entries */
function stableObject(entries) {
  return Object.fromEntries([...entries].sort(([left], [right]) => compareText(left, right)));
}

/** @param {FontEntry[]} fonts @param {Map<string, string>} declarations @param {string} reducedMotion */
function renderCss(fonts, declarations, reducedMotion) {
  return [
    GENERATED_BANNER,
    "",
    renderFontFaces(fonts),
    "",
    ":root {",
    renderDeclarationBlock(declarations),
    "}",
    "",
    reducedMotion,
    "",
  ].join("\n");
}

/** @param {string} path @returns {JsonObject} */
function readJson(path) {
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(path + ": " + (error instanceof Error ? error.message : String(error)));
  }
  return parsed;
}

/** @param {BuildOptions} options @returns {Record<string, string>} */
export function buildTokens(options = {}) {
  const inputPath = resolve(options.inputPath || DEFAULT_INPUT_PATH);
  const fontManifestPath = resolve(options.fontManifestPath || DEFAULT_FONT_MANIFEST_PATH);
  const outputDir = resolve(options.outputDir || DEFAULT_OUTPUT_DIR);
  const document = readJson(inputPath);
  const manifest = readJson(fontManifestPath);
  const model = buildTokenModel(document);
  const fonts = validateFontManifest(manifest, model);
  const shared = collectDeclarations(model, "shared.");
  const site = collectDeclarations(model, "surface.site.");
  const docs = collectDeclarations(model, "surface.docs.");
  if ([...site.keys()].join("\n") !== [...docs.keys()].join("\n")) fail("surface", "site and docs CSS variable sets differ");
  const siteDeclarations = mergeDeclarations(shared, site);
  const docsDeclarations = mergeDeclarations(shared, docs);
  const reducedMotion = renderReducedMotion(document, model);
  /** @type {Record<string, string>} */
  const outputs = {
    "docs.css": renderCss(fonts, docsDeclarations, reducedMotion),
    "site.css": renderCss(fonts, siteDeclarations, reducedMotion),
    "tokens.json": JSON.stringify({
      _generated: GENERATED_NOTICE,
      schemaVersion: 1,
      shared: stableObject(shared),
      surfaces: {
        docs: stableObject(docs),
        site: stableObject(site),
      },
    }, null, 2) + "\n",
  };

  if (options.check) {
    for (const file of sortedKeys(outputs)) {
      const path = resolve(outputDir, file);
      if (!existsSync(path) || readFileSync(path, "utf8") !== outputs[file]) {
        throw new Error(file + " is stale or missing");
      }
    }
    return outputs;
  }

  mkdirSync(outputDir, { recursive: true });
  for (const file of sortedKeys(outputs)) {
    const output = outputs[file];
    if (output === undefined) fail(file, "generated output is missing");
    writeFileSync(resolve(outputDir, file), output, "utf8");
  }
  return outputs;
}

/** @param {string[]} arguments_ @returns {BuildOptions} */
function parseArguments(arguments_) {
  /** @type {BuildOptions} */
  const options = {};
  /** @type {Record<string, PathOption>} */
  const pathOptions = {
    "--font-manifest": "fontManifestPath",
    "--input": "inputPath",
    "--output-dir": "outputDir",
  };
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (!argument) throw new Error("empty argument");
    if (argument === "--check") {
      options.check = true;
      continue;
    }
    const key = pathOptions[argument];
    if (!key) throw new Error("unknown argument " + argument);
    const value = arguments_[index + 1];
    if (!value || value.startsWith("--")) throw new Error(argument + " requires a path");
    options[key] = value;
    index += 1;
  }
  return options;
}

if (process.argv[1] && resolve(process.argv[1]) === SCRIPT_PATH) {
  try {
    buildTokens(parseArguments(process.argv.slice(2)));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
