#!/usr/bin/env node
// Deterministic unit deployment with a machine-route smoke check after each unit.
//
// Order, Wrangler config paths, and build outputs come only from
// `deployment/topology.json`. This script never chooses an order of its own and
// never invents an account id, route, hostname, or secret value.
//
// A unit that fails its smoke check stops the run immediately, so a later unit
// can never be deployed on top of a broken one.
//
// Usage:
//   node scripts/deploy/deploy-units.mjs <input.json> [--dry-run]

import { spawnSync } from "node:child_process";
import { join } from "node:path";

import {
  configPathFor,
  loadJson,
  repoRoot,
  resolveUnits,
  validateDeploymentInput,
  workerNameFor,
} from "./validate-deployment-input.mjs";

/** Run Wrangler for one unit and return its sanitized outcome. */
export function deployUnit(unit, environment, { dryRun, runner = spawnSync } = {}) {
  const config = configPathFor(unit, environment);
  const args = ["wrangler", "deploy", "--config", config];
  if (dryRun) args.push("--dry-run");

  const result = runner("pnpm", ["exec", ...args], { cwd: repoRoot, encoding: "utf8" });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  const versionId = output.match(/Current Version ID:\s*([0-9a-f-]{36})/)?.[1];
  return {
    unit: unit.id,
    workerName: workerNameFor(unit, environment),
    config,
    ok: result.status === 0,
    // Only the version id is retained. Wrangler output can echo account and
    // route detail that has no place in committed evidence.
    workerVersionId: versionId,
    // On failure, the last lines of Wrangler's output are kept for the error
    // message only — redacted of anything credential- or account-shaped — so
    // an operator learns *why* without the record ever carrying it.
    failure: result.status === 0 ? undefined : redactWranglerOutput(output),
  };
}

/** The tail of Wrangler output with tokens, account ids, and zone ids removed. */
export function redactWranglerOutput(output) {
  return String(output ?? "")
    .replace(/\b[0-9a-f]{32}\b/g, "[redacted-id]")
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/\b(?:cfut|cf|ghp|github_pat)_[A-Za-z0-9_-]{8,}\b/g, "[redacted-token]")
    .trim()
    .split("\n")
    .slice(-12)
    .join("\n");
}

/**
 * Probe one route and reduce it to a sanitized observation.
 *
 * `expects` is the unit's declared smoke class from topology.json: a
 * `machine` route (edge unit) must answer 200 and must not be HTML — an HTML
 * 200 means the site layer shadowed it, the exact failure the topology exists
 * to prevent. A `document` route (docs unit) is HTML by nature and passes on
 * any 200.
 */
export async function smokeRoute(baseUrl, route, deploymentLabel, fetchImpl = fetch, expects = "machine") {
  const response = await fetchImpl(`${baseUrl}${route}`, { redirect: "follow" });
  const contentType = response.headers.get("content-type") ?? "";
  const body = await response.text();
  const isHtml = contentType.startsWith("text/html");
  const pass = response.status === 200 && (expects === "document" || !isHtml);
  return {
    route,
    status: response.status,
    contentClass: isHtml ? "html" : contentType.split(";")[0] || "opaque",
    cacheControl: response.headers.get("cache-control") ?? undefined,
    bodyBytes: body.length,
    deploymentLabel,
    pass,
  };
}

export async function deployUnits(input, options = {}) {
  const validated = validateDeploymentInput(input, { requireOutputs: options.requireOutputs ?? !options.dryRun });
  if (!validated.valid) throw new Error(`deployment input rejected:\n  ${validated.errors.join("\n  ")}`);
  // `options.topology` exists for tests that need to exercise a malformed unit
  // declaration without editing the committed topology.
  const topology = options.topology ?? validated.topology;

  const environment = input.environment;
  const environmentHosts = topology.environments[environment];
  const units = resolveUnits(input, topology);
  const observations = [];
  const deployments = [];

  for (const unit of units) {
    const deployment = deployUnit(unit, environment, options);
    deployments.push(deployment);
    if (!deployment.ok) throw new Error(`unit ${unit.id} failed to deploy; halting before any later unit\n${deployment.failure ?? ""}`);

    if (options.dryRun) continue;
    const label = `${unit.id}@${deployment.workerVersionId ?? "unknown"}`;
    // Each unit declares which environment host it answers on and what class
    // of response its smoke routes must give; nothing here guesses either.
    const smoke = unit.smoke ?? { base: "baseUrl", expects: "machine" };
    const baseUrl = environmentHosts[smoke.base];
    if (typeof baseUrl !== "string") throw new Error(`unit ${unit.id} smoke base ${smoke.base} is not declared for ${environment}`);
    for (const route of unit.smokeRoutes) {
      const observation = { unit: unit.id, ...(await smokeRoute(baseUrl, route, label, options.fetchImpl, smoke.expects)) };
      observations.push(observation);
      if (!observation.pass) {
        throw new Error(`smoke check failed for ${unit.id} ${route} (status ${observation.status}); halting`);
      }
    }
  }

  return { environment, topology: topology.selected, deployments, observations };
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop())) {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error("usage: deploy-units.mjs <input.json> [--dry-run]");
    process.exit(1);
  }
  try {
    const result = await deployUnits(loadJson(join(process.cwd(), inputPath)), {
      dryRun: process.argv.includes("--dry-run"),
    });
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
