// Browser gate.
//
// The page is loaded in a real browser under the conditions that break most
// marketing pages: JavaScript disabled, reduced motion, keyboard only, print
// media, a 320-pixel viewport, and a deliberately broken enhancer. In every one
// of them the essential content must already be there, because it was never the
// script's job to produce it.
//
// Playwright drives the browser, but the assertions are Vitest's: the auto-
// retrying `expect` matchers ship with @playwright/test, which this workspace
// does not install, so each check waits explicitly and then asserts a value.

import { chromium, type Browser, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildOnce, serveDist, type StaticSite } from "./helpers";

const VIEWPORTS = [320, 375, 390, 768, 1280, 1440];

/** Content that must be present before any script runs. */
const ESSENTIAL = [
  "Agent work you can route, gate, and prove.",
  "curl -fsSL https://vcskill.vchun.dev/install | bash",
  "safe-change-delivery",
  "bugfix-delivery",
  "read-only-delivery",
  "compile",
  "checkpoint",
];

let browser: Browser;
let site: StaticSite;

/** Wait until the enhancer has installed, which it signals by revealing copy. */
async function waitForEnhancer(page: Page): Promise<void> {
  await page.waitForFunction(() => document.querySelectorAll("[data-copy-for]:not([hidden])").length > 0);
}

beforeAll(async () => {
  await buildOnce();
  site = await serveDist();
  browser = await chromium.launch();
}, 180_000);

afterAll(async () => {
  await browser?.close();
  await site?.close();
});

describe("with JavaScript disabled", () => {
  it("renders every essential fact", async () => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto(site.origin);

    const text = await page.locator("body").innerText();
    for (const fact of ESSENTIAL) expect(text, `missing without JS: ${fact}`).toContain(fact);

    expect(await page.locator("main > section").count()).toBe(6);
    expect(await page.locator("[data-map-step]").count()).toBe(5);
    expect(await page.locator(".workflow").count()).toBe(3);

    // And no dead copy control, because nothing revealed it.
    expect(await page.locator("[data-copy-for]:not([hidden])").count()).toBe(0);
    await context.close();
  });

  it("hides no essential element at initial render", async () => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto(site.origin);

    const hidden = await page.evaluate(() => {
      const invisible: string[] = [];
      for (const element of document.querySelectorAll("main h1, main h2, main h3, main p, main li, main dd")) {
        // An element with no text carries no essential content. The copy-status
        // regions are empty until a copy happens, by design.
        if ((element.textContent ?? "").trim() === "") continue;
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) < 0.99 || rect.height === 0) {
          invisible.push(element.textContent?.slice(0, 40) ?? "");
        }
      }
      return invisible;
    });
    expect(hidden).toEqual([]);
    await context.close();
  });
});

describe("layout", () => {
  for (const width of VIEWPORTS) {
    it(`has no horizontal overflow at ${width} CSS pixels`, async () => {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      const page = await context.newPage();
      await page.goto(site.origin);

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);

      // The install command has to be readable, not just present.
      expect(await page.locator("#promise-install-unix").isVisible()).toBe(true);
      await context.close();
    });
  }

  it("gives every interactive target at least 44 by 44 CSS pixels", async () => {
    const context = await browser.newContext({ viewport: { width: 320, height: 900 } });
    const page = await context.newPage();
    await page.goto(site.origin);
    await waitForEnhancer(page);

    const small = await page.evaluate(() => {
      const offenders: string[] = [];
      for (const element of document.querySelectorAll("a, button")) {
        if ((element as HTMLElement).offsetParent === null) continue; // Not rendered.
        // Links inline in a sentence are exempt from the WCAG 2.2 target size
        // rule, and enlarging them would break the line box they sit in.
        if (element.tagName === "A" && element.closest("p") !== null) continue;
        const rect = element.getBoundingClientRect();
        if (rect.width < 44 || rect.height < 44) {
          offenders.push(`${element.tagName} "${element.textContent?.trim().slice(0, 24)}" ${rect.width}x${rect.height}`);
        }
      }
      return offenders;
    });
    expect(small).toEqual([]);
    await context.close();
  });
});

