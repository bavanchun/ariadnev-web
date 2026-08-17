// Shared helpers for visual specs: font readiness, axe wiring, screenshot
// naming. Every deterministic-baseline spec goes through these so a
// missing `document.fonts.ready` never smuggles anti-alias drift into
// the first screenshot frame.

import AxeBuilder from "@axe-core/playwright";

/** Wait for fonts and network to settle before a screenshot. */
export async function readyForScreenshot(page) {
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts?.ready);
}

/** Canonical WCAG axe run — A/AA at 2.x and 2.1. */
export async function runAxe(page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  return results.violations;
}

/**
 * Baseline screenshot name for a fixture at a width. Kept short and
 * OS-independent so committed baselines port between Linux CI and macOS
 * dev when the font environment is pinned.
 */
export function baselineName(fixtureId, width) {
  return `${fixtureId}-${width}.png`;
}
