import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { dirname, extname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import AxeBuilder from "@axe-core/playwright";
import { chromium } from "@playwright/test";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const distRoot = resolve(repositoryRoot, "apps/site/dist");
const port = 4326;
const origin = `http://127.0.0.1:${port}`;
const viewports = [320, 375, 390, 768, 1280, 1440];

const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"], [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"], [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"], [".txt", "text/plain; charset=utf-8"],
  [".webmanifest", "application/manifest+json"], [".woff2", "font/woff2"], [".xml", "application/xml; charset=utf-8"],
]);

function inside(root, candidate) {
  const path = relative(root, candidate);
  return path !== ".." && !path.startsWith(`..${sep}`);
}

async function startStaticServer() {
  const server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url ?? "/", origin).pathname);
      let target = resolve(distRoot, pathname.replace(/^\/+/, ""));
      if (pathname.endsWith("/")) target = resolve(target, "index.html");
      let statusCode = 200;
      let info = inside(distRoot, target) ? await stat(target).catch(() => undefined) : undefined;
      if (info?.isDirectory()) {
        target = resolve(target, "index.html");
        info = await stat(target).catch(() => undefined);
      }
      if (!info?.isFile()) {
        target = resolve(distRoot, "404.html");
        statusCode = 404;
      }
      const body = await readFile(target);
      response.writeHead(statusCode, { "content-type": contentTypes.get(extname(target)) ?? "application/octet-stream" });
      response.end(request.method === "HEAD" ? undefined : body);
    } catch {
      response.writeHead(400, { "content-type": "text/plain; charset=utf-8" });
      response.end("bad request");
    }
  });
  await new Promise((resolvePromise, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolvePromise);
  });
  return server;
}

async function closeServer(server) {
  await new Promise((resolvePromise, reject) => server.close((error) => error ? reject(error) : resolvePromise()));
}

async function inspectViewport(browser, width) {
  const context = await browser.newContext({ viewport: { width, height: width <= 390 ? 844 : 900 }, reducedMotion: "reduce" });
  await context.addInitScript(() => Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined }));
  const page = await context.newPage();
  const consoleErrors = [];
  const externalRequests = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  page.on("request", (request) => { if (new URL(request.url()).origin !== origin) externalRequests.push(request.url()); });
  const response = await page.goto(origin, { waitUntil: "networkidle" });
  assert.equal(response?.status(), 200);
  await page.evaluate(() => document.fonts.ready);
  assert.equal(await page.locator("h1").count(), 1);
  assert.equal(await page.locator("[data-site-section]").count(), 6);
  assert.ok(await page.locator("[data-site-section]").evaluateAll((sections) => sections.every((section) => {
    const style = getComputedStyle(section);
    const rect = section.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && rect.height > 0;
  })), `${width}px hides an essential section`);
  const layout = await page.evaluate(() => {
    const h1 = document.querySelector("h1");
    const h1Style = h1 ? getComputedStyle(h1) : undefined;
    const h1Lines = h1 && h1Style ? Math.ceil(h1.getBoundingClientRect().height / Number.parseFloat(h1Style.lineHeight)) : 99;
    const overflow = [...document.body.querySelectorAll("*")].filter((element) => {
      if (element.classList.contains("skip-link")) return false;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 1 && (rect.left < -1 || rect.right > innerWidth + 1);
    }).slice(0, 8).map((element) => `${element.tagName.toLowerCase()}.${element.className}`);
    const undersized = [...document.querySelectorAll("a, button, [tabindex='0']")].filter((element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && (rect.width < 43.5 || rect.height < 43.5);
    }).slice(0, 8).map((element) => `${element.tagName.toLowerCase()}.${element.className}`);
    const horizontalMap = document.querySelector(".map-diagram-horizontal");
    const verticalMap = document.querySelector(".map-diagram-vertical");
    const brand = document.querySelector(".site-header .brand");
    const install = document.querySelector(".site-header .header-install");
    const nav = document.querySelector(".site-header nav");
    const horizontalRect = horizontalMap?.getBoundingClientRect();
    const verticalRect = verticalMap?.getBoundingClientRect();
    const brandRect = brand?.getBoundingClientRect();
    const installRect = install?.getBoundingClientRect();
    const navRect = nav?.getBoundingClientRect();
    return {
      h1Lines,
      h1Width: h1?.getBoundingClientRect().width ?? 0,
      h1Height: h1?.getBoundingClientRect().height ?? 0,
      h1FontSize: h1Style?.fontSize ?? "unknown",
      h1LineHeight: h1Style?.lineHeight ?? "unknown",
      overflow,
      undersized,
      scrollWidth: document.documentElement.scrollWidth,
      viewport: innerWidth,
      horizontalMapVisible: horizontalMap ? getComputedStyle(horizontalMap).display !== "none" : false,
      verticalMapVisible: verticalMap ? getComputedStyle(verticalMap).display !== "none" : false,
      verticalMapIsStacked: Boolean(verticalRect && verticalRect.height > verticalRect.width),
      brandTop: brandRect?.top ?? -1,
      installTop: installRect?.top ?? -2,
      installBottom: installRect?.bottom ?? -1,
      navTop: navRect?.top ?? -2,
    };
  });
  assert.ok(layout.h1Lines <= 3, `${width}px hero uses ${layout.h1Lines} lines (${JSON.stringify(layout)})`);
  assert.ok(layout.scrollWidth <= layout.viewport, `${width}px document overflows horizontally`);
  assert.deepEqual(layout.overflow, [], `${width}px has out-of-viewport elements`);
  assert.deepEqual(layout.undersized, [], `${width}px has undersized interactive targets`);
  if (width <= 768) {
    assert.equal(layout.horizontalMapVisible, false, `${width}px still renders the compressed horizontal map`);
    assert.equal(layout.verticalMapVisible, true, `${width}px does not render the stacked map`);
    assert.equal(layout.verticalMapIsStacked, true, `${width}px map is not vertically stacked`);
    assert.ok(Math.abs(layout.brandTop - layout.installTop) <= 2, `${width}px Install action is not on the brand row`);
    assert.ok(layout.navTop >= layout.installBottom - 1, `${width}px primary navigation does not follow the compact action row`);
  } else {
    assert.equal(layout.horizontalMapVisible, true, `${width}px hides the horizontal map`);
    assert.equal(layout.verticalMapVisible, false, `${width}px renders the mobile map`);
  }
  assert.equal(consoleErrors.length, 0, `${width}px console errors: ${consoleErrors.join(" | ")}`);
  assert.deepEqual(externalRequests, [], `${width}px made external runtime requests`);
  assert.equal(await page.locator("[data-map-node]").count(), 5);
  if (width === 320 || width === 1440) await page.screenshot({ path: `/tmp/vcskill-site-${width}.png`, fullPage: true });
  await context.close();
  return layout;
}

