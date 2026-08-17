import type { DocsScreenContext } from "../docs-screen-registry.tsx";
import { findDeclaredSibling } from "@/lib/content-catalog.ts";
import { Callout, ResponsiveDataRegion, type DataColumn, type DataRow } from "../prose/index.ts";

// D02 — Previous home. The authored MDX body already states the edition
// identity and links the two machine-projected references this version
// ships. This wrapper adds the two things only the catalog knows for
// certain at request time: the exact previous/current version pair (so the
// notice can never drift from `content-catalog.ts`'s validated version
// pair) and the closed list of pages actually published under this
// version/locale (so "only published destinations" can never list a page
// that does not exist for 1.0.0, and never silently drops one that does).
// Neither block restates a command, provider, or release fact already
// authored in the body — both are derived, not retyped.

const STRINGS = {
  en: {
    noticeHeading: "Version-locked edition",
    destinationsCaption: "Published in this edition",
    destinationColumn: "Page",
    returnAria: "Return to current documentation",
    returnLabel: "Go to the current documentation",
  },
  vi: {
    noticeHeading: "Bản tài liệu cố định phiên bản",
    destinationsCaption: "Đã xuất bản trong bản này",
    destinationColumn: "Trang",
    returnAria: "Về tài liệu hiện hành",
    returnLabel: "Đến tài liệu hiện hành",
  },
} as const;

function noticeText(locale: "en" | "vi", previousStable: string, currentStable: string): string {
  return locale === "vi"
    ? `Bản này cố định ở phiên bản ${previousStable}. Tài liệu hiện hành đang ở ${currentStable}.`
    : `This edition is version-locked to ${previousStable}. Current documentation is on ${currentStable}.`;
}

function pageHref(locale: string, routeVersion: string, slug: readonly string[]): string {
  return `/${[locale, routeVersion, ...slug].join("/")}/`;
}

export function PreviousHomeExperience({ catalog, catalogPage, routeVersion, children }: DocsScreenContext) {
  const locale = catalogPage.locale;
  const strings = STRINGS[locale] ?? STRINGS.en;

  const published = catalog.pages
    .filter((page) => page.locale === catalogPage.locale && page.version === catalogPage.version && page.id !== catalogPage.id)
    .sort((left, right) => left.title.localeCompare(right.title, "en"));

  const columns: readonly DataColumn[] = [{ key: "destination", label: strings.destinationColumn }];
  const rows: readonly DataRow[] = published.map((page) => ({
    id: page.id,
    cells: { destination: <a href={pageHref(page.locale, routeVersion, page.slug)}>{page.title}</a> },
  }));

  const returnPage = findDeclaredSibling(catalog, catalogPage, catalogPage.locale, catalog.stableAlias);

  return (
    <>
      <Callout variant="boundary" locale={locale} heading={strings.noticeHeading}>
        <p>{noticeText(locale, catalog.previousStable, catalog.currentStable)}</p>
      </Callout>
      {children}
      {rows.length > 0 && (
        <ResponsiveDataRegion locale={locale} caption={strings.destinationsCaption} columns={columns} rows={rows} />
      )}
      {returnPage && (
        <nav aria-label={strings.returnAria}>
          <a href={pageHref(returnPage.locale, catalog.stableAlias, returnPage.slug)}>{strings.returnLabel}</a>
        </nav>
      )}
    </>
  );
}
