# Execution cartography

vcskill presents agent work as an inspectable route through a system: a start,
ordered execution lanes, explicit gates, observable checkpoints, and retained
evidence. Geometry is information, not decoration. A reader should understand
what can run, what did run, and where a decision was enforced before reading
supporting prose.

The authored contract is
`packages/tokens/src/tokens.json`. The generated
`@vcskill/tokens/site.css` and `@vcskill/tokens/docs.css` entry points are the
only palette, typography, spacing, focus, and motion authority for application
code. Generated files are never edited by hand.

## Layout

Compose pages as routes rather than collections of interchangeable panels.
Each major section has one visual entry point, a clear reading direction, and a
bounded measure. Use execution lanes for parallel concerns and a single witness
line for the primary path. A panel is justified only when its boundary conveys
ownership, state, or an execution boundary.

- Use the shared spacing rhythm from `--vc-space-1` through
  `--vc-space-24`; do not introduce one-off gaps.
- Keep marketing prose within `--vc-size-content-site`, documentation prose
  within `--vc-size-content-docs`, and code within
  `--vc-size-content-code`.
- Align labels, nodes, and evidence to one dominant left edge. Centering is
  reserved for a single terminal state, never mixed arbitrarily with lane
  content.
- Let whitespace separate phases. Decorative containers must not manufacture
  hierarchy that the content does not possess.

Approved: one horizontal execution route with labeled branches that converge
at a verified outcome.

Prohibited: a uniform grid of feature boxes whose positions could be shuffled
without changing meaning.

## Topology

Topology marks have fixed semantics:

| Mark | Meaning | Required token roles |
| --- | --- | --- |
| Node | An executable unit or addressable artifact | `graph-node`, `graph-node-active` |
| Edge | A permitted transition or data handoff | `graph-edge`, `graph-edge-active` |
| Gate | A policy or validation boundary that can stop progress | `gate` |
| Checkpoint | An observed state worth returning to | `checkpoint` |
| Evidence | A retained proof attached to a claim | `evidence` |

Direction is shown with position, labels, and a restrained arrowhead. Color
never carries state alone: pair it with a label, stroke treatment, icon, or
shape. Dashed edges mean conditional or pending; solid edges mean available or
observed. Do not draw a dense network merely to signal “AI.”

## Typography

- `--vc-font-family-display` carries product theses, section entries, and
  outcome statements.
- `--vc-font-family-body` carries explanations and documentation.
- `--vc-font-family-mono` carries commands, paths, graph labels, versions, and
  machine evidence.
- Weight and scale establish hierarchy; extra families do not.
- Vietnamese and English use the same hierarchy. Never reduce Vietnamese text
  size to compensate for line length.

All three fonts are committed WOFF2 assets with `font-display: swap`, stable
system fallbacks, pinned provenance, checksums, OFL license text, and actual cmap
coverage verified by `tests/tokens/font-contract.test.mjs`.

## Palette

Applications consume semantic roles only. The private OKLCH palette combines
ink-black, spectral blue, copper, cool-white, and graphite with explicit
success, warning, danger, and evidence states. The marketing surface uses the
dark mapping; docs use the light mapping. Neither app may expose or recreate
raw palette primitives.

Body and interactive text pairs meet at least 4.5:1. Focus, strong borders, and
meaningful graph states meet at least 3:1 against their canvas. Selection always
defines both foreground and background. Status color is paired with visible
language such as “passed,” “held,” or “blocked.”

Approved: copper identifies a gate while its text label names the policy.

Prohibited: using blue, green, or red as the only indication of state.

## Focus

Every interactive target is at least `--vc-size-control-minimum` in both
dimensions. The focus indicator always layers `--vc-color-focus` and
`--vc-color-focus-contrast` as adjacent, zero-blur rings using the shared ring
width and offset. One layer is light and the other is dark, so at least one
maintains 3:1 contrast against every semantic palette role. Rendering either
layer alone is not conforming. A tight zero-blur focus ring is an accessibility
indicator, not a decorative drop shadow. Focus is never removed without a
visible replacement, and focus order follows reading and execution order.

Keyboard users must be able to reach navigation, locale/version controls,
search, copy actions, graph details, and recovery links. Hover cannot reveal
essential content. Heading and landmark order remains semantic even when the
visual route changes direction.

## Motion

Entrance, feedback, and topology traversal each have one duration, one easing,
and one transform contract. Motion explains causality: a path may activate
after its source node, and evidence may appear after its checkpoint. It must
not delay access, loop for ambience, or become the only proof that state
changed.

The final state is the default DOM and CSS state. Animation is an enhancement
applied from an optional starting transform. Under
`prefers-reduced-motion: reduce`, all three durations become `0ms` and all
three transform distances become `0px`; no information disappears.

## Responsive behavior

At wide widths, lanes may run horizontally when the reading order remains
obvious. Below the point where labels collide, preserve source order and stack
the route vertically. Edges become short vertical witnesses; gates and
checkpoints remain attached to the same content.

- At 320, 375, and 390 CSS pixels, use one content lane with no horizontal
  document overflow. Code regions may scroll internally.
- At 768 CSS pixels, introduce a second lane only when both lanes retain
  readable measures.
- At 1280 and 1440 CSS pixels, spend extra width on route context and whitespace,
  not longer prose lines.
- Never hide nodes, evidence, navigation, or recovery content to make a viewport
  fit.

## Anti-patterns

The following are explicitly prohibited:

- gradients;
- glassmorphism;
- decorative orbs;
- generic card grids;
- broad drop shadows;
- AgentKit surface copy or close paraphrases;
- rotating headlines;
- hidden-by-default essential content;
- anonymous “neural network” webs with no product meaning;
- app-local colors, remote font imports, timing scales, or token overrides.

If a new visual requirement cannot be expressed with the existing semantic
roles, return it to this package, name the missing product meaning, add a tested
token, and regenerate both entry points.
