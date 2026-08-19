// Font contract gate.
//
// The fonts are parsed for real. A woff2 file is decoded far enough to reach
// its `cmap` table, and the Vietnamese repertoire is probed against the actual
// character map — so a resubset that silently drops tone marks fails here
// rather than in production on a Vietnamese page.
//
// `cmap` is never transformed by woff2, so locating it only requires walking
// the table directory of the brotli-decompressed stream.

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { brotliDecompressSync } from "node:zlib";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const tokensRoot = join(repoRoot, "packages", "tokens");
const manifest = JSON.parse(readFileSync(join(tokensRoot, "src", "font-manifest.json"), "utf8"));
const tokens = JSON.parse(readFileSync(join(tokensRoot, "src", "tokens.json"), "utf8"));

// The full repertoire Vietnamese needs beyond ASCII: the seven modified base
// letters, their capitals, every precomposed tone form, and the dong sign.
const VIETNAMESE_PROBE = [
  ..."ăâđêôơưĂÂĐÊÔƠƯ",
  ..."ạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ",
  ..."ẠẢẤẦẨẪẬẮẰẲẴẶẸẺẼẾỀỂỄỆỈỊỌỎỐỒỔỖỘỚỜỞỠỢỤỦỨỪỬỮỰỲỴỶỸ",
  "₫",
];

// woff2 known-table tags, indexed by the 6-bit code in each directory entry.
const KNOWN_TAGS = [
  "cmap", "head", "hhea", "hmtx", "maxp", "name", "OS/2", "post", "cvt ", "fpgm",
  "glyf", "loca", "prep", "CFF ", "VORG", "EBDT", "EBLC", "gasp", "hdmx", "kern",
  "LTSH", "PCLT", "VDMX", "vhea", "vmtx", "BASE", "GDEF", "GPOS", "GSUB", "EBSC",
  "JSTF", "MATH", "CBDT", "CBLC", "COLR", "CPAL", "SVG ", "sbix", "acnt", "avar",
  "bdat", "bloc", "bsln", "cvar", "fdsc", "feat", "fmtx", "fvar", "gvar", "hsty",
  "just", "lcar", "mort", "morx", "opbd", "prop", "trak", "Zapf", "Silf", "Glat",
  "Gloc", "Feat", "Sill",
];

/** woff2 stores lengths as a base-128 varint, most significant group first. */
function readBase128(buffer, offset) {
  let value = 0;
  for (let index = 0; index < 5; index += 1) {
    const byte = buffer[offset + index];
    assert.notEqual(byte, undefined, "truncated base-128 value");
    value = value * 128 + (byte & 0x7f);
    if ((byte & 0x80) === 0) return { value, next: offset + index + 1 };
  }
  throw new Error("overlong base-128 value");
}

/** Decode a woff2 file and return its uncompressed table map. */
export function readWoff2Tables(file) {
  assert.equal(file.subarray(0, 4).toString("ascii"), "wOF2", "not a woff2 file");
  const numTables = file.readUInt16BE(12);
  assert.ok(numTables > 0 && numTables < 128, "implausible table count");

  let cursor = 48;
  const directory = [];
  for (let index = 0; index < numTables; index += 1) {
    const flags = file[cursor];
    cursor += 1;
    const tagCode = flags & 0x3f;
    let tag;
    if (tagCode === 0x3f) {
      tag = file.subarray(cursor, cursor + 4).toString("ascii");
      cursor += 4;
    } else {
      tag = KNOWN_TAGS[tagCode];
    }
    const originalLength = readBase128(file, cursor);
    cursor = originalLength.next;

    // Only glyf and loca carry a transform, and then only when the transform
    // version is 0. Everything else, cmap included, is stored verbatim.
    let length = originalLength.value;
    const transformVersion = (flags >> 6) & 0x03;
    const transformed = (tag === "glyf" || tag === "loca") ? transformVersion === 0 : transformVersion !== 0;
    if (transformed) {
      const transformLength = readBase128(file, cursor);
      cursor = transformLength.next;
      length = transformLength.value;
    }
    directory.push({ tag, length });
  }

  const decompressed = brotliDecompressSync(file.subarray(cursor));
  const tables = new Map();
  let offset = 0;
  for (const entry of directory) {
    tables.set(entry.tag, decompressed.subarray(offset, offset + entry.length));
    offset += entry.length;
  }
  return tables;
}

