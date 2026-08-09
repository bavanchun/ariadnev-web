import { createHash } from "node:crypto";
import { inflateRawSync } from "node:zlib";
import { resolveArchivePolicy } from "./archive-policy.js";
import type { ArchiveEntry, ArchivePolicy, InspectedArchive, Sha256Digest } from "./docs-bundle-types.js";

const SAFE_PATH = /^[A-Za-z0-9._/-]+$/;
const NESTED_ARCHIVE = /(?:^|\/)[^/]+\.(?:7z|bz2|gz|rar|tar|tgz|xz|zip)$/i;

function unsafePath(): never {
  throw new Error("archive path violates the trusted path policy");
}

export function normalizeArchivePath(raw: string): string {
  if (typeof raw !== "string" || raw.length === 0 || raw !== raw.normalize("NFC")) unsafePath();
  if (raw.includes("\\") || raw.includes("%") || /[\u0000-\u001f\u007f]/.test(raw)) unsafePath();
  if (raw.startsWith("/") || /^[A-Za-z]:/.test(raw) || raw.endsWith("/") || raw.includes("//")) unsafePath();
  if (!SAFE_PATH.test(raw)) unsafePath();
  const parts = raw.split("/");
  if (parts.some((part) => part.length === 0 || part === "." || part === ".." || /[. ]$/.test(part))) unsafePath();
  return raw;
}

export function enforceArchivePathPolicy(raw: string, policy: ArchivePolicy): string {
  const path = normalizeArchivePath(raw);
  if (Buffer.byteLength(path, "utf8") > policy.maxPathBytes || path.split("/").length > policy.maxPathDepth) unsafePath();
  if (NESTED_ARCHIVE.test(path)) throw new Error("nested archive members are forbidden");
  return path;
}

function sha256(content: Uint8Array): Sha256Digest {
  return `sha256:${createHash("sha256").update(content).digest("hex")}`;
}

function parseOctal(header: Buffer, start: number, length: number): number {
  const field = header.subarray(start, start + length);
  const raw = field.toString("ascii");
  if (/[^0-7\0 ]/.test(raw)) throw new Error("malformed tar numeric field");
  const zero = field.indexOf(0);
  if (zero !== -1 && !field.subarray(zero + 1).every((byte) => byte === 0 || byte === 0x20)) throw new Error("malformed tar numeric field");
  const trimmed = raw.replace(/\0.*$/, "").trim();
  if (trimmed.includes(" ")) throw new Error("malformed tar numeric field");
  const value = trimmed === "" ? 0 : Number.parseInt(trimmed, 8);
  if (!Number.isSafeInteger(value) || value < 0) throw new Error("malformed tar numeric field");
  return value;
}

function textField(header: Buffer, start: number, length: number): string {
  const field = header.subarray(start, start + length);
  const zero = field.indexOf(0);
  if (zero !== -1 && !field.subarray(zero).every((byte) => byte === 0)) throw new Error("malformed tar text field");
  const bytes = field.subarray(0, zero === -1 ? field.length : zero);
  const text = bytes.toString("utf8");
  if (!Buffer.from(text, "utf8").equals(bytes)) throw new Error("malformed tar UTF-8 field");
  return text;
}

function validateHeaderChecksum(header: Buffer): void {
  const expected = parseOctal(header, 148, 8);
  const copy = Buffer.from(header);
  copy.fill(0x20, 148, 156);
  const actual = copy.reduce((sum, byte) => sum + byte, 0);
  if (actual !== expected) throw new Error("invalid tar header checksum");
}

function isZeroBlock(block: Buffer): boolean {
  return block.every((byte) => byte === 0);
}

const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) value = (value & 1) !== 0 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});

function crc32(content: Uint8Array): number {
  let crc = 0xffff_ffff;
  for (const byte of content) crc = (CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8)) >>> 0;
  return (crc ^ 0xffff_ffff) >>> 0;
}

function decompressSingleCanonicalGzip(archive: Buffer, policy: ArchivePolicy): { tar: Buffer; mtime: number } {
  if (archive.byteLength > policy.maxCompressedBytes) throw new Error("archive exceeds compressed byte limit");
  if (archive.byteLength < 18 || archive[0] !== 0x1f || archive[1] !== 0x8b || archive[2] !== 8 || archive[3] !== 0) {
    throw new Error("archive must use one canonical gzip member");
  }
  if (archive[8] !== 2 || archive[9] !== 255) throw new Error("archive must use canonical gzip metadata");
  let inflated: { buffer: Buffer; engine: { bytesWritten: number } };
  try {
    inflated = inflateRawSync(archive.subarray(10), { info: true, maxOutputLength: policy.maxExpandedBytes }) as unknown as typeof inflated;
  } catch {
    throw new Error("invalid or truncated gzip stream");
  }
  const deflateBytes = inflated.engine.bytesWritten;
  const trailerOffset = 10 + deflateBytes;
  if (!Number.isSafeInteger(deflateBytes) || deflateBytes <= 0 || trailerOffset + 8 !== archive.byteLength) {
    throw new Error("gzip contains multiple members or trailing data");
  }
  if (archive.readUInt32LE(trailerOffset) !== crc32(inflated.buffer)) throw new Error("invalid gzip checksum");
  if (archive.readUInt32LE(trailerOffset + 4) !== (inflated.buffer.byteLength >>> 0)) throw new Error("invalid gzip size trailer");
  const ratio = inflated.buffer.byteLength / archive.byteLength;
  if (ratio > policy.maxCompressionRatio) throw new Error("archive exceeds compression ratio limit");
  return { tar: inflated.buffer, mtime: archive.readUInt32LE(4) };
}

