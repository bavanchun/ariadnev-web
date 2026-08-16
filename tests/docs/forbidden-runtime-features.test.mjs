import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { catalogFixture, temporaryContent } from "./contract-fixture.mjs";

const root = new URL("../../apps/docs/", import.meta.url);
const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));

async function runDocsBuild(contentRoot) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [resolve(repositoryRoot, "apps/docs/scripts/build-docs.mjs"), "--content-root", contentRoot], {
      cwd: repositoryRoot,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    const append = (chunk) => { output = `${output}${chunk}`.slice(-16_000); };
    child.stdout.on("data", append);
    child.stderr.on("data", append);
    child.once("error", reject);
    child.once("exit", (code, signal) => resolvePromise({ code, signal, output }));
  });
}

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
  for (const [environment, name] of [["staging", "ariadnev-docs-staging"], ["production", "ariadnev-docs"]]) {
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
  assert.match(build, /--content-root/);
  assert.ok(build.indexOf("loadDocsContentCatalog(catalogPath, contentRoot)") < build.indexOf('run("pnpm", ["exec", "fumadocs-mdx"'), "public Markdown validation must precede Fumadocs compilation");
  assert.match(build, /scripts\/set-static-document-language\.mjs/);
  assert.match(build, /scripts\/verify-static-budget\.mjs/);
  const sourceConfig = await readFile(new URL("source.config.ts", root), "utf8");
  assert.match(sourceConfig, /resolveDocsContentRoot/);
  const temporaryExport = await readFile(new URL("../../tests/docs/run-temporary-export.mjs", root), "utf8");
  assert.match(temporaryExport, /--content-root/);
  assert.doesNotMatch(temporaryExport, /\bcp\(/);
  const verifier = await readFile(new URL("scripts/verify-static-budget.mjs", root), "utf8");
  for (const id of ["docs-total-transfer-compressed", "docs-js-compressed", "docs-css-compressed", "docs-fonts-compressed", "docs-images-compressed"]) {
    assert.match(verifier, new RegExp(id));
  }
  assert.match(verifier, /nomodule/);
});

test("docs build rejects executable MDX before source generation", async () => {
  const fixture = await temporaryContent();
  const unsafeSource = join(fixture.root, catalogFixture().pages[0].sourcePath);
  try {
    await writeFile(unsafeSource, "---\ntitle: Unsafe\ndescription: Unsafe\n---\n\n## Unsafe\n\n{process.exit(0)}\n", "utf8");
    const result = await runDocsBuild(fixture.root);
    assert.notEqual(result.code, 0);
    assert.equal(result.signal, null);
    assert.match(result.output, /not safe public Markdown/);
    assert.doesNotMatch(result.output, /\[MDX\] generated files/);
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});
