import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { loadReleasePin, siteFacts } from "../../apps/site/src/content/marketing-facts.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (path) => readFileSync(join(root, path), "utf8");
const components = [
  "promise-section.astro",
  "execution-map.astro",
  "workflow-section.astro",
  "provider-projection.astro",
  "evidence-ledger.astro",
  "final-install.astro",
];
const componentSource = components.map((name) => read(`apps/site/src/components/${name}`)).join("\n");
const indexSource = read("apps/site/src/pages/index.astro");
const factsSource = read("apps/site/src/content/marketing-facts.ts");

test("home composes exactly six ordered sections and one H1", () => {
  const expectedOrder = ["PromiseSection", "ExecutionMap", "WorkflowSection", "ProviderProjection", "EvidenceLedger", "FinalInstall"];
  let cursor = -1;
  for (const component of expectedOrder) {
    const next = indexSource.indexOf(`<${component}`, cursor + 1);
    assert.ok(next > cursor, `${component} is missing or out of order`);
    cursor = next;
  }
  assert.equal((componentSource.match(/<section\b[^>]*data-site-section/g) || []).length, 6);
  assert.equal((componentSource.match(/<h1\b/g) || []).length, 1);
});

test("canonical workflows are exact and provider content stays a projection", () => {
  const ids = [...factsSource.matchAll(/id: "([a-z-]+-delivery)"/g)].map((match) => match[1]);
  assert.deepEqual(ids, ["safe-change-delivery", "bugfix-delivery", "read-only-delivery"]);
  const provider = read("apps/site/src/components/provider-projection.astro");
  assert.match(provider, /Support varies by provider and release/);
  assert.match(provider, /siteFacts\.docsUrl/);
  assert.doesNotMatch(provider, /<table|\.map\(|providerMatrix|capabilities:/i);
  assert.ok(siteFacts.workflows.every((workflow) => workflow.sourceUrl.includes(`/reference/workflows/${workflow.id}/`)));
  assert.ok(siteFacts.workflows.every((workflow) => workflow.sourceLabel.length > 0 && workflow.caveat.length > 0));
  const workflowSection = read("apps/site/src/components/workflow-section.astro");
  assert.match(workflowSection, /workflow\.sourceUrl/);
  assert.match(workflowSection, /workflow\.caveat/);
});

test("install and docs actions are direct and marketing copy avoids banned language", () => {
  const header = read("apps/site/src/components/site-header.astro");
  const promise = read("apps/site/src/components/promise-section.astro");
  assert.match(header, /siteFacts\.installUrl/);
  assert.match(header, /siteFacts\.docsUrl/);
  assert.match(header, /href="#evidence">See proof<\/a>/);
  assert.match(promise, /href="#install">Install vcskill<\/a>/);
  assert.match(promise, /siteFacts\.installCommands/);
  assert.match(factsSource, /curl -fsSL https:\/\/vcskill\.vchun\.dev\/install \| bash/);
  assert.match(factsSource, /irm https:\/\/vcskill\.vchun\.dev\/install\.ps1 \| iex/);
  const visibleCopy = `${componentSource}\n${factsSource}`;
  assert.doesNotMatch(visibleCopy, /—/);
  assert.doesNotMatch(visibleCopy, /\b(?:Elevate|Seamless|Unleash|Empower|Supercharge|Next-Gen|Game-changer)\b/i);
  assert.doesNotMatch(visibleCopy, /testimonial|customer logo|\d+[,+]?\s*(?:users|customers|skills|commands)/i);
});

test("evidence is source-linked and every stable claim has a caveat", () => {
  assert.equal(siteFacts.evidence.length, 3);
  assert.ok(siteFacts.evidence.every((item) => item.sourceUrl.length > 0 && item.caveat.length > 0));
  assert.match(factsSource, /loadReleasePin/);
  assert.match(factsSource, /schemaVersion !== 1/);
  assert.match(factsSource, /required = false/);
  const evidence = read("apps/site/src/components/evidence-ledger.astro");
  assert.match(evidence, /version=\$\{encodeURIComponent\(releasePin\.version\)\}/);
  assert.match(evidence, /proves release availability only/);
  assert.doesNotMatch(evidence, /Static build pinned|proves the pinned release identity/);
});

test("release pin is optional, schema-checked, and never guessed", () => {
  const directory = mkdtempSync(join(tmpdir(), "vcskill-site-pin-"));
  const path = join(directory, "vcskill.json");
  try {
    assert.equal(loadReleasePin(path), undefined);
    assert.throws(() => loadReleasePin(path, true), /ENOENT/);
    writeFileSync(path, JSON.stringify({ schemaVersion: 1, current: { version: "latest" } }));
    assert.throws(() => loadReleasePin(path), /identity is malformed/);
    writeFileSync(path, JSON.stringify({
      schemaVersion: 1,
      current: { version: "1.2.3", tag: "vcskill@1.2.3", sourceSha: "a".repeat(40) },
    }));
    assert.deepEqual(loadReleasePin(path), {
      version: "1.2.3",
      tag: "vcskill@1.2.3",
      sourceSha: "a".repeat(40),
    });
    for (const version of ["01.2.3", "1.02.3", "1.2.03", "1.2.3-01", "1.2.3-.", "1.2.3-alpha..1", "1.2.3+", "1.2.3+build..1"]) {
      writeFileSync(path, JSON.stringify({
        schemaVersion: 1,
        current: { version, tag: `vcskill@${version}`, sourceSha: "a".repeat(40) },
      }));
      assert.throws(() => loadReleasePin(path), /identity is malformed/, version);
    }
    for (const version of ["1.2.3-rc.1", "1.2.3+build.7", "1.2.3-rc.1+build.7"]) {
      writeFileSync(path, JSON.stringify({
        schemaVersion: 1,
        current: { version, tag: `vcskill@${version}`, sourceSha: "a".repeat(40) },
      }));
      assert.equal(loadReleasePin(path)?.version, version);
    }
    writeFileSync(path, JSON.stringify({
      schemaVersion: 1,
      current: { version: "1.2.3", tag: "vcskill@9.9.9", sourceSha: "a".repeat(40) },
    }));
    assert.throws(() => loadReleasePin(path), /identity is malformed/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
