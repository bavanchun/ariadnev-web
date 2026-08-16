#!/usr/bin/env node
// Idempotently inspect, apply, or remove ONLY the source-owned legacy-host
// redirect (vcskill.vchun.dev -> ariadnev.com).
//
// The rule body comes from rules/legacy-host-redirect.json. This module never
// authors a rule inline and never touches a rule it does not own, which is
// matched by its stable description. Rules belonging to other owners are re-sent
// verbatim so reconciliation can never delete them.
//
// Removal is a first-class mode, not a convenience: the plan's rollback story is
// "delete one rule, the legacy Worker resumes serving instantly, no deploy".
//
// Credentials come from the environment and are never logged:
//   CLOUDFLARE_API_TOKEN — needs Zone → Single Redirect → Edit on the target zone
//   CLOUDFLARE_ZONE_ID   — optional; otherwise resolved from the policy's zoneName
//
// Usage:
//   node scripts/manage-legacy-host-redirect.mjs [--inspect]   # read-only, default
//   node scripts/manage-legacy-host-redirect.mjs --apply
//   node scripts/manage-legacy-host-redirect.mjs --remove

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const API = "https://api.cloudflare.com/client/v4";
const POLICY_PATH = join(dirname(fileURLToPath(import.meta.url)), "..", "rules", "legacy-host-redirect.json");

/** Strip anything that could carry a credential, account id, or upstream URL. */
export function redactError(error) {
  const message = typeof error === "string" ? error : error?.message || "unknown error";
  return message
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/\b[0-9a-f]{32}\b/gi, "[redacted-id]")
    .replace(/https:\/\/api\.cloudflare\.com\S*/g, "[cloudflare-api]");
}

export function loadPolicy(path = POLICY_PATH) {
  const policy = JSON.parse(readFileSync(path, "utf8"));
  if (policy.rulesetPhase !== "http_request_dynamic_redirect") {
    throw new Error(`unexpected ruleset phase: ${policy.rulesetPhase}`);
  }
  if (!policy.rule?.description) throw new Error("policy rule is missing its stable description");
  return policy;
}

