import { spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import {
  chmodSync,
  lstatSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { deflateRawSync, gzipSync } from "node:zlib";
import { afterEach, describe, expect, it } from "vitest";
import { readCandidateZip } from "./candidate-zip.js";
import {
  CANDIDATE_ENVELOPE_SCHEMA_SHA256,
  DOCS_BUNDLE_SCHEMA_SHA256,
  DOCS_BUNDLE_SCHEMA_SOURCE_SHA256,
  RELEASE_ARTIFACT_ATTESTATION_SCHEMA_SHA256,
  RELEASE_ASSET_NAMES,
  extractDocsBundle,
  inspectArchive,
  normalizeArchivePath,
  parseDocsBundleManifest,
  resolveActiveDocsBundle,
  resolveArchivePolicy,
  verifyArchiveEntries,
  verifyLocalProvisionalTrust,
  verifyReleaseTrustEnvelope,
  type DocsBundleAssetDigests,
  type DocsBundleIdentityExpectation,
  type DocsBundleManifestV1,
  type ExtractionPhase,
  type ReleaseTrustExpectation,
  type Sha256Digest,
  type VerifiedDocsBundleTrust,
} from "./index.js";

const roots: string[] = [];
const sourceSha = "a".repeat(40);
const generatedAt = "2026-08-08T00:00:00.000Z";
const mtime = Date.parse(generatedAt) / 1000;
const basePayloadPaths = [
  "proof/release-summary.json",
  "reference/cli/commands.json",
  "reference/providers/providers.json",
  "reference/skills/skills.json",
  "reference/workflows/workflows.json",
  "release-notes.md",
  "schemas/docs-bundle-manifest-v1.schema.json",
] as const;

function unlockTree(root: string): void {
  if (!lstatSync(root, { throwIfNoEntry: false })) return;
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop()!;
    const stat = lstatSync(current);
    if (stat.isSymbolicLink()) continue;
    chmodSync(current, stat.isDirectory() ? 0o700 : 0o600);
    if (stat.isDirectory()) for (const name of readdirSync(current)) stack.push(join(current, name));
  }
}

afterEach(() => {
  while (roots.length > 0) {
    const root = roots.pop()!;
    unlockTree(root);
    rmSync(root, { recursive: true, force: true });
  }
});

function temporaryRoot(): string {
  const root = mkdtempSync(join(realpathSync(tmpdir()), "vcskill-contracts-"));
  roots.push(root);
  return root;
}

function digest(content: Uint8Array | string): Sha256Digest {
  return `sha256:${createHash("sha256").update(content).digest("hex")}`;
}

function stableJson(value: unknown): Buffer {
  return Buffer.from(`${JSON.stringify(value, (_key, candidate) => {
    if (Array.isArray(candidate) || !candidate || typeof candidate !== "object") return candidate;
    return Object.fromEntries(Object.entries(candidate as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)));
  }, 2)}\n`);
}

function octal(value: number, width: number): Buffer {
  return Buffer.from(`${value.toString(8).padStart(width - 2, "0")}\0 `, "ascii");
}

function text(value: string, width: number): Buffer {
  const result = Buffer.alloc(width);
  Buffer.from(value).copy(result);
  return result;
}

function tarEntry(input: {
  path: string;
  content?: Buffer;
  type?: string;
  mode?: number;
  uid?: number;
  owner?: string;
  link?: string;
  checksumText?: string;
  reservedByte?: number;
}): Buffer {
  const content = input.content ?? Buffer.alloc(0);
  const parts = input.path.split("/");
  const name = parts.pop() ?? "";
  const header = Buffer.alloc(512);
  text(name, 100).copy(header, 0);
  octal(input.mode ?? 0o644, 8).copy(header, 100);
  octal(input.uid ?? 0, 8).copy(header, 108);
  octal(0, 8).copy(header, 116);
  octal(content.byteLength, 12).copy(header, 124);
  octal(mtime, 12).copy(header, 136);
  header.fill(0x20, 148, 156);
  header[156] = (input.type ?? "0").charCodeAt(0);
  text(input.link ?? "", 100).copy(header, 157);
  Buffer.from("ustar\0", "ascii").copy(header, 257);
  Buffer.from("00", "ascii").copy(header, 263);
  text(input.owner ?? "root", 32).copy(header, 265);
  text("root", 32).copy(header, 297);
  text(parts.join("/"), 155).copy(header, 345);
  header[500] = input.reservedByte ?? 0;
  const sum = header.reduce((total, byte) => total + byte, 0);
  Buffer.from(input.checksumText ?? `${sum.toString(8).padStart(6, "0")}\0 `, "ascii").copy(header, 148);
  const padding = (512 - content.byteLength % 512) % 512;
  return Buffer.concat([header, content, Buffer.alloc(padding)]);
}

function gzipTar(entries: Buffer[], trailingTar = Buffer.alloc(0)): Buffer {
  const archive = gzipSync(Buffer.concat([...entries, Buffer.alloc(1024), trailingTar]), { level: 9 });
  archive.writeUInt32LE(mtime, 4);
  archive[8] = 2;
  archive[9] = 255;
  return archive;
}

function crc32(content: Uint8Array): number {
  let crc = 0xffff_ffff;
  for (const byte of content) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc & 1) !== 0 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  return (crc ^ 0xffff_ffff) >>> 0;
}

