const map = document.querySelector<HTMLElement>("[data-execution-map]");
const copyStatus = document.querySelector<HTMLElement>("#copy-status");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

function activateMapStep(index: number) {
  if (!map) return;
  const nodes = [...map.querySelectorAll<HTMLAnchorElement>("[data-map-node]")];
  const edges = [...map.querySelectorAll<SVGPathElement>("[data-map-edge]")];
  nodes.forEach((node, nodeIndex) => {
    if (nodeIndex === index) node.setAttribute("aria-current", "step");
    else node.removeAttribute("aria-current");
    node.classList.toggle("is-active", nodeIndex <= index);
  });
  edges.forEach((edge) => {
    const edgeIndex = Number.parseInt(edge.dataset.mapEdge ?? "", 10);
    edge.classList.toggle("is-active", Number.isFinite(edgeIndex) && edgeIndex < index);
  });
}

if (map) {
  const nodes = [...map.querySelectorAll<HTMLAnchorElement>("[data-map-node]")];
  const traversalTimers = new Set<number>();
  let observer: IntersectionObserver | undefined;
  const cancelTraversal = () => {
    for (const timer of traversalTimers) window.clearTimeout(timer);
    traversalTimers.clear();
  };
  const finish = () => {
    cancelTraversal();
    observer?.disconnect();
    activateMapStep(nodes.length - 1);
  };
  nodes.forEach((node, index) => {
    node.addEventListener("focus", () => activateMapStep(index));
    node.addEventListener("click", () => activateMapStep(index));
    node.addEventListener("keydown", (event) => {
      const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? nodes.length - 1
        : event.key === "ArrowRight" || event.key === "ArrowDown" ? Math.min(index + 1, nodes.length - 1)
          : event.key === "ArrowLeft" || event.key === "ArrowUp" ? Math.max(index - 1, 0) : index;
      if (nextIndex !== index || event.key === "Home" || event.key === "End") {
        event.preventDefault(); nodes[nextIndex]?.focus();
      }
    });
  });
  if (reducedMotion.matches || !("IntersectionObserver" in window)) finish();
  else {
    const traversalDuration = Number.parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue("--vc-motion-traversal-duration"),
    );
    const stepDelay = Number.isFinite(traversalDuration) ? traversalDuration / (nodes.length + 2) : 0;
    const intersectionObserver = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      intersectionObserver.disconnect(); map.dataset.enhanced = "true";
      nodes.forEach((_, index) => {
        const timer = window.setTimeout(() => {
          traversalTimers.delete(timer);
          activateMapStep(index);
        }, index * stepDelay);
        traversalTimers.add(timer);
      });
    }, { threshold: 0.35 });
    observer = intersectionObserver;
    intersectionObserver.observe(map);
  }
  reducedMotion.addEventListener("change", (event) => { if (event.matches) finish(); });
}

document.querySelectorAll<HTMLButtonElement>("[data-copy-target]").forEach((button) => {
  button.hidden = false;
  button.addEventListener("click", async () => {
    const target = document.getElementById(button.dataset.copyTarget ?? "");
    const command = target?.textContent?.trim();
    if (!target || !command || !copyStatus) return;
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard API unavailable");
      await navigator.clipboard.writeText(command); copyStatus.textContent = "Install command copied.";
    } catch {
      copyStatus.textContent = "Automatic copy is unavailable. Select the visible command and copy it manually.";
      target.focus(); window.getSelection()?.selectAllChildren(target);
    }
  });
});
