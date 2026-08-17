import type { ReactNode } from "react";
import type { DocsLocale } from "@/lib/i18n.ts";

// Phase 4 closed content component — Procedure/step. `<ol>`/`<li>` carries
// native step-position semantics ("item 3 of 5") in every assistive
// technology without any extra markup; each `Step` additionally wraps its
// content in a `role="region"` landmark so a reader can jump straight to
// "Step 3" without walking the whole list, and gives that landmark a stable
// `id` with `tabIndex={-1}` so a caller (e.g. a destructive-action confirm
// flow or the pager) can restore keyboard focus to a specific step
// programmatically without requiring a prior click — "focus-restore-friendly"
// per the phase-04 contract. Nothing here depends on JavaScript to render or
// read correctly.

interface ProcedureStrings {
  readonly stepLabel: string;
}

const STRINGS: Record<DocsLocale, ProcedureStrings> = {
  en: { stepLabel: "Step" },
  vi: { stepLabel: "Bước" },
};

export interface ProcedureProps {
  readonly locale: DocsLocale;
  readonly heading: string;
  readonly children: ReactNode;
  readonly id?: string;
}

export function Procedure({ heading, children, id }: ProcedureProps) {
  return (
    <ol className="procedure" aria-label={heading} id={id}>
      {children}
    </ol>
  );
}

export interface StepProps {
  readonly locale: DocsLocale;
  readonly title: string;
  readonly children: ReactNode;
  readonly id: string;
}

export function Step({ locale, title, children, id }: StepProps) {
  const strings = STRINGS[locale] ?? STRINGS.en;
  const headingId = `${id}-heading`;
  return (
    <li>
      <section role="region" aria-labelledby={headingId} id={id} tabIndex={-1}>
        <h3 id={headingId}>
          <span className="procedure-step-kicker">{strings.stepLabel}</span> {title}
        </h3>
        {children}
      </section>
    </li>
  );
}
