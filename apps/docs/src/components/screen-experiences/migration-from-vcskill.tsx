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

interface DiffRow {
  aspect: string;
  vcskill: string;
  ariadnev: string;
}

const DIFF_ROWS: Record<"en" | "vi", readonly DiffRow[]> = {
  en: [
    { aspect: "Binary command", vcskill: "vc", ariadnev: "ariadnev" },
    { aspect: "State directory", vcskill: "~/.vcskill/", ariadnev: "~/.ariadnev/" },
    { aspect: "Receipt file", vcskill: ".vcskill/receipt.json", ariadnev: ".ariadnev/receipt.json" },
    { aspect: "Env prefix", vcskill: "VCSKILL_*", ariadnev: "ARIADNEV_*" },
  ],
  vi: [
    { aspect: "Lệnh binary", vcskill: "vc", ariadnev: "ariadnev" },
    { aspect: "Thư mục state", vcskill: "~/.vcskill/", ariadnev: "~/.ariadnev/" },
    { aspect: "Tệp receipt", vcskill: ".vcskill/receipt.json", ariadnev: ".ariadnev/receipt.json" },
    { aspect: "Tiền tố biến môi trường", vcskill: "VCSKILL_*", ariadnev: "ARIADNEV_*" },
  ],
};

function MigrationDiffTable({ locale }: { locale: "en" | "vi" }) {
  const rows = DIFF_ROWS[locale] ?? DIFF_ROWS.en;
  const isVi = locale === "vi";
  return (
    <div className="migration-diff-table" tabIndex={0}>
      <table>
        <caption>{isVi ? "Bảng đối chiếu chuyển đổi" : "Quick Migration Mapping"}</caption>
        <thead>
          <tr>
            <th scope="col">{isVi ? "Hạng mục" : "Aspect"}</th>
            <th scope="col">vcskill (Legacy)</th>
            <th scope="col">ariadnev (Current)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.aspect}>
              <td><strong>{row.aspect}</strong></td>
              <td><code>{row.vcskill}</code></td>
              <td><code>{row.ariadnev}</code></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MigrationFromVcskillExperience({ catalogPage, children }: DocsScreenContext) {
  const locale = catalogPage.locale;
  const strings = STRINGS[locale] ?? STRINGS.en;
  const nodes = NODES[locale] ?? NODES.en;
  const edges = EDGES[locale] ?? EDGES.en;
  return (
    <>
      <div className="authored-screen-instrument authored-screen-migration" data-surface-context="instrument">
        <Topology locale={locale} heading={strings.heading} nodes={nodes} edges={edges} />
      </div>
      <MigrationDiffTable locale={locale} />
      {children}
    </>
  );
}
