import test from "node:test";

import { buildIngressRule, loadIngressPolicy } from "../../../scripts/edge-ingress-policy.mjs";
import { formatIngressRuleResult, reconcileIngressRule } from "../../../scripts/manage-edge-ingress-rule.mjs";
import { assert } from "./edge-test-helpers.mjs";

const token = "synthetic-token-value-long-enough";
const digest = (character) => `sha256:${character.repeat(64)}`;
const productionAuthorizationBase = {
  schemaVersion: 1,
  environment: "production",
  protectedEnvironment: "production",
  immutablePolicyAttestationDigest: digest("a"),
  deploymentInputDigest: digest("b"),
};
const policy = await loadIngressPolicy();

function copy(value) {
  return value === null ? null : JSON.parse(JSON.stringify(value));
}

function json(result, status = 200) {
  return Response.json({
    success: status >= 200 && status < 300,
    result,
    errors: status >= 400 ? [{ code: 10000, message: "synthetic private detail" }] : [],
  }, { status });
}

function unrelatedRule(id, ref, expression = "false") {
  return { id, ref, description: ref, action: "block", expression, enabled: true, version: "1", last_updated: "2026-08-09T00:00:00Z" };
}

function managedRule(environment, enabled, id = `managed-${environment}`) {
  return { id, ...buildIngressRule(policy, environment, { enabled }), version: "1", last_updated: "2026-08-09T00:00:00Z" };
}

function ruleset(rules) {
  return {
    id: "synthetic-ruleset",
    name: "Zone-level custom rules",
    description: "Source-controlled zone custom rules",
    kind: "zone",
    phase: policy.phase,
    rules,
  };
}

function createRulesetsApi(initialEntrypoint) {
  let entrypoint = copy(initialEntrypoint);
  let nextRule = 1;
  let nextRuleset = 1;
  const calls = [];

  function insert(rule, position) {
    const index = Math.max(0, Math.min((position?.index || entrypoint.rules.length + 1) - 1, entrypoint.rules.length));
    entrypoint.rules.splice(index, 0, rule);
  }

  const fetchImpl = async (url, init = {}) => {
    const method = init.method || "GET";
    const path = new URL(url).pathname;
    calls.push({ method, path, body: init.body ? JSON.parse(init.body) : null });
    if (path === "/client/v4/zones" && method === "GET") return json([{ id: "synthetic-zone" }]);
    if (path.endsWith(`/rulesets/phases/${policy.phase}/entrypoint`) && method === "GET") {
      return entrypoint ? json(copy(entrypoint)) : json(null, 404);
    }
    if (path.endsWith("/rulesets") && method === "POST") {
      const body = JSON.parse(init.body);
      entrypoint = {
        id: `created-ruleset-${nextRuleset++}`,
        name: body.name,
        description: body.description,
        kind: body.kind,
        phase: body.phase,
        rules: body.rules.map((rule) => ({ id: `created-rule-${nextRule++}`, ...rule })),
      };
      return json(copy(entrypoint));
    }
    if (/\/rulesets\/[^/]+$/.test(path) && method === "DELETE") {
      entrypoint = null;
      return new Response(null, { status: 204 });
    }
    if (/\/rulesets\/[^/]+\/rules$/.test(path) && method === "POST") {
      const { position, ...fields } = JSON.parse(init.body);
      insert({ id: `created-rule-${nextRule++}`, ...fields }, position);
      return json(copy(entrypoint));
    }
    const ruleMatch = /\/rulesets\/[^/]+\/rules\/([^/]+)$/.exec(path);
    if (ruleMatch && method === "PATCH") {
      const index = entrypoint.rules.findIndex((rule) => rule.id === ruleMatch[1]);
      assert.notEqual(index, -1);
      const [existing] = entrypoint.rules.splice(index, 1);
      const { position, ...fields } = JSON.parse(init.body);
      insert({ id: existing.id, ...fields, version: "2", last_updated: "2026-08-09T00:01:00Z" }, position);
      return json(copy(entrypoint));
    }
    if (ruleMatch && method === "DELETE") {
      const index = entrypoint.rules.findIndex((rule) => rule.id === ruleMatch[1]);
      assert.notEqual(index, -1);
      entrypoint.rules.splice(index, 1);
      return json(copy(entrypoint));
    }
    throw new Error(`unexpected call: ${method} ${path}`);
  };

  return {
    calls,
    fetchImpl,
    get entrypoint() { return copy(entrypoint); },
    replaceEntrypoint(value) { entrypoint = copy(value); },
  };
}

async function capture(api, environment) {
  return reconcileIngressRule({ mode: "capture", environment, token, fetchImpl: api.fetchImpl });
}

function productionAuthorizationFor(prestate) {
  return {
    ...productionAuthorizationBase,
    ingressPolicyDigest: `sha256:${prestate.policyDigest}`,
    prestateDigest: prestate.stateDigest,
  };
}

