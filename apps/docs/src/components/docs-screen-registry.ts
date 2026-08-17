// Pure metadata half of the screen registry. Kept separate from the JSX
// dispatcher (`docs-screen-registry.tsx`) so the Node native test runner
// — which can strip `.ts` types but not transform `.tsx` JSX — can import
// the enumeration to assert coverage against the catalog without spinning
// up a React renderer. The `.tsx` module owns the actual composition.

/**
 * Every authored `screenKind` the registry composes a screen for. Adding
 * a screen here is the one place a new atlas surface is declared; the
 * JSX dispatcher must map the same key to a renderer or `renderDocsScreen`
 * throws at request time.
 */
export const REGISTERED_SCREEN_KINDS: readonly string[] = Object.freeze([
  "D01-current-docs-home",
]);

/**
 * `screenKind` values whose page bodies are already the finished
 * composition, generated from the release bundle by
 * `scripts/docs-content/render-reference-pages.mjs`. The registry
 * dispatcher renders them unchanged — no wrapper, no additional chrome
 * — so the identifier still names the atlas screen for search and
 * catalog queries without forcing a decorative wrapper around already
 * complete Markdown.
 */
export const GENERATED_PASSTHROUGH_SCREEN_KINDS: readonly string[] = Object.freeze([
  "D13-cli-command-detail",
  "D13-cli-command-retired",
  "D15-skill-category",
]);

/** True when the registry knows how to render the given `screenKind`. */
export function hasRegisteredScreen(kind: string): boolean {
  return REGISTERED_SCREEN_KINDS.includes(kind);
}

/** True when the `screenKind` is a generated-pass-through screen. */
export function isGeneratedPassthroughScreen(kind: string): boolean {
  return GENERATED_PASSTHROUGH_SCREEN_KINDS.includes(kind);
}
