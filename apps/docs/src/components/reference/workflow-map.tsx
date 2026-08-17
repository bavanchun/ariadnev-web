import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Fragment } from "react";
import type { DocsScreenContext } from "../docs-screen-registry.tsx";
import { docsContentRoot } from "@/lib/content-source.ts";

// D16 — Workflow reference. `renderWorkflowReference` (the generated
// Markdown body, rendered unchanged below the diagram) already carries a
// complete text equivalent for every graph: legend, entry points, terminal
// states, a from→to adjacency list, and Nodes/Edges tables — nothing here
// duplicates or replaces that text, and it stays the authoritative source
// for print, CSS-disabled, and assistive-technology readers.
//
// This component adds the one piece the generated Markdown pipeline cannot
// carry — a static SVG topology diagram — by reading the same verified
// `workflows.json` `build-content-root.mjs` already extracted (never
// re-parsing the compiled MDX tree) and laying out an inline `<svg>` with
// literal `<rect>`/`<polygon>`/`<text>`/`<line>` elements. No
// `dangerouslySetInnerHTML`, no client script, no image: React renders SVG
// as ordinary JSX, so this satisfies the phase-05 D16 requirement ("a safe
// MDX component registry or a build-time SVG asset pipeline" — this is the
// former) without the inline-HTML/image ban `public-markdown.ts` enforces
// on the generated Markdown itself.
//
// Layout is a plain BFS layering (source shortest-path distance from an
// entry node), top-to-bottom — the "vertical simplification" the D16
// architecture asks mobile to have, used unconditionally at every width so
// there is exactly one diagram whose semantics never change with viewport.
// Edges are straight lines between node centers with an arrowhead marker
// for direction; `retry` edges (the only genuinely cyclic edges these three
// graphs carry) get a dashed stroke — a text-and-shape distinction, not a
// color-only one — plus their type label, so recovery paths remain legible
// without relying on hue. Self-loop edges (`retry` back onto the same node)
// draw a small fixed-radius circle beside the node rather than a bespoke
// curve. Every node and edge the Markdown tables list appears in the
// diagram; the layout is a simplification, the graph data is not (per
// phase-05 risk: "keep authoritative tables/text and simplify layout only,
// never graph data").
//
// Terminal nodes get a distinct dashed-pill shape and gate nodes a diamond;
// entry nodes are distinguished by diagram position (top layer of a
// top-to-bottom flow) rather than a dedicated shape or text marker. Every
// SVG is `aria-hidden` — it is a supplementary visual, not the text
// equivalent: the generated Markdown's legend, entry points, terminal
// states, adjacency list, and Nodes/Edges tables (rendered immediately
// below, unaffected by this) are what an assistive-technology reader
// actually consumes, and stay complete regardless of how the diagram is
// drawn. These choices — no per-node badge text, no diagram-level ARIA
// label, a circle instead of a curve for self-loops — are also what keeps
// the diagram inside the frozen per-route byte cap; a text badge per
// entry/terminal node measured consistently over budget on the `vi` locale
// routes, which carry longer strings elsewhere on the same page.

interface WorkflowMapStrings {
  readonly diagramHeading: string;
}

const STRINGS: Record<"en" | "vi", WorkflowMapStrings> = {
  en: { diagramHeading: "Diagram" },
  vi: { diagramHeading: "Sơ đồ" },
};

interface WorkflowNode {
  readonly id: string;
  readonly type?: string;
}
interface WorkflowEdge {
  readonly id?: string;
  readonly from: string;
  readonly to: string;
  readonly type?: string;
}
interface WorkflowGraph {
  readonly id: string;
  readonly nodes: readonly WorkflowNode[];
  readonly edges: readonly WorkflowEdge[];
}

