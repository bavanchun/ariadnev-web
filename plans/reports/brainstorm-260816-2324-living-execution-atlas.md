# Living Execution Atlas — whole-site UI/UX brainstorm

**Status:** recommended direction, awaiting product acceptance  
**Date:** 2026-08-16  
**Mode:** `ak:brainstorm --advice`; design and technology advice only, no product code changed

## Recommendation in one sentence

Keep the current execution-cartography identity and modern Astro + Next.js +
Fumadocs foundation, but rebuild the experience as a **Living Execution Atlas**:
the marketing site is the memorable overview of a real execution path, while
docs is the fast, exact field manual for operating it.

The redesign should be visually ambitious where narrative helps, and deliberately
quiet where users are scanning commands, options, tables, and versioned content.

## Brainstorm contract

### Outcome

- Raise the entire public website and documentation into one premium product
  system without making the two surfaces visually identical.
- Make the marketing site explain the product through an execution journey,
  with stronger composition, hierarchy, responsive art direction, and meaningful
  state motion.
- Make docs support fast orientation, lookup, task completion, and recovery on
  every page kind, locale, version, and viewport.

### Constraints

- Preserve the accepted execution-cartography language: ink, graphite, cool
  white, spectral blue for live execution, copper for human gates, and drafted
  geometry. Do not add accent families, decorative body gradients, glows, or
  meaningless looping motion.
- Preserve public URLs, verified claims, generated-content authority,
  locale/version contracts, static delivery, and existing performance and
  accessibility gates.
- Continue to support EN and VI with complete application-chrome localization.
- Treat real content scale as a design input: the CLI reference currently has
  132 TOC entries and 45 tables, not a lorem-ipsum demo.
- Keep this redesign dark-only. A light reading mode is a separate product and
  token-system decision, not an incidental addition.

### Non-goals

- No rebrand, new product positioning, invented metrics, testimonials, or
  backend feature work.
- No framework migration for prestige alone.
- No cinematic WebGL/Three.js layer, perpetual animation, or dependency-heavy
  interaction system without a proven product need.
- No hand-edits to generated MDX or generated token output.

### Acceptance criteria

- At 320, 375, and 390px, no content is clipped; locally scrollable tables and
  code remain fully reachable, visibly discoverable, and keyboard operable.
- All docs navigation is discoverable without a horizontal link strip. Current
  section and current heading remain recoverable on long pages.
- A known CLI command reaches its canonical command page in at most two
  purposeful interactions, including at 320px and without client JavaScript.
- VI routes localize navigation, search, switchers, status messages, pager, and
  accessibility announcements—not only article bodies.
- The marketing page uses at least four genuinely different macro-compositions,
  with a viewport-native vertical execution path on mobile.
- Keyboard journeys, reduced motion, contrast, static output, search, route
  generation, Lighthouse, build duration, and size budgets remain green.

## Evidence that shapes the decision

- The current stack is already contemporary: Astro 7.2 for the static site;
  Next.js 16.3, React 19.2, Fumadocs Core/UI 16.14.3 with Fumadocs MDX 15.2.3,
  Tailwind 4, Orama 3, and Zod 4 for docs.
- Both audited local production outputs achieved 100 Lighthouse accessibility,
  best-practice, and SEO scores in the sample. The weakness is not baseline
  framework capability or page speed.
- The docs app installs `fumadocs-ui` but currently renders a bespoke shell. It
  therefore pays custom interaction and maintenance cost without using many of
  the layout and content primitives already available in its chosen ecosystem.
- Mobile docs shows only 3 of 15 navigation links initially; provider content
  exceeds a 320px viewport and is masked by `overflow-x: hidden`.
- The marketing site is coherent and responsive, but repeated shell/eyebrow/
  heading/list composition prevents the execution-map identity from becoming
  memorable.

The four mandatory stress frames for every design review are:

1. CLI reference at 320px.
2. Provider reference at 320px.
3. Desktop CLI lookup and orientation.
4. A complete VI route, including all product chrome.

## Approaches considered

| Direction | What it changes | Main assumption | First failure condition | Worst plausible result |
|---|---|---|---|---|
| **A. Precision renovation** | Repairs mobile nav, tables, semantics, localization, sticky states, and type while retaining the current composition and monolithic CLI page | The present IA and visual rhythm are fundamentally sufficient | Content scale or requested visual ambition exceeds the current shell | A cleaner site that still feels incremental and a CLI reference that remains structurally exhausting |
| **B. Living Execution Atlas** — recommended | Rebuilds the docs shell and content patterns, adds command-level routes, and recomposes marketing around a living execution path while preserving brand and stack | Generated content can expose deterministic page-kind and command identity metadata | Route generation and search contracts are not proven before visual implementation | More routes and templates increase build/maintenance cost, but the work remains modular and reversible |
| **C. Immersive control plane** | Adds cinematic choreography, GSAP/WebGL/3D visual layers, and more app-like interaction across both products | Spectacle creates more value than speed, clarity, and maintainability | Low-end mobile, reduced motion, long reference reading, or static budgets are tested | A visually noisy, expensive surface that weakens trust and makes docs slower to operate |

Direction A does not satisfy the requested step-change. Direction C conflicts
with the product's evidence-first character. Direction B is the smallest option
that addresses both visible quality and structural docs usability.

## Chosen experience direction

### One brand, two registers

