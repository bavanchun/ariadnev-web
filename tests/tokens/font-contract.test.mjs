import assert from "node:assert/strict";
import { lstatSync, readFileSync } from "node:fs";
import { relative, resolve, sep } from "node:path";
import test from "node:test";

import * as fontkit from "fontkit";

import { ROOT, corpusCodePoints, readJson, sha256 } from "./token-test-helpers.mjs";

const manifest = readJson("packages/tokens/src/font-manifest.json");
const corpusPath = resolve(ROOT, "packages/tokens", manifest.coverage.corpus);
const corpusBytes = readFileSync(corpusPath);
const corpus = JSON.parse(corpusBytes.toString("utf8"));
const requiredCodePoints = corpusCodePoints(corpus);

function ownedPath(relativePath) {
  const path = resolve(ROOT, "packages/tokens", relativePath);
  const packageRoot = resolve(ROOT, "packages/tokens") + sep;
  assert.ok(path.startsWith(packageRoot), relativePath + " must stay in the token package");
  return path;
}

test("font manifest freezes one licensed WOFF2 for every semantic role", () => {
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.coverage.profileId, corpus.profileId);
  assert.equal(manifest.coverage.sha256, sha256(corpusBytes));
  assert.equal(manifest.coverage.codePointCount, requiredCodePoints.length);
  assert.deepEqual(manifest.fonts.map((font) => font.role), ["body", "display", "mono"]);

  for (const entry of manifest.fonts) {
    assert.match(entry.sourceRevision, /^[0-9a-f]{40}$/);
    assert.ok(entry.sourceUrl.startsWith("https://raw.githubusercontent.com/"));
    assert.ok(entry.sourceUrl.includes(entry.sourceRevision));
    assert.ok(entry.licenseUrl.includes(entry.sourceRevision));
    assert.equal(entry.license, "SIL Open Font License 1.1");
    assert.equal(entry.style, "normal");

    const fontPath = ownedPath(entry.file);
    const licensePath = ownedPath(entry.licenseFile);
    const fontStat = lstatSync(fontPath);
    const licenseStat = lstatSync(licensePath);
    assert.ok(fontStat.isFile() && !fontStat.isSymbolicLink());
    assert.ok(licenseStat.isFile() && !licenseStat.isSymbolicLink());

    const fontBytes = readFileSync(fontPath);
    const licenseBytes = readFileSync(licensePath);
    assert.equal(fontBytes.subarray(0, 4).toString("ascii"), "wOF2");
    assert.equal(sha256(fontBytes), entry.sha256);
    assert.equal(sha256(licenseBytes), entry.licenseSha256);
    assert.match(licenseBytes.toString("utf8"), /SIL OPEN FONT LICENSE Version 1\.1/);

    const font = fontkit.openSync(fontPath);
    assert.equal(font.familyName, entry.sourceFamily);
    const weightAxis = font.variationAxes.wght;
    assert.ok(weightAxis, entry.role + " must retain its variable weight axis");
    assert.equal(weightAxis.min, entry.weight.min);
    assert.equal(weightAxis.max, entry.weight.max);
    const available = new Set(font.characterSet);
    const missing = requiredCodePoints.filter((codePoint) => !available.has(codePoint));
    assert.deepEqual(missing.map((codePoint) => "U+" + codePoint.toString(16).toUpperCase().padStart(4, "0")), [], entry.role + " lacks required glyphs");
    assert.equal(entry.unicodeCoverage.profileId, corpus.profileId);
    assert.equal(entry.unicodeCoverage.corpusSha256, sha256(corpusBytes));
    assert.equal(entry.unicodeCoverage.codePointCount, requiredCodePoints.length);
  }
});

test("font assets use stable semantic names and contain no untracked payload type", () => {
  const expected = new Map([
    ["body", "assets/fonts/body-vietnamese.woff2"],
    ["display", "assets/fonts/display-vietnamese.woff2"],
    ["mono", "assets/fonts/mono-vietnamese.woff2"],
  ]);
  for (const entry of manifest.fonts) {
    assert.equal(entry.file, expected.get(entry.role));
    assert.equal(relative(resolve(ROOT, "packages/tokens"), ownedPath(entry.file)), entry.file);
  }
});
