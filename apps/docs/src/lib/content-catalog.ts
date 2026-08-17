import { readFile, realpath, stat } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { z } from "zod";
import { DOCS_LOCALES, type DocsLocale } from "./i18n.ts";
import { publicMarkdown } from "./public-markdown.ts";
import { navigableVersions, resolveVersion, validateVersionCatalog, type VersionCatalog } from "./version-routes.ts";

const SAFE_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const SHA = /^[a-f0-9]{40}$/;
const DIGEST = /^sha256:[a-f0-9]{64}$/;

const sourceReleaseSchema = z.object({
  mode: z.enum(["final", "provisional"]),
  version: z.string(),
  releaseTag: z.string().nullable(),
  sourceSha: z.string().regex(SHA),
  generatorSha: z.string().regex(SHA),
  schemaDigest: z.string().regex(DIGEST),
}).strict();

const siblingSchema = z.object({
  locale: z.enum(DOCS_LOCALES),
  version: z.string(),
  pageId: z.string().min(1),
}).strict();

// Additive Living Execution Atlas metadata. Existing catalog entries omit
// these fields and continue to parse; later phases populate them page by
// page. `pageKind` and `screenKind` name what the reader lands on; `section`
// names the top-level shelf a global sidebar renders; `navigationVisibility`
// controls whether the page enters that shelf at all. Command detail pages
// are the reason `"reference-only"` exists: they must be discoverable by
// search and static export, but never enumerated in the global sidebar.
const PAGE_KINDS = ["home", "get-started", "concept", "guide", "reference-index", "release-notes", "not-found", "command", "skill-category"] as const;
const NAVIGATION_VISIBILITIES = ["global-sidebar", "reference-only", "hidden"] as const;
const SECTIONS = ["get-started", "concepts", "guides", "reference", "release-notes", "meta"] as const;

const pageSchema = z.object({
  id: z.string().min(1),
  canonicalId: z.string().min(1),
  locale: z.enum(DOCS_LOCALES),
  version: z.string(),
  slug: z.array(z.string()),
  sourcePath: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  siblings: z.array(siblingSchema),
  pageKind: z.enum(PAGE_KINDS).optional(),
  screenKind: z.string().min(1).optional(),
  section: z.enum(SECTIONS).optional(),
  navigationVisibility: z.enum(NAVIGATION_VISIBILITIES).optional(),
}).strict();

const catalogSchema = z.object({
  schemaVersion: z.literal(1),
  sourceRelease: sourceReleaseSchema,
  locales: z.tuple([z.literal("en"), z.literal("vi")]),
  currentStable: z.string(),
  previousStable: z.string(),
  stableAlias: z.literal("stable"),
  pages: z.array(pageSchema),
}).strict();

export interface DocsSourceRelease {
  readonly mode: "final" | "provisional";
  readonly version: string;
  readonly releaseTag: string | null;
  readonly sourceSha: string;
  readonly generatorSha: string;
  readonly schemaDigest: string;
}

export interface DocsPageSibling {
  readonly locale: DocsLocale;
  readonly version: string;
  readonly pageId: string;
}

/** Broad page shape. Absent on legacy entries; call sites use `resolvePageKind` if a default is needed. */
export type DocsPageKind = (typeof PAGE_KINDS)[number];

/** Top-level docs shelf a global sidebar renders. Absent on legacy entries. */
export type DocsSection = (typeof SECTIONS)[number];

/** Sidebar enumeration policy. Absent on legacy entries; treated as `"global-sidebar"` by default. */
export type DocsNavigationVisibility = (typeof NAVIGATION_VISIBILITIES)[number];