- **Marketing: expressive atlas.** It shows why the execution system matters and
  makes its topology memorable.
- **Docs: operational field manual.** It minimizes uncertainty and time-to-answer.
- They share semantic tokens, typography, geometry, control states, and the
  topology vocabulary. They do not share identical section templates or motion
  intensity.

### Marketing composition

1. **Split hero / live path.** Keep the verified promise and primary actions on
   one side; make a truthful execution path the dominant visual object on the
   other. Motion represents a finite state transition, never ambient activity.
2. **Path narrative.** Explain dispatch, gate, checkpoint, and path witness as a
   connected journey. On mobile this becomes a vertical route, not a squeezed
   horizontal SVG.
3. **Authority boundary.** Use a contrasting lane or ledger composition to show
   what the control plane owns, what a provider owns, and where a human decides.
4. **Evidence ledger.** Present provenance and verified capabilities as records,
   not generic feature cards.
5. **Terminal action.** End with one decisive installation or documentation
   path and compact, stable copy feedback.

Each section gets a different information structure. Decorative effects remain
subordinate to verified product facts.

### Documentation architecture

- Sticky top header with docs-home behavior, compact global actions, and
  complete locale/version semantics.
- Grouped, collapsible desktop sidebar; explicit mobile drawer; section-aware
  breadcrumbs; active and bounded TOC; previous/next navigation.
- Search as a command palette with suggested queries, result grouping, clear
  zero states, localized announcements, and correct active/focus semantics.
- Page-kind templates for landing/index, concept, guide, reference, and release
  note instead of forcing every page through title/description/body.
- First-class content primitives for code, command blocks, procedures, callouts
  and gates, option rows, responsive tables, compatibility matrices, execution
  graphs with text equivalents, and next actions.
- Tables use local scrolling or a content-specific narrow-screen transform. A
  page-level overflow mask is never considered a responsive solution.

## Screen-by-screen UI/UX blueprint

This section expands the direction into a concrete concept for every screen
family currently shipped, plus the proposed command-detail family. EN and VI,
`stable`, physical current, and previous-version routes share these screen
contracts; they are variants, not separate visual designs.

### Coverage map

| ID | Screen family | Current route examples | Primary job |
|---|---|---|---|
| M01 | Marketing home | `/` | Explain the product, establish trust, drive install or docs entry |
| M02 | Marketing not found | `/404` and unknown site paths | State the missing-path boundary and recover safely |
| D00 | Language chooser | docs `/` | Enter the correct locale without an automatic redirect |
| D01 | Current docs home | `/{locale}/stable/` | Orient a new or returning reader |
| D02 | Previous-edition home | `/{locale}/1.0.0/` | Explain historical scope and return readers to current docs |
| D03 | Installation | `get-started/installation/` | Install the binary correctly for the reader's platform |
| D04 | First install | `get-started/first-install/` | Install the kit into providers and verify the result |
| D05 | Kit and adapt engine | `concepts/kit-and-adapt-engine/` | Explain artifacts, projection, receipt, and cache |
| D06 | Graph execution | `concepts/graph-execution/` | Explain lifecycle, runtime contract, state, and privacy |
| D07 | Evaluation | `concepts/evaluation/` | Explain proof tiers and their boundaries |
| D08 | Upgrading | `guides/upgrading/` | Update safely, reinstall the kit, and confirm version |
| D09 | Configuration | `guides/configuration/` | Understand layered authority and inspect effective values |
| D10 | Doctor, audit, backups, uninstall | `guides/uninstall-and-doctor/` | Diagnose, recover, or remove an installation safely |
| D11 | Migration from vcskill | `guides/migration-from-vcskill/` | Complete a destructive, ordered one-time cleanup |
| D12 | CLI command index | `reference/cli/` | Find the right command quickly |
| D13 | CLI command detail — proposed | `reference/cli/<command-slug>/` | Operate one command without scanning the entire CLI |
| D14 | Provider reference | `reference/providers/` | Compare verified artifact destinations by provider |
| D15 | Skill catalog | `reference/skills/` | Discover one relevant skill among 105 entries |
| D16 | Workflow reference | `reference/workflows/` | Understand graph topology, authority, gates, and recovery |
| D17 | Release notes | `release-notes/` | See exactly what changed in an edition |
| D18 | Docs not found | unknown docs catalog path | Explain locale/version/page failure and recover contextually |

The generated command details multiply D13 across commands, locales, and
versions, but every instance uses one template contract.

### Shared visual system for every screen

#### Grid and density

- Marketing uses a twelve-column desktop grid, an eight-column tablet grid, and
  a single authored vertical flow below 640px. Large sections alternate between
  split, full-bleed-within-shell, ledger, and terminal compositions.
- Docs uses four conceptual zones: header, navigation rail, reading column, and
  local TOC. The reading column remains the visual authority; side rails become
  quieter as density rises.
- Prose stays near the current readable measure. Reference pages may use a wider
  workbench only for matrices and graph views, never for ordinary paragraphs.
- Spacing remains on the 4px token grid. Density changes through tokenized modes
  such as prose, compact reference, and mobile—not local arbitrary values.

#### Type hierarchy

- Be Vietnam Pro remains the display voice; Inter remains body/UI; JetBrains
  Mono remains code, command, path, node, and machine identity.
