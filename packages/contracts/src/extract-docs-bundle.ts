import { createHash, randomBytes } from "node:crypto";
import { constants } from "node:fs";
import { chmod, lstat, mkdir, mkdtemp, open, readFile, readdir, rename, rm } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, parse, resolve, sep } from "node:path";
import { resolveArchivePolicy } from "./archive-policy.js";
import { inspectArchive } from "./archive-reader.js";
import { verifyArchiveEntries } from "./archive-verifier.js";
import { parseDocsBundleManifest, trustedDocsBundleSchema } from "./docs-bundle-manifest.js";
import { assertVerifiedDocsBundleTrust } from "./docs-bundle-trust.js";
import {
  DOCS_BUNDLE_ARCHIVE_NAME,
  DOCS_BUNDLE_CHECKSUMS_NAME,
  DOCS_BUNDLE_MANIFEST_MEMBER,
  DOCS_BUNDLE_MANIFEST_NAME,
  DOCS_BUNDLE_SCHEMA_MEMBER,
  DOCS_BUNDLE_SCHEMA_NAME,
  type ActiveDocsBundle,
  type ArchiveEntry,
  type ExtractDocsBundleInput,
  type ExtractDocsBundleResult,
  type Sha256Digest,
} from "./docs-bundle-types.js";

const DIGEST = /^sha256:[a-f0-9]{64}$/;
const CHECKSUMS_MAX_BYTES = 64 * 1024;
const POINTER_MAX_BYTES = 80;

function sha256(content: Uint8Array): Sha256Digest {
  return `sha256:${createHash("sha256").update(content).digest("hex")}`;
}

function verifyExpectedDigest(content: Uint8Array, expected: Sha256Digest, label: string): void {
  if (!DIGEST.test(expected) || sha256(content) !== expected) throw new Error(`${label} digest does not match external trust anchor`);
}

function decodeUtf8(content: Uint8Array, label: string): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(content);
  } catch {
    throw new Error(`${label} is not valid UTF-8`);
  }
}

function parseChecksums(content: Uint8Array): ReadonlyMap<string, Sha256Digest> {
  if (content.byteLength === 0 || content.byteLength > CHECKSUMS_MAX_BYTES) throw new Error("checksum file violates size policy");
  const text = decodeUtf8(content, "checksum file");
  if (!text.endsWith("\n") || text.includes("\r") || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text)) {
    throw new Error("checksum file violates canonical text policy");
  }
  const result = new Map<string, Sha256Digest>();
  for (const line of text.slice(0, -1).split("\n")) {
    const match = /^([a-f0-9]{64})  ([A-Za-z0-9][A-Za-z0-9._@+-]{0,127})$/.exec(line);
    if (!match) throw new Error("checksum file contains a malformed record");
    const name = match[2]!;
    if (result.has(name)) throw new Error("checksum file contains a duplicate asset");
    result.set(name, `sha256:${match[1]!}`);
  }
  return result;
}

