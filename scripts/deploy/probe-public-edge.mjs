#!/usr/bin/env node
// Read-only liveness probe for the public edge.
//
// Every install-path route on ariadnev.com is served by reading a private
// repository, so a credential that dies takes `/install` down while the
// marketing site keeps answering 200. Nothing in the deploy pipeline notices:
// it only runs when someone deploys. This probe is the standing check that
// runs on a schedule instead, and it deliberately exercises the credential
// rather than only the hostname.
//
// It compares against the committed release pin, so it stays correct across
// releases without being re-pointed at a new deployment input.
//
// Usage:
//   node scripts/deploy/probe-public-edge.mjs [--environment production] [--base <url>] [--docs-base <url>]

import { join } from "node:path";

import { checkPinnedSelector, checkVersionRoute } from "./verify-convergence.mjs";
import { loadJson, loadTopology, repoRoot } from "./validate-deployment-input.mjs";

// A redirect here would prove the redirect works, not that the unit behind the
// hostname does; `verify-convergence.mjs` makes the same call for the same reason.
const NO_REDIRECT = { redirect: "manual" };

const CHECKSUM_LINE = /^[0-9a-f]{64}\s+\S+/m;

const failed = (check, expected, observed, status) => ({ check, expected, observed, status, pass: false });

/** The installer is fetched through the repository contents API, not a release. */
export async function checkInstaller(baseUrl, fetchImpl = fetch) {
  const response = await fetchImpl(`${baseUrl}/install`, NO_REDIRECT);
  const expected = "shebang";
  if (response.status !== 200) return failed("installer", expected, null, response.status);
  const body = await response.text();
  return {
    check: "installer",
    expected,
    observed: body.slice(0, 2),
    status: response.status,
    pass: body.startsWith("#!"),
  };
}

/** Release-asset streaming, the one route an installer actually depends on. */
export async function checkChecksums(baseUrl, fetchImpl = fetch) {
  const response = await fetchImpl(`${baseUrl}/download/checksums.txt`, NO_REDIRECT);
  const expected = "sha256-line";
  if (response.status !== 200) return failed("checksums", expected, null, response.status);
  const body = await response.text();
  return {
    check: "checksums",
    expected,
    observed: `${body.split("\n").filter(Boolean).length} line(s)`,
    status: response.status,
    pass: CHECKSUM_LINE.test(body),
  };
}

/** Docs are static and need no credential; a failure here is a different fault. */
export async function checkDocsEntry(docsBaseUrl, fetchImpl = fetch) {
  const response = await fetchImpl(`${docsBaseUrl}/en/stable/`, { redirect: "follow" });
  const contentType = response.headers.get("content-type") || "";
  return {
    check: "docs-entry",
    expected: "text/html",
    observed: contentType.split(";")[0] || null,
    status: response.status,
    pass: response.status === 200 && contentType.includes("text/html"),
  };
}

export async function probePublicEdge({ baseUrl, docsBaseUrl, version, fetchImpl = fetch }) {
  const checks = [
    await checkVersionRoute(baseUrl, version, fetchImpl),
    await checkPinnedSelector(baseUrl, version, fetchImpl),
    await checkInstaller(baseUrl, fetchImpl),
    await checkChecksums(baseUrl, fetchImpl),
    await checkDocsEntry(docsBaseUrl, fetchImpl),
  ];
  return { baseUrl, docsBaseUrl, version, checks, healthy: checks.every((check) => check.pass) };
}

/** Probe targets come from the topology, so a host change cannot skip the probe. */
export function resolveProbeTargets(environment, topology = loadTopology(), pin = loadJson(join(repoRoot, "releases/ariadnev.json"))) {
  const target = topology.environments?.[environment];
  if (!target) throw new Error(`unknown environment: ${environment}`);
  return { baseUrl: target.baseUrl, docsBaseUrl: target.docsBaseUrl, version: pin.version };
}

function parseArguments(argv) {
  const flag = (name) => {
    const index = argv.indexOf(`--${name}`);
    return index === -1 ? undefined : argv[index + 1];
  };
  return { environment: flag("environment") ?? "production", baseUrl: flag("base"), docsBaseUrl: flag("docs-base") };
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop())) {
  const options = parseArguments(process.argv.slice(2));
  try {
    const targets = resolveProbeTargets(options.environment);
    const result = await probePublicEdge({
      ...targets,
      baseUrl: options.baseUrl ?? targets.baseUrl,
      docsBaseUrl: options.docsBaseUrl ?? targets.docsBaseUrl,
    });
    console.log(JSON.stringify({ environment: options.environment, ...result }, null, 2));
    if (!result.healthy) process.exit(1);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
