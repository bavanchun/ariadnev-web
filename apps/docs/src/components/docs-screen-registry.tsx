import type { ReactNode } from "react";
import type { DocsCatalogPage, DocsContentCatalog } from "@/lib/content-catalog.ts";
import { REGISTERED_SCREEN_KINDS, hasRegisteredScreen, isGeneratedPassthroughScreen } from "./docs-screen-registry.ts";
import { DocsHomeExperience } from "./screen-experiences/docs-home.tsx";
import { PreviousHomeExperience } from "./screen-experiences/previous-home.tsx";
import { InstallationExperience } from "./screen-experiences/installation.tsx";
import { FirstInstallExperience } from "./screen-experiences/first-install.tsx";
import { CliCommandIndexExperience } from "./reference/cli-command-index.tsx";
import { CliCommandDetailExperience } from "./reference/cli-command-detail.tsx";
import { ProviderReferenceExperience } from "./reference/provider-reference.tsx";
import { SkillCatalogExperience, SkillCategoryExperience } from "./reference/skill-catalog.tsx";
import { WorkflowMapExperience } from "./reference/workflow-map.tsx";
import { ReleaseTimelineExperience } from "./reference/release-timeline.tsx";

// JSX dispatcher for the screen registry. Each entry wraps the authored
// MDX article body with a screen-specific composition. The registry is
// closed: a page whose `screenKind` is declared but not registered fails
// the build so a new atlas screen is never silently rendered as a generic
// template. A page with no `screenKind` at all passes through — that is
// the rollout affordance for authored screens that have not yet been
// converted. The metadata half lives in `docs-screen-registry.ts` so the
// Node native test runner can enforce coverage without loading JSX.

export interface DocsScreenContext {
  readonly catalog: DocsContentCatalog;
  readonly catalogPage: DocsCatalogPage;
  readonly routeVersion: string;
  readonly children: ReactNode;
}

type ScreenExperience = (context: DocsScreenContext) => ReactNode;

// Pass-through renderer for screens whose composition is fully carried
// by the authored MDX body and the shell chrome. Registered so the
// coverage test can rely on every declared authored screenKind having a
// named owner, and so a future slice can swap in an enriched renderer
// without touching any consumer of the registry.
const PassThroughExperience: ScreenExperience = ({ children }) => children;

const RENDERERS: Readonly<Record<string, ScreenExperience>> = Object.freeze({
  "D01-current-docs-home": DocsHomeExperience,
  "D02-previous-home": PreviousHomeExperience,
  // D05-D11 authored screens: registered as pass-through today so the
  // authored MDX composition ships unchanged. Future slices swap in
  // dedicated experiences without touching consumers of the registry.
  "D03-installation": InstallationExperience,
  "D04-first-install": FirstInstallExperience,
  "D05-kit-adapt": PassThroughExperience,
  "D06-graph-execution": PassThroughExperience,
  "D07-evaluation": PassThroughExperience,
  "D08-upgrading": PassThroughExperience,
  "D09-configuration": PassThroughExperience,
  "D10-doctor-audit-backups-uninstall": PassThroughExperience,
  "D11-migration": PassThroughExperience,
  "D12-cli-command-index": CliCommandIndexExperience,
  "D13-cli-command-detail": CliCommandDetailExperience,
  "D14-provider-reference": ProviderReferenceExperience,
  "D15-skill-catalog": SkillCatalogExperience,
  "D15-skill-category": SkillCategoryExperience,
  "D16-workflow-reference": WorkflowMapExperience,
  "D17-release-notes": ReleaseTimelineExperience,
});

// Cross-check the two halves at module load. Every declared kind in the
// pure metadata file must have a renderer here; every renderer here must
// be declared there. Drift between the two would either strand a screen
// with no renderer or leak an undocumented one past the coverage test.
for (const kind of REGISTERED_SCREEN_KINDS) {
  if (!(kind in RENDERERS)) throw new Error(`docs screen registry declares "${kind}" but no renderer is wired`);
}
for (const kind of Object.keys(RENDERERS)) {
  if (!hasRegisteredScreen(kind)) throw new Error(`docs screen registry renders "${kind}" but the metadata file does not declare it`);
}

/**
 * Render the MDX body wrapped by the screen its `screenKind` selects.
 * Returns the body unchanged when no `screenKind` is declared so
 * unconverted pages remain readable during rollout. Throws when a page
 * declares a `screenKind` that is not in the registry so an atlas
 * addition can never render as a misleading generic page.
 */
export function renderDocsScreen(context: DocsScreenContext): ReactNode {
  const screenKind = context.catalogPage.screenKind;
  if (!screenKind) return context.children;
  if (isGeneratedPassthroughScreen(screenKind)) return context.children;
  const experience = RENDERERS[screenKind];
  if (!experience) {
    throw new Error(`docs screen registry has no owner for screenKind "${screenKind}" (page ${context.catalogPage.id})`);
  }
  return experience(context);
}
