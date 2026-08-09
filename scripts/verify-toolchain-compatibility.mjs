import { spawnSync } from "node:child_process";
import { cpSync, existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";

import { toolchainCompatibilityGeneratedPaths } from "./toolchain-compatibility-paths.mjs";

const workspaceRoot = process.cwd();
const siteCompatibilityOutput = resolve(workspaceRoot, "apps/site/dist");
let seededSiteCompatibilityOutput = false;

function clean() {
  for (const path of toolchainCompatibilityGeneratedPaths) {
    rmSync(resolve(workspaceRoot, path), { force: true, recursive: true });
  }
}

function run(args, { cwd = workspaceRoot } = {}) {
  const result = spawnSync("pnpm", args, {
    cwd,
    env: {
      ...process.env,
      ASTRO_TELEMETRY_DISABLED: "1",
      NEXT_TELEMETRY_DISABLED: "1",
      WRANGLER_SEND_METRICS: "false",
    },
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const outcome = result.signal ? `signal ${result.signal}` : `exit ${result.status ?? 1}`;
    throw new Error(`compatibility command failed: pnpm ${args.join(" ")}; ${outcome}`);
  }
}

clean();
try {
  run(["exec", "tsc", "-p", "tsconfig.compatibility.json"]);
  run(["exec", "vitest", "run", "tests/compatibility/toolchain-compatibility.test.ts", "tests/compatibility/workspace-contract.test.ts"]);
  run(["exec", "astro", "build", "--root", "tests/compatibility/fixtures/astro"]);
  if (!existsSync(resolve(workspaceRoot, "tests/compatibility/fixtures/astro/dist/index.html"))) {
    throw new Error("Astro compatibility build did not emit index.html");
  }
  if (!existsSync(siteCompatibilityOutput)) {
    cpSync(resolve(workspaceRoot, "tests/compatibility/fixtures/astro/dist"), siteCompatibilityOutput, { recursive: true });
    seededSiteCompatibilityOutput = true;
  }
  run(["exec", "next", "build"], {
    cwd: resolve(workspaceRoot, "tests/compatibility/fixtures/docs"),
  });
  if (!existsSync(resolve(workspaceRoot, "tests/compatibility/fixtures/docs/out/index.html"))) {
    throw new Error("Next/Fumadocs compatibility build did not emit index.html");
  }
  run(["--filter", "@vcskill/edge", "run", "wrangler:dry-run"]);
} finally {
  if (seededSiteCompatibilityOutput) rmSync(siteCompatibilityOutput, { force: true, recursive: true });
  clean();
}
