// Release-pin contract gate.
//
// The pin is the one piece of mutable identity the marketing page is allowed to
// show, and the docs content build owns writing it. The rule that matters is negative: a
// missing or malformed pin must never become a guessed version on a public
// page. All four branches are exercised here against temporary files, so no
// fake release data is ever committed.

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ReleasePinError, loadReleasePin } from "../../apps/site/src/data/marketing-facts";

let directory: string;
let path: string;

const VALID = {
  version: "1.0.0",
  tag: "ariadnev@1.0.0",
  releaseUrl: "https://docs.ariadnev.com/en/1.0.0/release-notes",
  publishedAt: "2026-08-16T00:42:42Z",
};

const write = (value: unknown): void => {
  writeFileSync(path, typeof value === "string" ? value : JSON.stringify(value));
};

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "ariadnev-pin-"));
  path = join(directory, "ariadnev.json");
});

afterEach(() => {
  rmSync(directory, { recursive: true, force: true });
});

describe("an absent pin", () => {
  it("is not an error in a normal build", () => {
    expect(loadReleasePin({ path, releaseMode: false })).toBeNull();
  });
  it("is an error in a release build", () => {
    expect(() => loadReleasePin({ path, releaseMode: true })).toThrow(ReleasePinError);
  });
});

describe("a valid pin", () => {
  it("is returned exactly as written", () => {
    write(VALID);
    expect(loadReleasePin({ path, releaseMode: true })).toEqual(VALID);
  });

  it("carries no field the page did not ask for", () => {
    write({ ...VALID, draft: true, secretToken: "should-not-survive" });
    const pin = loadReleasePin({ path, releaseMode: true });
    expect(Object.keys(pin ?? {}).sort()).toEqual(["publishedAt", "releaseUrl", "tag", "version"]);
  });
});

describe("a malformed pin", () => {
  const cases: [string, unknown][] = [
    ["not JSON", "{ this is not json"],
    ["not an object", JSON.stringify([VALID])],
    ["a prerelease version", { ...VALID, version: "1.0.0-rc.1", tag: "v1.0.0-rc.1" }],
    ["a version with a leading zero", { ...VALID, version: "01.0.0", tag: "v01.0.0" }],
    ["a tag that disagrees with the version", { ...VALID, tag: "v0.11.1" }],
    ["a release URL on another host", { ...VALID, releaseUrl: "https://docs.attacker.example/en/1.0.0/release-notes" }],
    ["a release URL on the marketing host instead of the docs host", { ...VALID, releaseUrl: "https://ariadnev.com/en/1.0.0/release-notes" }],
    ["a non-instant publish date", { ...VALID, publishedAt: "2026-08-09" }],
    ["a missing version", { tag: "v0.11.0", releaseUrl: VALID.releaseUrl, publishedAt: VALID.publishedAt }],
  ];

  for (const [description, value] of cases) {
    it(`is omitted rather than guessed: ${description}`, () => {
      write(value);
      expect(loadReleasePin({ path, releaseMode: false })).toBeNull();
    });

    it(`fails a release build: ${description}`, () => {
      write(value);
      expect(() => loadReleasePin({ path, releaseMode: true })).toThrow(ReleasePinError);
    });
  }
});

describe("release mode", () => {
  it("is driven by the environment when the caller does not say", () => {
    const previous = process.env["ARIADNEV_RELEASE_MODE"];
    try {
      write("{ broken");
      process.env["ARIADNEV_RELEASE_MODE"] = "1";
      expect(() => loadReleasePin({ path })).toThrow(ReleasePinError);
      process.env["ARIADNEV_RELEASE_MODE"] = "0";
      expect(loadReleasePin({ path })).toBeNull();
    } finally {
      if (previous === undefined) delete process.env["ARIADNEV_RELEASE_MODE"];
      else process.env["ARIADNEV_RELEASE_MODE"] = previous;
    }
  });
});
