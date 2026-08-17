import type { DocsLocale } from "@/lib/i18n.ts";

// Phase 4 closed content component — Command block. Renders as a plain
// `<figure><pre><code>` structure so it is fully readable, selectable, and
// copyable by hand with JavaScript disabled — the same structure
// `document-copy-enhancer.tsx` already progressively enhances by attaching a
// "Copy code" button (with a keyboard-focusable clipboard-unavailable
// fallback textarea) to every `<pre>` inside the hydrated root. This
// component intentionally does NOT reimplement copy affordance or fallback
// text; duplicating it here would drift from the one enhancer every other
// code block on the site already uses.
//
// `command`/`output` are literal strings supplied by TypeScript
// screen-experience callers (never raw authored MDX), so no escaping step is
// needed beyond what React already does for text children.

interface CommandBlockStrings {
  readonly languageLabel: string;
  readonly outputLabel: string;
}

const STRINGS: Record<DocsLocale, CommandBlockStrings> = {
  en: { languageLabel: "Language", outputLabel: "Output" },
  vi: { languageLabel: "Ngôn ngữ", outputLabel: "Kết quả" },
};

export interface CommandBlockProps {
  readonly locale: DocsLocale;
  readonly command: string;
  readonly output?: string;
  readonly language?: string;
  readonly caption?: string;
  readonly id?: string;
}

export function CommandBlock({ locale, command, output, language = "bash", caption, id }: CommandBlockProps) {
  const strings = STRINGS[locale] ?? STRINGS.en;
  return (
    <figure id={id}>
      <figcaption>
        {caption && <span>{caption} — </span>}
        {strings.languageLabel}: <code>{language}</code>
      </figcaption>
      <pre data-language={language}>
        <code>{command}</code>
      </pre>
      {output !== undefined && (
        <>
          <p>{strings.outputLabel}</p>
          <pre data-language="text">
            <code>{output}</code>
          </pre>
        </>
      )}
    </figure>
  );
}
