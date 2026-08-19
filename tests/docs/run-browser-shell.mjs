import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { dirname, extname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import AxeBuilder from "@axe-core/playwright";
import { chromium } from "@playwright/test";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const outRoot = resolve(repositoryRoot, "apps/docs/out");
const port = 4327;
const origin = `http://127.0.0.1:${port}`;
const installationRoute = "/en/stable/get-started/installation/";
const viewports = [320, 375, 390, 768, 1280, 1440];

const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"], [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"], [".json", "application/json; charset=utf-8"],
  [".md", "text/markdown; charset=utf-8"], [".svg", "image/svg+xml"],
  [".txt", "text/plain; charset=utf-8"], [".woff2", "font/woff2"],
]);

function inside(root, candidate) {
  const path = relative(root, candidate);
  return path !== ".." && !path.startsWith(`..${sep}`);
}

async function startStaticServer() {
  const server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url ?? "/", origin).pathname);
      let target = resolve(outRoot, pathname.replace(/^\/+/, ""));
      if (pathname.endsWith("/")) target = resolve(target, "index.html");
      let statusCode = 200;
      let info = inside(outRoot, target) ? await stat(target).catch(() => undefined) : undefined;
      if (info?.isDirectory()) {
        target = resolve(target, "index.html");
        info = await stat(target).catch(() => undefined);
      }
      if (!info?.isFile()) {
        target = resolve(outRoot, "404.html");
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
  const page = await context.newPage();
  const consoleErrors = [];
  const externalRequests = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  page.on("request", (request) => { if (new URL(request.url()).origin !== origin) externalRequests.push(request.url()); });
  const response = await page.goto(`${origin}${installationRoute}`, { waitUntil: "networkidle" });
  assert.equal(response?.status(), 200);
  await page.evaluate(() => document.fonts.ready);
  assert.equal(await page.locator("html").getAttribute("lang"), "en");
  assert.equal(await page.locator("h1").count(), 1);
  // Keep this boundary aligned with docs.css and MobileDrawerEnhancer: the
  // mobile drawer/TOC mode ends at 45rem (720px), so 768px is the tablet
  // workbench with the persistent TOC.
  const mobile = width <= 720;
  assert.ok(await page.locator(mobile ? ".docs-mobile-toc" : ".docs-toc").isVisible(), `${width}px hides the page TOC`);
  assert.equal(await page.locator(mobile ? ".docs-toc" : ".docs-mobile-toc").isVisible(), false, `${width}px exposes duplicate TOCs`);
  const layout = await page.evaluate(() => {
    const bodyStyle = getComputedStyle(document.body);
    const heading = document.querySelector(".prose h1");
    const headingStyle = heading ? getComputedStyle(heading) : undefined;
    const docsBody = document.querySelector(".docs-body");
    const copyActions = document.querySelector(".page-copy-actions");
    const docsHeader = document.querySelector(".docs-header");
    const docsSidebar = document.querySelector(".docs-sidebar");
    const isInsideHorizontalScroller = (element) => {
      for (let ancestor = element.parentElement; ancestor && ancestor !== document.body; ancestor = ancestor.parentElement) {
        const overflowX = getComputedStyle(ancestor).overflowX;
        if ((overflowX === "auto" || overflowX === "scroll") && ancestor.scrollWidth > ancestor.clientWidth) return true;
      }
      return false;
    };
    const overflow = [...document.body.querySelectorAll("*")].filter((element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none"
        && style.visibility !== "hidden"
        && rect.width > 1
        && (rect.left < -1 || rect.right > innerWidth + 1)
        && !isInsideHorizontalScroller(element);
    }).slice(0, 8).map((element) => `${element.tagName.toLowerCase()}.${element.className}`);
    const targets = ".docs-header a, .docs-header button, .docs-header summary, .docs-sidebar a, .docs-toc a, .breadcrumb a, .page-copy-actions button, .copy-source-link, .search-control li a";
    const undersized = [...document.querySelectorAll(targets)].filter((element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0 && (rect.width < 43.5 || rect.height < 43.5);
    }).slice(0, 8).map((element) => `${element.tagName.toLowerCase()}.${element.className}`);
    return {
      overflow,
      undersized,
      scrollWidth: document.documentElement.scrollWidth,
      viewport: innerWidth,
      bodyFontFamily: bodyStyle.fontFamily,
      headingFontFamily: headingStyle?.fontFamily ?? "",
      docsBodyTop: docsBody?.getBoundingClientRect().top ?? Number.POSITIVE_INFINITY,
      copyActionsTop: copyActions?.getBoundingClientRect().top ?? Number.NEGATIVE_INFINITY,
      headerHeight: docsHeader?.getBoundingClientRect().height ?? Number.POSITIVE_INFINITY,
      sidebarHeight: docsSidebar?.getBoundingClientRect().height ?? Number.POSITIVE_INFINITY,
    };
  });
  assert.ok(layout.scrollWidth <= layout.viewport, `${width}px document overflows horizontally`);
  assert.deepEqual(layout.overflow, [], `${width}px has out-of-viewport elements`);
  assert.deepEqual(layout.undersized, [], `${width}px has undersized navigation targets`);
  assert.notEqual(layout.headingFontFamily, layout.bodyFontFamily, `${width}px docs headings do not use the display face`);
  assert.ok(layout.docsBodyTop < layout.copyActionsTop, `${width}px copy actions precede the document body`);
  if (mobile) {
    assert.ok(layout.docsBodyTop < 620, `${width}px document content starts too far below the viewport (${layout.docsBodyTop}px)`);
    assert.ok(layout.headerHeight <= 120, `${width}px docs header is too tall (${layout.headerHeight}px)`);
    assert.ok(layout.sidebarHeight <= 68, `${width}px mobile sidebar is too tall (${layout.sidebarHeight}px)`);
  }
  assert.equal(consoleErrors.length, 0, `${width}px console errors: ${consoleErrors.join(" | ")}`);
  assert.deepEqual(externalRequests, [], `${width}px made external runtime requests`);
  if (width === 320 || width === 1440) await page.screenshot({ path: `/tmp/ariadnev-docs-${width}.png`, fullPage: true });
  await context.close();
  return layout;
}