- Add a real medium/semibold role only if the font file and transfer budget pass.
  Until then, create hierarchy through size, color, spacing, and casing instead
  of falsely aliasing every emphasized label to bold.
- Page titles are concise and left aligned. Reference identities use mono only
  for the identity itself, not the entire heading or paragraph.
- Vietnamese line-height and heading wraps are reviewed independently; EN
  screenshots are not evidence that stacked Vietnamese diacritics fit.

#### Surface and color roles

- Ink is the page ground, graphite defines structure, and cool white defines
  readable hierarchy.
- Spectral blue marks a live path, selected/current location, successful copy,
  and verified witness only where the meaning is accurate.
- Copper marks a human gate, caution requiring a decision, or an unavailable
  action that needs intervention. It is not used as a decorative second CTA.
- Add semantic tokens for code surface, table header/row, current navigation,
  hover layer, pressed layer, disabled content, selection, warning/gate, and
  destructive boundary. These aliases continue to resolve through the existing
  palette rather than adding colors.

#### Interaction grammar

- Every interactive element defines default, hover, focus-visible, pressed,
  selected/current, disabled, loading, success, and error behavior where those
  states apply.
- Motion is finite and state-caused: drawer opens, active path advances, copy
  confirms, search results arrive. Nothing pulses or travels on a loop.
- Motion stays below 400ms, uses opacity/transform where possible, and has an
  equivalent immediate reduced-motion state.
- No essential content depends on hover, animation, pointer precision, or
  JavaScript. Native links remain the navigation substrate.

#### Responsive rules

- `320px` is a first-class composition, not a desktop layout scaled down.
- Header actions never force page overflow. Labels may shorten only when their
  accessible names and meaning remain complete.
- Tables scroll inside a named region with a visible edge cue and focusable
  container, or transform to a field/value list when row relationships permit.
- Code scrolls locally, keeps copy controls reachable, and never shrinks below a
  readable mono size.
- Sticky UI cannot consume enough height to trap content. Anchor targets include
  header offset, and focus is never obscured by sticky chrome.

### Shared marketing chrome

#### Header

- Keep the logo and product name as one home link. Preserve direct Docs and
  Install access at all widths; two actions do not justify a hamburger menu.
- Make the bar optically lighter than the hero: one bottom topology rule, clear
  focus states, and no floating glass panel.
- Add a restrained current-section treatment only while scrolling the home
  narrative. It must not turn the header into a six-item nav on mobile.
- Install remains the primary action. Pressed state moves the drafted border or
  inset rule rather than scaling the button.

#### Footer

- Preserve the local-first/no-hosted-control-plane statement as the closing
  trust boundary.
- Organize links into Product and Documentation only if more links are added;
  with the current two links, retain a single concise row.
- Include no newsletter, social proof, fake status light, or oversized sitemap.

### M01 — marketing home

#### First viewport: promise plus execution path

- Replace the copy-only hero with a 5/7 split desktop composition. Left: eyebrow,
  H1, three proof-oriented promise lines, Install and Docs actions, one Unix
  command, and real release pin. Right: a compact execution topology that shows
  compile → policy → execute → checkpoint → proof.
- The path initially shows a complete static diagram. When motion is allowed, a
  single finite walkthrough may progress as the hero enters view, then stop at
  proof. It must not imply a real run is occurring.
- Label topology semantics directly. Spectral marks the demonstrated path;
  copper appears only at policy/human gate when the content names that gate.
- On mobile, stack copy then a vertical five-state path. Keep the install command
  in the first 1.5 viewports and avoid horizontal diagram scrolling.
- Release date uses semantic `<time>` and locale-aware formatting. If no build
  pin exists, the row remains absent rather than showing a placeholder.

#### Execution path section

- Turn the current duplicated horizontal figure plus cards into a synchronized
  path narrative. Desktop: a sticky compact topology on the left and five state
  chapters on the right. Mobile: one vertical ordered timeline.
- Each chapter shows three fields: state meaning, produced evidence, and what is
  deliberately not claimed. This preserves the current honest-source pattern.
- Jump links become a compact step index with visible current state and correct
  anchor offset. With JavaScript disabled they remain ordinary anchors.
- Keep the ordered textual representation as the source of meaning; SVG remains
  decorative or carries an equivalent accessible summary, never unique facts.

#### Canonical workflows section

- Replace three visually identical cards with a lane comparison. Each workflow
  has an execution lane and three aligned rows: authority, human gate, recovery.
- Readers can compare the same facet horizontally on wide screens. On mobile,
  each workflow becomes a self-contained vertical lane with the same field order.
- Copper gate markers always include the words “human gate” or localized
  equivalent. Availability is presented as a status sentence, not a badge whose
  color must be decoded.
- Link the section to workflow reference without duplicating generated node and
  edge data.

#### Provider projection section

- Present the six provider identities on one drafted projection plane. Selecting
  or focusing a provider reveals only the verified principle and representative
  target already approved for marketing; the exhaustive matrix remains in docs.
- Provide a static six-row fallback and never invent logo colors or provider
  parity. The visual distinction comes from path geometry and labels.
- Add a direct “Compare verified destinations” link to provider reference.
- On mobile use a vertical list with explicit selected/focus state; no carousel.

#### Evidence ledger section

- Keep the ledger metaphor and make it the densest marketing section. Add a
  fixed column rhythm for evidence kind, claim, source, and limit.
