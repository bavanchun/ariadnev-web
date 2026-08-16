import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { DocsContentCatalog, DocsRouteParam } from "./content-catalog.ts";
import { enumerateDocsRoutes, findCatalogPage } from "./content-catalog.ts";
import { publicMarkdown, publicMarkdownLinks } from "./public-markdown.ts";

export { publicMarkdown } from "./public-markdown.ts";

export const LLMS_FULL_MAX_BYTES = 1024 * 1024;

export function routeUrl(route: DocsRouteParam): string {
  return `/${[route.locale, route.version, ...route.slug].join("/")}/`;
}

export function markdownUrl(route: DocsRouteParam): string {
  return `${routeUrl(route).replace(/\/$/, "")}.md`;
}

function outputPath(outRoot: string, url: string): string {
  if (!url.startsWith("/") || url.includes("..") || url.includes("\\")) throw new Error("unsafe static discovery URL");
  return resolve(outRoot, url.slice(1));
}

async function validateLocalLinks(markdown: string, pageUrl: string, outRoot: string): Promise<void> {
  for (const href of publicMarkdownLinks(markdown)) {
    if (/^(?:mailto|tel):/i.test(href)) continue;
    const url = new URL(href, `https://docs.invalid${pageUrl}`);
    if (url.origin !== "https://docs.invalid") continue;
    let decodedHref: string;
    try {
      decodedHref = decodeURIComponent(href);
    } catch {
      throw new Error(`unsafe local Markdown link: ${href}`);
    }
    if (decodedHref.includes("\\") || decodedHref.includes("\0")) throw new Error(`unsafe local Markdown link: ${href}`);
    const pathname = decodeURIComponent(url.pathname);
    if (!pathname.startsWith("/") || pathname.includes("\\")) throw new Error(`unsafe local Markdown link: ${href}`);
    const target = pathname.endsWith("/") ? `${pathname}index.html` : pathname;
    await access(outputPath(outRoot, target)).catch(() => { throw new Error(`local Markdown link does not resolve: ${href}`); });
  }
}

function escapeMarkdownInline(value: string): string {
  return value.replace(/[\\`*_[\]<>]/g, "\\$&");
}

export async function exportStaticDiscovery(catalog: DocsContentCatalog, contentRoot: string, outRoot: string): Promise<readonly string[]> {
  const routes = enumerateDocsRoutes(catalog);
  const markdownBySource = new Map<string, { readonly body: string; readonly markdown: string }>();
  const written: string[] = [];
  const fullSections: string[] = [];
  const renderedPages: Array<{ markdown: string; pageUrl: string }> = [];
  const concise: string[] = ["# ariadnev documentation", "", "Static English and Vietnamese documentation by release.", ""];
  for (const route of routes) {
    const page = findCatalogPage(catalog, route.locale, route.version, route.slug);
    if (!page) throw new Error("static discovery route does not resolve to a catalog page");
    let rendered = markdownBySource.get(page.sourcePath);
    if (!rendered) {
      const body = publicMarkdown(await readFile(resolve(contentRoot, page.sourcePath), "utf8"));
      rendered = Object.freeze({ body, markdown: `# ${escapeMarkdownInline(page.title)}\n\n${body.trim()}\n` });
      markdownBySource.set(page.sourcePath, rendered);
    }
    const url = markdownUrl(route);
    const pageUrl = routeUrl(route);
    await access(outputPath(outRoot, `${pageUrl}index.html`)).catch(() => { throw new Error(`static HTML page is missing for ${pageUrl}`); });
    const target = outputPath(outRoot, url);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, rendered.markdown, { encoding: "utf8", flag: "wx" });
    written.push(url);
    concise.push(`- [${escapeMarkdownInline(page.title)}](${url}) - ${escapeMarkdownInline(page.description)}`);
    fullSections.push(`Source: ${url}\n\n${rendered.markdown.trim()}\n`);
    renderedPages.push({ markdown: rendered.body, pageUrl });
  }
  const llms = `${concise.join("\n")}\n`;
  const llmsFull = `# ariadnev documentation — full public Markdown\n\n${fullSections.join("\n---\n\n")}`;
  if (Buffer.byteLength(llmsFull) > LLMS_FULL_MAX_BYTES) throw new Error("llms-full.txt exceeds its bounded output policy");
  for (const [name, content] of [["llms.txt", llms], ["llms-full.txt", llmsFull]] as const) {
    await writeFile(resolve(outRoot, name), content, { encoding: "utf8", flag: "wx" });
    written.push(`/${name}`);
  }
  const outputSet = new Set(written);
  for (const url of concise.flatMap((line) => [...line.matchAll(/\]\((\/[^)]+)\)/g)].map((match) => match[1]!))) {
    if (!outputSet.has(url)) throw new Error(`llms discovery link does not resolve: ${url}`);
  }
  for (const page of renderedPages) await validateLocalLinks(page.markdown, page.pageUrl, outRoot);
  return Object.freeze([...written].sort());
}
