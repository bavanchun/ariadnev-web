// Shared fixtures for the marketing gates.
//
// Every suite asserts against the built artifact, never against source, so the
// build runs once per process and the result is reused.

import { execFileSync } from "node:child_process";
import { createServer, type Server } from "node:http";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import type { AddressInfo } from "node:net";

export const REPO_ROOT = fileURLToPath(new URL("../..", import.meta.url));
export const SITE_ROOT = join(REPO_ROOT, "apps", "site");
export const DIST_DIR = join(SITE_ROOT, "dist");
export const INDEX_HTML = join(DIST_DIR, "index.html");
export const HTML_404 = join(DIST_DIR, "404.html");

/** Every file in `dist`, as a site-absolute path. */
function walk(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) found.push(...walk(full));
    else found.push(`/${relative(DIST_DIR, full).split("\\").join("/")}`);
  }
  return found;
}

let built = false;

const LOCK_DIR = join(SITE_ROOT, ".astro", "site-build.lock");
const STAMP_FILE = join(SITE_ROOT, ".astro", "site-build.stamp");
/** A lock older than this is assumed to belong to a crashed run. */
const STALE_LOCK_MS = 10 * 60_000;

/**
 * Build the site once per test run, not once per worker process.
 *
 * Four suites run in parallel worker processes against one `dist`, so this has
 * to coordinate across processes, and it has to do it with a *completion*
 * signal rather than a lock-absence signal. An earlier version released the
 * lock as soon as the build finished, which meant a worker starting later saw
 * no lock, claimed it, and ran `astro build` — emptying `dist` while other
 * suites were still reading files out of it.
 *
 * The stamp file is that completion signal. It records the run id, so a build
 * from a previous `vitest` invocation never satisfies the current one, and it
 * is written only after a build actually succeeds.
 */
export async function buildOnce(): Promise<void> {
  if (built) return;
  built = true;
  if (process.env.VCSKILL_SITE_SKIP_BUILD === "1" && existsSync(INDEX_HTML)) return;

  // Every worker of one vitest invocation shares a parent pid, which makes a
  // cheap and collision-free run identity.
  const runId = process.env.VCSKILL_SITE_RUN_ID ?? String(process.ppid);
  const stampIsCurrent = (): boolean => {
    try {
      return readFileSync(STAMP_FILE, "utf8") === runId && existsSync(INDEX_HTML);
    } catch {
      return false;
    }
  };
  if (stampIsCurrent()) return;

  mkdirSync(join(SITE_ROOT, ".astro"), { recursive: true });
  try {
    // A directory create is atomic, so exactly one worker becomes the builder.
    mkdirSync(LOCK_DIR, { recursive: false });
  } catch {
    for (let attempt = 0; attempt < 720; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      if (stampIsCurrent()) return;
      if (!existsSync(LOCK_DIR)) {
        // The lock vanished without a current stamp, which means the builder
        // failed. Saying so beats letting the caller hit an unrelated ENOENT.
        throw new Error("the site build owned by another test worker failed; see its output above");
      }
      const age = Date.now() - statSync(LOCK_DIR).mtimeMs;
      if (age > STALE_LOCK_MS) {
        rmSync(LOCK_DIR, { recursive: true, force: true });
        break; // Reclaim it and build below.
      }
    }
    if (stampIsCurrent()) return;
    if (existsSync(LOCK_DIR)) throw new Error("timed out waiting for another test worker to build the site");
    mkdirSync(LOCK_DIR, { recursive: true });
  }

  try {
    execFileSync("pnpm", ["exec", "astro", "build"], { cwd: SITE_ROOT, stdio: "pipe" });
    writeFileSync(STAMP_FILE, runId);
  } finally {
    rmSync(LOCK_DIR, { recursive: true, force: true });
  }
}

/** The inlined `<style>` blocks of a built document. */
export function inlineStyles(html: string): string[] {
  return [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((match) => match[1]!);
}

/** Lazily-computed view of the built output. */
export const DIST = {
  get files(): string[] {
    return walk(DIST_DIR);
  },
  /** Route-like paths of generated HTML documents. */
  get pages(): string[] {
    return walk(DIST_DIR).filter((file) => file.endsWith(".html"));
  },
};

/** Strip tags and decode the few entities Astro emits, for prose assertions. */
export function textOf(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".xml": "application/xml",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json",
};

export interface StaticSite {
  readonly origin: string;
  close(): Promise<void>;
}

/**
 * Serve `dist` the way the deployed asset layer does: exact file, then
 * `<path>.html`, then the physical 404 with a real 404 status. There is no
 * single-page-app fallback, because the deployed configuration has none either.
 */
export async function serveDist(): Promise<StaticSite> {
  const server: Server = createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname);
    const candidates = [
      pathname === "/" ? "/index.html" : pathname,
      `${pathname}.html`,
      `${pathname.replace(/\/$/, "")}/index.html`,
    ];

    for (const candidate of candidates) {
      const file = join(DIST_DIR, candidate);
      if (!file.startsWith(DIST_DIR)) break; // Never escape the served root.
      if (existsSync(file) && statSync(file).isFile()) {
        response.writeHead(200, { "content-type": CONTENT_TYPES[extname(file)] ?? "application/octet-stream" });
        response.end(readFileSync(file));
        return;
      }
    }

    response.writeHead(404, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
    response.end(readFileSync(HTML_404));
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return {
    origin: `http://127.0.0.1:${port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

/** Parse `public/_headers` into an ordered list of rule blocks. */
export function parseHeadersFile(): { pattern: string; headers: Record<string, string> }[] {
  const raw = readFileSync(join(SITE_ROOT, "public", "_headers"), "utf8");
  const blocks: { pattern: string; headers: Record<string, string> }[] = [];
  for (const line of raw.split("\n")) {
    if (line.trim() === "" || line.trimStart().startsWith("#")) continue;
    if (!line.startsWith(" ") && !line.startsWith("\t")) {
      blocks.push({ pattern: line.trim(), headers: {} });
      continue;
    }
    const current = blocks.at(-1);
    if (current === undefined) continue;
    const separator = line.indexOf(":");
    if (separator === -1) continue;
    current.headers[line.slice(0, separator).trim().toLowerCase()] = line.slice(separator + 1).trim();
  }
  return blocks;
}
