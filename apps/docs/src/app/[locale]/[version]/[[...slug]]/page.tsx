import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocsMobileToc, DocsShell } from "@/components/docs-shell.tsx";
import { PageCopyActions } from "@/components/copy-actions.tsx";
import { DocumentCopyEnhancer } from "@/components/document-copy-enhancer.tsx";
import { enumerateDocsRoutes } from "@/lib/content-catalog.ts";
import { getDocsCatalog, getDocsPage } from "@/lib/content-source.ts";

export const dynamicParams = false;

type RouteParams = { locale: string; version: string; slug?: string[] };

export async function generateStaticParams() {
  return enumerateDocsRoutes(await getDocsCatalog()).map((route) => ({ locale: route.locale, version: route.version, slug: [...route.slug] }));
}

export async function generateMetadata({ params }: { params: Promise<RouteParams> }): Promise<Metadata> {
  const { locale, version, slug = [] } = await params;
  const page = await getDocsPage(locale, version, slug);
  if (!page) return {};
  // The physical current-version route and the `stable` alias serve the same
  // document; both canonicalise to the alias so search engines index one URL,
  // and the one that does not go stale at the next release.
  const routeVersion = version === page.catalog.currentStable ? page.catalog.stableAlias : version;
  const canonical = `/${[locale, routeVersion, ...slug].join("/")}/`;
  return { title: page.catalogPage.title, description: page.catalogPage.description, alternates: { canonical } };
}

export default async function DocumentationPage({ params }: { params: Promise<RouteParams> }) {
  const { locale, version, slug = [] } = await params;
  const found = await getDocsPage(locale, version, slug);
  if (!found) notFound();
  const { catalog, catalogPage, sourcePage } = found;
  const Content = sourcePage.data.body;
  const route = `/${[locale, version, ...slug].join("/")}/`;
  const markdownUrl = `${route.replace(/\/$/, "")}.md`;
  return (
    <DocsShell catalog={catalog} page={catalogPage} routeVersion={version} toc={sourcePage.data.toc}>
      <article className="prose">
        <h1 id="page-title">{catalogPage.title}</h1>
        <p className="docs-description">{catalogPage.description}</p>
        <DocsMobileToc toc={sourcePage.data.toc} />
        <div className="docs-body" id="rendered-markdown"><Content /></div>
        <PageCopyActions markdownUrl={markdownUrl} headingUrl={new URL(`${route}#page-title`, "https://docs.ariadnev.com").href} />
        <DocumentCopyEnhancer rootId="rendered-markdown" />
      </article>
    </DocsShell>
  );
}