function storedZip(files: Readonly<Record<string, Buffer>>): Buffer {
  const local: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files).sort(([a], [b]) => a.localeCompare(b))) {
    const nameBytes = Buffer.from(name);
    const crc = crc32(content);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0); header.writeUInt16LE(20, 4); header.writeUInt16LE(0x0800, 6);
    header.writeUInt16LE(0, 8); header.writeUInt32LE(crc, 14); header.writeUInt32LE(content.byteLength, 18);
    header.writeUInt32LE(content.byteLength, 22); header.writeUInt16LE(nameBytes.byteLength, 26);
    local.push(header, nameBytes, content);
    const directory = Buffer.alloc(46);
    directory.writeUInt32LE(0x02014b50, 0); directory.writeUInt16LE(20, 4); directory.writeUInt16LE(20, 6);
    directory.writeUInt16LE(0x0800, 8); directory.writeUInt16LE(0, 10); directory.writeUInt32LE(crc, 16);
    directory.writeUInt32LE(content.byteLength, 20); directory.writeUInt32LE(content.byteLength, 24);
    directory.writeUInt16LE(nameBytes.byteLength, 28); directory.writeUInt32LE(offset, 42);
    central.push(directory, nameBytes);
    offset += header.byteLength + nameBytes.byteLength + content.byteLength;
  }
  const centralBytes = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(Object.keys(files).length, 8);
  end.writeUInt16LE(Object.keys(files).length, 10); end.writeUInt32LE(centralBytes.byteLength, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, centralBytes, end]);
}

function singleEntryDeflatedZip(input: {
  name?: string;
  descriptor?: "none" | "signed" | "unsigned";
  corruptDescriptor?: boolean;
  declaredUncompressedBytes?: number;
  localExtra?: Buffer;
  centralExtra?: Buffer;
  entryComment?: Buffer;
  gap?: Buffer;
  compressedOverride?: Buffer;
  trailingCompressedStream?: Buffer;
} = {}): Buffer {
  const name = input.name ?? "entry.txt";
  const content = Buffer.from("candidate payload\n");
  const nameBytes = Buffer.from(name);
  const localExtra = input.localExtra ?? Buffer.alloc(0);
  const centralExtra = input.centralExtra ?? Buffer.alloc(0);
  const entryComment = input.entryComment ?? Buffer.alloc(0);
  const declaredUncompressedBytes = input.declaredUncompressedBytes ?? content.byteLength;
  const descriptor = input.descriptor ?? "none";
  const flags = 0x0800 | (descriptor === "none" ? 0 : 0x0008);
  const compressed = Buffer.concat([
    input.compressedOverride ?? deflateRawSync(content),
    input.trailingCompressedStream ?? Buffer.alloc(0),
  ]);
  const crc = crc32(content);
  const localHeader = Buffer.alloc(30);
  localHeader.writeUInt32LE(0x04034b50, 0);
  localHeader.writeUInt16LE(20, 4);
  localHeader.writeUInt16LE(flags, 6);
  localHeader.writeUInt16LE(8, 8);
  if (descriptor === "none") {
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(compressed.byteLength, 18);
    localHeader.writeUInt32LE(declaredUncompressedBytes, 22);
  }
  localHeader.writeUInt16LE(nameBytes.byteLength, 26);
  localHeader.writeUInt16LE(localExtra.byteLength, 28);

  const descriptorBytes = descriptor === "none" ? Buffer.alloc(0) : Buffer.alloc(descriptor === "signed" ? 16 : 12);
  const descriptorOffset = descriptor === "signed" ? 4 : 0;
  if (descriptor !== "none") {
    if (descriptor === "signed") descriptorBytes.writeUInt32LE(0x08074b50, 0);
    descriptorBytes.writeUInt32LE(input.corruptDescriptor ? (crc ^ 1) >>> 0 : crc, descriptorOffset);
    descriptorBytes.writeUInt32LE(compressed.byteLength, descriptorOffset + 4);
    descriptorBytes.writeUInt32LE(declaredUncompressedBytes, descriptorOffset + 8);
  }
  const local = Buffer.concat([
    localHeader,
    nameBytes,
    localExtra,
    compressed,
    descriptorBytes,
    input.gap ?? Buffer.alloc(0),
  ]);

  const directory = Buffer.alloc(46);
  directory.writeUInt32LE(0x02014b50, 0);
  directory.writeUInt16LE(20, 4);
  directory.writeUInt16LE(20, 6);
  directory.writeUInt16LE(flags, 8);
  directory.writeUInt16LE(8, 10);
  directory.writeUInt32LE(crc, 16);
  directory.writeUInt32LE(compressed.byteLength, 20);
  directory.writeUInt32LE(declaredUncompressedBytes, 24);
  directory.writeUInt16LE(nameBytes.byteLength, 28);
  directory.writeUInt16LE(centralExtra.byteLength, 30);
  directory.writeUInt16LE(entryComment.byteLength, 32);
  directory.writeUInt32LE(0, 42);
  const central = Buffer.concat([directory, nameBytes, centralExtra, entryComment]);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(central.byteLength, 12);
  end.writeUInt32LE(local.byteLength, 16);
  return Buffer.concat([local, central, end]);
}

