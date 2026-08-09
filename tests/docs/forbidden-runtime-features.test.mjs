import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

const root = new URL("../../apps/docs/", import.meta.url);

test("Next configuration is export-only with trailing slash and unoptimized images", async () => {
  const config = await readFile(new URL("next.config.mjs", root), "utf8");
  assert.match(config, /output:\s*["']export["']/);
  assert.match(config, /trailingSlash:\s*true/);
  assert.match(config, /images:\s*\{\s*unoptimized:\s*true/);
  assert.doesNotMatch(config, /\b(?:rewrites|redirects|headers)\s*\(/);
});

test("docs source contains no forbidden runtime surface", async () => {
  const files = [
    "src/app/layout.tsx", "src/app/page.tsx", "src/app/not-found.tsx",
    "src/app/[locale]/[version]/layout.tsx", "src/app/[locale]/[version]/[[...slug]]/page.tsx",
  ];
  const source = (await Promise.all(files.map((file) => readFile(new URL(file, root), "utf8")))).join("\n");
  for (const pattern of [/from\s+["']next\/headers["']/, /\b(?:cookies|headers|draftMode|connection)\s*\(/, /export\s+const\s+revalidate\b/, /["']use server["']/, /runtime\s*=\s*["']edge["']/]) assert.doesNotMatch(source, pattern);
  assert.match(await readFile(new URL("src/app/[locale]/[version]/layout.tsx", root), "utf8"), /dynamicParams\s*=\s*false/);
  assert.match(await readFile(new URL("src/app/[locale]/[version]/[[...slug]]/page.tsx", root), "utf8"), /dynamicParams\s*=\s*false/);
  await assert.rejects(readFile(join(new URL(".", root).pathname, "middleware.ts")), /ENOENT/);
  await assert.rejects(readFile(join(new URL(".", root).pathname, "proxy.ts")), /ENOENT/);
});

test("deployment configs are assets-only and topology exact", async () => {
  for (const [environment, name] of [["staging", "vcskill-docs-staging"], ["production", "vcskill-docs-production"]]) {
    const config = await readFile(new URL(`wrangler.${environment}.toml`, root), "utf8");
    assert.match(config, new RegExp(`name = ["']${name}["']`));
    assert.match(config, /directory = ["']\.\/out["']/);
    assert.match(config, /workers_dev = false/);
    assert.match(config, /preview_urls = false/);
    assert.doesNotMatch(config, /account_id|route\s*=|main\s*=|\[vars\]/i);
  }
});

test("full docs build enforces the frozen static transfer budgets", async () => {
  const build = await readFile(new URL("scripts/build-docs.mjs", root), "utf8");
  assert.match(build, /scripts\/set-static-document-language\.mjs/);
  assert.match(build, /scripts\/verify-static-budget\.mjs/);
  const verifier = await readFile(new URL("scripts/verify-static-budget.mjs", root), "utf8");
  for (const id of ["docs-total-transfer-compressed", "docs-js-compressed", "docs-css-compressed", "docs-fonts-compressed", "docs-images-compressed"]) {
    assert.match(verifier, new RegExp(id));
  }
  assert.match(verifier, /nomodule/);
});
