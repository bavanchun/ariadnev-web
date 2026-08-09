import { pathToFileURL } from "node:url";

import { buildIngressRule, ingressPolicyDigest, loadIngressPolicy } from "./edge-ingress-policy.mjs";

const API_BASE = "https://api.cloudflare.com/client/v4";
const ZONE_NAME = "vchun.dev";
const MODES = new Set(["check", "apply"]);

function fail(message) {
  const error = new Error(message);
  error.code = "EDGE_INGRESS_RULE_FAILED";
  return error;
}

export async function readTokenFromStdin() {
  if (process.stdin.isTTY) throw fail("Cloudflare token must be supplied on stdin");
  let token = "";
  for await (const chunk of process.stdin) token += chunk;
  token = token.trim();
  if (token.length < 20 || token.length > 4096 || /\s/.test(token)) throw fail("invalid Cloudflare token input");
  return token;
}

function errorCodes(payload) {
  return Array.isArray(payload?.errors)
    ? payload.errors.map((entry) => Number(entry?.code)).filter(Number.isFinite).slice(0, 5)
    : [];
}

async function apiRequest(fetchImpl, token, path, { method = "GET", body, allow404 = false } = {}) {
  const response = await fetchImpl(`${API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    // API bodies are never reflected into errors or command output.
  }
  if (allow404 && response.status === 404) return { status: 404, result: null };
  if (!response.ok || payload?.success !== true) {
    throw fail(`Cloudflare API request failed: status=${response.status}; codes=${errorCodes(payload).join(",") || "none"}`);
  }
  return { status: response.status, result: payload.result };
}

function desiredRuleFields(rule) {
  return {
    ref: rule.ref,
    description: rule.description,
    expression: rule.expression,
    action: rule.action,
    enabled: rule.enabled,
  };
}

function ruleMatches(actual, desired) {
  return actual?.ref === desired.ref
    && actual.description === desired.description
    && actual.expression === desired.expression
    && actual.action === desired.action
    && actual.enabled === desired.enabled;
}

function verifyRuleset(ruleset, desired) {
  const matches = (ruleset?.rules || []).filter((rule) => rule.ref === desired.ref);
  if (matches.length !== 1 || !ruleMatches(matches[0], desired) || ruleset.rules[0]?.ref !== desired.ref) {
    throw fail("source-controlled staging ingress rule is absent, duplicated, stale, or not first");
  }
}

export async function reconcileIngressRule({ mode, environment, token, fetchImpl = fetch }) {
  if (!MODES.has(mode)) throw fail("mode must be check or apply");
  if (environment !== "staging") throw fail("Phase 3 may manage only the staging ingress rule");
  const policy = await loadIngressPolicy();
  const rule = buildIngressRule(policy, environment);
  if (rule.enabled !== true || policy.environments.production.enabled !== false) throw fail("staging-only policy gate is required");
  const desired = desiredRuleFields(rule);

  const zones = await apiRequest(fetchImpl, token, `/zones?name=${encodeURIComponent(ZONE_NAME)}&status=active&per_page=2`);
  if (!Array.isArray(zones.result) || zones.result.length !== 1 || !zones.result[0]?.id) throw fail("one exact active Cloudflare zone is required");
  const zoneId = zones.result[0].id;
  const entrypointPath = `/zones/${zoneId}/rulesets/phases/${policy.phase}/entrypoint`;
  let entrypoint = await apiRequest(fetchImpl, token, entrypointPath, { allow404: true });

  if (mode === "check") {
    if (entrypoint.status === 404) throw fail("source-controlled staging ingress rule is absent");
    verifyRuleset(entrypoint.result, desired);
    return { status: "current", ref: desired.ref, policyDigest: ingressPolicyDigest(policy, environment), position: 1 };
  }

  let mutation = "current";
  if (entrypoint.status === 404) {
    entrypoint = await apiRequest(fetchImpl, token, `/zones/${zoneId}/rulesets`, {
      method: "POST",
      body: {
        name: "Zone-level custom rules",
        description: "Source-controlled zone custom rules",
        kind: "zone",
        phase: policy.phase,
        rules: [desired],
      },
    });
    mutation = "created";
  } else {
    const rules = entrypoint.result?.rules || [];
    const matches = rules.filter((candidate) => candidate.ref === desired.ref);
    if (matches.length > 1) throw fail("duplicate source-controlled ingress rules require operator review");
    if (matches.length === 0) {
      entrypoint = await apiRequest(fetchImpl, token, `/zones/${zoneId}/rulesets/${entrypoint.result.id}/rules`, {
        method: "POST",
        body: { ...desired, position: { before: "" } },
      });
      mutation = "created";
    } else if (!ruleMatches(matches[0], desired) || rules[0]?.ref !== desired.ref) {
      entrypoint = await apiRequest(fetchImpl, token, `/zones/${zoneId}/rulesets/${entrypoint.result.id}/rules/${matches[0].id}`, {
        method: "PATCH",
        body: { ...desired, position: { before: "" } },
      });
      mutation = "updated";
    }
  }

  verifyRuleset(entrypoint.result, desired);
  return { status: mutation, ref: desired.ref, policyDigest: ingressPolicyDigest(policy, environment), position: 1 };
}

function parseArgs(argv) {
  const modeFlag = argv.find((arg) => arg === "--check" || arg === "--apply");
  const environmentFlag = argv.find((arg) => arg.startsWith("--environment="));
  if (!modeFlag || !environmentFlag || argv.length !== 2) throw fail("usage: --check|--apply --environment=staging");
  return { mode: modeFlag.slice(2), environment: environmentFlag.slice("--environment=".length) };
}

async function main(argv) {
  const options = parseArgs(argv);
  const token = await readTokenFromStdin();
  const result = await reconcileIngressRule({ ...options, token });
  process.stdout.write(`${JSON.stringify({ ...result, environment: options.environment, productionEnabled: false })}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
