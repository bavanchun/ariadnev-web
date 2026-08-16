#!/usr/bin/env node
// Read-only production-environment preflight.
//
// Confirms, before any mutation, that the controls the cutover relies on
// actually exist, as declared in `deployment/production-policy.json`: the web
// deployment environment with its human gate (required reviewers where the
// plan supports them, otherwise a manual `workflow_dispatch` plus a deployment
// branch policy limited to `main` — see the decision record the policy names),
// the core release environment and immutable-release policy where the policy
// declares them, and the exact expected finalizer workflow.
//
// This script reads policy only. It holds no release-write authority over the
// core repository and never requests one; the web repository is deliberately
// unable to publish a core release.
//
// Credentials come from the environment and are never logged:
//   GITHUB_TOKEN           — the job token; reads this repository's environments
//   CORE_POLICY_READ_TOKEN — read-only on the core repository (Contents: read)
//
// Usage:
//   node scripts/deploy/verify-production-environment.mjs [--web owner/repo] [--core owner/repo] [--policy path]

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const API = "https://api.github.com";
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const DEFAULT_POLICY_PATH = "deployment/production-policy.json";

/** The committed declaration of which production controls are in force and why. */
export function loadProductionPolicy(path = join(repoRoot, DEFAULT_POLICY_PATH)) {
  return JSON.parse(readFileSync(path, "utf8"));
}
export const DEFAULT_WEB_REPO = "bavanchun/ariadnev-web";
export const DEFAULT_CORE_REPO = "bavanchun/ariadnev-kit";
export const WEB_ENVIRONMENT = "web-production";
export const CORE_ENVIRONMENT = "core-release-production";
export const FINALIZER_WORKFLOW = ".github/workflows/finalize-release.yml";

/** Remove anything that could carry a credential or an account identifier. */
export function redact(message) {
  return String(message ?? "unknown error")
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/\bgh[pousr]_[A-Za-z0-9]{16,}\b/g, "[redacted-token]")
    .replace(/\bgithub_pat_[A-Za-z0-9_]{20,}\b/g, "[redacted-token]");
}

