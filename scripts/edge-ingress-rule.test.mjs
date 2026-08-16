// Tests for the source-owned raw-path ingress policy and its reconciler.
//
// The Cloudflare Rulesets API is mocked, so these tests never touch a live
// zone. They cover the two properties that matter: the rendered expression
// matches the declared corpus, and reconciliation can never delete or rewrite a
// rule this source does not own.

import assert from "node:assert/strict";
import test from "node:test";

import { digestPolicy, loadPolicy, renderExpression, ruleBody, verifyPolicy } from "./edge-ingress-policy.mjs";
import { planChange, reconcile, redactError } from "./manage-edge-ingress-rule.mjs";

const policy = loadPolicy();

test("rendered expression satisfies the declared block and allow corpus", () => {
  for (const environment of ["staging", "production"]) {
    const result = verifyPolicy(policy, environment);
    assert.deepEqual(result.failures, [], `${environment} corpus failures`);
    assert.ok(result.expression.includes(policy.environments[environment].hostname));
  }
});

test("both environments are enabled since the cutover and each has a distinct digest", () => {
  // Production was held disabled until the candidate-b cutover; the policy
  // records who enabled it and when.
  assert.equal(policy.environments.production.enabled, true);
  assert.match(policy.environments.production.enabledBy, /cutover/);
  assert.equal(ruleBody(policy, "production").enabled, true);
  assert.equal(ruleBody(policy, "staging").enabled, true);
  assert.notEqual(digestPolicy(policy, "staging"), digestPolicy(policy, "production"));
});

test("the rule is scoped to one hostname", () => {
  const expression = renderExpression(policy, "staging");
  assert.ok(expression.includes('http.host eq "staging.ariadnev.com"'));
  assert.ok(!expression.includes("ariadnev.com\" or"), "expression must not widen to other hosts");
});

test("planChange detects creation, drift, and convergence", () => {
  const desired = ruleBody(policy, "staging");
  assert.deepEqual(planChange(null, desired), { action: "create", drift: null });
  assert.deepEqual(planChange({ ...desired }, desired), { action: "noop", drift: null });
  assert.deepEqual(planChange({ ...desired, enabled: false }, desired).drift, ["enabled"]);
});

/** Mock Rulesets API holding one unrelated rule owned by someone else. */
function createMockApi({ existingRules = [] } = {}) {
  const requests = [];
  const state = { rules: existingRules };
  const fetchImpl = async (url, init = {}) => {
    requests.push({ url, method: init.method || "GET", body: init.body ? JSON.parse(init.body) : null });
    const json = (result) => new Response(JSON.stringify({ success: true, result }), { status: 200 });
    if (url.includes("/zones?name=")) return json([{ id: "zone-id" }]);
    if (url.endsWith("/rulesets")) {
      if (init.method === "POST") return json({ id: "new-ruleset" });
      return json([{ id: "ruleset-id", phase: "http_request_firewall_custom" }]);
    }
    if (url.endsWith("/rulesets/ruleset-id")) {
      if (init.method === "PUT") {
        state.rules = JSON.parse(init.body).rules;
        return json({ id: "ruleset-id", rules: state.rules });
      }
      return json({ id: "ruleset-id", rules: state.rules });
    }
    throw new Error(`unexpected request: ${url}`);
  };
  return { fetchImpl, requests, state };
}

const otherOwnersRule = { id: "other", description: "unrelated: block bad bots", action: "block", expression: "(cf.client.bot)", enabled: true };

test("check mode reports the missing rule without mutating the zone", async () => {
  const api = createMockApi({ existingRules: [otherOwnersRule] });
  const outcome = await reconcile({ environment: "staging", apply: false, token: "t", fetchImpl: api.fetchImpl });
  assert.equal(outcome.action, "create");
  assert.equal(outcome.applied, false);
  assert.deepEqual(api.state.rules, [otherOwnersRule], "check mode must not write");
  assert.ok(api.requests.every((entry) => entry.method === "GET"));
});

test("apply preserves rules this source does not own", async () => {
  const api = createMockApi({ existingRules: [otherOwnersRule] });
  const outcome = await reconcile({ environment: "staging", apply: true, token: "t", fetchImpl: api.fetchImpl });
  assert.equal(outcome.applied, true);
  assert.equal(outcome.preservedRuleCount, 1);
  assert.equal(api.state.rules.length, 2);
  assert.ok(api.state.rules.some((rule) => rule.description === otherOwnersRule.description), "foreign rule was dropped");
  assert.ok(api.state.rules.some((rule) => rule.description === policy.rule.description));
});

test("apply converges and is idempotent on a second run", async () => {
  const api = createMockApi({ existingRules: [otherOwnersRule] });
  await reconcile({ environment: "staging", apply: true, token: "t", fetchImpl: api.fetchImpl });
  const second = await reconcile({ environment: "staging", apply: true, token: "t", fetchImpl: api.fetchImpl });
  assert.equal(second.action, "noop");
  assert.equal(second.applied, false);
  assert.equal(api.state.rules.length, 2);
});

test("errors are redacted before they can be logged", () => {
  assert.equal(redactError("Bearer abc123def"), "Bearer [redacted]");
  assert.equal(redactError(new Error("zone 0123456789abcdef0123456789abcdef denied")), "zone [redacted-id] denied");
  assert.match(redactError("failed at https://api.cloudflare.com/client/v4/zones/x"), /\[cloudflare-api\]/);
});

test("a missing token fails closed instead of proceeding unauthenticated", async () => {
  await assert.rejects(
    () => reconcile({ environment: "staging", apply: true, token: undefined, fetchImpl: async () => new Response("{}") }),
    /CLOUDFLARE_API_TOKEN is not set/,
  );
});
