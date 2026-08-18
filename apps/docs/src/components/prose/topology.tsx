import { Fragment } from "react";
import type { DocsLocale } from "@/lib/i18n.ts";

// Phase 4 closed content component — Topology. A general-purpose small
// static SVG diagram primitive, mirroring the shape of the D16
// `reference/workflow-map.tsx` pattern (BFS layer layout, straight edges,
// shape-plus-text node distinction) but generalized: it takes literal
// node/edge props from a TypeScript caller instead of reading a specific
// generated bundle file, so any screen (D05 kit→adapt→projection→receipt,
// D06 flagship topology, D09 authority layers, D11 migration stages) can
// describe its own small graph.
//
// The SVG is `aria-hidden` — a supplementary visual only. This component
// always additionally renders an ordered legend list and a from→to
// adjacency table built from the same `nodes`/`edges` props, so every
// topology carries its text equivalent in the same place its diagram does;
// callers never have to remember to hand-roll one. No `dangerouslySetInnerHTML`,
// no client script, no image — plain SVG as ordinary JSX.

export type TopologyNodeShape = "rect" | "diamond" | "pill";

export interface TopologyNode {
  readonly id: string;
  readonly label: string;
  readonly shape?: TopologyNodeShape;
}

export interface TopologyEdge {
  readonly from: string;
  readonly to: string;
  readonly label?: string;
  readonly dashed?: boolean;
}

interface TopologyStrings {
  readonly diagramHeading: string;
  readonly legendHeading: string;
  readonly adjacencyHeading: string;
  readonly fromColumn: string;
  readonly toColumn: string;
  readonly viaColumn: string;
}

const STRINGS: Record<DocsLocale, TopologyStrings> = {
  en: {
    diagramHeading: "Diagram",
    legendHeading: "Nodes",
    adjacencyHeading: "Connections",
    fromColumn: "From",
    toColumn: "To",
    viaColumn: "Via",
  },
  vi: {
    diagramHeading: "Sơ đồ",
    legendHeading: "Nút",
    adjacencyHeading: "Kết nối",
    fromColumn: "Từ",
    toColumn: "Đến",
    viaColumn: "Qua",
  },
};

const NODE_HEIGHT = 22;
const LAYER_GAP = 34;
const NODE_GAP = 8;
const CHAR_WIDTH = 7;
const NODE_PADDING = 18;
const MARGIN = 12;

interface LaidOutNode extends TopologyNode {
  readonly x: number;
  readonly y: number;
  readonly width: number;
}

/** BFS distance layering from every entry node (no inbound edge), top to bottom. Deterministic for a given node/edge order; nodes unreachable from an entry land in one trailing layer. */
function layoutTopology(nodes: readonly TopologyNode[], edges: readonly TopologyEdge[]): { readonly nodes: readonly LaidOutNode[]; readonly width: number; readonly height: number } {
  const inbound = new Set(edges.map((edge) => edge.to));
  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    if (edge.from === edge.to) continue;
    if (!adjacency.has(edge.from)) adjacency.set(edge.from, []);
    adjacency.get(edge.from)!.push(edge.to);
  }
  const entryIds = nodes.filter((node) => !inbound.has(node.id)).map((node) => node.id);
  const layerOf = new Map<string, number>();
  let frontier = entryIds.length > 0 ? entryIds : nodes.slice(0, 1).map((node) => node.id);
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
  for (const node of nodes) if (!layerOf.has(node.id)) layerOf.set(node.id, maxLayer + 1);

  const byLayer = new Map<number, TopologyNode[]>();
  for (const node of nodes) {
    const layer = layerOf.get(node.id)!;
    if (!byLayer.has(layer)) byLayer.set(layer, []);
    byLayer.get(layer)!.push(node);
  }

  const laidOut: LaidOutNode[] = [];
  let maxWidth = 0;
  const layers = [...byLayer.keys()].sort((left, right) => left - right);
  const layerWidths = new Map<number, number>();

  for (const layer of layers) {
    let cursorX = MARGIN;
    for (const node of byLayer.get(layer)!) {
      const isDiamond = node.shape === "diamond";
      const width = Math.max(isDiamond ? 120 : 72, node.label.length * (isDiamond ? CHAR_WIDTH * 1.25 : CHAR_WIDTH) + (isDiamond ? NODE_PADDING * 2 : NODE_PADDING));
      cursorX += width + NODE_GAP;
    }
    const totalW = cursorX - NODE_GAP + MARGIN;
    layerWidths.set(layer, totalW);
    maxWidth = Math.max(maxWidth, totalW);
  }

  const diagramWidth = Math.max(maxWidth, 240);

  for (const layer of layers) {
    const layerW = layerWidths.get(layer) ?? 0;
    let cursorX = MARGIN + Math.max(0, (diagramWidth - layerW) / 2);
    const y = MARGIN + layer * (NODE_HEIGHT + LAYER_GAP);
    for (const node of byLayer.get(layer)!) {
      const isDiamond = node.shape === "diamond";
      const width = Math.max(isDiamond ? 120 : 72, node.label.length * (isDiamond ? CHAR_WIDTH * 1.25 : CHAR_WIDTH) + (isDiamond ? NODE_PADDING * 2 : NODE_PADDING));
      laidOut.push({ ...node, x: cursorX, y, width });
      cursorX += width + NODE_GAP;
    }
  }
  const height = MARGIN * 2 + (layers.length > 0 ? layers.length - 1 : 0) * (NODE_HEIGHT + LAYER_GAP) + NODE_HEIGHT + 20;
  return { nodes: laidOut, width: diagramWidth, height };
}

