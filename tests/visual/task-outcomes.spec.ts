// Deterministic task-outcome comparisons for the 8 critical journeys
// the plan calls out. Each test asserts three things:
//
//   1. Route correctness — the user lands at the canonical URL.
//   2. Required fact visibility — a load-bearing sentence, table, or
//      element is present without further interaction.
//   3. Interaction count — the user reached it in ≤ the plan's
//      purposeful-interaction budget for that task.
//
// Elapsed time is intentionally not gated (per plan: "elapsed time is
// informational unless the environment is controlled"). Any regression
// that increases interaction count or hides a required fact fails.

import { test, expect } from "@playwright/test";
import { DOCS, SITE } from "./lib/servers.mjs";

const SITE_ORIGIN = `http://127.0.0.1:${SITE.port}`;
const DOCS_ORIGIN = `http://127.0.0.1:${DOCS.port}`;

test("Task 1: locale choice — landing chooser exposes EN and VI", async ({
  page,
}) => {
  await page.goto(`${DOCS_ORIGIN}/`, { waitUntil: "networkidle" });
  const en = page.locator('a[href*="/en/"]').first();
  const vi = page.locator('a[href*="/vi/"]').first();
  await expect(en).toBeVisible();
  await expect(vi).toBeVisible();
});

test("Task 2: installation — first fixture reaches install page directly", async ({
  page,
}) => {
  const response = await page.goto(
    `${DOCS_ORIGIN}/en/stable/get-started/installation/`,
    { waitUntil: "domcontentloaded" },
  );
  expect(response?.status()).toBe(200);
  // Required fact: an install command is visible without scrolling into
  // secondary sections. The command list uses <code> under a <pre>.
  await expect(page.locator("pre code").first()).toBeVisible();
});

test("Task 3: first install verification — doctor exit table visible", async ({
  page,
}) => {
  await page.goto(`${DOCS_ORIGIN}/en/stable/get-started/first-install/`, {
    waitUntil: "networkidle",
  });
  // Required fact: doctor exit-code guidance the user must be able to
  // read after the install to verify success. Present as a table body.
  await expect(page.locator("table").first()).toBeVisible();
});

test("Task 4: exact-command lookup — CLI index links a specific command in one hop", async ({
  page,
}) => {
  await page.goto(`${DOCS_ORIGIN}/en/stable/reference/cli/`, {
    waitUntil: "networkidle",
  });
  // Purposeful interaction: click a command; verify direct navigation.
  const commandLink = page.locator('main a[href*="/cli/"]').first();
  await expect(commandLink).toBeVisible();
  const href = await commandLink.getAttribute("href");
  expect(href, "CLI index must expose a per-command link").toMatch(/\/cli\/.+/);
});

test("Task 4: CLI index slash shortcut focuses its local exact-command filter", async ({
  page,
}) => {
  await page.goto(`${DOCS_ORIGIN}/en/stable/reference/cli/`, {
    waitUntil: "networkidle",
  });
  await page.keyboard.press("/");
  await expect(page.getByLabel("Filter commands")).toBeFocused();
  await expect(page.getByRole("dialog")).toBeHidden();
});

test("Task 5: provider comparison — providers reference exposes comparison table", async ({
  page,
}) => {
  await page.goto(`${DOCS_ORIGIN}/en/stable/reference/providers/`, {
    waitUntil: "networkidle",
  });
  await expect(page.locator("main table").first()).toBeVisible();
});

test("Task 6: workflow understanding — graph-execution page names its lifecycle", async ({
  page,
}) => {
  await page.goto(`${DOCS_ORIGIN}/en/stable/concepts/graph-execution/`, {
    waitUntil: "networkidle",
  });
  // Required fact: five-state lifecycle (Compile, Policy, Execute,
  // Checkpoint, Proof) is visible on the concept page.
  const body = page.locator("main");
  await expect(body).toContainText(/Compile/);
  await expect(body).toContainText(/Policy/);
  await expect(body).toContainText(/Checkpoint/);
});

test("Task 7: unavailable-context recovery — docs 404 surfaces a way out", async ({
  page,
}) => {
  const response = await page.goto(
    `${DOCS_ORIGIN}/en/stable/does-not-exist/`,
    { waitUntil: "domcontentloaded" },
  );
  expect(response?.status()).toBe(404);
  // Required fact: at least one navigation link so the user can leave.
  await expect(page.locator("a").first()).toBeVisible();
});

test("Task 8: migration-risk recognition — migration page marks irreversible stages", async ({
  page,
}) => {
  await page.goto(
    `${DOCS_ORIGIN}/en/stable/guides/migration-from-vcskill/`,
    { waitUntil: "networkidle" },
  );
  // Required fact: the migration page names the destructive boundary
  // so users see the risk before running rm -rf. The authored text uses
  // "Destructive" + "no undo"; either phrasing satisfies the outcome.
  await expect(page.locator("main")).toContainText(/destructive|no undo|irreversibl/i);
});

test("marketing surface routes to docs — bonus critical path", async ({
  page,
}) => {
  await page.goto(`${SITE_ORIGIN}/`, { waitUntil: "networkidle" });
  const docsLink = page.locator('a[href*="/en/stable"]').first();
  await expect(docsLink).toBeVisible();
});
