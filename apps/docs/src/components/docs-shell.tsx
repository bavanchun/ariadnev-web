import type { ReactNode } from "react";
import type { DocsCatalogPage, DocsContentCatalog, DocsSection } from "@/lib/content-catalog.ts";
import { SIDEBAR_SECTION_ORDER, resolveSection } from "@/lib/content-catalog.ts";
import { LocaleVersionSwitcher } from "./locale-version-switcher.tsx";
import { SearchDialog } from "./search-dialog.tsx";

type TocItem = { url: string; title: ReactNode; depth: number };

// Section labels live here (Server Component only) so both locales ship
// zero client-bundle weight. The chrome-strings authority migration is a
// separate slice per plan sequencing.
const SECTION_LABELS_EN: Readonly<Record<DocsSection, string>> = Object.freeze({
  "get-started": "Get started",
  concepts: "Concepts",
  guides: "Guides",
  reference: "Reference",
  "release-notes": "Release notes",
  meta: "More",
});
const SECTION_LABELS_VI: Readonly<Record<DocsSection, string>> = Object.freeze({
  "get-started": "Bắt đầu",
  concepts: "Khái niệm",
  guides: "Hướng dẫn",
  reference: "Tài liệu tham chiếu",
  "release-notes": "Ghi chú phát hành",
  meta: "Khác",
});

function href(page: DocsCatalogPage, version: string): string {
  return `/${[page.locale, version, ...page.slug].join("/")}/`;
}

function TocLinks({ toc }: { toc: readonly TocItem[] }) {
  return <ol>{toc.map((item) => <li key={item.url} data-depth={item.depth}><a href={item.url}>{item.title}</a></li>)}</ol>;
}

export function DocsMobileToc({ toc }: { toc: readonly TocItem[] }) {
  // Empty TOC renders nothing at all — an empty <details> still consumes
  // a tap target and reads as "On this page" with no items behind it.
  if (toc.length === 0) return null;
  return <details className="docs-mobile-toc"><summary>On this page</summary><TocLinks toc={toc} /></details>;
}

export function DocsShell({ catalog, page, routeVersion, toc, children }: {
  catalog: DocsContentCatalog;
  page: DocsCatalogPage;
  routeVersion: string;
  toc: readonly TocItem[];
  children: ReactNode;
}) {
  const labels = page.locale === "vi" ? SECTION_LABELS_VI : SECTION_LABELS_EN;
  const pages = catalog.pages.filter((candidate) => candidate.locale === page.locale && candidate.version === page.version);
  // Group in one server pass; the sidebar renders sections in canonical order
  // and skips any empty section so no ghost headers appear.
  const bySection = new Map<DocsSection, DocsCatalogPage[]>();
  for (const candidate of pages) {
    const section = resolveSection(candidate);
    const bucket = bySection.get(section);
    if (bucket) bucket.push(candidate); else bySection.set(section, [candidate]);
  }
  const activeSection = resolveSection(page);
  const isPreviousEdition = page.version === catalog.previousStable;
  const previousEditionLabels = page.locale === "vi"
    ? { headline: "Ấn bản trước ổn định", cta: "Xem trên bản ổn định" }
    : { headline: "Previous stable edition", cta: "See on the current stable" };
  // Section-aware breadcrumb: crumb sequence is Docs → LOCALE → section → title.
  // Adds one link when the section resolves to a non-meta bucket; skips the
  // extra crumb for "meta" so ad-hoc pages don't invent a category.
  const sectionLabel = activeSection === "meta" ? null : labels[activeSection];
  return (
    <div className="docs-frame" data-toc={toc.length > 0 ? "populated" : "empty"} lang={page.locale} dir="ltr">
      <a className="skip-link" href="#docs-content">Skip to documentation</a>
      <header className="docs-header">
        <a className="brand" href="/" aria-label="ariadnev docs home">
          <img className="brand-logo" src="/ariadnev-logo.webp" width="192" height="128" alt="" />
          <span>ariadnev docs</span>
        </a>
        <SearchDialog locale={page.locale} version={routeVersion} indexUrl={`/search/${page.locale}/${routeVersion}.json`} />
        <LocaleVersionSwitcher catalog={catalog} page={page} routeVersion={routeVersion} />
      </header>
      <aside className="docs-sidebar" aria-label="Documentation pages">
        <nav>
          {SIDEBAR_SECTION_ORDER.map((section) => {
            const inSection = bySection.get(section);
            if (!inSection || inSection.length === 0) return null;
            return (
              <section key={section} className="docs-sidebar-section" aria-current={section === activeSection ? "true" : undefined}>
                <h2 className="docs-sidebar-section-title">{labels[section]}</h2>
                <ul>{inSection.map((candidate) => <li key={candidate.id}><a aria-current={candidate.id === page.id ? "page" : undefined} href={href(candidate, routeVersion)}>{candidate.title}</a></li>)}</ul>
              </section>
            );
          })}
        </nav>
      </aside>
      <main id="docs-content" tabIndex={-1}>
        <nav aria-label="Breadcrumb" className="breadcrumb"><ol>
          <li><a href="/">Docs</a></li>
          <li><a href={`/${page.locale}/${routeVersion}/`}>{page.locale.toUpperCase()}</a></li>
          {sectionLabel && <li aria-hidden="true">{sectionLabel}</li>}
          <li aria-current="page">{page.title}</li>
        </ol></nav>
        {isPreviousEdition && (
          <aside className="docs-previous-edition-notice" role="note">
            <strong>{previousEditionLabels.headline}</strong>
            <a href={`/${page.locale}/${catalog.stableAlias}/${page.slug.join("/")}${page.slug.length ? "/" : ""}`}>{previousEditionLabels.cta}</a>
          </aside>
        )}
        {children}
      </main>
      {toc.length > 0 && (
        <aside className="docs-toc" aria-label="On this page">
          <strong>On this page</strong>
          <TocLinks toc={toc} />
        </aside>
      )}
    </div>
  );
}