function multipleEntryDeflatedZip(entries: ReadonlyArray<{
  name: string;
  content: Buffer;
  declaredUncompressedBytes?: number;
  compressedOverride?: Buffer;
}>): Buffer {
  const local: Buffer[] = [];
  const central: Buffer[] = [];
  let localOffset = 0;
  for (const entry of entries) {
    const nameBytes = Buffer.from(entry.name);
    const compressed = entry.compressedOverride ?? deflateRawSync(entry.content);
    const declaredUncompressedBytes = entry.declaredUncompressedBytes ?? entry.content.byteLength;
    const crc = crc32(entry.content);
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6);
    localHeader.writeUInt16LE(8, 8);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(compressed.byteLength, 18);
    localHeader.writeUInt32LE(declaredUncompressedBytes, 22);
    localHeader.writeUInt16LE(nameBytes.byteLength, 26);
    local.push(localHeader, nameBytes, compressed);

    const directory = Buffer.alloc(46);
    directory.writeUInt32LE(0x02014b50, 0);
    directory.writeUInt16LE(20, 4);
    directory.writeUInt16LE(20, 6);
    directory.writeUInt16LE(0x0800, 8);
    directory.writeUInt16LE(8, 10);
    directory.writeUInt32LE(crc, 16);
    directory.writeUInt32LE(compressed.byteLength, 20);
    directory.writeUInt32LE(declaredUncompressedBytes, 24);
    directory.writeUInt16LE(nameBytes.byteLength, 28);
    directory.writeUInt32LE(localOffset, 42);
    central.push(directory, nameBytes);
    localOffset += localHeader.byteLength + nameBytes.byteLength + compressed.byteLength;
  }
  const centralBytes = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBytes.byteLength, 12);
  end.writeUInt32LE(localOffset, 16);
  return Buffer.concat([...local, centralBytes, end]);
}

interface Fixture {
  archive: Buffer;
  checksums: Buffer;
  manifestBytes: Buffer;
  schema: Buffer;
  manifest: DocsBundleManifestV1;
  identity: DocsBundleIdentityExpectation;
  digests: DocsBundleAssetDigests;
  trust: VerifiedDocsBundleTrust;
}

function syntheticFixture(input: { mode?: "final" | "provisional"; marker?: string; previous?: boolean } = {}): Fixture {
  const mode = input.mode ?? "provisional";
  const marker = input.marker ?? "one";
  const schema = readFileSync(new URL("../fixtures/phase-2-provisional/docs-bundle-manifest-v1.schema.json", import.meta.url));
  const paths = [...basePayloadPaths, ...(input.previous ? ["reference/previous-stable/bootstrap.json"] : [])];
  const files = new Map(paths.map((path) => [path, path === "schemas/docs-bundle-manifest-v1.schema.json"
    ? schema
    : Buffer.from(path.endsWith(".json") ? `${JSON.stringify({ path, marker })}\n` : `# ${path} ${marker}\n`)]));
  const version = "1.2.3";
  const releaseTag = mode === "final" ? `vcskill@${version}` : null;
  const manifest: DocsBundleManifestV1 = {
    schemaVersion: 1,
    schemaId: "https://vcskill.dev/schemas/docs-bundle-manifest-v1.schema.json",
    bundle: "vcskill-docs-bundle",
    mode,
    publishable: mode === "final",
    version,
    releaseTag,
    sourceSha,
    generatorSha: sourceSha,
    generatedAt,
    sourceDateEpoch: mtime,
    proofBoundary: "allowlist:v1",
    fileCount: files.size,
    totalBytes: [...files.values()].reduce((sum, content) => sum + content.byteLength, 0),
    payload: [...files].sort(([a], [b]) => a.localeCompare(b)).map(([path, content]) => ({ path, bytes: content.byteLength, digest: digest(content) })),
  };
  const manifestBytes = stableJson(manifest);
  const archive = gzipTar([...files, ["manifest.json", manifestBytes] as const]
    .sort(([a], [b]) => a.localeCompare(b)).map(([path, content]) => tarEntry({ path, content })));
  const assetBytes: Record<string, Buffer> = {
    "docs-bundle.tar.gz": archive,
    "docs-bundle.manifest.json": manifestBytes,
    "docs-bundle-manifest-v1.schema.json": schema,
  };
  for (const name of RELEASE_ASSET_NAMES) if (!(name in assetBytes) && name !== "checksums.txt") assetBytes[name] = Buffer.from(`${name}\n`);
  const checksumNames = mode === "final" ? RELEASE_ASSET_NAMES.filter((name) => name !== "checksums.txt") : Object.keys(assetBytes).filter((name) => !name.startsWith("vcskill-"));
  const checksums = Buffer.from([...checksumNames].sort().map((name) => `${digest(assetBytes[name]!).slice(7)}  ${name}`).join("\n") + "\n");
  assetBytes["checksums.txt"] = checksums;
  const identity = { mode, version, releaseTag, sourceSha, generatorSha: sourceSha, schemaDigest: DOCS_BUNDLE_SCHEMA_SHA256 } as DocsBundleIdentityExpectation;
  const digests = {
    archiveDigest: digest(archive), checksumsDigest: digest(checksums), manifestDigest: digest(manifestBytes), schemaDigest: digest(schema),
  };
  if (mode === "provisional") {
    const trust = verifyLocalProvisionalTrust({ archive, checksums, manifest: manifestBytes, schema, expected: { ...identity, ...digests, mode: "provisional", releaseTag: null } });
    return { archive, checksums, manifestBytes, schema, manifest, identity, digests, trust };
  }
  const release = releaseTrust(assetBytes, version);
  return { archive, checksums, manifestBytes, schema, manifest, identity, digests, trust: release.trust };
}

