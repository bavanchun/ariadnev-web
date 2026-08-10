// Pre-Lighthouse budget gate.
//
// Cheap, deterministic, and run on every change, so a regression is caught here
// rather than in the throttled benchmark suite that Phase 11 owns. The caps are
// read from tests/benchmarks/performance-budgets.json — this file never
// restates a threshold, so it cannot disagree with the frozen contract.

import { gzipSync } from "node:zlib";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DIST, DIST_DIR, REPO_ROOT, buildOnce, inlineStyles } from "./helpers";

await buildOnce();

interface Budget {
  readonly id: string;
  readonly cap: number;
}

const budgets = (
  JSON.parse(readFileSync(join(REPO_ROOT, "tests/benchmarks/performance-budgets.json"), "utf8")) as { budgets: Budget[] }
).budgets;

const capOf = (id: string): number => {
  const budget = budgets.find((entry) => entry.id === id);
  if (budget === undefined) throw new Error(`no frozen budget named ${id}`);
  return budget.cap;
};

const files = DIST.files;
const bytesOf = (file: string): number => statSync(join(DIST_DIR, file.slice(1))).size;
/** Fonts, images, and hashed assets ship pre-compressed or incompressible. */
const compressedBytesOf = (file: string): number =>
  /\.(woff2|png|jpg|webp|avif)$/.test(file) ? bytesOf(file) : gzipSync(readFileSync(join(DIST_DIR, file.slice(1)))).byteLength;

const totalFor = (predicate: (file: string) => boolean): number =>
  files.filter(predicate).reduce((sum, file) => sum + compressedBytesOf(file), 0);

describe("client JavaScript", () => {
  const scripts = files.filter((file) => file.endsWith(".js"));

  it("ships exactly one bundle", () => {
    expect(scripts, "the graph enhancer is the whole client budget").toHaveLength(1);
  });

  it("stays inside the frozen JavaScript budget", () => {
    expect(totalFor((file) => file.endsWith(".js"))).toBeLessThanOrEqual(capOf("marketing-js-compressed"));
  });

  it("declares no additional island", () => {
    const html = readFileSync(join(DIST_DIR, "index.html"), "utf8");
    const moduleScripts = [...html.matchAll(/<script[^>]*type="module"[^>]*>/g)];
    expect(moduleScripts).toHaveLength(1);
    expect(html).not.toContain("astro-island");
  });
});

describe("transfer budgets", () => {
  it("stays inside the CSS budget", () => {
    // The stylesheet is inlined, so summing `.css` files would sum nothing and
    // the cap could never be reached. Measure the inlined blocks instead, and
    // require that some CSS was actually measured.
    const indexHtml = readFileSync(join(DIST_DIR, "index.html"), "utf8");
    const styles = inlineStyles(indexHtml);
    expect(styles.length, "no stylesheet was found to measure").toBeGreaterThan(0);

    const cssBytes =
      styles.reduce((sum, style) => sum + gzipSync(Buffer.from(style)).byteLength, 0) +
      totalFor((file) => file.endsWith(".css"));
    expect(cssBytes).toBeGreaterThan(0);
    expect(cssBytes).toBeLessThanOrEqual(capOf("marketing-css-compressed"));
  });

  it("stays inside the font budget", () => {
    expect(totalFor((file) => file.endsWith(".woff2"))).toBeLessThanOrEqual(capOf("marketing-fonts-compressed"));
  });

  it("stays inside the image budget", () => {
    expect(totalFor((file) => /\.(png|jpg|webp|avif|svg)$/.test(file))).toBeLessThanOrEqual(
      capOf("marketing-images-compressed"),
    );
  });

  it("stays inside the total transfer budget for a first load", () => {
    // A first load pulls the document, the stylesheet, the enhancer, the fonts,
    // and the favicon. The social card is fetched by crawlers, not by readers.
    const firstLoad = totalFor((file) => /\.(html|css|js|woff2)$/.test(file) && file !== "/404.html") + compressedBytesOf("/favicon.svg");
    expect(firstLoad).toBeLessThanOrEqual(capOf("marketing-total-transfer-compressed"));
  });
});

describe("request count", () => {
  it("keeps the render-blocking request set small", () => {
    const html = readFileSync(join(DIST_DIR, "index.html"), "utf8");
    // Inlined CSS plus at most one linked stylesheet. Counting only `<link>`
    // elements would always find zero and prove nothing, so the inline blocks
    // are counted as part of the same budget.
    const linked = [...html.matchAll(/<link[^>]+rel="stylesheet"/g)].length;
    const inlined = inlineStyles(html).length;
    expect(linked + inlined, "one stylesheet keeps the critical path short").toBeLessThanOrEqual(1);
    expect(inlined + linked, "the page must ship a stylesheet").toBeGreaterThan(0);
  });

  it("inlines nothing large into the document", () => {
    const bytes = bytesOf("/index.html");
    expect(bytes, "a large document means content was inlined that should be cached separately").toBeLessThan(60_000);
  });
});
