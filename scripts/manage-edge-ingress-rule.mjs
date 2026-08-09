import { createHash } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import {
  buildIngressRule,
  buildIngressRuleDefinition,
  ingressPolicyDigest,
  loadIngressPolicy,
} from "./edge-ingress-policy.mjs";

const API_BASE = "https://api.cloudflare.com/client/v4";
const ZONE_NAME = "vchun.dev";
const MODES = new Set(["capture", "check", "apply", "restore"]);
const SHA256 = /^sha256:[a-f0-9]{64}$/;
const MAX_INPUT_BYTES = 64 * 1024;
const MANAGED_RULE_FIELDS = new Set([
  "id", "version", "last_updated", "ref", "description", "expression", "action", "enabled",
]);

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

function ordered(value) {
  if (Array.isArray(value)) return value.map((entry) => ordered(entry));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, ordered(value[key])]),
  );
}

function canonicalJson(value) {
  return JSON.stringify(ordered(value));
}

function sha256(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function digestValue(value) {
  return sha256(canonicalJson(value));
}

function ruleForDigest(rule) {
  return Object.fromEntries(Object.entries(rule).filter(([key]) => key !== "last_updated" && key !== "version"));
}

function exactKeys(value, expected, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw fail(`${label} must be an object`);
  const actual = Object.keys(value).sort();
  if (JSON.stringify(actual) !== JSON.stringify([...expected].sort())) throw fail(`${label} fields are invalid`);
}

function errorCodes(payload) {
  return Array.isArray(payload?.errors)
    ? payload.errors.map((entry) => Number(entry?.code)).filter(Number.isFinite).slice(0, 5)
    : [];
}

async function apiRequest(fetchImpl, token, path, { method = "GET", body, allow404 = false, allowNoContent = false } = {}) {
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
  if (allowNoContent && response.status === 204) return { status: 204, result: null };
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

function definitionFields(rule) {
  return {
    ref: rule?.ref,
    description: rule?.description,
    expression: rule?.expression,
    action: rule?.action,
  };
}

function ruleDefinitionMatches(actual, desiredDefinition) {
  return canonicalJson(definitionFields(actual)) === canonicalJson(desiredDefinition);
}

function ruleMatches(actual, desired) {
  return ruleDefinitionMatches(actual, definitionFields(desired)) && actual?.enabled === desired.enabled;
}

function assertManagedRuleShape(rule) {
  if (Object.keys(rule).some((key) => !MANAGED_RULE_FIELDS.has(key))) {
    throw fail("source-controlled ingress rule contains unexpected fields");
  }
}

function validateEntrypoint(ruleset, policy) {
  if (!ruleset || typeof ruleset !== "object" || typeof ruleset.id !== "string" || !ruleset.id || !Array.isArray(ruleset.rules)) {
    throw fail("Cloudflare entrypoint shape is invalid");
  }
  if (ruleset.phase !== undefined && ruleset.phase !== policy.phase) throw fail("Cloudflare entrypoint phase drift");
  if (ruleset.kind !== undefined && ruleset.kind !== "zone") throw fail("Cloudflare entrypoint kind drift");
}

function snapshotCore({ environment, policy, entrypoint }) {
  const definition = buildIngressRuleDefinition(policy, environment);
  const policyDigest = ingressPolicyDigest(policy, environment);
  if (entrypoint === null) {
    return {
      schemaVersion: 1,
      environment,
      phase: policy.phase,
      policyDigest,
      definitionDigest: digestValue(definition),
      entrypoint: { exists: false, identityDigest: null, metadataDigest: null },
      managedRule: null,
      unrelatedRules: { count: 0, digest: digestValue([]) },
    };
  }

  validateEntrypoint(entrypoint, policy);
  const matches = entrypoint.rules.filter((rule) => rule?.ref === definition.ref);
  if (matches.length > 1) throw fail("duplicate source-controlled ingress rules require operator review");
  if (matches.length === 1 && !ruleDefinitionMatches(matches[0], definition)) {
    throw fail("source-controlled ingress rule definition is stale");
  }
  const managed = matches[0] || null;
  if (managed && (typeof managed.id !== "string" || !managed.id || typeof managed.enabled !== "boolean")) {
    throw fail("source-controlled ingress rule metadata is invalid");
  }
  if (managed) assertManagedRuleShape(managed);
  const unrelated = entrypoint.rules.filter((rule) => rule !== managed);
  return {
    schemaVersion: 1,
    environment,
    phase: policy.phase,
    policyDigest,
    definitionDigest: digestValue(definition),
    entrypoint: {
      exists: true,
      identityDigest: sha256(entrypoint.id),
      metadataDigest: digestValue({
        name: entrypoint.name ?? null,
        description: entrypoint.description ?? null,
        kind: entrypoint.kind ?? "zone",
        phase: entrypoint.phase ?? policy.phase,
      }),
    },
    managedRule: managed
      ? {
          identityDigest: sha256(managed.id),
          index: entrypoint.rules.indexOf(managed) + 1,
          enabled: managed.enabled,
          definitionDigest: digestValue(definition),
        }
      : null,
    unrelatedRules: {
      count: unrelated.length,
      digest: digestValue(unrelated.map(ruleForDigest)),
    },
  };
}

function buildSnapshot(input) {
  const core = snapshotCore(input);
  return Object.freeze({ ...core, stateDigest: digestValue(core) });
}

function validateSnapshot(snapshot, policy, environment) {
  exactKeys(snapshot, [
    "schemaVersion", "environment", "phase", "policyDigest", "definitionDigest",
    "entrypoint", "managedRule", "unrelatedRules", "stateDigest",
  ], "ingress snapshot");
  if (snapshot.schemaVersion !== 1 || snapshot.environment !== environment || snapshot.phase !== policy.phase) {
    throw fail("ingress snapshot identity drift");
  }
  if (snapshot.policyDigest !== ingressPolicyDigest(policy, environment)) throw fail("ingress snapshot policy drift");
  if (snapshot.definitionDigest !== digestValue(buildIngressRuleDefinition(policy, environment))) {
    throw fail("ingress snapshot definition drift");
  }
  exactKeys(snapshot.entrypoint, ["exists", "identityDigest", "metadataDigest"], "ingress snapshot entrypoint");
  exactKeys(snapshot.unrelatedRules, ["count", "digest"], "ingress snapshot unrelated rules");
  if (!Number.isSafeInteger(snapshot.unrelatedRules.count) || snapshot.unrelatedRules.count < 0 || !SHA256.test(snapshot.unrelatedRules.digest)) {
    throw fail("ingress snapshot unrelated-rule summary is invalid");
  }
  if (snapshot.entrypoint.exists === false) {
    if (snapshot.entrypoint.identityDigest !== null || snapshot.entrypoint.metadataDigest !== null || snapshot.managedRule !== null
      || snapshot.unrelatedRules.count !== 0 || snapshot.unrelatedRules.digest !== digestValue([])) {
      throw fail("absent ingress entrypoint snapshot is inconsistent");
    }
  } else if (snapshot.entrypoint.exists === true) {
    if (!SHA256.test(snapshot.entrypoint.identityDigest) || !SHA256.test(snapshot.entrypoint.metadataDigest)) {
      throw fail("ingress snapshot entrypoint digest is invalid");
    }
    if (snapshot.managedRule !== null) {
      exactKeys(snapshot.managedRule, ["identityDigest", "index", "enabled", "definitionDigest"], "ingress snapshot managed rule");
      if (!SHA256.test(snapshot.managedRule.identityDigest)
        || !Number.isSafeInteger(snapshot.managedRule.index)
        || snapshot.managedRule.index < 1
        || snapshot.managedRule.index > snapshot.unrelatedRules.count + 1
        || typeof snapshot.managedRule.enabled !== "boolean"
        || snapshot.managedRule.definitionDigest !== snapshot.definitionDigest) {
        throw fail("ingress snapshot managed rule is invalid");
      }
    }
  } else {
    throw fail("ingress snapshot entrypoint state is invalid");
  }
  const { stateDigest, ...core } = snapshot;
  if (!SHA256.test(stateDigest) || stateDigest !== digestValue(core)) throw fail("ingress snapshot digest drift");
  return snapshot;
}

function snapshotsEqual(left, right) {
  return left.stateDigest === right.stateDigest && canonicalJson(left) === canonicalJson(right);
}

function validateProductionAuthorization(value, expected = {}) {
  exactKeys(value, [
    "schemaVersion", "environment", "protectedEnvironment",
    "immutablePolicyAttestationDigest", "deploymentInputDigest", "ingressPolicyDigest", "prestateDigest",
  ], "production authorization");
  if (value.schemaVersion !== 1 || value.environment !== "production" || value.protectedEnvironment !== "production") {
    throw fail("production authorization environment drift");
  }
  if (!SHA256.test(value.immutablePolicyAttestationDigest)
    || !SHA256.test(value.deploymentInputDigest)
    || !SHA256.test(value.ingressPolicyDigest)
    || !SHA256.test(value.prestateDigest)) {
    throw fail("production authorization digest is invalid");
  }
  if (expected.ingressPolicyDigest && value.ingressPolicyDigest !== expected.ingressPolicyDigest) {
    throw fail("production authorization ingress policy drift");
  }
  if (expected.prestateDigest && value.prestateDigest !== expected.prestateDigest) {
    throw fail("production authorization prestate drift");
  }
  return value;
}

function resolveDesiredEnabled({ mode, environment, policy, desiredEnabled, productionAuthorization }) {
  const resolved = desiredEnabled ?? policy.environments[environment]?.enabled;
  if (typeof resolved !== "boolean") throw fail("desired ingress enabled state must be boolean");
  if (mode === "apply") {
    if (resolved !== true) throw fail("ingress apply only supports activation");
    if (environment === "production") validateProductionAuthorization(productionAuthorization);
    if (environment === "staging" && policy.environments.staging.enabled !== true) throw fail("staging activation policy drift");
  }
  if (mode === "check" && environment === "production" && resolved === true) {
    validateProductionAuthorization(productionAuthorization);
  }
  return resolved;
}

async function readRemoteState({ fetchImpl, token, policy, environment }) {
  const zones = await apiRequest(fetchImpl, token, `/zones?name=${encodeURIComponent(ZONE_NAME)}&status=active&per_page=2`);
  if (!Array.isArray(zones.result) || zones.result.length !== 1 || typeof zones.result[0]?.id !== "string" || !zones.result[0].id) {
    throw fail("one exact active Cloudflare zone is required");
  }
  const zoneId = zones.result[0].id;
  const entrypointPath = `/zones/${zoneId}/rulesets/phases/${policy.phase}/entrypoint`;
  const response = await apiRequest(fetchImpl, token, entrypointPath, { allow404: true });
  const entrypoint = response.status === 404 ? null : response.result;
  return { zoneId, entrypoint, snapshot: buildSnapshot({ environment, policy, entrypoint }) };
}

function verifyDesiredState(snapshot, desired) {
  if (!snapshot.entrypoint.exists || !snapshot.managedRule || snapshot.managedRule.index !== 1
    || snapshot.managedRule.enabled !== desired.enabled
    || snapshot.managedRule.definitionDigest !== snapshot.definitionDigest) {
    throw fail("source-controlled ingress rule is absent, stale, disabled, or not first");
  }
}

function verifyApplyPreserved(prestate, current) {
  if (prestate.unrelatedRules.count !== current.unrelatedRules.count
    || prestate.unrelatedRules.digest !== current.unrelatedRules.digest) {
    throw fail("unrelated ingress rules changed during activation");
  }
  if (prestate.entrypoint.exists) {
    if (!current.entrypoint.exists
      || prestate.entrypoint.identityDigest !== current.entrypoint.identityDigest
      || prestate.entrypoint.metadataDigest !== current.entrypoint.metadataDigest) {
      throw fail("ingress entrypoint changed during activation");
    }
    if (prestate.managedRule && prestate.managedRule.identityDigest !== current.managedRule?.identityDigest) {
      throw fail("source-controlled ingress rule identity changed during activation");
    }
  } else if (!current.entrypoint.exists || current.unrelatedRules.count !== 0) {
    throw fail("new ingress entrypoint contains unexpected rules");
  }
}

function resultFor(snapshot, desired, status, extra = {}) {
  return {
    status,
    ref: desired.ref,
    policyDigest: snapshot.policyDigest,
    position: snapshot.managedRule?.index ?? null,
    stateDigest: snapshot.stateDigest,
    ...extra,
  };
}

export async function reconcileIngressRule({
  mode,
  environment,
  token,
  fetchImpl = fetch,
  prestate,
  expectedCurrentStateDigest,
  desiredEnabled,
  productionAuthorization,
}) {
  if (!MODES.has(mode)) throw fail("mode must be capture, check, apply, or restore");
  if (!new Set(["staging", "production"]).has(environment)) throw fail("known ingress environment is required");
  const policy = await loadIngressPolicy();
  if (policy.environments.production.enabled !== false) throw fail("source production ingress rule must remain disabled before cutover");
  const desired = desiredRuleFields(buildIngressRule(policy, environment, {
    enabled: mode === "restore" ? true : resolveDesiredEnabled({ mode, environment, policy, desiredEnabled, productionAuthorization }),
  }));
  const current = await readRemoteState({ fetchImpl, token, policy, environment });

  if (mode === "capture") return current.snapshot;
  if (mode === "check") {
    if (environment === "production" && desired.enabled === true) {
      validateProductionAuthorization(productionAuthorization, {
        ingressPolicyDigest: `sha256:${current.snapshot.policyDigest}`,
        prestateDigest: current.snapshot.stateDigest,
      });
    }
    verifyDesiredState(current.snapshot, desired);
    return resultFor(current.snapshot, desired, "current");
  }

  const trustedPrestate = validateSnapshot(prestate, policy, environment);
  if (mode === "apply") {
    if (environment === "production") {
      validateProductionAuthorization(productionAuthorization, {
        ingressPolicyDigest: `sha256:${trustedPrestate.policyDigest}`,
        prestateDigest: trustedPrestate.stateDigest,
      });
    }
    if (!snapshotsEqual(current.snapshot, trustedPrestate)) {
      if (expectedCurrentStateDigest !== undefined
        && (!SHA256.test(expectedCurrentStateDigest) || current.snapshot.stateDigest !== expectedCurrentStateDigest)) {
        throw fail("live ingress state does not match the expected activated state");
      }
      try {
        verifyDesiredState(current.snapshot, desired);
        verifyApplyPreserved(trustedPrestate, current.snapshot);
      } catch {
        throw fail("live ingress state does not match the captured prestate or uniquely valid applied state");
      }
      return resultFor(current.snapshot, desired, "current", {
        prestateDigest: trustedPrestate.stateDigest,
        rollbackRequired: true,
      });
    }

    let mutationState = current;
    let currentRule = mutationState.entrypoint?.rules?.find((rule) => rule?.ref === desired.ref) || null;
    let status = "current";
    const mutationRequired = !mutationState.entrypoint
      || !currentRule
      || !ruleMatches(currentRule, desired)
      || mutationState.snapshot.managedRule?.index !== 1;
    if (mutationRequired) {
      mutationState = await readRemoteState({ fetchImpl, token, policy, environment });
      if (!snapshotsEqual(mutationState.snapshot, trustedPrestate)) {
        throw fail("live ingress state changed immediately before mutation");
      }
      currentRule = mutationState.entrypoint?.rules?.find((rule) => rule?.ref === desired.ref) || null;
    }
    if (!mutationState.entrypoint) {
      await apiRequest(fetchImpl, token, `/zones/${mutationState.zoneId}/rulesets`, {
        method: "POST",
        body: {
          name: "Zone-level custom rules",
          description: "Source-controlled zone custom rules",
          kind: "zone",
          phase: policy.phase,
          rules: [desired],
        },
      });
      status = "created";
    } else if (!currentRule) {
      await apiRequest(fetchImpl, token, `/zones/${mutationState.zoneId}/rulesets/${mutationState.entrypoint.id}/rules`, {
        method: "POST",
        body: { ...desired, position: { index: 1 } },
      });
      status = "created";
    } else if (!ruleMatches(currentRule, desired) || mutationState.snapshot.managedRule?.index !== 1) {
      await apiRequest(fetchImpl, token, `/zones/${mutationState.zoneId}/rulesets/${mutationState.entrypoint.id}/rules/${currentRule.id}`, {
        method: "PATCH",
        body: { ...desired, position: { index: 1 } },
      });
      status = "updated";
    }

    const applied = status === "current"
      ? mutationState
      : await readRemoteState({ fetchImpl, token, policy, environment });
    verifyDesiredState(applied.snapshot, desired);
    verifyApplyPreserved(trustedPrestate, applied.snapshot);
    return resultFor(applied.snapshot, desired, status, {
      prestateDigest: trustedPrestate.stateDigest,
      rollbackRequired: !snapshotsEqual(applied.snapshot, trustedPrestate),
    });
  }

  if (snapshotsEqual(current.snapshot, trustedPrestate)) {
    return resultFor(current.snapshot, desired, "current", {
      prestateDigest: trustedPrestate.stateDigest,
      rollbackRequired: false,
    });
  }
  if (expectedCurrentStateDigest !== undefined && (!SHA256.test(expectedCurrentStateDigest) || current.snapshot.stateDigest !== expectedCurrentStateDigest)) {
    throw fail("live ingress state does not match the expected activated state");
  }
  verifyDesiredState(current.snapshot, desired);
  verifyApplyPreserved(trustedPrestate, current.snapshot);

  let status;
  if (!trustedPrestate.entrypoint.exists) {
    await apiRequest(fetchImpl, token, `/zones/${current.zoneId}/rulesets/${current.entrypoint.id}`, {
      method: "DELETE",
      allowNoContent: true,
    });
    status = "deleted-ruleset";
  } else if (trustedPrestate.managedRule === null) {
    const currentRule = current.entrypoint.rules.find((rule) => rule?.ref === desired.ref);
    await apiRequest(fetchImpl, token, `/zones/${current.zoneId}/rulesets/${current.entrypoint.id}/rules/${currentRule.id}`, {
      method: "DELETE",
    });
    status = "deleted-rule";
  } else {
    const currentRule = current.entrypoint.rules.find((rule) => rule?.ref === desired.ref);
    await apiRequest(fetchImpl, token, `/zones/${current.zoneId}/rulesets/${current.entrypoint.id}/rules/${currentRule.id}`, {
      method: "PATCH",
      body: {
        ...definitionFields(desired),
        enabled: trustedPrestate.managedRule.enabled,
        position: { index: trustedPrestate.managedRule.index },
      },
    });
    status = "restored";
  }
  const restored = await readRemoteState({ fetchImpl, token, policy, environment });
  if (!snapshotsEqual(restored.snapshot, trustedPrestate)) throw fail("exact ingress prestate was not restored");
  return resultFor(restored.snapshot, desired, status, {
    prestateDigest: trustedPrestate.stateDigest,
    rollbackRequired: false,
  });
}

async function readBoundedJson(path, label) {
  try {
    const stat = await lstat(path);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size < 2 || stat.size > MAX_INPUT_BYTES) throw fail(`${label} file is invalid`);
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (error?.code === "EDGE_INGRESS_RULE_FAILED") throw error;
    throw fail(`${label} file is invalid`);
  }
}

function parseBoolean(value, label) {
  if (value === "true") return true;
  if (value === "false") return false;
  throw fail(`${label} must be true or false`);
}

function parseArgs(argv) {
  const options = {};
  const assign = (key, value) => {
    if (Object.hasOwn(options, key)) throw fail(`duplicate ingress rule argument: ${key}`);
    options[key] = value;
  };
  for (const arg of argv) {
    if (["--capture", "--check", "--apply", "--restore"].includes(arg)) {
      if (options.mode) throw fail("exactly one ingress mode is required");
      options.mode = arg.slice(2);
    } else if (arg.startsWith("--environment=")) assign("environment", arg.slice("--environment=".length));
    else if (arg.startsWith("--snapshot=")) assign("snapshotPath", arg.slice("--snapshot=".length));
    else if (arg.startsWith("--production-authorization=")) assign("productionAuthorizationPath", arg.slice("--production-authorization=".length));
    else if (arg.startsWith("--expected-current-state-digest=")) assign("expectedCurrentStateDigest", arg.slice("--expected-current-state-digest=".length));
    else if (arg.startsWith("--desired-enabled=")) assign("desiredEnabled", parseBoolean(arg.slice("--desired-enabled=".length), "--desired-enabled"));
    else throw fail("unsupported ingress rule argument");
  }
  if (!options.mode || !options.environment) throw fail("ingress mode and environment are required");
  if (["apply", "restore"].includes(options.mode) !== Boolean(options.snapshotPath)) {
    throw fail("apply and restore require exactly one snapshot file");
  }
  if (options.mode === "restore" && options.productionAuthorizationPath) throw fail("rollback must not depend on production authorization");
  if (!["check", "apply"].includes(options.mode) && options.desiredEnabled !== undefined) {
    throw fail("desired enabled state is valid only for check or apply");
  }
  if (!["apply", "restore"].includes(options.mode) && options.expectedCurrentStateDigest !== undefined) {
    throw fail("expected current state is valid only for apply or restore");
  }
  if (!["check", "apply"].includes(options.mode) && options.productionAuthorizationPath) {
    throw fail("production authorization is valid only for check or apply");
  }
  return options;
}

export function formatIngressRuleResult(mode, environment, result) {
  return mode === "capture"
    ? JSON.stringify(result)
    : JSON.stringify({ ...result, environment, sourceProductionEnabled: false });
}

async function main(argv) {
  const options = parseArgs(argv);
  const [token, prestate, productionAuthorization] = await Promise.all([
    readTokenFromStdin(),
    options.snapshotPath ? readBoundedJson(options.snapshotPath, "snapshot") : null,
    options.productionAuthorizationPath ? readBoundedJson(options.productionAuthorizationPath, "production authorization") : null,
  ]);
  const result = await reconcileIngressRule({
    mode: options.mode,
    environment: options.environment,
    token,
    prestate,
    productionAuthorization,
    expectedCurrentStateDigest: options.expectedCurrentStateDigest,
    desiredEnabled: options.desiredEnabled,
  });
  process.stdout.write(`${formatIngressRuleResult(options.mode, options.environment, result)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
