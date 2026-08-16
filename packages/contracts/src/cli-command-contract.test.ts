// Colocated because `pnpm run contracts` already points vitest at
// `packages/contracts`. A second suite at `tests/contracts/` would duplicate
// setup for no gain — one file covers pure resolution and a bundle-anchored
// integration in the same run, and both fail hard the moment the release
// bundle drifts from the registry.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  assertCommandContract,
  CommandContractError,
  DEFAULT_COMMAND_REGISTRY,
  DEFAULT_RETIRED_ROUTES,
  deriveCanonicalSlug,
  deriveLegacyAnchor,
  resolveCommand,
  type CommandRegistry,
  type RetiredRoute,
  type RetiredRouteMap,
  type SourceCommand,
} from "./index.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

function readCommands(relative: string): SourceCommand[] {
  const parsed = JSON.parse(readFileSync(resolve(repoRoot, relative), "utf8"));
  const list = Array.isArray(parsed) ? parsed : parsed.commands;
  if (!Array.isArray(list)) throw new Error(`no commands array in ${relative}`);
  return list;
}

function readHistorical(relative: string): SourceCommand[] {
  const parsed = JSON.parse(readFileSync(resolve(repoRoot, relative), "utf8"));
  const projection = parsed?.historicalProjection ?? parsed?.previous?.historicalProjection ?? {};
  const list = projection?.cli?.commands;
  if (!Array.isArray(list)) throw new Error(`no historical cli commands in ${relative}`);
  return list;
}

describe("deriveCanonicalSlug", () => {
  it("keeps the root binary as its own slug", () => {
    expect(deriveCanonicalSlug("ariadnev")).toBe("ariadnev");
  });
  it("drops the leading binary segment and folds separators", () => {
    expect(deriveCanonicalSlug("ariadnev adapters regenerate")).toBe("adapters-regenerate");
    expect(deriveCanonicalSlug("ariadnev  workflows   list")).toBe("workflows-list");
  });
  it("rejects an empty source path", () => {
    expect(() => deriveCanonicalSlug("")).toThrow(/empty/);
    expect(() => deriveCanonicalSlug("   ")).toThrow(/empty/);
  });
});

describe("deriveLegacyAnchor", () => {
  it("matches the anchor emitted by the current CLI reference renderer", () => {
    // `scripts/docs-content/render-reference-pages.mjs#anchor` folds the WHOLE
    // path including the binary; changing this contract without registering
    // legacy anchors is a public URL break.
    expect(deriveLegacyAnchor("ariadnev")).toBe("ariadnev");
    expect(deriveLegacyAnchor("ariadnev adapters regenerate")).toBe("ariadnev-adapters-regenerate");
  });
});

describe("resolveCommand", () => {
  const empty: CommandRegistry = new Map();

  it("resolves without a registry entry using the derivation", () => {
    const descriptor = resolveCommand({ path: "ariadnev adapters" }, empty);
    expect(descriptor.canonicalSlug).toBe("adapters");
    expect(descriptor.commandId).toBe("cmd:adapters");
    expect(descriptor.legacyAnchors).toEqual(["ariadnev-adapters"]);
    expect(descriptor.aliases).toEqual([]);
    expect(descriptor.pageKind).toBe("command");
    expect(descriptor.navigationVisibility).toBe("reference-only");
  });

  it("honors a registered override for slug, id, anchors, and aliases", () => {
    const registry: CommandRegistry = new Map([
      [
        "ariadnev adapters regenerate",
        {
          commandId: "cmd:legacy-regen",
          canonicalSlug: "regen",
          legacyAnchors: ["ariadnev-regen-old"],
          aliases: ["ariadnev regen"],
        },
      ],
    ]);
    const descriptor = resolveCommand({ path: "ariadnev adapters regenerate" }, registry);
    expect(descriptor.commandId).toBe("cmd:legacy-regen");
    expect(descriptor.canonicalSlug).toBe("regen");
    // Derived anchor is kept first; registry-added anchors are appended.
    expect(descriptor.legacyAnchors).toEqual(["ariadnev-adapters-regenerate", "ariadnev-regen-old"]);
    expect(descriptor.aliases).toEqual(["ariadnev regen"]);
  });

  it("merges source aliases with registered aliases, order-stable", () => {
    const descriptor = resolveCommand(
      { path: "ariadnev install", aliases: ["ariadnev i"] },
      new Map([["ariadnev install", { aliases: ["ariadnev setup", "ariadnev i"] }]]),
    );
    expect(descriptor.aliases).toEqual(["ariadnev i", "ariadnev setup"]);
  });

  it("rejects a registry-provided slug that is not URL-safe", () => {
    expect(() =>
      resolveCommand({ path: "ariadnev broken" }, new Map([["ariadnev broken", { canonicalSlug: "Not/Safe" }]])),
    ).toThrow(/URL-safe/);
  });
});

