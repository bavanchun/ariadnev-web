"use client";

import { useEffect, useId, useRef, useState } from "react";

// Progressive-enhancement filter for a generated reference index (D12 CLI
// index today; any future grouped reference index can reuse it). The server
// already renders the complete grouped tables inside `#rootId` — this
// component only toggles `hidden` on rows/groups after hydration. With
// JavaScript disabled the input never mounts and every row stays visible, so
// the index remains fully usable without JS, matching the phase-05
// requirement that client-side filtering is enhancement only.
//
// Grouping structure it expects: a sequence of `<h3>` + `<table>` siblings
// directly inside the root element (exactly what `CliCommandIndexExperience`
// renders). A group's heading and table hide together once every row in
// that table is filtered out.
export function ReferenceIndexFilter({
  rootId,
  label,
  placeholder,
  noMatchesLabel,
}: {
  readonly rootId: string;
  readonly label: string;
  readonly placeholder: string;
  readonly noMatchesLabel: string;
}) {
  const inputId = useId();
  const statusId = useId();
  const [query, setQuery] = useState("");
  const statusRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const root = document.getElementById(rootId);
    if (!root) return;
    const needle = query.trim().toLowerCase();

    let lastHeading: HTMLElement | null = null;
    let visibleGroups = 0;
    for (const child of Array.from(root.children)) {
      if (child.tagName === "H3") {
        lastHeading = child as HTMLElement;
        continue;
      }
      if (child.tagName !== "TABLE") continue;
      const table = child as HTMLTableElement;
      const rows = Array.from(table.querySelectorAll<HTMLTableRowElement>("tbody tr"));
      let visibleRows = 0;
      for (const row of rows) {
        const matches = needle === "" || (row.textContent ?? "").toLowerCase().includes(needle);
        row.hidden = !matches;
        if (matches) visibleRows += 1;
      }
      const groupVisible = needle === "" || visibleRows > 0;
      table.hidden = !groupVisible;
      if (lastHeading) lastHeading.hidden = !groupVisible;
      if (groupVisible) visibleGroups += 1;
    }

    if (statusRef.current) {
      statusRef.current.textContent = needle !== "" && visibleGroups === 0 ? noMatchesLabel : "";
    }
  }, [query, rootId, noMatchesLabel]);

  return (
    <div className="reference-index-filter" role="search">
      <label htmlFor={inputId}>{label}</label>
      <input
        id={inputId}
        type="text"
        placeholder={placeholder}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        autoComplete="off"
        aria-describedby={statusId}
      />
      <div id={statusId} role="status" aria-live="polite" className="visually-hidden" ref={statusRef} />
    </div>
  );
}
