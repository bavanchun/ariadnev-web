import type { DocsLocale } from "@/lib/i18n.ts";
import { ResponsiveDataRegion, type DataColumn } from "./responsive-data-region.tsx";

// Phase 4 closed content component — Operation matrix. A dense
// operation × attribute grid (e.g. D10's doctor/audit/backups/uninstall
// intent table, D09's configuration authority layers) built on top of
// `ResponsiveDataRegion` so the wide-table / narrow-record behavior is
// defined exactly once. The one addition specific to operations is the
// "kind" badge in the operation column — diagnostic vs mutating vs
// destructive is distinguished by a literal, always-visible text label
// (never color alone, per the phase-04 D10 test requirement), so it reads
// correctly even with CSS disabled or on a grayscale/high-contrast display.

export type OperationKind = "diagnostic" | "mutating" | "destructive";

interface OperationMatrixStrings {
  readonly operationColumn: string;
  readonly diagnostic: string;
  readonly mutating: string;
  readonly destructive: string;
}

const STRINGS: Record<DocsLocale, OperationMatrixStrings> = {
  en: { operationColumn: "Operation", diagnostic: "Diagnostic", mutating: "Mutating", destructive: "Destructive" },
  vi: { operationColumn: "Thao tác", diagnostic: "Chẩn đoán", mutating: "Thay đổi trạng thái", destructive: "Phá hủy" },
};

export interface OperationRow {
  readonly id: string;
  readonly label: string;
  readonly kind: OperationKind;
  readonly attributes: Readonly<Record<string, string>>;
}

export interface OperationMatrixProps {
  readonly locale: DocsLocale;
  readonly caption: string;
  readonly attributeColumns: readonly DataColumn[];
  readonly operations: readonly OperationRow[];
  readonly id?: string;
}

export function OperationMatrix({ locale, caption, attributeColumns, operations, id }: OperationMatrixProps) {
  const strings = STRINGS[locale] ?? STRINGS.en;
  const columns: readonly DataColumn[] = [{ key: "operation", label: strings.operationColumn }, ...attributeColumns];
  const rows = operations.map((operation) => ({
    id: operation.id,
    cells: {
      operation: (
        <>
          <span className={`operation-matrix-${operation.kind}`}>{strings[operation.kind]}</span> {operation.label}
        </>
      ),
      ...operation.attributes,
    },
  }));
  return <ResponsiveDataRegion locale={locale} caption={caption} columns={columns} rows={rows} {...(id !== undefined ? { id } : {})} />;
}