test("capture CLI output is directly reusable as the strict apply snapshot", async () => {
  const api = createRulesetsApi(ruleset([managedRule("staging", false)]));
  const prestate = await capture(api, "staging");
  assert.deepEqual(JSON.parse(formatIngressRuleResult("capture", "staging", prestate)), prestate);
  const applied = await reconcileIngressRule({
    mode: "apply",
    environment: "staging",
    token,
    fetchImpl: api.fetchImpl,
    prestate: JSON.parse(formatIngressRuleResult("capture", "staging", prestate)),
  });
  assert.equal(applied.status, "updated");
});

test("activation and restore preserve unrelated rule order and the exact disabled prestate", async () => {
  const first = unrelatedRule("other-1", "other_first");
  const second = unrelatedRule("other-2", "other_second", "http.request.uri.path eq \"/other\"");
  const api = createRulesetsApi(ruleset([first, managedRule("staging", false), second]));
  const prestate = await capture(api, "staging");
  assert.equal(prestate.managedRule.index, 2);
  assert.equal(prestate.managedRule.enabled, false);

  const applied = await reconcileIngressRule({
    mode: "apply", environment: "staging", token, fetchImpl: api.fetchImpl, prestate,
  });
  assert.equal(applied.status, "updated");
  assert.equal(applied.rollbackRequired, true);
  assert.deepEqual(api.entrypoint.rules.map((rule) => rule.ref), [
    "vcskill_raw_download_dot_segments_staging", "other_first", "other_second",
  ]);
  assert.equal(api.entrypoint.rules[0].enabled, true);

  const repeatedApply = await reconcileIngressRule({
    mode: "apply",
    environment: "staging",
    token,
    fetchImpl: api.fetchImpl,
    prestate,
  });
  assert.equal(repeatedApply.status, "current");

  await assert.rejects(
    reconcileIngressRule({
      mode: "apply",
      environment: "staging",
      token,
      fetchImpl: api.fetchImpl,
      prestate,
      expectedCurrentStateDigest: digest("f"),
    }),
    /expected activated state/,
  );

  const restored = await reconcileIngressRule({
    mode: "restore",
    environment: "staging",
    token,
    fetchImpl: api.fetchImpl,
    prestate,
    expectedCurrentStateDigest: applied.stateDigest,
  });
  assert.equal(restored.status, "restored");
  assert.deepEqual(api.entrypoint.rules.map((rule) => rule.ref), [
    "other_first", "vcskill_raw_download_dot_segments_staging", "other_second",
  ]);
  assert.equal(api.entrypoint.rules[1].enabled, false);
  assert.equal((await capture(api, "staging")).stateDigest, prestate.stateDigest);

  const repeatedRestore = await reconcileIngressRule({
    mode: "restore", environment: "staging", token, fetchImpl: api.fetchImpl, prestate,
    expectedCurrentStateDigest: applied.stateDigest,
  });
  assert.equal(repeatedRestore.status, "current");
  assert.equal(api.calls.some((call) => call.method === "PUT"), false);
});

test("production activation requires protected immutable input and removes a newly-created entrypoint on restore", async () => {
  const api = createRulesetsApi(null);
  const prestate = await capture(api, "production");
  await assert.rejects(
    reconcileIngressRule({
      mode: "apply", environment: "production", token, fetchImpl: api.fetchImpl,
      prestate, desiredEnabled: true,
    }),
    /production authorization/,
  );
  assert.equal(api.entrypoint, null);

  const applied = await reconcileIngressRule({
    mode: "apply",
    environment: "production",
    token,
    fetchImpl: api.fetchImpl,
    prestate,
    desiredEnabled: true,
    productionAuthorization: productionAuthorizationFor(prestate),
  });
  assert.equal(applied.status, "created");
  assert.equal(api.entrypoint.rules[0].enabled, true);

  const driftedApi = createRulesetsApi(null);
  await assert.rejects(
    reconcileIngressRule({
      mode: "apply",
      environment: "production",
      token,
      fetchImpl: driftedApi.fetchImpl,
      prestate,
      desiredEnabled: true,
      productionAuthorization: { ...productionAuthorizationFor(prestate), prestateDigest: digest("c") },
    }),
    /prestate drift/,
  );
  assert.equal(driftedApi.entrypoint, null);

  const restored = await reconcileIngressRule({
    mode: "restore",
    environment: "production",
    token,
    fetchImpl: api.fetchImpl,
    prestate,
    expectedCurrentStateDigest: applied.stateDigest,
  });
  assert.equal(restored.status, "deleted-ruleset");
  assert.equal(api.entrypoint, null);
  assert.equal((await capture(api, "production")).stateDigest, prestate.stateDigest);
});

