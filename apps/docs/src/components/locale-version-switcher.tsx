import type { DocsCatalogPage, DocsContentCatalog } from "@/lib/content-catalog.ts";
import { findDeclaredSibling, primaryVersions } from "@/lib/content-catalog.ts";
import { DOCS_LOCALES, LOCALE_LABELS } from "@/lib/i18n.ts";

function pageHref(locale: string, version: string, slug: readonly string[]): string {
  return `/${[locale, version, ...slug].join("/")}/`;
}

export function LocaleVersionSwitcher({ catalog, page, routeVersion }: {
  catalog: DocsContentCatalog;
  page: DocsCatalogPage;
  routeVersion: string;
}) {
  const localeLabel = LOCALE_LABELS[page.locale];
  const resolvedVersion = routeVersion === catalog.stableAlias ? catalog.currentStable : routeVersion;
  const versionLabel = routeVersion === catalog.stableAlias ? `Stable ${resolvedVersion}` : resolvedVersion;
  return (
    <div className="switchers" aria-label="Documentation edition">
      <details className="switcher-group">
        <summary role="button" aria-haspopup="menu" aria-label={`Language: ${localeLabel}`}>Language · {page.locale.toUpperCase()}</summary>
        <ul role="menu" aria-label="Language">
          {DOCS_LOCALES.map((locale) => {
            const sibling = locale === page.locale ? page : findDeclaredSibling(catalog, page, locale, routeVersion);
            return <li role="none" key={locale}>{sibling ? <a role="menuitem" aria-current={locale === page.locale ? "page" : undefined} href={pageHref(locale, routeVersion, sibling.slug)}>{LOCALE_LABELS[locale]}</a> : <span role="menuitem" aria-disabled="true">{LOCALE_LABELS[locale]} unavailable</span>}</li>;
          })}
        </ul>
      </details>
      <details className="switcher-group">
        <summary role="button" aria-haspopup="menu" aria-label={`Version: ${versionLabel}`}>Version · {resolvedVersion}</summary>
        <ul role="menu" aria-label="Version">
          {primaryVersions(catalog).map((version) => {
            const sibling = version === routeVersion ? page : findDeclaredSibling(catalog, page, page.locale, version);
            const label = version === catalog.stableAlias ? "Stable" : version === catalog.currentStable ? `Current ${version}` : `Previous stable ${version}`;
            const accessibleLabel = version === catalog.previousStable ? "Previous stable" : label;
            return <li role="none" key={version}>{sibling ? <a role="menuitem" aria-label={accessibleLabel} aria-current={version === routeVersion ? "page" : undefined} href={pageHref(page.locale, version, sibling.slug)}>{label}</a> : <span role="menuitem" aria-disabled="true">{label} unavailable</span>}</li>;
          })}
        </ul>
      </details>
    </div>
  );
}
