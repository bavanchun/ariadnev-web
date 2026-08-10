#!/usr/bin/env node
// Read-only soak-window validator.
//
// A soak proves a deployment stayed healthy for a continuous window. Any event
// that changes what is running restarts that window; a soak that silently
// survives a redeploy proves nothing. Reset triggers are therefore explicit and
// the elapsed window is measured from the most recent reset, never from the
// first start.
//
// Usage:
//   node scripts/deploy/verify-soak.mjs <record.json> [--now <iso>]

import { join } from "node:path";

import { loadJson } from "./validate-deployment-input.mjs";

export const REQUIRED_WINDOW_HOURS = 24;

/** Events that invalidate an in-progress soak and restart the clock. */
export const RESET_TRIGGERS = Object.freeze(["deploy", "rollback", "config-change", "smoke-failure", "manual"]);

/** The instant the current continuous window began. */
export function windowStart(soak) {
  return new Date(soak.lastResetAtUtc ?? soak.startedAtUtc);
}

export function elapsedHours(soak, now = new Date()) {
  return (now.getTime() - windowStart(soak).getTime()) / 3_600_000;
}

export function verifySoak(record, now = new Date()) {
  const errors = [];
  const soak = record.soak;
  if (soak === undefined) return { satisfied: false, errors: ["record carries no soak window"] };

  const required = Math.max(soak.windowHours ?? REQUIRED_WINDOW_HOURS, REQUIRED_WINDOW_HOURS);
  const start = windowStart(soak);
  if (Number.isNaN(start.getTime())) errors.push("soak window start is not a valid timestamp");
  if (start.getTime() > now.getTime()) errors.push("soak window starts in the future");

  for (const trigger of soak.resetTriggers ?? []) {
    if (!RESET_TRIGGERS.includes(trigger)) errors.push(`unknown reset trigger: ${trigger}`);
  }

  // A failing observation inside the window means the deployment was not
  // healthy for it, regardless of how much wall time has passed.
  const failed = (record.observations ?? []).filter((observation) => observation.pass === false);
  if (failed.length > 0) errors.push(`${failed.length} observation(s) failed inside the soak window`);

  const elapsed = errors.length === 0 ? elapsedHours(soak, now) : 0;
  if (errors.length === 0 && elapsed < required) {
    errors.push(`soak window is ${elapsed.toFixed(2)}h of the required ${required}h`);
  }

  return {
    satisfied: errors.length === 0,
    requiredHours: required,
    elapsedHours: Number(elapsed.toFixed(2)),
    windowStartUtc: start.toISOString(),
    resetTriggers: soak.resetTriggers ?? [],
    errors,
  };
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop())) {
  const recordPath = process.argv[2];
  if (!recordPath) {
    console.error("usage: verify-soak.mjs <record.json> [--now <iso>]");
    process.exit(1);
  }
  const nowIndex = process.argv.indexOf("--now");
  const result = verifySoak(loadJson(join(process.cwd(), recordPath)), nowIndex === -1 ? new Date() : new Date(process.argv[nowIndex + 1]));
  console.log(JSON.stringify(result, null, 2));
  if (!result.satisfied) process.exit(1);
}