async function statOrUndefined(path: string) {
  try {
    return await lstat(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

async function ensureSafeDirectory(path: string, create = true): Promise<void> {
  const target = resolve(path);
  const root = parse(target).root;
  let current = root;
  for (const part of target.slice(root.length).split(sep).filter(Boolean)) {
    current = join(current, part);
    const stat = await statOrUndefined(current);
    if (!stat) {
      if (!create) throw new Error("destination directory does not exist");
      await mkdir(current, { mode: 0o700 });
      const created = await lstat(current);
      if (!created.isDirectory() || created.isSymbolicLink()) throw new Error("unsafe destination directory component");
    } else if (!stat.isDirectory() || stat.isSymbolicLink()) {
      throw new Error("unsafe destination directory component");
    }
  }
}

async function assertRegularOrAbsent(path: string, label: string): Promise<void> {
  const stat = await statOrUndefined(path);
  if (stat && (!stat.isFile() || stat.isSymbolicLink())) throw new Error(`${label} must be a regular file or absent`);
}

async function syncDirectory(path: string): Promise<void> {
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

function treeDigest(entries: readonly Pick<ArchiveEntry, "path" | "digest">[]): Sha256Digest {
  const hash = createHash("sha256");
  for (const entry of [...entries].sort((a, b) => a.path.localeCompare(b.path))) {
    hash.update(entry.path, "utf8");
    hash.update("\0");
    hash.update(entry.digest, "ascii");
    hash.update("\0");
  }
  return `sha256:${hash.digest("hex")}`;
}

async function listTree(root: string, relative = ""): Promise<ArchiveEntry[]> {
  const directory = relative ? join(root, ...relative.split("/")) : root;
  const stat = await lstat(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error("active content tree contains an unsafe directory");
  const result: ArchiveEntry[] = [];
  for (const name of (await readdir(directory)).sort((a, b) => a.localeCompare(b))) {
    const childRelative = relative ? `${relative}/${name}` : name;
    const child = join(root, ...childRelative.split("/"));
    const childStat = await lstat(child);
    if (childStat.isSymbolicLink()) throw new Error("active content tree contains a symlink");
    if (childStat.isDirectory()) result.push(...await listTree(root, childRelative));
    else if (childStat.isFile()) {
      const content = await readFile(child);
      result.push({ path: childRelative, bytes: content.byteLength, digest: sha256(content), content });
    } else throw new Error("active content tree contains a special file");
  }
  return result;
}

async function verifyTree(root: string, expectedDigest: Sha256Digest, expectedEntries?: readonly ArchiveEntry[]): Promise<void> {
  const actual = await listTree(root);
  if (treeDigest(actual) !== expectedDigest) throw new Error("content-addressed tree digest drift");
  if (expectedEntries) {
    const expected = new Map(expectedEntries.map((entry) => [entry.path, entry]));
    if (actual.length !== expected.size) throw new Error("content-addressed tree inventory drift");
    for (const entry of actual) {
      const target = expected.get(entry.path);
      if (!target || target.bytes !== entry.bytes || target.digest !== entry.digest) {
        throw new Error("content-addressed tree inventory drift");
      }
    }
  }
}

function parsePointer(content: Buffer): Sha256Digest {
  if (content.byteLength > POINTER_MAX_BYTES) throw new Error("active pointer violates size policy");
  const value = decodeUtf8(content, "active pointer");
  if (!/^sha256:[a-f0-9]{64}\n$/.test(value)) throw new Error("active pointer is malformed");
  return value.slice(0, -1) as Sha256Digest;
}

async function readPointerOnce(pointerPath: string): Promise<Sha256Digest> {
  const handle = await open(pointerPath, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > POINTER_MAX_BYTES) throw new Error("active pointer must be a bounded regular file");
    return parsePointer(await handle.readFile());
  } finally {
    await handle.close();
  }
}

function pathsFor(pointerInput: string) {
  if (!isAbsolute(pointerInput)) throw new Error("extraction destination must be absolute");
  const pointerPath = resolve(pointerInput);
  const leaf = basename(pointerPath);
  if (leaf === "" || leaf === "." || leaf === "..") throw new Error("invalid extraction destination");
  return {
    pointerPath,
    parent: dirname(pointerPath),
    treesRoot: `${pointerPath}.trees`,
    lockPath: `${pointerPath}.lock`,
  };
}

export async function resolveActiveDocsBundle(destination: string): Promise<ActiveDocsBundle> {
  const { pointerPath, parent, treesRoot } = pathsFor(destination);
  await ensureSafeDirectory(parent, false);
  await ensureSafeDirectory(treesRoot, false);
  await assertRegularOrAbsent(pointerPath, "active pointer");
  const digest = await readPointerOnce(pointerPath);
  const activeTree = join(treesRoot, digest.slice(7));
  await verifyTree(activeTree, digest);
  return Object.freeze({ pointerPath, activeTree, treeDigest: digest });
}

export async function extractDocsBundle(input: ExtractDocsBundleInput): Promise<ExtractDocsBundleResult> {
  assertVerifiedDocsBundleTrust(input.trust);
  const policy = resolveArchivePolicy(input.policy);
  if (input.archive.byteLength > policy.maxCompressedBytes) throw new Error("archive exceeds compressed byte limit");
  if (input.checksums.byteLength > CHECKSUMS_MAX_BYTES) throw new Error("checksum file violates size policy");
  if (input.manifest.byteLength > policy.maxManifestBytes) throw new Error("manifest sidecar violates size policy");
  if (input.schema.byteLength !== trustedDocsBundleSchema().byteLength) throw new Error("schema sidecar violates size policy");
  const archive = Buffer.from(input.archive);
  const checksums = Buffer.from(input.checksums);
  const manifestBytes = Buffer.from(input.manifest);
  const schema = Buffer.from(input.schema);
  verifyExpectedDigest(archive, input.trust.assetDigests.archiveDigest, "archive");
  verifyExpectedDigest(checksums, input.trust.assetDigests.checksumsDigest, "checksum file");
  verifyExpectedDigest(manifestBytes, input.trust.assetDigests.manifestDigest, "manifest sidecar");
  verifyExpectedDigest(schema, input.trust.assetDigests.schemaDigest, "schema sidecar");
  if (!schema.equals(trustedDocsBundleSchema())) throw new Error("schema sidecar does not match trusted schema bytes");

  const checksumMap = parseChecksums(checksums);
  const attestedAssets = new Map(input.trust.releaseAssets.map((asset) => [asset.name, asset]));
  const expectedChecksumNames = [...attestedAssets.keys()].filter((name) => name !== DOCS_BUNDLE_CHECKSUMS_NAME).sort();
  if (JSON.stringify([...checksumMap.keys()].sort()) !== JSON.stringify(expectedChecksumNames)) {
    throw new Error("downloaded checksum inventory drift");
  }
  for (const name of expectedChecksumNames) {
    if (checksumMap.get(name) !== attestedAssets.get(name)!.digest) throw new Error("downloaded checksum agreement drift");
  }
  const suppliedAssets = new Map<string, Uint8Array>([
    [DOCS_BUNDLE_ARCHIVE_NAME, archive],
    [DOCS_BUNDLE_CHECKSUMS_NAME, checksums],
    [DOCS_BUNDLE_MANIFEST_NAME, manifestBytes],
    [DOCS_BUNDLE_SCHEMA_NAME, schema],
  ]);
  for (const [name, bytes] of suppliedAssets) {
    const asset = attestedAssets.get(name);
    if (!asset || asset.size !== bytes.byteLength || asset.digest !== sha256(bytes)) throw new Error(`attested docs asset drift: ${name}`);
  }

  let manifestValue: unknown;
  try {
    manifestValue = JSON.parse(decodeUtf8(manifestBytes, "manifest sidecar"));
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error("manifest sidecar is not valid JSON");
    throw error;
  }
  const manifest = parseDocsBundleManifest(manifestValue, input.trust.identity);
  const inspected = inspectArchive(archive, policy);
  const manifestEntry = inspected.entries.find((entry) => entry.path === DOCS_BUNDLE_MANIFEST_MEMBER);
  const schemaEntry = inspected.entries.find((entry) => entry.path === DOCS_BUNDLE_SCHEMA_MEMBER);
  if (!manifestEntry?.content.equals(manifestBytes) || !schemaEntry?.content.equals(schema)) {
    throw new Error("archive and sidecar bytes drift");
  }
  const entries = verifyArchiveEntries(inspected.entries, manifest, policy);
  const digest = treeDigest(entries);
  await input.onPhase?.("verified");

  const { pointerPath, parent, treesRoot, lockPath } = pathsFor(input.destination);
  await ensureSafeDirectory(parent);
  await assertRegularOrAbsent(pointerPath, "active pointer");
  const lock = await open(lockPath, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW, 0o600)
    .catch((error: NodeJS.ErrnoException) => {
      if (error.code === "EEXIST" || error.code === "ELOOP") throw new Error("docs bundle promotion lock already exists");
      throw error;
    });
  let pointerTemporary: string | undefined;
  let staging: string | undefined;
  try {
    await lock.writeFile(`${process.pid}\n`);
    await lock.sync();
    await lock.close();
    await syncDirectory(parent);
    await input.onPhase?.("lock-acquired");
    await ensureSafeDirectory(treesRoot);
    const activeStat = await statOrUndefined(pointerPath);
    if (activeStat) {
      const current = await readPointerOnce(pointerPath);
      if (current === digest) {
        const activeTree = join(treesRoot, digest.slice(7));
        await verifyTree(activeTree, digest, entries);
        return { pointerPath, activeTree, treeDigest: digest, manifest, fileCount: manifest.fileCount, totalBytes: manifest.totalBytes, reused: true };
      }
    }

    const activeTree = join(treesRoot, digest.slice(7));
    const existingTree = await statOrUndefined(activeTree);
    if (existingTree) {
      if (!existingTree.isDirectory() || existingTree.isSymbolicLink()) throw new Error("content-addressed tree path is unsafe");
      await verifyTree(activeTree, digest, entries);
    } else {
      staging = await mkdtemp(join(treesRoot, ".staging-"));
      await chmod(staging, 0o700);
      const stagingRoot = staging;
      const directories = new Set<string>([""]);
      for (const entry of entries) {
        await input.onPhase?.("before-entry-write");
        const output = join(staging, ...entry.path.split("/"));
        await mkdir(dirname(output), { recursive: true, mode: 0o700 });
        let current = dirname(entry.path);
        while (current !== ".") {
          directories.add(current);
          current = dirname(current);
        }
        const handle = await open(output, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW, 0o400);
        try {
          await handle.writeFile(entry.content);
          await handle.sync();
        } finally {
          await handle.close();
        }
        await input.onPhase?.("after-entry-write");
      }
      for (const directory of [...directories].sort((a, b) => b.length - a.length)) {
        await syncDirectory(directory ? join(stagingRoot, ...directory.split("/")) : stagingRoot);
      }
      await input.onPhase?.("before-tree-publish");
      await rename(staging, activeTree);
      staging = undefined;
      for (const directory of [...directories].sort((a, b) => b.length - a.length)) {
        await chmod(directory ? join(activeTree, ...directory.split("/")) : activeTree, 0o500);
      }
      await syncDirectory(treesRoot);
      await input.onPhase?.("after-tree-publish");
    }

    await input.onPhase?.("before-pointer-write");
    pointerTemporary = join(parent, `.${basename(pointerPath)}.next-${randomBytes(12).toString("hex")}`);
    const pointer = await open(pointerTemporary, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW, 0o600);
    try {
      await pointer.writeFile(`${digest}\n`);
      await pointer.sync();
    } finally {
      await pointer.close();
    }
    await input.onPhase?.("after-pointer-write");
    await input.onPhase?.("before-pointer-commit");
    await assertRegularOrAbsent(pointerPath, "active pointer");
    await rename(pointerTemporary, pointerPath);
    pointerTemporary = undefined;
    await syncDirectory(parent);
    await input.onPhase?.("after-pointer-commit");
    return { pointerPath, activeTree, treeDigest: digest, manifest, fileCount: manifest.fileCount, totalBytes: manifest.totalBytes, reused: false };
  } finally {
    await lock.close().catch(() => undefined);
    if (staging) await rm(staging, { recursive: true, force: true });
    if (pointerTemporary) await rm(pointerTemporary, { force: true });
    await rm(lockPath, { force: true });
    await syncDirectory(parent);
  }
}
