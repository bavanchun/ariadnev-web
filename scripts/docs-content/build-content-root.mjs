#!/usr/bin/env node
// Build the docs content root from a release docs bundle.
//
//   node scripts/docs-content/build-content-root.mjs \
//     [--pin releases/ariadnev.json] [--out apps/docs/content] [--authored <dir>]
//
// Inputs
//   - The release pin (`releases/ariadnev.json`) names the exact release and
//     the committed bundle + manifest that were synchronised from it. Nothing
//     is fetched at build time: the bundle is a checked-in immutable artifact.
//   - `apps/docs/content/authored/{en,vi}/**.mdx` — hand-written pages. Every
//     authored page must exist in both locales; the build fails otherwise.
//
// Output (`<out>/generated/`, gitignored)
//   - `catalog.json` — the contract `apps/docs/src/lib/content-catalog.ts` parses.
//   - `docs/{en,vi}/{version}/**.mdx` — one MDX file per catalog page.
//   - `bundle/` — the verified payload of the bundle, for tests and audits.
//
// The bundle is verified with `@ariadnev-web/contracts` before a single byte of
// it is read; the trusted schema digest lives in that package. The result is
// deterministic: the same pin, bundle, and authored tree produce byte-identical
// output, which `tests/docs/content-pipeline.test.mjs` asserts.

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync, renameSync, mkdtempSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_RETIRED_ROUTES, extractDocsBundle, TRUSTED_SCHEMA_DIGEST } from "../../packages/contracts/dist/index.js";
import {
  GENERATED_PAGE_IDS,
  cliCommandSlug,
  groupSkillsByCategory,
  planSkillCategoryPages,
  renderCliCommandDetail,
  renderCliCommandIndex,
  renderPreviousRoot,
  renderProviderReference,
  renderReleaseNotes,
  renderRetiredCliRoute,
  renderSkillCatalog,
  renderSkillCategoryPage,
  renderWorkflowReference,
} from "./render-reference-pages.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const LOCALES = ["en", "vi"];
const STABLE_ALIAS = "stable";
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

// ------------------------------------------------------------------ arguments

export function parseArguments(argv) {
  const options = { pin: "releases/ariadnev.json", out: "apps/docs/content", authored: undefined };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const value = argv[index + 1];
    if ((argument === "--pin" || argument === "--out" || argument === "--authored") && value && !value.startsWith("--")) {
      options[argument.slice(2)] = value;
      index += 1;
    } else {
      throw new Error(`unsupported docs content argument: ${argument}`);
    }
  }
  options.authored ??= join(options.out, "authored");
  return options;
}

// ------------------------------------------------------------ release pin

export function readReleasePin(pinPath) {
  const pin = JSON.parse(readFileSync(pinPath, "utf8"));
  for (const key of ["version", "tag", "releaseUrl", "publishedAt", "sourceSha", "bundle", "manifest"]) {
    if (typeof pin[key] !== "string" || pin[key].length === 0) throw new Error(`release pin is missing ${key}`);
  }
  if (!SEMVER.test(pin.version)) throw new Error("release pin version must be a stable semver");
  if (pin.tag !== `ariadnev@${pin.version}`) throw new Error("release pin tag must be ariadnev@<version>");
  if (!/^[a-f0-9]{40}$/.test(pin.sourceSha)) throw new Error("release pin sourceSha must be a 40-hex commit");
  return pin;
}

// --------------------------------------------------------------- authored

function walk(dir, base = dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir).sort()) {
    const abs = join(dir, entry);
    if (statSync(abs).isDirectory()) walk(abs, base, out);
    else if (entry.endsWith(".mdx")) out.push(relative(base, abs).split(sep).join("/"));
  }
  return out;
}

