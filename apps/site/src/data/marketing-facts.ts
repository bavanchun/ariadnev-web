// Authored marketing facts.
//
// Every claim on the marketing surface originates here, and every claim carries
// a reproducible source. Three rules keep this file honest:
//
//   1. No mutable inventory counts. "26 skills" is true until the next release;
//      a static page that states it becomes wrong silently. Counts belong in
//      generated documentation, which the page links to instead.
//   2. No testimonial, customer, rating, benchmark outcome, or usage total.
//      None of those exist as verifiable facts for this project.
//   3. Release identity is never authored. It is read at build time from the
//      optional machine-generated pin (see `loadReleasePin`) or omitted.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const siteRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const repoRoot = join(siteRoot, "..", "..");

/** A claim that can be checked against a source a reader can open. */
export interface SourcedClaim {
  readonly claim: string;
  /** URL or repository-relative path a reader can verify the claim against. */
  readonly source: string;
  readonly sourceLabel: string;
  /** What the claim deliberately does not prove. */
  readonly caveat?: string;
}

// ------------------------------------------------------------------ identity

export const SITE = {
  origin: "https://ariadnev.com",
  docsOrigin: "https://docs.ariadnev.com",
  /** Canonical documentation entry point fixed by the approved architecture. */
  docsEntry: "https://docs.ariadnev.com/en/stable/",
  name: "ariadnev",
  title: "ariadnev — a local execution control plane for coding agents",
  description:
    "Install one curated workflow kit across coding-agent targets, then run provider-neutral workflow graphs through a local, durable, policy-gated executor.",
  locale: "en",
} as const;

/**
 * Documentation pages the marketing surface cites as sources. Each is a page
 * the docs build emits from the release docs bundle; `tests/site` asserts every
 * cited source is one of these, so a claim can never point at a page that
 * does not exist. The source repository is private, so nothing links there.
 */
export const DOCS = {
  installation: `${SITE.docsEntry}get-started/installation`,
  graphExecution: `${SITE.docsEntry}concepts/graph-execution`,
  evaluation: `${SITE.docsEntry}concepts/evaluation`,
  workflows: `${SITE.docsEntry}reference/workflows`,
  providers: `${SITE.docsEntry}reference/providers`,
  releaseNotes: `${SITE.docsEntry}release-notes`,
} as const;

/**
 * Public machine routes owned by the edge Worker. Marketing navigation and
 * static assets must never capture these, and `tests/site/structure.test.ts`
 * imports this list to assert that the static build generates no page at any
 * of them. `public/robots.txt` excludes the same set from crawling.
 */
export const PROTECTED_ROUTES = [
  "/install",
  "/install.sh",
  "/install.ps1",
  "/version",
  "/download/",
] as const;

// ------------------------------------------------------------------- promise

/**
 * The stable promise. Three lines, no rotation, no runtime carousel — the
 * headline is the same for every visitor and every crawl.
 */
export const PROMISE = {
  eyebrow: "Local execution control plane",
  heading: "Agent work you can route, gate, and prove.",
  lines: [
    "ariadnev installs one curated workflow kit across your coding-agent targets from a single local-first CLI.",
    "Then it runs provider-neutral workflow graphs through a durable local executor that enforces policy before a provider ever acts.",
    "Every run is event-sourced, resumable, and answerable: which path executed, which gate held, what proof it produced.",
  ],
} as const;

export const INSTALL = {
  unixLabel: "macOS / Linux",
  unixCommand: "curl -fsSL https://ariadnev.com/install | bash",
  windowsLabel: "Windows (PowerShell)",
  windowsCommand: "irm https://ariadnev.com/install.ps1 | iex",
  note: "The installer resolves the binary for your platform, verifies its sha256, and links the short `av` alias. The CLI is standalone and needs no Node runtime.",
  source: DOCS.installation,
} as const;

// ------------------------------------------------------------- execution map

export interface MapState {
  readonly id: string;
  readonly label: string;
  /** One sentence. This is the initial DOM content, not an enhancement. */
  readonly summary: string;
  /** The observable artifact this state produces. */
  readonly produces: string;
}

/**
 * The five states of `av run`, in execution order. Sourced from the
 * graph-execution documentation, whose public pipeline is
 * `GraphIRV1 -> compiler/lint -> policy -> event-sourced runner -> executor registry`.
 */
