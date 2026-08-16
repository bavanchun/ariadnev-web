// Static output gate: metadata, crawl policy, header policy, and the absence of
// anything that would make the page depend on a server at request time.

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DIST,
  DIST_DIR,
  HTML_404,
  INDEX_HTML,
  REPO_ROOT,
  SITE_ROOT,
  buildOnce,
  inlineStyles,
  parseHeadersFile,
} from "./helpers";

await buildOnce();

const html = readFileSync(INDEX_HTML, "utf8");
const notFound = readFileSync(HTML_404, "utf8");
const files = DIST.files;

describe("build shape", () => {
  it("emits the required physical artifacts", () => {
    for (const file of ["/index.html", "/404.html", "/robots.txt", "/sitemap.xml", "/site.webmanifest", "/_headers", "/social-card.png", "/favicon.svg"]) {
      expect(files, `${file} is missing from dist`).toContain(file);
    }
  });

  it("emits no server bundle or on-demand entry point", () => {
    for (const file of files) {
      expect(file).not.toMatch(/^\/_worker/);
      expect(file).not.toMatch(/entry\.mjs$/);
    }
    expect(files.filter((file) => file.endsWith(".html"))).toEqual(["/404.html", "/index.html"].sort());
  });

  it("generates exactly two documents and neither is a machine route", () => {
    expect(DIST.pages.sort()).toEqual(["/404.html", "/index.html"]);
  });
});

describe("metadata", () => {
  it("declares a canonical URL on the production host", () => {
    expect(html).toContain('<link rel="canonical" href="https://ariadnev.com/">');
    expect(notFound).toContain('<link rel="canonical" href="https://ariadnev.com/404">');
  });

  it("declares language, title, and description", () => {
    expect(html).toMatch(/<html lang="en">/);
    expect(html).toMatch(/<title>[^<]{20,}<\/title>/);
    expect(html).toMatch(/<meta name="description" content="[^"]{60,}">/);
  });

  it("declares complete social metadata with image dimensions", () => {
    for (const tag of [
      'property="og:type" content="website"',
      'property="og:url"',
      'property="og:image" content="https://ariadnev.com/social-card.png"',
      'property="og:image:width" content="1200"',
      'property="og:image:height" content="630"',
      'property="og:image:alt"',
      'name="twitter:card" content="summary_large_image"',
    ]) {
      expect(html, `missing ${tag}`).toContain(tag);
    }
  });

  it("publishes structured data with no unverifiable claim", () => {
    const match = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html);
    expect(match).not.toBeNull();
    const data = JSON.parse(match![1]!) as Record<string, unknown>;
    expect(data["@type"]).toBe("SoftwareApplication");
    expect(data["url"]).toBe("https://ariadnev.com");
    for (const forbidden of ["aggregateRating", "review", "offers", "price", "interactionStatistic"]) {
      expect(data, `structured data must not assert ${forbidden}`).not.toHaveProperty(forbidden);
    }
  });
});

describe("crawl policy", () => {
  const robots = readFileSync(join(DIST_DIR, "robots.txt"), "utf8");
  const sitemap = readFileSync(join(DIST_DIR, "sitemap.xml"), "utf8");

  it("points crawlers at the sitemap and away from machine routes", () => {
    expect(robots).toContain("Sitemap: https://ariadnev.com/sitemap.xml");
    for (const route of ["/install", "/install.sh", "/install.ps1", "/version", "/download/"]) {
      expect(robots).toContain(`Disallow: ${route}`);
    }
  });

  it("keeps the authored sitemap in step with the built route set", () => {
    const listed = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
    // Indexable documents are every generated page except the noindex 404.
    const indexable = DIST.pages
      .filter((page) => page !== "/404.html")
      .map((page) => `https://ariadnev.com${page.replace(/index\.html$/, "")}`);
    expect(listed.sort()).toEqual(indexable.sort());
  });
});