describe("reduced motion", () => {
  it("keeps the whole map visible and does not react to scrolling", async () => {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    await page.goto(site.origin);
    await waitForEnhancer(page);

    expect(await page.locator("[data-map-step]").count()).toBe(5);
    for (let index = 0; index < 5; index += 1) {
      expect(await page.locator("[data-map-step]").nth(index).isVisible()).toBe(true);
    }

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
    await page.waitForTimeout(300);
    const emphasised = await page.locator('[data-map-step][data-emphasis="on"]').count();
    expect(emphasised, "scroll must not drive emphasis under reduced motion").toBe(0);
    await context.close();
  });
});

describe("keyboard and clipboard", () => {
  it("reaches the skip link first, then install, by keyboard alone", async () => {
    const page = await browser.newPage();
    await page.goto(site.origin);

    await page.keyboard.press("Tab");
    expect(await page.evaluate(() => document.activeElement?.className ?? "")).toContain("skip-link");

    const reachable: string[] = [];
    for (let step = 0; step < 12; step += 1) {
      await page.keyboard.press("Tab");
      reachable.push(await page.evaluate(() => document.activeElement?.textContent?.trim() ?? ""));
    }
    expect(reachable.join(" | ")).toContain("Install");
    await page.close();
  });

  it("announces a blocked copy instead of failing silently", async () => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.addInitScript(() => {
      Object.defineProperty(navigator.clipboard, "writeText", {
        value: () => Promise.reject(new Error("denied")),
        configurable: true,
      });
    });
    await page.goto(site.origin);
    await waitForEnhancer(page);

    await page.locator('[data-copy-for="final-install-unix"]').click();
    await page.waitForFunction(
      () => (document.querySelector("#final-install-unix-status")?.textContent ?? "").length > 0,
    );
    expect(await page.locator("#final-install-unix-status").innerText()).toContain("Select the command text");

    // Feedback lands on the control that was used, not on some other one.
    expect(await page.locator("#promise-install-unix-status").textContent()).toBe("");

    // The literal command is untouched and still selectable.
    expect(await page.locator("#final-install-unix").innerText()).toBe(
      "curl -fsSL https://vcskill.vchun.dev/install | bash",
    );
    await context.close();
  });
});

describe("failed enhancement", () => {
  it("leaves the page complete when the enhancer throws on load", async () => {
    const context = await browser.newContext();
    const page = await context.newPage();
    // Break the first API the enhancer touches, before the module runs.
    await page.addInitScript(() => {
      Object.defineProperty(document, "querySelectorAll", {
        value: () => {
          throw new Error("enhancer sabotage");
        },
        configurable: true,
      });
    });
    await page.goto(site.origin);

    const text = await page.locator("body").innerText();
    for (const fact of ESSENTIAL) expect(text, `lost when the enhancer failed: ${fact}`).toContain(fact);
    await context.close();
  });
});

describe("print", () => {
  it("keeps the map and the install command on paper", async () => {
    const page = await browser.newPage();
    await page.goto(site.origin);
    await page.emulateMedia({ media: "print" });

    expect(await page.locator("[data-map-steps]").isVisible()).toBe(true);
    expect(await page.locator("#final-install-unix").isVisible()).toBe(true);
    expect(await page.locator(".map__jump").isVisible()).toBe(false);
    await page.close();
  });
});

describe("routing", () => {
  it("answers an unknown path with a real 404 and a recovery page", async () => {
    const page = await browser.newPage();
    const response = await page.goto(`${site.origin}/not-a-real-path`);
    expect(response?.status()).toBe(404);
    expect(await page.locator("body").innerText()).toContain("This path does not exist");
    await page.close();
  });
});

describe("console", () => {
  it("logs no error or warning on a normal load", async () => {
    const page = await browser.newPage();
    const problems: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error" || message.type() === "warning") problems.push(message.text());
    });
    page.on("pageerror", (error) => problems.push(error.message));

    await page.goto(site.origin, { waitUntil: "networkidle" });
    expect(problems).toEqual([]);
    await page.close();
  });
});
