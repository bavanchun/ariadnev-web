import { LOCALE_LABELS } from "@/lib/i18n.ts";

export function LanguageChooser() {
  return (
    <nav aria-label="Documentation languages" className="language-chooser">
      <a href="/en/stable/" lang="en" className="language-chooser-card">
        <strong className="language-chooser-title">{LOCALE_LABELS.en}</strong>
        <span className="language-chooser-desc">Guides, CLI Reference & Architecture Atlas</span>
      </a>
      <a href="/vi/stable/" lang="vi" className="language-chooser-card">
        <strong className="language-chooser-title">{LOCALE_LABELS.vi}</strong>
        <span className="language-chooser-desc">Hướng dẫn, Lệnh CLI & Bản đồ Kiến trúc</span>
      </a>
    </nav>
  );
}
