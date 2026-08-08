import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(root, "landing.html"), "utf8");

function siteData() {
  const start = html.indexOf("// SITE_DATA_START");
  const end = html.indexOf("// SITE_DATA_END");
  assert.notEqual(start, -1, "SITE data start marker is missing");
  assert.notEqual(end, -1, "SITE data end marker is missing");
  const context = {};
  vm.runInNewContext(html.slice(start, end), context);
  return context.SITE;
}

test("landing has one valid document boundary and no test debris", () => {
  const closes = [...html.matchAll(/<\/html>/gi)];
  assert.equal(closes.length, 1);
  assert.equal(html.slice(closes[0].index + closes[0][0].length).trim(), "");
  assert.doesNotMatch(html, /hello world/i);
});

test("SITE is the released inventory source of truth", () => {
  const site = siteData();
  assert.equal(site.release, "0.11.0");
  assert.deepEqual(
    JSON.parse(JSON.stringify(site.stats)),
    { skills: 26, agents: 13, hooks: 6, targets: 6 },
  );
  assert.equal(site.providers.length, 6);
  assert.equal(site.commands.length, 15);
  assert.deepEqual(
    Array.from(site.commands, (command) => command.name),
    [
      "install", "run", "doctor", "eval", "coverage", "query", "contract", "update",
      "validate", "list", "backups", "telemetry", "add-skill", "uninstall", "migrate",
    ],
  );

  const skills = site.lanes.flatMap((lane) => Array.from(lane.skills, (skill) => skill[0]));
  assert.equal(skills.length, 26);
  assert.equal(new Set(skills).size, 26);
  assert.deepEqual(
    JSON.parse(JSON.stringify(site.proof)),
    {
      behavioral: { skillsPassed: 26, skillsTotal: 26, goldenTasks: 14 },
      static: {
        claimCoverage: { passed: 8, total: 8 },
        provenance: { pinned: 25, original: 1 },
      },
      graph: { workflows: 3, canonicalNodes: 7, canonicalEdges: 12 },
      recovery: { passed: true, duplicateEffects: 0 },
      performance: { p95NodeBudgetMs: 200, passed: true },
      context: { retrievalGainPoints: 26.7656, taskSuccessGainPoints: 38.4615, tokenDelta: 0 },
      runtime: { adapters: 2, evidence: "pinned-capability-gated" },
      release: { binaries: 5, checksums: true },
    },
  );
});

test("released copy is scoped honestly and includes the proof boundary", () => {
  assert.match(html, /standalone CLI[^<]*needs no Node/i);
  assert.match(html, /Claude Code hooks[^<]*Node/i);
  assert.match(html, /14 golden tasks/i);
  assert.match(html, /Graph lint is static/i);
  assert.match(html, /deterministic fixtures/i);
  assert.match(html, /live-provider evidence is pinned/i);
  assert.match(html, /Public execution is read-only/i);
  assert.match(html, /workspace-changing execution remains policy-denied/i);
  assert.match(html, /vc run read-only-delivery --validate --json/i);
  assert.doesNotMatch(html, /do not run golden tasks/i);
  assert.doesNotMatch(html, /prove behavioral parity/i);
  assert.doesNotMatch(html, /Thirteen commands/i);
  assert.doesNotMatch(html, />\s*21\s*</);
  assert.doesNotMatch(html, /canonical Claude format/i);
});

test("landmarks, headings, tabs, and copy status are accessible", () => {
  assert.match(html, /<main\b[^>]*>/i);
  assert.match(html, /<\/main>/i);
  assert.doesNotMatch(html, /<h4\b/i);
  assert.match(html, /<section\b[^>]*id="proof"/i);
  assert.match(html, /<section\b[^>]*id="graph"/i);
  assert.match(html, /id="copy-status"[^>]*aria-live="polite"/i);

  const tabs = html.match(/<button\b[^>]*class="term-tab[^"]*"[^>]*>/gi) || [];
  assert.equal(tabs.length, 2);
  for (const tab of tabs) {
    assert.match(tab, /role="tab"/i);
    assert.match(tab, /aria-controls="pane-(unix|win)"/i);
    assert.match(tab, /aria-selected="(true|false)"/i);
  }
  assert.doesNotMatch(html, /<span\b[^>]*class="term-tab/i);
  assert.match(html, /role="tabpanel"/i);
});

test("craft regressions stay out of the single-file page", () => {
  assert.doesNotMatch(html, /transition:\s*all/i);
  assert.doesNotMatch(html, /—/);
  assert.doesNotMatch(html, /#(?:000|fff)(?![0-9a-f])/i);
  const sections = (html.match(/<section\b/gi) || []).length + 1;
  const eyebrows = (html.match(/class="eyebrow"/g) || []).length;
  assert.ok(eyebrows <= Math.ceil(sections / 3), `${eyebrows} eyebrows for ${sections} sections`);
});
