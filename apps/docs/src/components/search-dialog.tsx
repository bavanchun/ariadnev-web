"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";

const schema = {
  id: "string",
  locale: "string",
  version: "string",
  title: "string",
  description: "string",
  content: "string",
  url: "string",
} as const;

interface SearchHit {
  readonly id: string;
  readonly locale: string;
  readonly version: string;
  readonly title: string;
  readonly description: string;
  readonly content: string;
  readonly url: string;
}

interface SearchEnvelope {
  readonly partition: string;
  readonly locale: string;
  readonly version: string;
  readonly index: unknown;
}

async function loadSearchPartition(indexUrl: string, locale: string, version: string) {
  const response = await fetch(indexUrl, { cache: "no-store" });
  if (!response.ok) throw new Error("search index unavailable");
  const envelope = await response.json() as SearchEnvelope;
  if (envelope.partition !== `${locale}/${version}` || envelope.locale !== locale || envelope.version !== version) {
    throw new Error("search index partition mismatch");
  }
  const { create, load, search } = await import("@orama/orama");
  const database = create({ schema });
  load(database, envelope.index as never);
  return { database, search };
}

type LoadedSearchPartition = Awaited<ReturnType<typeof loadSearchPartition>>;
type PendingResultAction = { readonly action: "focus" | "navigate"; readonly query: string };

export function SearchDialog({ locale, version, indexUrl }: { locale: string; version: string; indexUrl: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const resultList = useRef<HTMLUListElement>(null);
  const partitionPromise = useRef<Promise<LoadedSearchPartition> | null>(null);
  const requestSequence = useRef(0);
  const pendingResultAction = useRef<PendingResultAction | null>(null);
  const resultsQuery = useRef("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<readonly SearchHit[]>([]);
  const [activeResult, setActiveResult] = useState(-1);
  const [message, setMessage] = useState("");
  const titleId = useId();

  function getPartition() {
    partitionPromise.current ??= loadSearchPartition(indexUrl, locale, version).catch((error) => {
      partitionPromise.current = null;
      throw error;
    });
    return partitionPromise.current;
  }

  function openSearch() {
    if (!dialog.current?.open) dialog.current?.showModal();
    input.current?.focus();
    void getPartition().catch(() => undefined);
  }

  function focusResult(index: number) {
    requestAnimationFrame(() => {
      const links = resultList.current?.querySelectorAll<HTMLAnchorElement>("a");
      links?.[index]?.focus();
    });
  }

  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      const target = event.target;
      const editable = target instanceof HTMLElement && (target.isContentEditable || /^(?:INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
      const commandK = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
      const slash = !event.metaKey && !event.ctrlKey && !event.altKey && event.key === "/" && !editable;
      if (commandK || slash) {
        event.preventDefault();
        openSearch();
      }
    }
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  });

  async function runSearch(value: string) {
    const requestId = ++requestSequence.current;
    setQuery(value);
    resultsQuery.current = "";
    setResults([]);
    setActiveResult(-1);
    if (pendingResultAction.current?.query !== value) pendingResultAction.current = null;
    if (!value.trim()) {
      setMessage("");
      return;
    }
    try {
      const loaded = await getPartition();
      const found = await loaded.search(loaded.database, { term: value, limit: 8, properties: ["title", "description", "content"] });
      const exact = found.hits.map((hit) => hit.document as SearchHit).filter((hit) => hit.locale === locale && hit.version === version);
      if (exact.length !== found.hits.length) throw new Error("search index crossed its locale/version partition");
      if (requestId !== requestSequence.current) return;
      resultsQuery.current = value;
      const pendingAction = pendingResultAction.current?.query === value ? pendingResultAction.current.action : null;
      setResults(exact);
      setActiveResult(exact.length > 0 && pendingAction ? 0 : -1);
      setMessage(`${exact.length} search results`);
      if (exact.length > 0 && pendingAction === "navigate") {
        pendingResultAction.current = null;
        window.location.assign(exact[0]!.url);
      } else if (exact.length > 0 && pendingAction === "focus") {
        pendingResultAction.current = null;
        focusResult(0);
      } else if (exact.length === 0) {
        pendingResultAction.current = null;
      }
    } catch {
      if (requestId !== requestSequence.current) return;
      resultsQuery.current = "";
      pendingResultAction.current = null;
      setResults([]);
      setActiveResult(-1);
      setMessage("Search is temporarily unavailable. Use the static sidebar to browse documentation.");
    }
  }

  function handleInputKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    const inputQuery = event.currentTarget.value;
    const currentResults = resultsQuery.current === inputQuery;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (currentResults && results.length > 0) {
        setActiveResult(0);
        focusResult(0);
      } else {
        pendingResultAction.current = { action: "focus", query: inputQuery };
      }
    }
    if (event.key === "Enter" && inputQuery.trim()) {
      event.preventDefault();
      const selected = currentResults ? results[activeResult >= 0 ? activeResult : 0] : undefined;
      if (selected) window.location.assign(selected.url);
      else pendingResultAction.current = { action: "navigate", query: inputQuery };
    }
  }

  function handleResultKeyDown(event: ReactKeyboardEvent<HTMLAnchorElement>, index: number) {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const next = event.key === "ArrowDown" ? Math.min(index + 1, results.length - 1) : Math.max(index - 1, 0);
    setActiveResult(next);
    focusResult(next);
  }

  return (
    <div className="search-control">
      <button type="button" onClick={openSearch}>Search <kbd>/</kbd></button>
      <dialog ref={dialog} aria-labelledby={titleId} onClose={() => {
        requestSequence.current += 1;
        pendingResultAction.current = null;
        resultsQuery.current = "";
        setQuery("");
        setResults([]);
        setActiveResult(-1);
      }}>
        <div className="search-heading">
          <h2 id={titleId}>Search this edition</h2>
          <button type="button" onClick={() => dialog.current?.close()} aria-label="Close search">Close</button>
        </div>
        <label htmlFor={`${titleId}-query`}>Search {locale.toUpperCase()} {version}</label>
        <input id={`${titleId}-query`} ref={input} value={query} onChange={(event) => void runSearch(event.target.value)} onKeyDown={handleInputKeyDown} type="search" autoComplete="off" />
        <p role="status" aria-live="polite">{message}</p>
        <ul ref={resultList}>{results.map((result, index) => <li key={result.id}><a href={result.url} aria-current={activeResult === index ? "true" : undefined} onFocus={() => setActiveResult(index)} onKeyDown={(event) => handleResultKeyDown(event, index)}><strong>{result.title}</strong><span>{result.description}</span></a></li>)}</ul>
      </dialog>
    </div>
  );
}
