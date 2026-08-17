"use client";

// Promotes the server-rendered `<details className="docs-sidebar-drawer">`
// into a mobile modal drawer with focus containment, Escape/backdrop close,
// focus return, and scroll-locked background. Runs at mobile viewports only
// (`window.matchMedia("(max-width: 720px)")`); wider viewports leave the
// native disclosure open and unattended. Zero-JS fallback: the `<details>`
// stays open, users get a scrollable navigation list — every link is reachable.

import { useEffect } from "react";

const MOBILE_QUERY = "(max-width: 720px)";
const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"]), summary';

export function MobileDrawerEnhancer() {
  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;
    const drawer = document.querySelector<HTMLDetailsElement>("details.docs-sidebar-drawer");
    if (!drawer) return;
    const summary = drawer.querySelector<HTMLElement>("summary.docs-sidebar-drawer-toggle");
    const nav = drawer.querySelector<HTMLElement>("#docs-sidebar-tree");
    if (!summary || !nav) return;
    const media = window.matchMedia(MOBILE_QUERY);
    let scrollLocked = false;
    let lastFocused: HTMLElement | null = null;

    // Close the drawer whenever the viewport widens past mobile so the desktop
    // always-open state is honored; also un-lock any scroll and remove `inert`.
    function applyViewport() {
      if (!media.matches) {
        drawer!.open = true;
        drawer!.setAttribute("data-drawer-mode", "static");
        releaseScrollLock();
        clearInert();
      } else {
        drawer!.open = false;
        drawer!.setAttribute("data-drawer-mode", "modal");
      }
    }

    function lockScroll() {
      if (scrollLocked) return;
      document.body.style.overflow = "hidden";
      scrollLocked = true;
    }
    function releaseScrollLock() {
      if (!scrollLocked) return;
      document.body.style.overflow = "";
      scrollLocked = false;
    }
    function setInert() {
      const main = document.getElementById("docs-content");
      main?.setAttribute("inert", "");
    }
    function clearInert() {
      document.getElementById("docs-content")?.removeAttribute("inert");
    }
    function trapFocus(event: KeyboardEvent) {
      if (event.key !== "Tab" || !drawer!.open || !media.matches) return;
      const focusable = Array.from(drawer!.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((element) => !element.hasAttribute("disabled"));
      if (focusable.length === 0) return;
      const first: HTMLElement | undefined = focusable[0];
      const last: HTMLElement | undefined = focusable[focusable.length - 1];
      if (!first || !last) return;
      const active = document.activeElement as HTMLElement | null;
      if (event.shiftKey && active === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && active === last) { event.preventDefault(); first.focus(); }
    }
    function handleKeydown(event: KeyboardEvent) {
      if (event.key === "Escape" && drawer!.open && media.matches) {
        drawer!.open = false;
        event.preventDefault();
      }
      trapFocus(event);
    }
    function handleBackdropClick(event: MouseEvent) {
      // The drawer opens the whole details to full-screen at mobile; clicks
      // outside the nav (on the backdrop area of the details root) close it.
      if (!media.matches || !drawer!.open) return;
      const target = event.target as HTMLElement | null;
      if (target && nav!.contains(target)) return;
      if (target === summary) return;
      drawer!.open = false;
    }
    function handleToggle() {
      if (!media.matches) return;
      if (drawer!.open) {
        lastFocused = document.activeElement as HTMLElement | null;
        lockScroll();
        setInert();
        const firstLink = drawer!.querySelector<HTMLElement>("a[href]");
        firstLink?.focus();
      } else {
        releaseScrollLock();
        clearInert();
        lastFocused?.focus();
      }
    }

    applyViewport();
    media.addEventListener("change", applyViewport);
    document.addEventListener("keydown", handleKeydown);
    drawer.addEventListener("toggle", handleToggle);
    drawer.addEventListener("click", handleBackdropClick);
    return () => {
      media.removeEventListener("change", applyViewport);
      document.removeEventListener("keydown", handleKeydown);
      drawer.removeEventListener("toggle", handleToggle);
      drawer.removeEventListener("click", handleBackdropClick);
      releaseScrollLock();
      clearInert();
    };
  }, []);
  return null;
}
