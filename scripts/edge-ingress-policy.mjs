import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const ingressPolicyPath = resolve(repoRoot, "workers/edge/rules/raw-download-path-guard.json");
const ENVIRONMENTS = new Set(["staging", "production"]);
const EXPECTED_VARIANTS = Object.freeze([".", "%2e", "..", ".%2e", "%2e.", "%2e%2e"]);

function fail(message) {
  const error = new Error(message);
  error.code = "EDGE_INGRESS_POLICY_INVALID";
  return error;
}

export function rawDownloadPathNeedsIngressBlock(rawPath) {
  const path = String(rawPath || "").split("?", 1)[0];
  if (!path.startsWith("/download/")) return false;
  const blocked = new Set(EXPECTED_VARIANTS);
  return path.slice("/download/".length).split("/").some((segment) => blocked.has(segment.toLowerCase()));
}

function renderExpression(hostname, variants) {
  const rawPathField = "raw.http.request.uri.path";
  const normalizedPathField = `lower(${rawPathField})`;
  const dotSegmentChecks = variants.flatMap((variant) => [
    `contains(${normalizedPathField}, \"/${variant}/\")`,
    `ends_with(${normalizedPathField}, \"/${variant}\")`,
  ]);
  return `(http.host eq \"${hostname}\" and starts_with(${rawPathField}, \"/download/\") and (${dotSegmentChecks.join(" or ")}))`;
}

export function validateIngressPolicy(source) {
  if (source?.schemaVersion !== 1 || source.phase !== "http_request_firewall_custom" || source.action !== "block") {
    throw fail("unsupported ingress policy contract");
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9 ._-]{10,199}$/.test(source.description || "")) throw fail("safe policy description is required");
  if (JSON.stringify(source.rawDotSegmentVariants) !== JSON.stringify(EXPECTED_VARIANTS)) throw fail("exact raw dot-segment variants are required");
  if (source.environments?.staging?.hostname !== "staging.vcskill.vchun.dev" || source.environments.staging.enabled !== true) {
    throw fail("staging ingress guard must be enabled");
  }
  if (source.environments?.production?.hostname !== "vcskill.vchun.dev" || source.environments.production.enabled !== false) {
    throw fail("production ingress guard must remain disabled before cutover");
  }
  return source;
}

export function buildIngressRuleDefinition(source, environment) {
  validateIngressPolicy(source);
  if (!ENVIRONMENTS.has(environment)) throw fail("known ingress policy environment is required");
  const target = source.environments[environment];
  return {
    ref: `vcskill_raw_download_dot_segments_${environment}`,
    description: source.description,
    expression: renderExpression(target.hostname, source.rawDotSegmentVariants),
    action: source.action,
  };
}

export function buildIngressRule(source, environment, { enabled } = {}) {
  validateIngressPolicy(source);
  if (!ENVIRONMENTS.has(environment)) throw fail("known ingress policy environment is required");
  const desiredEnabled = enabled ?? source.environments[environment].enabled;
  if (typeof desiredEnabled !== "boolean") throw fail("ingress rule enabled state must be boolean");
  return { ...buildIngressRuleDefinition(source, environment), enabled: desiredEnabled };
}

export function ingressPolicyDigest(source, environment) {
  validateIngressPolicy(source);
  const definition = buildIngressRuleDefinition(source, environment);
  return createHash("sha256")
    .update(JSON.stringify({ phase: source.phase, definition }))
    .digest("hex");
}

export async function loadIngressPolicy() {
  return validateIngressPolicy(JSON.parse(await readFile(ingressPolicyPath, "utf8")));
}

async function main(argv) {
  const environmentArg = argv.find((arg) => arg.startsWith("--environment="));
  if (!environmentArg || argv.length !== 1) throw fail("usage: --environment=staging|production");
  const environment = environmentArg.slice("--environment=".length);
  const source = await loadIngressPolicy();
  const rule = buildIngressRule(source, environment);
  process.stdout.write(`${JSON.stringify({ phase: source.phase, rule, policyDigest: ingressPolicyDigest(source, environment) }, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
