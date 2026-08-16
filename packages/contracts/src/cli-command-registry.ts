// Repository-owned command identity registry and retired-route map.
//
// The release bundle currently ships no immutable `commandId` field, so this
// file is the anchor: every deviation from the derived slug/anchor/identity
// scheme lives here, in one commit-tracked place, and the contract layer
// treats it as authoritative.
//
// ## When to add a registry entry
//
// Never as a first move. The default derivation in `cli-command-contract.ts`
// covers the release's 53 current + 53 historical commands without any
// registered override — every derived slug is URL-safe, unique, and matches
// the anchor emitted by the current reference-page renderer. Add an entry
// only when:
//
//   1. A source rename or a source rewrite would otherwise change the URL
//      or the identity of an established command. Pin `commandId` to the
//      pre-rename value, override `canonicalSlug` when the new source path
//      would produce a different slug, and add the previous anchor to
//      `legacyAnchors` so old fragment links keep resolving.
//   2. The upstream `commands.json` declares no alias for a command that
//      the release has documented as accepting one. Add it under `aliases`.
//   3. Two source paths would fold to the same derived slug. Pick a
//      disambiguated slug and record why in a comment on the entry.
//
// ## When to add a retired route
//
// When a canonical slug that once shipped is no longer live. Register the
// OLD slug in `DEFAULT_RETIRED_ROUTES` with either:
//
//   - `kind: "replaced"` pointing at the current `commandId` and its live
//     `canonicalSlug`. The docs shell answers this URL with a 200 that
//     surfaces the replacement.
//   - `kind: "tombstone"` with a short reason. The docs shell answers with
//     a 200 that explains the removal.
//
// A rename NEVER silently changes an established URL. If the source rename
// implies both a new slug and the old slug is gone, add BOTH: a registry
// entry to preserve identity/anchor, AND a retired-route entry so the old
// slug still resolves. Removing an entry from either map is a public URL
// change and requires an explicit decision.

import type { CommandRegistry, CommandRegistryEntry, RetiredRoute, RetiredRouteMap } from "./cli-command-contract.js";

/** No registered overrides today — every current command derives cleanly. */
const REGISTRY_ENTRIES: ReadonlyArray<readonly [string, CommandRegistryEntry]> = Object.freeze([]);

/** No retired routes today — the historical projection carries the same 53 slugs. */
const RETIRED_ENTRIES: ReadonlyArray<readonly [string, RetiredRoute]> = Object.freeze([]);

export const DEFAULT_COMMAND_REGISTRY: CommandRegistry = new Map(REGISTRY_ENTRIES);
export const DEFAULT_RETIRED_ROUTES: RetiredRouteMap = new Map(RETIRED_ENTRIES);
