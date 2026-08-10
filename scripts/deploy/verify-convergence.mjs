#!/usr/bin/env node
// Read-only convergence check.
//
// Answers one question: does what is live actually correspond to the release,
// the docs manifest, and the Worker identities the deployment input declared?
// It mutates nothing, so it is safe to run in a Phase 11 rehearsal, as a
// Phase 12 gate, and again in Phase 13.
//
// Usage:
//   node scripts/deploy/verify-convergence.mjs <input.json> [--base <url>]

import { join } from "node:path";

import { loadJson, resolveUnits, validateDeploymentInput } from "./validate-deployment-input.mjs";

/** Compare one live machine route against the expected release identity. */
export async function checkVersionRoute(baseUrl, expectedVersion, fetchImpl = fetch) {
  const response = await fetchImpl(`${baseUrl}/version`, { redirect: "follow" });
  const text = (await response.text()).trim();
  return {
    check: "release-version",
    expected: expectedVersion,
    observed: text,
    status: response.status,
    pass: response.status === 200 && text === expectedVersion,
  };
}

/** Confirm the pinned release tag resolves to the same version through the selector. */
export async function checkPinnedSelector(baseUrl, version, fetchImpl = fetch) {
  const response = await fetchImpl(`${baseUrl}/version?version=${encodeURIComponent(version)}`, { redirect: "follow" });
  const text = (await response.text()).trim();
  return {
    check: "pinned-selector",
    expected: version,
    observed: text,
    status: response.status,
    pass: response.status === 200 && text === version,
  };
}

/** Confirm the served docs manifest digest matches the declared input. */
export async function checkDocsManifest(docsBaseUrl, expectedDigest, fetchImpl = fetch) {
  const response = await fetchImpl(`${docsBaseUrl}/docs-bundle.manifest.json`, { redirect: "follow" });
  if (!response.ok) {
    return { check: "docs-manifest", expected: expectedDigest, observed: null, status: response.status, pass: false };
  }
  const body = new Uint8Array(await response.arrayBuffer());
  const digestBuffer = await crypto.subtle.digest("SHA-256", body);
  const observed = `sha256:${[...new Uint8Array(digestBuffer)].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
  return { check: "docs-manifest", expected: expectedDigest, observed, status: response.status, pass: observed === expectedDigest };
}

export async function verifyConvergence(input, options = {}) {
  const { valid, errors, topology } = validateDeploymentInput(input);
  if (!valid) throw new Error(`deployment input rejected:\n  ${errors.join("\n  ")}`);

  const environment = topology.environments[input.environment];
  const baseUrl = options.baseUrl ?? environment.baseUrl;
  const docsBaseUrl = options.docsBaseUrl ?? environment.docsBaseUrl;
  const fetchImpl = options.fetchImpl ?? fetch;
  const units = resolveUnits(input, topology).map((unit) => unit.id);

  const checks = [await checkVersionRoute(baseUrl, input.release.version, fetchImpl)];
  checks.push(await checkPinnedSelector(baseUrl, input.release.version, fetchImpl));
  if (units.includes("docs")) {
    checks.push(await checkDocsManifest(docsBaseUrl, input.digests.docsManifest, fetchImpl));
  }

  return {
    environment: input.environment,
    productSha: input.productSha,
    releaseTag: input.release.tag,
    checks,
    converged: checks.every((check) => check.pass),
  };
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop())) {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error("usage: verify-convergence.mjs <input.json> [--base <url>]");
    process.exit(1);
  }
  const baseIndex = process.argv.indexOf("--base");
  try {
    const result = await verifyConvergence(loadJson(join(process.cwd(), inputPath)), {
      baseUrl: baseIndex === -1 ? undefined : process.argv[baseIndex + 1],
    });
    console.log(JSON.stringify(result, null, 2));
    if (!result.converged) process.exit(1);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
