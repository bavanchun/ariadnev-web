import type { DocsCatalogPage, DocsContentCatalog } from "@/lib/content-catalog.ts";
import { resolveNavigationVisibility } from "@/lib/content-catalog.ts";

// Server-rendered previous/next pager. Sequence follows catalog order for the
// current locale/version, filtered to pages visible in the global sidebar so
// command detail pages (reference-only) and hidden routes do not appear as
// pager targets. Zero client bundle weight.
export function DocsPager({ catalog, page, routeVersion }: {
  catalog: DocsContentCatalog;
  page: DocsCatalogPage;
  routeVersion: string;
}) {
  const sequence = catalog.pages.filter((candidate) =>
    candidate.locale === page.locale &&
    candidate.version === page.version &&
    resolveNavigationVisibility(candidate) === "global-sidebar",
  );
  const index = sequence.findIndex((candidate) => candidate.id === page.id);
  if (index < 0) return null;
  const previous = index > 0 ? sequence[index - 1] : undefined;
  const next = index < sequence.length - 1 ? sequence[index + 1] : undefined;
  if (!previous && !next) return null;
  const labels = page.locale === "vi" ? { prev: "Trước", next: "Tiếp", aria: "Điều hướng trang" } : { prev: "Previous", next: "Next", aria: "Page navigation" };
  const href = (candidate: DocsCatalogPage) => `/${[candidate.locale, routeVersion, ...candidate.slug].join("/")}/`;
  return (
    <nav className="docs-pager" aria-label={labels.aria}>
      {previous
        ? <a className="docs-pager-previous" rel="prev" href={href(previous)}><span>{labels.prev}</span><strong>{previous.title}</strong></a>
        : <span className="docs-pager-empty" />}
      {next
        ? <a className="docs-pager-next" rel="next" href={href(next)}><span>{labels.next}</span><strong>{next.title}</strong></a>
        : <span className="docs-pager-empty" />}
    </nav>
  );
}
