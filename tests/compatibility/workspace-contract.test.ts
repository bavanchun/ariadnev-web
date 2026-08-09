import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const manifests = [
  "package.json",
  "apps/site/package.json",
  "apps/docs/package.json",
  "workers/edge/package.json",
  "packages/contracts/package.json",
  "packages/tokens/package.json",
] as const;
const exactVersion = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

function json(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(resolve(root, path), "utf8")) as Record<string, unknown>;
}

describe("workspace contract", () => {
  it("pins Node, pnpm, and every direct external dependency", () => {
    const rootManifest = json("package.json");
    expect(rootManifest.packageManager).toBe("pnpm@11.0.9");
    expect(rootManifest.engines).toEqual({ node: "26.0.0", pnpm: "11.0.9" });

    for (const path of manifests) {
      const manifest = json(path);
      for (const section of ["dependencies", "devDependencies"] as const) {
        for (const [name, version] of Object.entries((manifest[section] ?? {}) as Record<string, string>)) {
          expect(
            exactVersion.test(version) || /^workspace:0\.0\.0$/.test(version),
            `${path} ${section}.${name} must be exact`,
          ).toBe(true);
        }
      }
    }
  });

  it("reserves later-phase commands without changing their entrypoints", () => {
    const rootManifest = json("package.json");
    expect(rootManifest.scripts).toMatchObject({
      build: "node scripts/run-workspace-command.mjs build",
      "sync:release": "node scripts/run-reserved-command.mjs sync-release",
      test: "node scripts/run-root-tests.mjs",
      "test:qualification": "node scripts/run-reserved-command.mjs qualification",
      typecheck: "node scripts/run-workspace-command.mjs typecheck",
    });
    expect(json("apps/site/package.json").scripts).toMatchObject({
      "build:owner": "astro build",
      "typecheck:owner": "astro check",
    });
    expect(json("apps/docs/package.json").scripts).toMatchObject({
      "build:owner": "node scripts/build-docs.mjs",
      "typecheck:owner": "tsc --noEmit",
    });
    expect(json("packages/contracts/package.json").scripts).toMatchObject({
      test: "node ../../scripts/run-owner-command.mjs contracts test",
      "test:owner": "vitest run src",
    });
  });
});
