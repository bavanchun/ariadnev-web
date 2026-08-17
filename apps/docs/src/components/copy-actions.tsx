"use client";

import { useId, useRef, useState } from "react";

async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

export function CopyAction({ label, value, sourceUrl, fallbackLabel = "Copy source" }: {
  label: string;
  value?: string;
  sourceUrl?: string;
  fallbackLabel?: string;
}) {
  const id = useId();
  const fallback = useRef<HTMLTextAreaElement>(null);
  const [message, setMessage] = useState("");
  const [source, setSource] = useState("");

  async function onCopy() {
    let nextSource = value;
    if (!nextSource && sourceUrl) {
      try {
        const response = await fetch(sourceUrl, { cache: "no-store" });
        if (!response.ok) throw new Error("Markdown source unavailable");
        nextSource = await response.text();
      } catch {
        setMessage("Markdown source is unavailable. Its physical link remains selectable.");
        return;
      }
    }
    if (!nextSource) throw new Error("copy action requires a value or source URL");
    if (await copyText(nextSource)) {
      setMessage(`${label} copied`);
      return;
    }
    setSource(nextSource);
    requestAnimationFrame(() => {
      fallback.current?.focus();
      fallback.current?.select();
    });
    setMessage("Clipboard unavailable. The source text is selected for manual copy.");
  }

  return (
    <div className="copy-action">
      <button type="button" onClick={onCopy} aria-describedby={id}>{label}</button>
      {(sourceUrl || value?.startsWith("http")) && <a className="copy-source-link" href={sourceUrl ?? value}>{sourceUrl ? "Open Markdown source" : "Open heading link"}</a>}
      <label className="visually-hidden" htmlFor={`${id}-source`}>{fallbackLabel}</label>
      <textarea id={`${id}-source`} ref={fallback} value={source} hidden={!source} readOnly rows={2} spellCheck={false} />
      <span id={id} className="visually-hidden" role="status" aria-live="polite">{message}</span>
    </div>
  );
}

export function PageCopyActions({ markdownUrl, headingUrl, ariaLabel = "Copy options" }: { markdownUrl: string; headingUrl: string; ariaLabel?: string }) {
  return (
    <div className="page-copy-actions" aria-label={ariaLabel}>
      <CopyAction label="Copy Markdown" sourceUrl={markdownUrl} fallbackLabel="Markdown source" />
      <CopyAction label="Copy heading link" value={headingUrl} />
    </div>
  );
}