- Desktop may use column headers; mobile turns each row into a compact record
  with visible labels. Source remains an ordinary link and limit remains
  adjacent to the claim.
- Allow kind filtering only if the real ledger grows enough to need it. Current
  scale does not justify client-side filters.
- Differentiate measured, contract, and boundary through label, icon/shape, and
  color—not color alone.

#### Final install and footer transition

- Frame the ending as a terminal checkpoint: platform commands, one primary
  first-run action, release notes, and a read-before-running script link.
- Use a two-column command layout on wide screens and vertical commands on
  mobile. Copy feedback replaces or reserves space beside the button so no row
  jumps after activation.
- Clipboard denied state exposes selectable source text and manual-copy guidance.
- Do not repeat the full hero promise; the ending answers only “what next?”.

#### Home acceptance evidence

- Five major regions have different information architectures, not merely
  different backgrounds.
- Install and docs remain reachable in one interaction from the first viewport.
- The complete page works with JavaScript disabled and reduced motion.
- At 320px the execution path is vertical, commands remain readable, and no
  whole-page horizontal overflow is hidden.

### M02 — marketing not found

- Treat the missing path as a broken topology endpoint: “404 / path not
  published,” followed by a concise explanation of the honest 404 contract.
- Primary recovery is Home; Documentation and Release notes remain secondary.
- Keep the install command only if it helps the likely missing installer/release
  journey. Visually separate it under “Looking for the installer?” so it does
  not compete with recovery.
- Do not animate a fake broken graph. A single interrupted graphite edge is
  sufficient visual identity.
- Preserve `noindex`, true 404 status, keyboard order, and direct links.

### Shared documentation shell

#### Desktop frame

- Header spans the viewport. Below it: grouped sidebar, reading column, and
  local TOC. Sidebar and TOC stay sticky within viewport-safe bounds and scroll
  independently only when their own content exceeds available height.
- The reading column owns the strongest contrast. Rails use smaller type and
  quieter surfaces so three columns do not compete.
- Docs brand links to the active locale/version root. A separate minimal link
  can return to the marketing site.

#### Mobile frame

- First row contains brand, Search, and one Navigation trigger. Locale/version
  move into the drawer or a compact second row only when measured to fit.
- The drawer shows current page context, grouped navigation, locale, and version
  in one deliberate sequence. Focus is trapped while open, Escape closes it,
  close returns focus, background does not scroll, and links work without client
  route interception.
- “On this page” renders only when TOC entries exist. Long TOCs are bounded and
  initially reveal the current section plus nearby headings rather than 132
  undifferentiated entries.

#### Sidebar information architecture

- Groups: Start, Concepts, Guides, Reference, and Release. Current group is
  expanded; other groups may collapse but their labels and item counts remain
  discoverable.
- Current page uses `aria-current="page"`, a spectral edge marker, and stronger
  text. Hover and keyboard focus remain distinct from current state.
- Generated CLI command detail pages do not enter the global sidebar. They are
  discovered through CLI index, search, parent breadcrumb, and command siblings.
- Previous edition shows only the pages actually published. Missing groups are
  not disabled placeholders.

#### Breadcrumb and page header

- Breadcrumb hierarchy is Docs → section → page; locale/version are controls,
  not breadcrumb levels.
- Every page header provides page-kind label, title, purpose sentence, and only
  the metadata useful for that kind—for example version scope on references.
- Copy/share actions become one compact action group. Primary action is “Copy
  page”; permalink and Markdown source live in a disclosure when space is tight.

#### Local TOC and heading links

- Desktop TOC tracks the active heading and shows no empty panel. Current item
  uses both position marker and `aria-current="location"`.
- Heading permalinks are authored in the render tree where possible, appear on
  hover/focus-within on pointer devices, and remain keyboard reachable.
- Replace visible repeated `#` characters with one consistent link icon and
  localized tooltip/accessible label.

#### Search command palette

- Closed trigger displays Search plus `⌘K`/`Ctrl K` on desktop; mobile uses a
  search icon and text, not a keyboard hint.
- Empty state provides localized suggested tasks: install, configure, doctor,
  provider, and a command example. It does not fabricate search history.
- Results group by Guides, Concepts, Commands, Skills, Providers, and Workflows.
  Every item shows type, title, short context, and route version.
- Loading uses a stable skeleton or text status; zero state repeats the query and
  offers sidebar browsing; unavailable state keeps the static navigation escape.
- Arrow navigation controls focus, not `aria-current`. Enter follows the focused
  result, Escape closes, and focus returns to the trigger.
- Exact command queries produce one canonical command result in the selected
  locale/version partition.

#### Locale and version controls

- Prefer native disclosure semantics with ordinary links unless a complete menu
  pattern is implemented. Visible label and accessible name contain matching
  text.
- Explicit route always wins. Switching locale stays on the sibling page when
  available; otherwise show the locale root as an explicit alternative rather
  than a dead pseudo-menu item.
- Version switch stays on the sibling page only when that edition publishes it.
  Otherwise explain availability and link to that edition's root.
- Current, stable alias, previous stable, unavailable, and status text are fully
  localized.

#### Page ending

- Add page-kind-aware previous/next navigation with section labels.
- Guides end with the operational next action; concepts point to a related guide
  and reference; references return to their index or adjacent entity.
- Copy feedback, unavailable source, and manual fallback remain local to the
  action that caused them.

