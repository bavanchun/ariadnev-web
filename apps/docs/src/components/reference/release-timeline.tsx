import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { DocsScreenContext } from "../docs-screen-registry.tsx";
import { docsContentRoot } from "@/lib/content-source.ts";

// D17 — Release notes. `renderReleaseNotes` (the generated Markdown body,
// rendered unchanged below) already carries the edition metadata block and
// the source's change groups verbatim — nothing here rewrites, reorders, or
// summarises that text, and it stays the full, source-faithful record in
// initial HTML.
//
// The one thing this component adds is a "Highlights" nav that surfaces
// which of the three meaningful-by-convention headings — `Major Changes`
// (a breaking release, in the changesets vocabulary this project's release
// notes already use), `Security`, and `Migration` — the source actually
// wrote for this edition, linking straight to each one. It never infers a
// classification: the heading text is read verbatim from the same trusted
// `release-notes.md` `build-content-root.mjs` already extracted (never
// re-parsing the compiled MDX tree, and never touching `Minor Changes` /
// `Patch Changes`, which carry no breaking/security/migration meaning), and
// a release that has none of the three renders no nav at all.

const HIGHLIGHT_HEADINGS: Record<string, "breaking" | "security" | "migration"> = {
  "Major Changes": "breaking",
  Security: "security",
  Migration: "migration",
};

const STRINGS = {
  en: { highlightsLabel: "Highlights in this edition", breaking: "Breaking", security: "Security", migration: "Migration" },
  vi: { highlightsLabel: "Điểm nổi bật trong ấn bản này", breaking: "Thay đổi phá vỡ", security: "Bảo mật", migration: "Di chuyển" },
} as const;

/** Mirrors the heading-id algorithm already observed on built release-notes pages (`### Minor Changes` → `minor-changes`): lowercase, non-alphanumeric runs collapse to one hyphen, no leading/trailing hyphen. */
function slugify(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

interface Highlight {
  readonly heading: string;
  readonly kind: "breaking" | "security" | "migration";
  readonly anchor: string;
}

/** Every `### <heading>` line in the raw release notes whose text is an exact, case-sensitive match for one of the three meaningful conventions — never a fuzzy or inferred match. */
function findHighlights(markdown: string): readonly Highlight[] {
  const highlights: Highlight[] = [];
  const seen = new Set<string>();
  for (const match of markdown.matchAll(/^###\s+(.+?)\s*$/gm)) {
    const heading = match[1] ?? "";
    const kind = HIGHLIGHT_HEADINGS[heading];
    if (!kind || seen.has(heading)) continue;
    seen.add(heading);
    highlights.push({ heading, kind, anchor: slugify(heading) });
  }
  return highlights;
}

function readReleaseNotesHighlights(): readonly Highlight[] {
  try {
    return findHighlights(readFileSync(join(docsContentRoot, "generated/bundle/release-notes.md"), "utf8"));
  } catch {
    return [];
  }
}

export function ReleaseTimelineExperience({ catalogPage, children }: DocsScreenContext) {
  const strings = STRINGS[catalogPage.locale] ?? STRINGS.en;
  const highlights = readReleaseNotesHighlights();

  return (
    <>
      {highlights.length > 0 && (
        <nav className="release-timeline-highlights" aria-labelledby="rt-hl">
          <span id="rt-hl" className="reference-badges-label">{strings.highlightsLabel}</span>
          <ul>
            {highlights.map((highlight) => (
              <li key={highlight.heading}>
                <a href={`#${highlight.anchor}`} className="release-timeline-badge">
                  {strings[highlight.kind]}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}
      {children}
    </>
  );
}
