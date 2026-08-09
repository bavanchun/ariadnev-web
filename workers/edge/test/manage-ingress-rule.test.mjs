import test from "node:test";

import { reconcileIngressRule } from "../../../scripts/manage-edge-ingress-rule.mjs";
import { assert } from "./edge-test-helpers.mjs";

function json(result, status = 200) {
  return Response.json({ success: status >= 200 && status < 300, result, errors: status >= 400 ? [{ code: 10000, message: "synthetic" }] : [] }, { status });
}

test("ingress rule reconciler inserts only its exact rule and preserves unrelated WAF rules", async () => {
  const calls = [];
  const unrelated = { id: "other-rule-id", ref: "other_rule", action: "block", expression: "false", enabled: true };
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url, init });
    if (url.includes("/zones?")) return json([{ id: "synthetic-zone" }]);
    if (url.endsWith("/entrypoint")) return json({ id: "synthetic-ruleset", rules: [unrelated] });
    if (url.endsWith("/rules") && init.method === "POST") {
      const desired = JSON.parse(init.body);
      return json({ id: "synthetic-ruleset", rules: [{ id: "managed-rule-id", ...desired }, unrelated] });
    }
    throw new Error(`unexpected call: ${init.method || "GET"} ${url}`);
  };
  const result = await reconcileIngressRule({ mode: "apply", environment: "staging", token: "synthetic-token-value-long-enough", fetchImpl });
  assert.equal(result.status, "created");
  const mutation = calls.find((call) => call.init.method === "POST");
  const body = JSON.parse(mutation.init.body);
  assert.equal(body.position.before, "");
  assert.equal(body.ref, "vcskill_raw_download_dot_segments_staging");
  assert.equal(calls.some((call) => call.init.method === "PUT" || call.init.method === "DELETE"), false);
});

test("ingress rule check is read-only and rejects stale state without reflecting API bodies", async () => {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url, init });
    if (url.includes("/zones?")) return json([{ id: "synthetic-zone" }]);
    if (url.endsWith("/entrypoint")) return json({ id: "synthetic-ruleset", rules: [] });
    throw new Error("unexpected call");
  };
  await assert.rejects(
    reconcileIngressRule({ mode: "check", environment: "staging", token: "synthetic-token-value-long-enough", fetchImpl }),
    /absent|stale/,
  );
  assert.equal(calls.every((call) => !call.init.method || call.init.method === "GET"), true);

  const deniedFetch = async () => new Response("credential detail at https://private.example", { status: 403, headers: { "content-type": "text/plain" } });
  await assert.rejects(
    reconcileIngressRule({ mode: "check", environment: "staging", token: "synthetic-token-value-long-enough", fetchImpl: deniedFetch }),
    (error) => error.message.includes("status=403") && !error.message.includes("https://private.example"),
  );
});
