import type { DocsScreenContext } from "../docs-screen-registry.tsx";
import { Topology, type TopologyEdge, type TopologyNode } from "../prose/index.ts";

// D11 — Migration. The authored MDX body already carries the four numbered
// `##` sections, every `rm -rf`/`rm -f` command as inert fenced text (never
// a link or button), the destructive blockquote warning before step 2, and
// the "what is not carried over" preservation list, all present in initial
// HTML with no JavaScript required. This wrapper adds one diagram the prose
// states as two alternative paragraphs but never draws as a single path:
// whether the old binary is still present decides step 1's command (`vc
// uninstall` vs reading the old receipt by hand), and both branches funnel
// into the same two irreversible removal stages before the final reinstall.
// It never restates the destructive blockquote itself, and no node label
// turns a removal command into anything but plain text — `Topology` always
// renders the same legend and from/to table as its text equivalent, so the
// shape and the irreversible stages are understood even with the SVG
// absent or CSS disabled.

const STRINGS = {
  en: { heading: "Migration stages" },
  vi: { heading: "Các giai đoạn di trú" },
} as const;

const NODES: Record<"en" | "vi", readonly TopologyNode[]> = {
  en: [
    { id: "check", label: "Old binary still installed?", shape: "diamond" },
    { id: "vc-uninstall", label: "vc uninstall --provider …", shape: "pill" },
    { id: "read-receipt", label: "Read .vcskill/receipt.json", shape: "pill" },
    { id: "remove-state", label: "Remove state + cache (rm -rf, irreversible)" },
    { id: "remove-binary", label: "Remove old binary + alias (rm -f, irreversible)" },
    { id: "install-again", label: "ariadnev install", shape: "pill" },
  ],
  vi: [
    { id: "check", label: "Vẫn còn binary cũ?", shape: "diamond" },
    { id: "vc-uninstall", label: "vc uninstall --provider …", shape: "pill" },
    { id: "read-receipt", label: "Đọc .vcskill/receipt.json", shape: "pill" },
    { id: "remove-state", label: "Xóa state + cache (rm -rf, không thể hoàn tác)" },
    { id: "remove-binary", label: "Xóa binary cũ + bí danh (rm -f, không thể hoàn tác)" },
    { id: "install-again", label: "ariadnev install", shape: "pill" },
  ],
};

const EDGES: Record<"en" | "vi", readonly TopologyEdge[]> = {
  en: [
    { from: "check", to: "vc-uninstall", label: "yes" },
    { from: "check", to: "read-receipt", label: "no", dashed: true },
    { from: "vc-uninstall", to: "remove-state" },
    { from: "read-receipt", to: "remove-state" },
    { from: "remove-state", to: "remove-binary" },
    { from: "remove-binary", to: "install-again" },
  ],
  vi: [
    { from: "check", to: "vc-uninstall", label: "có" },
    { from: "check", to: "read-receipt", label: "không", dashed: true },
    { from: "vc-uninstall", to: "remove-state" },
    { from: "read-receipt", to: "remove-state" },
    { from: "remove-state", to: "remove-binary" },
    { from: "remove-binary", to: "install-again" },
  ],
};

export function MigrationFromVcskillExperience({ catalogPage, children }: DocsScreenContext) {
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
