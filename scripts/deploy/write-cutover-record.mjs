#!/usr/bin/env node
// Schema-valid, redacted cutover record writer.
//
// Every lifecycle record for a deployment attempt passes through here, so the
// redaction rules and the legal state transitions are enforced in one place
// rather than at each call site.
//
// Usage:
//   node scripts/deploy/write-cutover-record.mjs <record.json> --out <path>

import { writeFileSync } from "node:fs";

import { loadCutoverSchema, loadJson, validate } from "./validate-deployment-input.mjs";

// Values that must never reach a committed record, matched on shape rather
// than on a field name so a secret cannot hide under an unexpected key.
const SECRET_SHAPES = [
  /\bghp_[A-Za-z0-9]{16,}\b/,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/,
  /\bBearer\s+[A-Za-z0-9._~+/-]{16,}/i,
  /\bX-Amz-Signature=/i,
  /\b[Ss]ignature=[A-Za-z0-9%._-]{16,}/,
  // A bare 32-hex string is a Cloudflare account or zone identifier.
  /\b[0-9a-f]{32}\b/,
];

const FORBIDDEN_KEYS = new Set(["token", "secret", "apiKey", "api_key", "password", "authorization", "accountId", "zoneId"]);

/** Walk a record and collect every redaction violation. */
export function findSecrets(value, path = "$") {
  const findings = [];
  if (typeof value === "string") {
    for (const shape of SECRET_SHAPES) {
      if (shape.test(value)) findings.push(`${path} looks like a credential or account identifier`);
    }
  } else if (Array.isArray(value)) {
    value.forEach((item, index) => findings.push(...findSecrets(item, `${path}[${index}]`)));
  } else if (value !== null && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      if (FORBIDDEN_KEYS.has(key)) findings.push(`${path}.${key} is a forbidden field`);
      findings.push(...findSecrets(child, `${path}.${key}`));
    }
  }
  return findings;
}

// A record may only move forward, and a rollback is terminal.
const LEGAL_TRANSITIONS = {
  preflight: ["deploy"],
  deploy: ["soak", "rollback"],
  soak: ["rollback"],
  rollback: [],
};

export function assertLegalTransition(previousPhase, nextPhase) {
  if (previousPhase === undefined) return;
  if (!LEGAL_TRANSITIONS[previousPhase]?.includes(nextPhase)) {
    throw new Error(`illegal cutover transition: ${previousPhase} -> ${nextPhase}`);
  }
}

/**
 * Validate a record against the v1 schema, its redaction rules, and — when a
 * previous record is supplied — the lifecycle and product-immutability rules.
 */
export function validateCutoverRecord(record, previous) {
  const errors = validate(record, loadCutoverSchema());

  const secrets = findSecrets(record);
  errors.push(...secrets);

  if (previous !== undefined) {
    try {
      assertLegalTransition(previous.phase, record.phase);
    } catch (error) {
      errors.push(error.message);
    }
    // Evidence may accumulate, but it may never change what was deployed.
    if (previous.input?.productSha !== record.input?.productSha) {
      errors.push("productSha changed between records; evidence may not alter the deployed product");
    }
    if (previous.input?.topology !== record.input?.topology) {
      errors.push("topology changed between records for one cutover");
    }
    if (previous.recordId !== record.recordId) errors.push("recordId changed between records for one cutover");
  }

  if (record.phase === "rollback" && record.rollback === undefined) {
    errors.push("a rollback record must carry its rollback detail");
  }
  if (record.phase === "soak" && record.soak === undefined) {
    errors.push("a soak record must carry its soak window");
  }
  // Observation provenance is the whole point of the format: a row with no
  // deployment label cannot be attributed and is therefore not evidence.
  for (const [index, observation] of (record.observations ?? []).entries()) {
    if (!observation.deploymentLabel) errors.push(`observations[${index}] has no deploymentLabel`);
  }

  return { valid: errors.length === 0, errors };
}

export function writeCutoverRecord(record, outPath, previous) {
  const { valid, errors } = validateCutoverRecord(record, previous);
  if (!valid) throw new Error(`cutover record rejected:\n  ${errors.join("\n  ")}`);
  writeFileSync(outPath, `${JSON.stringify(record, null, 2)}\n`);
  return { written: outPath, phase: record.phase, recordId: record.recordId };
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop())) {
  const [recordPath] = process.argv.slice(2);
  const outIndex = process.argv.indexOf("--out");
  const previousIndex = process.argv.indexOf("--previous");
  if (!recordPath || outIndex === -1) {
    console.error("usage: write-cutover-record.mjs <record.json> --out <path> [--previous <path>]");
    process.exit(1);
  }
  try {
    const previous = previousIndex === -1 ? undefined : loadJson(process.argv[previousIndex + 1]);
    console.log(JSON.stringify(writeCutoverRecord(loadJson(recordPath), process.argv[outIndex + 1], previous), null, 2));
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
