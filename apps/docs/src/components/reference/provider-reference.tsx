import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { DocsScreenContext } from "../docs-screen-registry.tsx";
import { docsContentRoot } from "@/lib/content-source.ts";

// D14 — Provider reference. The generated Markdown body (rendered by
// `scripts/docs-content/render-reference-pages.mjs#renderProviderReference`)
// already carries both halves the D14 architecture asks for: a comparison
// matrix (columns are providers) and provider-first records (one dense
// two-column table per provider) — fully server-rendered, no JavaScript
// required, and already covered by the site-wide local-scroll + keyboard
// affordance every wide `<table>` gets (`docs.css` `.docs-body table` plus
// `document-copy-enhancer.tsx`'s hydrated `tabindex`).
//
// What the generator cannot add without growing the indexed Markdown (the
// `en/1.1.0` search partition has ~0B headroom under its frozen cap — see
// `cli-command-index.tsx`) is a "jump straight to a provider's mobile
// record" affordance. This wrapper reads the same verified, build-time
// bundle JSON `build-content-root.mjs` already extracted (never re-parses
// the compiled MDX tree) to render that jump nav ahead of the body, at
// zero cost to the indexed content.

const STRINGS = {
  en: { jumpLabel: "Jump to a provider record", jumpAria: "Provider records on this page" },
  vi: { jumpLabel: "Đi tới bản ghi provider", jumpAria: "Các bản ghi provider trên trang này" },
} as const;

const SAFE_ID = /^[a-z0-9][a-z0-9-]*$/;

interface ProviderRecord {
  readonly id: string;
}

function normalizeProviders(value: unknown): readonly ProviderRecord[] {
  if (!Array.isArray(value)) return [];
  const ids: ProviderRecord[] = [];
  for (const item of value) {
    const id = (item as { id?: unknown } | null)?.id;
    if (typeof id === "string" && SAFE_ID.test(id)) ids.push({ id });
  }
  return ids.sort((left, right) => left.id.localeCompare(right.id, "en"));
}

/**
 * Read the provider list for the edition this page renders. The current
 * edition's providers live in the release bundle's `providers.json`; the
 * previous edition's historical projection is embedded in the previous-stable
 * bootstrap document. Both files are the same trusted artifact
 * `build-content-root.mjs` already verified before this component ever runs.
 * A missing or unreadable file yields an empty list — the jump nav simply
 * does not render — rather than guessing at provider identity.
 */
function readProviders(version: string, currentStable: string): readonly ProviderRecord[] {
  try {
    if (version === currentStable) {
      const raw = JSON.parse(readFileSync(join(docsContentRoot, "generated/bundle/reference/providers/providers.json"), "utf8"));
      return normalizeProviders(raw?.providers);
    }
    const raw = JSON.parse(readFileSync(join(docsContentRoot, "generated/bundle/reference/previous-stable/bootstrap.json"), "utf8"));
    return normalizeProviders(raw?.historicalProjection?.providers?.providers);
  } catch {
    return [];
  }
}

export function ProviderReferenceExperience({ catalog, catalogPage, children }: DocsScreenContext) {
  const strings = STRINGS[catalogPage.locale] ?? STRINGS.en;
  const providers = readProviders(catalogPage.version, catalog.currentStable);

  return (
    <div className="provider-reference">
      {providers.length > 0 && (
        <nav className="provider-reference-jump" aria-label={strings.jumpAria}>
          <span className="provider-reference-jump-label">{strings.jumpLabel}</span>
          <ul>
            {providers.map((provider) => (
              <li key={provider.id}>
                <a href={`#${provider.id}`}>
                  <code>{provider.id}</code>
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}
      {children}
    </div>
  );
}
