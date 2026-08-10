// Trusted-schema validation for docs-bundle manifest v1.
//
// The consumer owns its copy of the schema and its digest. A schema supplied
// inside the archive is never trusted; it is only ever compared against this
// anchor. Validation is hand-written rather than delegated to a JSON Schema
// runtime so the contracts package stays dependency-free and the exact
// rejection reason is always a stable machine code.

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { DEFAULT_ARCHIVE_POLICY, type ArchivePolicy, normalizeArchivePath, reject } from "./archive-policy.js";

export const SCHEMA_ID = "https://vcskill.dev/schemas/docs-bundle-manifest-v1.schema.json";
export const SCHEMA_VERSION = 1;
export const BUNDLE_NAME = "vcskill-docs-bundle";

/**
 * SHA-256 of the trusted schema file as merged from the producer repository at
 * `packages/cli/schemas/docs-bundle-manifest-v1.schema.json`. Drift here means
 * the producer contract moved and this consumer has not been re-qualified.
 */
export const TRUSTED_SCHEMA_DIGEST = "sha256:00ae8d0c53df5464ff99fbe0ab1b92e53860855e5627dd0658122b9b5a01158c";

const schemaPath = join(dirname(fileURLToPath(import.meta.url)), "..", "schemas", "docs-bundle-manifest-v1.schema.json");

