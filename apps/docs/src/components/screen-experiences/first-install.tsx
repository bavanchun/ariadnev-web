import type { DocsScreenContext } from "../docs-screen-registry.tsx";
import { Topology, type TopologyEdge, type TopologyNode } from "../prose/index.ts";

// D04 — First install. The authored MDX body already carries the exact
// interactive/non-interactive commands, the scope definitions, the
// provider-matrix link, and the doctor exit-code table, all present in
// initial HTML with no JavaScript required. This wrapper adds one diagram
// the prose states as separate `##` sections but never draws as a single
// path: choose a mode, choose providers, choose scope, and land on the
// receipt every install writes. `Topology` always renders the same legend
// and from/to table as its text equivalent, so the shape is understood
// even with the SVG absent or CSS disabled.

const STRINGS = {
  en: { heading: "Install flow" },
  vi: { heading: "Luồng cài đặt" },
} as const;

const NODES: Record<"en" | "vi", readonly TopologyNode[]> = {
  en: [
    { id: "install", label: "av install" },
    { id: "interactive", label: "Interactive", shape: "pill" },
    { id: "noninteractive", label: "Non-interactive", shape: "pill" },
    { id: "providers", label: "Choose providers", shape: "diamond" },
    { id: "scope", label: "Choose scope", shape: "diamond" },
    { id: "receipt", label: "Receipt written", shape: "pill" },
  ],
  vi: [
    { id: "install", label: "av install" },
    { id: "interactive", label: "Tương tác", shape: "pill" },
    { id: "noninteractive", label: "Không tương tác", shape: "pill" },
    { id: "providers", label: "Chọn provider", shape: "diamond" },
    { id: "scope", label: "Chọn phạm vi", shape: "diamond" },
    { id: "receipt", label: "Ghi receipt", shape: "pill" },
  ],
};

const EDGES: Record<"en" | "vi", readonly TopologyEdge[]> = {
  en: [
    { from: "install", to: "interactive" },
    { from: "install", to: "noninteractive", dashed: true },
    { from: "interactive", to: "providers" },
    { from: "noninteractive", to: "providers" },
    { from: "providers", to: "scope" },
    { from: "scope", to: "receipt" },
  ],
  vi: [
    { from: "install", to: "interactive" },
    { from: "install", to: "noninteractive", dashed: true },
    { from: "interactive", to: "providers" },
    { from: "noninteractive", to: "providers" },
    { from: "providers", to: "scope" },
    { from: "scope", to: "receipt" },
  ],
};

export function FirstInstallExperience({ catalogPage, children }: DocsScreenContext) {
  const locale = catalogPage.locale;
  const strings = STRINGS[locale] ?? STRINGS.en;
  const nodes = NODES[locale] ?? NODES.en;
  const edges = EDGES[locale] ?? EDGES.en;
  return (
    <>
      <div className="authored-screen-instrument authored-screen-task authored-screen-first-install" data-surface-context="instrument">
        <Topology locale={locale} heading={strings.heading} nodes={nodes} edges={edges} />
      </div>
      {children}
    </>
  );
}
