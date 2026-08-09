import type { ArchivePolicy } from "./docs-bundle-types.js";

const KIB = 1024;
const PRODUCER_FILES = 128;
const PRODUCER_PAYLOAD_BYTES = 4 * 1024 * KIB;
const MANIFEST_HEADROOM = 512 * KIB;
const ARCHIVE_FILES = PRODUCER_FILES + 1;
const TAR_HEADROOM = ARCHIVE_FILES * KIB + KIB;
const EXPANDED_HEADROOM = PRODUCER_PAYLOAD_BYTES + MANIFEST_HEADROOM + TAR_HEADROOM;
const GZIP_FRAMING_HEADROOM = 4096;

export const DEFAULT_ARCHIVE_POLICY: ArchivePolicy = Object.freeze({
  maxFiles: PRODUCER_FILES,
  maxBytesPerFile: 512 * KIB,
  maxTotalBytes: PRODUCER_PAYLOAD_BYTES,
  maxManifestBytes: MANIFEST_HEADROOM,
  maxExpandedBytes: EXPANDED_HEADROOM,
  maxCompressedBytes: EXPANDED_HEADROOM + GZIP_FRAMING_HEADROOM,
  maxPathBytes: 255,
  maxPathDepth: 16,
  maxCompressionRatio: 200,
});

const HARD_POLICY: ArchivePolicy = Object.freeze({
  ...DEFAULT_ARCHIVE_POLICY,
  maxPathDepth: 32,
  maxCompressionRatio: 1_000,
});

export function resolveArchivePolicy(input: Partial<ArchivePolicy> = {}): ArchivePolicy {
  const policy: ArchivePolicy = { ...DEFAULT_ARCHIVE_POLICY, ...input };
  for (const key of Object.keys(policy) as Array<keyof ArchivePolicy>) {
    const value = policy[key];
    if (!Number.isSafeInteger(value) || value <= 0 || value > HARD_POLICY[key]) {
      throw new Error(`invalid archive policy: ${key}`);
    }
  }
  if (policy.maxBytesPerFile > policy.maxTotalBytes) throw new Error("invalid archive policy relationship");
  const minimumExpanded = policy.maxTotalBytes + policy.maxManifestBytes + (policy.maxFiles + 1) * KIB + KIB;
  if (policy.maxExpandedBytes < minimumExpanded || policy.maxCompressedBytes > policy.maxExpandedBytes + GZIP_FRAMING_HEADROOM) {
    throw new Error("invalid archive overhead policy relationship");
  }
  return Object.freeze(policy);
}