export interface TopologyProps {
  readonly locale: DocsLocale;
  readonly heading: string;
  readonly nodes: readonly TopologyNode[];
  readonly edges: readonly TopologyEdge[];
  readonly id?: string;
}

export function Topology({ locale, heading, nodes, edges, id }: TopologyProps) {
  const strings = STRINGS[locale] ?? STRINGS.en;
  const layout = layoutTopology(nodes, edges);
  const byId = new Map(layout.nodes.map((node) => [node.id, node]));
  const markerId = id ? `${id}-arrow` : `topology-${heading.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-arrow`;

  // Reuses the D16 `.wd-*` class names `docs.css` already defines for
  // `reference/workflow-map.tsx` — same visual language, zero new CSS for
  // the SVG (the shared static-byte budget for the tightest-margin route
  // has effectively no headroom; see the comment above `.wd-svg` for the
  // colours these classes resolve to). The arrowhead fill is set inline,
  // matching the one attribute workflow-map.tsx also sets inline rather
  // than via a class.
  return (
    <div id={id}>
      <h3>
        {strings.diagramHeading}: {heading}
      </h3>
      <svg viewBox={`0 0 ${layout.width} ${layout.height}`} aria-hidden="true" className="wd-svg">
        <defs>
          <marker id={markerId} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M0,0 L10,5 L0,10 z" fill="var(--vc-color-border-strong)" />
          </marker>
        </defs>
        {edges.map((edge, index) => {
          const from = byId.get(edge.from);
          const to = byId.get(edge.to);
          if (!from || !to) return null;
          const x1 = from.x + from.width / 2;
          const y1 = from.y + NODE_HEIGHT;
          const x2 = to.x + to.width / 2;
          const y2 = to.y;
          const midX = (x1 + x2) / 2;
          const midY = (y1 + y2) / 2;
          const key = `${edge.from}-${edge.to}-${index}`;
          return (
            <Fragment key={key}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} className="wd-edge" strokeDasharray={edge.dashed ? "4 3" : undefined} markerEnd={`url(#${markerId})`} />
              {edge.label && (
                <text x={midX + 4} y={midY} className="wd-edge-label">
                  {edge.label}
                </text>
              )}
            </Fragment>
          );
        })}
        {layout.nodes.map((node) => {
          const shape = node.shape ?? "rect";
          const cx = node.x + node.width / 2;
          const cy = node.y + NODE_HEIGHT / 2;
          return (
            <Fragment key={node.id}>
              {shape === "diamond" && (
                <polygon
                  points={`${node.x},${cy} ${cx},${node.y - 4} ${node.x + node.width},${cy} ${cx},${node.y + NODE_HEIGHT + 4}`}
                  className="wd-node wd-node-gate"
                />
              )}
              {shape === "pill" && (
                <rect x={node.x} y={node.y} width={node.width} height={NODE_HEIGHT} rx={NODE_HEIGHT / 2} className="wd-node wd-node-terminal" />
              )}
              {shape === "rect" && <rect x={node.x} y={node.y} width={node.width} height={NODE_HEIGHT} className="wd-node" />}
              <text x={cx} y={cy + 4} textAnchor="middle" className="wd-node-label">
                {node.label}
              </text>
            </Fragment>
          );
        })}
      </svg>
      <h4 className="visually-hidden">{strings.legendHeading}</h4>
      <ol>
        {nodes.map((node) => (
          <li key={node.id}>{node.label}</li>
        ))}
      </ol>
      {edges.length > 0 && (
        <table>
          <caption className="visually-hidden">{strings.adjacencyHeading}</caption>
          <thead>
            <tr>
              <th scope="col">{strings.fromColumn}</th>
              <th scope="col">{strings.toColumn}</th>
              {edges.some((edge) => edge.label) && <th scope="col">{strings.viaColumn}</th>}
            </tr>
          </thead>
          <tbody>
            {edges.map((edge, index) => (
              <tr key={`${edge.from}-${edge.to}-${index}`}>
                <td>{edge.from}</td>
                <td>{edge.to}</td>
                {edges.some((candidate) => candidate.label) && <td>{edge.label ?? ""}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
