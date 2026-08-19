import type { DocsScreenContext } from "../docs-screen-registry.tsx";
import { Topology, type TopologyEdge, type TopologyNode } from "../prose/index.ts";

// D08 — Upgrading. The authored MDX body already carries the exact `update`
// and `update --check` commands, the reinstall-the-kit paragraph, the
// version/release-notes section, and the "docs selector is not the
// installed version" boundary as a blockquote, all present in initial HTML
// with no JavaScript required. This wrapper adds one diagram the prose
// states across three separate `##` sections but never draws as a single
// path: check for a newer release, update the binary, reinstall the kit so
// its artifacts match the new receipt, then confirm with doctor.
// `Topology` always renders the same legend and from/to table as its text
// equivalent, so the shape is understood even with the SVG absent or CSS
// disabled. It never restates the docs-selector boundary — that stays the
// authored blockquote's job.

const STRINGS = {
  en: { heading: "Upgrade recipe" },
  vi: { heading: "Quy trình nâng cấp" },
} as const;

const NODES: Record<"en" | "vi", readonly TopologyNode[]> = {
  en: [
    { id: "check", label: "ariadnev update --check", shape: "diamond" },
    { id: "update", label: "ariadnev update" },
    { id: "reinstall", label: "ariadnev install (per provider)" },
    { id: "doctor", label: "ariadnev doctor", shape: "pill" },
  ],
  vi: [
    { id: "check", label: "ariadnev update --check", shape: "diamond" },
    { id: "update", label: "ariadnev update" },
    { id: "reinstall", label: "ariadnev install (từng provider)" },
    { id: "doctor", label: "ariadnev doctor", shape: "pill" },
  ],
};

const EDGES: Record<"en" | "vi", readonly TopologyEdge[]> = {
  en: [
    { from: "check", to: "update", label: "if newer", dashed: true },
    { from: "update", to: "reinstall" },
    { from: "reinstall", to: "doctor" },
  ],
  vi: [
    { from: "check", to: "update", label: "nếu có bản mới", dashed: true },
    { from: "update", to: "reinstall" },
    { from: "reinstall", to: "doctor" },
  ],
};

export function UpgradingExperience({ catalogPage, children }: DocsScreenContext) {
  const locale = catalogPage.locale;
  const strings = STRINGS[locale] ?? STRINGS.en;
  const nodes = NODES[locale] ?? NODES.en;
  const edges = EDGES[locale] ?? EDGES.en;
  return (
    <>
      <div className="authored-screen-instrument authored-screen-decision authored-screen-upgrade" data-surface-context="instrument">
        <Topology locale={locale} heading={strings.heading} nodes={nodes} edges={edges} />
      </div>
      {children}
    </>
  );
}
