// Narrow public surface of the contracts package.
//
// Only the manifest validator, archive policy, and extractor are exported. No
// application framework type crosses this boundary in either direction.

export {
  ArchiveRejection,
  DEFAULT_ARCHIVE_POLICY,
  normalizeArchivePath,
  type ArchivePolicy,
  type ArchiveRejectionCode,
} from "./archive-policy.js";

export {
  BUNDLE_NAME,
  SCHEMA_ID,
  SCHEMA_VERSION,
  TRUSTED_SCHEMA_DIGEST,
  loadTrustedSchema,
  parseDocsBundleManifest,
  type DocsBundleManifest,
  type ExpectedIdentity,
  type PayloadEntry,
} from "./docs-bundle-manifest.js";

export {
  extractDocsBundle,
  inflateArchive,
  inspectArchive,
  verifyArchiveEntries,
  type ArchiveEntry,
  type ExtractOptions,
  type ExtractResult,
} from "./extract-docs-bundle.js";

export {
  assertCommandContract,
  CommandContractError,
  deriveCanonicalSlug,
  deriveLegacyAnchor,
  resolveCommand,
  type CommandContractRejection,
  type CommandContractRejectionCode,
  type CommandDescriptor,
  type CommandRegistry,
  type CommandRegistryEntry,
  type RetiredRoute,
  type RetiredRouteMap,
  type SourceCommand,
} from "./cli-command-contract.js";

export {
  DEFAULT_COMMAND_REGISTRY,
  DEFAULT_RETIRED_ROUTES,
} from "./cli-command-registry.js";
