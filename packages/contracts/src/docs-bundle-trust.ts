import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { readCandidateZip } from "./candidate-zip.js";
import { parseDocsBundleManifest, trustedDocsBundleSchema } from "./docs-bundle-manifest.js";
import {
  CANDIDATE_ENVELOPE_SCHEMA_SHA256,
  DOCS_BUNDLE_ARCHIVE_NAME,
  DOCS_BUNDLE_CHECKSUMS_NAME,
  DOCS_BUNDLE_MANIFEST_NAME,
  DOCS_BUNDLE_SCHEMA_NAME,
  DOCS_BUNDLE_SCHEMA_SHA256,
  RELEASE_ARTIFACT_ATTESTATION_SCHEMA_SHA256,
  RELEASE_ASSET_NAMES,
  type DocsBundleAssetDigests,
  type DocsBundleIdentityExpectation,
  type LocalProvisionalTrustInput,
  type ReleaseAssetAttestation,
  type ReleaseConsumerIdentity,
  type Sha256Digest,
  type VerifiedDocsBundleTrust,
  type VerifyReleaseTrustEnvelopeInput,
} from "./docs-bundle-types.js";

const DIGEST = /^sha256:[a-f0-9]{64}$/;
const SHA = /^[a-f0-9]{40}$/;
const STABLE_SEMVER = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/;
const trustedValues = new WeakSet<object>();
const candidateSchemaBytes = readFileSync(new URL("../schemas/candidate-envelope.schema.json", import.meta.url));
const attestationSchemaBytes = readFileSync(new URL("../schemas/release-artifact-attestation.schema.json", import.meta.url));

function sha256(content: Uint8Array): Sha256Digest {
  return `sha256:${createHash("sha256").update(content).digest("hex")}`;
}

if (sha256(candidateSchemaBytes) !== CANDIDATE_ENVELOPE_SCHEMA_SHA256) throw new Error("candidate envelope schema digest drift");
if (sha256(attestationSchemaBytes) !== RELEASE_ARTIFACT_ATTESTATION_SCHEMA_SHA256) {
  throw new Error("release artifact attestation schema digest drift");
}

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateCandidate = ajv.compile(JSON.parse(candidateSchemaBytes.toString("utf8")) as object);
const validateAttestation = ajv.compile(JSON.parse(attestationSchemaBytes.toString("utf8")) as object);

interface CandidateEnvelope {
  schemaVersion: 1;
  repository: string;
  runId: string;
  runAttempt: string;
  artifactId: string;
  artifactName: string;
  artifactDigest: Sha256Digest;
  artifactSize: number;
  createdAt: string;
  expiresAt: string;
  workflowPath: string;
  headSha: string;
  rejectedArtifacts: Array<{ artifactId: string; artifactName: string; artifactDigest: Sha256Digest; runId: string; runAttempt: string }>;
}

interface ReleaseArtifactAttestation {
  schemaVersion: 1;
  artifactName: string;
  workflow: { runId: string; runAttempt: string; path: string; ref: string; digest: Sha256Digest; sha: string };
  product: { sha: string; version: string; tag: string };
  generator: { path: string; digest: Sha256Digest; sha: string };
  consumer: ReleaseConsumerIdentity;
  releaseAssets: ReleaseAssetAttestation[];
}

function exactObject(left: Readonly<Record<string, unknown>>, right: Readonly<Record<string, unknown>>): boolean {
  const leftEntries = Object.entries(left).sort(([a], [b]) => a.localeCompare(b));
  const rightEntries = Object.entries(right).sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify(leftEntries) === JSON.stringify(rightEntries);
}

function exactConsumer(actual: ReleaseConsumerIdentity, expected: ReleaseConsumerIdentity): boolean {
  return actual.repository === expected.repository
    && actual.commitSha === expected.commitSha
    && actual.lockPath === expected.lockPath
    && actual.lockDigest === expected.lockDigest
    && actual.contractDigest === expected.contractDigest
    && exactObject(actual.contractDigests, expected.contractDigests)
    && actual.invocationDigest === expected.invocationDigest
    && actual.resultDigest === expected.resultDigest
    && actual.outputDigest === expected.outputDigest
    && actual.previousDescriptorPath === expected.previousDescriptorPath
    && actual.previousDescriptorDigest === expected.previousDescriptorDigest;
}

