// Legacy-host redirect manager tests.
//
// Every case runs against a fake fetch; no test reaches Cloudflare. The
// behaviors pinned here are the ones whose failure would be expensive in
// production: clobbering another owner's rules, a non-idempotent apply, a
// silently-ineffective status-code change, and a token value reaching output.

import assert from "node:assert/strict";
import test from "node:test";

import {
  createClient,
  loadPolicy,
  locateRule,
  matchesDeclared,
  parseMode,
  planChange,
  reconcile,
  redactError,
  verifyPolicy,
} from "./manage-legacy-host-redirect.mjs";

const TOKEN = "test-cf-token";
const ZONE_ID = "0123456789abcdef0123456789abcdef";
const RULESET_ID = "fedcba9876543210fedcba9876543210";
const policy = loadPolicy();
const DESCRIPTION = policy.rule.description;

const foreignRule = {
  id: "aaaa1111",
  version: "3",
  action: "redirect",
  description: "someone else: marketing vanity redirect",
  expression: '(http.host eq "promo.vchun.dev")',
  enabled: true,
  action_parameters: { from_value: { target_url: { value: "https://example.com" }, status_code: 301 } },
};

const liveOwnedRule = () => ({ id: "bbbb2222", version: "1", ...structuredClone(policy.rule) });

/**
 * Fake Cloudflare. `rulesets` is the zone's entrypoint list; `null` models a
 * zone with no dynamic-redirect entrypoint at all, which is the real starting
 * state of vchun.dev.
 */
function createFakeFetch({ entrypoint = null, rules = [], rulesets = null, zoneName = "vchun.dev", onGetRuleset } = {}) {
  const calls = [];
  const state = { entrypoint, rules: structuredClone(rules), deleted: false };

  const impl = async (url, init = {}) => {
    const method = init.method || "GET";
    const body = init.body ? JSON.parse(init.body) : undefined;
    const path = url.replace("https://api.cloudflare.com/client/v4", "");
    calls.push({ method, path, body, authorization: init.headers?.Authorization });

    const ok = (result) => new Response(JSON.stringify({ success: true, result }), { status: 200 });

    if (path.startsWith("/zones?name=")) return ok([{ id: ZONE_ID, name: zoneName }]);
    if (path === `/zones/${ZONE_ID}`) return ok({ id: ZONE_ID, name: zoneName });

    if (path === `/zones/${ZONE_ID}/rulesets` && method === "GET") {
      if (rulesets) return ok(rulesets);
      return ok(
        state.entrypoint
          ? [{ id: RULESET_ID, phase: "http_request_dynamic_redirect", kind: "zone" }]
          : [{ id: "other", phase: "http_request_firewall_custom", kind: "zone" }],
      );
    }
    if (path === `/zones/${ZONE_ID}/rulesets` && method === "POST") {
      state.entrypoint = true;
      state.rules = body.rules;
      return ok({ id: RULESET_ID, ...body });
    }
    if (path === `/zones/${ZONE_ID}/rulesets/${RULESET_ID}` && method === "GET") {
      // Hook for modelling a concurrent writer between the read and the delete.
      if (onGetRuleset) onGetRuleset(state, calls);
      return ok({ id: RULESET_ID, phase: "http_request_dynamic_redirect", kind: "zone", rules: state.rules });
    }
    if (path === `/zones/${ZONE_ID}/rulesets/${RULESET_ID}` && method === "PUT") {
      state.rules = body.rules;
      return ok({ id: RULESET_ID, rules: state.rules });
    }
    if (path === `/zones/${ZONE_ID}/rulesets/${RULESET_ID}` && method === "DELETE") {
      state.deleted = true;
      state.entrypoint = false;
      state.rules = [];
      return ok(null);
    }
    throw new Error(`unexpected request: ${method} ${path}`);
  };

  impl.calls = calls;
  impl.state = state;
  return impl;
}

const run = (mode, fetchImpl) => reconcile({ mode, token: TOKEN, fetchImpl });

// ===================================================================== policy

