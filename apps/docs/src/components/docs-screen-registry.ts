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
  // D02 formalizes the previous-stable home identity — see
  // `components/screen-experiences/previous-home.tsx` for the catalog-
  // derived edition notice, published-destination list, and stable-return
  // link layered above the authored MDX body.
  "D02-previous-home",
  // D03/D04 onboarding screens — see `components/screen-experiences/
  // installation.tsx` and `first-install.tsx` for the integrity-flow and
  // install-flow topology diagrams layered above the authored MDX body.
  "D03-installation",
  "D04-first-install",
  // D05/D06/D07 concept screens — see `components/screen-experiences/
  // kit-adapt.tsx`, `graph-execution.tsx`, and `evaluation.tsx` for the
  // system-view/flagship-topology/proof-ladder diagrams layered above the
  // authored MDX body.
  "D05-kit-adapt",
  "D06-graph-execution",
  "D07-evaluation",
  // D08-D11 authored screens. Each is currently registered as a
  // pass-through — the authored MDX carries the composition today —
  // and the identifier lets future slices swap in an enriched
  // renderer without touching the catalog or the authored source.
  // Coverage is enforced by the docs-screen-registry test.
  "D08-upgrading",
  "D09-configuration",
  "D10-doctor-audit-backups-uninstall",
  "D11-migration",
  // D12/D13 generated reference screens with a dedicated composition — see
  // `components/reference/cli-command-index.tsx` and `cli-command-detail.tsx`.
  "D12-cli-command-index",
  "D13-cli-command-detail",
  // D14 provider reference — see `components/reference/provider-reference.tsx`.
  "D14-provider-reference",
  // D15 skill catalog — see `components/reference/skill-catalog.tsx`. The
  // index page's composition is already complete/minimal (formalised
  // identity only); the per-category detail page gets the progressive
  // name/description filter, so it graduated out of the pass-through list.
  "D15-skill-catalog",
  "D15-skill-category",
  // D16 workflow topology diagrams — see `components/reference/workflow-map.tsx`.
  "D16-workflow-reference",
  // D17 release notes highlights — see `components/reference/release-timeline.tsx`.
  "D17-release-notes",
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
  "D13-cli-command-retired",
]);

/** True when the registry knows how to render the given `screenKind`. */
export function hasRegisteredScreen(kind: string): boolean {
  return REGISTERED_SCREEN_KINDS.includes(kind);
}

/** True when the `screenKind` is a generated-pass-through screen. */
export function isGeneratedPassthroughScreen(kind: string): boolean {
  return GENERATED_PASSTHROUGH_SCREEN_KINDS.includes(kind);
}
