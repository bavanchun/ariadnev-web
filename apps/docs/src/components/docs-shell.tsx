import type { ReactNode } from "react";
import type { DocsCatalogPage, DocsContentCatalog } from "@/lib/content-catalog.ts";
import { LocaleVersionSwitcher } from "./locale-version-switcher.tsx";
import { SearchDialog } from "./search-dialog.tsx";

type TocItem = { url: string; title: ReactNode; depth: number };

function href(page: DocsCatalogPage, version: string): string {
  return `/${[page.locale, version, ...page.slug].join("/")}/`;
}

function TocLinks({ toc }: { toc: readonly TocItem[] }) {
  return <ol>{toc.map((item) => <li key={item.url} data-depth={item.depth}><a href={item.url}>{item.title}</a></li>)}</ol>;
}

export function DocsMobileToc({ toc }: { toc: readonly TocItem[] }) {
  return <details className="docs-mobile-toc"><summary>On this page</summary><TocLinks toc={toc} /></details>;
}

export function DocsShell({ catalog, page, routeVersion, toc, children }: {
  catalog: DocsContentCatalog;
  page: DocsCatalogPage;
  routeVersion: string;
  toc: readonly TocItem[];
  children: ReactNode;
}) {
  const pages = catalog.pages.filter((candidate) => candidate.locale === page.locale && candidate.version === page.version);
  return (
    <div className="docs-frame" lang={page.locale} dir="ltr">
      <a className="skip-link" href="#docs-content">Skip to documentation</a>
      <header className="docs-header">
        <a className="brand" href="/">ariadnev docs</a>
        <SearchDialog locale={page.locale} version={routeVersion} indexUrl={`/search/${page.locale}/${routeVersion}.json`} />
        <LocaleVersionSwitcher catalog={catalog} page={page} routeVersion={routeVersion} />
      </header>
      <aside className="docs-sidebar" aria-label="Documentation pages">
        <nav><ul>{pages.map((candidate) => <li key={candidate.id}><a aria-current={candidate.id === page.id ? "page" : undefined} href={href(candidate, routeVersion)}>{candidate.title}</a></li>)}</ul></nav>
      </aside>
      <main id="docs-content" tabIndex={-1}>
        <nav aria-label="Breadcrumb" className="breadcrumb"><ol><li><a href="/">Docs</a></li><li><a href={`/${page.locale}/${routeVersion}/`}>{page.locale.toUpperCase()}</a></li><li aria-current="page">{page.title}</li></ol></nav>
        {children}
      </main>
      <aside className="docs-toc" aria-label="On this page">
        <strong>On this page</strong>
        <TocLinks toc={toc} />
      </aside>
    </div>
  );
}
