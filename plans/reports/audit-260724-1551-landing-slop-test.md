# Hallmark-style Slop Audit: `landing.html`

**Mode:** audit (score + punch-list, no edits) · **Date:** 2026-07-24
**Target:** `landing.html` (710 lines, single-file inline) · **Genre:** atmospheric (AI dev-tool) — correct

## Self-critique scores (1–5)
| Axis | Score | Note |
|---|---|---|
| Philosophy | 5 | Coherent terminal/blueprint dev-tool POV |
| Hierarchy | 4 | Strong; eyebrow-on-every-section flattens rhythm slightly |
| Execution | 4 | Polished; dinged by no focus states + overflow-x hack + un-tokenized literals |
| Specificity | 5 | Adapt matrix, playbook, real commands — not generic |
| Restraint | 4 | Traffic-light dots + everywhere-eyebrows lean slop |
| Variety | 4 | Distinctive macrostructures (matrix/playbook/lanes) |

**Verdict:** genuinely good page. Nothing needs a redesign. Real failures are craft/a11y hardening, not aesthetics.

## Failures — ranked (fix these)
| # | Sev | Gate | Finding | Evidence |
|---|---|---|---|---|
| 1 | HIGH | 34 | `overflow-x: hidden` on `body` — hallmark hard-ban; masks real overflow bugs so mobile can't be verified | `landing.html:47` |
| 2 | HIGH | 8-state / focus | **No `:focus-visible` anywhere.** Every interactive (nav links, nav-cta, `.btn`, `.term-tab`, `.copybtn`, `.job` buttons) is invisible to keyboard focus | no `:focus` in `<style>` (16–320) |
| 3 | MED | contrast 40–41 | `--faint` `#5c6a5c` on `--ink` `#0a0c0b` ≈ 3.5:1 used on 12–13px text (`.term-out`, `.copybar .hint`, `.play-foot`) — below 4.5:1 for small text | `:151,156,292` |
| 4 | MED | a11y | Playbook tabs use `role=tab/tablist/tabpanel` but no `aria-selected`, no `aria-controls`, no arrow-key handling | `:431–432,642–653` |
| 5 | MED | 48 / token purity | Raw literals outside `:root`: `#ff7d5b` (×2), `#2c352b`, `rgba(255,255,255,…)` — should be tokens. Easings/durations un-named (`.16s`, `cubic-bezier(.2,.7,.2,1)` inline), no `--ease-*`/`--dur-*`. Hallmark also prefers OKLCH over hex | `:100,125,138,192,313` |
| 6 | LOW | 47 | Re-drawn chrome: three traffic-light `.dot`s + fake title bar on `.term` — classic AI tell. *Genre-excusable* for a CLI tool showing real commands, but the dots are optional | `:137–138,352–353,498` |
| 7 | LOW | motion / reduced | Hover `translateY` transforms still fire under `prefers-reduced-motion` (spatial motion not cut) | `:100,125,205,307` |
| 8 | LOW | restraint | Eyebrow tag on *every* section — hallmark defaults section eyebrows OFF; the repeated rule+uppercase rhythm is a mild slop tell | `:341,392,425,441,469,495` |
| 9 | LOW | states | No `:active` press state on buttons | `.btn`, `.nav-cta`, `.copybtn` |

## Passing — do NOT touch
- Distinctive fonts (Bricolage Grotesque + Instrument Sans + JetBrains Mono); **not** Inter/Roboto/Space Grotesk ✓
- No italic headers (gate 38a) ✓ — `.em` is `font-style:normal`
- Honest metrics (gate 46): stats 21 skills reconcile with catalog 8+12+1; 6 providers match matrix ✓
- Motion animates only `transform`/`opacity` (gate) ✓ + `prefers-reduced-motion` block exists ✓
- No hanging-header (gate 54): eyebrow-above-heading, not tag-left/heading-right ✓
- Responsive breakpoints at 900/860/820/720/640/520 ✓; matrix wrapped in `overflow-x:auto` ✓
- Table has `aria-label`; self-contained single file ✓

## Recommended fix batches
- **Batch A (HIGH, ~safe):** remove `body overflow-x:hidden` (verify no overflow at 320/375), add a global `:focus-visible` ring (coral, ≥3:1, no animation) on all interactives.
- **Batch B (MED):** lift `--faint` text contrast (nudge to ≈`#727f72`) or bump those to `--muted`; complete playbook tab ARIA (`aria-selected`/`aria-controls` + arrow keys); tokenize the raw hex + add `--ease-*`/`--dur-*`.
- **Batch C (LOW / optional):** drop or de-emphasize terminal dots; cut hover transforms under reduced-motion; thin out eyebrows; add `:active` press.

## Unresolved questions
1. Apply which batch(es)? (A only / A+B / all)
2. OKLCH migration — worth it, or keep hex tokens (soft-pass) to minimize churn on a working page?
