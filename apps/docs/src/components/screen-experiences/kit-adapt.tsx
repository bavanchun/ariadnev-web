import type { DocsScreenContext } from "../docs-screen-registry.tsx";
import { Topology, type TopologyEdge, type TopologyNode } from "../prose/index.ts";

// D05 — Kit and adapt engine. The authored MDX body already carries the kit
// contents, the artifact -> target table, the "skip, do not guess" boundary
// blockquote, and the receipt/cache facts, all present in initial HTML with
// no JavaScript required. This wrapper adds one diagram the prose states as
// a single sentence ("the kit -> adapt -> projection -> receipt/cache
// pipeline reads left to right") but never draws: the system view the
// screen matrix requires, showing the pure-projection step branching into
// the two terminal artifacts an install produces. `Topology` always renders
// the same legend and from/to table as its text equivalent, so the shape is
// understood even with the SVG absent or CSS disabled. It never restates the
// skip-not-guess boundary text itself — that stays the authored blockquote's
// job.

const STRINGS = {
  en: { heading: "Kit to installed system" },
  vi: { heading: "Từ kit đến hệ thống đã cài" },
} as const;

const NODES: Record<"en" | "vi", readonly TopologyNode[]> = {
  en: [
    { id: "kit", label: "Kit (authored source)" },
    { id: "adapt", label: "Adapt engine", shape: "diamond" },
    { id: "projection", label: "Per-provider projection" },
    { id: "receipt", label: "Receipt", shape: "pill" },
    { id: "cache", label: "Cache", shape: "pill" },
  ],
  vi: [
    { id: "kit", label: "Kit (nguồn được biên soạn)" },
    { id: "adapt", label: "Adapt engine", shape: "diamond" },
    { id: "projection", label: "Chiếu theo từng provider" },
    { id: "receipt", label: "Receipt", shape: "pill" },
    { id: "cache", label: "Cache", shape: "pill" },
  ],
};

const EDGES: Record<"en" | "vi", readonly TopologyEdge[]> = {
  en: [
    { from: "kit", to: "adapt" },
    { from: "adapt", to: "projection" },
    { from: "projection", to: "receipt" },
    { from: "projection", to: "cache", label: "extracted, unmodified", dashed: true },
  ],
  vi: [
    { from: "kit", to: "adapt" },
    { from: "adapt", to: "projection" },
    { from: "projection", to: "receipt" },
    { from: "projection", to: "cache", label: "trích xuất, không sửa đổi", dashed: true },
  ],
};

export function KitAdaptExperience({ catalogPage, children }: DocsScreenContext) {
  const locale = catalogPage.locale;
  const strings = STRINGS[locale] ?? STRINGS.en;
  const nodes = NODES[locale] ?? NODES.en;
  const edges = EDGES[locale] ?? EDGES.en;
  return (
    <>
      <Topology locale={locale} heading={strings.heading} nodes={nodes} edges={edges} />
      {children}
    </>
  );
}