test("the policy pins the redirect contract the plan depends on", () => {
  assert.equal(policy.zoneName, "vchun.dev");
  assert.equal(policy.rulesetPhase, "http_request_dynamic_redirect");
  assert.equal(policy.rule.action, "redirect");
  assert.equal(policy.rule.expression, '(http.host eq "vcskill.vchun.dev")');

  const from = policy.rule.action_parameters.from_value;
  // 302 for the whole rollback window: a 301 caches indefinitely and cannot be
  // recalled, which would partially defeat a rollback to the legacy host.
  assert.equal(from.status_code, 302);
  assert.equal(from.preserve_query_string, true);
  assert.match(from.target_url.expression, /^concat\("https:\/\/ariadnev\.com", http\.request\.uri\.path\)$/);

  // The expression must not match the redirect target, or the rule loops.
  assert.ok(!policy.rule.expression.includes("ariadnev.com"));
});

// ============================================================ ruleset creation

test("a zone with no dynamic-redirect entrypoint gets one created as kind=zone", async () => {
  const fetchImpl = createFakeFetch({ entrypoint: null });
  const outcome = await run("apply", fetchImpl);

  assert.equal(outcome.entrypointPresent, false);
  assert.equal(outcome.action, "create");
  assert.equal(outcome.applied, true);

  const post = fetchImpl.calls.find((call) => call.method === "POST");
  assert.ok(post, "must create the entrypoint ruleset");
  assert.equal(post.body.kind, "zone");
  assert.equal(post.body.phase, "http_request_dynamic_redirect");
  assert.deepEqual(post.body.rules, [policy.rule]);
});

test("inspect reports the planned change without issuing any write", async () => {
  const fetchImpl = createFakeFetch({ entrypoint: null });
  const outcome = await run("inspect", fetchImpl);

  assert.equal(outcome.action, "create");
  assert.equal(outcome.applied, false);
  assert.deepEqual(
    fetchImpl.calls.filter((call) => call.method !== "GET"),
    [],
    "inspect must be strictly read-only",
  );
});

// ============================================================ rule preservation

test("applying into a populated ruleset preserves every rule it does not own", async () => {
  const fetchImpl = createFakeFetch({ entrypoint: true, rules: [foreignRule] });
  const outcome = await run("apply", fetchImpl);

  assert.equal(outcome.action, "create");
  assert.equal(outcome.preservedRuleCount, 1);

  const put = fetchImpl.calls.find((call) => call.method === "PUT");
  assert.equal(put.body.rules.length, 2);
  assert.equal(put.body.rules[0].description, foreignRule.description);
  assert.equal(put.body.rules[1].description, DESCRIPTION);
  // Server-assigned fields must not be echoed back.
  assert.ok(!("id" in put.body.rules[0]) && !("version" in put.body.rules[0]));
});

test("apply is idempotent — a matching live rule is a no-op with no write", async () => {
  const fetchImpl = createFakeFetch({ entrypoint: true, rules: [liveOwnedRule()] });
  const outcome = await run("apply", fetchImpl);

  assert.equal(outcome.action, "noop");
  assert.equal(outcome.applied, false);
  assert.deepEqual(fetchImpl.calls.filter((call) => call.method !== "GET"), []);
});

// ==================================================================== drift

test("a changed status code registers as drift, not a no-op", () => {
  const existing = structuredClone(policy.rule);
  existing.action_parameters.from_value.status_code = 301;
  const change = planChange(existing, policy.rule);

  // The 302 -> 301 flip after the rollback window closes is the one edit this
  // rule is expected to receive; a shallow compare would silently skip it.
  assert.equal(change.action, "update");
  assert.deepEqual(change.drift, ["action_parameters"]);
});

// Regression: the live API returns action_parameters with its keys in its own
// (alphabetical) order. A JSON.stringify comparison reported drift forever, so
// --inspect always exited 2 and --apply re-PUT on every run.
test("Cloudflare's own key ordering and server-added defaults are not drift", () => {
  const asCloudflareReturnsIt = {
    ...structuredClone(policy.rule),
    action_parameters: {
      from_value: {
        preserve_query_string: true,
        status_code: 302,
        target_url: { expression: 'concat("https://ariadnev.com", http.request.uri.path)' },
      },
    },
  };
  assert.equal(planChange(asCloudflareReturnsIt, policy.rule).action, "noop");

  // A key the policy does not declare is the server's business, not drift.
  const withServerDefault = structuredClone(asCloudflareReturnsIt);
  withServerDefault.action_parameters.from_value.some_future_default = false;
  assert.equal(planChange(withServerDefault, policy.rule).action, "noop");
});

