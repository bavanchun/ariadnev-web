import { execFileSync } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";

let buildPromise;

async function acquireBuildLock(repositoryRoot) {
  const lockPath = join(repositoryRoot, "apps/site/.astro/test-build.lock");
  await mkdir(dirname(lockPath), { recursive: true });
  for (let attempt = 0; attempt < 300; attempt += 1) {
    try {
      await mkdir(lockPath);
      return lockPath;
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) throw error;
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
    }
  }
  throw new Error("timed out waiting for the site test build lock");
}

export async function withSiteBuildLock(repositoryRoot, action) {
  const lockPath = await acquireBuildLock(repositoryRoot);
  try {
    return await action();
  } finally {
    await rm(lockPath, { recursive: true, force: true });
  }
}

export function buildSiteOnce(repositoryRoot) {
  buildPromise ??= withSiteBuildLock(repositoryRoot, () => {
    execFileSync("pnpm", ["--filter", "@vcskill/site", "build"], { cwd: repositoryRoot, stdio: "pipe" });
  });
  return buildPromise;
}
