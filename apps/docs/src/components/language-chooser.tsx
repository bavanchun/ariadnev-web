import { LOCALE_LABELS } from "@/lib/i18n.ts";

export function LanguageChooser() {
  return (
    <nav aria-label="Documentation languages" className="language-chooser">
      <ol>
        <li>
          <a href="/en/stable/" lang="en">
            <span aria-hidden="true">01</span>
            <span><strong>{LOCALE_LABELS.en}</strong><small>Guides, CLI reference, and architecture</small></span>
            <span aria-hidden="true">Enter →</span>
          </a>
        </li>
        <li>
          <a href="/vi/stable/" lang="vi">
            <span aria-hidden="true">02</span>
            <span><strong>{LOCALE_LABELS.vi}</strong><small>Hướng dẫn, tham chiếu CLI và kiến trúc</small></span>
            <span aria-hidden="true">Mở →</span>
          </a>
        </li>
      </ol>
    </nav>
  );
}