/** Read the trusted schema and prove it still matches the pinned digest. */
export function loadTrustedSchema(path: string = schemaPath): unknown {
  const bytes = readFileSync(path);
  const digest = `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
  if (digest !== TRUSTED_SCHEMA_DIGEST) reject("schema-drift", digest);
  return JSON.parse(bytes.toString("utf8"));
}

export interface PayloadEntry {
  readonly path: string;
  readonly bytes: number;
  readonly digest: string;
}

export interface DocsBundleManifest {
  readonly schemaVersion: 1;
  readonly schemaId: string;
  readonly bundle: string;
  readonly mode: "final" | "provisional";
  readonly publishable: boolean;
  readonly version: string;
  readonly releaseTag: string | null;
  readonly sourceSha: string;
  readonly generatorSha: string;
  readonly generatedAt: string;
  readonly sourceDateEpoch: number;
  readonly proofBoundary: string;
  readonly fileCount: number;
  readonly totalBytes: number;
  readonly payload: readonly PayloadEntry[];
}

/** Identity the consumer requires. Any supplied field must match exactly. */
export interface ExpectedIdentity {
  readonly releaseTag?: string;
  readonly version?: string;
  readonly sourceSha?: string;
  readonly mode?: "final" | "provisional";
}

const VERSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._+-]{0,63}$/;
const TAG_PATTERN = /^vcskill@[A-Za-z0-9][A-Za-z0-9._+-]{0,63}$/;
const SHA_PATTERN = /^[a-f0-9]{40}$/;
const DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/;
const RFC3339 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

const REQUIRED_KEYS = [
  "schemaVersion",
  "schemaId",
  "bundle",
  "mode",
  "publishable",
  "version",
  "releaseTag",
  "sourceSha",
  "generatorSha",
  "generatedAt",
  "sourceDateEpoch",
  "proofBoundary",
  "fileCount",
  "totalBytes",
  "payload",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireInteger(value: unknown, min: number, max: number, subject: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min || value > max) {
    reject("manifest-invalid", subject);
  }
  return value;
}

function requireString(value: unknown, pattern: RegExp, subject: string): string {
  if (typeof value !== "string" || !pattern.test(value)) reject("manifest-invalid", subject);
  return value;
}

/**
 * Validate an untrusted manifest against the trusted v1 contract and the
 * consumer's expected release identity.
 */
export function parseDocsBundleManifest(
  value: unknown,
  expected: ExpectedIdentity = {},
  policy: ArchivePolicy = DEFAULT_ARCHIVE_POLICY,
): DocsBundleManifest {
  if (!isRecord(value)) reject("manifest-invalid", "not-an-object");

  for (const key of REQUIRED_KEYS) {
    if (!Object.hasOwn(value, key)) reject("manifest-invalid", `missing:${key}`);
  }
  for (const key of Object.keys(value)) {
    if (!(REQUIRED_KEYS as readonly string[]).includes(key)) reject("manifest-invalid", `unexpected:${key}`);
  }

  if (value["schemaVersion"] !== SCHEMA_VERSION) reject("schema-drift", "schemaVersion");
  if (value["schemaId"] !== SCHEMA_ID) reject("schema-drift", "schemaId");
  if (value["bundle"] !== BUNDLE_NAME) reject("manifest-invalid", "bundle");

  const mode = value["mode"];
  if (mode !== "final" && mode !== "provisional") reject("manifest-invalid", "mode");
  const publishable = value["publishable"];
  if (typeof publishable !== "boolean") reject("manifest-invalid", "publishable");

  const version = requireString(value["version"], VERSION_PATTERN, "version");
  const sourceSha = requireString(value["sourceSha"], SHA_PATTERN, "sourceSha");
  const generatorSha = requireString(value["generatorSha"], SHA_PATTERN, "generatorSha");
  const generatedAt = requireString(value["generatedAt"], RFC3339, "generatedAt");
  const sourceDateEpoch = requireInteger(value["sourceDateEpoch"], 0, Number.MAX_SAFE_INTEGER, "sourceDateEpoch");

  const proofBoundary = value["proofBoundary"];
  if (typeof proofBoundary !== "string" || proofBoundary.length < 1 || proofBoundary.length > 128) {
    reject("manifest-invalid", "proofBoundary");
  }

  // Mode drives publishability and tag presence. These are the schema's
  // conditional branches, enforced here rather than assumed.
  const rawTag = value["releaseTag"];
  let releaseTag: string | null;
  if (mode === "final") {
    if (publishable !== true) reject("manifest-invalid", "final-not-publishable");
    releaseTag = requireString(rawTag, TAG_PATTERN, "releaseTag");
  } else {
    if (publishable !== false) reject("manifest-invalid", "provisional-publishable");
    if (rawTag !== null) reject("manifest-invalid", "provisional-tag-present");
    releaseTag = null;
  }

  const fileCount = requireInteger(value["fileCount"], 1, policy.maxEntries, "fileCount");
  const totalBytes = requireInteger(value["totalBytes"], 1, policy.maxTotalBytes, "totalBytes");

  const rawPayload = value["payload"];
  if (!Array.isArray(rawPayload) || rawPayload.length < 1) reject("manifest-invalid", "payload");
  if (rawPayload.length !== fileCount) reject("manifest-invalid", "fileCount-mismatch");

  const seen = new Set<string>();
  let summedBytes = 0;
  const payload: PayloadEntry[] = rawPayload.map((entry, index) => {
    if (!isRecord(entry)) reject("manifest-invalid", `payload[${index}]`);
    for (const key of Object.keys(entry)) {
      if (!["path", "bytes", "digest"].includes(key)) reject("manifest-invalid", `payload[${index}].${key}`);
    }
    const path = normalizeArchivePath(String(entry["path"]), policy);
    if (seen.has(path)) reject("path-duplicate", path);
    seen.add(path);
    const bytes = requireInteger(entry["bytes"], 1, policy.maxEntryBytes, `payload[${index}].bytes`);
    const digest = requireString(entry["digest"], DIGEST_PATTERN, `payload[${index}].digest`);
    summedBytes += bytes;
    return { path, bytes, digest };
  });

  // The declared total must be the actual sum, so a manifest cannot understate
  // its own size to slip past the aggregate bound.
  if (summedBytes !== totalBytes) reject("manifest-invalid", "totalBytes-mismatch");

  if (expected.mode !== undefined && expected.mode !== mode) reject("release-identity-mismatch", "mode");
  if (expected.version !== undefined && expected.version !== version) reject("release-identity-mismatch", "version");
  if (expected.sourceSha !== undefined && expected.sourceSha !== sourceSha) {
    reject("release-identity-mismatch", "sourceSha");
  }
  if (expected.releaseTag !== undefined && expected.releaseTag !== releaseTag) {
    reject("release-identity-mismatch", "releaseTag");
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    schemaId: SCHEMA_ID,
    bundle: BUNDLE_NAME,
    mode,
    publishable,
    version,
    releaseTag,
    sourceSha,
    generatorSha,
    generatedAt,
    sourceDateEpoch,
    proofBoundary,
    fileCount,
    totalBytes,
    payload,
  };
}