function releaseTrust(assetBytes: Record<string, Buffer>, version = "1.2.3") {
  const runId = "99";
  const runAttempt = "2";
  const artifactId = "7";
  const artifactName = `vcskill-candidate-${sourceSha}-run-${runId}-attempt-${runAttempt}`;
  const consumer = {
    repository: "bavanchun/vcskill-web", commitSha: "b".repeat(40), lockPath: ".github/release/web-consumer-lock.json",
    lockDigest: digest("lock"), contractDigest: digest("contract"), contractDigests: { "contract.json": digest("contract") },
    invocationDigest: digest("invocation"), resultDigest: digest("result"), outputDigest: digest("output"),
    previousDescriptorPath: "descriptors/previous.json", previousDescriptorDigest: digest("previous"),
  };
  const expectedBase = {
    repository: "bavanchun/vcskill", runId, runAttempt, artifactId, artifactName,
    workflow: { ref: "bavanchun/vcskill/.github/workflows/release.yml@refs/heads/main", digest: digest("workflow"), sha: sourceSha },
    product: { sha: sourceSha, version, tag: `vcskill@${version}` },
    generator: { digest: digest("generator"), sha: sourceSha }, consumer,
  } as const;
  const attestation = {
    schemaVersion: 1, schema: "https://vcskill.dev/schemas/release-artifact-attestation.schema.json", artifactName,
    workflow: { runId, runAttempt, path: ".github/workflows/release.yml", ...expectedBase.workflow },
    product: expectedBase.product,
    generator: { path: "packages/cli/scripts/generate-docs-bundle.ts", ...expectedBase.generator },
    consumer,
    releaseAssets: [...RELEASE_ASSET_NAMES].map((name) => ({ name, size: assetBytes[name]!.byteLength, digest: digest(assetBytes[name]!) })),
  };
  const artifactZip = storedZip({ ...assetBytes, "release-artifact-attestation.json": Buffer.from(`${JSON.stringify(attestation)}\n`) });
  const artifactZipDigest = digest(artifactZip);
  const artifactCreatedAt = "2026-08-08T00:00:00Z";
  const artifactExpiresAt = "2099-08-08T00:00:00Z";
  const expected: ReleaseTrustExpectation = {
    ...expectedBase,
    artifactZipDigest,
    artifactZipSize: artifactZip.byteLength,
    artifactCreatedAt,
    artifactExpiresAt,
  };
  const envelope = {
    schemaVersion: 1, schema: "https://vcskill.dev/schemas/candidate-envelope.schema.json", repository: expected.repository,
    runId, runAttempt, artifactId, artifactName, artifactDigest: artifactZipDigest, artifactSize: artifactZip.byteLength,
    createdAt: artifactCreatedAt, expiresAt: artifactExpiresAt,
    workflowPath: ".github/workflows/release.yml", headSha: sourceSha, rejectedArtifacts: [],
  };
  return {
    envelope, attestation, expected, artifactZip, assetBytes,
    trust: verifyReleaseTrustEnvelope({ artifactZip, authenticatedArtifactZipDigest: artifactZipDigest, candidateEnvelope: envelope, expected }),
  };
}

function repackRelease(value: ReturnType<typeof releaseTrust>, attestation: typeof value.attestation) {
  const artifactZip = storedZip({ ...value.assetBytes, "release-artifact-attestation.json": Buffer.from(`${JSON.stringify(attestation)}\n`) });
  const artifactZipDigest = digest(artifactZip);
  return {
    artifactZip,
    authenticatedArtifactZipDigest: artifactZipDigest,
    candidateEnvelope: { ...value.envelope, artifactDigest: artifactZipDigest, artifactSize: artifactZip.byteLength },
    expected: { ...value.expected, artifactZipDigest, artifactZipSize: artifactZip.byteLength },
  };
}

function extractionInput(value: Fixture, destination: string) {
  return { archive: value.archive, checksums: value.checksums, manifest: value.manifestBytes, schema: value.schema, destination, trust: value.trust };
}

