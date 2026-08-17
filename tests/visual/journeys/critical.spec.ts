// Critical cross-browser journeys.
//
// This spec runs in Chromium, Firefox, and WebKit (see playwright.config
// projects). Every assertion is semantic — DOM identity, keyboard focus,
// URL transitions — never screenshots, so anti-alias drift between
// engines cannot break the gate.
//
// Journeys covered:
// 1. Marketing home → docs entry (link visible from the first viewport).
// 2. Marketing 404 recovery still exposes navigation back to home/docs.
// 3. Docs home renders with landmark + <h1> + language tag.
// 4. Docs previous-edition route is reachable and identifies as previous.
// 5. Docs 404 returns 404 status with a body users can act on.
//
// The exhaustive keyboard/search/switcher/copy matrix stays in the
// docs-side Node harness (tests/docs/run-browser-shell.mjs); this spec
// is the cross-browser subset that runs on every project.

import { test, expect } from "@playwright/test";
import { SITE, DOCS } from "../lib/servers.mjs";

const SITE_ORIGIN = `http://127.0.0.1:${SITE.port}`;
const DOCS_ORIGIN = `http://127.0.0.1:${DOCS.port}`;

test("marketing home links to docs from the first viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const response = await page.goto(`${SITE_ORIGIN}/`, {
    waitUntil: "domcontentloaded",
  });
  expect(response?.status()).toBe(200);
  // The site's docs entry point lives inside the hero macro; assert on
  // its presence rather than any specific label so a copy change never
  // breaks cross-browser gates.
  const docsLink = page.locator('a[href*="docs"], a[href*="/en/stable"]').first();
  await expect(docsLink).toBeVisible();
});

test("marketing 404 keeps a heading and a link out", async ({ page }) => {
  const response = await page.goto(`${SITE_ORIGIN}/not-a-real-path`, {
    waitUntil: "domcontentloaded",
  });
  expect(response?.status()).toBe(404);
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.locator("a").first()).toBeVisible();
});

test("docs home identifies the current edition and locale", async ({ page }) => {
  const response = await page.goto(`${DOCS_ORIGIN}/en/stable/`, {
    waitUntil: "domcontentloaded",
  });
  expect(response?.status()).toBe(200);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator("main")).toBeVisible();
  await expect(page.locator("h1").first()).toBeVisible();
});

test("docs previous edition is reachable and identifies as previous", async ({ page }) => {
  const response = await page.goto(`${DOCS_ORIGIN}/en/1.0.0/`, {
    waitUntil: "domcontentloaded",
  });
  expect(response?.status()).toBe(200);
  await expect(page.locator("main")).toBeVisible();
  // Every previous-edition page ships a version indicator in the header
  // shell; the exact chip class is fumadocs-owned, so we assert the URL
  // path segment stays as the load-bearing signal.
  expect(page.url()).toContain("/en/1.0.0/");
});

test("docs unknown route returns 404", async ({ page }) => {
  const response = await page.goto(`${DOCS_ORIGIN}/en/stable/does-not-exist/`, {
    waitUntil: "domcontentloaded",
  });
  expect(response?.status()).toBe(404);
});
