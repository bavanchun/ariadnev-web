import type { DocsCatalogPage } from "@/lib/content-catalog.ts";
import type { DocsScreenContext } from "../docs-screen-registry.tsx";
import { ReferenceIndexFilter } from "./reference-index-filter.tsx";

// D12 — CLI command index. Grouped by source-derived namespace (every
// subcommand of a family like `ariadnev mcp add` / `ariadnev mcp list`
// shares one heading; a command with no subcommands falls into "Other
// commands"), fully server-rendered so the grouping and every link work
// without JavaScript.
//
// This intentionally does not reuse the generated Markdown body
// (`children`): the generated `reference/cli/` Markdown stays a flat,
// byte-minimal table on purpose because it is indexed verbatim into the
// search partition, which has effectively zero headroom left under its
// frozen compressed cap
// (`tests/benchmarks/performance-budgets.json#search-index-en-compressed`).
// The grouping the D12 requirement asks for is instead composed here, at
// request time, from the catalog's own command-detail entries — the exact
// same `title`/`description`/route data the flat Markdown table carries, so
// nothing here can drift from the release. `ReferenceIndexFilter` then
// layers a progressive filter on top of this server-rendered structure.

const STRINGS = {
  en: {
    introPrefix: "Every command below has its own page with arguments, options, and aliases. ",
    introAnd: " and ",
    introSuffix: " are interchangeable everywhere.",
    otherCommands: "Other commands",
    command: "Command",
    description: "Description",
    filterLabel: "Filter commands",
    filterPlaceholder: "Filter by command or description",
    filterNoMatches: "No commands match this filter.",
  },
  vi: {
    introPrefix: "Mỗi lệnh dưới đây có trang riêng với tham số, tùy chọn và bí danh. ",
    introAnd: " và ",
    introSuffix: " dùng thay cho nhau ở mọi nơi.",
    otherCommands: "Các lệnh khác",
    command: "Lệnh",
    description: "Mô tả",
    filterLabel: "Lọc lệnh",
    filterPlaceholder: "Lọc theo tên lệnh hoặc mô tả",
    filterNoMatches: "Không có lệnh nào khớp bộ lọc.",
  },
} as const;

/** First slug segment before a `-`, or the whole segment when there is none — the same rule `commandNamespace` in the content generator applies to the source command path, applied here to the route slug. */
function namespaceOf(slug: string): string {
  return slug.split("-")[0] ?? slug;
}

function groupCommands(pages: readonly DocsCatalogPage[]): { namespace: string; members: DocsCatalogPage[] }[] {
  const byNamespace = new Map<string, DocsCatalogPage[]>();
  for (const page of pages) {
    const own = page.slug[page.slug.length - 1] ?? "";
    const namespace = namespaceOf(own);
    const members = byNamespace.get(namespace);
    if (members) members.push(page);
    else byNamespace.set(namespace, [page]);
  }
  const namespaces = [...byNamespace.keys()].sort((left, right) => left.localeCompare(right, "en"));
  const groups: { namespace: string; members: DocsCatalogPage[] }[] = [];
  const standalone: DocsCatalogPage[] = [];
  for (const namespace of namespaces) {
    const members = byNamespace.get(namespace)!;
    if (members.length === 1 && namespace !== "ariadnev") {
      standalone.push(...members);
      continue;
    }
    groups.push({ namespace, members: members.sort((left, right) => left.title.localeCompare(right.title, "en")) });
  }
  if (standalone.length > 0) {
    groups.push({ namespace: "", members: standalone.sort((left, right) => left.title.localeCompare(right.title, "en")) });
  }
  return groups;
}

export function CliCommandIndexExperience({ catalog, catalogPage, routeVersion }: DocsScreenContext) {
  const strings = STRINGS[catalogPage.locale] ?? STRINGS.en;
  const commandPages = catalog.pages.filter(
    (page) => page.screenKind === "D13-cli-command-detail" && page.locale === catalogPage.locale && page.version === catalogPage.version,
  );
  const groups = groupCommands(commandPages);
  const href = (page: DocsCatalogPage) => `/${[page.locale, routeVersion, ...page.slug].join("/")}/`;

  return (
    <>
      <p>{strings.introPrefix}<code>ariadnev</code>{strings.introAnd}<code>av</code>{strings.introSuffix}</p>
      <ReferenceIndexFilter
        rootId="rendered-markdown"
        label={strings.filterLabel}
        placeholder={strings.filterPlaceholder}
        noMatchesLabel={strings.filterNoMatches}
      />
      {groups.map(({ namespace, members }) => (
        <div key={namespace || "other"}>
          <h3>{namespace ? namespace : strings.otherCommands}</h3>
          <table>
            <thead>
              <tr><th>{strings.command}</th><th>{strings.description}</th></tr>
            </thead>
            <tbody>
              {members.map((page) => (
                <tr key={page.id}>
                  <td><a href={href(page)}><code>{page.title}</code></a></td>
                  <td>{page.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </>
  );
}
