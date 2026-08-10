#!/usr/bin/env node
// Validate and render the source-owned raw-path ingress rule.
//
// The rule source lives in workers/edge/rules/raw-download-path-guard.json.
// This module renders it into a Cloudflare Rules-language expression, checks
// that expression against the declared block/allow corpus with a local
// evaluator, and produces a stable digest so drift is detectable.
//
// Usage:
//   node scripts/edge-ingress-policy.mjs [staging|production]

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
export const POLICY_PATH = join(repoRoot, "workers/edge/rules/raw-download-path-guard.json");

export function loadPolicy(path = POLICY_PATH) {
  return JSON.parse(readFileSync(path, "utf8"));
}

/** Render the environment-specific Rules-language expression. */
export function renderExpression(policy, environment) {
  const env = policy.environments[environment];
  if (!env) throw new Error(`unknown environment: ${environment}`);
  return policy.rule.expressionTemplate.replaceAll("{{hostname}}", env.hostname);
}

// --- Minimal Rules-language evaluator -------------------------------------
// Supports exactly the operators used by this rule, so the declared corpus is
// checked against the rendered expression rather than a hand-written mirror.

const TOKEN = /\s*(\(|\)|and|or|eq|starts_with|ends_with|contains|,|"(?:[^"\\]|\\.)*"|[A-Za-z_][A-Za-z0-9_.]*)/y;

function tokenize(expression) {
  const tokens = [];
  let index = 0;
  while (index < expression.length) {
    TOKEN.lastIndex = index;
    const match = TOKEN.exec(expression);
    if (!match) throw new Error(`unparsable expression near offset ${index}`);
    tokens.push(match[1]);
    index = TOKEN.lastIndex;
    if (index === expression.length) break;
  }
  return tokens;
}

function evaluate(expression, context) {
  const tokens = tokenize(expression);
  let position = 0;
  const peek = () => tokens[position];
  const take = () => tokens[position++];
  const literal = (token) => (token.startsWith('"') ? JSON.parse(token) : context[token]);

  function primary() {
    if (peek() === "(") {
      take();
      const value = orExpr();
      if (take() !== ")") throw new Error("unbalanced parenthesis");
      return value;
    }
    const head = take();
    if (head === "starts_with" || head === "ends_with" || head === "contains") {
      take(); // (
      const left = literal(take());
      take(); // ,
      const right = literal(take());
      take(); // )
      if (head === "starts_with") return String(left).startsWith(right);
      if (head === "ends_with") return String(left).endsWith(right);
      return String(left).includes(right);
    }
    const left = literal(head);
    const operator = take();
    if (operator === "eq") return left === literal(take());
    if (operator === "contains") return String(left).includes(literal(take()));
    throw new Error(`unsupported operator: ${operator}`);
  }

  function andExpr() {
    let value = primary();
    while (peek() === "and") {
      take();
      value = primary() && value;
    }
    return value;
  }

  function orExpr() {
    let value = andExpr();
    while (peek() === "or") {
      take();
      value = andExpr() || value;
    }
    return value;
  }

  const result = orExpr();
  if (position !== tokens.length) throw new Error("trailing tokens in expression");
  return result;
}

export function matches(expression, hostname, rawPath) {
  return evaluate(expression, { "http.host": hostname, "raw.http.request.uri.path": rawPath });
}

/** Verify the rendered expression against the declared corpus. */
export function verifyPolicy(policy, environment) {
  const expression = renderExpression(policy, environment);
  const { hostname } = policy.environments[environment];
  const failures = [];
  for (const path of policy.mustBlock) {
    if (!matches(expression, hostname, path)) failures.push({ path, expected: "block", actual: "allow" });
  }
  for (const path of policy.mustAllow) {
    if (matches(expression, hostname, path)) failures.push({ path, expected: "allow", actual: "block" });
  }
  // A rule scoped to one hostname must not affect any other host on the zone.
  for (const path of policy.mustBlock) {
    if (matches(expression, "other.vchun.dev", path)) failures.push({ path, expected: "host-scoped", actual: "cross-host block" });
  }
  return { environment, hostname, expression, failures, digest: digestPolicy(policy, environment) };
}

export function digestPolicy(policy, environment) {
  const canonical = JSON.stringify({
    id: policy.id,
    action: policy.rule.action,
    description: policy.rule.description,
    expression: renderExpression(policy, environment),
    enabled: policy.environments[environment].enabled,
  });
  return `sha256:${createHash("sha256").update(canonical).digest("hex")}`;
}

/** The exact rule body sent to the Cloudflare Rulesets API. */
export function ruleBody(policy, environment) {
  return {
    action: policy.rule.action,
    description: policy.rule.description,
    expression: renderExpression(policy, environment),
    enabled: policy.environments[environment].enabled,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const environment = process.argv[2] || "staging";
  const policy = loadPolicy();
  const result = verifyPolicy(policy, environment);
  console.log(JSON.stringify({ ...result, ruleBody: ruleBody(policy, environment) }, null, 2));
  if (result.failures.length > 0) process.exit(1);
}
