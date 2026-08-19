// Docs screen coverage: axe A/AA and per-width screenshot baselines for
// every manifest-declared docs fixture. Split across widths only; axe
// runs once per fixture at 1440px (representative desktop layout) and
// the mobile axe path is exercised by the accessibility-modes spec.

import { test, expect } from "@playwright/test";
import { DOCS } from "../lib/servers.mjs";
import {
  DOCS_FIXTURES,
  REQUIRED_WIDTHS,
  EXTRA_WIDTHS,
} from "../lib/screen-fixtures.mjs";
import { readyForScreenshot, runAxe, baselineName } from "../lib/page-helpers.mjs";

const ORIGIN = `http://127.0.0.1:${DOCS.port}`;

// Fixtures whose composition changes across the declared tablet/desktop
// breakpoints get the extra viewports; every other fixture stays on the
// required trio so the harness stays lean.
const BREAKPOINT_SENSITIVE = new Set(["D01", "D01-vi", "D06", "D12", "D14"]);

for (const fixture of DOCS_FIXTURES) {
  const widths = BREAKPOINT_SENSITIVE.has(fixture.id)
    ? [...REQUIRED_WIDTHS, ...EXTRA_WIDTHS].sort((a, b) => a - b)
    : REQUIRED_WIDTHS;

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
      await page.goto(`${ORIGIN}${fixture.route}`, {
        waitUntil: "networkidle",
      });
      await readyForScreenshot(page);
      const violations = await runAxe(page);
      expect(
        violations.map((v) => ({ id: v.id, impact: v.impact })),
        `axe violations on ${fixture.id}`,
      ).toEqual([]);
    });
  });
}
