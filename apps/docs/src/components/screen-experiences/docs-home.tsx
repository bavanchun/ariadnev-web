import type { DocsScreenContext } from "../docs-screen-registry.tsx";

// D01 — Current docs home. Sits above the authored MDX body and reports
// what the current release ships as counts from the catalog itself:
// commands, provider adapters, skill categories, and workflows. Numbers
// are read once from the catalog (never authored) so the strip cannot
// drift from the binary the release generated.
//
// The MDX below already carries the four required D01 elements: start
// path, execution understanding links, generated-reference launchers,
// and the migration boundary. This wrapper reinforces the "generated
// reference" register — the reference launchers below are backed by
// exactly this many first-class things today.

interface AtlasCounts {
  readonly commands: number;
  readonly providers: number;
  readonly skillCategories: number;
  readonly workflows: number;
}

const STRINGS = {
  en: {
    ariaLabel: "What this release ships",
    heading: "This release ships",
    commandsLabel: "CLI commands",
    providersLabel: "provider adapters",
    skillCategoriesLabel: "skill categories",
    workflowsLabel: "workflow graphs",
  },
  vi: {
    ariaLabel: "Bản phát hành này gồm",
    heading: "Bản phát hành này gồm",
    commandsLabel: "lệnh CLI",
    providersLabel: "adapter provider",
    skillCategoriesLabel: "nhóm skill",
    workflowsLabel: "đồ thị workflow",
  },
} as const;

function atlasCountsFor(context: DocsScreenContext): AtlasCounts {
  const { catalog, catalogPage } = context;
  const inScope = catalog.pages.filter((page) => page.locale === catalogPage.locale && page.version === catalogPage.version);
  const commands = inScope.filter((page) => page.screenKind === "D13-cli-command-detail").length;
  const skillCategories = inScope.filter((page) => page.screenKind === "D15-skill-category").length;
  // Providers and workflows each ship one generated reference page in this
  // release; naming them by canonicalId keeps the count aligned with the
  // exact pages the reader can reach from the launcher list below rather
  // than a projection-source array that may lag the emitted routes.
  const providers = inScope.filter((page) => page.canonicalId === "reference/providers").length;
  const workflows = inScope.filter((page) => page.canonicalId === "reference/workflows").length;
  return { commands, providers, skillCategories, workflows };
}

export function DocsHomeExperience({ catalog, catalogPage, children }: DocsScreenContext) {
  const locale = catalogPage.locale;
  const strings = STRINGS[locale] ?? STRINGS.en;
  const counts = atlasCountsFor({ catalog, catalogPage, routeVersion: catalogPage.version, children });
  // The strip is decorative reinforcement of the reference launchers that
  // appear inside the MDX body. It carries a labelled region so a screen
  // reader can skip it in one gesture; the same information reads clearly
  // as text if CSS is disabled.
  return (
    <>
      <aside className="docs-home-atlas-counts" aria-label={strings.ariaLabel}>
        <p className="docs-home-atlas-counts__heading">{strings.heading}</p>
        <dl className="docs-home-atlas-counts__list">
          <div className="docs-home-atlas-counts__item">
            <dt>{strings.commandsLabel}</dt>
            <dd>{counts.commands}</dd>
          </div>
          <div className="docs-home-atlas-counts__item">
            <dt>{strings.providersLabel}</dt>
            <dd>{counts.providers}</dd>
          </div>
          <div className="docs-home-atlas-counts__item">
            <dt>{strings.skillCategoriesLabel}</dt>
            <dd>{counts.skillCategories}</dd>
          </div>
          <div className="docs-home-atlas-counts__item">
            <dt>{strings.workflowsLabel}</dt>
            <dd>{counts.workflows}</dd>
          </div>
        </dl>
      </aside>
      {children}
    </>
  );
}
