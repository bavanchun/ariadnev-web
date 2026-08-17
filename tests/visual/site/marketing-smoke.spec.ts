// Marketing smoke: verifies the site static server boots and Chromium
// reaches the built home. Kept intentionally minimal so we prove the
// harness end-to-end before scaling to per-fixture screenshots and axe.

import { test, expect } from "@playwright/test";
import { SITE } from "../lib/servers.mjs";

const ORIGIN = `http://127.0.0.1:${SITE.port}`;

test("M01 home renders with title and single h1", async ({ page }) => {
  const response = await page.goto(`${ORIGIN}/`, { waitUntil: "domcontentloaded" });
  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle(/.+/);
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.locator("html")).toHaveAttribute("lang", /.+/);
});

test("M02 unknown route serves 404 body", async ({ page }) => {
  const response = await page.goto(`${ORIGIN}/not-a-real-path`, { waitUntil: "domcontentloaded" });
  expect(response?.status()).toBe(404);
  await expect(page.locator("h1")).toHaveCount(1);
});
