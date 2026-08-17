// M01 + M02 screen coverage: axe A/AA and per-width screenshot baselines
// against the built marketing surface. Chromium is the sole baseline
// browser — Firefox/WebKit anti-alias drift never triggers a diff.

import { test, expect } from "@playwright/test";
import { SITE } from "../lib/servers.mjs";
import { SITE_FIXTURES, REQUIRED_WIDTHS, EXTRA_WIDTHS } from "../lib/screen-fixtures.mjs";
import { readyForScreenshot, runAxe, baselineName } from "../lib/page-helpers.mjs";

const ORIGIN = `http://127.0.0.1:${SITE.port}`;

// M01 crosses the 1280 desktop hero-path breakpoint; add 375 for the
// most common mobile viewport delta.
const WIDTHS_BY_ID = {
  M01: [...REQUIRED_WIDTHS, ...EXTRA_WIDTHS].sort((a, b) => a - b),
  M02: REQUIRED_WIDTHS,
};

for (const fixture of SITE_FIXTURES) {
  const widths = WIDTHS_BY_ID[fixture.id] ?? REQUIRED_WIDTHS;
  test.describe(`${fixture.id} — ${fixture.description}`, () => {
    for (const width of widths) {
      test(`${fixture.id} @ ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: width <= 390 ? 844 : 900 });
        const response = await page.goto(`${ORIGIN}${fixture.route}`, {
          waitUntil: "domcontentloaded",
        });
        expect(response?.status()).toBe(fixture.expectStatus ?? 200);
        await readyForScreenshot(page);
        await expect(page).toHaveScreenshot(baselineName(fixture.id, width), {
          fullPage: true,
        });
      });
    }

    test(`${fixture.id} axe (WCAG 2.x A/AA)`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(`${ORIGIN}${fixture.route}`, { waitUntil: "networkidle" });
      await readyForScreenshot(page);
      const violations = await runAxe(page);
      expect(
        violations.map((v) => ({ id: v.id, impact: v.impact })),
        `axe violations on ${fixture.id}`,
      ).toEqual([]);
    });
  });
}