export function parseFrontmatter(source, label) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(source);
  if (!match) throw new Error(`${label}: missing frontmatter`);
  const fields = {};
  for (const line of match[1].split(/\r?\n/)) {
    const pair = /^([a-zA-Z]+):\s*(.*)$/.exec(line);
    if (!pair) throw new Error(`${label}: unreadable frontmatter line "${line}"`);
    let value = pair[2].trim();
    if (value.startsWith('"')) value = JSON.parse(value);
    fields[pair[1]] = value;
  }
  for (const key of ["title", "description"]) {
    if (typeof fields[key] !== "string" || fields[key].length === 0) throw new Error(`${label}: frontmatter needs ${key}`);
  }
  if (/^#\s/m.test(source.slice(match[0].length))) throw new Error(`${label}: body must not contain an H1; the title is the H1`);
  return { title: fields.title, description: fields.description, body: source };
}

/** Authored pages keyed by relative path, checked for EN/VI parity. */
export function loadAuthoredPages(authoredRoot) {
  const perLocale = new Map(LOCALES.map((locale) => [locale, walk(join(authoredRoot, locale))]));
  const [en, vi] = LOCALES.map((locale) => perLocale.get(locale));
  const missingVi = en.filter((path) => !vi.includes(path));
  const missingEn = vi.filter((path) => !en.includes(path));
  if (missingVi.length || missingEn.length) {
    throw new Error(`authored pages must exist in both locales; missing vi: [${missingVi}] missing en: [${missingEn}]`);
  }
  const pages = [];
  for (const locale of LOCALES) {
    for (const path of perLocale.get(locale)) {
      const label = `${locale}/${path}`;
      const source = readFileSync(join(authoredRoot, locale, path), "utf8");
      const parsed = parseFrontmatter(source, label);
      const pageId = path.replace(/\.mdx$/, "");
      if (!/^[a-z0-9][a-z0-9/-]*$/.test(pageId) || pageId.includes("//")) throw new Error(`${label}: page path must be lowercase kebab segments`);
      pages.push({ locale, pageId, canonicalId: `core/${pageId}`, ...parsed });
    }
  }
  return pages;
}

// ---------------------------------------------------------------- catalog

const SECTION_ORDER = ["", "get-started", "concepts", "guides", "reference", "release-notes"];
const PAGE_ORDER = {
  "get-started": ["installation", "first-install"],
  concepts: ["kit-and-adapt-engine", "graph-execution", "evaluation"],
  guides: ["upgrading", "configuration", "uninstall-and-doctor", "migration-from-vcskill"],
  reference: ["cli", "providers", "skills", "workflows"],
};

/** Reading-order rank of a catalog entry: section first, then the authored page order inside it. */
function sectionRank(entry) {
  const [section, ...rest] = entry.slug;
  const sectionIndex = entry.slug.length === 0 ? 0 : SECTION_ORDER.indexOf(section);
  const pageIndex = (PAGE_ORDER[section] ?? []).indexOf(rest.join("/"));
  return (sectionIndex === -1 ? SECTION_ORDER.length : sectionIndex) * 100 + (pageIndex === -1 ? 50 : pageIndex);
}

function slugOf(pageId) {
  return pageId === "index" ? [] : pageId.split("/");
}

function catalogEntry({ locale, version, pageId, canonicalId, title, description, metadata }) {
  const entry = {
    id: `${locale}/${version}/${pageId}`,
    canonicalId,
    locale,
    version,
    slug: slugOf(pageId),
    sourcePath: `generated/docs/${locale}/${version}/${pageId}.mdx`,
    title,
    description,
    siblings: [],
  };
  // Optional Living Atlas metadata; only set when provided so an authored page
  // without metadata still round-trips as-is through parseDocsContentCatalog.
  if (metadata?.pageKind) entry.pageKind = metadata.pageKind;
  if (metadata?.screenKind) entry.screenKind = metadata.screenKind;
  if (metadata?.section) entry.section = metadata.section;
  if (metadata?.navigationVisibility) entry.navigationVisibility = metadata.navigationVisibility;
  return entry;
}

