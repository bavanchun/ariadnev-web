// Single authority for every chrome string the docs shell renders. Every
// component that draws part of the frame (header, sidebar, breadcrumb, TOC,
// switchers, search dialog, footer) reads from this table so a VI page can
// never accidentally ship an English aria-label or link text. Adding a new
// chrome string means adding both locales here; the TypeScript type on
// `ChromeStrings` fails the build if one is missing.
//
// This file is intentionally free of imports and side effects so it can be
// consumed from any Server or Client Component without dragging runtime.

export type DocsLocale = "en" | "vi";

export interface ChromeStrings {
  readonly skipToContent: string;
  readonly brandHomeLabel: string;
  readonly sidebarLabel: string;
  readonly breadcrumbLabel: string;
  readonly breadcrumbRoot: string;
  readonly tocLabel: string;
  readonly tocMobileHeading: string;
  readonly switcherLabel: string;
  readonly switcherLanguageLabel: string;
  readonly switcherVersionLabel: string;
  readonly searchOpenLabel: string;
  readonly searchCloseLabel: string;
  readonly searchInputLabel: string;
  readonly searchPlaceholder: string;
  readonly searchNoResults: string;
  readonly searchResultsLabel: string;
  readonly searchLoading: string;
  readonly searchError: string;
  readonly copyOptionsLabel: string;
}

const en: ChromeStrings = {
  skipToContent: "Skip to documentation",
  brandHomeLabel: "ariadnev docs home",
  sidebarLabel: "Documentation pages",
  breadcrumbLabel: "Breadcrumb",
  breadcrumbRoot: "Docs",
  tocLabel: "On this page",
  tocMobileHeading: "On this page",
  switcherLabel: "Documentation edition",
  switcherLanguageLabel: "Language",
  switcherVersionLabel: "Version",
  searchOpenLabel: "Search documentation",
  searchCloseLabel: "Close search",
  searchInputLabel: "Search query",
  searchPlaceholder: "Search",
  searchNoResults: "No results",
  searchResultsLabel: "search results",
  searchLoading: "Loading",
  searchError: "Search is temporarily unavailable. Use the static sidebar to browse documentation.",
  copyOptionsLabel: "Copy options",
};

const vi: ChromeStrings = {
  skipToContent: "Đến nội dung tài liệu",
  brandHomeLabel: "Trang chủ tài liệu ariadnev",
  sidebarLabel: "Trang tài liệu",
  breadcrumbLabel: "Đường dẫn phân cấp",
  breadcrumbRoot: "Tài liệu",
  tocLabel: "Trong trang này",
  tocMobileHeading: "Trong trang này",
  switcherLabel: "Ấn bản tài liệu",
  switcherLanguageLabel: "Ngôn ngữ",
  switcherVersionLabel: "Phiên bản",
  searchOpenLabel: "Tìm trong tài liệu",
  searchCloseLabel: "Đóng tìm kiếm",
  searchInputLabel: "Truy vấn tìm",
  searchPlaceholder: "Tìm",
  searchNoResults: "Không có kết quả",
  searchResultsLabel: "kết quả tìm kiếm",
  searchLoading: "Đang tải",
  searchError: "Tìm kiếm tạm thời không khả dụng. Dùng thanh điều hướng tĩnh để duyệt tài liệu.",
  copyOptionsLabel: "Tùy chọn sao chép",
};

const TABLE: Readonly<Record<DocsLocale, ChromeStrings>> = Object.freeze({ en, vi });

/** Return the chrome-string table for a docs locale. Falls back to `en` for any unknown locale. */
export function chromeStrings(locale: string): ChromeStrings {
  return TABLE[locale as DocsLocale] ?? TABLE.en;
}