test("matchesDeclared compares declared values exactly at any depth", () => {
  assert.equal(matchesDeclared({ a: { b: 1 }, extra: 2 }, { a: { b: 1 } }), true);
  assert.equal(matchesDeclared({ a: { b: 2 } }, { a: { b: 1 } }), false);
  assert.equal(matchesDeclared({ a: {} }, { a: { b: 1 } }), false);
  // A declared value must not be satisfied by a loose match.
  assert.equal(matchesDeclared({ a: "302" }, { a: 302 }), false);
  assert.equal(matchesDeclared({ a: [1, 2] }, { a: [1, 2] }), true);
  assert.equal(matchesDeclared({ a: [1, 2, 3] }, { a: [1, 2] }), false);
  assert.equal(matchesDeclared(null, { a: 1 }), false);
});

test("a changed host expression registers as drift", () => {
  const existing = { ...structuredClone(policy.rule), expression: '(http.host eq "old.example.com")' };
  assert.deepEqual(planChange(existing, policy.rule).drift, ["expression"]);
});

test("updating drift rewrites only the owned rule", async () => {
  const stale = liveOwnedRule();
  stale.action_parameters.from_value.status_code = 301;
  const fetchImpl = createFakeFetch({ entrypoint: true, rules: [foreignRule, stale] });

  const outcome = await run("apply", fetchImpl);
  assert.equal(outcome.action, "update");

  const put = fetchImpl.calls.find((call) => call.method === "PUT");
  assert.deepEqual(put.body.rules[0], (({ id, version, ...rest }) => rest)(foreignRule));
  assert.equal(put.body.rules[1].action_parameters.from_value.status_code, 302);
});

// =================================================================== removal

test("remove deletes only the owned rule and leaves the ruleset intact", async () => {
  const fetchImpl = createFakeFetch({ entrypoint: true, rules: [foreignRule, liveOwnedRule()] });
  const outcome = await run("remove", fetchImpl);

  assert.equal(outcome.action, "delete");
  assert.equal(outcome.applied, true);

  const put = fetchImpl.calls.find((call) => call.method === "PUT");
  assert.equal(put.body.rules.length, 1);
  assert.equal(put.body.rules[0].description, foreignRule.description);
  assert.ok(!fetchImpl.calls.some((call) => call.method === "DELETE"), "a shared ruleset must survive");
});

test("remove deletes the ruleset outright when this rule was its only occupant", async () => {
  const fetchImpl = createFakeFetch({ entrypoint: true, rules: [liveOwnedRule()] });
  const outcome = await run("remove", fetchImpl);

  assert.equal(outcome.applied, true);
  // Cloudflare rejects an entrypoint ruleset with an empty rules array.
  assert.ok(fetchImpl.calls.some((call) => call.method === "DELETE"));
  assert.equal(fetchImpl.state.deleted, true);
});

test("a rule that appears between the read and the delete is not destroyed", async () => {
  // The listing and the DELETE are separated by network round trips. A rule
  // added by anyone in that window would go down with the ruleset.
  let reads = 0;
  const fetchImpl = createFakeFetch({
    entrypoint: true,
    rules: [liveOwnedRule()],
    onGetRuleset: (state) => {
      reads += 1;
      if (reads === 2) state.rules = [...state.rules, structuredClone(foreignRule)];
    },
  });

  const outcome = await run("remove", fetchImpl);

  assert.equal(outcome.applied, true);
  assert.ok(!fetchImpl.calls.some((call) => call.method === "DELETE"), "must not delete a now-shared ruleset");
  const put = fetchImpl.calls.find((call) => call.method === "PUT");
  assert.equal(put.body.rules.length, 1);
  assert.equal(put.body.rules[0].description, foreignRule.description);
  assert.match(outcome.note, /appeared after the initial read/);
});