function makeTrust(
  authority: VerifiedDocsBundleTrust["authority"],
  identity: DocsBundleIdentityExpectation,
  assetDigests: DocsBundleAssetDigests,
  releaseAssets: readonly ReleaseAssetAttestation[],
): VerifiedDocsBundleTrust {
  const value = Object.freeze({
    authority,
    identity: Object.freeze({ ...identity }),
    assetDigests: Object.freeze({ ...assetDigests }),
    releaseAssets: Object.freeze(releaseAssets.map((asset) => Object.freeze({ ...asset }))),
  }) as unknown as VerifiedDocsBundleTrust;
  trustedValues.add(value);
  return value;
}

function verifyDigest(content: Uint8Array, expected: Sha256Digest, label: string): void {
  if (!DIGEST.test(expected) || sha256(content) !== expected) throw new Error(`${label} digest does not match external trust anchor`);
}

export function verifyLocalProvisionalTrust(input: LocalProvisionalTrustInput): VerifiedDocsBundleTrust {
  verifyDigest(input.archive, input.expected.archiveDigest, "archive");
  verifyDigest(input.checksums, input.expected.checksumsDigest, "checksum file");
  verifyDigest(input.manifest, input.expected.manifestDigest, "manifest sidecar");
  verifyDigest(input.schema, input.expected.schemaDigest, "schema sidecar");
  if (!Buffer.from(input.schema).equals(trustedDocsBundleSchema())) throw new Error("schema sidecar does not match trusted schema bytes");
  let manifestValue: unknown;
  try {
    manifestValue = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(input.manifest));
  } catch {
    throw new Error("manifest sidecar is not valid UTF-8 JSON");
  }
  parseDocsBundleManifest(manifestValue, input.expected);
  return makeTrust("local-provisional", input.expected, input.expected, [
    { name: DOCS_BUNDLE_ARCHIVE_NAME, size: input.archive.byteLength, digest: input.expected.archiveDigest },
    { name: DOCS_BUNDLE_CHECKSUMS_NAME, size: input.checksums.byteLength, digest: input.expected.checksumsDigest },
    { name: DOCS_BUNDLE_MANIFEST_NAME, size: input.manifest.byteLength, digest: input.expected.manifestDigest },
    { name: DOCS_BUNDLE_SCHEMA_NAME, size: input.schema.byteLength, digest: input.expected.schemaDigest },
  ]);
}

