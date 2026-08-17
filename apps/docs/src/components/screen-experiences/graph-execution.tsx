import type { DocsScreenContext } from "../docs-screen-registry.tsx";
import { Topology, type TopologyEdge, type TopologyNode } from "../prose/index.ts";

// D06 — Graph execution. The authored MDX body already carries the
// read-only boundary as a blockquote, the lifecycle commands, the five-state
// vocabulary table, and the runtime/durable-state matrices, all present in
// initial HTML with no JavaScript required. This wrapper adds only the
// flagship topology the screen matrix requires: the same public pipeline the
// prose states as a fenced text block (`GraphIRV1 -> compiler/lint -> policy
// -> event-sourced runner -> executor registry -> Codex / Claude Code`) drawn
// as a diagram. It does not restate the read-only boundary the authored
// blockquote already states as an always-visible landmark — this route has
// the tightest per-route compressed-byte cap on the site (see
// `verify-static-budget.mjs`), so a second boundary landmark would duplicate
// text the reader has already read one screenful above without adding new
// information. `Topology` always renders the same legend and from/to table
// as its text equivalent, so the shape is understood even with the SVG
// absent or CSS disabled.

const STRINGS = {
  en: { heading: "Public execution pipeline" },
  vi: { heading: "Pipeline thực thi" },
} as const;

// The diagram collapses the six-stage prose pipeline
// (`GraphIRV1 -> compiler/lint -> policy -> event-sourced runner ->
// executor registry -> Codex / Claude Code`) into its four load-bearing
// stops — compile, policy, run, provider — merging the compiler/lint step
// into "compile" and the executor registry plus the two named providers
// into one "Provider" dispatch terminal (both provider names are already
// stated by the authored runtime-contract table further down the page).
// Nothing here contradicts the authored fenced text block, which still
// lists every named stage; this diagram exists only to show the shape
// (linear, one decision point, one dispatch fan-out), so collapsing
// adjacent same-actor steps loses no information the reader needs from the
// picture. This keeps the diagram's node/edge count, and the unique SVG
// geometry each one costs under compression, to the minimum the
// flagship-topology requirement needs on the site's tightest-margin route.
const NODES: Record<"en" | "vi", readonly TopologyNode[]> = {
  en: [
    { id: "compile", label: "Compile" },
    { id: "policy", label: "Policy", shape: "diamond" },
    { id: "run", label: "Run" },
    { id: "provider", label: "Provider", shape: "pill" },
  ],
  vi: [
    { id: "compile", label: "Compile" },
    { id: "policy", label: "Policy", shape: "diamond" },
    { id: "run", label: "Run" },
    { id: "provider", label: "Provider", shape: "pill" },
  ],
};

const EDGES: Record<"en" | "vi", readonly TopologyEdge[]> = {
  en: [
    { from: "compile", to: "policy" },
    { from: "policy", to: "run" },
    { from: "run", to: "provider" },
  ],
  vi: [
    { from: "compile", to: "policy" },
    { from: "policy", to: "run" },
    { from: "run", to: "provider" },
  ],
};

export function GraphExecutionExperience({ catalogPage, children }: DocsScreenContext) {
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
