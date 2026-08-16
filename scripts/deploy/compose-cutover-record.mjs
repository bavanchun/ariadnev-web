#!/usr/bin/env node
// Compose the deploy-phase cutover record from what the control plane observed.
//
//   node scripts/deploy/compose-cutover-record.mjs <input.json> \
//     --deploy-result <deploy-units output.json> [--convergence <verify-convergence output.json>] \
//     --started-at <ISO instant> --out <record.json>
//
// The record is assembled only from the deployment input and the machine
// output of `deploy-units.mjs` / `verify-convergence.mjs` — never typed by
// hand — and then validated and written by `write-cutover-record.mjs`, which
// refuses anything credential-shaped. Observations keep exactly the fields the
// record schema admits; extra runtime detail (body sizes) is dropped here.

import { readFileSync } from "node:fs";
import { loadJson } from "./validate-deployment-input.mjs";
import { writeCutoverRecord } from "./write-cutover-record.mjs";

function argument(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1 || !process.argv[index + 1] || process.argv[index + 1].startsWith("--")) {
    if (fallback !== undefined) return fallback;
    throw new Error(`--${name} is required`);
  }
  return process.argv[index + 1];
}

/** A stable record id: environment + release + product commit prefix. */
export function recordIdFor(input) {
  return `${input.environment}-${input.release.version.replace(/[^0-9a-z]/gi, "-")}-${input.productSha.slice(0, 12)}`.toLowerCase();
}

export function composeCutoverRecord({ input, deployResult, convergence, startedAtUtc, completedAtUtc }) {
  const versionByUnit = new Map((deployResult.deployments ?? []).map((deployment) => [deployment.unit, deployment.workerVersionId]));
  const observations = (deployResult.observations ?? []).map((observation) => ({
    unit: observation.unit,
    route: observation.route,
    status: observation.status,
    contentClass: observation.contentClass,
    ...(observation.cacheControl ? { cacheControl: observation.cacheControl } : {}),
    ...(versionByUnit.get(observation.unit) ? { workerVersionId: versionByUnit.get(observation.unit) } : {}),
    deploymentLabel: observation.deploymentLabel,
    pass: observation.pass,
  }));
  const allPassed = observations.every((observation) => observation.pass) && (convergence ? convergence.converged === true : true);
  return {
    schemaVersion: 1,
    recordId: recordIdFor(input),
    environment: input.environment,
    phase: "deploy",
    input: {
      productSha: input.productSha,
      qualificationEvidenceSha: input.qualificationEvidenceSha,
      topology: input.topology,
      units: input.units,
    },
    startedAtUtc,
    completedAtUtc,
    result: allPassed ? "pass" : "fail",
    observations,
  };
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop())) {
  const inputPath = process.argv[2];
  if (!inputPath || inputPath.startsWith("--")) {
    console.error("usage: compose-cutover-record.mjs <input.json> --deploy-result <json> [--convergence <json>] --started-at <iso> --out <record.json>");
    process.exit(1);
  }
  try {
    const convergencePath = argument("convergence", "");
    const record = composeCutoverRecord({
      input: loadJson(inputPath),
      deployResult: JSON.parse(readFileSync(argument("deploy-result"), "utf8")),
      convergence: convergencePath ? JSON.parse(readFileSync(convergencePath, "utf8")) : undefined,
      startedAtUtc: argument("started-at"),
      completedAtUtc: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
    });
    console.log(JSON.stringify(writeCutoverRecord(record, argument("out")), null, 2));
    if (record.result !== "pass") process.exit(1);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