export function inspectArchive(input: Uint8Array, policyInput: Partial<ArchivePolicy> = {}): InspectedArchive {
  const policy = resolveArchivePolicy(policyInput);
  const archive = Buffer.from(input);
  const { tar, mtime: gzipMtime } = decompressSingleCanonicalGzip(archive, policy);
  const entries: ArchiveEntry[] = [];
  const seen = new Set<string>();
  const caseFolded = new Set<string>();
  let offset = 0;
  let totalBytes = 0;
  let payloadBytes = 0;
  let payloadFiles = 0;
  let manifestFiles = 0;
  let previousPath: string | undefined;
  while (offset < tar.byteLength) {
    if (offset + 512 > tar.byteLength) throw new Error("truncated tar header");
    const header = tar.subarray(offset, offset + 512);
    if (isZeroBlock(header)) {
      if (offset + 1024 > tar.byteLength || !isZeroBlock(tar.subarray(offset + 512, offset + 1024))) throw new Error("truncated tar terminator");
      if (offset + 1024 !== tar.byteLength) throw new Error("trailing data after tar terminator");
      if (entries.length === 0) throw new Error("archive has no entries");
      return Object.freeze({
        entries: Object.freeze(entries),
        compressedBytes: archive.byteLength,
        uncompressedBytes: totalBytes,
        expandedBytes: tar.byteLength,
        compressionRatio: tar.byteLength / archive.byteLength,
        mtime: gzipMtime,
      });
    }
    validateHeaderChecksum(header);
    if (String.fromCharCode(header[156] ?? 0) !== "0") throw new Error("unsupported archive entry type");
    if (parseOctal(header, 100, 8) !== 0o644 || parseOctal(header, 108, 8) !== 0 || parseOctal(header, 116, 8) !== 0) {
      throw new Error("unsafe archive ownership or mode metadata");
    }
    const entryMtime = parseOctal(header, 136, 12);
    if (entryMtime !== gzipMtime) throw new Error("archive timestamp drift");
    if (textField(header, 257, 6) !== "ustar" || textField(header, 263, 2) !== "00") throw new Error("archive must use canonical ustar headers");
    if (textField(header, 265, 32) !== "root" || textField(header, 297, 32) !== "root") throw new Error("archive must use canonical owner metadata");
    if (textField(header, 157, 100) !== "" || parseOctal(header, 329, 8) !== 0 || parseOctal(header, 337, 8) !== 0) {
      throw new Error("archive link or device metadata is forbidden");
    }
    if (header[344] !== 0 || !header.subarray(500).every((byte) => byte === 0)) throw new Error("unsupported tar header extension data");
    const name = textField(header, 0, 100);
    const prefix = textField(header, 345, 155);
    const path = enforceArchivePathPolicy(prefix ? `${prefix}/${name}` : name, policy);
    const folded = path.toLowerCase();
    if (seen.has(path) || caseFolded.has(folded)) throw new Error("archive paths collide");
    if (previousPath !== undefined && previousPath.localeCompare(path) >= 0) throw new Error("archive entries are not canonically sorted");
    seen.add(path);
    caseFolded.add(folded);
    previousPath = path;
    const size = parseOctal(header, 124, 12);
    const isManifest = path === "manifest.json";
    if (size > (isManifest ? policy.maxManifestBytes : policy.maxBytesPerFile)) {
      throw new Error(isManifest ? "archive manifest exceeds byte limit" : "archive entry exceeds per-file byte limit");
    }
    totalBytes += size;
    if (isManifest) manifestFiles += 1;
    else {
      payloadFiles += 1;
      payloadBytes += size;
    }
    if (payloadBytes > policy.maxTotalBytes) throw new Error("archive exceeds total byte limit");
    if (manifestFiles > 1 || payloadFiles > policy.maxFiles) throw new Error("archive exceeds file-count limit");
    const start = offset + 512;
    const end = start + size;
    if (end > tar.byteLength) throw new Error("truncated tar entry");
    const nextOffset = start + Math.ceil(size / 512) * 512;
    if (nextOffset > tar.byteLength || !tar.subarray(end, nextOffset).every((byte) => byte === 0)) throw new Error("invalid tar entry padding");
    const content = Buffer.from(tar.subarray(start, end));
    entries.push(Object.freeze({ path, bytes: size, digest: sha256(content), content }));
    offset = nextOffset;
  }
  throw new Error("missing tar terminator");
}
