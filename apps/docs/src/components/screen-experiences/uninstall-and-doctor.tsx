import type { DocsScreenContext } from "../docs-screen-registry.tsx";
import { OperationMatrix, type OperationRow } from "../prose/index.ts";
import type { DataColumn } from "../prose/index.ts";

// D10 — Doctor/audit/backups/uninstall. The authored MDX body already
// carries every command's exact flags, the doctor/audit-scripts descriptions,
// the "Mutating" blockquotes above `backups restore` and `uninstall`, and the
// shared exit-code table, all present in initial HTML with no JavaScript
// required. This wrapper adds the one structure the prose never draws as a
// single table: an intent matrix across all six operations, letting a
// reader see at a glance which are read-only and which change files before
// reading any of the six `##` sections in full. `OperationMatrix` marks
// each operation's kind with a literal, always-visible text label — never
// color alone — so the diagnostic/mutating distinction the D10 test
// requires reads correctly with CSS disabled or in grayscale. It never
// restates a command's flags or the exit-code table itself — those stay
// the authored fenced code blocks' and table's job.

const STRINGS = {
  en: { caption: "doctor, audit, backups, and uninstall by intent" },
  vi: { caption: "doctor, audit, backups và uninstall theo mục đích" },
} as const;

const ATTRIBUTE_COLUMNS: Record<"en" | "vi", readonly DataColumn[]> = {
  en: [
    { key: "scope", label: "Reads/writes" },
    { key: "safety", label: "Before it changes anything" },
  ],
  vi: [
    { key: "scope", label: "Đọc/ghi" },
    { key: "safety", label: "Trước khi thay đổi bất cứ điều gì" },
  ],
};

const OPERATIONS: Record<"en" | "vi", readonly OperationRow[]> = {
  en: [
    { id: "doctor", label: "doctor [--global]", kind: "diagnostic", attributes: { scope: "Receipt + files + hooks + settings", safety: "Read-only" } },
    { id: "audit-kit", label: "audit kit [--global] [--json] [--strict]", kind: "diagnostic", attributes: { scope: "Installed files vs receipt", safety: "Read-only" } },
    { id: "audit-scripts", label: "audit scripts [--json] [--strict]", kind: "diagnostic", attributes: { scope: "Kit scripts", safety: "Read-only" } },
    { id: "backups-list", label: "backups list [--global]", kind: "diagnostic", attributes: { scope: "Backup archive", safety: "Read-only" } },
    { id: "backups-restore", label: "backups restore <timestamp> [--dry-run]", kind: "mutating", attributes: { scope: "Current files", safety: "--dry-run lists changes first" } },
    { id: "uninstall", label: "uninstall [--provider a,b] [--global] [--dry-run]", kind: "mutating", attributes: { scope: "Receipt-listed files only", safety: "--dry-run lists changes first" } },
  ],
  vi: [
    { id: "doctor", label: "doctor [--global]", kind: "diagnostic", attributes: { scope: "Receipt + file + hook + cài đặt", safety: "Chỉ đọc" } },
    { id: "audit-kit", label: "audit kit [--global] [--json] [--strict]", kind: "diagnostic", attributes: { scope: "File đã cài so với receipt", safety: "Chỉ đọc" } },
    { id: "audit-scripts", label: "audit scripts [--json] [--strict]", kind: "diagnostic", attributes: { scope: "Script của kit", safety: "Chỉ đọc" } },
    { id: "backups-list", label: "backups list [--global]", kind: "diagnostic", attributes: { scope: "Kho lưu trữ backup", safety: "Chỉ đọc" } },
    { id: "backups-restore", label: "backups restore <timestamp> [--dry-run]", kind: "mutating", attributes: { scope: "File hiện tại", safety: "--dry-run liệt kê thay đổi trước" } },
    { id: "uninstall", label: "uninstall [--provider a,b] [--global] [--dry-run]", kind: "mutating", attributes: { scope: "Chỉ file có trong receipt", safety: "--dry-run liệt kê thay đổi trước" } },
  ],
};

export function UninstallAndDoctorExperience({ catalogPage, children }: DocsScreenContext) {
  const locale = catalogPage.locale;
  const strings = STRINGS[locale] ?? STRINGS.en;
  const attributeColumns = ATTRIBUTE_COLUMNS[locale] ?? ATTRIBUTE_COLUMNS.en;
  const operations = OPERATIONS[locale] ?? OPERATIONS.en;
  return (
    <>
      <OperationMatrix locale={locale} caption={strings.caption} attributeColumns={attributeColumns} operations={operations} />
      {children}
    </>
  );
}
