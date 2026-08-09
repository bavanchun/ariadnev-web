import { createHash } from "node:crypto";
import { resolveArchivePolicy } from "./archive-policy.js";
import { enforceArchivePathPolicy } from "./archive-reader.js";
import { trustedDocsBundleSchema } from "./docs-bundle-manifest.js";
import {
  DOCS_BUNDLE_MANIFEST_MEMBER,
  DOCS_BUNDLE_SCHEMA_MEMBER,
  type ArchiveEntry,
  type ArchivePolicy,
  type DocsBundleManifestV1,
  type Sha256Digest,
} from "./docs-bundle-types.js";

function sha256(content: Uint8Array): Sha256Digest {
  return `sha256:${createHash("sha256").update(content).digest("hex")}`;
}

function stableJson(value: unknown): Buffer {
  return Buffer.from(`${JSON.stringify(value, (_key, candidate) => {
    if (Array.isArray(candidate) || !candidate || typeof candidate !== "object") return candidate;
    return Object.fromEntries(Object.entries(candidate as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)));
  }, 2)}\n`, "utf8");
}

export function verifyArchiveEntries(
  entries: readonly ArchiveEntry[],
  manifest: DocsBundleManifestV1,
  policyInput: Partial<ArchivePolicy> = {},
): readonly ArchiveEntry[] {
  const policy = resolveArchivePolicy(policyInput);
  if (manifest.payload.length > policy.maxFiles || entries.length !== manifest.payload.length + 1) {
    throw new Error("archive inventory count drift");
  }
  const expected = new Map(manifest.payload.map((entry) => [entry.path, entry]));
  const seen = new Set<string>();
  const folded = new Set<string>();
  let payloadBytes = 0;
  let manifestFound = false;
  let previousPath: string | undefined;
  for (const entry of entries) {
    const path = enforceArchivePathPolicy(entry.path, policy);
    const caseKey = path.toLowerCase();
    if (seen.has(path) || folded.has(caseKey)) throw new Error("archive inventory paths collide");
    if (previousPath !== undefined && previousPath.localeCompare(path) >= 0) throw new Error("archive inventory is not sorted");
    seen.add(path);
    folded.add(caseKey);
    previousPath = path;
    if (entry.bytes !== entry.content.byteLength || entry.digest !== sha256(entry.content)) throw new Error("archive entry metadata drift");
    if (path === DOCS_BUNDLE_MANIFEST_MEMBER) {
      if (entry.bytes > policy.maxManifestBytes) throw new Error("archive manifest exceeds byte limit");
      if (!entry.content.equals(stableJson(manifest))) throw new Error("archive manifest member drift");
      manifestFound = true;
      continue;
    }
    if (entry.bytes > policy.maxBytesPerFile) throw new Error("archive entry exceeds per-file byte limit");
    const declared = expected.get(path);
    if (!declared || declared.bytes !== entry.bytes || declared.digest !== entry.digest) throw new Error("archive payload integrity drift");
    if (path === DOCS_BUNDLE_SCHEMA_MEMBER && !entry.content.equals(trustedDocsBundleSchema())) throw new Error("archive schema member drift");
    payloadBytes += entry.bytes;
    if (payloadBytes > policy.maxTotalBytes) throw new Error("archive exceeds total byte limit");
    expected.delete(path);
  }
  if (!manifestFound || expected.size !== 0) throw new Error("archive payload inventory is incomplete");
  if (payloadBytes !== manifest.totalBytes) throw new Error("archive payload total drift");
  return entries;
}
