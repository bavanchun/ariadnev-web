import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import process from "node:process";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { toolchainCompatibilityGeneratedPaths } from "../../scripts/toolchain-compatibility-paths.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

test("compatibility verification cleans generated outputs after a child command fails", () => {
  const fakeBin = mkdtempSync(resolve(tmpdir(), "vcskill-failing-pnpm-"));
  const fakePnpm = resolve(fakeBin, "pnpm");
  const inheritedPath = process.env["PATH"] ?? "";
  const fixtureScript = `#!/usr/bin/env node
const { mkdirSync, writeFileSync } = require("node:fs");
const { dirname, extname, resolve } = require("node:path");
const outputs = ${JSON.stringify(toolchainCompatibilityGeneratedPaths)};
for (const output of outputs) {
  const target = resolve(output);
  if (extname(output)) {
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, "generated");
  } else {
    mkdirSync(target, { recursive: true });
    writeFileSync(resolve(target, "sentinel"), "generated");
  }
}
process.exit(7);
`;

  writeFileSync(fakePnpm, fixtureScript, { mode: 0o700 });
  chmodSync(fakePnpm, 0o700);

  try {
    const result = spawnSync(process.execPath, ["scripts/verify-toolchain-compatibility.mjs"], {
      cwd: repoRoot,
      encoding: "utf8",
      env: { ...process.env, PATH: `${fakeBin}:${inheritedPath}` },
    });

    assert.notEqual(result.status, 0);
    for (const output of toolchainCompatibilityGeneratedPaths) {
      assert.equal(existsSync(resolve(repoRoot, output)), false, `${output} should be cleaned`);
    }
  } finally {
    rmSync(fakeBin, { force: true, recursive: true });
    for (const output of toolchainCompatibilityGeneratedPaths) {
      rmSync(resolve(repoRoot, output), { force: true, recursive: true });
    }
  }
});
