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
// Every body cell also carries a `data-label` attribute so a narrow-viewport
// record-card reflow is a pure-CSS `docs.css` addition with zero markup
// change whenever it lands — see the `.rdr-table` comment in `docs.css` for
// why that rule is deferred (not missing by oversight): the shared
// stylesheet's tightest-margin route currently has no compressed-byte
// headroom left under the frozen per-route cap. Until then this table still
// gets the site-wide `.docs-body table` local-scroll treatment at every
// width — no clipped or hidden content, just a horizontal scroll instead of
// a stacked card. No JavaScript is required either way.

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