export interface DocsCatalogPage {
  readonly id: string;
  readonly canonicalId: string;
  readonly locale: DocsLocale;
  readonly version: string;
  readonly slug: readonly string[];
  readonly sourcePath: string;
  readonly title: string;
  readonly description: string;
  readonly siblings: readonly DocsPageSibling[];
  /** Broad page contract from the Living Execution Atlas; optional during rollout. */
  readonly pageKind?: DocsPageKind;
  /** Screen-atlas identifier (e.g. `"D03"`, `"D13-cli-command-detail"`); optional during rollout. */
  readonly screenKind?: string;
  /** Top-level shelf; optional during rollout. */
  readonly section?: DocsSection;
  /** Sidebar enumeration policy; defaults to `"global-sidebar"` when absent. */
  readonly navigationVisibility?: DocsNavigationVisibility;
}

export interface DocsContentCatalog extends VersionCatalog {
  readonly schemaVersion: 1;
  readonly sourceRelease: DocsSourceRelease;
  readonly locales: readonly ["en", "vi"];
  readonly pages: readonly DocsCatalogPage[];
}

export interface DocsRouteParam {
  readonly locale: DocsLocale;
  readonly version: string;
  readonly slug: readonly string[];
}

function validateSafePath(value: string, label: string): string {
  if (value !== value.normalize("NFC") || isAbsolute(value) || value.includes("\\") || value.includes("%") || value.includes("\0")) {
    throw new Error(`${label} is not a normalized relative path`);
  }
  const parts = value.split("/");
  if (parts.length === 0 || parts.some((part) => !SAFE_SEGMENT.test(part) || part === "." || part === "..")) {
    throw new Error(`${label} violates the safe path policy`);
  }
  return value;
}

function routeKey(locale: string, version: string, slug: readonly string[]): string {
  return `${locale}/${version}/${slug.join("/")}`;
}

function freezePage(page: z.infer<typeof pageSchema>): DocsCatalogPage {
  // Strip absent additive fields explicitly. With `exactOptionalPropertyTypes`
  // an interface member declared `readonly pageKind?: DocsPageKind` rejects
  // `undefined` — a page that never emitted the field must simply not carry
  // that property, so the spread cannot include it.
  const base: Record<string, unknown> = {
    id: page.id,
    canonicalId: page.canonicalId,
    locale: page.locale,
    version: page.version,
    slug: Object.freeze([...page.slug]),
    sourcePath: page.sourcePath,
    title: page.title,
    description: page.description,
    siblings: Object.freeze(page.siblings.map((sibling) => Object.freeze({ ...sibling }))),
  };
  if (page.pageKind !== undefined) base.pageKind = page.pageKind;
  if (page.screenKind !== undefined) base.screenKind = page.screenKind;
  if (page.section !== undefined) base.section = page.section;
  if (page.navigationVisibility !== undefined) base.navigationVisibility = page.navigationVisibility;
  return Object.freeze(base) as unknown as DocsCatalogPage;
}

