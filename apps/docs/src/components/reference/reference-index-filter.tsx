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
// Grouping structure it expects: a sequence of `<h3>` + `<table>` pairs in
// document order somewhere inside the root element — each pair may sit
// directly inside `root` or be wrapped in an intermediate container (e.g.
// `CliCommandIndexExperience`'s per-namespace `<div>`), since it walks
// `root.querySelectorAll` rather than only `root.children`. A group's
// heading and table hide together once every row in that table is filtered
// out.
export function ReferenceIndexFilter({
  rootId,
  label,
  placeholder,
  noMatchesLabel,
  resultsLabel,
  clearLabel,
}: {
  readonly rootId: string;
  readonly label: string;
  readonly placeholder: string;
  readonly noMatchesLabel: string;
  readonly resultsLabel: string;
  readonly clearLabel: string;
}) {
  const inputId = useId();
  const statusId = useId();
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const statusRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function focusLocalFilter(event: KeyboardEvent) {
      const target = event.target;
      const editable = target instanceof HTMLElement
        && (target.isContentEditable || /^(?:INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
      const slash = event.key === "/" && !event.metaKey && !event.ctrlKey && !event.altKey;
      if (!slash || editable || !inputRef.current) return;
      event.preventDefault();
      // Reference indexes own `/` as their exact-lookup shortcut. Capture and
      // stop here so the shell-wide search shortcut does not open as well.
      event.stopImmediatePropagation();
      inputRef.current.focus();
    }
    window.addEventListener("keydown", focusLocalFilter, { capture: true });
    return () => window.removeEventListener("keydown", focusLocalFilter, { capture: true });
  }, []);

  useEffect(() => {
    const root = document.getElementById(rootId);
    if (!root) return;
    const needle = query.trim().toLowerCase();

    let lastHeading: HTMLElement | null = null;
    let visibleGroups = 0;
    let totalVisibleRows = 0;
    for (const node of Array.from(root.querySelectorAll<HTMLElement>("h3, table"))) {
      if (node.tagName === "H3") {
        lastHeading = node;
        continue;
      }
      const table = node as HTMLTableElement;
      const rows = Array.from(table.querySelectorAll<HTMLTableRowElement>("tbody tr"));
      let visibleRows = 0;
      for (const row of rows) {
        const matches = needle === "" || (row.textContent ?? "").toLowerCase().includes(needle);
        row.hidden = !matches;
        if (matches) visibleRows += 1;
      }
      totalVisibleRows += visibleRows;
      const groupVisible = needle === "" || visibleRows > 0;
      table.hidden = !groupVisible;
      if (lastHeading) lastHeading.hidden = !groupVisible;
      if (groupVisible) visibleGroups += 1;
    }

    if (statusRef.current) {
      statusRef.current.textContent =
        needle !== "" && visibleGroups === 0 ? noMatchesLabel : needle !== "" ? `${totalVisibleRows} ${resultsLabel}` : "";
    }
  }, [query, rootId, noMatchesLabel, resultsLabel]);

  return (
    <div className="reference-index-filter" role="search">
      <label htmlFor={inputId}>{label}</label>
      <div className="reference-filter-input-wrap">
        <input
          id={inputId}
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape" && query) {
              event.preventDefault();
              setQuery("");
            }
          }}
          autoComplete="off"
          aria-describedby={statusId}
        />
        {query && (
          <button
            type="button"
            className="reference-filter-clear"
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
            aria-label={clearLabel}
          >
            ✕
          </button>
        )}
      </div>
      <div id={statusId} role="status" aria-live="polite" className="visually-hidden" ref={statusRef} />
    </div>
  );
}