describe("producer contracts and trust envelopes", () => {
  it("pins byte-identical producer schemas and their emitted schema representation", () => {
    const raw = readFileSync(new URL("../schemas/docs-bundle-manifest-v1.schema.json", import.meta.url));
    expect(digest(raw)).toBe(DOCS_BUNDLE_SCHEMA_SOURCE_SHA256);
    expect(digest(readFileSync(new URL("../schemas/candidate-envelope.schema.json", import.meta.url)))).toBe(CANDIDATE_ENVELOPE_SCHEMA_SHA256);
    expect(digest(readFileSync(new URL("../schemas/release-artifact-attestation.schema.json", import.meta.url)))).toBe(RELEASE_ARTIFACT_ATTESTATION_SCHEMA_SHA256);
    expect(digest(readFileSync(new URL("../fixtures/phase-2-provisional/docs-bundle-manifest-v1.schema.json", import.meta.url)))).toBe(DOCS_BUNDLE_SCHEMA_SHA256);
  });

  it("accepts actual Phase 2 provisional bytes with no previous-source projection", async () => {
    const root = new URL("../fixtures/phase-2-provisional/", import.meta.url);
    const archive = readFileSync(new URL("docs-bundle.tar.gz", root));
    const checksums = readFileSync(new URL("checksums.txt", root));
    const manifestBytes = readFileSync(new URL("docs-bundle.manifest.json", root));
    const schema = readFileSync(new URL("docs-bundle-manifest-v1.schema.json", root));
    const provenance = JSON.parse(readFileSync(new URL("provenance.json", root), "utf8")) as {
      producer: string;
      producerDigest: Sha256Digest;
      producerSha: string;
      assets: Record<string, Sha256Digest>;
    };
    const manifest = JSON.parse(manifestBytes.toString()) as DocsBundleManifestV1;
    expect(provenance).toMatchObject({
      producer: "packages/cli/scripts/generate-docs-bundle.ts",
      producerDigest: "sha256:77ab4dc1f75c09256198f46462055e34735d9441ceef3058c16c85fb17707bbc",
      producerSha: manifest.sourceSha,
    });
    expect(provenance.assets).toEqual({
      "checksums.txt": digest(checksums),
      "docs-bundle-manifest-v1.schema.json": digest(schema),
      "docs-bundle.manifest.json": digest(manifestBytes),
      "docs-bundle.tar.gz": digest(archive),
    });
    expect(manifest.payload.some((entry) => entry.path === "reference/previous-stable/bootstrap.json")).toBe(false);
    const trust = verifyLocalProvisionalTrust({
      archive, checksums, manifest: manifestBytes, schema,
      expected: {
        mode: "provisional", version: manifest.version, releaseTag: null, sourceSha: manifest.sourceSha,
        generatorSha: manifest.generatorSha, schemaDigest: digest(schema), archiveDigest: digest(archive),
        checksumsDigest: digest(checksums), manifestDigest: digest(manifestBytes),
      },
    });
    const destination = join(temporaryRoot(), "active");
    const result = await extractDocsBundle({ archive, checksums, manifest: manifestBytes, schema, destination, trust });
    expect(result.activeTree).toBe((await resolveActiveDocsBundle(destination)).activeTree);
    expect(readFileSync(join(result.activeTree, "manifest.json"))).toEqual(manifestBytes);
  });

  it("parses explicit provisional and final identities and permits only the optional bootstrap member", () => {
    for (const value of [syntheticFixture(), syntheticFixture({ mode: "final" }), syntheticFixture({ mode: "final", previous: true })]) {
      expect(parseDocsBundleManifest(value.manifest, value.identity)).toEqual(value.manifest);
    }
    const provisional = syntheticFixture();
    expect(() => parseDocsBundleManifest({ ...provisional.manifest, generatorSha: "c".repeat(40) }, provisional.identity)).toThrow(/generator/i);
    const final = syntheticFixture({ mode: "final" });
    expect(() => parseDocsBundleManifest(final.manifest, { ...final.identity, generatorSha: "c".repeat(40) })).toThrow(/generator SHA must equal/i);
    expect(() => parseDocsBundleManifest({ ...final.manifest, mode: "provisional", publishable: false, releaseTag: null }, final.identity)).toThrow(/mode/i);
  });

  it("validates exact outer/inner identity and derives the mandatory docs digests", () => {
    const final = syntheticFixture({ mode: "final" });
    expect(final.trust.authority).toBe("release");
    expect(final.trust.assetDigests).toEqual(final.digests);
    const assets = Object.fromEntries(RELEASE_ASSET_NAMES.map((name) => [name, Buffer.from(name)]));
    assets["docs-bundle-manifest-v1.schema.json"] = readFileSync(new URL("../fixtures/phase-2-provisional/docs-bundle-manifest-v1.schema.json", import.meta.url));
    const value = releaseTrust(assets);
    expect(() => verifyReleaseTrustEnvelope({ artifactZip: value.artifactZip, authenticatedArtifactZipDigest: value.expected.artifactZipDigest, candidateEnvelope: { ...value.envelope, repository: "other/repo" }, expected: value.expected })).toThrow(/identity/i);
    expect(() => verifyReleaseTrustEnvelope(repackRelease(value, { ...value.attestation, extra: true } as typeof value.attestation))).toThrow(/pinned schema/i);
    expect(() => verifyReleaseTrustEnvelope({ artifactZip: value.artifactZip, authenticatedArtifactZipDigest: digest("wrong"), candidateEnvelope: value.envelope, expected: value.expected })).toThrow(/digest/i);
    const duplicate = structuredClone(value.attestation);
    duplicate.releaseAssets[1] = duplicate.releaseAssets[0]!;
    expect(() => verifyReleaseTrustEnvelope(repackRelease(value, duplicate))).toThrow(/inventory/i);

    const expiredCreatedAt = "2020-08-08T00:00:00Z";
    const expiredExpiresAt = "2021-08-08T00:00:00Z";
    expect(() => verifyReleaseTrustEnvelope({
      artifactZip: value.artifactZip,
      authenticatedArtifactZipDigest: value.expected.artifactZipDigest,
      candidateEnvelope: { ...value.envelope, createdAt: expiredCreatedAt, expiresAt: expiredExpiresAt },
      expected: { ...value.expected, artifactCreatedAt: expiredCreatedAt, artifactExpiresAt: expiredExpiresAt },
    })).toThrow(/validity window/i);
    expect(() => verifyReleaseTrustEnvelope({
      artifactZip: value.artifactZip,
      authenticatedArtifactZipDigest: value.expected.artifactZipDigest,
      candidateEnvelope: { ...value.envelope, expiresAt: "2098-08-08T00:00:00Z" },
      expected: value.expected,
    })).toThrow(/identity/i);

    const wrongWorkflow = {
      ...value.attestation,
      workflow: {
        ...value.attestation.workflow,
        ref: "bavanchun/vcskill/.github/workflows/release.yml@refs/heads/release",
      },
    } as unknown as typeof value.attestation;
    const wrongWorkflowInput = repackRelease(value, wrongWorkflow);
    expect(() => verifyReleaseTrustEnvelope({
      ...wrongWorkflowInput,
      expected: {
        ...wrongWorkflowInput.expected,
        workflow: { ...wrongWorkflowInput.expected.workflow, ref: wrongWorkflow.workflow.ref },
      },
    })).toThrow(/exact main-branch workflow/i);
    expect(() => releaseTrust(assets, "1.2.3-rc.1")).toThrow(/stable semver/i);
  });

  it("accepts canonical ZIP data descriptors and rejects hidden or ambiguous compressed framing", () => {
    for (const descriptor of ["signed", "unsigned"] as const) {
      expect(readCandidateZip(singleEntryDeflatedZip({ descriptor })).get("entry.txt")?.toString()).toBe("candidate payload\n");
    }
    expect(() => readCandidateZip(singleEntryDeflatedZip({ descriptor: "signed", corruptDescriptor: true }))).toThrow(/descriptor metadata drift/i);
    expect(() => readCandidateZip(singleEntryDeflatedZip({ gap: Buffer.from("hidden") }))).toThrow(/local framing/i);
    expect(() => readCandidateZip(singleEntryDeflatedZip({
      trailingCompressedStream: deflateRawSync(Buffer.from("hidden stream")),
    }))).toThrow(/decompression failed/i);
    expect(() => readCandidateZip(singleEntryDeflatedZip({
      declaredUncompressedBytes: 512 * 1024 * 1024 + 1,
      compressedOverride: Buffer.from([0xff]),
    }))).toThrow(/byte bounds/i);
    expect(() => readCandidateZip(singleEntryDeflatedZip({
      name: "release-artifact-attestation.json",
      declaredUncompressedBytes: 512 * 1024 + 1,
    }))).toThrow(/byte bounds/i);
    for (const hidden of [
      { localExtra: Buffer.from("hidden") },
      { centralExtra: Buffer.from("hidden") },
      { entryComment: Buffer.from("hidden") },
    ]) expect(() => readCandidateZip(singleEntryDeflatedZip(hidden))).toThrow(/unsupported features|metadata drift/i);

    expect(() => readCandidateZip(multipleEntryDeflatedZip([
      { name: "first.txt", content: Buffer.from("x") },
      {
        name: "second.txt",
        content: Buffer.from("x"),
        declaredUncompressedBytes: 512 * 1024 * 1024,
        compressedOverride: Buffer.from([0xff]),
      },
    ]))).toThrow(/byte bounds/i);
  });

  it("rejects unbranded trust and cannot grant final authority through the local verifier", async () => {
    const provisional = syntheticFixture();
    await expect(extractDocsBundle({ ...extractionInput(provisional, join(temporaryRoot(), "active")), trust: { ...provisional.trust } })).rejects.toThrow(/not produced/i);
    const final = syntheticFixture({ mode: "final" });
    expect(() => verifyLocalProvisionalTrust({
      archive: final.archive, checksums: final.checksums, manifest: final.manifestBytes, schema: final.schema,
      expected: { ...final.digests, mode: "provisional", version: "1.2.3", releaseTag: null, sourceSha, generatorSha: sourceSha, schemaDigest: DOCS_BUNDLE_SCHEMA_SHA256 },
    })).toThrow(/mode/i);
  });

  it("extracts a final bundle only with verified release-envelope authority", async () => {
    const final = syntheticFixture({ mode: "final" });
    const result = await extractDocsBundle(extractionInput(final, join(temporaryRoot(), "active")));
    expect(final.trust.authority).toBe("release");
    expect(result.manifest.mode).toBe("final");
  });
});