describe("assertCommandContract", () => {
  const empty: CommandRegistry = new Map();
  const noRetired: RetiredRouteMap = new Map();

  it("returns descriptors in stable sort order", () => {
    const sources: SourceCommand[] = [
      { path: "ariadnev workflows list" },
      { path: "ariadnev adapters" },
      { path: "ariadnev adapters regenerate" },
    ];
    const result = assertCommandContract(sources, empty, noRetired);
    expect(result.map((d) => d.canonicalSlug)).toEqual(["adapters", "adapters-regenerate", "workflows-list"]);
  });

  it("rejects a slug collision", () => {
    const sources: SourceCommand[] = [
      { path: "ariadnev adapters regenerate" },
      // Contrived collision via registry override.
      { path: "ariadnev something-else" },
    ];
    const registry: CommandRegistry = new Map([["ariadnev something-else", { canonicalSlug: "adapters-regenerate" }]]);
    expect(() => assertCommandContract(sources, registry, noRetired)).toThrowError(CommandContractError);
  });

  it("rejects a retired route that collides with a live slug", () => {
    const sources: SourceCommand[] = [{ path: "ariadnev adapters" }];
    const retired: RetiredRouteMap = new Map([
      ["adapters", { kind: "tombstone", reason: "test" }],
    ]);
    expect(() => assertCommandContract(sources, empty, retired)).toThrowError(CommandContractError);
  });

  it("rejects a replaced retired route whose target is not live", () => {
    const sources: SourceCommand[] = [{ path: "ariadnev adapters" }];
    const retired: RetiredRouteMap = new Map<string, RetiredRoute>([
      [
        "old-slug",
        { kind: "replaced", commandId: "cmd:ghost", replacementSlug: "does-not-exist", reason: "test" },
      ],
    ]);
    expect(() => assertCommandContract(sources, empty, retired)).toThrowError(CommandContractError);
  });

  it("accepts a valid retired mapping to a live descriptor", () => {
    const sources: SourceCommand[] = [{ path: "ariadnev adapters regenerate" }];
    const retired: RetiredRouteMap = new Map<string, RetiredRoute>([
      [
        "old-regen",
        { kind: "replaced", commandId: "cmd:adapters-regenerate", replacementSlug: "adapters-regenerate", reason: "renamed 2026-08" },
      ],
    ]);
    const result = assertCommandContract(sources, empty, retired);
    expect(result).toHaveLength(1);
  });
});

describe("release-bundle integration", () => {
  const currentBundle = "apps/docs/content/generated/bundle/reference/cli/commands.json";
  const historicalBundle = "apps/docs/content/generated/bundle/reference/previous-stable/bootstrap.json";

  it("current 53 records resolve cleanly against the default registry", () => {
    const sources = readCommands(currentBundle);
    expect(sources.length).toBe(53);
    const descriptors = assertCommandContract(sources, DEFAULT_COMMAND_REGISTRY, DEFAULT_RETIRED_ROUTES);
    expect(descriptors.length).toBe(sources.length);
    for (const descriptor of descriptors) {
      expect(descriptor.canonicalSlug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(descriptor.legacyAnchors[0]).toBe(deriveLegacyAnchor(descriptor.sourceIdentity));
    }
  });

  it("historical 53 records resolve cleanly against the default registry", () => {
    const sources = readHistorical(historicalBundle);
    expect(sources.length).toBe(53);
    const descriptors = assertCommandContract(sources, DEFAULT_COMMAND_REGISTRY, DEFAULT_RETIRED_ROUTES);
    expect(descriptors.length).toBe(sources.length);
  });

  it("current and historical share stable identity across editions", () => {
    const current = assertCommandContract(readCommands(currentBundle), DEFAULT_COMMAND_REGISTRY, DEFAULT_RETIRED_ROUTES);
    const historical = assertCommandContract(readHistorical(historicalBundle), DEFAULT_COMMAND_REGISTRY, DEFAULT_RETIRED_ROUTES);
    const currentIds = new Set(current.map((d) => d.commandId));
    const historicalIds = new Set(historical.map((d) => d.commandId));
    const shared = [...currentIds].filter((id) => historicalIds.has(id));
    // The historical projection carries the same 53 command surface today, so
    // identity overlap should be complete. A drop below this signals either a
    // release-side rename or a projection scope change — both are decisions
    // the registry must record before this test can be weakened.
    expect(shared.length).toBe(53);
  });
});
