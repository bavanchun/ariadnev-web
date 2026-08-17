import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const app = new URL("../../apps/docs/", import.meta.url);

test("chooser, navigation, search, and copy controls expose static and accessible fallbacks", async () => {
  const chooser = await readFile(new URL("src/components/language-chooser.tsx", app), "utf8");
  assert.match(chooser, /href="\/en\/stable\/"/);
  assert.match(chooser, /href="\/vi\/stable\/"/);
  assert.doesNotMatch(chooser, /use client|router|cookie/i);

  const shell = await readFile(new URL("src/components/docs-shell.tsx", app), "utf8");
  for (const label of ["Breadcrumb", "Documentation pages", "On this page"]) assert.match(shell, new RegExp(label));
  assert.match(shell, /skip-link/);
  assert.match(shell, /lang=\{page\.locale\}/);

  const switchers = await readFile(new URL("src/components/locale-version-switcher.tsx", app), "utf8");
  assert.match(switchers, /aria-label=\{`Language: \$\{localeLabel\}`\}>Language · \{page\.locale\.toUpperCase\(\)\}<\/summary>/);
  assert.match(switchers, /aria-label=\{`Version: \$\{versionLabel\}`\}>Version · \{resolvedVersion\}<\/summary>/);
  assert.match(switchers, /role="menuitem"/);
  assert.match(switchers, /aria-label=\{accessibleLabel\}/);
  assert.match(switchers, /"Previous stable"/);

  const search = await readFile(new URL("src/components/search-dialog.tsx", app), "utf8");
  assert.match(search, /<dialog/);
  assert.match(search, /aria-live="polite"/);
  assert.match(search, /metaKey\s*\|\|\s*event\.ctrlKey/);
  assert.match(search, /event\.key === "\/"/);
  assert.match(search, /pendingResultAction/);
  assert.match(search, /resultsQuery/);
  assert.match(search, /query: inputQuery/);
  assert.match(search, /partitionPromise/);
  assert.match(search, /ArrowDown/);
  assert.match(search, /window\.location\.assign/);
  assert.match(search, /static sidebar/i);

  const copy = await readFile(new URL("src/components/copy-actions.tsx", app), "utf8");
  assert.match(copy, /<textarea/);
  assert.match(copy, /hidden=\{!source\}/);
  assert.match(copy, /Open Markdown source/);
  assert.match(copy, /\.select\(\)/);
  assert.match(copy, /role="status"/);
  assert.match(copy, /label="Copy Markdown"/);
  assert.match(copy, /fetch\(sourceUrl/);

  const documentCopy = await readFile(new URL("src/components/document-copy-enhancer.tsx", app), "utf8");
  assert.match(documentCopy, /querySelectorAll\("pre"\)/);
  assert.match(documentCopy, /h2\[id\].*h6\[id\]/);
  assert.match(documentCopy, /Copy code block/);
  assert.match(documentCopy, /aria-live="polite"/);
  // Keyboard reachability for horizontal-scroll regions: pre + table each
  // get tabindex=0 when they actually overflow (not unconditionally).
  assert.match(documentCopy, /querySelectorAll\("table"\)/);
  assert.match(documentCopy, /scrollWidth\s*>\s*\.?\w*\.?clientWidth/);
  assert.match(documentCopy, /setAttribute\("tabindex",\s*"0"\)/);
});

test("styles enforce touch targets, focus, reduced motion, and responsive overflow containment", async () => {
  const css = await readFile(new URL("src/styles/docs.css", app), "utf8");
  assert.match(css, /min-height:\s*var\(--vc-size-control-minimum\)/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /--vc-color-focus-contrast/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  // No body overflow-x mask — wide content contains locally.
  assert.doesNotMatch(css, /^body\s*\{[^}]*overflow-x:\s*hidden/m);
  // Local scroll containment for pre + table.
  assert.match(css, /\.docs-body pre\s*\{[^}]*overflow-x:\s*auto/);
  assert.match(css, /\.docs-body table\s*\{[^}]*overflow-x:\s*auto/);
  assert.match(css, /overflow-wrap:\s*break-word/);
  assert.match(css, /@media \(max-width:\s*48rem\)/);
  assert.match(css, /\.docs-toc\s*\{\s*border-inline-start:/);
  assert.match(css, /\.docs-mobile-toc\s*\{\s*display:\s*none/);
  assert.match(css, /@media \(max-width:\s*48rem\)[\s\S]*\.docs-toc\s*\{\s*display:\s*none;\s*\}[\s\S]*\.docs-mobile-toc\s*\{\s*display:\s*block/);
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b/i);
  assert.match(css, /\.prose h1, \.prose h2[\s\S]*--vc-font-family-display/);
  assert.match(css, /\.heading-copy-button[\s\S]*border-color:\s*transparent/);
});

test("headers and robots cover HTML, Markdown, search, LLM, assets, and static 404", async () => {
  const headers = await readFile(new URL("public/_headers", app), "utf8");
  for (const pattern of ["/*", "/_next/static/*", "/*.md", "/search/*", "/llms.txt", "/llms-full.txt", "/404.html"]) assert.ok(headers.includes(pattern));
  assert.match(headers, /Content-Security-Policy:/);
  assert.match(headers, /max-age=31536000, immutable/);
  assert.match(headers, /max-age=0, must-revalidate/);
  assert.equal(await readFile(new URL("public/robots.txt", app), "utf8"), "User-agent: *\nAllow: /\n");
});
