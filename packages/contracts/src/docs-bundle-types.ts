export const DOCS_BUNDLE_SCHEMA_ID = "https://vcskill.dev/schemas/docs-bundle-manifest-v1.schema.json";
export const DOCS_BUNDLE_SCHEMA_SOURCE_SHA256 = "sha256:00ae8d0c53df5464ff99fbe0ab1b92e53860855e5627dd0658122b9b5a01158c";
export const DOCS_BUNDLE_SCHEMA_SHA256 = "sha256:a758791077b0856242f070f815ae6b6e4d59473c8ddcabfd4cce06dca4831978";
export const CANDIDATE_ENVELOPE_SCHEMA_SHA256 = "sha256:e91a10890e4c5a9dd4e7bc02913317f8afbcbd7f0f6cca0f6e15ce21a69573b0";
export const RELEASE_ARTIFACT_ATTESTATION_SCHEMA_SHA256 = "sha256:6f3de3252f6661afaa230d9c59fe735a5cfa694b059589f54dbacb3d06c51480";
export const DOCS_BUNDLE_ARCHIVE_NAME = "docs-bundle.tar.gz";
export const DOCS_BUNDLE_CHECKSUMS_NAME = "checksums.txt";
export const DOCS_BUNDLE_MANIFEST_NAME = "docs-bundle.manifest.json";
export const DOCS_BUNDLE_SCHEMA_NAME = "docs-bundle-manifest-v1.schema.json";
export const DOCS_BUNDLE_MANIFEST_MEMBER = "manifest.json";
export const DOCS_BUNDLE_SCHEMA_MEMBER = `schemas/${DOCS_BUNDLE_SCHEMA_NAME}`;

export const RELEASE_ASSET_NAMES = Object.freeze([
  DOCS_BUNDLE_CHECKSUMS_NAME,
  DOCS_BUNDLE_SCHEMA_NAME,
  DOCS_BUNDLE_MANIFEST_NAME,
  DOCS_BUNDLE_ARCHIVE_NAME,
  "vcskill-darwin-arm64",
  "vcskill-darwin-x64",
  "vcskill-linux-arm64",
  "vcskill-linux-x64",
  "vcskill-windows-x64.exe",
] as const);

export type Sha256Digest = `sha256:${string}`;
export type DocsBundleMode = "final" | "provisional";

export interface DocsBundleManifestPayloadEntry {
  readonly path: string;
  readonly bytes: number;
  readonly digest: Sha256Digest;
}

export interface DocsBundleManifestV1 {
  readonly schemaVersion: 1;
  readonly schemaId: typeof DOCS_BUNDLE_SCHEMA_ID;
  readonly bundle: "vcskill-docs-bundle";
  readonly mode: DocsBundleMode;
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
  readonly payload: readonly DocsBundleManifestPayloadEntry[];
}

interface DocsBundleIdentityExpectationBase {
  readonly version: string;
  readonly sourceSha: string;
  readonly generatorSha: string;
  readonly schemaDigest: Sha256Digest;
}

export interface ProvisionalDocsBundleIdentityExpectation extends DocsBundleIdentityExpectationBase {
  readonly mode: "provisional";
  readonly releaseTag: null;
}

export interface FinalDocsBundleIdentityExpectation extends DocsBundleIdentityExpectationBase {
  readonly mode: "final";
  readonly releaseTag: string;
}

export type DocsBundleIdentityExpectation =
  | ProvisionalDocsBundleIdentityExpectation
  | FinalDocsBundleIdentityExpectation;

export interface DocsBundleAssetDigests {
  readonly archiveDigest: Sha256Digest;
  readonly checksumsDigest: Sha256Digest;
  readonly manifestDigest: Sha256Digest;
  readonly schemaDigest: Sha256Digest;
}

export interface LocalProvisionalTrustInput {
  readonly archive: Uint8Array;
  readonly checksums: Uint8Array;
  readonly manifest: Uint8Array;
  readonly schema: Uint8Array;
  readonly expected: ProvisionalDocsBundleIdentityExpectation & DocsBundleAssetDigests;
}

