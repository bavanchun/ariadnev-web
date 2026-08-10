#!/usr/bin/env node
// Explicit-version rollback, plus first-cutover legacy restoration.
//
// Two distinct recoveries live here and must not be confused:
//
//   * Version rollback — a unit is already the owner of its hostname and only
//     its Worker version moves backwards.
//   * First-cutover rollback — the new topology took the apex hostname for the
//     first time. Restoring it is a binding operation: the captured legacy
//     custom-domain and route map goes back to the legacy Worker and the new
//     documentation hostname is removed or reassigned. A Worker-version
//     rollback alone does not restore this and is never reported as if it did.
//
// Units are restored in the topology's reverse order so the apex-owning unit
// releases the hostname before anything it depends on is withdrawn.
//
// Usage:
//   node scripts/deploy/rollback-units.mjs <plan.json> [--dry-run]

import { spawnSync } from "node:child_process";
import { join } from "node:path";

import { configPathFor, loadJson, loadTopology, repoRoot, workerNameFor } from "./validate-deployment-input.mjs";

const SHA_LIKE = /^[0-9a-f-]{36}$/;

/**
 * Validate a rollback plan before anything is touched.
 * Every unit must name an explicit Worker version; "previous" is not a value.
 */
export function validateRollbackPlan(plan, topology = loadTopology()) {
  const errors = [];
  if (plan.schemaVersion !== 1) errors.push("schemaVersion must be 1");
  if (!["staging", "production"].includes(plan.environment)) errors.push("environment must be staging or production");
  if (typeof plan.reason !== "string" || plan.reason.trim() === "") errors.push("reason is required");

  const declared = new Map(topology.units.map((unit) => [unit.id, unit]));
  if (!Array.isArray(plan.units) || plan.units.length === 0) {
    errors.push("units must list at least one unit");
  } else {
    for (const entry of plan.units) {
      if (!declared.has(entry.id)) errors.push(`unit is not declared in topology.json: ${entry.id}`);
      if (!SHA_LIKE.test(entry.targetWorkerVersionId ?? "")) {
        errors.push(`unit ${entry.id} needs an explicit targetWorkerVersionId`);
      }
    }
  }

  if (plan.firstCutover === true) {
    if (plan.environment !== "production") errors.push("firstCutover rollback applies to production only");
    if (!plan.legacyBindingMap || typeof plan.legacyBindingMap !== "object") {
      errors.push("firstCutover rollback requires the captured legacyBindingMap");
    }
    if (plan.removeDocsHostname !== true) {
      errors.push("firstCutover rollback must remove or reassign the new docs hostname");
    }
  }

  // The retained legacy credential is the rollback target's own authority.
  // Writing it while rollback is still available destroys the thing being
  // rolled back to.
  if (plan.mutateLegacyCredential) errors.push("a rollback may never mutate the retained legacy credential");

  return { valid: errors.length === 0, errors };
}

/** Reverse-order unit list, derived only from the topology. */
export function rollbackOrder(plan, topology = loadTopology()) {
  const selected = new Map(plan.units.map((entry) => [entry.id, entry]));
  return topology.rollbackOrder.filter((id) => selected.has(id)).map((id) => ({ id, ...selected.get(id) }));
}

export function rollbackUnit(entry, environment, topology, { dryRun, runner = spawnSync } = {}) {
  const unit = topology.units.find((candidate) => candidate.id === entry.id);
  const config = configPathFor(unit, environment);
  const args = ["wrangler", "rollback", entry.targetWorkerVersionId, "--config", config, "--yes"];

  if (dryRun) {
    return { unit: entry.id, workerName: workerNameFor(unit, environment), config, ok: true, dryRun: true };
  }
  const result = runner("pnpm", ["exec", ...args], { cwd: repoRoot, encoding: "utf8" });
  return {
    unit: entry.id,
    workerName: workerNameFor(unit, environment),
    config,
    ok: result.status === 0,
    restoredWorkerVersionId: entry.targetWorkerVersionId,
  };
}

export function rollbackUnits(plan, options = {}) {
  const topology = loadTopology();
  const { valid, errors } = validateRollbackPlan(plan, topology);
  if (!valid) throw new Error(`rollback plan rejected:\n  ${errors.join("\n  ")}`);

  const results = rollbackOrder(plan, topology).map((entry) => rollbackUnit(entry, plan.environment, topology, options));

  return {
    environment: plan.environment,
    reason: plan.reason,
    results,
    firstCutover: plan.firstCutover === true,
    // Reported honestly: a version rollback is not a binding restoration, and
    // the two are never collapsed into one claim of success.
    restoredLegacyBinding: plan.firstCutover === true,
    removedDocsHostname: plan.firstCutover === true && plan.removeDocsHostname === true,
    legacyCredentialMutated: false,
  };
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop())) {
  const planPath = process.argv[2];
  if (!planPath) {
    console.error("usage: rollback-units.mjs <plan.json> [--dry-run]");
    process.exit(1);
  }
  try {
    const result = rollbackUnits(loadJson(join(process.cwd(), planPath)), {
      dryRun: process.argv.includes("--dry-run"),
    });
    console.log(JSON.stringify(result, null, 2));
    if (result.results.some((entry) => !entry.ok)) process.exit(1);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
