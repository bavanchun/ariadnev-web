import { inflateRawSync } from "node:zlib";

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;
const DATA_DESCRIPTOR_SIGNATURE = 0x08074b50;
const MAX_ENTRIES = 32;
const MAX_EXPANDED_BYTES = 512 * 1024 * 1024;
const MAX_ATTESTATION_BYTES = 512 * 1024;
const SIMPLE_NAME = /^[A-Za-z0-9][A-Za-z0-9._@+-]*$/;

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

function readName(archive: Buffer, start: number, length: number): string {
  const bytes = archive.subarray(start, start + length);
  const name = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  if (!SIMPLE_NAME.test(name) || Buffer.byteLength(name, "utf8") !== bytes.byteLength) throw new Error("candidate ZIP contains an unsafe name");
  return name;
}

function findEndRecord(archive: Buffer): number {
  const minimum = Math.max(0, archive.byteLength - 65_557);
  for (let offset = archive.byteLength - 22; offset >= minimum; offset -= 1) {
    if (archive.readUInt32LE(offset) === EOCD_SIGNATURE) return offset;
  }
  throw new Error("candidate ZIP end record is missing");
}

function readDataDescriptor(
  archive: Buffer,
  start: number,
  limit: number,
  expected: Readonly<{ crc: number; compressedBytes: number; uncompressedBytes: number }>,
): number {
  if (start + 12 > limit) throw new Error("candidate ZIP data descriptor is truncated");
  const signed = archive.readUInt32LE(start) === DATA_DESCRIPTOR_SIGNATURE;
  const valuesStart = start + (signed ? 4 : 0);
  const end = valuesStart + 12;
  if (end > limit) throw new Error("candidate ZIP data descriptor is truncated");
  if (archive.readUInt32LE(valuesStart) !== expected.crc
    || archive.readUInt32LE(valuesStart + 4) !== expected.compressedBytes
    || archive.readUInt32LE(valuesStart + 8) !== expected.uncompressedBytes) {
    throw new Error("candidate ZIP data descriptor metadata drift");
  }
  return end;
}