### D00 — documentation language chooser

- Keep an explicit choice; do not infer or persist locale in this scope.
- Use a compact atlas-entry composition: logo, “Documentation,” one sentence,
  and two equal language cards containing native language name plus locale code.
- Both choices link to `/{locale}/stable/`. Neither is visually preselected.
- Add a clear “Back to ariadnev.com” link and retain a single H1.
- At narrow widths cards stack; focus and hover use the shared selected-surface
  vocabulary without implying a saved preference.

### D01 — current documentation home

- Replace prose-link groups with a task-oriented dashboard inside the docs
  reading column.
- Top “Start a path” block contains three ordered actions: install binary,
  install kit, verify with doctor. Each shows expected outcome, not only a title.
- “Understand the system” uses a compact five-state execution map linking to
  Graph execution, plus Kit/adapt and Evaluation entries.
- “Look something up” provides four reference launchers with generated counts
  when those counts are exposed by machine-owned release data or future catalog
  metadata: commands, providers, skills, workflows. Do not hardcode counts in
  authored MDX.
- Migration appears as a clearly bounded path for existing vcskill users, not a
  generic primary card.
- Returning-reader affordance is Search and current release notes; no fabricated
  recent-history personalization.

### D02 — previous-edition home

- Place a persistent edition notice immediately below the header: “You are
  reading 1.0.0; current stable is 1.1.0,” with one switch action.
- Explain the previous product naming once and preserve historical command names
  in content. Never silently rewrite `vcskill` to `ariadnev`.
- Show only two available destinations—CLI and Providers—as explicit reference
  cards. Do not render empty Start/Concept/Guide groups.
- Include what is unavailable and why in a calm note, then point to stable docs.
- The notice remains visible on all previous-edition pages, not just this root.

### D03 — installation

- Page header includes purpose, supported platforms, and “No Node runtime
  required” as verified supporting metadata.
- Start with OS tabs or segmented links only if every command remains present in
  initial HTML. Default can follow the reader's platform as presentation, but
  never hide another platform from no-JS users.
- Each platform command block contains label, command, Copy, checksum-verification
  note, destination, and a “read script first” link.
- Convert “What the installer does” into a four-step integrity flow: resolve,
  download, verify, link alias. Spectral witnesses mark verified outputs; no
  success check appears before the user runs anything.
- Gatekeeper is a platform-specific caution callout, not an alarming global
  warning. Optional Claude hooks are a separate dependency note.
- End with a verification command block and primary next action to First install.

### D04 — first install

- Open with a three-step progress rail: choose providers → choose scope → verify
  receipt. This is instructional structure, not persisted user state.
- Interactive and non-interactive modes use a tabbed/code-switcher presentation
  with both modes server-rendered and linkable.
- Scope becomes a project/global comparison with destination and receipt path;
  no card is labeled universally “recommended” without product evidence.
- “What lands where” shows a small provider example and links to the authoritative
  full matrix. Keep the skip-not-guess principle prominent.
- “Check it” presents `list` and `doctor` with expected exit meaning. “Then in
  your agent” becomes a next-path chooser for brainstorm, scout, and fix rather
  than a dense inline command paragraph.

### D05 — kit and adapt engine

- Use a four-stage system diagram: canonical kit → adapt engine → provider
  projection → receipt/cache. Each stage links to its detailed section.
- Kit artifacts appear as an inventory list with role, not decorative cards.
- The Claude artifact table uses a responsive field/value matrix and an explicit
  “example, not full contract” label.
- The adapt section visually contrasts verified path with skipped path. A skip is
  graphite plus text; it is not a red error.
- Receipt and cache use file-tree illustrations with textual equivalents. Show
  which commands consume the receipt and clearly distinguish distribution cache
  from an authoring workspace.

### D06 — graph execution

- This is the flagship concept screen. Lead with a real topology diagram for
  GraphIRV1 → compiler/lint → policy → runner → provider, plus an ordered text
  equivalent.
- Lifecycle commands become an operable sequence: validate, probe, start,
  inspect, resume/cancel. Each step shows command, expected state, and whether a
  provider is contacted.
- The five-state vocabulary uses the same visual topology as marketing but with
  deeper contract detail. Marketing introduces it; docs defines it.
- “What runs today” is a prominent capability boundary: read-only active,
  safe-change validates but remains policy-denied. Do not style denied work as a
  completed feature.
- Runtime contract table remains a locally scrollable comparison with pinned
  versions/models and isolation visible. Durable-state files transform into a
  file/purpose/content-boundary matrix with a compact mobile record view.
- Privacy boundary closes the page with what is never forwarded and where state
  lives, then links to relevant CLI commands.

### D07 — evaluation

- Represent Tier 1, Tier 2, and Tier 3 as a proof ladder. Height does not imply
  certainty: every tier carries “proves” and “does not prove” fields.
- Static contracts sit above the ladder as the release floor. Runtime probes sit
  beside it because they are environment-specific, not a fourth universal tier.
- The suite command gets a purpose-built multiline command block with arguments
  annotated below rather than inline visual noise.
- Close with a high-contrast proof-boundary ledger listing unsupported claims.
  Avoid score gauges, green check walls, or benchmark theater.

### D08 — upgrading

- Use a compact operational recipe: check → update → reinstall kit → doctor.
- Separate `update` and offline-safe `update --check` with clear result
  expectations and one copy action per command group.