export interface ReleaseAssetAttestation {
  readonly name: string;
  readonly size: number;
  readonly digest: Sha256Digest;
}

export interface ReleaseConsumerIdentity {
  readonly repository: string;
  readonly commitSha: string;
  readonly lockPath: string;
  readonly lockDigest: Sha256Digest;
  readonly contractDigest: Sha256Digest;
  readonly contractDigests: Readonly<Record<string, Sha256Digest>>;
  readonly invocationDigest: Sha256Digest;
  readonly resultDigest: Sha256Digest;
  readonly outputDigest: Sha256Digest;
  readonly previousDescriptorPath: string;
  readonly previousDescriptorDigest: Sha256Digest;
}

export interface ReleaseTrustExpectation {
  readonly repository: string;
  readonly runId: string;
  readonly runAttempt: string;
  readonly artifactId: string;
  readonly artifactName: string;
  readonly artifactZipDigest: Sha256Digest;
  readonly artifactZipSize: number;
  readonly artifactCreatedAt: string;
  readonly artifactExpiresAt: string;
  readonly workflow: Readonly<{
    ref: string;
    digest: Sha256Digest;
    sha: string;
  }>;
  readonly product: Readonly<{
    sha: string;
    version: string;
    tag: string;
  }>;
  readonly generator: Readonly<{
    digest: Sha256Digest;
    sha: string;
  }>;
  readonly consumer: ReleaseConsumerIdentity;
}

export interface VerifyReleaseTrustEnvelopeInput {
  readonly artifactZip: Uint8Array;
  readonly authenticatedArtifactZipDigest: Sha256Digest;
  readonly candidateEnvelope: unknown;
  readonly expected: ReleaseTrustExpectation;
}

declare const verifiedTrustBrand: unique symbol;

export interface VerifiedDocsBundleTrust {
  readonly authority: "local-provisional" | "release";
  readonly identity: DocsBundleIdentityExpectation;
  readonly assetDigests: DocsBundleAssetDigests;
  readonly releaseAssets: readonly ReleaseAssetAttestation[];
  readonly [verifiedTrustBrand]: true;
}

export interface ArchivePolicy {
  /** Producer payload files; manifest.json is additional archive overhead. */
  readonly maxFiles: number;
  readonly maxBytesPerFile: number;
  readonly maxTotalBytes: number;
  readonly maxManifestBytes: number;
  readonly maxCompressedBytes: number;
  readonly maxExpandedBytes: number;
  readonly maxPathBytes: number;
  readonly maxPathDepth: number;
  readonly maxCompressionRatio: number;
}

export interface ArchiveEntry {
  readonly path: string;
  readonly bytes: number;
  readonly digest: Sha256Digest;
  readonly content: Buffer;
}

export interface InspectedArchive {
  readonly entries: readonly ArchiveEntry[];
  readonly compressedBytes: number;
  readonly uncompressedBytes: number;
  readonly expandedBytes: number;
  readonly compressionRatio: number;
  readonly mtime: number;
}

export type ExtractionPhase =
  | "verified"
  | "lock-acquired"
  | "before-entry-write"
  | "after-entry-write"
  | "before-tree-publish"
  | "after-tree-publish"
  | "before-pointer-write"
  | "after-pointer-write"
  | "before-pointer-commit"
  | "after-pointer-commit";

export interface ExtractDocsBundleInput {
  readonly archive: Uint8Array;
  readonly checksums: Uint8Array;
  readonly manifest: Uint8Array;
  readonly schema: Uint8Array;
  /** Active pointer path. Immutable trees are stored in an adjacent `.trees` directory. */
  readonly destination: string;
  readonly trust: VerifiedDocsBundleTrust;
  readonly policy?: Partial<ArchivePolicy>;
  readonly onPhase?: (phase: ExtractionPhase) => void | Promise<void>;
}

export interface ActiveDocsBundle {
  readonly pointerPath: string;
  readonly activeTree: string;
  readonly treeDigest: Sha256Digest;
}

export interface ExtractDocsBundleResult extends ActiveDocsBundle {
  readonly manifest: DocsBundleManifestV1;
  readonly fileCount: number;
  readonly totalBytes: number;
  readonly reused: boolean;
}
