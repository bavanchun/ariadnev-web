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

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { evaluate } from "./edge-ingress-policy.mjs";

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

/** Does the rule's expression match this host and path? */
export function matches(expression, { host, path }) {
  return evaluate(expression, { "http.host": host, "http.request.uri.path": path });
}

/**
 * Check the rule's expression against the policy's own declared corpus.
 *
 * Without this the corpus is decorative. Changing `eq` to `contains` would widen
 * the rule to every host ending in `vcskill.vchun.dev` — including candidate-b
 * staging — and nothing would object. `--apply` refuses on any failure.
 */
export function verifyPolicy(policy) {
  const { expression } = policy.rule;
  const failures = [];

  for (const probe of policy.mustRedirect) {
    if (!matches(expression, probe)) failures.push({ ...probe, expected: "redirect", actual: "pass-through" });
  }
  for (const probe of policy.mustNotRedirect) {
    if (matches(expression, probe)) failures.push({ ...probe, expected: "pass-through", actual: "redirect" });
  }
  return { expression, failures, digest: digestPolicy(policy) };
}

/** Stable digest of what was actually applied, so drift is attributable. */
export function digestPolicy(policy) {
  const canonical = JSON.stringify({
    id: policy.id,
    action: policy.rule.action,
    description: policy.rule.description,
    expression: policy.rule.expression,
    enabled: policy.rule.enabled,
    actionParameters: policy.rule.action_parameters,
  });
  return `sha256:${createHash("sha256").update(canonical).digest("hex")}`;
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
 * Resolve the target zone and prove its identity before anything destructive.
 *
 * `CLOUDFLARE_ZONE_ID` is the same variable name `manage-edge-ingress-rule.mjs`
 * reads, so an operator with it exported for another zone is a realistic state —
 * and `--remove` can DELETE a ruleset. An id supplied by the caller is therefore
 * verified against the policy's `zoneName` rather than trusted, and the name
 * reported back comes from the API, not from the policy file, so the outcome can
 * never misstate the blast radius.
 */
export async function resolveZone(request, policy, zoneId) {
  if (!zoneId) {
    const matched = (await request(`/zones?name=${policy.zoneName}`))?.[0];
    if (!matched?.id) throw new Error(`zone not found: ${policy.zoneName}`);
    return { zoneId: matched.id, zoneName: matched.name ?? policy.zoneName };
  }

  const zone = await request(`/zones/${zoneId}`);
  if (zone?.name !== policy.zoneName) {
    throw new Error(
      `refusing to act: CLOUDFLARE_ZONE_ID resolves to zone "${zone?.name ?? "unknown"}" but the policy targets "${policy.zoneName}"`,
    );
  }
  return { zoneId, zoneName: zone.name };
}

/**
 * Find the zone's dynamic-redirect entrypoint ruleset, plus the source-owned
 * rule inside it. A zone with no redirects at all has no entrypoint yet.
 */
export async function locateRule(request, zoneId, description) {
  const rulesets = await request(`/zones/${zoneId}/rulesets`);
  // The zone listing also includes account-level rulesets deployable to this
  // zone. Writing into one of those would report success while executing
  // nothing, so only a zone entrypoint qualifies.
  const candidates = (rulesets || []).filter(
    (ruleset) => ruleset.phase === "http_request_dynamic_redirect" && ruleset.kind === "zone",
  );
  if (candidates.length > 1) {
    throw new Error(`ambiguous target: ${candidates.length} zone-level dynamic-redirect rulesets on this zone`);
  }
  const entrypoint = candidates[0];
  if (!entrypoint) return { ruleset: null, rule: null, rules: [] };

  const full = await request(`/zones/${zoneId}/rulesets/${entrypoint.id}`);
  const rules = full.rules || [];
  const owned = rules.filter((rule) => rule.description === description);
  // Duplicates would make `--apply` write another copy and `--remove` delete
  // both. Refuse rather than guess which one is authoritative.
  if (owned.length > 1) {
    throw new Error(`ambiguous target: ${owned.length} rules share the description "${description}"`);
  }
  return { ruleset: full, rule: owned[0] || null, rules };
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

  // Corpus first: never reach the network with an expression the policy's own
  // probes reject.
  const verification = verifyPolicy(policy);
  if (verification.failures.length > 0) {
    throw new Error(`policy corpus failed: ${JSON.stringify(verification.failures)}`);
  }

  const desired = policy.rule;
  const request = createClient({ token, fetchImpl });
  const { zoneId: resolvedZoneId, zoneName } = await resolveZone(request, policy, zoneId);

  const { ruleset, rule, rules } = await locateRule(request, resolvedZoneId, desired.description);
  const others = rules.filter((entry) => entry.description !== desired.description);

  const change = mode === "remove" ? { action: rule ? "delete" : "noop", drift: null } : planChange(rule, desired);
  const outcome = {
    mode,
    // From the API, not the policy file, so the outcome can never misstate which
    // zone was touched.
    zoneName,
    entrypointPresent: Boolean(ruleset),
    statusCode: desired.action_parameters.from_value.status_code,
    digest: verification.digest,
    action: change.action,
    drift: change.drift,
    applied: false,
    preservedRuleCount: others.length,
    // Dynamic redirect is first-match-wins, so a rule inserted above this one
    // silently defeats it while every field this tool compares still matches.
    // Structural comparison cannot see that; the position can.
    rulePosition: rule ? rules.indexOf(rule) : null,
    ruleCount: rules.length,
  };

  if (mode === "inspect" || change.action === "noop") return outcome;

  if (mode === "remove") {
    if (others.length > 0) {
      await request(`/zones/${resolvedZoneId}/rulesets/${ruleset.id}`, { method: "PUT", body: { rules: others.map(sendable) } });
      outcome.applied = true;
      return outcome;
    }

    // An entrypoint ruleset with an empty rules array is rejected, so a ruleset
    // that exists only for this rule is deleted outright. Re-read immediately
    // first: the listing above and this DELETE are separated by network round
    // trips, and a rule added by anyone in that window would be destroyed with
    // the ruleset. Fall back to the non-destructive path if that happened.
    const current = await request(`/zones/${resolvedZoneId}/rulesets/${ruleset.id}`);
    const survivors = (current.rules || []).filter((entry) => entry.description !== desired.description);
    if (survivors.length > 0) {
      await request(`/zones/${resolvedZoneId}/rulesets/${ruleset.id}`, { method: "PUT", body: { rules: survivors.map(sendable) } });
      outcome.preservedRuleCount = survivors.length;
      outcome.note = "another owner's rule appeared after the initial read; kept the ruleset instead of deleting it";
    } else {
      await request(`/zones/${resolvedZoneId}/rulesets/${ruleset.id}`, { method: "DELETE" });
    }
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