describe("gzip, tar, paths, and producer bounds", () => {
  it.each([
    "trailing.", "dir/trailing.", "trailing ", "dir/trailing ", "/absolute", "../traversal", "a/../b", "a/./b", "a//b",
    "a\\b", "C:/drive", "a%2fb", "control\u0001", "café", "cafe\u0301", "trailing/", "./leading",
  ])("rejects hostile path %#", (path) => expect(() => normalizeArchivePath(path)).toThrow(/path policy/i));

  it("rejects exact and case-folded collisions", () => {
    expect(() => inspectArchive(gzipTar([tarEntry({ path: "A.txt" }), tarEntry({ path: "a.txt" })]))).toThrow(/collide/i);
    expect(() => inspectArchive(gzipTar([tarEntry({ path: "a.txt" }), tarEntry({ path: "a.txt" })]))).toThrow(/collide/i);
  });

  it.each(["1", "2", "3", "4", "5", "6", "x", "g", "L", "K", "S"])("rejects tar special entry type %s", (type) => {
    expect(() => inspectArchive(gzipTar([tarEntry({ path: "special", type })]))).toThrow(/entry type/i);
  });

  it("rejects links, nested archives, unsafe metadata, ordering, checksums, padding, and tar trailers", () => {
    expect(() => inspectArchive(gzipTar([tarEntry({ path: "regular", link: "target" })]))).toThrow(/link or device/i);
    expect(() => inspectArchive(gzipTar([tarEntry({ path: "nested.zip", content: Buffer.from("x") })]))).toThrow(/nested archive/i);
    expect(() => inspectArchive(gzipTar([tarEntry({ path: "mode", mode: 0o777 })]))).toThrow(/ownership or mode/i);
    expect(() => inspectArchive(gzipTar([tarEntry({ path: "uid", uid: 1 })]))).toThrow(/ownership or mode/i);
    expect(() => inspectArchive(gzipTar([tarEntry({ path: "owner", owner: "nobody" })]))).toThrow(/owner metadata/i);
    expect(() => inspectArchive(gzipTar([tarEntry({ path: "z" }), tarEntry({ path: "a" })]))).toThrow(/sorted/i);
    expect(() => inspectArchive(gzipTar([tarEntry({ path: "extended", reservedByte: 1 })]))).toThrow(/extension/i);
    expect(() => inspectArchive(gzipTar([tarEntry({ path: "checksum", checksumText: "000000\0 " })]))).toThrow(/checksum/i);
    const padded = tarEntry({ path: "padding", content: Buffer.from("x") });
    padded[padded.length - 1] = 1;
    expect(() => inspectArchive(gzipTar([padded]))).toThrow(/padding/i);
    expect(() => inspectArchive(gzipTar([tarEntry({ path: "trailing" })], Buffer.alloc(512)))).toThrow(/trailing data/i);
  });

  it("rejects empty/non-empty second gzip members, zero/nonzero trailers, truncated trailer, CRC, and ISIZE corruption", () => {
    const archive = syntheticFixture().archive;
    const empty = gzipSync(Buffer.alloc(0));
    const nonEmpty = gzipSync(Buffer.from("x"));
    for (const candidate of [
      Buffer.concat([archive, empty]), Buffer.concat([archive, nonEmpty]), Buffer.concat([archive, Buffer.alloc(8)]),
      Buffer.concat([archive, Buffer.from("x")]), archive.subarray(0, archive.length - 1), archive.subarray(0, archive.length - 8),
    ]) expect(() => inspectArchive(candidate)).toThrow(/gzip/i);
    const crc = Buffer.from(archive); crc[crc.length - 8] = crc[crc.length - 8]! ^ 1;
    expect(() => inspectArchive(crc)).toThrow(/checksum/i);
    const size = Buffer.from(archive); size[size.length - 4] = size[size.length - 4]! ^ 1;
    expect(() => inspectArchive(size)).toThrow(/size trailer/i);
  });

  it("separates 128-file/4MiB producer payload ceilings from manifest and tar overhead", () => {
    const policy = resolveArchivePolicy();
    expect(policy.maxExpandedBytes).toBeGreaterThan(policy.maxTotalBytes);
    const chunks = Array.from({ length: 128 }, (_, index) => tarEntry({
      path: `f${index.toString().padStart(3, "0")}`,
      content: randomBytes(32 * 1024),
    }));
    const manifest = tarEntry({ path: "manifest.json", content: randomBytes(512 * 1024) });
    const inspected = inspectArchive(gzipTar([...chunks, manifest]));
    expect(inspected.entries).toHaveLength(129);
    expect(inspected.uncompressedBytes).toBe(4 * 1024 * 1024 + 512 * 1024);
    expect(() => inspectArchive(gzipTar([...chunks, tarEntry({ path: "overflow", content: Buffer.from("x") }), manifest]))).toThrow(/file-count|total byte/i);
  });

  it("verifies exact manifest inventory without counting manifest bytes as payload", () => {
    const value = syntheticFixture();
    const entries = inspectArchive(value.archive).entries;
    expect(verifyArchiveEntries(entries, value.manifest)).toHaveLength(value.manifest.fileCount + 1);
    expect(() => verifyArchiveEntries(entries.slice(1), value.manifest)).toThrow(/count/i);
  });
});

