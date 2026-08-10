import { defineConfig } from "vitest/config";

// Shared discovery and coverage defaults for every workspace package.
//
// The Phase 1 contract tests and the Phase 3 edge tests run on the native
// `node --test` runner and are invoked by `pnpm run test:native`; they are
// deliberately excluded here so neither runner shadows the other.
export default defineConfig({
  test: {
    include: ["**/*.test.ts", "**/*.test.mts"],
    exclude: ["**/node_modules/**", "**/dist/**", "**/.astro/**", "**/.next/**", "**/*.test.mjs"],
    environment: "node",
    passWithNoTests: false,
    coverage: {
      provider: "v8",
      reportsDirectory: "coverage",
      include: ["packages/*/src/**", "scripts/deploy/**"],
    },
  },
});
