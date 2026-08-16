// Adversarial matrix for the docs-bundle extractor.
//
// Archives are built byte-by-byte here rather than shelled out to `tar`, so a
// test can express members no well-behaved tar writer would ever produce:
// traversal names, symlinks, devices, PAX headers, duplicate paths, and
// checksum forgeries.

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { afterEach, describe, expect, it } from "vitest";

import { ArchiveRejection, normalizeArchivePath } from "./archive-policy.js";
import { TRUSTED_SCHEMA_DIGEST, loadTrustedSchema, parseDocsBundleManifest } from "./docs-bundle-manifest.js";
import { extractDocsBundle, inspectArchive } from "./extract-docs-bundle.js";

const BLOCK = 512;
const SOURCE_SHA = "a".repeat(40);
const GENERATOR_SHA = "b".repeat(40);

const temporaries: string[] = [];
function scratch(): string {
  const dir = mkdtempSync(join(tmpdir(), "docs-bundle-test-"));
  temporaries.push(dir);
  return dir;
}
afterEach(() => {
  while (temporaries.length > 0) rmSync(temporaries.pop()!, { recursive: true, force: true });
});

interface MemberSpec {
  path: string;
  content: string | Buffer;
  typeflag?: string;
  /** Override the declared size to desynchronize it from the real payload. */
  declaredSize?: number;
  corruptChecksum?: boolean;
  prefix?: string;
  magic?: string;
}

function tarMember(spec: MemberSpec): Buffer {
  const content = Buffer.isBuffer(spec.content) ? spec.content : Buffer.from(spec.content, "utf8");
  const header = Buffer.alloc(BLOCK);
  header.write(spec.path, 0, 100, "utf8");
  header.write("000644 \0", 100, 8, "ascii");
  header.write("000000 \0", 108, 8, "ascii");
  header.write("000000 \0", 116, 8, "ascii");
  const size = spec.declaredSize ?? content.byteLength;
  header.write(`${size.toString(8).padStart(11, "0")} `, 124, 12, "ascii");
  header.write("00000000000 ", 136, 12, "ascii");
  header.write("        ", 148, 8, "ascii");
  header.write(spec.typeflag ?? "0", 156, 1, "ascii");
  header.write(spec.magic ?? "ustar", 257, 6, "ascii");
  header.write("00", 263, 2, "ascii");
  if (spec.prefix !== undefined) header.write(spec.prefix, 345, 155, "utf8");

  let checksum = 0;
  for (const byte of header) checksum += byte;
  if (spec.corruptChecksum) checksum += 1;
  header.write(`${checksum.toString(8).padStart(6, "0")}\0 `, 148, 8, "ascii");

  const padding = Buffer.alloc((BLOCK - (content.byteLength % BLOCK)) % BLOCK);
  return Buffer.concat([header, content, padding]);
}

function tarball(members: MemberSpec[]): Buffer {
  return Buffer.concat([...members.map(tarMember), Buffer.alloc(BLOCK * 2)]);
}

function digestOf(content: string): string {
  return `sha256:${createHash("sha256").update(Buffer.from(content, "utf8")).digest("hex")}`;
}

interface BundleOptions {
  files?: Record<string, string>;
  manifestOverrides?: Record<string, unknown>;
  extraMembers?: MemberSpec[];
  omitManifest?: boolean;
  includeSchema?: string | false;
}

function buildBundle(options: BundleOptions = {}): Buffer {
  const files = options.files ?? { "index.md": "# ariadnev\n", "guide/start.md": "start here\n" };
  const payload = Object.entries(files).map(([path, content]) => ({
    path,
    bytes: Buffer.byteLength(content, "utf8"),
    digest: digestOf(content),
  }));
  const manifest = {
    schemaVersion: 1,
    schemaId: "https://ariadnev.com/schemas/docs-bundle-manifest-v1.schema.json",
    bundle: "ariadnev-docs-bundle",
    mode: "final",
    publishable: true,
    version: "0.12.0",
    releaseTag: "ariadnev@0.12.0",
    sourceSha: SOURCE_SHA,
    generatorSha: GENERATOR_SHA,
    generatedAt: "2026-08-10T00:00:00Z",
    sourceDateEpoch: 1786000000,
    proofBoundary: "docs-bundle-v1",
    fileCount: payload.length,
    totalBytes: payload.reduce((sum, entry) => sum + entry.bytes, 0),
    payload,
    ...options.manifestOverrides,
  };

  const members: MemberSpec[] = Object.entries(files).map(([path, content]) => ({ path, content }));
  if (!options.omitManifest) members.push({ path: "manifest.json", content: JSON.stringify(manifest) });
  if (options.includeSchema !== false) {
    const schemaText =
      options.includeSchema ??
      readFileSync(join(import.meta.dirname, "..", "schemas", "docs-bundle-manifest-v1.schema.json"), "utf8");
    members.push({ path: "docs-bundle-manifest-v1.schema.json", content: schemaText });
  }
  members.push(...(options.extraMembers ?? []));
  return gzipSync(tarball(members));
}

