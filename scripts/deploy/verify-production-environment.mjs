#!/usr/bin/env node
// Read-only production-environment preflight.
//
// Confirms, before any mutation, that the controls the cutover relies on
// actually exist: a protected web deployment environment, a protected core
// `core-release-production` environment, required human approval that the
// caller cannot bypass, an immutable-release policy, and the exact expected
// Phase 2 finalizer workflow.
//
// This script reads policy only. It holds no release-write authority over the
// core repository and never requests one; the web repository is deliberately
// unable to publish a core release.
//
// Credentials come from the environment and are never logged:
//   GITHUB_TOKEN — read-only; needs Actions read and environment read
//
// Usage:
//   node scripts/deploy/verify-production-environment.mjs [--web owner/repo] [--core owner/repo]

import { createHash } from "node:crypto";

const API = "https://api.github.com";
export const DEFAULT_WEB_REPO = "bavanchun/vcskill-web";
export const DEFAULT_CORE_REPO = "bavanchun/vcskill";
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
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "User-Agent": "vcskill-web-preflight" },
    });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(redact(`GitHub rejected ${path}: http ${response.status}`));
    return response.json();
  };
}

/**
 * An environment is acceptable only when a human must approve and the person
 * who triggered the run cannot approve their own deployment.
 */
export function assessEnvironment(environment, label) {
  const findings = [];
  if (environment === null) return [`${label} environment is absent`];

  const rules = environment.protection_rules ?? [];
  const reviewers = rules.find((rule) => rule.type === "required_reviewers");
  if (reviewers === undefined) findings.push(`${label} has no required reviewers`);
  else if ((reviewers.reviewers ?? []).length === 0) findings.push(`${label} requires review but lists no reviewer`);
  if (environment.can_admins_bypass === true) findings.push(`${label} lets admins bypass required review`);
  if (reviewers?.prevent_self_review === false) findings.push(`${label} allows self-review of a deployment`);

  const branchPolicy = environment.deployment_branch_policy;
  if (branchPolicy === null || branchPolicy === undefined) {
    findings.push(`${label} accepts a deployment from any branch`);
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
  const webRepo = options.webRepo ?? DEFAULT_WEB_REPO;
  const coreRepo = options.coreRepo ?? DEFAULT_CORE_REPO;
  const request = createClient({ token: options.token, fetchImpl: options.fetchImpl });

  const web = await request(`/repos/${webRepo}/environments/${WEB_ENVIRONMENT}`);
  const core = await request(`/repos/${coreRepo}/environments/${CORE_ENVIRONMENT}`);
  const findings = [...assessEnvironment(web, WEB_ENVIRONMENT), ...assessEnvironment(core, CORE_ENVIRONMENT)];

  const finalizer = await assessFinalizer(request, coreRepo, options.expectedFinalizerDigest);
  findings.push(...finalizer.findings);

  // An immutable release policy is what makes an exact tag a durable anchor.
  const coreRepository = await request(`/repos/${coreRepo}`);
  if (coreRepository?.immutable_releases !== true) {
    findings.push(`${coreRepo} does not enforce immutable releases`);
  }

  return {
    webRepo,
    coreRepo,
    webEnvironmentPresent: web !== null,
    coreEnvironmentPresent: core !== null,
    finalizerWorkflowDigest: finalizer.digest,
    immutableReleases: coreRepository?.immutable_releases === true,
    findings,
    ready: findings.length === 0,
  };
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop())) {
  const webIndex = process.argv.indexOf("--web");
  const coreIndex = process.argv.indexOf("--core");
  const digestIndex = process.argv.indexOf("--expect-finalizer-digest");
  try {
    const result = await verifyProductionEnvironment({
      token: process.env.GITHUB_TOKEN,
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