export function parseDocsContentCatalog(value: unknown): DocsContentCatalog {
  const parsed = catalogSchema.safeParse(value);
  if (!parsed.success) throw new Error(`docs content catalog is invalid: ${parsed.error.issues[0]?.message ?? "unknown error"}`);
  const input = parsed.data;
  const versions = validateVersionCatalog(input);
  if (input.sourceRelease.version !== input.currentStable) throw new Error("docs source release must identify the current stable version");
  if (input.sourceRelease.mode === "final" && input.sourceRelease.releaseTag !== `ariadnev@${input.sourceRelease.version}`) {
    throw new Error("final docs source release tag/version drift");
  }
  if (input.sourceRelease.mode === "provisional" && input.sourceRelease.releaseTag !== null) {
    throw new Error("provisional docs source release cannot declare a release tag");
  }
  if (input.sourceRelease.mode === "final" && input.sourceRelease.generatorSha !== input.sourceRelease.sourceSha) {
    throw new Error("final docs source generator must match the source release");
  }

  const pages = input.pages.map(freezePage);
  const ids = new Set<string>();
  const foldedIds = new Set<string>();
  const physicalRoutes = new Set<string>();
  const foldedRoutes = new Set<string>();
  const sourcePaths = new Set<string>();
  const foldedPaths = new Set<string>();
  for (const page of pages) {
    if (page.title.length > 160 || page.description.length > 320 || /[\u0000-\u001f\u007f]/.test(`${page.title}${page.description}`)) {
      throw new Error("docs page metadata must be bounded single-line public text");
    }
    validateSafePath(page.id, "page id");
    validateSafePath(page.canonicalId, "canonical page id");
    validateSafePath(page.sourcePath, "page source path");
    if (!page.sourcePath.startsWith(`generated/docs/${page.locale}/${page.version}/`)) throw new Error("page source path does not match its generated locale/version partition");
    for (const segment of page.slug) validateSafePath(segment, "page slug segment");
    if (resolveVersion(versions, page.version) !== page.version || page.version === versions.stableAlias) {
      throw new Error("catalog pages must use a physical current or previous version");
    }
    const idFolded = page.id.toLowerCase();
    const pathFolded = page.sourcePath.toLowerCase();
    const route = routeKey(page.locale, page.version, page.slug);
    const foldedRoute = route.toLowerCase();
    if (ids.has(page.id) || foldedIds.has(idFolded)) throw new Error("docs page ids collide");
    if (physicalRoutes.has(route) || foldedRoutes.has(foldedRoute)) throw new Error("docs page routes collide");
    if (sourcePaths.has(page.sourcePath) || foldedPaths.has(pathFolded)) throw new Error("docs page source paths collide");
    ids.add(page.id);
    foldedIds.add(idFolded);
    physicalRoutes.add(route);
    foldedRoutes.add(foldedRoute);
    sourcePaths.add(page.sourcePath);
    foldedPaths.add(pathFolded);
  }

  for (const locale of DOCS_LOCALES) for (const version of [versions.currentStable, versions.previousStable]) {
    if (!pages.some((page) => page.locale === locale && page.version === version && page.slug.length === 0)) {
      throw new Error(`docs catalog is missing the ${locale}/${version} root page`);
    }
  }

  const byId = new Map(pages.map((page) => [page.id, page]));
  for (const page of pages) {
    const siblingKeys = new Set<string>();
    for (const sibling of page.siblings) {
      const resolved = resolveVersion(versions, sibling.version);
      const target = byId.get(sibling.pageId);
      const key = `${sibling.locale}/${sibling.version}`;
      if (!resolved || siblingKeys.has(key)) throw new Error("docs page sibling declarations collide or use an unsupported version");
      if (!target || target.locale !== sibling.locale || target.version !== resolved || target.canonicalId !== page.canonicalId) {
        throw new Error("docs page sibling declaration does not identify an exact sibling");
      }
      siblingKeys.add(key);
    }
  }

  return Object.freeze({
    schemaVersion: 1,
    sourceRelease: Object.freeze({ ...input.sourceRelease }),
    locales: Object.freeze(["en", "vi"]) as readonly ["en", "vi"],
    ...versions,
    pages: Object.freeze(pages),
  });
}

export async function loadDocsContentCatalog(catalogPath: string, contentRoot: string): Promise<DocsContentCatalog> {
  let value: unknown;
  try {
    value = JSON.parse(await readFile(catalogPath, "utf8"));
  } catch (error) {
    throw new Error(`unable to read the Phase 8 docs catalog at ${catalogPath}`, { cause: error });
  }
  const catalog = parseDocsContentCatalog(value);
  const root = await realpath(contentRoot);
  for (const page of catalog.pages) {
    const candidate = resolve(root, page.sourcePath);
    const actual = await realpath(candidate).catch(() => { throw new Error(`docs page source is missing: ${page.sourcePath}`); });
    const escaped = relative(root, actual);
    if (escaped === ".." || escaped.startsWith(`..${sep}`) || isAbsolute(escaped)) throw new Error(`docs page source escapes the content root: ${page.sourcePath}`);
    const info = await stat(actual);
    if (!info.isFile() || !/\.mdx?$/.test(page.sourcePath)) throw new Error(`docs page source is not a Markdown file: ${page.sourcePath}`);
    publicMarkdown(await readFile(actual, "utf8"));
  }
  return catalog;
}

