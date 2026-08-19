import type { DocsScreenContext } from "../docs-screen-registry.tsx";
import { Topology, type TopologyEdge, type TopologyNode } from "../prose/index.ts";

// D07 — Evaluation. The authored MDX body already carries every tier's
// description, the opt-in judge command, the runtime-probe explanation, and
// the full proof/does-not-prove ledger as a Markdown table, all present in
// initial HTML with no JavaScript required. This wrapper adds the one visual
// the screen matrix names explicitly and phase-04's architecture reserves as
// a screen-local one-off: a proof ladder drawn as a topology, showing each
// tier's evidence building on the last with runtime probes as an
// independent terminal step and the LLM judge on a dashed edge because it is
// opt-in. `Topology` always renders the same legend and from/to table as its
// text equivalent, so the ladder is understood even with the SVG absent or
// CSS disabled, and it never restates what each tier proves or does not
// prove — that stays the authored ledger table's job.

const STRINGS = {
  en: { heading: "Proof ladder" },
  vi: { heading: "Nấc thang bằng chứng" },
} as const;

const NODES: Record<"en" | "vi", readonly TopologyNode[]> = {
  en: [
    { id: "static", label: "Static contracts" },
    { id: "tier1", label: "Tier 1: static quality" },
    { id: "tier2", label: "Tier 2: behavioural suite" },
    { id: "tier3", label: "Tier 3: LLM judge (opt-in)", shape: "pill" },
    { id: "probes", label: "Runtime probes", shape: "pill" },
  ],
  vi: [
    { id: "static", label: "Hợp đồng tĩnh" },
    { id: "tier1", label: "Tier 1: chất lượng tĩnh" },
    { id: "tier2", label: "Tier 2: bộ kiểm thử hành vi" },
    { id: "tier3", label: "Tier 3: giám khảo LLM (tùy chọn)", shape: "pill" },
    { id: "probes", label: "Kiểm tra runtime", shape: "pill" },
  ],
};

const EDGES: Record<"en" | "vi", readonly TopologyEdge[]> = {
  en: [
    { from: "static", to: "tier1" },
    { from: "tier1", to: "tier2" },
    { from: "tier2", to: "tier3", label: "opt-in", dashed: true },
    { from: "tier2", to: "probes" },
  ],
  vi: [
    { from: "static", to: "tier1" },
    { from: "tier1", to: "tier2" },
    { from: "tier2", to: "tier3", label: "tùy chọn", dashed: true },
    { from: "tier2", to: "probes" },
  ],
};

export function EvaluationExperience({ catalogPage, children }: DocsScreenContext) {
  const locale = catalogPage.locale;
  const strings = STRINGS[locale] ?? STRINGS.en;
  const nodes = NODES[locale] ?? NODES.en;
  const edges = EDGES[locale] ?? EDGES.en;
  return (
    <>
      <div className="authored-screen-instrument authored-screen-concept authored-screen-evaluation" data-surface-context="instrument">
        <Topology locale={locale} heading={strings.heading} nodes={nodes} edges={edges} />
      </div>
      {children}
    </>
  );
}
