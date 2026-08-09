import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import contract from "../../../tests/contracts/public-edge-contracts.json" with { type: "json" };
import { loadLegacyWorker } from "../../../tests/contracts/load-legacy-worker.mjs";
import { createEdgeWorker } from "../src/index.js";

export { assert, contract };
export const repoRoot = join(import.meta.dirname, "..", "..", "..");
export const shellInstaller = "#!/usr/bin/env bash\nasset=\"vcskill-linux-x64\"\n";
export const powershellInstaller = "$asset = \"vcskill-windows-x64.exe\"\n";
export const checksumsBody = "4".repeat(64) + "  vcskill-linux-x64";
const assetUrl = "https://api.github.com/repos/bavanchun/vcskill/releases/assets/1";

export function createRelease(tag = "vcskill@0.11.0", names = ["checksums.txt"]) {
  return { tag_name: tag, assets: names.map((name, index) => ({ name, url: `${assetUrl}${index}` })) };
}

export function createMockFetch(options = {}) {
  const calls = [];
  const fetchImpl = async (input, init = {}) => {
    const url = typeof input === "string" ? input : input.url;
    calls.push({ url, init });
    if (url.endsWith("/releases/latest")) {
      if (options.latestStatus) return new Response("failed", { status: options.latestStatus });
      return Response.json(options.latestRelease || createRelease("vcskill@0.11.0", ["checksums.txt", "vcskill-linux-x64"]));
    }
    if (url.includes("/releases/tags/")) {
      if (options.taggedStatus) return new Response("failed", { status: options.taggedStatus });
      return Response.json(options.taggedRelease || createRelease("vcskill@1.2.3", ["checksums.txt", "vcskill-linux-x64"]));
    }
    if (url.endsWith("/contents/install.sh?ref=main")) return new Response(options.shellBody ?? shellInstaller, { status: options.shellStatus || 200 });
    if (url.endsWith("/contents/install.ps1?ref=main")) return new Response(options.powershellBody ?? powershellInstaller, { status: options.powershellStatus || 200 });
    if (url.startsWith(assetUrl)) {
      if (options.redirectLocation) return new Response(null, { status: 302, headers: { location: options.redirectLocation } });
      return new Response(options.assetBody ?? checksumsBody, { status: options.assetStatus || 200 });
    }
    if (url.startsWith("https://objects.githubusercontent.com/")) return new Response(options.redirectBody ?? checksumsBody, { status: 200 });
    throw new Error(`unexpected upstream fetch: ${url}`);
  };
  fetchImpl.calls = calls;
  return fetchImpl;
}

export function createAssetsBinding() {
  const calls = [];
  return {
    calls,
    async fetch(request) {
      const path = new URL(request.url).pathname;
      calls.push(path);
      const bodies = { "/": "<!doctype html>", "/assets/app-abc123.js": "app", "/installer": "fixture lookalike", "/download": "download page", "/download-page": "download lookalike", "/version": "LEAK" };
      const status = Object.hasOwn(bodies, path) ? 200 : 404;
      const contentType = path === "/" ? "text/html; charset=utf-8" : "text/plain";
      return new Response(bodies[path] || "physical 404", { status, headers: { "content-type": contentType } });
    },
  };
}

export async function invokeEdge(path, options = {}) {
  const landingHtml = await readFile(join(repoRoot, "landing.html"), "utf8");
  const fetchImpl = options.fetchImpl || createMockFetch(options.mock);
  const worker = createEdgeWorker({ fetchImpl, landingHtml, siteFetcher: options.siteFetcher });
  const request = new Request(`${options.origin || "https://staging.vcskill.vchun.dev"}${path}`, { method: options.method || "GET" });
  const env = {
    GH_TOKEN: Object.hasOwn(options, "token") ? options.token : "test-token",
    ASSETS: options.assets,
    SITE: options.site,
    TOPOLOGY_MODE: options.topology,
    ALLOWED_HOSTS: options.allowedHosts,
  };
  const response = await worker.fetch(request, env);
  const body = options.readBody === false ? "" : await response.text();
  return { response, body, fetchImpl };
}

export async function invokeLegacy(scenario, options = {}) {
  const landingHtml = await readFile(join(repoRoot, "landing.html"), "utf8");
  const fetchImpl = options.fetchImpl || createMockFetch(options.mock);
  const worker = await loadLegacyWorker({ fetchImpl, token: Object.hasOwn(options, "token") ? options.token : "test-token", landingHtml });
  const response = await worker.fetch(new Request(`https://vcskill.vchun.dev${scenario.request.path}`, { method: scenario.request.method }));
  return { response, body: await response.text() };
}

export function selectedHeaders(response) {
  return Object.fromEntries(contract.allowedResponseHeaders.flatMap((name) => response.headers.has(name) ? [[name, response.headers.get(name)]] : []));
}
