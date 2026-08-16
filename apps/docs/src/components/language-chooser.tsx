import { LOCALE_LABELS } from "@/lib/i18n.ts";

export function LanguageChooser() {
  return (
    <nav aria-label="Documentation languages" className="language-chooser">
      <a href="/en/stable/" lang="en">{LOCALE_LABELS.en}</a>
      <a href="/vi/stable/" lang="vi">{LOCALE_LABELS.vi}</a>
    </nav>
  );
}
