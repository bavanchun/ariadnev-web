// Release-pin contract gate.
//
// The pin is the one piece of mutable identity the marketing page is allowed to
// show, and Phase 10 owns writing it. The rule that matters is negative: a
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
  version: "0.11.0",
  tag: "v0.11.0",
  releaseUrl: "https://github.com/bavanchun/vcskill/releases/tag/v0.11.0",
  publishedAt: "2026-08-09T12:00:00Z",
};

const write = (value: unknown): void => {
  writeFileSync(path, typeof value === "string" ? value : JSON.stringify(value));
};

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "vcskill-pin-"));
  path = join(directory, "vcskill.json");
});

afterEach(() => {
  rmSync(directory, { recursive: true, force: true });
});

describe("an absent pin", () => {
  it("is not an error, in either mode", () => {
    expect(loadReleasePin({ path, releaseMode: false })).toBeNull();
    expect(loadReleasePin({ path, releaseMode: true })).toBeNull();
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
    ["a release URL on another repository", { ...VALID, releaseUrl: "https://github.com/attacker/vcskill/releases/tag/v0.11.0" }],
    ["a release URL that is not a release", { ...VALID, releaseUrl: "https://github.com/bavanchun/vcskill/issues/1" }],
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
    const previous = process.env["VCSKILL_RELEASE_MODE"];
    try {
      write("{ broken");
      process.env["VCSKILL_RELEASE_MODE"] = "1";
      expect(() => loadReleasePin({ path })).toThrow(ReleasePinError);
      process.env["VCSKILL_RELEASE_MODE"] = "0";
      expect(loadReleasePin({ path })).toBeNull();
    } finally {
      if (previous === undefined) delete process.env["VCSKILL_RELEASE_MODE"];
      else process.env["VCSKILL_RELEASE_MODE"] = previous;
    }
  });
});