function expectRejection(run: () => unknown, code: string): void {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(ArchiveRejection);
    expect((error as ArchiveRejection).code).toBe(code);
    return;
  }
  throw new Error(`expected rejection ${code}, but the call succeeded`);
}

describe("trusted schema anchor", () => {
  it("loads only when the on-disk schema still matches the pinned digest", () => {
    const schema = loadTrustedSchema() as { $id: string };
    expect(schema.$id).toBe("https://ariadnev.com/schemas/docs-bundle-manifest-v1.schema.json");
    expect(TRUSTED_SCHEMA_DIGEST).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it("rejects a schema file that drifted from the producer contract", () => {
    const dir = scratch();
    const drifted = join(dir, "schema.json");
    writeFileSync(drifted, '{"$id":"https://evil.example/schema.json"}');
    expectRejection(() => loadTrustedSchema(drifted), "schema-drift");
  });
});

describe("path normalization", () => {
  it("accepts canonical relative paths", () => {
    expect(normalizeArchivePath("index.md")).toBe("index.md");
    expect(normalizeArchivePath("guide/start.md")).toBe("guide/start.md");
  });

  it.each([
    ["/etc/passwd", "path-absolute"],
    ["C:/windows/system32", "path-absolute"],
    ["../outside.md", "path-traversal"],
    ["guide/../../outside.md", "path-traversal"],
    ["guide/./start.md", "path-traversal"],
    ["guide//start.md", "path-not-normalized"],
    ["guide/", "path-not-normalized"],
    ["", "path-empty"],
    ["guide\\start.md", "path-backslash"],
    ["guide%2Fstart.md", "path-encoded-ambiguity"],
    ["guide\u0000.md", "path-control-character"],
    ["guide\uFF0Fstart.md", "path-confusable"],
    ["a/".repeat(20) + "deep.md", "path-too-deep"],
    ["x".repeat(300), "path-too-long"],
  ])("rejects %s", (raw, code) => {
    expectRejection(() => normalizeArchivePath(raw), code);
  });
});

describe("manifest validation", () => {
  const valid = {
    schemaVersion: 1,
    schemaId: "https://ariadnev.com/schemas/docs-bundle-manifest-v1.schema.json",
    bundle: "ariadnev-docs-bundle",
    mode: "final" as const,
    publishable: true,
    version: "0.12.0",
    releaseTag: "ariadnev@0.12.0",
    sourceSha: SOURCE_SHA,
    generatorSha: GENERATOR_SHA,
    generatedAt: "2026-08-10T00:00:00Z",
    sourceDateEpoch: 1786000000,
    proofBoundary: "docs-bundle-v1",
    fileCount: 1,
    totalBytes: 10,
    payload: [{ path: "index.md", bytes: 10, digest: `sha256:${"c".repeat(64)}` }],
  };

  it("accepts a well-formed final manifest", () => {
    expect(parseDocsBundleManifest(valid).releaseTag).toBe("ariadnev@0.12.0");
  });

  it("enforces the expected release identity", () => {
    expect(() => parseDocsBundleManifest(valid, { releaseTag: "ariadnev@0.12.0" })).not.toThrow();
    expectRejection(() => parseDocsBundleManifest(valid, { releaseTag: "ariadnev@0.11.0" }), "release-identity-mismatch");
    expectRejection(() => parseDocsBundleManifest(valid, { sourceSha: "f".repeat(40) }), "release-identity-mismatch");
    expectRejection(() => parseDocsBundleManifest(valid, { mode: "provisional" }), "release-identity-mismatch");
  });

  it("rejects schema drift in the archive-declared identity", () => {
    expectRejection(() => parseDocsBundleManifest({ ...valid, schemaVersion: 2 }), "schema-drift");
    expectRejection(() => parseDocsBundleManifest({ ...valid, schemaId: "https://evil.example/s.json" }), "schema-drift");
  });

  it("rejects inconsistent mode, totals, counts, and unexpected keys", () => {
    expectRejection(() => parseDocsBundleManifest({ ...valid, publishable: false }), "manifest-invalid");
    expectRejection(() => parseDocsBundleManifest({ ...valid, mode: "provisional" }), "manifest-invalid");
    expectRejection(() => parseDocsBundleManifest({ ...valid, totalBytes: 11 }), "manifest-invalid");
    expectRejection(() => parseDocsBundleManifest({ ...valid, fileCount: 2 }), "manifest-invalid");
    expectRejection(() => parseDocsBundleManifest({ ...valid, extra: true }), "manifest-invalid");
  });

  it("rejects a provisional manifest that claims a tag", () => {
    const provisional = { ...valid, mode: "provisional" as const, publishable: false, releaseTag: "ariadnev@0.12.0" };
    expectRejection(() => parseDocsBundleManifest(provisional), "manifest-invalid");
  });

  it("rejects duplicate and unsafe payload paths", () => {
    const duplicated = {
      ...valid,
      fileCount: 2,
      totalBytes: 20,
      payload: [valid.payload[0]!, { ...valid.payload[0]! }],
    };
    expectRejection(() => parseDocsBundleManifest(duplicated), "path-duplicate");

    const traversal = { ...valid, payload: [{ ...valid.payload[0]!, path: "../escape.md" }] };
    expectRejection(() => parseDocsBundleManifest(traversal), "path-traversal");
  });
});

describe("archive inspection", () => {
  it.each([
    ["2", "unsupported-member-type"],
    ["1", "unsupported-member-type"],
    ["3", "unsupported-member-type"],
    ["5", "unsupported-member-type"],
    ["6", "unsupported-member-type"],
    ["x", "unsupported-extension-header"],
    ["L", "unsupported-extension-header"],
  ])("rejects tar member typeflag %s", (typeflag, code) => {
    const tar = tarball([{ path: "index.md", content: "hi", typeflag }]);
    expectRejection(() => inspectArchive(tar), code);
  });

  it("rejects a forged header checksum", () => {
    const tar = tarball([{ path: "index.md", content: "hi", corruptChecksum: true }]);
    expectRejection(() => inspectArchive(tar), "bad-header-checksum");
  });

  it("rejects a split name using the prefix field", () => {
    const tar = tarball([{ path: "index.md", content: "hi", prefix: "sneaky" }]);
    expectRejection(() => inspectArchive(tar), "unsupported-extension-header");
  });

  it("rejects a non-ustar archive", () => {
    const tar = tarball([{ path: "index.md", content: "hi", magic: "\0\0\0\0\0" }]);
    expectRejection(() => inspectArchive(tar), "unsupported-extension-header");
  });

  it("rejects a member whose declared size runs past the archive", () => {
    const tar = tarball([{ path: "index.md", content: "hi", declaredSize: 100000 }]);
    expectRejection(() => inspectArchive(tar), "truncated-archive");
  });

  it("rejects duplicate member paths", () => {
    const tar = tarball([
      { path: "index.md", content: "one" },
      { path: "index.md", content: "two" },
    ]);
    expectRejection(() => inspectArchive(tar), "path-duplicate");
  });

  it("rejects a traversal member name", () => {
    const tar = tarball([{ path: "../escape.md", content: "x" }]);
    expectRejection(() => inspectArchive(tar), "path-traversal");
  });

  it("rejects a compression bomb before it is materialized", () => {
    const huge = Buffer.alloc(64 * 1024 * 1024, 0x41);
    const bomb = gzipSync(tarball([{ path: "big.md", content: huge }]));
    expectRejection(() => extractDocsBundle({ archive: bomb, destination: join(scratch(), "docs") }), "expansion-ratio-exceeded");
  });
});

describe("end-to-end extraction", () => {
  it("installs a valid bundle and reports its identity", () => {
    const destination = join(scratch(), "docs");
    const result = extractDocsBundle({
      archive: buildBundle(),
      destination,
      expected: { releaseTag: "ariadnev@0.12.0", sourceSha: SOURCE_SHA },
      trustedSchemaDigest: TRUSTED_SCHEMA_DIGEST,
    });

    expect(result.manifest.version).toBe("0.12.0");
    expect(result.fileCount).toBe(2);
    expect(readFileSync(join(destination, "index.md"), "utf8")).toBe("# ariadnev\n");
    expect(readFileSync(join(destination, "guide", "start.md"), "utf8")).toBe("start here\n");
    // The manifest and schema members are proof, not payload, so they are not
    // installed into the served tree.
    expect(existsSync(join(destination, "manifest.json"))).toBe(false);
    expect(readdirSync(destination).sort()).toEqual(["guide", "index.md"]);
  });

  it("rejects a payload digest that does not match the manifest", () => {
    const archive = buildBundle({
      manifestOverrides: {
        payload: [{ path: "index.md", bytes: 11, digest: `sha256:${"d".repeat(64)}` }],
        fileCount: 1,
        totalBytes: 11,
      },
      files: { "index.md": "# ariadnev\n" },
    });
    expectRejection(
      () => extractDocsBundle({ archive, destination: join(scratch(), "docs") }),
      "digest-mismatch",
    );
  });

  it("rejects an archive member the manifest never declared", () => {
    const archive = buildBundle({ extraMembers: [{ path: "stowaway.md", content: "surprise" }] });
    expectRejection(
      () => extractDocsBundle({ archive, destination: join(scratch(), "docs") }),
      "manifest-membership-mismatch",
    );
  });

  it("rejects a manifest entry with no archive member", () => {
    const archive = buildBundle({
      files: { "index.md": "# ariadnev\n" },
      manifestOverrides: {
        fileCount: 2,
        totalBytes: 11 + 7,
        payload: [
          { path: "index.md", bytes: 11, digest: digestOf("# ariadnev\n") },
          { path: "ghost.md", bytes: 7, digest: digestOf("ghost\n\n") },
        ],
      },
    });
    expectRejection(
      () => extractDocsBundle({ archive, destination: join(scratch(), "docs") }),
      "manifest-membership-mismatch",
    );
  });

  it("rejects an archive whose schema member drifted from the trusted anchor", () => {
    const archive = buildBundle({ includeSchema: '{"$id":"https://evil.example/schema.json"}' });
    expectRejection(
      () =>
        extractDocsBundle({
          archive,
          destination: join(scratch(), "docs"),
          trustedSchemaDigest: TRUSTED_SCHEMA_DIGEST,
        }),
      "schema-drift",
    );
  });

  it("rejects a bundle whose release identity does not match the expectation", () => {
    expectRejection(
      () =>
        extractDocsBundle({
          archive: buildBundle(),
          destination: join(scratch(), "docs"),
          expected: { releaseTag: "ariadnev@9.9.9" },
        }),
      "release-identity-mismatch",
    );
  });

  it("leaves an existing tree byte-for-byte unchanged when verification fails", () => {
    const root = scratch();
    const destination = join(root, "docs");
    mkdirSync(destination, { recursive: true });
    writeFileSync(join(destination, "index.md"), "PREVIOUS GOOD TREE\n");
    writeFileSync(join(destination, "only-in-previous.md"), "keep me\n");

    const poisoned = buildBundle({ extraMembers: [{ path: "stowaway.md", content: "surprise" }] });
    expectRejection(
      () => extractDocsBundle({ archive: poisoned, destination }),
      "manifest-membership-mismatch",
    );

    expect(readFileSync(join(destination, "index.md"), "utf8")).toBe("PREVIOUS GOOD TREE\n");
    expect(readFileSync(join(destination, "only-in-previous.md"), "utf8")).toBe("keep me\n");
    // No staging directory may survive a failed run.
    expect(readdirSync(root).filter((name) => name.startsWith(".docs-bundle-staging-"))).toEqual([]);
  });

  it("replaces a previous tree atomically on success", () => {
    const root = scratch();
    const destination = join(root, "docs");
    mkdirSync(destination, { recursive: true });
    writeFileSync(join(destination, "stale.md"), "old\n");

    extractDocsBundle({ archive: buildBundle(), destination });

    expect(existsSync(join(destination, "stale.md"))).toBe(false);
    expect(existsSync(join(destination, "index.md"))).toBe(true);
    expect(readdirSync(root).filter((name) => name.includes("previous"))).toEqual([]);
  });

  it("rejects an archive with no manifest member", () => {
    const archive = buildBundle({ omitManifest: true });
    expectRejection(
      () => extractDocsBundle({ archive, destination: join(scratch(), "docs") }),
      "manifest-membership-mismatch",
    );
  });
});