export function verifyReleaseTrustEnvelope(input: VerifyReleaseTrustEnvelopeInput): VerifiedDocsBundleTrust {
  if (!validateCandidate(input.candidateEnvelope)) throw new Error("candidate envelope does not match pinned schema");
  verifyDigest(input.artifactZip, input.authenticatedArtifactZipDigest, "candidate ZIP");
  const candidateFiles = readCandidateZip(input.artifactZip);
  const expectedZipNames = [...RELEASE_ASSET_NAMES, "release-artifact-attestation.json"].sort((a, b) => a.localeCompare(b));
  if (JSON.stringify([...candidateFiles.keys()].sort()) !== JSON.stringify(expectedZipNames)) throw new Error("candidate ZIP inventory drift");
  let attestationValue: unknown;
  try {
    attestationValue = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(candidateFiles.get("release-artifact-attestation.json")!));
  } catch {
    throw new Error("release artifact attestation is not valid UTF-8 JSON");
  }
  if (!validateAttestation(attestationValue)) {
    throw new Error("release artifact attestation does not match pinned schema");
  }
  const envelope = input.candidateEnvelope as CandidateEnvelope;
  const attestation = attestationValue as ReleaseArtifactAttestation;
  const expected = input.expected;
  if (!DIGEST.test(expected.artifactZipDigest) || !Number.isSafeInteger(expected.artifactZipSize) || expected.artifactZipSize <= 0) {
    throw new Error("invalid authenticated artifact identity");
  }
  const createdAt = Date.parse(expected.artifactCreatedAt);
  const expiresAt = Date.parse(expected.artifactExpiresAt);
  const now = Date.now();
  if (!Number.isFinite(createdAt) || !Number.isFinite(expiresAt) || createdAt >= expiresAt
    || createdAt > now || now >= expiresAt) {
    throw new Error("authenticated candidate artifact is not within its validity window");
  }
  if (envelope.repository !== expected.repository || envelope.runId !== expected.runId
    || envelope.runAttempt !== expected.runAttempt || envelope.artifactId !== expected.artifactId
    || envelope.artifactName !== expected.artifactName || envelope.artifactDigest !== expected.artifactZipDigest
    || input.authenticatedArtifactZipDigest !== expected.artifactZipDigest || input.artifactZip.byteLength !== expected.artifactZipSize
    || envelope.artifactSize !== expected.artifactZipSize || envelope.createdAt !== expected.artifactCreatedAt
    || envelope.expiresAt !== expected.artifactExpiresAt || envelope.headSha !== expected.product.sha
    || envelope.workflowPath !== ".github/workflows/release.yml") {
    throw new Error("candidate envelope identity drift");
  }
  if (expected.artifactName !== `vcskill-candidate-${expected.product.sha}-run-${expected.runId}-attempt-${expected.runAttempt}`) {
    throw new Error("expected candidate artifact name drift");
  }
  if (!STABLE_SEMVER.test(expected.product.version)) throw new Error("expected product version must be stable semver");
  if (expected.workflow.ref !== `${expected.repository}/.github/workflows/release.yml@refs/heads/main`) {
    throw new Error("expected release workflow ref must be the exact main-branch workflow");
  }
  const rejectedIds = new Set<string>();
  for (const rejected of envelope.rejectedArtifacts) {
    if (rejected.artifactId === envelope.artifactId || rejectedIds.has(rejected.artifactId)
      || rejected.artifactName !== `vcskill-candidate-${expected.product.sha}-run-${rejected.runId}-attempt-${rejected.runAttempt}`) {
      throw new Error("rejected candidate envelope drift");
    }
    rejectedIds.add(rejected.artifactId);
  }
  if (attestation.artifactName !== expected.artifactName
    || attestation.workflow.runId !== expected.runId || attestation.workflow.runAttempt !== expected.runAttempt
    || attestation.workflow.path !== ".github/workflows/release.yml" || attestation.workflow.ref !== expected.workflow.ref
    || attestation.workflow.digest !== expected.workflow.digest || attestation.workflow.sha !== expected.workflow.sha
    || attestation.product.sha !== expected.product.sha || attestation.product.version !== expected.product.version
    || attestation.product.tag !== expected.product.tag || expected.product.tag !== `vcskill@${expected.product.version}`
    || attestation.generator.path !== "packages/cli/scripts/generate-docs-bundle.ts"
    || attestation.generator.digest !== expected.generator.digest || attestation.generator.sha !== expected.generator.sha
    || !exactConsumer(attestation.consumer, expected.consumer)) {
    throw new Error("release artifact attestation identity drift");
  }
  if (!SHA.test(expected.product.sha) || expected.workflow.sha !== expected.product.sha
    || expected.generator.sha !== expected.product.sha || envelope.headSha !== attestation.product.sha) {
    throw new Error("release source/generator/workflow identity drift");
  }
  const assets = [...attestation.releaseAssets].sort((a, b) => a.name.localeCompare(b.name));
  const expectedNames = [...RELEASE_ASSET_NAMES].sort((a, b) => a.localeCompare(b));
  if (new Set(assets.map((asset) => asset.name)).size !== assets.length
    || JSON.stringify(assets.map((asset) => asset.name)) !== JSON.stringify(expectedNames)) {
    throw new Error("release asset inventory drift");
  }
  for (const asset of assets) {
    const content = candidateFiles.get(asset.name);
    if (!content || content.byteLength !== asset.size || sha256(content) !== asset.digest) {
      throw new Error(`candidate release asset drift: ${asset.name}`);
    }
  }
  const byName = new Map(assets.map((asset) => [asset.name, asset]));
  const archive = byName.get(DOCS_BUNDLE_ARCHIVE_NAME)!;
  const checksums = byName.get(DOCS_BUNDLE_CHECKSUMS_NAME)!;
  const manifest = byName.get(DOCS_BUNDLE_MANIFEST_NAME)!;
  const schema = byName.get(DOCS_BUNDLE_SCHEMA_NAME)!;
  if (schema.digest !== DOCS_BUNDLE_SCHEMA_SHA256) throw new Error("release schema digest does not match consumer trust anchor");
  return makeTrust("release", {
    mode: "final",
    version: expected.product.version,
    releaseTag: expected.product.tag,
    sourceSha: expected.product.sha,
    generatorSha: expected.generator.sha,
    schemaDigest: schema.digest,
  }, {
    archiveDigest: archive.digest,
    checksumsDigest: checksums.digest,
    manifestDigest: manifest.digest,
    schemaDigest: schema.digest,
  }, assets);
}

export function assertVerifiedDocsBundleTrust(value: VerifiedDocsBundleTrust): void {
  if (!value || typeof value !== "object" || !trustedValues.has(value)) throw new Error("docs bundle trust was not produced by a verifier");
}