test("remove is a no-op when the rule is already absent", async () => {
  const fetchImpl = createFakeFetch({ entrypoint: true, rules: [foreignRule] });
  const outcome = await run("remove", fetchImpl);

  assert.equal(outcome.action, "noop");
  assert.equal(outcome.applied, false);
  assert.deepEqual(fetchImpl.calls.filter((call) => call.method !== "GET"), []);
});

test("apply then remove returns the zone to its starting state", async () => {
  const fetchImpl = createFakeFetch({ entrypoint: null });
  await run("apply", fetchImpl);
  assert.equal(fetchImpl.state.rules.length, 1);

  await run("remove", fetchImpl);
  assert.equal(fetchImpl.state.entrypoint, false);
  assert.equal(fetchImpl.state.rules.length, 0);
});

// ============================================================== corpus gate

test("the declared corpus is verified against the rule's own expression", () => {
  const { failures, digest } = verifyPolicy(policy);
  assert.deepEqual(failures, []);
  assert.match(digest, /^sha256:[0-9a-f]{64}$/);
});

test("a widened expression is caught by the corpus, not shipped", () => {
  // The realistic mistake: `eq` -> `contains` to be "more permissive". It matches
  // staging.vcskill.vchun.dev and every other suffix lookalike.
  const widened = structuredClone(policy);
  widened.rule.expression = '(http.host contains "vcskill.vchun.dev")';

  const { failures } = verifyPolicy(widened);
  const hosts = failures.map((failure) => failure.host);
  assert.ok(hosts.includes("staging.vcskill.vchun.dev"), "candidate-b staging must be flagged");
  assert.ok(hosts.includes("evil-vcskill.vchun.dev"), "suffix lookalike must be flagged");
});

test("a corpus failure blocks --apply before any network call", async () => {
  const narrowed = structuredClone(policy);
  narrowed.rule.expression = '(http.host eq "wrong.example.com")';
  let called = false;

  await assert.rejects(
    () => reconcile({ mode: "apply", token: TOKEN, policy: narrowed, fetchImpl: async () => { called = true; } }),
    /policy corpus failed/,
  );
  assert.equal(called, false, "must not reach Cloudflare with a rejected expression");
});

test("an expression matching its own redirect target would loop and is rejected", () => {
  const looping = structuredClone(policy);
  looping.rule.expression = '(http.host eq "ariadnev.com")';
  assert.ok(verifyPolicy(looping).failures.length > 0);
});

// ============================================================ zone identity

test("a supplied zone id is verified against the policy, not trusted", async () => {
  // CLOUDFLARE_ZONE_ID is the same variable manage-edge-ingress-rule.mjs reads,
  // so having it exported for another zone is a realistic operator state — and
  // --remove can DELETE a ruleset.
  const otherZone = createFakeFetch({ entrypoint: true, rules: [liveOwnedRule()], zoneName: "someone-elses.dev" });

  await assert.rejects(
    () => reconcile({ mode: "remove", token: TOKEN, zoneId: ZONE_ID, fetchImpl: otherZone }),
    /refusing to act.*someone-elses\.dev.*vchun\.dev/s,
  );
  assert.deepEqual(otherZone.calls.filter((call) => call.method !== "GET"), [], "no write may occur");
});

test("the reported zone name comes from the API, not the policy file", async () => {
  const fetchImpl = createFakeFetch({ entrypoint: true, rules: [liveOwnedRule()] });
  const outcome = await reconcile({ mode: "inspect", token: TOKEN, zoneId: ZONE_ID, fetchImpl });

  assert.equal(outcome.zoneName, "vchun.dev");
  assert.ok(fetchImpl.calls.some((call) => call.path === `/zones/${ZONE_ID}`), "must confirm the zone by id");
});

// ========================================================== ruleset targeting

