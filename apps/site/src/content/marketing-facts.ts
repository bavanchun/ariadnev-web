import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const siteFacts = {
  installCommands: [
    { id: "unix", label: "macOS / Linux", command: "curl -fsSL https://vcskill.vchun.dev/install | bash" },
    { id: "windows", label: "Windows PowerShell", command: "irm https://vcskill.vchun.dev/install.ps1 | iex" },
  ],
  installUrl: "https://vcskill.vchun.dev/install",
  docsUrl: "https://docs.vcskill.vchun.dev/en/stable/",
  workflows: [
    {
      id: "safe-change-delivery",
      purpose: "Plan and deliver an authorized workspace change.",
      authority: "The public active executor is read-only; mutation requires a supported side-effect executor and explicit approval.",
      recovery: "Resume from the last retained checkpoint after a failed gate.",
      sourceLabel: "Open workflow reference",
      sourceUrl: "https://docs.vcskill.vchun.dev/en/stable/reference/workflows/safe-change-delivery/",
      caveat: "Generated workflow details are release-scoped; the linked reference is the authority.",
    },
    {
      id: "bugfix-delivery",
      purpose: "Trace a defect, repair its cause, and verify the blast radius.",
      authority: "Diagnosis can run read-only; repair waits for a supported side-effect executor and explicit approval.",
      recovery: "Return to diagnosis when the original reproduction still fails.",
      sourceLabel: "Open workflow reference",
      sourceUrl: "https://docs.vcskill.vchun.dev/en/stable/reference/workflows/bugfix-delivery/",
      caveat: "Generated workflow details are release-scoped; the linked reference is the authority.",
    },
    {
      id: "read-only-delivery",
      purpose: "Inspect and report without changing the workspace.",
      authority: "Read-only execution cannot cross into mutation.",
      recovery: "Retain observations and stop when new authority is required.",
      sourceLabel: "Open workflow reference",
      sourceUrl: "https://docs.vcskill.vchun.dev/en/stable/reference/workflows/read-only-delivery/",
      caveat: "Generated workflow details are release-scoped; the linked reference is the authority.",
    },
  ],
  evidence: [
    {
      claim: "Anonymous installation is served from the public edge.",
      sourceLabel: "Inspect installer",
      sourceUrl: "https://vcskill.vchun.dev/install",
      caveat: "Review executable content before piping it to a shell.",
    },
    {
      claim: "Published artifacts have a public checksum ledger.",
      sourceLabel: "Read checksums",
      sourceUrl: "https://vcskill.vchun.dev/download/checksums.txt",
      caveat: "A checksum proves an artifact match, not runtime behavior.",
    },
    {
      claim: "Generated documentation is the detailed capability authority.",
      sourceLabel: "Open stable docs",
      sourceUrl: "https://docs.vcskill.vchun.dev/en/stable/",
      caveat: "Provider support can vary by release and target.",
    },
  ],
} as const;

export interface ReleasePin {
  version: string;
  tag: string;
  sourceSha: string;
}

const defaultReleasePinPath = fileURLToPath(new URL("../../../../releases/vcskill.json", import.meta.url));
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseReleasePin(value: unknown): ReleasePin {
  if (!isRecord(value) || value.schemaVersion !== 1 || !isRecord(value.current)) {
    throw new Error("releases/vcskill.json must contain schemaVersion 1 and a current release");
  }
  const { version, tag, sourceSha } = value.current;
  if (
    typeof version !== "string" ||
    !SEMVER.test(version) ||
    typeof tag !== "string" || tag !== `vcskill@${version}` ||
    typeof sourceSha !== "string" || !/^[0-9a-f]{40,64}$/i.test(sourceSha)
  ) {
    throw new Error("releases/vcskill.json current identity is malformed");
  }
  return { version, tag, sourceSha };
}

export function loadReleasePin(path = defaultReleasePinPath, required = false): ReleasePin | undefined {
  try {
    return parseReleasePin(JSON.parse(readFileSync(path, "utf8")) as unknown);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT" && !required) return undefined;
    throw error;
  }
}