export const EXECUTION_MAP: readonly MapState[] = [
  {
    id: "compile",
    label: "Compile",
    summary:
      "A canonical, provider-neutral graph is compiled and linted from the kit. Provider settings never enter the intermediate representation.",
    produces: "A compiled graph digest",
  },
  {
    id: "policy",
    label: "Policy",
    summary:
      "Authority is resolved before any provider is contacted: which capabilities a node may use, whether it causes an effect, and whether a human must approve it.",
    produces: "An allow or a denial, decided locally",
  },
  {
    id: "execute",
    label: "Execute",
    summary:
      "The runner drives the graph through the executor registry. Codex and Claude Code implement the same executor contract behind one interface.",
    produces: "An append-only event log",
  },
  {
    id: "checkpoint",
    label: "Checkpoint",
    summary:
      "Durable state is written outside the inspected workspace, so a run survives interruption and can be resumed, inspected, or cancelled.",
    produces: "A resumable run under ~/.ariadnev/runs/",
  },
  {
    id: "proof",
    label: "Proof",
    summary:
      "Resuming re-checks the instruction digest, workspace identity, graph digest, runner contract, runtime, runtime version, and model. A mismatch is reported rather than silently reconciled.",
    produces: "A stable JSON envelope you can diff",
  },
] as const;

export const EXECUTION_MAP_SOURCE: SourcedClaim = {
  claim:
    "Compile, policy, and execute are the documented public pipeline of `av run`; checkpoint and proof name the durable-state and resume behaviour the same document specifies.",
  source: DOCS.graphExecution,
  sourceLabel: "Graph execution",
  caveat:
    "The five names are this page's vocabulary for that behaviour, not five stages the runtime reports under these labels.",
};

// ----------------------------------------------------------------- workflows

export interface WorkflowNarrative {
  /** The canonical workflow identifier, exactly as it appears in the kit. */
  readonly id: string;
  readonly title: string;
  /** Authority boundary: what this workflow is allowed to do. */
  readonly authority: string;
  /** Where execution stops for a human. */
  readonly gate: string;
  /** What happens when it goes wrong. */
  readonly recovery: string;
  readonly availability: string;
}

/**
 * Exactly the three canonical workflows in `kit/workflows/`. Node and edge
 * facts below are read from those graph files, not paraphrased from memory.
 */
export const WORKFLOWS: readonly WorkflowNarrative[] = [
  {
    id: "read-only-delivery",
    title: "Read-only repository delivery",
    authority:
      "Reads the workspace and writes run state. No node in the graph declares a workspace effect, so there is nothing for it to mutate.",
    gate: "A verify gate stands between the answer and completion: an answer that cannot cite evidence does not reach a terminal success state.",
    recovery:
      "Every non-terminal node can route to failed or cancelled, so an interrupted run ends in a state you can read rather than an unknown one.",
    availability: "Publicly executable today on Codex and Claude Code.",
  },
  {
    id: "bugfix-delivery",
    title: "Root-cause bugfix delivery",
    authority:
      "Diagnosis is separated from repair. Only the fix node declares a workspace effect, and it cannot be reached without passing the approval node first.",
    gate: "An explicit human approval node sits between diagnosis and any change, so a plausible-sounding root cause never becomes an unreviewed edit.",
    recovery:
      "Diagnosis and repair both carry self-edges for bounded retry, and both route to failed or cancelled instead of continuing on a broken premise.",
    availability:
      "Validates today; active execution is policy-denied until a public side-effect and approval surface exists.",
  },
  {
    id: "safe-change-delivery",
    title: "Safe repository change delivery",
    authority:
      "A proposal is assessed before authority is granted. The apply node is the only one holding a workspace effect, and it is idempotent so a retry cannot double-apply.",
    gate: "Assessment can decline outright. When it does not, a human approval node still gates the apply, and test and review run after it before completion.",
    recovery:
      "Decline is a first-class terminal state, distinct from failure — a change that should not happen is recorded as a decision, not an error.",
    availability:
      "Validates today; active execution is policy-denied until a public side-effect and approval surface exists.",
  },
] as const;

export const WORKFLOW_SOURCE: SourcedClaim = {
  claim: "Each narrative describes the committed graph of the same name.",
  source: DOCS.workflows,
  sourceLabel: "Workflow reference",
  caveat:
    "Graph structure is a static contract. It does not by itself prove that a given provider behaves correctly at run time.",
};

// ------------------------------------------------------------------ provider

export interface ProviderProjection {
  readonly id: string;
  readonly label: string;
  /** One line. The exhaustive matrix stays in generated documentation. */
  readonly note: string;
}

/**
 * A projection, deliberately not the capability matrix. The full
 * provider x artifact table is generated from source in the kit and is linked
 * rather than reproduced, because a copy here would drift on the next release.
 */
export const PROVIDERS: readonly ProviderProjection[] = [
  { id: "claude-code", label: "Claude Code", note: "Widest surface: skills, agents, commands, rules, scripts, and hooks." },
  { id: "codex", label: "Codex", note: "Skills and scripts at the shared agent home; agents and commands under the Codex home; rules as AGENTS.md." },
  { id: "cursor", label: "Cursor", note: "Commands and rules in Cursor's own conventions; skills, agents, and scripts under the shared agent tree." },
  { id: "opencode", label: "opencode", note: "Skills, agents, commands, and scripts under the opencode tree." },
  { id: "antigravity", label: "Antigravity", note: "Skills, rules, and scripts; unverified targets are skipped, not guessed." },
  { id: "generic", label: "Generic", note: "The portable floor: skills, rules, and scripts for anything else." },
];