await stat(resolve(outRoot, "en/stable/get-started/installation/index.html")).catch(() => {
  throw new Error("run tests/docs/run-temporary-export.mjs before the browser shell gate");
});
const server = await startStaticServer();
const browser = await chromium.launch({ headless: true });
try {
  const layouts = [];
  for (const width of viewports) layouts.push(await inspectViewport(browser, width));

  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(() => Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined }));
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  await page.route("**/search/en/stable.json", async (route) => {
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 150));
    await route.continue();
  });
  await page.goto(`${origin}/en/stable/`, { waitUntil: "networkidle" });
  await page.keyboard.press("/");
  assert.ok(await page.getByRole("dialog").isVisible());
  const searchInput = page.getByRole("searchbox");
  await searchInput.fill("not-a-published-page");
  await page.keyboard.press("Enter");
  await searchInput.fill("installation");
  await page.getByRole("link", { name: "Installation", exact: true }).waitFor();
  await page.waitForTimeout(200);
  assert.equal(page.url(), `${origin}/en/stable/`);
  await searchInput.fill("");
  await page.keyboard.type("installation");
  await page.keyboard.press("ArrowDown");
  const selected = page.waitForURL(`${origin}${installationRoute}`, { timeout: 10_000 });
  await page.keyboard.press("Enter");
  await selected;
  assert.equal(page.url(), `${origin}${installationRoute}`);

  await page.getByRole("button", { name: /^Language:/ }).click();
  await page.getByRole("menuitem", { name: "Tiếng Việt", exact: true }).click();
  await page.waitForURL(`${origin}/vi/stable/get-started/installation/`);
  assert.equal(await page.locator("html").getAttribute("lang"), "vi");
  await page.getByRole("button", { name: /^Phiên bản:/ }).click();
  await page.getByRole("menuitem", { name: "Current 1.1.0", exact: true }).click();
  await page.waitForURL(`${origin}/vi/1.1.0/get-started/installation/`);

  await page.getByRole("button", { name: "Copy Markdown", exact: true }).click();
  const markdownFallback = page.getByLabel("Markdown source");
  await page.waitForFunction(() => [...document.querySelectorAll("textarea")].some((element) => element.labels?.[0]?.textContent === "Markdown source" && element.value.startsWith("# ")));
  assert.match(await markdownFallback.inputValue(), /^# Cài đặt/m);
  assert.match(await page.getByRole("status").filter({ hasText: "Clipboard unavailable" }).textContent(), /selected for manual copy/);
  assert.equal(consoleErrors.length, 0, `docs interaction console errors: ${consoleErrors.join(" | ")}`);
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  assert.deepEqual(axe.violations.map((violation) => violation.id), []);
  const missing = await page.goto(`${origin}/en/stable/not-declared/`, { waitUntil: "networkidle" });
  assert.equal(missing?.status(), 404);
  await context.close();

  const copySuccess = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await copySuccess.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: async (value) => { window.__ariadnevCopiedText = value; } },
    });
  });
  const copySuccessPage = await copySuccess.newPage();
  await copySuccessPage.goto(`${origin}${installationRoute}`, { waitUntil: "networkidle" });
  await copySuccessPage.getByRole("button", { name: "Copy link to macOS and Linux", exact: true }).click();
  assert.equal(await copySuccessPage.getByLabel("Selected copy source").inputValue(), "");
  assert.equal(await copySuccessPage.getByLabel("Selected copy source").isHidden(), true);
  assert.match(await copySuccessPage.getByRole("status").filter({ hasText: "Heading link copied" }).textContent(), /Heading link copied/);
  assert.match(await copySuccessPage.evaluate(() => window.__ariadnevCopiedText), /#macos-and-linux$/);
  const headingButtonStyle = await copySuccessPage.getByRole("button", { name: "Copy link to macOS and Linux", exact: true }).evaluate((button) => {
    const style = getComputedStyle(button);
    return { backgroundColor: style.backgroundColor, borderColor: style.borderTopColor };
  });
  assert.equal(headingButtonStyle.backgroundColor, "rgba(0, 0, 0, 0)");
  assert.equal(headingButtonStyle.borderColor, "rgba(0, 0, 0, 0)");
  await copySuccess.close();

  const noScript = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 320, height: 844 } });
  const noScriptPage = await noScript.newPage();
  await noScriptPage.goto(`${origin}${installationRoute}`, { waitUntil: "networkidle" });
  assert.equal(await noScriptPage.locator("h1").count(), 1);
  await noScriptPage.getByRole("button", { name: /^Language:/ }).click();
  await noScriptPage.getByRole("menuitem", { name: "Tiếng Việt", exact: true }).click();
  await noScriptPage.waitForURL(`${origin}/vi/stable/get-started/installation/`);
  assert.equal(await noScriptPage.locator("html").getAttribute("lang"), "vi");
  await noScript.close();

  process.stdout.write(`${JSON.stringify({ viewports: layouts.length, searchMatrix: true, localeVersionMatrix: true, axeViolations: 0, noScript: true, screenshots: ["/tmp/ariadnev-docs-320.png", "/tmp/ariadnev-docs-1440.png"] })}\n`);
} finally {
  await browser.close();
  await closeServer(server);
}