export function createClient({ token, fetchImpl = fetch }) {
  if (!token) throw new Error("CLOUDFLARE_API_TOKEN is not set");
  return async function request(path, { method = "GET", body } = {}) {
    let response;
    try {
      response = await fetchImpl(`${API}${path}`, {
        method,
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (error) {
      throw new Error(`cloudflare request failed: ${redactError(error)}`);
    }
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.success === false) {
      const detail = (payload.errors || []).map((entry) => entry.message).join("; ") || `http ${response.status}`;
      throw new Error(`cloudflare api rejected the request: ${redactError(detail)}`);
    }
    return payload.result;
  };
}

/**
 * Find the zone's dynamic-redirect entrypoint ruleset, plus the source-owned
 * rule inside it. A zone with no redirects at all has no entrypoint yet.
 */
export async function locateRule(request, zoneId, description) {
  const rulesets = await request(`/zones/${zoneId}/rulesets`);
  const entrypoint = (rulesets || []).find((ruleset) => ruleset.phase === "http_request_dynamic_redirect");
  if (!entrypoint) return { ruleset: null, rule: null, rules: [] };
  const full = await request(`/zones/${zoneId}/rulesets/${entrypoint.id}`);
  const rules = full.rules || [];
  return { ruleset: full, rule: rules.find((rule) => rule.description === description) || null, rules };
}

/**
 * Does `actual` carry every value `declared` specifies, at any nesting depth?
 *
 * Deliberately a subset test, not deep equality. Cloudflare echoes
 * `action_parameters` back with its keys in its own order and may add server-side
 * defaults; both would make a strict comparison report drift forever, so `apply`
 * would re-PUT on every run and `--inspect` would be useless as a CI gate.
 * Anything this file declares is still compared exactly.
 */
export function matchesDeclared(actual, declared) {
  if (declared === null || typeof declared !== "object") return actual === declared;
  if (actual === null || typeof actual !== "object") return false;
  if (Array.isArray(declared)) {
    return Array.isArray(actual) && actual.length === declared.length && declared.every((value, index) => matchesDeclared(actual[index], value));
  }
  return Object.keys(declared).every((key) => matchesDeclared(actual[key], declared[key]));
}

/**
 * Compute the change needed to reconcile the live rule with the source of truth.
 *
 * `action_parameters` is compared structurally, not by identity: the status code
 * lives inside it, and flipping 302 -> 301 after the rollback window closes must
 * register as drift rather than a no-op.
 */
export function planChange(existing, desired) {
  if (!existing) return { action: "create", drift: null };
  const drift = ["action", "expression", "enabled"].filter((key) => existing[key] !== desired[key]);
  if (!matchesDeclared(existing.action_parameters, desired.action_parameters)) drift.push("action_parameters");
  return drift.length === 0 ? { action: "noop", drift: null } : { action: "update", drift };
}

/** Strip server-assigned fields so a rule read back can be re-sent unchanged. */
const sendable = ({ id, version, last_updated, ref, ...rest }) => rest;

export async function reconcile({ mode = "inspect", token, zoneId, fetchImpl = fetch, policy = loadPolicy() }) {
  if (!["inspect", "apply", "remove"].includes(mode)) throw new Error(`unknown mode: ${mode}`);

  const desired = policy.rule;
  const request = createClient({ token, fetchImpl });
  const resolvedZoneId = zoneId || (await request(`/zones?name=${policy.zoneName}`))?.[0]?.id;
  if (!resolvedZoneId) throw new Error(`zone not found: ${policy.zoneName}`);

  const { ruleset, rule, rules } = await locateRule(request, resolvedZoneId, desired.description);
  const others = rules.filter((entry) => entry.description !== desired.description);

  const change = mode === "remove" ? { action: rule ? "delete" : "noop", drift: null } : planChange(rule, desired);
  const outcome = {
    mode,
    zoneName: policy.zoneName,
    entrypointPresent: Boolean(ruleset),
    statusCode: desired.action_parameters.from_value.status_code,
    action: change.action,
    drift: change.drift,
    applied: false,
    preservedRuleCount: others.length,
  };

  if (mode === "inspect" || change.action === "noop") return outcome;

  if (mode === "remove") {
    // An entrypoint ruleset with an empty rules array is rejected, so a ruleset
    // that exists only for this rule is deleted outright.
    if (others.length === 0) await request(`/zones/${resolvedZoneId}/rulesets/${ruleset.id}`, { method: "DELETE" });
    else await request(`/zones/${resolvedZoneId}/rulesets/${ruleset.id}`, { method: "PUT", body: { rules: others.map(sendable) } });
    outcome.applied = true;
    return outcome;
  }

  const next =
    change.action === "create"
      ? [...others.map(sendable), desired]
      : rules.map((entry) => (entry.description === desired.description ? { ...sendable(entry), ...desired } : sendable(entry)));

  if (ruleset) await request(`/zones/${resolvedZoneId}/rulesets/${ruleset.id}`, { method: "PUT", body: { rules: next } });
  else {
    await request(`/zones/${resolvedZoneId}/rulesets`, {
      method: "POST",
      body: { name: policy.rulesetName, kind: "zone", phase: policy.rulesetPhase, rules: [desired] },
    });
  }
  outcome.applied = true;
  return outcome;
}

export function parseMode(argv) {
  const flags = argv.filter((arg) => arg.startsWith("--"));
  const unknown = flags.filter((flag) => !["--inspect", "--apply", "--remove"].includes(flag));
  if (unknown.length > 0) throw new Error(`unknown flag: ${unknown[0]}`);
  if (flags.length > 1) throw new Error(`choose exactly one of --inspect, --apply, --remove`);
  return flags[0] ? flags[0].slice(2) : "inspect";
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop())) {
  try {
    const mode = parseMode(process.argv.slice(2));
    const outcome = await reconcile({
      mode,
      token: process.env.CLOUDFLARE_API_TOKEN,
      zoneId: process.env.CLOUDFLARE_ZONE_ID,
    });
    console.log(JSON.stringify(outcome, null, 2));
    // A read-only inspect that finds drift exits non-zero so CI can gate on it.
    if (mode === "inspect" && outcome.action !== "noop") process.exit(2);
  } catch (error) {
    console.error(redactError(error));
    process.exit(1);
  }
}
