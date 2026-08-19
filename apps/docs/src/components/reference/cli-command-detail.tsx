import type { DocsScreenContext } from "../docs-screen-registry.tsx";

// D13 — CLI command detail. The synopsis/arguments/options body (rendered by
// `scripts/docs-content/render-reference-pages.mjs#renderCliCommandDetail`)
// is already semantic Markdown: an "Arguments" table and an "Options" table
// with the same three-column shape (name / required / description), fully
// present without JavaScript. This wrapper adds the one piece that needs
// catalog knowledge the generator does not have at content-build time —
// "related commands" in the same source-derived namespace — as a
// server-rendered, always-visible nav so a reader can move between sibling
// commands (e.g. `ariadnev mcp add` <-> `ariadnev mcp list`) without going
// back through the index. No client code: the namespace lookup and the
// links are computed once, at request time, from the closed catalog.

const STRINGS = {
  en: {
    dossierLabel: "Command dossier",
    commandLabel: "Canonical command",
    editionLabel: "Source edition",
    authorityLabel: "Authority",
    authorityValue: "Verified release projection",
    relatedHeading: "Related commands",
    relatedAria: "Other commands in this namespace",
  },
  vi: {
    dossierLabel: "Hồ sơ lệnh",
    commandLabel: "Lệnh chuẩn",
    editionLabel: "Ấn bản nguồn",
    authorityLabel: "Nguồn thẩm quyền",
    authorityValue: "Bản chiếu từ bản phát hành đã xác minh",
    relatedHeading: "Lệnh liên quan",
    relatedAria: "Các lệnh khác trong cùng nhóm",
  },
} as const;

/** First slug segment before a `-`, or the whole segment when there is none — mirrors `commandNamespace` in the content generator, computed here from the route slug instead of the source command path. */
function namespaceOf(slug: string): string {
  return slug.split("-")[0] ?? slug;
}

export function CliCommandDetailExperience({ catalog, catalogPage, routeVersion, children }: DocsScreenContext) {
  const strings = STRINGS[catalogPage.locale] ?? STRINGS.en;
  const ownSlug = catalogPage.slug[catalogPage.slug.length - 1] ?? "";
  const namespace = namespaceOf(ownSlug);
  const related = catalog.pages
    .filter((page) => {
      if (page.screenKind !== "D13-cli-command-detail") return false;
      if (page.locale !== catalogPage.locale || page.version !== catalogPage.version) return false;
      if (page.id === catalogPage.id) return false;
      const slug = page.slug[page.slug.length - 1] ?? "";
      return namespaceOf(slug) === namespace;
    })
    .sort((left, right) => left.title.localeCompare(right.title, "en"));

  return (
    <div className="reference-dossier cli-command-detail">
      <aside className="command-dossier-ledger" data-surface-context="instrument" aria-label={strings.dossierLabel}>
        <p>{strings.dossierLabel}</p>
        <dl>
          <div><dt>{strings.commandLabel}</dt><dd><code>{catalogPage.title}</code></dd></div>
          <div><dt>{strings.editionLabel}</dt><dd><code>{catalogPage.version}</code></dd></div>
          <div><dt>{strings.authorityLabel}</dt><dd>{strings.authorityValue}</dd></div>
        </dl>
      </aside>
      <div className="command-dossier-body">{children}</div>
      {related.length > 0 && (
        <nav className="cli-command-related" data-surface-context="instrument" aria-label={strings.relatedAria}>
          <h2>{strings.relatedHeading}</h2>
          <ul>
            {related.map((page) => (
              <li key={page.id}>
                <a href={`/${[page.locale, routeVersion, ...page.slug].join("/")}/`}>{page.title}</a>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
}
