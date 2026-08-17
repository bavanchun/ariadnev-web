import type { ReactNode } from "react";
import type { DocsLocale } from "@/lib/i18n.ts";

// Phase 4 closed content component — Callout. One of the five named
// semantics `packages/tokens` ships as `content.callout.*`
// (note/gate/boundary/destructive/evidence — "do not add a sixth without an
// accepted decision-doc addendum"); this component is the only place that
// consumes those five CSS custom properties, so the token contract and the
// component contract stay 1:1.
//
// Landmark: `role="region"` plus a required accessible name (the variant
// label, optionally followed by the caller's heading) is the one generic
// ARIA landmark role that fits an inline callout — a reader using landmark
// navigation can jump straight to a Gate or Destructive callout without
// reading surrounding prose. Text conveys the semantic (an always-visible
// label), never color alone.
//
// `children` is `ReactNode`, not a string lowered from untrusted content —
// callers are TypeScript screen-experience modules (approach 3 of
// `docs/decisions/docs-catalog-and-safe-components.md`), never authored MDX.
// No `dangerouslySetInnerHTML` anywhere in this tree.

export type CalloutVariant = "note" | "gate" | "boundary" | "destructive" | "evidence";

interface CalloutStrings {
  readonly note: string;
  readonly gate: string;
  readonly boundary: string;
  readonly destructive: string;
  readonly evidence: string;
}

const STRINGS: Record<DocsLocale, CalloutStrings> = {
  en: { note: "Note", gate: "Gate", boundary: "Boundary", destructive: "Destructive", evidence: "Evidence" },
  vi: { note: "Ghi chú", gate: "Cổng xác nhận", boundary: "Ranh giới", destructive: "Hành động phá hủy", evidence: "Bằng chứng" },
};

export interface CalloutProps {
  readonly variant: CalloutVariant;
  readonly locale: DocsLocale;
  readonly heading?: string;
  readonly children: ReactNode;
  readonly id?: string;
}

export function Callout({ variant, locale, heading, children, id }: CalloutProps) {
  const strings = STRINGS[locale] ?? STRINGS.en;
  const label = strings[variant];
  const accessibleName = heading ? `${label}: ${heading}` : label;
  return (
    <section className={`callout callout-${variant}`} role="region" aria-label={accessibleName} id={id}>
      <p className="callout-kicker">{label}</p>
      {heading && <strong>{heading}</strong>}
      {children}
    </section>
  );
}
