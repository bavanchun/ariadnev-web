// Immutable identity, canonical slug, alias-as-metadata, and retired-route
// policy for every documented CLI command.
//
// The upstream `commands.json` bundle currently ships no `commandId` field, so
// this module resolves identity from a repository-owned registry keyed by the
// command's whitespace-normalized source path (the field the release exposes
// as `path`, e.g. `"ariadnev adapters regenerate"`). A command's canonical
// slug is derived from that path with the leading binary segment removed and
// non-alphanumerics folded to dashes. The registry may override the derived
// slug, add legacy anchors, and add aliases; a rename never silently changes
// an established URL — it goes through the retired-route map instead.
//
// Zero dependency by design. This file describes shapes and enforces them;
// consumers apply the result to catalog builds, sidebar rendering, and search
// indexing.

/** A single command as it arrives from the release bundle. */
export interface SourceCommand {
  /** Whitespace-joined command path, e.g. `"ariadnev adapters regenerate"`. */
  readonly path: string;
  /** Human-readable summary lifted from the release. */
  readonly description?: string;
  /** Additional invocation names the release itself declares. Never a route. */
  readonly aliases?: readonly string[];
  /** Positional arguments; opaque to this module. */
  readonly arguments?: readonly unknown[];
  /** Flags/options; opaque to this module. */
  readonly options?: readonly unknown[];
}

/** Fixed, additive metadata on a fully resolved command. */
export interface CommandDescriptor {
  /** Stable identity that never changes across releases or renames. */
  readonly commandId: string;
  /** Original path from the source, unchanged. */
  readonly sourceIdentity: string;
  /** Canonical URL slug for `/reference/cli/<slug>/`. */
  readonly canonicalSlug: string;
  /** Anchors on the aggregate `/reference/cli/` page that must keep resolving. */
  readonly legacyAnchors: readonly string[];
  /** Extra invocation names, promoted from the release and the registry. */
  readonly aliases: readonly string[];
  /** Sibling ordering hint (source path sort). */
  readonly sortKey: string;
  /** Fixed kind. Always `"command"` — call sites can pattern-match without a string literal. */
  readonly pageKind: "command";
  /** Navigation policy. Always `"reference-only"` — command pages never enter the global sidebar. */
  readonly navigationVisibility: "reference-only";
}

/**
 * Registry override for a single command. Every field is optional:
 * - `commandId` is only required when a rename or a source rewrite would
 *   otherwise change the derived identity. When omitted, identity is the
 *   canonical slug prefixed with `cmd:` so it is textually distinct from a
 *   URL slug.
 * - `canonicalSlug` overrides the derived slug — use when the source path
 *   would otherwise produce a slug that collides, is ambiguous, or ships a
 *   short form the release itself does not surface.
 * - `legacyAnchors` extends the derived anchor list — use only when the
 *   command's fragment ID on `/reference/cli/` has changed and old links
 *   still need to resolve.
 * - `aliases` is merged with source aliases; duplicates are dropped.
 */
export interface CommandRegistryEntry {
  readonly commandId?: string;
  readonly canonicalSlug?: string;
  readonly legacyAnchors?: readonly string[];
  readonly aliases?: readonly string[];
}

/** Registry keyed by `SourceCommand.path`. Read-only at every consumer. */
export type CommandRegistry = ReadonlyMap<string, CommandRegistryEntry>;

/** A retired route points at either a live replacement or a tombstone. */
export type RetiredRoute =
  | {
      readonly kind: "replaced";
      /** commandId this old slug now resolves to. */
      readonly commandId: string;
      /** Slug where the reader should land — always live, never retired. */
      readonly replacementSlug: string;
      /** Short human-readable rationale for the mapping. */
      readonly reason: string;
    }
  | {
      readonly kind: "tombstone";
      /** Short human-readable rationale for why the URL is gone. */
      readonly reason: string;
    };

/** Retired-route map keyed by the OLD slug that must keep 200-resolving. */
export type RetiredRouteMap = ReadonlyMap<string, RetiredRoute>;

