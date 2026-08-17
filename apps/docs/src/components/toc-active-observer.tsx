"use client";

import { useEffect } from "react";

// Watches the rendered-markdown headings and mirrors the topmost-in-view
// heading id onto the matching TOC link as `aria-current="location"`.
// Server renders the TOC statically; this only decorates it after hydration.
// Both desktop `.docs-toc` and mobile `.docs-mobile-toc` are updated.
//
// IntersectionObserver with rootMargin favors the heading just below the
// sticky header so a heading only becomes "current" once its title has
// crossed the docs-sticky-offset line. When no heading intersects, the last
// heading that scrolled past stays current (matches native browser feel).
export function TocActiveObserver({ rootId, stickyOffsetVar = "--vcs-layout-docs-sticky-offset" }: { rootId: string; stickyOffsetVar?: string }) {
  useEffect(() => {
    if (typeof window === "undefined" || typeof IntersectionObserver === "undefined") return;
    const root = document.getElementById(rootId);
    if (!root) return;
    const headings = Array.from(root.querySelectorAll<HTMLElement>("h2[id], h3[id], h4[id]"));
    if (headings.length === 0) return;
    const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('.docs-toc a[href^="#"], .docs-mobile-toc a[href^="#"]'));
    const linksById = new Map<string, HTMLAnchorElement[]>();
    for (const link of links) {
      const hash = link.getAttribute("href")?.slice(1);
      if (!hash) continue;
      const decoded = decodeURIComponent(hash);
      (linksById.get(decoded) ?? linksById.set(decoded, []).get(decoded)!).push(link);
    }
    if (linksById.size === 0) return;
    const rootStyles = getComputedStyle(document.documentElement);
    const rawOffset = rootStyles.getPropertyValue(stickyOffsetVar).trim();
    const numericOffset = Number.parseInt(rawOffset, 10);
    const topOffset = Number.isFinite(numericOffset) && numericOffset > 0 ? numericOffset : 96;
    const visibleIds = new Set<string>();
    const setCurrent = (id: string | null) => {
      for (const linkList of linksById.values()) for (const link of linkList) link.removeAttribute("aria-current");
      if (!id) return;
      for (const link of linksById.get(id) ?? []) link.setAttribute("aria-current", "location");
    };
    let lastPassed: string | null = null;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const id = entry.target.id;
        if (entry.isIntersecting) visibleIds.add(id);
        else visibleIds.delete(id);
        if (!entry.isIntersecting && entry.boundingClientRect.top < topOffset) lastPassed = id;
      }
      const firstVisible = headings.find((heading) => visibleIds.has(heading.id));
      setCurrent(firstVisible?.id ?? lastPassed);
    }, { rootMargin: `-${topOffset}px 0px -70% 0px`, threshold: [0, 1] });
    for (const heading of headings) observer.observe(heading);
    return () => observer.disconnect();
  }, [rootId, stickyOffsetVar]);
  return null;
}
