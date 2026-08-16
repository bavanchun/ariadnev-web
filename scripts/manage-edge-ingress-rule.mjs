#!/usr/bin/env node
// Idempotently check or apply ONLY the source-owned raw-path ingress rule.
//
// The rule body comes from scripts/edge-ingress-policy.mjs, which validates it
// against a declared block/allow corpus first. This module never authors a rule
// inline, never touches a rule it does not own (matched by description), and
// never widens scope beyond the environment's hostname.
//
// Credentials come from the environment and are never logged:
//   CLOUDFLARE_API_TOKEN — needs Zone → WAF → Edit on the target zone
//   CLOUDFLARE_ZONE_ID   — optional; otherwise resolved from the policy's zoneName
//
// Usage:
//   node scripts/manage-edge-ingress-rule.mjs check  [staging|production]
//   node scripts/manage-edge-ingress-rule.mjs apply  [staging|production]

import { loadPolicy, ruleBody, verifyPolicy } from "./edge-ingress-policy.mjs";

const API = "https://api.cloudflare.com/client/v4";
const RULESET_PHASE = "http_request_firewall_custom";

/** Strip anything that could carry a credential, account id, or upstream URL. */
export function redactError(error) {
  const message = typeof error === "string" ? error : error?.message || "unknown error";
  return message
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/\b[0-9a-f]{32}\b/gi, "[redacted-id]")
    .replace(/https:\/\/api\.cloudflare\.com\S*/g, "[cloudflare-api]");
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
 * Find the ruleset that owns custom firewall rules for the zone, plus the
 * source-owned rule inside it (matched by its stable description).
 */
export async function locateRule(request, zoneId, description) {
  const rulesets = await request(`/zones/${zoneId}/rulesets`);
  const entrypoint = rulesets.find((ruleset) => ruleset.phase === RULESET_PHASE);
  if (!entrypoint) return { ruleset: null, rule: null, rules: [] };
  const full = await request(`/zones/${zoneId}/rulesets/${entrypoint.id}`);
  const rules = full.rules || [];
  return { ruleset: full, rule: rules.find((rule) => rule.description === description) || null, rules };
}

/**
 * Compute the change needed to reconcile the live rule with the source of
 * truth, without mutating anything.
 */
export function planChange(existing, desired) {
  if (!existing) return { action: "create", drift: null };
  const drift = ["action", "expression", "enabled"].filter((key) => existing[key] !== desired[key]);
  return drift.length === 0 ? { action: "noop", drift: null } : { action: "update", drift };
}

export async function reconcile({ environment, apply, token, zoneId, fetchImpl = fetch }) {
  const policy = loadPolicy();
  const verification = verifyPolicy(policy, environment);
  if (verification.failures.length > 0) {
    throw new Error(`policy corpus failed: ${JSON.stringify(verification.failures)}`);
  }

  const desired = ruleBody(policy, environment);
  const request = createClient({ token, fetchImpl });
  const resolvedZoneId = zoneId || (await request(`/zones?name=${policy.zoneName}`))[0]?.id;
  if (!resolvedZoneId) throw new Error(`zone not found: ${policy.zoneName}`);

  const { ruleset, rule, rules } = await locateRule(request, resolvedZoneId, desired.description);
  const change = planChange(rule, desired);

  const outcome = {
    environment,
    hostname: verification.hostname,
    digest: verification.digest,
    action: change.action,
    drift: change.drift,
    applied: false,
    preservedRuleCount: rules.filter((entry) => entry.description !== desired.description).length,
  };
  if (!apply || change.action === "noop") return outcome;

  // Rules the source does not own are re-sent verbatim so reconciliation can
  // never delete another owner's rule.
  const preserved = rules.filter((entry) => entry.description !== desired.description).map(({ id, ...rest }) => rest);
  const next = change.action === "create" ? [...preserved, desired] : rules.map((entry) => (entry.description === desired.description ? { ...entry, ...desired } : entry)).map(({ id, ...rest }) => rest);

  if (ruleset) await request(`/zones/${resolvedZoneId}/rulesets/${ruleset.id}`, { method: "PUT", body: { rules: next } });
  else {
    await request(`/zones/${resolvedZoneId}/rulesets`, {
      method: "POST",
      body: { name: "ariadnev edge ingress", kind: "zone", phase: RULESET_PHASE, rules: [desired] },
    });
  }
  outcome.applied = true;
  return outcome;
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop())) {
  const mode = process.argv[2] || "check";
  const environment = process.argv[3] || "staging";
  if (!["check", "apply"].includes(mode)) throw new Error(`unknown mode: ${mode}`);
  try {
    const outcome = await reconcile({
      environment,
      apply: mode === "apply",
      token: process.env.CLOUDFLARE_API_TOKEN,
      zoneId: process.env.CLOUDFLARE_ZONE_ID,
    });
    console.log(JSON.stringify(outcome, null, 2));
    if (mode === "check" && outcome.action !== "noop") process.exit(2);
  } catch (error) {
    console.error(redactError(error));
    process.exit(1);
  }
}