- Add a checkpoint callout before update containing current version, release-note
  link, and rollback/pinned-version reference only when those facts come from
  machine-owned release data.
- End with version selector context: docs edition follows release edition; do not
  imply the selector changes the installed binary.

### D09 — configuration

- Lead with a two-layer authority diagram: user config can set all permitted
  values; project config can set only workspace-shaped keys. Visually show
  rejected user-only keys crossing the project boundary.
- Present config paths in a copyable file-location block.
- “See what took effect” becomes the primary task with command, sample field
  anatomy, source provenance, rejected-key notice, and redaction behavior.
- Editor completion, Telemetry, and Security are three secondary sections.
  Telemetry must say off by default and no endpoint ships without using a generic
  green privacy badge.
- Notification-host constraints use a short allowlist component optimized for
  copy and scanning.

### D10 — doctor, audit, backups, and uninstall

- Open with a decision table: symptom or intent → command → destructive level →
  exit meaning. This lets users choose before reading all sections.
- Give each command family a consistent operation block: purpose, command,
  reads, writes, preserves, and exit codes.
- Doctor and audit are diagnostic; backups restore and uninstall mutate. Use
  copper decision gates before mutating examples, with explicit dry-run paths.
- Backups gets a timeline model—current state, safety backup, selected restore—
  with a text equivalent.
- Uninstall emphasizes receipt ownership and edited-file preservation. The page
  must never make a destructive command look like an ordinary primary CTA.
- Exit codes become a compact reusable status matrix, with documented legacy
  exceptions adjacent rather than in a footnote.

### D11 — migration from vcskill

- Treat this as an ordered migration checklist with four irreversible boundaries:
  old artifact removal, old state/cache removal, old binary removal, reinstall.
- Each step shows prerequisite, command, expected evidence, and stop condition.
  The reader cannot visually skip from step 1 to reinstall without seeing the
  backup/state warning.
- `rm -rf` commands receive a destructive-command treatment: target explanation,
  copy control separated from execute guidance, and no one-click execution.
- “What is not carried over” is a preservation checklist before deletion,
  especially old backups and config.
- Pinned-download behavior and “If you skip this” close the page as compatibility
  boundaries, not fear-driven warnings.

### D12 — CLI command index

- Replace the monolithic 132-item TOC and 45 option tables with a server-rendered
  command directory.
- Header contains CLI version, command count from generated data, search/filter
  input, and links to global flags/conventions.
- Group commands by functional namespace or top-level path derived from source,
  not arbitrary visual categories. Each row shows command path, one-line
  description, aliases if any, and a canonical detail link.
- Exact filter works client-side as enhancement; all command links and groups
  are present and navigable without JavaScript. Query parameters may provide a
  shareable filtered view only if static hosting behavior is proven.
- Legacy anchors remain on corresponding index rows. Following an old fragment
  lands on a visible summary with a detail link.
- Mobile rows stack identity and description; the filter becomes sticky only if
  it does not obscure results or focused anchors.
- No option tables remain duplicated on the index. Search index contains one
  canonical result per command per locale/version partition.

### D13 — CLI command detail

- Breadcrumb is CLI reference → command path. Page header shows full command,
  description, aliases, edition, and one copyable invocation skeleton.
- Use a stable section order: synopsis, arguments, options, examples if source
  provides them, exit behavior if source provides it, related commands, and
  source/version metadata. Missing source fields are omitted, never invented.
- Arguments and options render as semantic definition rows on mobile and a
  compact table on wide screens. Each flag exposes value shape, requirement,
  repeatability/default only when machine data supplies it.
- Copy action targets the command or example, not an entire option table.
- Previous/next traverses the generated command order for that edition. Related
  commands use source namespace/aliases, not guessed similarity.
- Retired or renamed canonical URL resolves through the approved retired-route
  policy and explains the replacement; it must not silently redirect to an
  unrelated command.

### D14 — provider reference

- Start with a six-provider selector and a compact comparison matrix showing
  artifact availability. The full data remains in initial HTML.
- Wide screens can compare providers by columns only where labels remain legible.
  At narrow widths switch to provider-first records: artifact, verified path,
  status. Do not squeeze a six-column matrix into 320px.
- Verified path uses spectral witness plus text; unsupported or unverified uses
  “not verified / skipped,” not a red failure icon.
- Selecting a provider updates the visible detail and URL fragment while keeping
  every provider reachable by links and keyboard.
- Include direct install-path command and First install link where source-backed.

### D15 — skill catalog

- A catalog of 105 skills requires discovery controls. Header shows generated
  count, category count, and a filter with example queries.
- Category navigation is a compact index with counts. Results use dense rows,
  not 105 large cards: skill name, description, category, invocation status,
  argument hint, and detail/repository source only when published.
- Filters support name, keyword, category, and user-invocable state. The static
  grouped list remains available without JavaScript.
- Category-less entries receive an explicit localized “Uncategorized” label;
  `null` never leaks into the interface.
- Matching text is highlighted without reducing contrast or changing accessible
  names. Zero state offers clear-filter and related-category actions.
- If future individual skill pages are proposed, they require the same immutable
  identity and route-budget gate as commands; they are not included now.

### D16 — workflow reference