export function createClient({ token, fetchImpl = fetch }) {
  if (!token) throw new Error("GITHUB_TOKEN is not set");
  return async function request(path) {
    const response = await fetchImpl(`${API}${path}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "User-Agent": "ariadnev-web-preflight" },
    });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(redact(`GitHub rejected ${path}: http ${response.status}`));
    return response.json();
  };
}

/**
 * An environment is acceptable only when a human must approve and the person
 * who triggered the run cannot approve their own deployment.
 *
 * With `gate.requiredReviewers === "unavailable-on-plan"` (a private repository
 * on a plan without environment reviewers), the human gate is the manual
 * `workflow_dispatch` itself, and what is verified instead is that the
 * environment exists and only accepts deployments from the declared branches
 * (`branchPolicies` is the list the API returned for the environment).
 */
export function assessEnvironment(environment, label, gate = {}, branchPolicies = undefined) {
  const findings = [];
  if (environment === null) return [`${label} environment is absent`];

  const rules = environment.protection_rules ?? [];
  const reviewers = rules.find((rule) => rule.type === "required_reviewers");
  const compensating = gate.requiredReviewers === "unavailable-on-plan";
  if (reviewers === undefined && !compensating) findings.push(`${label} has no required reviewers`);
  else if (reviewers !== undefined && (reviewers.reviewers ?? []).length === 0) findings.push(`${label} requires review but lists no reviewer`);
  if (reviewers !== undefined && environment.can_admins_bypass === true) findings.push(`${label} lets admins bypass required review`);
  if (reviewers?.prevent_self_review === false) findings.push(`${label} allows self-review of a deployment`);

  const branchPolicy = environment.deployment_branch_policy;
  if (branchPolicy === null || branchPolicy === undefined) {
    findings.push(`${label} accepts a deployment from any branch`);
  } else if (compensating) {
    // Without reviewers the branch policy is the control that keeps an
    // unreviewed branch out of production, so it must be exactly the declared set.
    const declared = [...(gate.deploymentBranches ?? [])].sort();
    const actual = [...(branchPolicies ?? [])].map((policy) => policy.name).sort();
    if (declared.length === 0) findings.push(`${label} declares no deployment branches`);
    else if (JSON.stringify(declared) !== JSON.stringify(actual)) {
      findings.push(`${label} deployment branches [${actual}] differ from the declared [${declared}]`);
    }
  }
  return findings;
}

/** The finalizer workflow must be exactly the file Phase 2 qualified. */
export async function assessFinalizer(request, coreRepo, expectedDigest) {
  const file = await request(`/repos/${coreRepo}/contents/${FINALIZER_WORKFLOW}?ref=main`);
  if (file === null) return { findings: [`${FINALIZER_WORKFLOW} is absent from ${coreRepo}`], digest: null };
  const content = Buffer.from(file.content ?? "", "base64");
  const digest = `sha256:${createHash("sha256").update(content).digest("hex")}`;
  const findings = expectedDigest !== undefined && digest !== expectedDigest
    ? [`${FINALIZER_WORKFLOW} digest ${digest} does not match the expected ${expectedDigest}`]
    : [];
  return { findings, digest };
}

export async function verifyProductionEnvironment(options = {}) {
  const policy = options.policy ?? loadProductionPolicy();
  const webRepo = options.webRepo ?? policy.web?.repo ?? DEFAULT_WEB_REPO;
  const coreRepo = options.coreRepo ?? policy.core?.repo ?? DEFAULT_CORE_REPO;
  const webEnvironment = policy.web?.environment ?? WEB_ENVIRONMENT;
  const coreEnvironment = policy.core?.environment === undefined ? CORE_ENVIRONMENT : policy.core.environment;
  const gate = policy.web ?? {};
  // Two read-only credentials: the job token sees this repository's
  // environments; the core token sees only the core repository.
  const webRequest = createClient({ token: options.token, fetchImpl: options.fetchImpl });
  const coreRequest = createClient({ token: options.coreToken ?? options.token, fetchImpl: options.fetchImpl });

  const web = await webRequest(`/repos/${webRepo}/environments/${webEnvironment}`);
  const branchPolicies = web === null || gate.requiredReviewers !== "unavailable-on-plan"
    ? undefined
    : (await webRequest(`/repos/${webRepo}/environments/${webEnvironment}/deployment-branch-policies`))?.branch_policies ?? [];
  const findings = [...assessEnvironment(web, webEnvironment, gate, branchPolicies)];

  let core = null;
  if (coreEnvironment !== null) {
    core = await coreRequest(`/repos/${coreRepo}/environments/${coreEnvironment}`);
    findings.push(...assessEnvironment(core, coreEnvironment));
  }

  const finalizer = await assessFinalizer(coreRequest, coreRepo, options.expectedFinalizerDigest);
  findings.push(...finalizer.findings);

  // An immutable release policy is what makes an exact tag a durable anchor.
  // The core repository does not expose it through the API today; the policy
  // says so explicitly rather than this check quietly passing.
  const coreRepository = await coreRequest(`/repos/${coreRepo}`);
  const immutableReleases = coreRepository?.immutable_releases === true;
  if (policy.core?.immutableReleases !== "not-verifiable-via-api" && !immutableReleases) {
    findings.push(`${coreRepo} does not enforce immutable releases`);
  }

  return {
    webRepo,
    coreRepo,
    humanGate: gate.humanGate ?? "required-reviewers",
    decisionRecord: policy.decisionRecord,
    webEnvironmentPresent: web !== null,
    coreEnvironmentPresent: core !== null,
    finalizerWorkflowDigest: finalizer.digest,
    immutableReleases,
    findings,
    ready: findings.length === 0,
  };
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop())) {
  const webIndex = process.argv.indexOf("--web");
  const coreIndex = process.argv.indexOf("--core");
  const digestIndex = process.argv.indexOf("--expect-finalizer-digest");
  try {
    const policyIndex = process.argv.indexOf("--policy");
    const result = await verifyProductionEnvironment({
      token: process.env.GITHUB_TOKEN,
      coreToken: process.env.CORE_POLICY_READ_TOKEN,
      policy: policyIndex === -1 ? undefined : loadProductionPolicy(process.argv[policyIndex + 1]),
      webRepo: webIndex === -1 ? undefined : process.argv[webIndex + 1],
      coreRepo: coreIndex === -1 ? undefined : process.argv[coreIndex + 1],
      expectedFinalizerDigest: digestIndex === -1 ? undefined : process.argv[digestIndex + 1],
    });
    console.log(JSON.stringify(result, null, 2));
    if (!result.ready) process.exit(1);
  } catch (error) {
    console.error(redact(error.message));
    process.exit(1);
  }
}
