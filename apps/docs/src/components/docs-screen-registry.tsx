import type { ReactNode } from "react";
import type { DocsCatalogPage, DocsContentCatalog } from "@/lib/content-catalog.ts";
import { REGISTERED_SCREEN_KINDS, hasRegisteredScreen, isGeneratedPassthroughScreen } from "./docs-screen-registry.ts";
import { DocsHomeExperience } from "./screen-experiences/docs-home.tsx";
import { PreviousHomeExperience } from "./screen-experiences/previous-home.tsx";
import { InstallationExperience } from "./screen-experiences/installation.tsx";
import { FirstInstallExperience } from "./screen-experiences/first-install.tsx";
import { KitAdaptExperience } from "./screen-experiences/kit-adapt.tsx";
import { GraphExecutionExperience } from "./screen-experiences/graph-execution.tsx";
import { EvaluationExperience } from "./screen-experiences/evaluation.tsx";
import { UpgradingExperience } from "./screen-experiences/upgrading.tsx";
import { ConfigurationExperience } from "./screen-experiences/configuration.tsx";
import { UninstallAndDoctorExperience } from "./screen-experiences/uninstall-and-doctor.tsx";
import { MigrationFromVcskillExperience } from "./screen-experiences/migration-from-vcskill.tsx";
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

const RENDERERS: Readonly<Record<string, ScreenExperience>> = Object.freeze({
  "D01-current-docs-home": DocsHomeExperience,
  "D02-previous-home": PreviousHomeExperience,
  "D03-installation": InstallationExperience,
  "D04-first-install": FirstInstallExperience,
  "D05-kit-adapt": KitAdaptExperience,
  "D06-graph-execution": GraphExecutionExperience,
  "D07-evaluation": EvaluationExperience,
  // D08-D11 authored screens — see `components/screen-experiences/
  // upgrading.tsx`, `configuration.tsx`, `uninstall-and-doctor.tsx`, and
  // `migration-from-vcskill.tsx` for the upgrade-recipe/config-resolution
  // topology diagrams and the doctor/audit/backups/uninstall intent matrix
  // layered above the authored MDX body.
  "D08-upgrading": UpgradingExperience,
  "D09-configuration": ConfigurationExperience,
  "D10-doctor-audit-backups-uninstall": UninstallAndDoctorExperience,
  "D11-migration": MigrationFromVcskillExperience,
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
