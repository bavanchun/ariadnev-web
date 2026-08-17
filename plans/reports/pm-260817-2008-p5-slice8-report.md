# Phase 5 slice 8 — D16 workflow topology diagrams

Commit: `ebf51c9`

Registered `D16-workflow-reference`. `workflow-map.tsx` renders one static
inline `<svg>` per workflow, laid out from `workflows.json` (BFS layering
from entry nodes, top-to-bottom) with literal JSX `<rect>`/`<polygon>`/
`<line>`/`<circle>`/`<text>` — no `dangerouslySetInnerHTML`, no client
script, no image. Diamond = gate, dashed pill = terminal, arrowhead =
direction, dashed stroke + type label = recovery (`retry`). The generated
legend/topology/nodes/edges Markdown renders unchanged below and stays
authoritative for print/CSS-disabled/assistive contexts; the SVG is
`aria-hidden` as a supplementary visual.

## Byte budget was the real work here

First pass (per-node start/end text badges, full ARIA labelling, bezier
self-loops) measured 304034–304977 bytes on the `vi/*/reference/workflows/`
routes against the frozen 304000-byte compressed per-route cap — confirmed
via `pnpm run --filter @ariadnev-web/docs build`. `en/*` passed from the
start; only `vi/*` (longer strings elsewhere on the same page) was over.

Iterated ~12 times, re-measuring after each cut, because the cap check
brotli-compresses (quality 9) the route's HTML *and every referenced
resource* (including the shared `docs.css`), so raw-character trims
compress away almost for free (repeated tokens) while genuinely unique
data (node/edge coordinates, ids) barely compresses at all — the same
lesson slice 5's report already drew for the search-index budget, now
confirmed for the per-route ratchet too. What actually moved the needle:
dropped per-node start/end text badges (kept in the diagram only as
position + shape; the Markdown's "Entry points" section already names
every entry node in text), replaced the self-loop bezier curve with a
fixed-radius circle (far fewer unique coordinates), dropped
`role="img"`/`aria-label` in favor of `aria-hidden="true"` (the diagram is
supplementary, not the text equivalent), moved repeated inline styling to
shared CSS classes, and tightened the layout constants. Landed with margin
after a full `pnpm run build` (all 6 workspace packages) and two repeat
docs-only rebuilds confirming stability.

## Verification

`pnpm --filter @ariadnev-web/docs typecheck` clean; `pnpm run build`
(monorepo) succeeds; `pnpm run test` — 54 native docs + 176 vitest, all
pass; manual inspection of `en/stable/reference/workflows/index.html`
confirms the SVG renders with correct node/edge counts.
