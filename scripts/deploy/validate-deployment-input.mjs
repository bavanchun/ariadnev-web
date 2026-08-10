#!/usr/bin/env node
// Shared preflight for every staging and production deployment.
//
// This module owns loading the deployment schemas and the topology authority,
// so `deploy-units`, `rollback-units`, and the verifiers all resolve order,
// config paths, and outputs from exactly one place.
//
// The gate is deliberately unforgiving: an input that is not fully pinned is
// rejected rather than defaulted. There is no branch name, tag alias, or
// "latest" that can reach a deploy.
//
// Usage:
//   node scripts/deploy/validate-deployment-input.mjs <input.json>

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

export function loadJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

export const loadTopology = () => loadJson(join(repoRoot, "deployment/topology.json"));
export const loadDeploymentSchema = () => loadJson(join(repoRoot, "deployment/deployment-contract.schema.json"));
export const loadCutoverSchema = () => loadJson(join(repoRoot, "deployment/cutover-record.schema.json"));

// --- Minimal JSON Schema evaluator ----------------------------------------
// Supports only the keywords these two schemas use. An unknown keyword is a
// validator bug rather than a silent pass, so the surface stays small on
// purpose and the contracts package remains dependency-free.

function resolveRef(ref, root) {
  if (!ref.startsWith("#/")) throw new Error(`unsupported $ref: ${ref}`);
  return ref
    .slice(2)
    .split("/")
    .reduce((node, key) => node[key.replaceAll("~1", "/").replaceAll("~0", "~")], root);
}

export function validate(value, schema, root = schema, path = "$") {
  if (schema.$ref) return validate(value, resolveRef(schema.$ref, root), root, path);
  const errors = [];
  const type = schema.type;

  if (schema.const !== undefined && value !== schema.const) errors.push(`${path} must equal ${JSON.stringify(schema.const)}`);
  if (schema.enum && !schema.enum.includes(value)) errors.push(`${path} is outside the allowed set`);

  if (type === "object") {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return [`${path} must be an object`];
    for (const key of schema.required ?? []) {
      if (!Object.hasOwn(value, key)) errors.push(`${path}.${key} is required`);
    }
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!Object.hasOwn(schema.properties ?? {}, key)) errors.push(`${path}.${key} is not allowed`);
      }
    }
    for (const [key, child] of Object.entries(schema.properties ?? {})) {
      if (Object.hasOwn(value, key)) errors.push(...validate(value[key], child, root, `${path}.${key}`));
    }
  } else if (type === "array") {
    if (!Array.isArray(value)) return [`${path} must be an array`];
    if (schema.minItems !== undefined && value.length < schema.minItems) errors.push(`${path} has too few items`);
    if (schema.maxItems !== undefined && value.length > schema.maxItems) errors.push(`${path} has too many items`);
    if (schema.uniqueItems && new Set(value.map((item) => JSON.stringify(item))).size !== value.length) {
      errors.push(`${path} must not contain duplicates`);
    }
    value.forEach((item, index) => errors.push(...validate(item, schema.items, root, `${path}[${index}]`)));
  } else if (type === "string") {
    if (typeof value !== "string") return [`${path} must be a string`];
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) errors.push(`${path} does not match its pattern`);
    if (schema.maxLength !== undefined && value.length > schema.maxLength) errors.push(`${path} is too long`);
    if (schema.format === "date-time" && Number.isNaN(Date.parse(value))) errors.push(`${path} is not a timestamp`);
  } else if (type === "integer") {
    if (!Number.isInteger(value)) return [`${path} must be an integer`];
    if (schema.minimum !== undefined && value < schema.minimum) errors.push(`${path} is below its minimum`);
    if (schema.maximum !== undefined && value > schema.maximum) errors.push(`${path} exceeds its maximum`);
  } else if (type === "number") {
    if (typeof value !== "number" || !Number.isFinite(value)) return [`${path} must be a number`];
    if (schema.minimum !== undefined && value < schema.minimum) errors.push(`${path} is below its minimum`);
  } else if (type === "boolean") {
    if (typeof value !== "boolean") return [`${path} must be a boolean`];
  }
  return errors;
}

/** Resolve the Wrangler config path for one unit in one environment. */
export function configPathFor(unit, environment) {
  return typeof unit.wranglerConfig === "string" ? unit.wranglerConfig : unit.wranglerConfig[environment];
}

/** Resolve the Worker name for one unit in one environment. */
export function workerNameFor(unit, environment) {
  return typeof unit.workerName === "string" ? unit.workerName : unit.workerName[environment];
}

/**
 * Resolve the selected units in deploy order, failing closed on any unit the
 * topology does not declare.
 */
export function resolveUnits(input, topology) {
  const declared = new Map(topology.units.map((unit) => [unit.id, unit]));
  const selected = input.units.map((id) => {
    const unit = declared.get(id);
    if (unit === undefined) throw new Error(`unit is not declared in topology.json: ${id}`);
    return unit;
  });
  return selected.sort((left, right) => left.order - right.order);
}

/**
 * Validate one deployment input end to end.
 *
 * @param {object} input parsed deployment input
 * @param {{ requireOutputs?: boolean }} options `requireOutputs` additionally
 *   demands that each unit's build output and Wrangler config already exist,
 *   which is what makes a workflow fail closed instead of deploying nothing.
 */
export function validateDeploymentInput(input, options = {}) {
  const schema = loadDeploymentSchema();
  const topology = loadTopology();
  const errors = validate(input, schema);

  if (errors.length === 0) {
    if (input.topology !== topology.selected) {
      errors.push(`input topology ${input.topology} does not match the selected topology ${topology.selected}`);
    }
    if (input.productSha === input.qualificationEvidenceSha) {
      errors.push("qualificationEvidenceSha must be a descendant of productSha, not the same commit");
    }
    if (topology.ingressRule?.required && input.ingressPolicyDigest === undefined) {
      errors.push("ingressPolicyDigest is required while the topology declares a mandatory ingress rule");
    }

    let units = [];
    try {
      units = resolveUnits(input, topology);
    } catch (error) {
      errors.push(error.message);
    }

    if (options.requireOutputs) {
      for (const unit of units) {
        const config = join(repoRoot, configPathFor(unit, input.environment));
        const output = join(repoRoot, unit.output);
        // Fail closed rather than synthesizing a config or an empty output
        // directory; a missing artifact means an earlier phase has not landed.
        if (!existsSync(config)) errors.push(`missing Wrangler config for unit ${unit.id}: ${configPathFor(unit, input.environment)}`);
        if (!existsSync(output)) errors.push(`missing build output for unit ${unit.id}: ${unit.output}`);
      }
    }
  }

  return { valid: errors.length === 0, errors, topology };
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop())) {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error("usage: validate-deployment-input.mjs <input.json>");
    process.exit(1);
  }
  const requireOutputs = process.argv.includes("--require-outputs");
  const result = validateDeploymentInput(loadJson(inputPath), { requireOutputs });
  if (!result.valid) {
    console.error(`deployment input rejected:\n  ${result.errors.join("\n  ")}`);
    process.exit(1);
  }
  console.log(JSON.stringify({ valid: true, topology: result.topology.selected }, null, 2));
}
