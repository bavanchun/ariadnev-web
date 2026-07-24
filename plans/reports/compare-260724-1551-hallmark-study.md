# Feature Comparison: hallmark (design skill)

**Mode:** `--compare` (study only, no implementation plan)
**Date:** 2026-07-24

## Source Manifest
- Repo: `nutlope/hallmark` — branch `main` (no pinned SHA; study only)
- License: MIT — installable via `npx skills add`, no fork needed
- What it is: an **AI-agent design skill** (Claude Code / Cursor / Codex), NOT a runnable app
- Deps/keys: none (pure rule-set + reference `.md` tree; no external services)

## Source Anatomy
A skill that makes AI-generated web UI *stop looking AI-generated*. Machinery:
- **4 verbs:** default (build) · `audit <target>` (score, punch-list, no edits) · `redesign <target>` (visual overhaul, preserves routes/copy) · `study <url|screenshot>` (extract design DNA)
- **20 catalog themes** + custom OKLCH route; 3-axis diversification (paper band / display style / accent hue)
- **21 macrostructures**, 50+ nav/footer/section component archetypes
- **58-gate "slop test"** run pre-handoff (no italic headers, no fake browser chrome, no invented metrics, no `overflow-x:hidden`, mobile 320/375/414/768, 8 interaction states, animate only transform/opacity, etc.)
- **Pre-emit self-critique** (score Philosophy/Hierarchy/Execution/Specificity/Restraint/Variety 1–5; <3 → revise)
- **Project memory:** `.hallmark/log.json` tracks last builds to force variety
- **Architecture:** lazy "index-then-pick" reference loading (~40 md files, never all loaded); output stamped in CSS comment; opt-in `design.md` token export (tokens.css / Tailwind v4 / DTCG / shadcn)

## Overlap / Dependency Matrix
| Capability | hallmark | Your kit today | Verdict |
|---|---|---|---|
| Anti-AI-slop frontend build | core | `ak-frontend-design`, `frontend-design` (same claim) | **CONFLICT / duplicate** |
| UI/UX systems, tokens, a11y | via slop-test | `ak-ui-ux-pro-max`, `ak-web-design-guidelines`, `ak-ui-styling` | EXISTS |
| Brand/visual identity | custom-theme route | `ak-design` | EXISTS |
| **Design audit as a scored punch-list** | `audit` verb | none equivalent (yours are build-first) | **NEW — differentiator** |
| **Extract DNA from a live URL/screenshot** | `study` verb | none | **NEW — differentiator** |
| Build-to-build variety memory (`log.json`) | yes | none | NEW (niche) |
| Single-file self-contained output | no (emits tokens.css, `.hallmark/`, multi-file) | your `landing.html` is deliberately 1-file inline | **CONFLICT** |

## Decision Matrix
| Decision | hallmark's way | Your way | Recommendation |
|---|---|---|---|
| Adopt as a skill in vcskill kit | full 40-file kit | you already ship `ak-frontend-design` | **Don't fork** — you'd duplicate + own maintenance |
| Output shape | tokens.css + `.hallmark/log.json` + multi-file | 1-file inline `landing.html` (710 lines) | Keep yours; hallmark's token discipline fights it |
| Immediate use on this repo | `audit` / `study` verbs | — | **Use the ideas one-shot**, don't install machinery |
| Borrow the checklist | 58-gate slop-test.md | ad hoc | **Steal the gate list** as a review checklist |

## Challenge (hard gate — 5)
1. **Does it overlap what you own?** Source: net-new skill. You: `ak-frontend-design` + `frontend-design` already claim "avoid AI aesthetics." **Risk if ignored:** install duplicate capability, two skills fight over the same trigger.
2. **Is the machinery proportional to a 710-line single page?** Source: 20 themes / 21 macros / log.json memory assume repeated multi-page builds. You: one static landing page. **Risk:** ceremony ≫ payoff for one file.
3. **Output model clash.** Source: emits `tokens.css` + `.hallmark/` sidecar + multi-file. You: README mandates *fully self-contained inline* `landing.html`. **Risk:** adopting its build flow breaks your single-file constraint and edge-cache model.
4. **Where's the real value then?** The two verbs you *don't* have — `audit` (scored slop punch-list) and `study` (DNA extraction from a URL) — are one-shot, zero-install wins. **Risk if ignored:** you copy the wrong 90% and skip the 10% that helps.
5. **Fork vs use.** MIT + `npx skills add` means zero reason to transplant code. **Risk of porting:** maintenance burden on a fast-moving upstream (v1.1.0) for capability you can just install if you ever want it.

## Recommendation
- **Do NOT port/fork** into vcskill. It duplicates `ak-frontend-design`/`frontend-design` and its multi-file token output conflicts with your single-file `landing.html` contract.
- **Highest-value, lowest-effort:** borrow two ideas as one-shot actions, not installed machinery:
  1. Run a **hallmark-style audit** on `landing.html` — score it against the slop gates (italic headers, fake chrome, invented metrics, 8 interaction states, mobile 320–768, transform/opacity-only motion, focus-visible contrast). Produces a concrete punch-list.
  2. If you want a redesign, use your existing `ak-frontend-design` and feed it hallmark's **58-gate checklist** as acceptance criteria.
- **If you build skills:** the *architectural* lessons worth stealing for your own kit are (a) index-then-pick lazy reference loading, (b) pre-emit self-critique scoring, (c) project-memory JSON for cross-run variety. These are patterns, not code to copy.

## Risk Score
- Port/adopt-as-skill: **HIGH** (duplication + output-model conflict + upstream churn)
- One-shot audit of landing.html using hallmark ideas: **LOW**

## Unresolved Questions
1. Goal: apply hallmark's *design approach to `landing.html`*, adopt it as a *skill in your kit*, or just *understand it*? (Changes next step.)
2. If redesign is wanted: keep the strict single-file inline constraint, or relax it?