describe("content-addressed activation", () => {
  it("commits through one regular-file pointer and resolves it once", async () => {
    const value = syntheticFixture();
    const destination = join(temporaryRoot(), "active");
    const result = await extractDocsBundle(extractionInput(value, destination));
    expect(lstatSync(destination).isFile()).toBe(true);
    expect(lstatSync(result.activeTree).isDirectory()).toBe(true);
    expect(await resolveActiveDocsBundle(destination)).toEqual({ pointerPath: destination, activeTree: result.activeTree, treeDigest: result.treeDigest });
  });

  it("keeps the active pointer unchanged when hostile archive framing fails preflight", async () => {
    const destination = join(temporaryRoot(), "active");
    const value = syntheticFixture();
    const old = await extractDocsBundle(extractionInput(value, destination));
    const hostileArchive = Buffer.concat([value.archive, value.archive]);
    const hostileDigests = { ...value.digests, archiveDigest: digest(hostileArchive) };
    const hostileTrust = verifyLocalProvisionalTrust({
      archive: hostileArchive, checksums: value.checksums, manifest: value.manifestBytes, schema: value.schema,
      expected: { ...value.identity, ...hostileDigests, mode: "provisional", releaseTag: null },
    });
    await expect(extractDocsBundle({ ...extractionInput(value, destination), archive: hostileArchive, trust: hostileTrust })).rejects.toThrow(/gzip|agreement/i);
    expect((await resolveActiveDocsBundle(destination)).treeDigest).toBe(old.treeDigest);
  });

  it.each<ExtractionPhase>([
    "verified", "lock-acquired", "before-entry-write", "after-entry-write", "before-tree-publish", "after-tree-publish",
    "before-pointer-write", "after-pointer-write", "before-pointer-commit",
  ])("keeps the old pointer active when %s fails before commit", async (phase) => {
    const root = temporaryRoot();
    const destination = join(root, "active");
    const old = await extractDocsBundle(extractionInput(syntheticFixture({ marker: "old" }), destination));
    await expect(extractDocsBundle({
      ...extractionInput(syntheticFixture({ marker: "new" }), destination),
      onPhase(current) { if (current === phase) throw new Error("injected failure"); },
    })).rejects.toThrow(/injected failure/);
    expect((await resolveActiveDocsBundle(destination)).treeDigest).toBe(old.treeDigest);
  });

  it("leaves the new tree active when observation fails after pointer commit", async () => {
    const destination = join(temporaryRoot(), "active");
    await extractDocsBundle(extractionInput(syntheticFixture({ marker: "old" }), destination));
    const next = syntheticFixture({ marker: "new" });
    await expect(extractDocsBundle({ ...extractionInput(next, destination), onPhase(phase) {
      if (phase === "after-pointer-commit") throw new Error("post-commit failure");
    } })).rejects.toThrow(/post-commit/i);
    expect((await resolveActiveDocsBundle(destination)).treeDigest).toBe((await extractDocsBundle(extractionInput(next, destination))).treeDigest);
  });

  it("serializes concurrent promotions and fails closed on stale locks", async () => {
    const destination = join(temporaryRoot(), "active");
    let release!: () => void;
    const blocked = new Promise<void>((resolve) => { release = resolve; });
    let acquired!: () => void;
    const ready = new Promise<void>((resolve) => { acquired = resolve; });
    const first = extractDocsBundle({ ...extractionInput(syntheticFixture({ marker: "one" }), destination), async onPhase(phase) {
      if (phase === "lock-acquired") { acquired(); await blocked; }
    } });
    await ready;
    await expect(extractDocsBundle(extractionInput(syntheticFixture({ marker: "two" }), destination))).rejects.toThrow(/lock already exists/i);
    release();
    await first;
    writeFileSync(`${destination}.lock`, "stale\n");
    await expect(extractDocsBundle(extractionInput(syntheticFixture({ marker: "three" }), destination))).rejects.toThrow(/lock already exists/i);
  });

  it("rejects pointer, tree, and parent symlinks", async () => {
    const root = temporaryRoot();
    const value = syntheticFixture();
    const target = join(root, "target");
    writeFileSync(target, "target\n");
    const pointer = join(root, "pointer");
    symlinkSync(target, pointer);
    await expect(extractDocsBundle(extractionInput(value, pointer))).rejects.toThrow(/regular file/i);
    const real = join(root, "real"); mkdirSync(real);
    const linked = join(root, "linked"); symlinkSync(real, linked, "dir");
    await expect(extractDocsBundle(extractionInput(value, join(linked, "active")))).rejects.toThrow(/directory component/i);
    const treePointer = join(root, "tree-pointer");
    symlinkSync(real, `${treePointer}.trees`, "dir");
    await expect(extractDocsBundle(extractionInput(value, treePointer))).rejects.toThrow(/directory component/i);
  });

  it("reuses a verified same-digest tree and rejects a tampered one", async () => {
    const destination = join(temporaryRoot(), "active");
    const value = syntheticFixture();
    const first = await extractDocsBundle(extractionInput(value, destination));
    expect((await extractDocsBundle(extractionInput(value, destination))).reused).toBe(true);
    const file = join(first.activeTree, "release-notes.md");
    chmodSync(file, 0o600); writeFileSync(file, "tampered\n");
    await expect(extractDocsBundle(extractionInput(value, destination))).rejects.toThrow(/tree digest drift/i);
  });

  it("preserves the old pointer when a child terminates immediately before commit", async () => {
    const root = temporaryRoot();
    const destination = join(root, "active");
    const fixtureRoot = new URL("../fixtures/phase-2-provisional/", import.meta.url);
    const old = await extractDocsBundle(extractionInput(syntheticFixture({ marker: "old" }), destination));
    const script = join(root, "terminate.ts");
    const source = new URL("./index.ts", import.meta.url).pathname;
    writeFileSync(script, [
      `import { readFileSync } from "node:fs";`,
      `import { extractDocsBundle, verifyLocalProvisionalTrust } from ${JSON.stringify(source)};`,
      `const root = ${JSON.stringify(fixtureRoot.pathname)};`,
      `const read = (name: string) => readFileSync(root + name);`,
      `const archive=read("docs-bundle.tar.gz"), checksums=read("checksums.txt"), manifest=read("docs-bundle.manifest.json"), schema=read("docs-bundle-manifest-v1.schema.json");`,
      `const value=JSON.parse(manifest.toString()); const d=(b: Uint8Array)=>"sha256:"+new Bun.CryptoHasher("sha256").update(b).digest("hex");`,
      `const trust=verifyLocalProvisionalTrust({archive,checksums,manifest,schema,expected:{mode:"provisional",version:value.version,releaseTag:null,sourceSha:value.sourceSha,generatorSha:value.generatorSha,schemaDigest:d(schema),archiveDigest:d(archive),checksumsDigest:d(checksums),manifestDigest:d(manifest)}});`,
      `await extractDocsBundle({archive,checksums,manifest,schema,destination:${JSON.stringify(destination)},trust,onPhase(phase){if(phase==="before-pointer-commit")process.kill(process.pid,"SIGKILL")}});`,
    ].join("\n"));
    const child = spawnSync("bun", [script], { encoding: "utf8" });
    expect(child.signal).toBe("SIGKILL");
    expect((await resolveActiveDocsBundle(destination)).treeDigest).toBe(old.treeDigest);
    expect(lstatSync(`${destination}.lock`).isFile()).toBe(true);
  });
});