function normalizeWorkflows(value: unknown): readonly WorkflowGraph[] {
  if (!Array.isArray(value)) return [];
  const graphs: WorkflowGraph[] = [];
  for (const item of value) {
    const raw = item as Record<string, unknown> | null;
    const id = raw?.id;
    if (typeof id !== "string" || id.length === 0 || !Array.isArray(raw?.nodes) || !Array.isArray(raw?.edges)) continue;
    const nodes: WorkflowNode[] = [];
    for (const node of raw.nodes as unknown[]) {
      const n = node as Record<string, unknown> | null;
      if (typeof n?.id === "string" && n.id.length > 0) nodes.push({ id: n.id, ...(typeof n.type === "string" ? { type: n.type } : {}) });
    }
    const edges: WorkflowEdge[] = [];
    for (const edge of raw.edges as unknown[]) {
      const e = edge as Record<string, unknown> | null;
      if (typeof e?.from === "string" && typeof e?.to === "string" && e.from.length > 0 && e.to.length > 0) {
        edges.push({ from: e.from, to: e.to, ...(typeof e.type === "string" ? { type: e.type } : {}), ...(typeof e.id === "string" ? { id: e.id } : {}) });
      }
    }
    graphs.push({ id, nodes, edges });
  }
  return graphs;
}

function readWorkflows(): readonly WorkflowGraph[] {
  try {
    return normalizeWorkflows(JSON.parse(readFileSync(join(docsContentRoot, "generated/bundle/reference/workflows/workflows.json"), "utf8")));
  } catch {
    return [];
  }
}

interface LaidOutNode extends WorkflowNode {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly isTerminal: boolean;
}

const NODE_HEIGHT = 22;
const LAYER_GAP = 34;
const NODE_GAP = 8;
const CHAR_WIDTH = 7;
const NODE_PADDING = 18;
const MARGIN = 12;
const SELF_LOOP_RADIUS = 8;

/** BFS distance layering from every entry node (no inbound edge). Nodes unreachable from an entry fall into one trailing layer, so a malformed or partially-cyclic graph still lays out deterministically. */
function layoutWorkflow(workflow: WorkflowGraph): { readonly nodes: readonly LaidOutNode[]; readonly width: number; readonly height: number } {
  const inbound = new Set(workflow.edges.map((edge) => edge.to));
  const outbound = new Set(workflow.edges.map((edge) => edge.from));
  const adjacency = new Map<string, string[]>();
  for (const edge of workflow.edges) {
    if (edge.from === edge.to) continue;
    if (!adjacency.has(edge.from)) adjacency.set(edge.from, []);
    adjacency.get(edge.from)!.push(edge.to);
  }
  const entryIds = workflow.nodes.filter((node) => !inbound.has(node.id)).map((node) => node.id);
  const layerOf = new Map<string, number>();
  let frontier = entryIds.length > 0 ? entryIds : workflow.nodes.slice(0, 1).map((n) => n.id);
  for (const id of frontier) layerOf.set(id, 0);
  let depth = 0;
  while (frontier.length > 0) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const target of adjacency.get(id) ?? []) {
        if (!layerOf.has(target)) {
          layerOf.set(target, depth + 1);
          next.push(target);
        }
      }
    }
    frontier = next;
    depth += 1;
  }
  const maxLayer = Math.max(0, ...layerOf.values());
  for (const node of workflow.nodes) if (!layerOf.has(node.id)) layerOf.set(node.id, maxLayer + 1);

  const byLayer = new Map<number, WorkflowNode[]>();
  for (const node of workflow.nodes) {
    const layer = layerOf.get(node.id)!;
    if (!byLayer.has(layer)) byLayer.set(layer, []);
    byLayer.get(layer)!.push(node);
  }
  for (const members of byLayer.values()) members.sort((left, right) => left.id.localeCompare(right.id, "en"));

  const laidOut: LaidOutNode[] = [];
  let maxWidth = 0;
  const layers = [...byLayer.keys()].sort((left, right) => left - right);
  for (const layer of layers) {
    let cursorX = MARGIN;
    const y = MARGIN + layer * (NODE_HEIGHT + LAYER_GAP);
    for (const node of byLayer.get(layer)!) {
      const width = Math.max(64, node.id.length * CHAR_WIDTH + NODE_PADDING);
      laidOut.push({
        ...node,
        x: cursorX,
        y,
        width,
        isTerminal: node.type === "terminal" || !outbound.has(node.id),
      });
      cursorX += width + NODE_GAP;
    }
    maxWidth = Math.max(maxWidth, cursorX);
  }
  const height = MARGIN * 2 + (layers.length > 0 ? layers.length - 1 : 0) * (NODE_HEIGHT + LAYER_GAP) + NODE_HEIGHT + 40;
  return { nodes: laidOut, width: Math.max(maxWidth, MARGIN * 2 + 64), height };
}