- Replace repeated node/edge tables as the primary view with one actual topology
  per workflow. The current three graphs contain 7–11 nodes and 12–21 edges, so
  a designed static SVG is feasible without a canvas dependency.
- Each graph labels start/end, effects, human gates, recovery paths, and path
  direction using shape plus text plus semantic color.
- Provide synchronized tabs or anchors for Diagram, Nodes, and Edges. All three
  representations remain in server-rendered HTML; controls progressively
  enhance visibility.
- Mobile uses a vertical/topological simplification and locally scrollable full
  diagram, plus the authoritative node/edge tables. The simplified drawing must
  not alter graph meaning.
- Add a legend once per page and a textual ordered/adjacency equivalent for
  assistive and print contexts.

### D17 — release notes

- Header states edition and source authority. A version timeline or selector
  links published releases without duplicating the global version control.
- Each release uses date/version heading, change-type label, concise summary,
  and structured change entries. Commit/source IDs remain secondary metadata.
- Long entries can expose a summary first but remain present in initial HTML;
  no client-only accordion hides release facts.
- Highlight migration, breaking, security, and new capability only when the
  source declares those classifications. Do not infer them from prose styling.
- Provide contextual next links to Upgrading and versioned docs home.

### D18 — documentation not found

- Differentiate three recoverable causes where route data permits: unsupported
  locale, unavailable version, or missing page. Do not claim a cause that cannot
  be derived safely.
- Primary recovery follows known context: same locale stable root when locale is
  valid; otherwise explicit EN and VI choices. Search is offered only against a
  real partition.
- Preserve a real 404 response, `noindex`, one H1, and localized recovery copy
  when locale can be determined.
- Visual language uses a broken graphite route and one clear recovery path, not
  a playful empty-state illustration that trivializes a broken docs link.

### Cross-screen states and overlays

#### Navigation drawer

- States: closed, opening, open, closing, current-group expanded, nested item
  focused, and no-JS fallback. Opening/closing animation is optional; focus and
  scroll behavior are mandatory.

#### Search

- States: unopened, empty/suggestions, loading index, results, keyboard-focused
  result, zero result, partition mismatch/unavailable, and closing with focus
  restoration.

#### Copy

- States: ready, copied, unavailable/manual selection, source-fetch failure, and
  reset. Status stays local and is announced politely without layout shift.

#### Locale/version availability

- States: current, sibling available, sibling unavailable, previous edition,
  stable alias, physical current route, and retired/missing command route.

#### Content primitives

- Callout types are Note, Gate, Boundary, Destructive, and Evidence. Each has a
  semantic label and icon/shape; color is supporting information.
- Code supports language label, copy, wrap/scroll policy, command/output
  distinction, and no-JS readability.
- Tables support caption, header association, local overflow affordance, keyboard
  reachability, and a page-specific mobile transformation when semantics allow.
- Procedures expose ordered progress in the document, not fake persisted
  completion checkboxes.

### Screen-level validation matrix

| Screen set | Required desktop proof | Required mobile proof | Required interaction/a11y proof |
|---|---|---|---|
| M01–M02 | Distinct compositions, truthful topology, stable command feedback | Vertical path, readable commands, no clipped ledger | No-JS paths, reduced motion, focus order, real 404 |
| D00–D02 | Correct locale/version entry and historical notice | Stacked choices, compact edition notice | Explicit URLs, no forced redirect, localized labels |
| D03–D11 | Page-specific task structure and next action | Commands/tables remain reachable at 320px | Heading links, copy fallback, warnings not color-only |
| D12–D13 | Named command found within two purposeful interactions | Filter and rows usable at 320px without clipping | No-JS discovery, unique search result, legacy/retired route behavior |
| D14–D16 | Dense references support compare and inspect modes | Provider-first records, dense skill rows, vertical graph | Keyboard filters/tabs, semantic tables, graph text equivalent |
| D17–D18 | Version authority and contextual recovery | Readable change entries and recovery actions | Initial HTML contains facts, real 404, localized recovery |

Visual regression fixtures must include M01, M02, D00, D01, D02, D03, D06,
D11, D12, one D13 command, D14, D15, D16, D17, and D18 at 320, 375, 768,
1280, and 1440 where the layout materially changes. The four audit stress frames
remain mandatory regardless of screenshot sampling.

## CLI reference contract

Keep `/reference/cli/` as a compact, searchable command index and generate a
canonical detail page at `/reference/cli/<command-slug>/` for every command from
the same machine-owned source.

The index should summarize rather than duplicate every option table. Existing
legacy anchors remain visible index targets and link to the canonical detail
page; do not rely on JavaScript redirects. Command detail pages stay out of the
global sidebar to avoid multiplying navigation noise.

Before any shell redesign, prove a deterministic command record containing:

- source identity;
- immutable machine-owned `commandId`; if the upstream source cannot supply one,
  use a committed slug registry plus retired-path mapping;
- collision-checked slug derived from that identity contract;
- legacy anchor;
- locale/version availability;
- previous/next command siblings where they truly exist;
- page kind and navigation visibility.

Phase-zero contract tests must verify:

- slug, page ID, and legacy-anchor uniqueness;
- correct locale/version route expansion;
- one canonical search result per command;
- summary-only index output and usable old fragment targets;
- no guessed sibling for an unavailable historical command;
- retired canonical URLs remain useful after a command rename or removal;
- bounded route, search-index, static-discovery, `llms.txt`, build-time, and
  output-size growth.