test("restore removes only a newly-created managed rule from an existing entrypoint", async () => {
  const unrelated = unrelatedRule("other-1", "other_rule");
  const api = createRulesetsApi(ruleset([unrelated]));
  const prestate = await capture(api, "staging");
  const applied = await reconcileIngressRule({
    mode: "apply", environment: "staging", token, fetchImpl: api.fetchImpl, prestate,
  });
  assert.deepEqual(api.entrypoint.rules.map((rule) => rule.ref), ["vcskill_raw_download_dot_segments_staging", "other_rule"]);

  const restored = await reconcileIngressRule({
    mode: "restore", environment: "staging", token, fetchImpl: api.fetchImpl, prestate,
    expectedCurrentStateDigest: applied.stateDigest,
  });
  assert.equal(restored.status, "deleted-rule");
  assert.deepEqual(api.entrypoint.rules, [unrelated]);
  assert.equal((await capture(api, "staging")).stateDigest, prestate.stateDigest);
});

test("duplicate, stale, and concurrently changed ingress state fail closed before mutation", async () => {
  const desired = managedRule("staging", false);
  for (const initial of [
    ruleset([desired, { ...desired, id: "duplicate" }]),
    ruleset([{ ...desired, expression: "true" }]),
    ruleset([{ ...desired, action_parameters: { response: { status_code: 403 } } }]),
  ]) {
    const api = createRulesetsApi(initial);
    await assert.rejects(capture(api, "staging"), /duplicate|stale|unexpected fields/);
    assert.equal(api.calls.every((call) => call.method === "GET"), true);
  }

  const api = createRulesetsApi(ruleset([unrelatedRule("other-1", "other_rule")]));
  const prestate = await capture(api, "staging");
  api.replaceEntrypoint(ruleset([unrelatedRule("other-2", "changed_rule")]));
  await assert.rejects(
    reconcileIngressRule({ mode: "apply", environment: "staging", token, fetchImpl: api.fetchImpl, prestate }),
    /captured prestate/,
  );
  assert.equal(api.calls.filter((call) => call.method !== "GET").length, 0);

  const narrowRaceApi = createRulesetsApi(ruleset([managedRule("staging", false)]));
  const narrowRacePrestate = await capture(narrowRaceApi, "staging");
  let entrypointReads = 0;
  const raceFetch = async (...args) => {
    const response = await narrowRaceApi.fetchImpl(...args);
    const [url, init = {}] = args;
    if ((init.method || "GET") === "GET" && new URL(url).pathname.endsWith(`/rulesets/phases/${policy.phase}/entrypoint`)) {
      entrypointReads += 1;
      if (entrypointReads === 1) {
        narrowRaceApi.replaceEntrypoint(ruleset([
          managedRule("staging", false),
          unrelatedRule("other-race", "concurrent_rule"),
        ]));
      }
    }
    return response;
  };
  await assert.rejects(
    reconcileIngressRule({
      mode: "apply",
      environment: "staging",
      token,
      fetchImpl: raceFetch,
      prestate: narrowRacePrestate,
    }),
    /immediately before mutation/,
  );
  assert.equal(narrowRaceApi.calls.filter((call) => call.method !== "GET").length, 0);
});

test("snapshot ignores provider timestamps but binds nested semantic rule versions", async () => {
  const base = unrelatedRule("other-1", "other_rule");
  base.action_parameters = { ruleset: "managed-example", version: "1" };
  const api = createRulesetsApi(ruleset([base]));
  const original = await capture(api, "staging");

  const metadataOnly = ruleset([{ ...base, version: "9", last_updated: "2026-08-09T00:02:00Z" }]);
  api.replaceEntrypoint(metadataOnly);
  assert.equal((await capture(api, "staging")).stateDigest, original.stateDigest);

  const semanticChange = copy(metadataOnly);
  semanticChange.rules[0].action_parameters.version = "2";
  api.replaceEntrypoint(semanticChange);
  assert.notEqual((await capture(api, "staging")).stateDigest, original.stateDigest);
});

test("check is read-only and Cloudflare failures never reflect response bodies", async () => {
  const api = createRulesetsApi(ruleset([managedRule("staging", true)]));
  const result = await reconcileIngressRule({ mode: "check", environment: "staging", token, fetchImpl: api.fetchImpl });
  assert.equal(result.status, "current");
  assert.equal(result.position, 1);
  assert.equal(api.calls.every((call) => call.method === "GET"), true);

  const deniedFetch = async () => new Response("credential detail at https://private.example", {
    status: 403,
    headers: { "content-type": "text/plain" },
  });
  await assert.rejects(
    reconcileIngressRule({ mode: "check", environment: "staging", token, fetchImpl: deniedFetch }),
    (error) => error.message.includes("status=403") && !error.message.includes("https://private.example"),
  );
});
