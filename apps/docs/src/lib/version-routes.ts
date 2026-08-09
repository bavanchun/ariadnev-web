export const STABLE_ALIAS = "stable" as const;

export interface VersionCatalog {
  readonly currentStable: string;
  readonly previousStable: string;
  readonly stableAlias: typeof STABLE_ALIAS;
}

const SEMVER = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/;

function compareSemver(left: string, right: string): number {
  const leftParts = left.split(".").map(Number);
  const rightParts = right.split(".").map(Number);
  for (let index = 0; index < 3; index += 1) {
    const difference = leftParts[index]! - rightParts[index]!;
    if (difference !== 0) return difference;
  }
  return 0;
}

export function validateVersionCatalog(input: VersionCatalog): VersionCatalog {
  if (!SEMVER.test(input.currentStable) || !SEMVER.test(input.previousStable)) {
    throw new Error("docs catalog versions must be stable semantic versions");
  }
  if (input.currentStable === input.previousStable) {
    throw new Error("docs catalog requires a distinct previous stable version");
  }
  if (compareSemver(input.previousStable, input.currentStable) >= 0) {
    throw new Error("docs catalog previous stable version must precede current stable");
  }
  if (input.stableAlias !== STABLE_ALIAS) {
    throw new Error("docs catalog must declare the stable alias explicitly");
  }
  return Object.freeze({ ...input });
}

export function navigableVersions(input: VersionCatalog): readonly string[] {
  const versions = [input.stableAlias, input.currentStable, input.previousStable];
  if (new Set(versions).size !== 3) throw new Error("docs navigation versions must be unique");
  return Object.freeze(versions);
}

export function resolveVersion(input: VersionCatalog, routeVersion: string): string | undefined {
  if (routeVersion === input.stableAlias) return input.currentStable;
  if (routeVersion === input.currentStable || routeVersion === input.previousStable) return routeVersion;
  return undefined;
}