export function enumerateDocsRoutes(catalog: DocsContentCatalog): readonly DocsRouteParam[] {
  const routes: DocsRouteParam[] = [];
  for (const page of catalog.pages) {
    routes.push(Object.freeze({ locale: page.locale, version: page.version, slug: page.slug }));
    if (page.version === catalog.currentStable) routes.push(Object.freeze({ locale: page.locale, version: catalog.stableAlias, slug: page.slug }));
  }
  routes.sort((left, right) => routeKey(left.locale, left.version, left.slug).localeCompare(routeKey(right.locale, right.version, right.slug)));
  const keys = routes.map((route) => routeKey(route.locale, route.version, route.slug));
  if (new Set(keys).size !== keys.length) throw new Error("docs route expansion produced a duplicate route");
  return Object.freeze(routes);
}

export function findCatalogPage(catalog: DocsContentCatalog, locale: string, routeVersion: string, slug: readonly string[]): DocsCatalogPage | undefined {
  const version = resolveVersion(catalog, routeVersion);
  if (!version || !DOCS_LOCALES.includes(locale as DocsLocale)) return undefined;
  return catalog.pages.find((page) => page.locale === locale && page.version === version && page.slug.length === slug.length && page.slug.every((part, index) => part === slug[index]));
}

export function findDeclaredSibling(catalog: DocsContentCatalog, page: DocsCatalogPage, locale: DocsLocale, version: string): DocsCatalogPage | undefined {
  const declaration = page.siblings.find((sibling) => sibling.locale === locale && sibling.version === version);
  return declaration ? catalog.pages.find((candidate) => candidate.id === declaration.pageId) : undefined;
}

export function primaryVersions(catalog: DocsContentCatalog): readonly string[] {
  return navigableVersions(catalog);
}

/**
 * Effective navigation visibility. A page with no declared visibility is
 * `"global-sidebar"` so the current unadorned catalog continues to render
 * exactly as it does today; later phases opt individual pages into
 * `"reference-only"` (search-and-static-only, e.g. command details) or
 * `"hidden"` (routed but never surfaced anywhere).
 */
export function resolveNavigationVisibility(page: DocsCatalogPage): DocsNavigationVisibility {
  return page.navigationVisibility ?? "global-sidebar";
}

/**
 * Sidebar section a page belongs to. Uses the authored `page.section` when
 * present; otherwise infers it from the page's first slug segment so the
 * sidebar can group even before Phase 4 populates the metadata field. Unknown
 * slug prefixes fall into `meta` so nothing disappears from the sidebar.
 */
export function resolveSection(page: DocsCatalogPage): DocsSection {
  if (page.section !== undefined) return page.section;
  const first = page.slug[0];
  if (first === "get-started" || first === "concepts" || first === "guides" || first === "reference" || first === "release-notes") return first;
  return "meta";
}

/** Canonical top-to-bottom order of sidebar sections. */
export const SIDEBAR_SECTION_ORDER: readonly DocsSection[] = Object.freeze([
  "get-started",
  "concepts",
  "guides",
  "reference",
  "release-notes",
  "meta",
]);

/**
 * Pages a global sidebar should enumerate for the given locale/version. Command
 * detail pages (`reference-only`) and hidden routes drop out; everything else
 * is preserved in catalog order so the sidebar keeps its authored sequence.
 */
export function sidebarPages(catalog: DocsContentCatalog, locale: DocsLocale, version: string): readonly DocsCatalogPage[] {
  const resolved = resolveVersion(catalog, version);
  if (!resolved) return [];
  return Object.freeze(
    catalog.pages.filter(
      (page) => page.locale === locale && page.version === resolved && resolveNavigationVisibility(page) === "global-sidebar",
    ),
  );
}
