// Central policy for every untrusted docs-bundle archive.
//
// Bounds mirror the trusted v1 manifest schema so an archive can never describe
// more than the schema permits. Everything here is a hard rejection, never a
// warning: an archive that violates any bound is not extracted at all.

/** Limits applied before and during archive inspection. */
export interface ArchivePolicy {
  /** Maximum bytes of the compressed archive as received. */
  readonly maxCompressedBytes: number;
  /** Maximum total uncompressed bytes across all members. */
  readonly maxTotalBytes: number;
  /** Maximum uncompressed bytes for one member. */
  readonly maxEntryBytes: number;
  /** Maximum number of members. */
  readonly maxEntries: number;
  /** Maximum uncompressed:compressed expansion, that is, the zip-bomb ceiling. */
  readonly maxExpansionRatio: number;
  /** Maximum length of a normalized member path. */
  readonly maxPathLength: number;
  /** Maximum path segment count, bounding deeply nested trees. */
  readonly maxPathDepth: number;
}

/**
 * Default policy. `maxTotalBytes`, `maxEntryBytes`, and `maxEntries` are the
 * exact ceilings from docs-bundle manifest v1; a stricter consumer may lower
 * them but must never raise them above the schema.
 */
export const DEFAULT_ARCHIVE_POLICY: ArchivePolicy = Object.freeze({
  maxCompressedBytes: 4 * 1024 * 1024,
  maxTotalBytes: 4 * 1024 * 1024,
  maxEntryBytes: 512 * 1024,
  maxEntries: 128,
  maxExpansionRatio: 100,
  maxPathLength: 255,
  maxPathDepth: 12,
});

export type ArchiveRejectionCode =
  | "compressed-too-large"
  | "total-too-large"
  | "entry-too-large"
  | "too-many-entries"
  | "expansion-ratio-exceeded"
  | "truncated-archive"
  | "unsupported-member-type"
  | "unsupported-extension-header"
  | "bad-header-checksum"
  | "path-absolute"
  | "path-traversal"
  | "path-empty"
  | "path-too-long"
  | "path-too-deep"
  | "path-backslash"
  | "path-control-character"
  | "path-encoded-ambiguity"
  | "path-confusable"
  | "path-not-normalized"
  | "path-duplicate"
  | "manifest-membership-mismatch"
  | "digest-mismatch"
  | "schema-drift"
  | "release-identity-mismatch"
  | "manifest-invalid";

/** A rejection carries a stable machine code; messages are never user-supplied. */
export class ArchiveRejection extends Error {
  readonly code: ArchiveRejectionCode;
  readonly subject: string | undefined;

  constructor(code: ArchiveRejectionCode, subject?: string) {
    super(subject === undefined ? `archive rejected: ${code}` : `archive rejected: ${code} (${subject})`);
    this.name = "ArchiveRejection";
    this.code = code;
    this.subject = subject;
  }
}

export function reject(code: ArchiveRejectionCode, subject?: string): never {
  throw new ArchiveRejection(code, subject);
}

// A conservative allowlist. Anything outside it is rejected rather than
// sanitized, so there is no normalization step an attacker can aim at.
const SAFE_PATH = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;
// Characters that render like ASCII path punctuation but are not: fullwidth
// solidus, division slash, fraction slash, and the Unicode dot leaders.
const CONFUSABLE_CHARACTERS = /[／∕⁄․‥…．]/;

/**
 * Normalize and validate one archive member path.
 *
 * This never repairs a path. It either returns the input unchanged because it
 * was already in canonical form, or it rejects.
 */
export function normalizeArchivePath(raw: string, policy: ArchivePolicy = DEFAULT_ARCHIVE_POLICY): string {
  if (typeof raw !== "string" || raw.length === 0) reject("path-empty", String(raw));
  if (raw.length > policy.maxPathLength) reject("path-too-long", raw);
  if (CONTROL_CHARACTERS.test(raw)) reject("path-control-character", JSON.stringify(raw));
  if (raw.includes("\\")) reject("path-backslash", raw);
  if (CONFUSABLE_CHARACTERS.test(raw)) reject("path-confusable", JSON.stringify(raw));
  // Percent-encoding has no meaning inside a tar member name, so its presence
  // is an attempt to survive a later decode step somewhere downstream.
  if (/%[0-9a-fA-F]{2}/.test(raw)) reject("path-encoded-ambiguity", raw);
  if (raw.startsWith("/")) reject("path-absolute", raw);
  // A Windows drive prefix is absolute on the consuming platform even though it
  // does not start with a separator.
  if (/^[A-Za-z]:/.test(raw)) reject("path-absolute", raw);

  const segments = raw.split("/");
  if (segments.length > policy.maxPathDepth) reject("path-too-deep", raw);
  for (const segment of segments) {
    if (segment === "") reject("path-not-normalized", raw);
    if (segment === "." || segment === "..") reject("path-traversal", raw);
  }
  if (raw.endsWith("/")) reject("path-not-normalized", raw);
  if (!SAFE_PATH.test(raw)) reject("path-not-normalized", raw);

  // Unicode normalization must be a no-op; otherwise two distinct archive
  // members could collapse onto one filesystem path after extraction.
  if (raw.normalize("NFC") !== raw) reject("path-confusable", raw);
  return raw;
}

/** Assert an aggregate bound, rejecting with the matching code. */
export function assertWithin(value: number, limit: number, code: ArchiveRejectionCode, subject?: string): void {
  if (!Number.isSafeInteger(value) || value < 0 || value > limit) reject(code, subject);
}