describe("no runtime dependency", () => {
  it("references no third-party origin", () => {
    for (const document of [html, notFound]) {
      const urls = [...document.matchAll(/(?:src|href)="(https?:\/\/[^"]+)"/g)].map((match) => match[1]!);
      for (const url of urls) {
        const { host } = new URL(url);
        expect(
          ["ariadnev.com", "docs.ariadnev.com", "schema.org"].includes(host),
          `unexpected external host: ${url}`,
        ).toBe(true);
      }
      expect(document).not.toMatch(/fonts\.(googleapis|gstatic)\.com/);
    }
  });

  it("fetches nothing at runtime from the one client bundle", () => {
    const scripts = files.filter((file) => file.endsWith(".js"));
    expect(scripts).toHaveLength(1);
    const source = readFileSync(join(DIST_DIR, scripts[0]!.slice(1)), "utf8");
    for (const pattern of [/\bfetch\s*\(/, /XMLHttpRequest/, /new WebSocket/, /import\s*\(/]) {
      expect(source, "the enhancer must not perform network work").not.toMatch(pattern);
    }
  });

  it("self-hosts every font", () => {
    const fonts = files.filter((file) => file.endsWith(".woff2"));
    expect(fonts.length).toBeGreaterThan(0);

    // The stylesheet is inlined, so the `url()` references live in the document
    // rather than in a `.css` file. Scan both, and require that there was
    // actually something to scan — an empty scan is not a passing scan.
    const sheets = [
      ...files.filter((file) => file.endsWith(".css")).map((file) => readFileSync(join(DIST_DIR, file.slice(1)), "utf8")),
      ...inlineStyles(html),
      ...inlineStyles(notFound),
    ];
    expect(sheets.length, "no stylesheet was found to scan").toBeGreaterThan(0);

    let scanned = 0;
    for (const sheet of sheets) {
      for (const url of [...sheet.matchAll(/url\(([^)]+)\)/g)].map((match) => match[1]!)) {
        scanned += 1;
        expect(url).not.toMatch(/^["']?https?:/);
      }
    }
    expect(scanned, "no font url() was found in any stylesheet").toBeGreaterThanOrEqual(fonts.length);
  });
});

describe("header policy", () => {
  const blocks = parseHeadersFile();
  const root = blocks.find((block) => block.pattern === "/*");
  const hashed = blocks.find((block) => block.pattern === "/_astro/*");
  const missing = blocks.find((block) => block.pattern === "/404.html");

  it("declares the approved security headers for every response", () => {
    expect(root).toBeDefined();
    expect(root!.headers["x-content-type-options"]).toBe("nosniff");
    expect(root!.headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(root!.headers["x-frame-options"]).toBe("DENY");
    expect(root!.headers["strict-transport-security"]).toBe("max-age=31536000; includeSubDomains");
    expect(root!.headers["permissions-policy"]).toMatch(/camera=\(\)/);
  });

  it("default-denies in the content security policy", () => {
    const csp = root!.headers["content-security-policy"] ?? "";
    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("base-uri 'none'");
    expect(csp).toContain("form-action 'none'");
    expect(csp).not.toContain("unsafe-inline");
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).not.toMatch(/\*/);
  });

  it("allows exactly the inline stylesheet that is actually shipped", () => {
    const csp = root!.headers["content-security-policy"] ?? "";
    const styles = [...inlineStyles(html), ...inlineStyles(notFound)];
    // `inlineStylesheets: "always"` means every stylesheet edit changes this
    // hash. Without this check a CSS change ships a policy that blocks the
    // whole stylesheet, and the page renders unstyled with a green suite.
    expect(styles.length, "the build is expected to inline its stylesheet").toBeGreaterThan(0);
    for (const style of styles) {
      const hash = `sha256-${createHash("sha256").update(style).digest("base64")}`;
      expect(csp, `_headers is missing the CSP hash for the inlined stylesheet (${hash})`).toContain(hash);
    }
  });

  it("allows exactly the inline structured data that is actually shipped", () => {
    const csp = root!.headers["content-security-policy"] ?? "";
    const inline = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(
      (match) => `sha256-${createHash("sha256").update(match[1]!).digest("base64")}`,
    );
    for (const hash of inline) {
      expect(csp, `_headers is missing the CSP hash for the shipped structured data (${hash})`).toContain(hash);
    }
    // Any other inline script would be blocked in production, so there must be
    // none beyond the JSON-LD block.
    const allInline = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)];
    expect(allInline).toHaveLength(inline.length);
  });

  it("matches the cache policy the combined Worker applies in code", () => {
    // Candidate B generates asset responses itself, so the two declarations
    // must agree or a topology switch would silently change caching.
    const policySource = readFileSync(join(REPO_ROOT, "workers/edge/src/static-response-policy.js"), "utf8");
    const workerPolicy = Object.fromEntries(
      [...policySource.matchAll(/^\s*(html|immutable|notFound):\s*"([^"]+)"/gm)].map((match) => [match[1]!, match[2]!]),
    );

    expect(root!.headers["cache-control"]).toBe(workerPolicy["html"]);
    expect(hashed!.headers["cache-control"]).toBe(workerPolicy["immutable"]);
    expect(missing!.headers["cache-control"]).toBe(workerPolicy["notFound"]);
  });

  it("matches the security headers the combined Worker applies in code", () => {
    const policySource = readFileSync(join(REPO_ROOT, "workers/edge/src/static-response-policy.js"), "utf8");
    const workerHeaders = Object.fromEntries(
      [...policySource.matchAll(/^\s*"([a-z-]+)":\s*"([^"]+)"/gm)].map((match) => [match[1]!, match[2]!]),
    );
    expect(Object.keys(workerHeaders).length, "no header was parsed out of the Worker policy").toBeGreaterThan(0);

    for (const [name, value] of Object.entries(workerHeaders)) {
      expect(root!.headers[name], `${name} differs between _headers and the Worker policy`).toBe(value);
    }
  });

  it("pins exactly which declared headers the combined Worker does not yet apply", () => {
    // Checking only that the Worker's headers appear in `_headers` is the wrong
    // direction: it cannot see a header this file declares and the Worker never
    // sends. Under the selected Candidate B topology `run_worker_first = true`,
    // and Cloudflare does not apply `_headers` to Worker-generated responses, so
    // anything missing from the Worker policy is simply absent in production.
    //
    // These two are known gaps owned by Phase 3, recorded here so they stay
    // visible and so closing one fails this test until the list is updated.
    const KNOWN_GAPS = ["content-security-policy", "permissions-policy"];

    const policySource = readFileSync(join(REPO_ROOT, "workers/edge/src/static-response-policy.js"), "utf8");
    const workerHeaders = new Set(
      [...policySource.matchAll(/^\s*"([a-z-]+)":\s*"([^"]+)"/gm)].map((match) => match[1]!),
    );
    const declaredOnly = Object.keys(root!.headers)
      .filter((name) => name !== "cache-control" && !workerHeaders.has(name))
      .sort();

    expect(
      declaredOnly,
      "a header is declared here but not applied by the combined Worker; either implement it in the Worker policy (Phase 3) or record it as a known gap",
    ).toEqual([...KNOWN_GAPS].sort());
  });
});

describe("deployment wiring", () => {
  const topology = JSON.parse(readFileSync(join(REPO_ROOT, "deployment", "topology.json"), "utf8")) as {
    units: { id: string; output: string; wranglerConfig: unknown }[];
  };
  const wrangler = readFileSync(join(SITE_ROOT, "wrangler.toml"), "utf8");

  it("declares the exact directory Astro writes", () => {
    expect(wrangler).toMatch(/directory = "dist"/);
    const edge = topology.units.find((unit) => unit.id === "edge");
    expect(edge?.output).toBe("apps/site/dist");
  });

  it("carries no account identifier, zone identifier, or secret", () => {
    expect(wrangler).not.toMatch(/account_id|zone_id|[0-9a-f]{32}|token|secret\s*=/i);
  });

  it("serves a physical 404 rather than a single-page-app fallback", () => {
    expect(wrangler).toContain('not_found_handling = "404-page"');
    expect(wrangler).not.toContain("single-page-application");
  });
});
