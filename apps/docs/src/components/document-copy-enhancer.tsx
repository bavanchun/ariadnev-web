"use client";

import { useEffect, useRef, useState } from "react";

export function DocumentCopyEnhancer({ rootId }: { rootId: string }) {
  const fallback = useRef<HTMLTextAreaElement>(null);
  const [fallbackText, setFallbackText] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const root = document.getElementById(rootId);
    if (!root) return;
    const controls: HTMLButtonElement[] = [];

    async function copy(value: string, success: string, targetButton?: HTMLButtonElement, originalLabel?: string) {
      try {
        await navigator.clipboard.writeText(value);
        setFallbackText("");
        setMessage(success);
        if (targetButton && originalLabel) {
          targetButton.textContent = "Copied ✓";
          setTimeout(() => { targetButton.textContent = originalLabel; }, 2000);
        }
      } catch {
        setFallbackText(value);
        requestAnimationFrame(() => {
          fallback.current?.focus();
          fallback.current?.select();
        });
        setMessage("Clipboard unavailable. The source text is selected for manual copy.");
      }
    }

    for (const block of root.querySelectorAll("pre")) {
      const code = block.querySelector("code")?.textContent ?? block.textContent ?? "";
      const button = document.createElement("button");
      button.type = "button";
      button.className = "code-copy-button";
      button.textContent = "Copy code";
      button.setAttribute("aria-label", "Copy code block");
      button.addEventListener("click", () => void copy(code, "Code copied", button, "Copy code"));
      block.prepend(button);
      controls.push(button);
      // Make horizontal-scroll regions keyboard reachable. Adding tabindex
      // only when the region actually overflows means readers whose viewport
      // has no overflow do not get an unnecessary tab stop.
      if (block.scrollWidth > block.clientWidth) block.setAttribute("tabindex", "0");
    }
    for (const table of root.querySelectorAll("table")) {
      if (table.scrollWidth > table.clientWidth) table.setAttribute("tabindex", "0");
    }

    for (const heading of root.querySelectorAll<HTMLHeadingElement>("h2[id], h3[id], h4[id], h5[id], h6[id]")) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "heading-copy-button";
      button.textContent = "#";
      button.setAttribute("aria-label", `Copy link to ${heading.textContent ?? "heading"}`);
      button.addEventListener("click", () => void copy(`${location.origin}${location.pathname}#${encodeURIComponent(heading.id)}`, "Heading link copied"));
      heading.append(" ", button);
      controls.push(button);
    }

    return () => { for (const control of controls) control.remove(); };
  }, [rootId]);

  return (
    <div className="document-copy-fallback">
      <label className="visually-hidden" htmlFor={`${rootId}-copy-source`}>Selected copy source</label>
      <textarea id={`${rootId}-copy-source`} ref={fallback} value={fallbackText} hidden={!fallbackText} readOnly rows={2} spellCheck={false} />
      <span className="visually-hidden" role="status" aria-live="polite">{message}</span>
    </div>
  );
}
