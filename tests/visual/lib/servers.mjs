// Per-surface deterministic server wiring.
//
// One fixed loopback port per built surface so Playwright specs share the
// same origin regardless of shard. Ports live in a single file so a port
// collision is a single-line edit, not a scavenger hunt.

import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { startStaticServer } from "./static-server.mjs";

const REPO_ROOT = fileURLToPath(new URL("../../..", import.meta.url));

export const SITE = {
  root: resolve(REPO_ROOT, "apps/site/dist"),
  port: 4331,
  notFoundPath: "404.html",
};

export const DOCS = {
  root: resolve(REPO_ROOT, "apps/docs/out"),
  port: 4332,
  notFoundPath: "404.html",
};

export async function startSiteServer() {
  return startStaticServer(SITE);
}

export async function startDocsServer() {
  return startStaticServer(DOCS);
}