function nodeShape(node: LaidOutNode): "diamond" | "pill" | "rect" {
  if (node.type === "gate") return "diamond";
  if (node.isTerminal) return "pill";
  return "rect";
}

function WorkflowDiagram({ workflow, index }: { readonly workflow: WorkflowGraph; readonly index: number }) {
  const layout = layoutWorkflow(workflow);
  const byId = new Map(layout.nodes.map((node) => [node.id, node]));
  // Short, index-based (not name-based) — this id is repeated in every
  // edge's `markerEnd` reference, and the page renders all three graphs.
  const markerId = `a${index}`;

  return (
    <svg viewBox={`0 0 ${layout.width} ${layout.height}`} aria-hidden="true" className="wd-svg">
      <defs>
        <marker id={markerId} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0,0 L10,5 L0,10 z" fill="var(--vc-color-border-strong)" />
        </marker>
      </defs>
      {workflow.edges.map((edge, index) => {
        const from = byId.get(edge.from);
        const to = byId.get(edge.to);
        if (!from || !to) return null;
        const isRecovery = edge.type === "retry";
        const strokeDasharray = isRecovery ? "4 3" : undefined;
        const key = edge.id ?? `${edge.from}-${edge.to}-${index}`;
        if (edge.from === edge.to) {
          // A self-loop (only `retry` edges in these three graphs): a small
          // fixed-radius circle beside the node rather than a bespoke curve
          // — same visual meaning (a path that returns to its own node),
          // far fewer distinct coordinates to encode.
          const cx = from.x + from.width + SELF_LOOP_RADIUS;
          const cy = from.y + NODE_HEIGHT / 2;
          return (
            <Fragment key={key}>
              <circle cx={cx} cy={cy} r={SELF_LOOP_RADIUS} className="wd-edge" strokeDasharray={strokeDasharray} />
              {isRecovery && (
                <text x={cx} y={cy + 3} textAnchor="middle" className="wd-edge-label">
                  {edge.type}
                </text>
              )}
            </Fragment>
          );
        }
        const x1 = from.x + from.width / 2;
        const y1 = from.y + NODE_HEIGHT;
        const x2 = to.x + to.width / 2;
        const y2 = to.y;
        const midX = (x1 + x2) / 2;
        const midY = (y1 + y2) / 2;
        return (
          <Fragment key={key}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} className="wd-edge" strokeDasharray={strokeDasharray} markerEnd={`url(#${markerId})`} />
            {isRecovery && (
              <text x={midX + 4} y={midY} className="wd-edge-label">
                {edge.type}
              </text>
            )}
          </Fragment>
        );
      })}
      {layout.nodes.map((node) => {
        const shape = nodeShape(node);
        const cx = node.x + node.width / 2;
        const cy = node.y + NODE_HEIGHT / 2;
        return (
          <Fragment key={node.id}>
            {shape === "diamond" && (
              <polygon
                points={`${node.x},${cy} ${cx},${node.y} ${node.x + node.width},${cy} ${cx},${node.y + NODE_HEIGHT}`}
                className="wd-node wd-node-gate"
              />
            )}
            {shape === "pill" && (
              <rect x={node.x} y={node.y} width={node.width} height={NODE_HEIGHT} rx={NODE_HEIGHT / 2} className="wd-node wd-node-terminal" />
            )}
            {shape === "rect" && <rect x={node.x} y={node.y} width={node.width} height={NODE_HEIGHT} className="wd-node" />}
            <text x={cx} y={cy + 4} textAnchor="middle" className="wd-node-label">
              {node.id}
            </text>
          </Fragment>
        );
      })}
    </svg>
  );
}

export function WorkflowMapExperience({ catalogPage, children }: DocsScreenContext) {
  const strings = STRINGS[catalogPage.locale] ?? STRINGS.en;
  const workflows = readWorkflows();

  return (
    <div className="workflow-map">
      {workflows.map((workflow, index) => (
        <div key={workflow.id} className="workflow-diagram" id={`${workflow.id}-diagram`}>
          <h3>{strings.diagramHeading}: {workflow.id}</h3>
          <WorkflowDiagram workflow={workflow} index={index} />
        </div>
      ))}
      {children}
    </div>
  );
}