The current snapshot contains 53 current and 53 historical commands with the
same paths. With the existing two locales and current-version stable alias,
current-only detail pages project to **+212 HTML routes**. Current plus previous
details project to **+318 HTML routes** and the corresponding **+318 Markdown
discovery outputs**. These are planning baselines, not budget approval: phase
zero must measure actual build time, bytes, search-index growth, and output
cardinality. Generate historical detail pages whenever the historical source
contains the command. Command aliases remain searchable metadata and legacy
anchors, not additional canonical routes.

## Technology recommendation

### Keep

- **Astro static output for marketing.** It is an excellent match for a mostly
  authored, performance-sensitive site. Native CSS, SVG, and small isolated
  scripts can deliver the proposed visual system.
- **Next.js + React + Fumadocs for documentation.** Versioned, localized,
  generated MDX and search are already represented in the architecture. A
  migration would recreate solved routing/content problems.
- **Static Orama search.** It fits current scale and no-server delivery; measure
  index growth after command pages are introduced.
- **DTCG/OKLCH shared tokens.** Expand semantic roles and typography rather than
  replacing the token pipeline.
- **Playwright, Lighthouse, and existing contract tests.** Add visual and
  interaction coverage to them rather than introducing a parallel test stack.

### Use more effectively

- Evaluate Fumadocs UI as a **behavior and accessibility substrate, not a visual
  template**. Run a measured spike comparing `DocsLayout` with smaller
  primitive-level adoption. Choose only the option that passes localization,
  theming, keyboard behavior, static export, and bundle gates; full `DocsLayout`
  adoption is not predetermined.
- Reuse Fumadocs content primitives for code blocks, callouts, steps, tabs, and
  TOC where their semantics fit. Keep generated-data-specific primitives local.
- Treat already-installed Radix/Motion transitive capabilities as implementation
  evidence only. If application code directly imports one, declare it directly
  in the owning package instead of relying on a transitive dependency.

Official capability references:

- [Fumadocs DocsLayout](https://www.fumadocs.dev/docs/ui/layouts/docs)
- [Fumadocs UI components](https://www.fumadocs.dev/docs/ui/components)
- [Fumadocs code blocks](https://www.fumadocs.dev/docs/ui/components/codeblock)
- [Static Orama search](https://www.fumadocs.dev/docs/headless/search/orama)
- [Fumadocs search UI](https://www.fumadocs.dev/docs/ui/search)

### Add only when a measured gap proves the need

- Investigate whether aligning Fumadocs MDX with Core/UI is officially supported
  and low-risk. Align only if generated content, typecheck, static export,
  search, and size budgets pass; otherwise keep and document the proven pin.
- Add `@axe-core/playwright` as a direct development dependency if automated
  accessibility assertions become part of CI. Do not import a transitive copy.
- Prefer CSS transitions, SVG, and the Web Animations API for finite marketing
  transitions. Add a direct animation library only if an approved storyboard
  cannot be implemented maintainably within those tools.
- Consider a variable or additional medium type weight only after testing its
  actual Vietnamese rendering and font budget.

### Do not upgrade for its own sake

Do not migrate to another web framework, docs generator, headless CMS, GSAP,
Three.js, or WebGL merely to make the implementation sound more advanced. The
premium result will come from information architecture, content models,
responsive art direction, interaction semantics, and rigorous validation—not
from a more fashionable dependency list.

## Delivery sequence for the next plan

1. **Contract gate:** command route fixture, page-kind/catalog metadata, route
   cardinality, immutable identity and retired-route policy, search behavior,
   and build-output baselines.
2. **Design-system expansion:** interactive states, docs/code/table surfaces,
   shell dimensions, type roles, dark metadata, and shared state vocabulary.
3. **Docs safety and shell:** fix clipping and semantics first; then navigation,
   search, active TOC, localization, and page templates.
4. **Generated reference experience:** command index/detail routes, provider
   tables, workflow maps, legacy-anchor compatibility, and search deduplication.
5. **Marketing recomposition:** split hero, vertical/mobile path narrative,
   authority boundary, evidence ledger, terminal action, and semantic motion.
6. **Full verification:** stress-frame screenshots, keyboard and no-JS journeys,
   accessibility, route/search contracts, Lighthouse, build duration, and size
   budgets.

## Advisory conclusion

Kongming's decision checkpoints returned **GO with concerns** for presenting and
planning Direction B, and **NO-GO for implementation** until phase zero passes.
The binding concerns are immutable CLI identity, retired-route behavior,
content-scale proof, and bundle headroom—not the visual ambition itself. The
audited docs sample transferred 297,860 bytes against the current 300,000-byte
cap, so the Fumadocs UI spike must be measured and the budget must not be raised
merely to accommodate a heavier shell.

## Decisions requiring product acceptance

1. Accept **Living Execution Atlas** as the target direction.
2. Accept dark-only for this redesign; treat light mode as separate future scope.
3. Accept additive command-level CLI pages while preserving the aggregate index
   and its legacy anchors.
4. Keep locale selection URL-explicit; do not add remembered automatic redirects
   in this redesign.
5. Accept the M01–M02 and D00–D18 screen contracts as the design input for the
   implementation plan; visual mockups may refine composition but must not
   silently remove their responsive, no-JS, localization, or accessibility
   requirements.
