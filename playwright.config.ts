// Playwright configuration for Phase 7 deterministic verification.
//
// Every spec runs against pre-built production output served over the
// per-surface static server (tests/visual/lib/servers.mjs). Screenshot
// baselines live under tests/visual/__baselines__; only Chromium owns
// baseline images so Firefox/WebKit anti-alias drift never triggers a
// diff. Reduced motion is forced everywhere so the first-paint frame is
// deterministic across runs and machines.

import { defineConfig, devices } from "@playwright/test";

const CI = process.env.CI === "true" || process.env.CI === "1";

// Small threshold: catch layout drift while tolerating font hinting noise
// on the two-pixel edge of a glyph. Larger diffs mean a real regression.
const PIXEL_THRESHOLD = 0.15;
const MAX_DIFF_PIXEL_RATIO = 0.02;

export default defineConfig({
  testDir: "./tests/visual",
  globalSetup: "./tests/visual/global-setup.ts",
  fullyParallel: true,
  forbidOnly: CI,
  retries: 0,
  workers: CI ? 2 : undefined,
  reporter: CI ? [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]] : "list",
  outputDir: "./tests/visual/.artifacts",
  snapshotPathTemplate: "{testDir}/__baselines__/{testFilePath}/{arg}{ext}",
  timeout: 60_000,
  expect: {
    timeout: 15_000,
    toHaveScreenshot: {
      animations: "disabled",
      caret: "hide",
      scale: "device",
      threshold: PIXEL_THRESHOLD,
      maxDiffPixelRatio: MAX_DIFF_PIXEL_RATIO,
    },
  },
  use: {
    baseURL: undefined, // Each spec picks its surface origin explicitly.
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
    reducedMotion: "reduce",
    colorScheme: "dark",
  },
  // Playwright owns the static-server child process lifecycle: start on
  // demand, wait for readiness, kill on teardown. One process serves
  // both site and docs so shard parallelism cannot race for ports.
  webServer: {
    command: "node tests/visual/lib/serve.mjs",
    url: "http://127.0.0.1:4331/",
    reuseExistingServer: !CI,
    timeout: 30_000,
    stdout: "pipe",
    stderr: "pipe",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      testMatch: /journeys\/.*\.spec\.ts/,
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      testMatch: /journeys\/.*\.spec\.ts/,
      use: { ...devices["Desktop Safari"] },
    },
  ],
});