execFileSync("pnpm", ["--filter", "@vcskill/site", "build"], { cwd: repositoryRoot, stdio: "inherit" });
const server = await startStaticServer();
const browser = await chromium.launch({ headless: true });
try {
  const layouts = [];
  for (const width of viewports) layouts.push(await inspectViewport(browser, width));

  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(() => Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined }));
  const page = await context.newPage();
  await page.goto(origin, { waitUntil: "networkidle" });
  await page.getByRole("link", { name: "Install vcskill", exact: true }).click();
  assert.equal(new URL(page.url()).hash, "#install");
  assert.ok(await page.locator("#final-unix-install-command").isVisible());
  assert.ok(await page.locator("#final-windows-install-command").isVisible());
  assert.equal(await page.locator("#final-windows-install-command").textContent(), "irm https://vcskill.vchun.dev/install.ps1 | iex");
  await page.getByRole("link", { name: "See proof", exact: true }).click();
  assert.equal(new URL(page.url()).hash, "#evidence");
  assert.ok(await page.locator("#evidence").isVisible());
  await page.keyboard.press("Tab");
  assert.notEqual(await page.evaluate(() => document.activeElement), null);
  await page.getByRole("button", { name: "Copy", exact: true }).first().click();
  assert.match(await page.locator("#copy-status").textContent(), /Automatic copy is unavailable/);
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  assert.deepEqual(axe.violations.map((violation) => violation.id), []);
  const missing = await page.goto(`${origin}/missing-page`, { waitUntil: "networkidle" });
  assert.equal(missing?.status(), 404);
  assert.ok(await page.getByRole("heading", { level: 1 }).isVisible());
  await context.close();

  const noScript = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 320, height: 844 } });
  const noScriptPage = await noScript.newPage();
  await noScriptPage.goto(origin, { waitUntil: "networkidle" });
  assert.equal(await noScriptPage.locator("[data-site-section]").count(), 6);
  assert.equal(await noScriptPage.locator("[data-map-node]").count(), 5);
  assert.ok(await noScriptPage.locator("#final-unix-install-command").isVisible());
  assert.ok(await noScriptPage.locator("#final-windows-install-command").isVisible());
  assert.equal(await noScriptPage.locator("[data-copy-target]:visible").count(), 0);
  await noScriptPage.locator("[data-map-node]").first().click();
  assert.equal(new URL(noScriptPage.url()).hash, "#map-state-compile");
  await noScript.close();

  const motionContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "no-preference" });
  const motionPage = await motionContext.newPage();
  await motionPage.goto(origin, { waitUntil: "networkidle" });
  await motionPage.locator("[data-execution-map]").scrollIntoViewIfNeeded();
  await motionPage.waitForFunction(() => document.querySelector("[data-execution-map]")?.getAttribute("data-enhanced") === "true");
  const traversalDuration = await motionPage.evaluate(() => Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--vc-motion-traversal-duration")));
  await motionPage.emulateMedia({ reducedMotion: "reduce" });
  await motionPage.waitForTimeout(Math.max(50, traversalDuration / 3));
  assert.equal(await motionPage.locator("[data-map-node].is-active").count(), 5);
  assert.equal(await motionPage.locator("[data-map-node]").last().getAttribute("aria-current"), "step");
  await motionContext.close();

  process.stdout.write(`${JSON.stringify({ viewports: layouts.length, axeViolations: 0, noScript: true, reducedMotionChange: true, screenshots: ["/tmp/vcskill-site-320.png", "/tmp/vcskill-site-1440.png"] })}\n`);
} finally {
  await browser.close();
  await closeServer(server);
}
