# Execution cartography

The design contract for both the marketing site and the documentation. It is
framework-neutral on purpose: Astro and Fumadocs consume the same generated
tokens, and neither owns the visual language.

## The thesis

vcskill is an execution control plane. The interface should read like a map of
where execution went, not like a product brochure with a graph pasted into it.

Five roles carry that:

| Role | Token family | Means |
|---|---|---|
| **Ink** | `--vcs-color-ink-*` | The ground. Never pure black — pure black flattens depth and reads as a terminal, not a map. |
| **Graphite** | `--vcs-color-graphite-*` | Structure: edges, rules, inactive topology. |
| **Cool white** | `--vcs-color-cool-*` | Surfaces and text. |
| **Spectral blue** | `--vcs-color-spectral-*` | Live execution: an active path, a running node, a resolved witness. |
| **Copper** | `--vcs-color-copper-*` | Human gates: approval required, held, awaiting a decision. |

Spectral and copper carry the entire semantic load. If a third accent appears,
the map has stopped meaning anything.

## Vocabulary

These four words have fixed meanings across UI, docs, and diagrams. Use them
exactly; do not substitute synonyms.

- **Topology** — the shape of a workflow: its nodes and the edges between them.
  Drawn with `--vcs-topology-node` and `--vcs-topology-edge`.
- **Gate** — a point where execution stops until a human or a policy releases
  it. Always copper (`--vcs-topology-gate`). A gate is never green.
- **Checkpoint** — a durable saved state execution can resume from. Drawn in
  cool white (`--vcs-topology-checkpoint`).
- **Path witness** — the record that a specific edge was actually taken.
  Spectral (`--vcs-topology-witness`). A witness is evidence, so it is only ever
  drawn for an edge that really executed.

## Consuming tokens

Import one generated entry point. Never import `tokens.json`, and never
hand-edit anything in `dist/`.

```css
/* apps/site */
@import "@vcskill-web/tokens/site.css";
```

Then reference semantic roles, never a raw palette step:

```css
.panel {
  background: var(--vcs-surface-raised);
  border: var(--vcs-border-width-hairline) solid var(--vcs-surface-border);
  border-radius: var(--vcs-border-radius-md);
  color: var(--vcs-text-primary);
  padding: var(--vcs-space-5);
}
```

`--vcs-color-ink-800` and `--vcs-surface-raised` resolve to the same colour
today. Use the second one: when the palette moves, only the alias needs editing.

## Type

Three faces, all self-hosted and all with complete Vietnamese coverage:

| Role | Family | Used for |
|---|---|---|
| Display | Be Vietnam Pro | Headings and the display voice |
| Body | Inter | Body copy and interface text |
| Mono | JetBrains Mono | CLI transcripts, code, graph node labels |

The display face is a Vietnamese-first design, which matters because Vietnamese
stacks two diacritics on one vowel. A face that was retrofitted for Vietnamese
collides those marks at display sizes.

Body text is `--vcs-font-size-md` at `--vcs-font-line-height-normal`. Prose is
capped at `--vcs-size-prose-max`; marketing layout is capped at
`--vcs-size-content-max`.

## Non-negotiables

- **Focus is never removed.** Use `--vcs-focus-*`. On a light surface swap to
  `--vcs-focus-color-on-light`; do not delete the ring.
- **Colour never carries meaning alone.** A gate is copper *and* labelled. A
  failed step is red *and* has an icon or text. Roughly one reader in twelve
  cannot rely on the hue.
- **Touch targets are at least `--vcs-size-touch-target`** (44px, the WCAG 2.2
  floor).
- **Spacing comes from the scale.** Every value is a multiple of 4px. There is
  no `13px`.
- **Motion stays under 400ms** and respects `prefers-reduced-motion`, which the
  generated CSS already zeroes.

## Anti-patterns

| Do not | Because |
|---|---|
| Add a gradient behind body text | The ground is ink; gradients destroy the map metaphor and hurt contrast |
| Use green for a gate | Green means passed. A gate is unresolved — that is copper |
| Introduce a fourth accent hue | Two accents is the whole semantic system; a third makes all three meaningless |
| Glow to show elevation | Elevation is a hairline plus a ground shadow (`--vcs-elevation-*`) |
| Hardcode `#0b0d12` or any hex | Authored colour is OKLCH and lives in `tokens.json` |
| Round corners past `--vcs-border-radius-lg` | The drawing reads as drafted, not as a consumer app |
| Animate an execution path on loop | Motion means something changed. A loop means nothing changed |

## Changing a token

1. Edit `packages/tokens/src/tokens.json`.
2. Run `pnpm --filter @vcskill-web/tokens run build`.
3. Commit both the source and the regenerated `dist/*.css`.

`tests/tokens/` will fail if the committed CSS is stale, if a text role drops
below its contrast threshold, if spacing leaves the 4px grid, or if a font loses
Vietnamese coverage.
