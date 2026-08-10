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
  };
}

/** Probe one machine route and reduce it to a sanitized observation. */
export async function smokeRoute(baseUrl, route, deploymentLabel, fetchImpl = fetch) {
  const response = await fetchImpl(`${baseUrl}${route}`, { redirect: "follow" });
  const contentType = response.headers.get("content-type") ?? "";
  const body = await response.text();
  const isHtml = contentType.startsWith("text/html");
  // A machine route that answers with an HTML 200 has been shadowed by the
  // site layer, which is the exact failure the topology exists to prevent.
  const pass = response.status === 200 && !isHtml;
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
  const { valid, errors, topology } = validateDeploymentInput(input, { requireOutputs: !options.dryRun });
  if (!valid) throw new Error(`deployment input rejected:\n  ${errors.join("\n  ")}`);

  const environment = input.environment;
  const baseUrl = topology.environments[environment].baseUrl;
  const units = resolveUnits(input, topology);
  const observations = [];
  const deployments = [];

  for (const unit of units) {
    const deployment = deployUnit(unit, environment, options);
    deployments.push(deployment);
    if (!deployment.ok) throw new Error(`unit ${unit.id} failed to deploy; halting before any later unit`);

    if (options.dryRun) continue;
    const label = `${unit.id}@${deployment.workerVersionId ?? "unknown"}`;
    for (const route of unit.smokeRoutes) {
      const observation = { unit: unit.id, ...(await smokeRoute(baseUrl, route, label, options.fetchImpl)) };
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
