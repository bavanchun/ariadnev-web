// D18 docs not-found: static-export 404 renders EN and VI recovery blocks
// side-by-side. Every visitor sees a working escape in either language
// without JavaScript. `noindex` prevents search engines from indexing the
// 404 as a real destination. No client script — the client-side locale
// detector would ride in the shared bundle and busts the frozen 300000
// cap on content-heavy VI routes (see phase-03-docs-safety-and-shell.md).
export const metadata = {
  title: "Documentation page not found",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <main className="not-found">
      <div className="not-found-block" data-not-found-lang="en">
        <h1>Documentation page not found</h1>
        <p>This locale, version, or page is not part of the published static catalog.</p>
        <nav aria-label="Documentation recovery">
          <a href="/en/stable/">Current English docs</a>
          <a href="/">Choose a language</a>
        </nav>
      </div>
      <div className="not-found-block" data-not-found-lang="vi" lang="vi">
        <h1>Không tìm thấy trang tài liệu</h1>
        <p>Ngôn ngữ, phiên bản hoặc trang này không nằm trong danh mục tĩnh đã xuất bản.</p>
        <nav aria-label="Khôi phục tài liệu">
          <a href="/vi/stable/">Tài liệu tiếng Việt hiện tại</a>
          <a href="/">Chọn ngôn ngữ</a>
        </nav>
      </div>
    </main>
  );
}