test("an account-level ruleset is never mistaken for the zone entrypoint", async () => {
  // The zone listing also includes account-level rulesets deployable here.
  // Writing into one reports success while executing nothing.
  const fetchImpl = createFakeFetch({
    rulesets: [{ id: "acct", phase: "http_request_dynamic_redirect", kind: "root" }],
  });
  const outcome = await run("apply", fetchImpl);

  assert.equal(outcome.entrypointPresent, false);
  const post = fetchImpl.calls.find((call) => call.method === "POST");
  assert.equal(post.body.kind, "zone");
  assert.ok(!fetchImpl.calls.some((call) => call.path.includes("acct")), "must never touch the account ruleset");
});

test("two zone-level redirect rulesets are ambiguous and refuse to act", async () => {
  const fetchImpl = createFakeFetch({
    rulesets: [
      { id: "a", phase: "http_request_dynamic_redirect", kind: "zone" },
      { id: "b", phase: "http_request_dynamic_redirect", kind: "zone" },
    ],
  });
  await assert.rejects(() => run("apply", fetchImpl), /ambiguous target: 2 zone-level/);
});

test("duplicate descriptions refuse to act rather than guess", async () => {
  const fetchImpl = createFakeFetch({ entrypoint: true, rules: [liveOwnedRule(), liveOwnedRule()] });
  // --apply would write a third copy; --remove would delete both.
  await assert.rejects(() => run("remove", fetchImpl), /2 rules share the description/);
});

test("a rule inserted above ours is visible as a position, since first match wins", async () => {
  const fetchImpl = createFakeFetch({ entrypoint: true, rules: [foreignRule, liveOwnedRule()] });
  const outcome = await run("inspect", fetchImpl);

  // Every compared field still matches, so drift is null — position is the only
  // signal that something now runs ahead of this rule.
  assert.equal(outcome.action, "noop");
  assert.equal(outcome.rulePosition, 1);
  assert.equal(outcome.ruleCount, 2);
});

// ============================================================== token safety

test("the token is sent as a Bearer header and never appears in output", async () => {
  const fetchImpl = createFakeFetch({ entrypoint: null });
  const outcome = await run("apply", fetchImpl);

  assert.equal(fetchImpl.calls[0].authorization, `Bearer ${TOKEN}`);
  assert.ok(!JSON.stringify(outcome).includes(TOKEN), "outcome must not carry the token");
});

test("redactError strips credentials, zone ids, and api urls", () => {
  const message = `failed calling https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/rulesets with Bearer ${TOKEN}`;
  const redacted = redactError(new Error(message));

  assert.ok(!redacted.includes(TOKEN));
  assert.ok(!redacted.includes(ZONE_ID));
  assert.match(redacted, /Bearer \[redacted\]/);
});

test("an upstream error message is redacted before it can be thrown", async () => {
  const fetchImpl = async () =>
    new Response(JSON.stringify({ success: false, errors: [{ message: `denied for Bearer ${TOKEN}` }] }), { status: 403 });

  await assert.rejects(
    () => reconcile({ mode: "apply", token: TOKEN, fetchImpl }),
    (error) => !error.message.includes(TOKEN) && error.message.includes("[redacted]"),
  );
});

test("a missing token is a clear error, not a silent unauthenticated call", async () => {
  assert.throws(() => createClient({ token: undefined }), /CLOUDFLARE_API_TOKEN is not set/);
  await assert.rejects(() => reconcile({ mode: "inspect", token: "" }), /CLOUDFLARE_API_TOKEN is not set/);
});

// ================================================================== cli parsing

test("parseMode defaults to the read-only mode and rejects ambiguity", () => {
  assert.equal(parseMode([]), "inspect");
  assert.equal(parseMode(["--inspect"]), "inspect");
  assert.equal(parseMode(["--apply"]), "apply");
  assert.equal(parseMode(["--remove"]), "remove");
  assert.throws(() => parseMode(["--apply", "--remove"]), /exactly one/);
  assert.throws(() => parseMode(["--force"]), /unknown flag: --force/);
});

test("locateRule reports an absent entrypoint without throwing", async () => {
  const fetchImpl = createFakeFetch({ entrypoint: null });
  const request = createClient({ token: TOKEN, fetchImpl });
  const located = await locateRule(request, ZONE_ID, DESCRIPTION);

  assert.deepEqual(located, { ruleset: null, rule: null, rules: [] });
});
