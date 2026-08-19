import type { DocsScreenContext } from "../docs-screen-registry.tsx";
import { Topology, type TopologyEdge, type TopologyNode } from "../prose/index.ts";

// D09 — Configuration. The authored MDX body already carries the two config
// paths, the may-set/may-not-set table for both layers, the exact
// `config prefs resolve` command, the rejected-key and redaction sentences,
// and the telemetry/security paragraphs, all present in initial HTML with
// no JavaScript required. This wrapper adds one diagram the prose never
// draws: how the two authority layers actually merge into what a reader
// sees from `resolve` — the user layer and the project layer both feed the
// resolver, which either emits an effective value, drops a user-only key a
// project file tried to set, or redacts a notification destination in its
// own output. It never restates the may-set/may-not-set table itself —
// that stays the authored table's job; this shows only the merge and its
// two visible outcomes, satisfying the D09 test requirement that rejected
// keys and redaction behavior are visible. `Topology` always renders the
// same legend and from/to table as its text equivalent, so the shape is
// understood even with the SVG absent or CSS disabled.

const STRINGS = {
  en: { heading: "Config resolution" },
  vi: { heading: "Giải quyết cấu hình" },
} as const;

const NODES: Record<"en" | "vi", readonly TopologyNode[]> = {
  en: [
    { id: "user", label: "User config (~/.ariadnev)" },
    { id: "project", label: "Project config (<project>/.ariadnev)" },
    { id: "resolve", label: "config prefs resolve", shape: "diamond" },
    { id: "effective", label: "Effective values", shape: "pill" },
    { id: "rejected", label: "Rejected keys (dropped)", shape: "pill" },
    { id: "redacted", label: "Notification URLs (redacted)", shape: "pill" },
  ],
  vi: [
    { id: "user", label: "Cấu hình người dùng (~/.ariadnev)" },
    { id: "project", label: "Cấu hình dự án (<project>/.ariadnev)" },
    { id: "resolve", label: "config prefs resolve", shape: "diamond" },
    { id: "effective", label: "Giá trị có hiệu lực", shape: "pill" },
    { id: "rejected", label: "Khóa bị từ chối (bị loại)", shape: "pill" },
    { id: "redacted", label: "URL thông báo (được ẩn)", shape: "pill" },
  ],
};

const EDGES: Record<"en" | "vi", readonly TopologyEdge[]> = {
  en: [
    { from: "user", to: "resolve" },
    { from: "project", to: "resolve" },
    { from: "resolve", to: "effective" },
    { from: "resolve", to: "rejected", label: "user-only key in project file", dashed: true },
    { from: "resolve", to: "redacted", label: "printed output", dashed: true },
  ],
  vi: [
    { from: "user", to: "resolve" },
    { from: "project", to: "resolve" },
    { from: "resolve", to: "effective" },
    { from: "resolve", to: "rejected", label: "khóa chỉ-người-dùng trong file dự án", dashed: true },
    { from: "resolve", to: "redacted", label: "kết quả in ra", dashed: true },
  ],
};

export function ConfigurationExperience({ catalogPage, children }: DocsScreenContext) {
  const locale = catalogPage.locale;
  const strings = STRINGS[locale] ?? STRINGS.en;
  const nodes = NODES[locale] ?? NODES.en;
  const edges = EDGES[locale] ?? EDGES.en;
  return (
    <>
      <div className="authored-screen-instrument authored-screen-decision authored-screen-configuration" data-surface-context="instrument">
        <Topology locale={locale} heading={strings.heading} nodes={nodes} edges={edges} />
      </div>
      {children}
    </>
  );
}
