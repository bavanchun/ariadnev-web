// Verify-first, atomic extractor for the untrusted docs bundle.
//
// Order matters and is not negotiable:
//   1. bound the compressed input
//   2. gunzip with a hard output ceiling
//   3. parse tar headers only — nothing is written yet
//   4. validate the manifest against the consumer-owned trusted schema
//   5. prove one-to-one membership, sizes, and digests
//   6. write into a fresh temp directory on the destination filesystem
//   7. atomically swap
//
// Any failure at any step leaves an existing destination byte-for-byte
// unchanged, because nothing outside the temp directory is touched until the
// final rename.

import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { mkdirSync, mkdtempSync, opendirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";

import {
  DEFAULT_ARCHIVE_POLICY,
  type ArchivePolicy,
  assertWithin,
  normalizeArchivePath,
  reject,
} from "./archive-policy.js";
import {
  type DocsBundleManifest,
  type ExpectedIdentity,
  parseDocsBundleManifest,
} from "./docs-bundle-manifest.js";

const BLOCK_SIZE = 512;
const MANIFEST_MEMBER = "manifest.json";
const SCHEMA_MEMBER = "docs-bundle-manifest-v1.schema.json";

/** One tar member, held in memory only after it passed the bounds check. */
export interface ArchiveEntry {
  readonly path: string;
  readonly bytes: number;
  readonly content: Buffer;
}

function readOctal(block: Buffer, offset: number, length: number): number {
  // Tar numeric fields are NUL/space-terminated octal. GNU base-256 encoding
  // sets the high bit; it is rejected rather than decoded, because this
  // producer never emits it and supporting it widens the parser for no gain.
  const first = block[offset];
  if (first !== undefined && (first & 0x80) !== 0) reject("unsupported-extension-header", "base-256-numeric");
  const raw = block.subarray(offset, offset + length).toString("ascii").replace(/\0.*$/, "").trim();
  if (raw === "") return 0;
  if (!/^[0-7]+$/.test(raw)) reject("truncated-archive", "numeric-field");
  return Number.parseInt(raw, 8);
}

function verifyHeaderChecksum(block: Buffer): void {
  const declared = readOctal(block, 148, 8);
  let unsigned = 0;
  for (let index = 0; index < BLOCK_SIZE; index += 1) {
    // The checksum field itself is treated as spaces during computation.
    const byte = index >= 148 && index < 156 ? 0x20 : (block[index] ?? 0);
    unsigned += byte;
  }
  if (unsigned !== declared) reject("bad-header-checksum");
}

/**
 * Read tar member metadata and contents without writing anything to disk.
 * Only plain regular files are accepted; every other member type is rejected.
 */
export function inspectArchive(tar: Buffer, policy: ArchivePolicy = DEFAULT_ARCHIVE_POLICY): ArchiveEntry[] {
  const entries: ArchiveEntry[] = [];
  const seen = new Set<string>();
  let offset = 0;
  let totalBytes = 0;

  while (offset + BLOCK_SIZE <= tar.length) {
    const header = tar.subarray(offset, offset + BLOCK_SIZE);
    // Two consecutive zero blocks terminate the archive.
    if (header.every((byte) => byte === 0)) break;

    verifyHeaderChecksum(header);

    const magic = header.subarray(257, 262).toString("ascii");
    if (magic !== "ustar") reject("unsupported-extension-header", "non-ustar");

    const typeflag = String.fromCharCode(header[156] ?? 0);
    // '0' and NUL are regular files. Directories, links, devices, FIFOs, PAX
    // and GNU long-name extensions are all rejected: the producer emits a flat
    // set of regular files and nothing else is representable in the manifest.
    if (typeflag !== "0" && typeflag !== "\0") {
      const code = typeflag === "x" || typeflag === "g" || typeflag === "L" || typeflag === "K"
        ? "unsupported-extension-header"
        : "unsupported-member-type";
      reject(code, `typeflag:${typeflag === "\0" ? "NUL" : typeflag}`);
    }

    // A `prefix` field would let one logical path arrive in two pieces, so it
    // must be empty and the whole name must live in `name`.
    if ((header[345] ?? 0) !== 0) reject("unsupported-extension-header", "prefix-field");

    const rawName = header.subarray(0, 100).toString("utf8").replace(/\0.*$/, "");
    const path = normalizeArchivePath(rawName, policy);
    if (seen.has(path)) reject("path-duplicate", path);
    seen.add(path);

    const size = readOctal(header, 124, 12);
    assertWithin(size, policy.maxEntryBytes, "entry-too-large", path);
    totalBytes += size;
    assertWithin(totalBytes, policy.maxTotalBytes, "total-too-large");
    if (entries.length + 1 > policy.maxEntries) reject("too-many-entries");

    const start = offset + BLOCK_SIZE;
    const end = start + size;
    if (end > tar.length) reject("truncated-archive", path);

    entries.push({ path, bytes: size, content: tar.subarray(start, end) });
    // Member payloads are padded up to the next block boundary.
    offset = start + Math.ceil(size / BLOCK_SIZE) * BLOCK_SIZE;
  }

  if (entries.length === 0) reject("truncated-archive", "no-members");
  return entries;
}

/** Decompress with a hard ceiling so a compression bomb cannot exhaust memory. */
export function inflateArchive(archive: Buffer, policy: ArchivePolicy = DEFAULT_ARCHIVE_POLICY): Buffer {
  assertWithin(archive.byteLength, policy.maxCompressedBytes, "compressed-too-large");
  let tar: Buffer;
  try {
    tar = gunzipSync(archive, { maxOutputLength: policy.maxTotalBytes + BLOCK_SIZE * 2 });
  } catch {
    // zlib reports the ceiling breach and malformed input the same way; both
    // mean the archive is unusable.
    reject("expansion-ratio-exceeded", "gunzip");
  }
  if (archive.byteLength > 0 && tar.byteLength / archive.byteLength > policy.maxExpansionRatio) {
    reject("expansion-ratio-exceeded", `${tar.byteLength}:${archive.byteLength}`);
  }
  return tar;
}

function sha256(content: Buffer): string {
  return `sha256:${createHash("sha256").update(content).digest("hex")}`;
}

/**
 * Prove the archive body and the manifest describe exactly the same file set,
 * with matching sizes and digests. Membership is one-to-one in both directions.
 */
export function verifyArchiveEntries(
  entries: readonly ArchiveEntry[],
  manifest: DocsBundleManifest,
  policy: ArchivePolicy = DEFAULT_ARCHIVE_POLICY,
): Map<string, Buffer> {
  const payloadEntries = entries.filter((entry) => entry.path !== MANIFEST_MEMBER && entry.path !== SCHEMA_MEMBER);
  if (payloadEntries.length !== manifest.payload.length) {
    reject("manifest-membership-mismatch", `${payloadEntries.length}!=${manifest.payload.length}`);
  }

  const byPath = new Map(payloadEntries.map((entry) => [entry.path, entry]));
  const verified = new Map<string, Buffer>();
  let totalBytes = 0;

  for (const declared of manifest.payload) {
    const actual = byPath.get(declared.path);
    if (actual === undefined) reject("manifest-membership-mismatch", `missing:${declared.path}`);
    if (actual.bytes !== declared.bytes) reject("manifest-membership-mismatch", `bytes:${declared.path}`);
    if (sha256(actual.content) !== declared.digest) reject("digest-mismatch", declared.path);
    totalBytes += actual.bytes;
    verified.set(declared.path, actual.content);
    byPath.delete(declared.path);
  }

  // Anything still present was in the archive but not the manifest.
  const [unexpected] = byPath.keys();
  if (unexpected !== undefined) reject("manifest-membership-mismatch", `unexpected:${unexpected}`);

  assertWithin(totalBytes, policy.maxTotalBytes, "total-too-large");
  if (totalBytes !== manifest.totalBytes) reject("manifest-membership-mismatch", "totalBytes");
  return verified;
}

export interface ExtractOptions {
  readonly archive: Buffer;
  readonly destination: string;
  readonly expected?: ExpectedIdentity;
  readonly policy?: ArchivePolicy;
  /**
   * Trusted schema digest supplied by the caller. When the archive ships its
   * own schema member, it must match this value exactly; the archive copy is
   * compared against the anchor, never trusted in its place.
   */
  readonly trustedSchemaDigest?: string;
}

export interface ExtractResult {
  readonly manifest: DocsBundleManifest;
  readonly destination: string;
  readonly fileCount: number;
  readonly totalBytes: number;
}

/**
 * Verify an untrusted docs bundle end to end and atomically install it.
 *
 * On success `destination` holds exactly the manifest's payload. On any
 * failure an existing `destination` is left untouched and no partial tree
 * remains.
 */
export function extractDocsBundle(options: ExtractOptions): ExtractResult {
  const policy = options.policy ?? DEFAULT_ARCHIVE_POLICY;
  const destination = resolve(options.destination);

  const tar = inflateArchive(options.archive, policy);
  const entries = inspectArchive(tar, policy);

  const manifestEntry = entries.find((entry) => entry.path === MANIFEST_MEMBER);
  if (manifestEntry === undefined) reject("manifest-membership-mismatch", `missing:${MANIFEST_MEMBER}`);

  // The archive's own schema copy is evidence, not authority: it only has to
  // agree with the digest the consumer already trusts.
  const schemaEntry = entries.find((entry) => entry.path === SCHEMA_MEMBER);
  if (schemaEntry !== undefined && options.trustedSchemaDigest !== undefined) {
    if (sha256(schemaEntry.content) !== options.trustedSchemaDigest) reject("schema-drift", SCHEMA_MEMBER);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(manifestEntry.content.toString("utf8"));
  } catch {
    reject("manifest-invalid", "json");
  }
  const manifest = parseDocsBundleManifest(parsed, options.expected ?? {}, policy);
  const verified = verifyArchiveEntries(entries, manifest, policy);

  // The staging directory is a sibling of the destination so the final rename
  // stays on one filesystem and is therefore atomic.
  const parent = dirname(destination);
  mkdirSync(parent, { recursive: true });
  const staging = mkdtempSync(join(parent, ".docs-bundle-staging-"));
  const previous = `${destination}.previous-${process.pid}-${Date.now()}`;
  let installed = false;

  try {
    for (const [path, content] of verified) {
      const target = join(staging, path);
      // Defence in depth: even though the path already passed the allowlist,
      // the resolved target must still be inside the staging directory.
      if (target !== staging && !target.startsWith(staging + sep)) reject("path-traversal", path);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, content, { mode: 0o644, flag: "wx" });
    }

    let hadPrevious = false;
    try {
      opendirSync(destination).closeSync();
      hadPrevious = true;
    } catch {
      hadPrevious = false;
    }

    // Move the old tree aside first so the swap-in is a single rename onto a
    // free path, then discard the old tree only once the new one is in place.
    if (hadPrevious) renameSync(destination, previous);
    try {
      renameSync(staging, destination);
      installed = true;
    } catch (error) {
      if (hadPrevious) renameSync(previous, destination);
      throw error;
    }
    if (hadPrevious) rmSync(previous, { recursive: true, force: true });
  } finally {
    if (!installed) rmSync(staging, { recursive: true, force: true });
  }

  return {
    manifest,
    destination,
    fileCount: manifest.fileCount,
    totalBytes: manifest.totalBytes,
  };
}