export function readCandidateZip(input: Uint8Array): ReadonlyMap<string, Buffer> {
  const archive = Buffer.from(input);
  if (archive.byteLength < 22 || archive.byteLength > MAX_EXPANDED_BYTES) throw new Error("candidate ZIP violates byte bounds");
  const eocd = findEndRecord(archive);
  const disk = archive.readUInt16LE(eocd + 4);
  const centralDisk = archive.readUInt16LE(eocd + 6);
  const diskEntries = archive.readUInt16LE(eocd + 8);
  const entries = archive.readUInt16LE(eocd + 10);
  const centralBytes = archive.readUInt32LE(eocd + 12);
  const centralOffset = archive.readUInt32LE(eocd + 16);
  const commentBytes = archive.readUInt16LE(eocd + 20);
  if (disk !== 0 || centralDisk !== 0 || diskEntries !== entries || entries === 0 || entries > MAX_ENTRIES
    || commentBytes !== 0 || eocd + 22 !== archive.byteLength || centralOffset + centralBytes !== eocd) {
    throw new Error("candidate ZIP uses unsupported framing");
  }

  const result = new Map<string, Buffer>();
  const regions: Array<{ start: number; end: number }> = [];
  let expandedBytes = 0;
  let offset = centralOffset;
  for (let index = 0; index < entries; index += 1) {
    if (offset + 46 > eocd || archive.readUInt32LE(offset) !== CENTRAL_SIGNATURE) throw new Error("candidate ZIP central directory is malformed");
    const flags = archive.readUInt16LE(offset + 8);
    const method = archive.readUInt16LE(offset + 10);
    const expectedCrc = archive.readUInt32LE(offset + 16);
    const compressedBytes = archive.readUInt32LE(offset + 20);
    const uncompressedBytes = archive.readUInt32LE(offset + 24);
    const nameBytes = archive.readUInt16LE(offset + 28);
    const extraBytes = archive.readUInt16LE(offset + 30);
    const entryCommentBytes = archive.readUInt16LE(offset + 32);
    const startDisk = archive.readUInt16LE(offset + 34);
    const localOffset = archive.readUInt32LE(offset + 42);
    const centralEnd = offset + 46 + nameBytes + extraBytes + entryCommentBytes;
    if (centralEnd > eocd || startDisk !== 0 || extraBytes !== 0 || entryCommentBytes !== 0
      || compressedBytes === 0xffff_ffff || uncompressedBytes === 0xffff_ffff
      || localOffset === 0xffff_ffff || (flags & ~(0x0008 | 0x0800)) !== 0 || (method !== 0 && method !== 8)) {
      throw new Error("candidate ZIP entry uses unsupported features");
    }
    const name = readName(archive, offset + 46, nameBytes);
    if (result.has(name)) throw new Error("candidate ZIP contains duplicate names");
    if (localOffset + 30 > centralOffset || archive.readUInt32LE(localOffset) !== LOCAL_SIGNATURE) {
      throw new Error("candidate ZIP local header is malformed");
    }
    const localFlags = archive.readUInt16LE(localOffset + 6);
    const localMethod = archive.readUInt16LE(localOffset + 8);
    const localNameBytes = archive.readUInt16LE(localOffset + 26);
    const localExtraBytes = archive.readUInt16LE(localOffset + 28);
    const localName = readName(archive, localOffset + 30, localNameBytes);
    const dataStart = localOffset + 30 + localNameBytes + localExtraBytes;
    const dataEnd = dataStart + compressedBytes;
    if (localFlags !== flags || localMethod !== method || localName !== name || localExtraBytes !== 0 || dataEnd > centralOffset) {
      throw new Error("candidate ZIP local/central metadata drift");
    }
    const remainingExpandedBytes = MAX_EXPANDED_BYTES - expandedBytes;
    const entryExpandedLimit = name === "release-artifact-attestation.json"
      ? Math.min(remainingExpandedBytes, MAX_ATTESTATION_BYTES)
      : remainingExpandedBytes;
    if (uncompressedBytes > entryExpandedLimit) throw new Error("candidate ZIP expands beyond byte bounds");
    const localCrc = archive.readUInt32LE(localOffset + 14);
    const localCompressedBytes = archive.readUInt32LE(localOffset + 18);
    const localUncompressedBytes = archive.readUInt32LE(localOffset + 22);
    let regionEnd = dataEnd;
    if ((flags & 0x0008) === 0) {
      if (localCrc !== expectedCrc || localCompressedBytes !== compressedBytes || localUncompressedBytes !== uncompressedBytes) {
        throw new Error("candidate ZIP local size metadata drift");
      }
    } else {
      const localMetadataIsEmpty = localCrc === 0 && localCompressedBytes === 0 && localUncompressedBytes === 0;
      const localMetadataMatches = localCrc === expectedCrc
        && localCompressedBytes === compressedBytes
        && localUncompressedBytes === uncompressedBytes;
      if (!localMetadataIsEmpty && !localMetadataMatches) throw new Error("candidate ZIP local descriptor metadata drift");
      regionEnd = readDataDescriptor(archive, dataEnd, centralOffset, {
        crc: expectedCrc,
        compressedBytes,
        uncompressedBytes,
      });
    }
    let content: Buffer;
    try {
      if (method === 0) {
        content = Buffer.from(archive.subarray(dataStart, dataEnd));
      } else {
        const inflated = inflateRawSync(archive.subarray(dataStart, dataEnd), {
          info: true,
          maxOutputLength: uncompressedBytes,
        }) as unknown as { buffer: Buffer; engine: { bytesWritten: number } };
        if (inflated.engine.bytesWritten !== compressedBytes) throw new Error("compressed stream framing drift");
        content = Buffer.from(inflated.buffer);
      }
    } catch {
      throw new Error("candidate ZIP entry decompression failed");
    }
    if (content.byteLength !== uncompressedBytes || crc32(content) !== expectedCrc) throw new Error("candidate ZIP entry integrity drift");
    expandedBytes += content.byteLength;
    if (expandedBytes > MAX_EXPANDED_BYTES || (name === "release-artifact-attestation.json" && content.byteLength > MAX_ATTESTATION_BYTES)) {
      throw new Error("candidate ZIP expands beyond byte bounds");
    }
    regions.push({ start: localOffset, end: regionEnd });
    result.set(name, content);
    offset = centralEnd;
  }
  if (offset !== eocd) throw new Error("candidate ZIP central directory size drift");
  regions.sort((a, b) => a.start - b.start);
  if (regions[0]?.start !== 0) throw new Error("candidate ZIP local framing contains hidden bytes");
  for (let index = 1; index < regions.length; index += 1) {
    if (regions[index]!.start !== regions[index - 1]!.end) throw new Error("candidate ZIP local framing is not contiguous");
  }
  if (regions.at(-1)?.end !== centralOffset) throw new Error("candidate ZIP local framing does not reach the central directory");
  return result;
}
