// Lighthouse runner for the Phase 7 visual harness.
//
// Runs against the production output already served by the visual
// static server (tests/visual/lib/serve.mjs). Not wired into
// test:qualification per commit — Lighthouse takes ~30s per page and
// depends on host CPU load, so it lives here as an on-demand /
// scheduled check. CI schedules it separately.
//
// Usage:
//   node tests/visual/lib/serve.mjs &          # start servers
//   node tests/visual/lighthouse.mjs           # score both surfaces
//
// Exits non-zero if accessibility < 95 on any audited route.

import lighthouse from "lighthouse";
import * as chromeLauncher from "chrome-launcher";
import { SITE, DOCS } from "./lib/servers.mjs";
// The lighthouse binary is a direct dev dep (see package.json).

const ROUTES = [
  { name: "M01 marketing home", url: `http://127.0.0.1:${SITE.port}/` },
  { name: "D01-vi docs home", url: `http://127.0.0.1:${DOCS.port}/vi/stable/` },
  {
    name: "D06 graph execution",
    url: `http://127.0.0.1:${DOCS.port}/en/stable/concepts/graph-execution/`,
  },
  {
    name: "D12 CLI index",
    url: `http://127.0.0.1:${DOCS.port}/en/stable/reference/cli/`,
  },
  {
    name: "D14 provider reference",
    url: `http://127.0.0.1:${DOCS.port}/en/stable/reference/providers/`,
  },
  {
    // Lighthouse does not score non-2xx documents. Audit the exact generated
    // recovery artifact here; the critical journey separately proves that an
    // unknown public URL serves this artifact with a real 404 response.
    name: "D18 docs recovery artifact",
    url: `http://127.0.0.1:${DOCS.port}/404.html`,
  },
];

const ACCESSIBILITY_MIN = 95;

async function runOne(chrome, route) {
  const result = await lighthouse(route.url, {
    port: chrome.port,
    output: "json",
    logLevel: "error",
    onlyCategories: ["performance", "accessibility", "best-practices", "seo"],
    formFactor: "desktop",
    screenEmulation: { mobile: false, width: 1440, height: 900, deviceScaleFactor: 1, disabled: false },
    throttlingMethod: "provided",
  });
  const categories = result.lhr.categories;
  return {
    route: route.name,
    url: route.url,
    performance: Math.round((categories.performance?.score ?? 0) * 100),
    accessibility: Math.round((categories.accessibility?.score ?? 0) * 100),
    bestPractices: Math.round((categories["best-practices"]?.score ?? 0) * 100),
    seo: Math.round((categories.seo?.score ?? 0) * 100),
  };
}

const chrome = await chromeLauncher.launch({
  chromeFlags: ["--headless=new", "--disable-gpu", "--no-sandbox"],
});

try {
  const scores = [];
  for (const route of ROUTES) {
    process.stdout.write(`Auditing ${route.name}…\n`);
    scores.push(await runOne(chrome, route));
  }
  process.stdout.write(`\n${JSON.stringify(scores, null, 2)}\n`);
  const failures = scores.filter((s) => s.accessibility < ACCESSIBILITY_MIN);
  if (failures.length > 0) {
    process.stderr.write(
      `\nFAIL: accessibility below ${ACCESSIBILITY_MIN}:\n${failures
        .map((f) => `  ${f.route}: ${f.accessibility}`)
        .join("\n")}\n`,
    );
    process.exit(1);
  }
  process.stdout.write(`\nAll ${scores.length} routes ≥ ${ACCESSIBILITY_MIN} accessibility.\n`);
} finally {
  await chrome.kill();
}
