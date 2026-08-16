export const DOCS_LOCALES = ["en", "vi"] as const;
export type DocsLocale = (typeof DOCS_LOCALES)[number];

export const LOCALE_LABELS: Readonly<Record<DocsLocale, string>> = Object.freeze({
  en: "English",
  vi: "Tiếng Việt",
});

export function isDocsLocale(value: string): value is DocsLocale {
  return DOCS_LOCALES.includes(value as DocsLocale);
}
