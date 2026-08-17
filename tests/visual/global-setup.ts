// Global setup: fail fast with a clear message when the built output
// tree is missing, before Playwright wastes cycles launching browsers
// against an empty static server.

import { statSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = fileURLToPath(new URL("../..", import.meta.url)) + "/";

function requireFile(path: string, hint: string) {
  const absolute = resolve(REPO_ROOT, path);
  try {
    const info = statSync(absolute);
    if (!info.isFile()) throw new Error(`not a file: ${absolute}`);
  } catch (error) {
    throw new Error(
      `${hint}\n  missing: ${absolute}\n  cause: ${(error as Error).message}`,
    );
  }
}

export default async function globalSetup() {
  requireFile(
    "apps/site/dist/index.html",
    "Marketing site not built. Run `pnpm --filter @ariadnev-web/site build` first.",
  );
  requireFile(
    "apps/docs/out/index.html",
    "Docs not exported. Run `pnpm --filter @ariadnev-web/docs build` first.",
  );
  requireFile(
    "apps/docs/out/404.html",
    "Docs 404 asset missing from the export.",
  );
}