/** Collect every mapped code point from a `cmap` table (formats 4 and 12). */
export function readCodePoints(cmap) {
  const points = new Set();
  const tableCount = cmap.readUInt16BE(2);

  for (let record = 0; record < tableCount; record += 1) {
    const base = 4 + record * 8;
    const subtableOffset = cmap.readUInt32BE(base + 4);
    const format = cmap.readUInt16BE(subtableOffset);

    if (format === 4) {
      const segCountX2 = cmap.readUInt16BE(subtableOffset + 6);
      const segCount = segCountX2 / 2;
      const endBase = subtableOffset + 14;
      const startBase = endBase + segCountX2 + 2;
      for (let segment = 0; segment < segCount; segment += 1) {
        const end = cmap.readUInt16BE(endBase + segment * 2);
        const start = cmap.readUInt16BE(startBase + segment * 2);
        if (start === 0xffff) continue;
        for (let point = start; point <= end && point !== 0xffff; point += 1) points.add(point);
      }
    } else if (format === 12) {
      const groupCount = cmap.readUInt32BE(subtableOffset + 12);
      for (let group = 0; group < groupCount; group += 1) {
        const groupBase = subtableOffset + 16 + group * 12;
        const start = cmap.readUInt32BE(groupBase);
        const end = cmap.readUInt32BE(groupBase + 4);
        for (let point = start; point <= end; point += 1) points.add(point);
      }
    }
  }
  return points;
}

const sha256 = (bytes) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;

test("the manifest declares a display, body, and mono face", () => {
  assert.deepEqual(manifest.fonts.map((font) => font.id).sort(), ["body", "display", "mono"]);
});

test("the exact self-hosted family and weight contract remains fixed", () => {
  const expected = {
    display: { family: "Be Vietnam Pro", weights: [700], variable: false },
    body: { family: "Inter", weights: [400, 700], variable: true },
    mono: { family: "JetBrains Mono", weights: [400, 700], variable: true },
  };
  for (const font of manifest.fonts) {
    assert.deepEqual(
      { family: font.family, weights: font.weights, variable: font.variable },
      expected[font.id],
      `${font.id} family or weight range drifted`,
    );
    assert.equal(tokens.font.family[font.id].$value[0], font.family, `${font.id} token does not name its manifest face`);
  }
});

for (const font of manifest.fonts) {
  test(`${font.id} (${font.family}) is present and matches its recorded digest`, () => {
    const bytes = readFileSync(join(tokensRoot, font.file));
    assert.equal(bytes.byteLength, font.bytes, `${font.id} byte length drifted`);
    assert.equal(sha256(bytes), font.digest, `${font.id} digest drifted from the manifest`);
  });

  test(`${font.id} parses as woff2 and covers the full Vietnamese repertoire`, () => {
    const tables = readWoff2Tables(readFileSync(join(tokensRoot, font.file)));
    const cmap = tables.get("cmap");
    assert.ok(cmap !== undefined && cmap.byteLength > 0, `${font.id} has no cmap table`);

    const points = readCodePoints(cmap);
    const missing = VIETNAMESE_PROBE.filter((character) => !points.has(character.codePointAt(0)));
    assert.deepEqual(missing, [], `${font.id} is missing Vietnamese characters: ${missing.join("")}`);

    // Basic Latin has to be there too, or the face cannot set English copy.
    for (const character of "AZaz0189.,:;-()") {
      assert.ok(points.has(character.codePointAt(0)), `${font.id} is missing ${character}`);
    }
    assert.equal(font.vietnameseCoverage, "complete");
  });

  test(`${font.id} carries a verbatim redistribution license`, () => {
    const licensePath = join(tokensRoot, font.license.file);
    const bytes = readFileSync(licensePath);
    assert.equal(sha256(bytes), font.license.digest, `${font.id} license digest drifted`);

    const text = bytes.toString("utf8");
    assert.equal(font.license.spdx, "OFL-1.1");
    assert.equal(font.license.redistribution, "permitted");
    assert.match(text, /SIL OPEN FONT LICENSE/i, `${font.id} license is not the OFL text`);
    assert.match(text, /Copyright/, `${font.id} license has no copyright line`);
    assert.ok(font.license.source.startsWith("https://"), `${font.id} license has no upstream source`);
  });
}

test("every font is self-hosted and none is fetched from a third party", () => {
  for (const font of manifest.fonts) {
    assert.match(font.file, /^assets\/fonts\//, `${font.id} must be served from the package`);
    assert.equal(font.format, "woff2");
  }
});

test("generated stylesheets reference only self-hosted faces", () => {
  for (const target of ["site", "docs"]) {
    const css = readFileSync(join(tokensRoot, "dist", `${target}.css`), "utf8");
    const urls = [...css.matchAll(/url\("([^"]+)"\)/g)].map((match) => match[1]);
    assert.equal(urls.length, manifest.fonts.length, `${target}.css must declare one face per manifest entry`);
    for (const url of urls) {
      assert.match(url, /^\.\.\/assets\/fonts\//, `${target}.css references a non-local font: ${url}`);
      assert.doesNotMatch(url, /^https?:/, `${target}.css must not fetch a remote font`);
    }
    assert.doesNotMatch(css, /fonts\.googleapis\.com|fonts\.gstatic\.com/, `${target}.css must not call Google Fonts`);
  }
});