// ----------------------------------------------------------- derivations

/**
 * Derive the canonical slug from a command's source path: drop the leading
 * binary segment (the release's `ariadnev` executable name) and fold every
 * run of non-alphanumeric characters to a single dash. The root command
 * (path `"ariadnev"`) keeps its literal name as the slug because it is the
 * only command that IS the binary.
 */
export function deriveCanonicalSlug(sourcePath: string): string {
  const cleaned = String(sourcePath ?? "").trim();
  if (cleaned.length === 0) throw new Error("command source path is empty");
  const parts = cleaned.split(/\s+/);
  const head = parts[0] ?? "";
  const tail = parts.slice(1);
  if (tail.length === 0) return foldSlug(head);
  return foldSlug(tail.join("-"));
}

function foldSlug(text: string): string {
  const folded = text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (folded.length === 0) throw new Error(`command slug is empty for input "${text}"`);
  return folded;
}

/**
 * Derive the legacy anchor for the aggregate `/reference/cli/` page. This
 * matches the anchor emitted by the current CLI reference renderer, which
 * folds the WHOLE path (including the binary segment) so `ariadnev adapters
 * regenerate` becomes `ariadnev-adapters-regenerate`.
 *
 * Later reference-page rewrites MUST keep emitting this anchor in the DOM
 * (as a visible index target). If the renderer changes, add the old anchor
 * to the registry entry rather than rewriting history.
 */
export function deriveLegacyAnchor(sourcePath: string): string {
  return foldSlug(String(sourcePath ?? ""));
}

function deriveCommandId(canonicalSlug: string): string {
  return `cmd:${canonicalSlug}`;
}

// ----------------------------------------------------------- resolution

/**
 * Resolve one source record into a full descriptor. Pure; deterministic; does
 * not touch the retired-route map (that map governs the OLD slug space, not
 * live commands).
 */
export function resolveCommand(source: SourceCommand, registry: CommandRegistry): CommandDescriptor {
  const sourceIdentity = String(source.path ?? "").trim();
  if (sourceIdentity.length === 0) throw new Error("command source is missing a path");
  const entry = registry.get(sourceIdentity);
  const canonicalSlug = entry?.canonicalSlug ?? deriveCanonicalSlug(sourceIdentity);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(canonicalSlug)) {
    throw new Error(`command canonical slug is not URL-safe: "${canonicalSlug}"`);
  }
  const commandId = entry?.commandId ?? deriveCommandId(canonicalSlug);
  const derivedAnchor = deriveLegacyAnchor(sourceIdentity);
  const legacyAnchors = Object.freeze(uniqueInOrder([derivedAnchor, ...(entry?.legacyAnchors ?? [])]));
  const aliases = Object.freeze(uniqueInOrder([...(source.aliases ?? []), ...(entry?.aliases ?? [])]));
  return Object.freeze({
    commandId,
    sourceIdentity,
    canonicalSlug,
    legacyAnchors,
    aliases,
    sortKey: sourceIdentity,
    pageKind: "command",
    navigationVisibility: "reference-only",
  });
}

