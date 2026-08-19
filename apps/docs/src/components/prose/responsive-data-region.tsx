import type { ReactNode } from "react";
import type { DocsLocale } from "@/lib/i18n.ts";

// Phase 4 closed content component — Responsive data region. Server-renders
// exactly one semantic `<table>` (with `<caption>`, `<thead>`, `<tbody>`) so
// there is one source of truth for the data and no risk of the visible and
// the accessible copy drifting. Wide viewports get the site-wide
// `.docs-body table` local-scroll treatment for free — this component
// renders inside `.docs-body` via the screen registry, same as every
// generated reference table, so no bespoke wide-viewport CSS is added here.
// `tabIndex={0}` on the `<table>` matches the same unconditional pattern
// `.docs-body table[tabindex]` already styles site-wide.
//
// Every body cell also carries a `data-label` attribute. At narrow viewports
// CSS presents each row as a labelled record while this single semantic table
// remains the only DOM/data source. No JavaScript or duplicated mobile copy is
// required.

export interface DataColumn {
  readonly key: string;
  readonly label: string;
}

export interface DataRow {
  readonly id: string;
  readonly cells: Readonly<Record<string, ReactNode>>;
}

export interface ResponsiveDataRegionProps {
  readonly locale: DocsLocale;
  readonly caption: string;
  readonly columns: readonly DataColumn[];
  readonly rows: readonly DataRow[];
  readonly id?: string;
}

export function ResponsiveDataRegion({ caption, columns, rows, id }: ResponsiveDataRegionProps) {
  return (
    <table className="rdr-table" tabIndex={0} id={id}>
      <caption>{caption}</caption>
      <thead>
        <tr>
          {columns.map((column) => (
            <th key={column.key} scope="col">
              {column.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            {columns.map((column) => (
              <td key={column.key} data-label={column.label}>
                {row.cells[column.key]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
