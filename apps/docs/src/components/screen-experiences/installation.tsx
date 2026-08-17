import type { DocsScreenContext } from "../docs-screen-registry.tsx";
import { Topology, type TopologyEdge, type TopologyNode } from "../prose/index.ts";

// D03 — Installation. The authored MDX body already carries every platform
// command, the numbered "What the installer does" steps, and the macOS
// Gatekeeper boundary as a blockquote — all present in initial HTML with no
// JavaScript required, so this wrapper never restates a command, URL, or
// checksum. It adds one thing the prose cannot express as prose: a single
// diagram of the integrity flow every platform shares (resolve → download →
// verify → the macOS-only Gatekeeper decision → link), so a reader gets the
// shape of "what happens" before reading the platform-specific steps below.
// The diagram is `aria-hidden`; `Topology` always renders the same legend
// and from/to table as its text equivalent, so nothing here depends on the
// SVG rendering to be understood.

const STRINGS = {
  en: { heading: "Installer integrity flow" },
  vi: { heading: "Luồng xác minh khi cài đặt" },
} as const;

const NODES: Record<"en" | "vi", readonly TopologyNode[]> = {
  en: [
    { id: "resolve", label: "Resolve version" },
    { id: "download", label: "Download binary + checksums" },
    { id: "verify", label: "Verify sha256" },
    { id: "gatekeeper", label: "macOS Gatekeeper?", shape: "diamond" },
    { id: "link", label: "Link av alias", shape: "pill" },
  ],
  vi: [
    { id: "resolve", label: "Xác định phiên bản" },
    { id: "download", label: "Tải file nhị phân + checksum" },
    { id: "verify", label: "Xác minh sha256" },
    { id: "gatekeeper", label: "Gatekeeper macOS?", shape: "diamond" },
    { id: "link", label: "Liên kết alias av", shape: "pill" },
  ],
};

const EDGES: Record<"en" | "vi", readonly TopologyEdge[]> = {
  en: [
    { from: "resolve", to: "download" },
    { from: "download", to: "verify" },
    { from: "verify", to: "gatekeeper" },
    { from: "gatekeeper", to: "link", label: "macOS only", dashed: true },
    { from: "verify", to: "link" },
  ],
  vi: [
    { from: "resolve", to: "download" },
    { from: "download", to: "verify" },
    { from: "verify", to: "gatekeeper" },
    { from: "gatekeeper", to: "link", label: "chỉ macOS", dashed: true },
    { from: "verify", to: "link" },
  ],
};

export function InstallationExperience({ catalogPage, children }: DocsScreenContext) {
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
