import type { DocsScreenContext } from "../docs-screen-registry.tsx";
import { ReferenceIndexFilter } from "./reference-index-filter.tsx";

// D15 — Skill catalog. `renderSkillCatalog` (the generated Markdown index
// body) is a compact category index — intro plus category links and counts,
// source-derived and byte-minimal on purpose. `renderSkillCategoryPage`
// gives each category, including "Uncategorized", its own dense two-column
// table of every skill in it: name, description, and argument hint, fully
// present without JavaScript. That split — one small index, one dense table
// per category — is the load-bearing shrink that keeps every
// `reference/skills/*` route under the frozen per-route byte cap; rendering
// all 105 skills' full descriptions on a single page was measured well over
// that cap (see the phase-05 delegation report), so this stays split rather
// than collapsed onto one page.
//
// `SkillCatalogExperience` formalises the index page's D15 identity (search
// and catalog consumers can target it by screenKind) without changing its
// already-complete, already-minimal composition — the same role
// `PassThroughExperience` plays for D02.
//
// `SkillCategoryExperience` is where the D15 filter requirement actually
// applies: each category page's dense, already-server-rendered table is
// wrapped with `ReferenceIndexFilter` (the same progressive-enhancement
// filter D12 uses), so a reader can narrow by name, description keyword, or
// argument hint within that category — "category" filtering is simply
// navigating to the category's own page, which the index already links.
// With JavaScript disabled every row stays visible; nothing here can hide
// content that would otherwise be reachable.

const STRINGS = {
  en: {
    filterLabel: "Filter skills in this category",
    filterPlaceholder: "Filter by name or description",
    filterNoMatches: "No skills match this filter.",
    filterResults: "results",
    filterClear: "Clear filter",
  },
  vi: {
    filterLabel: "Lọc skill trong danh mục này",
    filterPlaceholder: "Lọc theo tên hoặc mô tả",
    filterNoMatches: "Không có skill nào khớp bộ lọc.",
    filterResults: "kết quả",
    filterClear: "Xóa bộ lọc",
  },
} as const;

export function SkillCatalogExperience({ children }: DocsScreenContext) {
  return <div className="reference-dossier skill-catalog">{children}</div>;
}

export function SkillCategoryExperience({ catalogPage, children }: DocsScreenContext) {
  const strings = STRINGS[catalogPage.locale] ?? STRINGS.en;
  // `ReferenceIndexFilter` queries every table below `#rendered-markdown`, so
  // this page-specific dossier wrapper can establish composition without
  // changing the complete server-rendered table or the no-JS path.
  return (
    <div className="reference-dossier skill-category">
      <ReferenceIndexFilter
        rootId="rendered-markdown"
        label={strings.filterLabel}
        placeholder={strings.filterPlaceholder}
        noMatchesLabel={strings.filterNoMatches}
        resultsLabel={strings.filterResults}
        clearLabel={strings.filterClear}
      />
      {children}
    </div>
  );
}
