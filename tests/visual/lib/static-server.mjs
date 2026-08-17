// Deterministic static-file server used by every Playwright spec.
//
// Each surface (site, docs) gets its own fixed loopback port so parallel
// specs never race for a socket. The server serves the built output tree
// verbatim, mapping `/` to `<root>/index.html`, missing routes to the
// surface's 404 asset (so we can assert on real 404 identity), and
// setting a small deterministic content-type map so encoded bytes match
// production. Only PIDs we start are owned; teardown always fires from
// the caller's `finally` block.

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, relative, resolve, sep } from "node:path";

const CONTENT_TYPES = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".md", "text/markdown; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".txt", "text/plain; charset=utf-8"],
  [".woff2", "font/woff2"],
  [".xml", "application/xml; charset=utf-8"],
]);

function inside(root, candidate) {
  const path = relative(root, candidate);
  return path !== ".." && !path.startsWith(`..${sep}`);
}

/**
 * Start a static server for a built output tree.
 *
 * @param {object} options
 * @param {string} options.root - Absolute path to the built output directory.
 * @param {number} options.port - Fixed loopback port; caller owns port planning.
 * @param {string} options.notFoundPath - Path (relative to root) of the 404 asset.
 * @returns {Promise<{server: import('node:http').Server, origin: string, close: () => Promise<void>}>}
 */
export async function startStaticServer({ root, port, notFoundPath }) {
  const origin = `http://127.0.0.1:${port}`;
  const notFoundAbsolute = resolve(root, notFoundPath);
  const server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(
        new URL(request.url ?? "/", origin).pathname,
      );
      let target = resolve(root, pathname.replace(/^\/+/, ""));
      if (pathname.endsWith("/")) target = resolve(target, "index.html");
      let statusCode = 200;
      let info = inside(root, target)
        ? await stat(target).catch(() => undefined)
        : undefined;
      if (info?.isDirectory()) {
        target = resolve(target, "index.html");
        info = await stat(target).catch(() => undefined);
      }
      if (!info?.isFile()) {
        target = notFoundAbsolute;
        statusCode = 404;
      }
      const body = await readFile(target);
      response.writeHead(statusCode, {
        "content-type":
          CONTENT_TYPES.get(extname(target)) ?? "application/octet-stream",
        "cache-control": "no-store",
      });
      response.end(request.method === "HEAD" ? undefined : body);
    } catch {
      response.writeHead(400, { "content-type": "text/plain; charset=utf-8" });
      response.end("bad request");
    }
  });
  await new Promise((resolvePromise, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolvePromise);
  });
  return {
    server,
    origin,
    async close() {
      await new Promise((resolvePromise, reject) =>
        server.close((error) => (error ? reject(error) : resolvePromise())),
      );
    },
  };
}