function uniqueInOrder<T>(values: readonly T[]): T[] {
  const seen = new Set<T>();
  const out: T[] = [];
  for (const value of values) {
    if (seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

// ----------------------------------------------------------- validation

export type CommandContractRejectionCode =
  | "slug-collision"
  | "command-id-collision"
  | "anchor-collision"
  | "alias-collision"
  | "slug-not-url-safe"
  | "empty-source-path"
  | "retired-route-collides-with-live"
  | "retired-route-replacement-missing";

export interface CommandContractRejection {
  readonly code: CommandContractRejectionCode;
  readonly detail: string;
}

export class CommandContractError extends Error {
  readonly rejections: readonly CommandContractRejection[];
  constructor(rejections: readonly CommandContractRejection[]) {
    super(`command contract rejected ${rejections.length} entries: ${rejections.map((r) => r.code).join(", ")}`);
    this.name = "CommandContractError";
    this.rejections = rejections;
  }
}

/**
 * Prove that a set of resolved descriptors plus a retired-route map is
 * internally consistent. Every collision is a hard error, not a warning.
 * Returns the resolved descriptors in stable sortKey order.
 */
export function assertCommandContract(
  sources: readonly SourceCommand[],
  registry: CommandRegistry,
  retired: RetiredRouteMap,
): readonly CommandDescriptor[] {
  const rejections: CommandContractRejection[] = [];
  const descriptors: CommandDescriptor[] = [];
  const slugSeen = new Map<string, string>();
  const idSeen = new Map<string, string>();
  const anchorSeen = new Map<string, string>();
  const aliasSeen = new Map<string, string>();
  for (const source of sources) {
    let descriptor: CommandDescriptor;
    try {
      descriptor = resolveCommand(source, registry);
    } catch (err) {
      rejections.push({
        code: err instanceof Error && err.message.includes("URL-safe")
          ? "slug-not-url-safe"
          : "empty-source-path",
        detail: (err as Error).message,
      });
      continue;
    }
    descriptors.push(descriptor);
    const previousSlug = slugSeen.get(descriptor.canonicalSlug);
    if (previousSlug && previousSlug !== descriptor.sourceIdentity) {
      rejections.push({
        code: "slug-collision",
        detail: `"${descriptor.canonicalSlug}" already used by "${previousSlug}", now claimed by "${descriptor.sourceIdentity}"`,
      });
    }
    slugSeen.set(descriptor.canonicalSlug, descriptor.sourceIdentity);
    const previousId = idSeen.get(descriptor.commandId);
    if (previousId && previousId !== descriptor.sourceIdentity) {
      rejections.push({
        code: "command-id-collision",
        detail: `"${descriptor.commandId}" already used by "${previousId}", now claimed by "${descriptor.sourceIdentity}"`,
      });
    }
    idSeen.set(descriptor.commandId, descriptor.sourceIdentity);
    for (const anchor of descriptor.legacyAnchors) {
      const previousAnchor = anchorSeen.get(anchor);
      if (previousAnchor && previousAnchor !== descriptor.sourceIdentity) {
        rejections.push({
          code: "anchor-collision",
          detail: `legacy anchor "${anchor}" claimed by "${previousAnchor}" and "${descriptor.sourceIdentity}"`,
        });
      }
      anchorSeen.set(anchor, descriptor.sourceIdentity);
    }
    for (const alias of descriptor.aliases) {
      const previousAlias = aliasSeen.get(alias);
      if (previousAlias && previousAlias !== descriptor.sourceIdentity) {
        rejections.push({
          code: "alias-collision",
          detail: `alias "${alias}" claimed by "${previousAlias}" and "${descriptor.sourceIdentity}"`,
        });
      }
      aliasSeen.set(alias, descriptor.sourceIdentity);
    }
  }
  // Retired routes must never collide with a live slug and every "replaced"
  // entry must point at a real live descriptor.
  for (const [oldSlug, mapping] of retired) {
    if (slugSeen.has(oldSlug)) {
      rejections.push({
        code: "retired-route-collides-with-live",
        detail: `retired slug "${oldSlug}" is still a live canonical slug`,
      });
    }
    if (mapping.kind === "replaced") {
      const stillLive = descriptors.some((d) => d.canonicalSlug === mapping.replacementSlug && d.commandId === mapping.commandId);
      if (!stillLive) {
        rejections.push({
          code: "retired-route-replacement-missing",
          detail: `retired slug "${oldSlug}" targets ${mapping.commandId}@${mapping.replacementSlug}, which is not a live descriptor`,
        });
      }
    }
  }
  if (rejections.length > 0) throw new CommandContractError(rejections);
  return Object.freeze(descriptors.sort((a, b) => a.sortKey.localeCompare(b.sortKey, "en")));
}
