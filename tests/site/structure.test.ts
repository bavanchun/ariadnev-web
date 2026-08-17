// Marketing structure gate.
//
// These tests read the built HTML rather than the source components, because
// the contract is what a reader and a crawler actually receive.
//
// Note on file extension: the phase inventory names these suites `.test.mjs`,
// but the root `vitest.config.ts` excludes `.mjs` and routes those files to the
// native runner via an explicit list in the root `package.json`. That manifest
// is Phase 4-owned and must stay byte-identical, so these suites are `.test.ts`
// and are discovered automatically instead.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DIST, HTML_404, INDEX_HTML, SITE_ROOT, buildOnce, textOf } from "./helpers";
import { PROTECTED_ROUTES } from "../../apps/site/src/data/marketing-facts";

await buildOnce();

const html = readFileSync(INDEX_HTML, "utf8");
const notFound = readFileSync(HTML_404, "utf8");

/** Top-level sections of `<main>`, in document order. */
const sectionIds = [...html.matchAll(/<section\b[^>]*\bid="([^"]+)"/g)].map((match) => match[1]);

describe("information architecture", () => {
  it("renders exactly the five approved macro sections in order", () => {
    // Workflows and providers are article subregions inside the
    // authority-boundary macro; they are asserted separately below.
    expect(sectionIds).toEqual([
      "promise",
      "execution-map",
      "authority-boundary",
      "evidence",
      "install",
    ]);
  });

  it("keeps workflow and provider as distinct subregions inside authority-boundary", () => {
    const authority = html.slice(
      html.indexOf('id="authority-boundary"'),
      html.indexOf("</section>", html.indexOf('id="authority-boundary"')),
    );
    expect(authority).toMatch(/<article[^>]*\bid="workflows"/);
    expect(authority).toMatch(/<article[^>]*\bid="providers"/);
  });

  it("has exactly one h1", () => {
    const headings = html.match(/<h1\b/g) ?? [];
    expect(headings).toHaveLength(1);
  });

  it("gives every section an accessible name", () => {
    const sections = [...html.matchAll(/<section\b[^>]*>/g)].map((match) => match[0]);
    for (const section of sections) {
      expect(section, `section without aria-labelledby: ${section}`).toMatch(/aria-labelledby="/);
    }
  });

  it("keeps the promise to exactly three lines under one stable heading", () => {
    expect(html).toContain("Agent work you can route, gate, and prove.");
    // Scoped to the promise list, not the whole document: evidence rows and
    // provider items are long list items too, and counting those instead would
    // pass whether the promise had two lines or five.
    const list = /<ul class="promise__lines">([\s\S]*?)<\/ul>/.exec(html);
    expect(list, "the promise list is missing").not.toBeNull();
    expect([...list![1]!.matchAll(/<li>/g)]).toHaveLength(3);
  });
});

describe("calls to action", () => {
  it("exposes install and docs from the header, within one interaction", () => {
    const header = html.slice(html.indexOf("<header"), html.indexOf("</header>"));
    expect(header).toContain('href="#install"');
    expect(header).toContain("https://docs.ariadnev.com/en/stable/");
  });

  it("shows a literal install command in the first section", () => {
    const promise = html.slice(0, html.indexOf('id="execution-map"'));
    expect(promise).toContain("curl -fsSL https://ariadnev.com/install | bash");
  });

  it("offers both platform commands at the final action", () => {
    expect(html).toContain("irm https://ariadnev.com/install.ps1 | iex");
  });
});

describe("canonical workflows", () => {
  const identifiers = ["safe-change-delivery", "bugfix-delivery", "read-only-delivery"];

  it("names exactly the three canonical workflows", () => {
    for (const id of identifiers) expect(html).toContain(`<code>${id}</code>`);
    const rendered = [...html.matchAll(/<code>([a-z-]+-delivery)<\/code>/g)].map((match) => match[1]);
    expect(new Set(rendered)).toEqual(new Set(identifiers));
  });

  it("describes authority, gate, and recovery for each workflow", () => {
    expect((html.match(/>Authority</g) ?? []).length).toBe(3);
    expect((html.match(/>Gate — held for a human</g) ?? []).length).toBe(3);
    expect((html.match(/>Recovery</g) ?? []).length).toBe(3);
  });
});

describe("prohibited content", () => {
  const text = textOf(html);

  it("states no mutable inventory count", () => {
    // "26 skills", "13 agents", "6 hooks" and friends go stale on the next
    // release. Counts belong in generated documentation.
    expect(text).not.toMatch(/\b\d+\s+(skills|agents|hooks|commands|workflows|providers)\b/i);
  });

  it("reproduces no exhaustive provider capability matrix", () => {
    expect(html).not.toMatch(/<table\b/);
    expect(text).not.toContain(".claude/skills/");
    expect(text).not.toContain("~/.codex/agents/");
  });

  it("invents no social proof", () => {
    for (const pattern of [/testimonial/i, /trusted by/i, /\bstars?\b/i, /\bcustomers?\b/i, /\d+[km]\+? (users|downloads|installs)/i]) {
      expect(text).not.toMatch(pattern);
    }
  });

  it("asserts no unverifiable performance or safety ranking", () => {
    for (const pattern of [/fastest/i, /\bx faster\b/i, /100% (safe|secure|reliable)/i, /enterprise-grade/i]) {
      expect(text).not.toMatch(pattern);
    }
  });
});

describe("style discipline", () => {
  const css = readFileSync(`${SITE_ROOT}/src/styles/site.css`, "utf8");
  // Strip comments before scanning; the header comment names the anti-patterns.
  const code = css.replace(/\/\*[\s\S]*?\*\//g, "");

  it("declares no literal colour outside the token layer", () => {
    // The print block is the single exception: paper is white and ink is black,
    // and neither is a brand colour the token palette should own.
    const printBlock = code.slice(code.indexOf("@media print"));
    const scanned = code.slice(0, code.indexOf("@media print"));
    expect(scanned).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(scanned).not.toMatch(/\b(rgb|hsl|oklch|lab)a?\(/);
    expect(printBlock).toMatch(/#fff/);
  });

  it("declares no font stack of its own", () => {
    const values = [...code.matchAll(/font-family:([^;]+);/g)].map((match) => match[1]!.trim());
    for (const value of values) {
      expect(value, "every font family must come from a token").toMatch(/^var\(--vcs-font-family-/);
    }
  });

  it("uses no gradient, glass, orb, or broad shadow", () => {
    for (const pattern of [/gradient\(/, /backdrop-filter/, /box-shadow:\s*(?!none)/, /filter:\s*blur/]) {
      expect(code).not.toMatch(pattern);
    }
  });

  it("uses no second motion scale", () => {
    const durations = [...code.matchAll(/(?:transition|animation)[^;]*?(\d+m?s)\b/g)];
    expect(durations, "durations must come from --vcs-motion-duration-*").toEqual([]);
  });
});

describe("404 page", () => {
  it("is a real branded recovery page and is not indexed", () => {
    expect(notFound).toContain("This path does not exist");
    expect(notFound).toContain('name="robots" content="noindex, follow"');
    expect(notFound).toContain('href="/"');
  });

  it("never claims the path succeeded", () => {
    expect(textOf(notFound)).not.toMatch(/redirecting|taking you back/i);
  });
});

describe("protected machine routes", () => {
  it("generates no page at any protected path", () => {
    const generated = new Set([...DIST.pages]);
    expect(PROTECTED_ROUTES.length).toBeGreaterThan(0);
    for (const route of PROTECTED_ROUTES) {
      expect(generated.has(route), `${route} must never be produced by the static build`).toBe(false);
      expect(generated.has(`${route}.html`)).toBe(false);
    }
  });
});
