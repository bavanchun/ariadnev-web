import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const CURRENT = "1.2.3";
const PREVIOUS = "1.1.0";
const SHA = "a".repeat(40);
const DIGEST = `sha256:${"b".repeat(64)}`;

export function catalogFixture() {
  const editions = [
    ["en", CURRENT, "English current", "Current English overview."],
    ["vi", CURRENT, "Tiếng Việt hiện tại", "Tổng quan tiếng Việt hiện tại."],
    ["en", PREVIOUS, "English previous", "Previous English overview."],
    ["vi", PREVIOUS, "Tiếng Việt trước", "Tổng quan tiếng Việt trước."],
  ];
  const pages = editions.flatMap(([locale, version, title, description]) => [
    {
      id: `${locale}/${version}/index`, canonicalId: "core/index", locale, version, slug: [],
      sourcePath: `generated/docs/${locale}/${version}/index.mdx`, title, description, siblings: [],
    },
    {
      id: `${locale}/${version}/get-started/installation`, canonicalId: "core/installation", locale, version,
      slug: ["get-started", "installation"], sourcePath: `generated/docs/${locale}/${version}/get-started/installation.mdx`,
      title: locale === "en" ? "Installation" : "Cài đặt",
      description: locale === "en" ? `Installation guidance for ${version}.` : `Hướng dẫn cài đặt cho ${version}.`, siblings: [],
    },
  ]);
  for (const page of pages) {
    page.siblings = ["en", "vi"].flatMap((locale) => ["stable", CURRENT, PREVIOUS].map((version) => ({
      locale,
      version,
      pageId: `${locale}/${version === "stable" ? CURRENT : version}/${page.slug.length === 0 ? "index" : page.slug.join("/")}`,
    })));
  }
  return {
    schemaVersion: 1,
    sourceRelease: { mode: "final", version: CURRENT, releaseTag: `ariadnev@${CURRENT}`, sourceSha: SHA, generatorSha: SHA, schemaDigest: DIGEST },
    locales: ["en", "vi"],
    currentStable: CURRENT,
    previousStable: PREVIOUS,
    stableAlias: "stable",
    pages,
  };
}

export async function temporaryContent(catalog = catalogFixture()) {
  const root = await mkdtemp(join(tmpdir(), "ariadnev-docs-contract-"));
  for (const page of catalog.pages) {
    const target = join(root, page.sourcePath);
    await mkdir(join(target, ".."), { recursive: true });
    const installation = page.canonicalId === "core/installation";
    const term = page.locale === "en"
      ? (installation ? "installation-only" : "overview-only")
      : (installation ? "cài-đặt-riêng" : "tổng-quan-riêng");
    await writeFile(target, `---\ntitle: ${page.title}\ndescription: ${page.description}\n---\n\n## Overview\n\n${term} for ${page.version}.\n`, "utf8");
  }
  const catalogPath = join(root, "generated/catalog.json");
  await mkdir(join(root, "generated"), { recursive: true });
  await writeFile(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
  return { root, catalogPath };
}
