// The entire client-side budget of this page: one module, two enhancements.
//
// Rules this file obeys:
//   * It never creates content. Every fact it touches is already in the DOM.
//   * It never hides anything. `data-emphasis` is additive styling only.
//   * It never runs perpetually. There is no animation loop and no timer; the
//     observer is passive and the listeners are event-driven.
//   * If any part of it throws, the page is exactly as usable as it was before
//     the script ran — which is why each enhancement is installed separately
//     inside its own guard.

/** Emphasise the step whose section is currently the most relevant one. */
function enhanceExecutionMap(): void {
  const steps = Array.from(document.querySelectorAll<HTMLElement>("[data-map-step]"));
  if (steps.length === 0) return;

  const nodes = new Map<string, HTMLElement>();
  for (const node of document.querySelectorAll<HTMLElement>("[data-map-node]")) {
    const id = node.dataset.mapNode;
    if (id !== undefined) nodes.set(id, node);
  }

  const setEmphasis = (id: string | null): void => {
    for (const step of steps) {
      const active = step.dataset.mapStep === id;
      step.dataset.emphasis = active ? "on" : "off";
      const node = step.dataset.mapStep === undefined ? undefined : nodes.get(step.dataset.mapStep);
      if (node !== undefined) node.dataset.emphasis = active ? "on" : "off";
    }
  };

  // Keyboard and pointer intent is explicit, so it always wins over scrolling.
  for (const step of steps) {
    step.addEventListener("focusin", () => setEmphasis(step.dataset.mapStep ?? null));
    step.addEventListener("mouseenter", () => setEmphasis(step.dataset.mapStep ?? null));
  }
  for (const link of document.querySelectorAll<HTMLAnchorElement>(".map__jump a")) {
    link.addEventListener("focus", () => setEmphasis(link.hash.replace("#map-step-", "")));
  }

  // Scroll emphasis is a nicety, and a reader who asked for reduced motion did
  // not ask for the page to react to their scrolling. Skip it for them, and
  // skip it wherever IntersectionObserver is unavailable.
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (typeof IntersectionObserver === "undefined") return;

  const observer = new IntersectionObserver(
    (entries) => {
      // Callback order is not document order, so picking `entries[0]` makes the
      // emphasis jump when two steps cross the band together. Resolve to the
      // earliest step in the document instead.
      const visible = entries.filter((entry) => entry.isIntersecting).map((entry) => entry.target as HTMLElement);
      if (visible.length === 0) return;
      const earliest = steps.find((step) => visible.includes(step));
      const id = earliest?.dataset.mapStep;
      if (id !== undefined) setEmphasis(id);
    },
    { rootMargin: "-45% 0px -45% 0px", threshold: 0 },
  );

  // A reader who asked for reduced motion did not ask for the page to react to
  // their scrolling, and the preference can change mid-session.
  const applyMotionPreference = (): void => {
    if (reducedMotion.matches) {
      observer.disconnect();
      setEmphasis(null);
    } else {
      for (const step of steps) observer.observe(step);
    }
  };
  applyMotionPreference();
  reducedMotion.addEventListener("change", applyMotionPreference);
}

/**
 * Reveal the copy buttons only where a clipboard actually exists, and announce
 * the outcome. The command text itself is never modified, so a failed copy
 * leaves a reader exactly where they started: with selectable text.
 */
function enhanceCopyControls(): void {
  const clipboard = navigator.clipboard;
  if (clipboard === undefined || typeof clipboard.writeText !== "function") return;

  for (const button of document.querySelectorAll<HTMLButtonElement>("[data-copy-for]")) {
    const targetId = button.dataset.copyFor;
    if (targetId === undefined) continue;
    const target = document.getElementById(targetId);
    if (target === null) continue;

    // The region sits next to this control, so the confirmation is visible
    // where the reader is looking rather than only announced elsewhere.
    const statusId = button.dataset.copyStatusFor;
    const status = statusId === undefined ? null : document.getElementById(statusId);
    const announce = (message: string): void => {
      if (status !== null) status.textContent = message;
    };

    button.hidden = false;
    button.addEventListener("click", () => {
      const text = target.textContent ?? "";
      clipboard.writeText(text).then(
        () => announce("Command copied to the clipboard."),
        () => announce("Copying was blocked. Select the command text and copy it manually."),
      );
    });
  }
}

for (const enhance of [enhanceExecutionMap, enhanceCopyControls]) {
  try {
    enhance();
  } catch {
    // An enhancement that cannot install is simply absent. The static page
    // remains complete, so there is nothing to report and nothing to retry.
  }
}