function attachSiblings(entries, currentStable, previousStable) {
  const byKey = new Map(entries.map((entry) => [`${entry.locale}/${entry.version}/${entry.canonicalId}`, entry]));
  for (const entry of entries) {
    for (const locale of LOCALES) {
      for (const routeVersion of [STABLE_ALIAS, currentStable, previousStable]) {
        const physical = routeVersion === STABLE_ALIAS ? currentStable : routeVersion;
        const target = byKey.get(`${locale}/${physical}/${entry.canonicalId}`);
        if (target) entry.siblings.push({ locale, version: routeVersion, pageId: target.id });
      }
    }
  }
}

// ------------------------------------------------------------------ build

/** JSON with recursively sorted keys, so two documents compare by content, not key order. */
function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(buffer) {
  return `sha256:${createHash("sha256").update(buffer).digest("hex")}`;
}

function toIsoInstant(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`unreadable timestamp ${value}`);
  return date.toISOString().replace(/\.000Z$/, "Z");
}

export function buildContentRoot(options) {
  const pinPath = resolve(repositoryRoot, options.pin);
  const pin = readReleasePin(pinPath);
  const outRoot = resolve(repositoryRoot, options.out);
  const authoredRoot = resolve(repositoryRoot, options.authored);
  const generatedRoot = join(outRoot, "generated");

  // 1. Verify the bundle before reading any of it. Extraction is atomic into a
  //    staging directory that becomes the final `generated/` on success.
  const archive = readFileSync(resolve(repositoryRoot, pin.bundle));
  if (pin.bundleSha256 && sha256(archive) !== `sha256:${pin.bundleSha256}`) throw new Error("bundle bytes do not match the release pin's bundleSha256");
  const manifestBytes = readFileSync(resolve(repositoryRoot, pin.manifest));
  mkdirSync(join(outRoot, ".staging"), { recursive: true });
  const staging = mkdtempSync(join(outRoot, ".staging", "generated-"));
  try {
    const bundleDir = join(staging, "bundle");
    const extracted = extractDocsBundle({
      archive,
      destination: bundleDir,
      expected: { releaseTag: pin.tag, version: pin.version, sourceSha: pin.sourceSha, mode: "final" },
      trustedSchemaDigest: TRUSTED_SCHEMA_DIGEST,
    });
    // The detached manifest must be the same document the archive carries.
    const detached = JSON.parse(manifestBytes.toString("utf8"));
    if (canonicalJson(detached) !== canonicalJson(extracted.manifest)) throw new Error("detached manifest differs from the archive manifest");

    const readJson = (path) => JSON.parse(readFileSync(join(bundleDir, path), "utf8"));
    const commands = readJson("reference/cli/commands.json").commands;
    const providers = readJson("reference/providers/providers.json").providers;
    const skills = readJson("reference/skills/skills.json");
    const workflows = readJson("reference/workflows/workflows.json");
    const previous = readJson("reference/previous-stable/bootstrap.json");
    const releaseNotes = readFileSync(join(bundleDir, "release-notes.md"), "utf8");

    const currentStable = extracted.manifest.version;
    const previousMatch = /^(?:ariadnev|vcskill)@(.+)$/.exec(previous.releaseTag ?? "");
    const previousStable = previousMatch?.[1];
    if (!previousStable || !SEMVER.test(previousStable)) throw new Error("previous-stable bootstrap has no stable release tag");

    // 2. Assemble pages.
    const files = new Map(); // relative path under generated/ -> content
    const entries = [];
    // Authored and generated pages link to each other with `%ROOT%`, which
    // becomes the edition prefix: `stable` for the current release so a reader
    // stays on the alias, the physical version for the previous edition.
    const add = (locale, version, pageId, canonicalId, title, description, body, metadata) => {
      const entry = catalogEntry({ locale, version, pageId, canonicalId, title, description, metadata });
      entries.push(entry);
      const root = `/${locale}/${version === currentStable ? STABLE_ALIAS : version}/`;
      files.set(entry.sourcePath.replace(/^generated\//, ""), body.replaceAll("%ROOT%", root));
    };
    const meta = (body) => parseFrontmatter(body, "generated");

    // D13 CLI command detail metadata — reference-only pages hide from the
    // global sidebar, so an authored top-level shelf is never crowded by 50+
    // command entries; catalog consumers still find them by pageKind/screenKind.
    const commandDetailMeta = { pageKind: "command", screenKind: "D13-cli-command-detail", section: "reference", navigationVisibility: "reference-only" };
    // Retired CLI slugs get their own 200 landing so an old URL never
    // 404s: a `replaced` entry points at the current command; a
    // `tombstone` entry explains why it's gone. Same reference-only
    // visibility as command detail pages — retired URLs are contract
    // debt, not sidebar navigation. `DEFAULT_RETIRED_ROUTES` is
    // currently empty (see packages/contracts/src/cli-command-registry.ts)
    // so this emits zero routes today; the pipeline is ready for the
    // first rename or removal without a separate wiring change.
    const commandRetiredMeta = { pageKind: "command", screenKind: "D13-cli-command-retired", section: "reference", navigationVisibility: "reference-only" };
    const emitRetiredCliRoutes = (locale, version) => {
      for (const [oldSlug, retired] of DEFAULT_RETIRED_ROUTES) {
        const pageId = `reference/cli/${oldSlug}`;
        const body = renderRetiredCliRoute(locale, oldSlug, retired);
        const parsed = meta(body);
        add(locale, version, pageId, pageId, parsed.title, parsed.description, body, commandRetiredMeta);
      }
    };
    // D15 per-category skills page metadata — reference-only so the global
    // sidebar stays anchored to the authored top-level shelf; the main
    // /reference/skills/ index is the single sidebar entry that links out to
    // every category. Splitting is the load-bearing shrink that brings all
    // four grandfathered skills ceilings under the frozen 302,000 byte cap
    // (see docs/decisions/docs-performance-baselines.md#shrink-criterion).
    const skillCategoryMeta = { pageKind: "skill-category", screenKind: "D15-skill-category", section: "reference", navigationVisibility: "reference-only" };
    const emitSkillPages = (locale, version, skillList) => {
      // Main index: intro + category links only. Full descriptions live on
      // per-category detail pages so each page comfortably fits the cap.
      const indexBody = renderSkillCatalog(locale, skillList);
      const indexMeta = meta(indexBody);
      add(locale, version, GENERATED_PAGE_IDS.skills, GENERATED_PAGE_IDS.skills, indexMeta.title, indexMeta.description, indexBody);
      // Per-category detail pages. Canonical id keys off the page slug so
      // sibling resolution matches by identity across locales/editions,
      // including chunked pages of a large category (e.g. `utilities-2`).
      const groups = groupSkillsByCategory(skillList);
      for (const category of [...groups.keys()].sort((left, right) => left.localeCompare(right, "en"))) {
        const pages = planSkillCategoryPages(category, groups.get(category));
        for (const page of pages) {
          const pageId = `reference/skills/${page.slug}`;
          const body = renderSkillCategoryPage(locale, category, page.skills, { pageIndex: page.index, siblingPages: pages });
          const parsed = meta(body);
          add(locale, version, pageId, pageId, parsed.title, parsed.description, body, skillCategoryMeta);
        }
      }
    };
    const emitCliPages = (locale, version, commandList) => {
      // Index page: light summary + links to every detail page.
      const indexBody = renderCliCommandIndex(locale, commandList);
      const indexMeta = meta(indexBody);
      add(locale, version, GENERATED_PAGE_IDS.cli, GENERATED_PAGE_IDS.cli, indexMeta.title, indexMeta.description, indexBody);
      // Per-command detail pages. Canonical id embeds the slug so siblings
      // across locales/editions resolve pairwise even when a command exists in
      // one edition but not another.
      for (const command of commandList) {
        const slug = cliCommandSlug(command.path);
        const pageId = `reference/cli/${slug}`;
        const body = renderCliCommandDetail(locale, command);
        const parsed = meta(body);
        add(locale, version, pageId, pageId, parsed.title, parsed.description, body, commandDetailMeta);
      }
    };

    for (const page of loadAuthoredPages(authoredRoot)) {
      add(page.locale, currentStable, page.pageId, page.canonicalId, page.title, page.description, page.body);
    }
    for (const locale of LOCALES) {
      emitCliPages(locale, currentStable, commands);
      emitRetiredCliRoutes(locale, currentStable);
      emitSkillPages(locale, currentStable, skills);
      const generated = [
        [GENERATED_PAGE_IDS.providers, renderProviderReference(locale, providers)],
        [GENERATED_PAGE_IDS.workflows, renderWorkflowReference(locale, workflows)],
        [GENERATED_PAGE_IDS.releaseNotes, renderReleaseNotes(locale, releaseNotes)],
      ];
      for (const [pageId, body] of generated) {
        const { title, description } = meta(body);
        add(locale, currentStable, pageId, pageId, title, description, body);
      }
      // Previous edition: root + the reference the historical projection carries.
      const root = renderPreviousRoot(locale, previousStable, currentStable);
      add(locale, previousStable, "index", "core/index", meta(root).title, meta(root).description, root);
      const projection = previous.historicalProjection ?? {};
      if (projection.cli?.commands) {
        emitCliPages(locale, previousStable, projection.cli.commands);
      }
      if (projection.providers?.providers) {
        const body = renderProviderReference(locale, projection.providers.providers);
        add(locale, previousStable, GENERATED_PAGE_IDS.providers, GENERATED_PAGE_IDS.providers, meta(body).title, meta(body).description, body);
      }
    }
    for (const locale of LOCALES) {
      if (!entries.some((entry) => entry.locale === locale && entry.version === currentStable && entry.slug.length === 0)) {
        throw new Error(`authored content is missing the ${locale} index page`);
      }
    }
    // Catalog order is the sidebar order the docs shell renders, so sort by
    // reading order — locale, edition, then section rank — instead of by id.
    // Within a section, pages keep their authored path order.
    entries.sort((left, right) => left.locale.localeCompare(right.locale, "en")
      || right.version.localeCompare(left.version, "en", { numeric: true })
      || sectionRank(left) - sectionRank(right)
      || left.id.localeCompare(right.id, "en"));
    attachSiblings(entries, currentStable, previousStable);

    const catalog = {
      schemaVersion: 1,
      sourceRelease: {
        mode: "final",
        version: currentStable,
        releaseTag: extracted.manifest.releaseTag,
        sourceSha: extracted.manifest.sourceSha,
        generatorSha: extracted.manifest.generatorSha,
        schemaDigest: TRUSTED_SCHEMA_DIGEST,
      },
      locales: ["en", "vi"],
      currentStable,
      previousStable,
      stableAlias: STABLE_ALIAS,
      pages: entries,
    };

    // 3. Write everything under staging, then swap it in.
    for (const [path, body] of files) {
      const target = join(staging, path);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, body, "utf8");
    }
    writeFileSync(join(staging, "catalog.json"), `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
    rmSync(generatedRoot, { recursive: true, force: true });
    renameSync(staging, generatedRoot);

    return {
      generatedRoot,
      catalog,
      pageCount: entries.length,
      bundleDigest: sha256(archive),
      publishedAt: toIsoInstant(pin.publishedAt),
      /** Absolute path of the detached release manifest, for the docs deployment to serve verbatim. */
      manifestPath: resolve(repositoryRoot, pin.manifest),
    };
  } catch (error) {
    rmSync(staging, { recursive: true, force: true });
    throw error;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const options = parseArguments(process.argv.slice(2));
  const result = buildContentRoot(options);
  process.stdout.write(`${JSON.stringify({ generatedRoot: relative(repositoryRoot, result.generatedRoot), pages: result.pageCount, currentStable: result.catalog.currentStable, previousStable: result.catalog.previousStable, bundleDigest: result.bundleDigest })}\n`);
}