export const PROVIDER_PRINCIPLE: SourcedClaim = {
  claim:
    "Where a target path or format is not verified, ariadnev skips the artifact and logs it in the install summary rather than writing a guess.",
  source: DOCS.providers,
  sourceLabel: "Provider matrix",
  caveat:
    "Coverage differs per provider and changes between releases. The generated matrix is the authority; this projection is not.",
};

// ------------------------------------------------------------------ evidence

export interface EvidenceEntry {
  readonly kind: "measured" | "contract" | "boundary";
  readonly statement: string;
  readonly source: string;
  readonly sourceLabel: string;
  readonly caveat: string;
}

/**
 * The evidence ledger. Each row states what is actually proven, links a source
 * a reader can reproduce, and names the limit of the claim. Nothing here
 * asserts parity, safety of arbitrary mutation, or a performance ranking.
 */
export const EVIDENCE: readonly EvidenceEntry[] = [
  {
    kind: "contract",
    statement:
      "Static graph contracts are machine-checked: `av run <workflow> --validate` proves a canonical graph without probing any runtime.",
    source: DOCS.graphExecution,
    sourceLabel: "Graph execution architecture",
    caveat: "Validation proves the graph, not the behavior of a provider executing it.",
  },
  {
    kind: "measured",
    statement:
      "Fixture suites exercise routing, trajectory, recovery, authority, and duplicate-effect behavior against the committed graphs.",
    source: DOCS.evaluation,
    sourceLabel: "Evaluation and harness suites",
    caveat: "Fixtures cover the scenarios they encode; they are not a general correctness proof.",
  },
  {
    kind: "measured",
    statement:
      "Capability-gated Codex and Claude Code probes report only the pinned runtime and model that actually ran.",
    source: DOCS.graphExecution,
    sourceLabel: "Runtime pinning and probes",
    caveat: "A pinned-runtime result says nothing about a different runtime or a different model.",
  },
  {
    kind: "boundary",
    statement:
      "Active `safe-change-delivery` execution is denied in public builds until a real side-effect executor and approval input surface exist.",
    source: DOCS.graphExecution,
    sourceLabel: "Graph execution architecture",
    caveat: "ariadnev does not simulate a successful mutation in order to look complete.",
  },
  {
    kind: "boundary",
    statement:
      "Run state is event-sourced outside the inspected workspace, and resume refuses to switch providers on a digest mismatch.",
    source: DOCS.graphExecution,
    sourceLabel: "Durable state and privacy",
    caveat: "Durability is local. There is no hosted control plane, and telemetry is off by default with no ingest endpoint shipped.",
  },
];

// --------------------------------------------------------------- release pin

export interface ReleasePin {
  readonly version: string;
  readonly tag: string;
  readonly releaseUrl: string;
  readonly publishedAt: string;
}

/** Thrown only in release mode; an absent pin is never an error. */
export class ReleasePinError extends Error {}

const STABLE_SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;

/**
 * Read the optional machine-generated release pin, which the docs content
 * build produces from the release docs bundle.
 *
 * Absent pin  -> `null`, and the release-specific row is omitted entirely.
 * Malformed   -> `null` in a normal build; throws in a release build, so a
 *                broken sync cannot quietly ship a page with no release identity.
 *
 * A guessed or defaulted version is never returned under any condition.
 */
export function loadReleasePin(
  { path = join(repoRoot, "releases", "ariadnev.json"), releaseMode = process.env.ARIADNEV_RELEASE_MODE === "1" } = {},
): ReleasePin | null {
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    return null; // Absent is a supported state, not a failure.
  }

  const reject = (reason: string): null => {
    if (releaseMode) throw new ReleasePinError(`release pin at ${path} is invalid: ${reason}`);
    return null;
  };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return reject("not valid JSON");
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return reject("not an object");

  const record = parsed as Record<string, unknown>;
  const { version, tag, releaseUrl, publishedAt } = record;

  if (typeof version !== "string" || !STABLE_SEMVER.test(version)) return reject("version is not a stable semver");
  if (tag !== `ariadnev@${version}`) return reject("tag does not match the version");
  // Release notes live on the documentation host; the source repository is private.
  if (typeof releaseUrl !== "string" || !releaseUrl.startsWith(`${SITE.docsOrigin}/`)) {
    return reject("releaseUrl is not on the documentation host");
  }
  if (typeof publishedAt !== "string" || !ISO_INSTANT.test(publishedAt)) return reject("publishedAt is not an ISO instant");

  return { version, tag, releaseUrl, publishedAt };
}
