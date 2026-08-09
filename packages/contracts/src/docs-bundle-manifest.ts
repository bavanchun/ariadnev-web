import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { normalizeArchivePath } from "./archive-reader.js";
import {
  DOCS_BUNDLE_MANIFEST_MEMBER,
  DOCS_BUNDLE_SCHEMA_ID,
  DOCS_BUNDLE_SCHEMA_SOURCE_SHA256,
  DOCS_BUNDLE_SCHEMA_SHA256,
  type DocsBundleIdentityExpectation,
  type DocsBundleManifestV1,
  type Sha256Digest,
} from "./docs-bundle-types.js";

const schemaBytes = readFileSync(new URL("../schemas/docs-bundle-manifest-v1.schema.json", import.meta.url));

function sha256(content: Uint8Array): Sha256Digest {
  return `sha256:${createHash("sha256").update(content).digest("hex")}`;
}

if (sha256(schemaBytes) !== DOCS_BUNDLE_SCHEMA_SOURCE_SHA256) {
  throw new Error("trusted docs bundle schema digest drift");
}

function stableJson(value: unknown): Buffer {
  return Buffer.from(`${JSON.stringify(value, (_key, candidate) => {
    if (Array.isArray(candidate) || !candidate || typeof candidate !== "object") return candidate;
    return Object.fromEntries(Object.entries(candidate as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)));
  }, 2)}\n`, "utf8");
}

const embeddedSchemaBytes = stableJson(JSON.parse(schemaBytes.toString("utf8")));
if (sha256(embeddedSchemaBytes) !== DOCS_BUNDLE_SCHEMA_SHA256) throw new Error("trusted embedded docs schema digest drift");

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateManifest = ajv.compile(JSON.parse(schemaBytes.toString("utf8")) as object);
const DIGEST = /^sha256:[a-f0-9]{64}$/;
const VERSION = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/;
const SHA = /^[a-f0-9]{40}$/;
const REQUIRED_PAYLOAD_PATHS = [
  "proof/release-summary.json",
  "reference/cli/commands.json",
  "reference/providers/providers.json",
  "reference/skills/skills.json",
  "reference/workflows/workflows.json",
  "release-notes.md",
  "schemas/docs-bundle-manifest-v1.schema.json",
] as const;
const PREVIOUS_STABLE_PAYLOAD_PATH = "reference/previous-stable/bootstrap.json";
const ALLOWED_PAYLOAD_PATHS = new Set<string>([...REQUIRED_PAYLOAD_PATHS, PREVIOUS_STABLE_PAYLOAD_PATH]);

function validateExpected(expected: DocsBundleIdentityExpectation): void {
  if (!VERSION.test(expected.version)) throw new Error("invalid expected release version");
  if (expected.mode === "final" && expected.releaseTag !== `vcskill@${expected.version}`) throw new Error("invalid expected release tag");
  if (expected.mode === "provisional" && expected.releaseTag !== null) throw new Error("invalid provisional release tag");
  if (!SHA.test(expected.sourceSha)) throw new Error("invalid expected source SHA");
  if (!SHA.test(expected.generatorSha)) throw new Error("invalid expected generator SHA");
  if (expected.mode === "final" && expected.generatorSha !== expected.sourceSha) {
    throw new Error("final expected generator SHA must equal source SHA");
  }
  if (!DIGEST.test(expected.schemaDigest) || expected.schemaDigest !== DOCS_BUNDLE_SCHEMA_SHA256) {
    throw new Error("expected schema digest does not match trust anchor");
  }
}

export function parseDocsBundleManifest(value: unknown, expected: DocsBundleIdentityExpectation): DocsBundleManifestV1 {
  validateExpected(expected);
  if (!validateManifest(value)) throw new Error("docs bundle manifest does not match trusted schema");
  const manifest = value as DocsBundleManifestV1;
  if (manifest.schemaId !== DOCS_BUNDLE_SCHEMA_ID) throw new Error("docs bundle schema identity drift");
  if (manifest.mode !== expected.mode || manifest.publishable !== (expected.mode === "final")) {
    throw new Error("docs bundle publication mode drift");
  }
  if (manifest.version !== expected.version || manifest.releaseTag !== expected.releaseTag || manifest.sourceSha !== expected.sourceSha) {
    throw new Error("docs bundle release identity drift");
  }
  if (manifest.mode === "final" && manifest.releaseTag !== `vcskill@${manifest.version}`) throw new Error("docs bundle tag/version drift");
  if (manifest.mode === "provisional" && manifest.releaseTag !== null) throw new Error("docs bundle provisional tag drift");
  if (manifest.generatorSha !== expected.generatorSha) throw new Error("docs bundle generator identity drift");
  if (manifest.mode === "final" && manifest.generatorSha !== manifest.sourceSha) throw new Error("docs bundle final generator identity drift");
  if (Date.parse(manifest.generatedAt) / 1000 !== manifest.sourceDateEpoch) throw new Error("docs bundle timestamp drift");
  if (manifest.proofBoundary !== "allowlist:v1") throw new Error("docs bundle proof boundary drift");

  const paths = new Set<string>();
  let totalBytes = 0;
  let previousPath: string | undefined;
  for (const entry of manifest.payload) {
    const path = normalizeArchivePath(entry.path);
    if (path === DOCS_BUNDLE_MANIFEST_MEMBER || paths.has(path)) throw new Error("docs bundle payload inventory is not unique");
    if (previousPath !== undefined && previousPath.localeCompare(path) >= 0) throw new Error("docs bundle payload inventory is not sorted");
    if (!ALLOWED_PAYLOAD_PATHS.has(path)) throw new Error("docs bundle payload inventory is not allowlisted");
    paths.add(path);
    previousPath = path;
    totalBytes += entry.bytes;
  }
  for (const path of REQUIRED_PAYLOAD_PATHS) {
    if (!paths.has(path)) throw new Error("docs bundle payload inventory is incomplete");
  }
  if (manifest.fileCount !== manifest.payload.length || manifest.totalBytes !== totalBytes) {
    throw new Error("docs bundle declared bounds drift");
  }
  return manifest;
}

export function trustedDocsBundleSchema(): Buffer {
  return Buffer.from(embeddedSchemaBytes);
}
