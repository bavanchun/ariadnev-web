import assert from "node:assert/strict";
import { readFile, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { temporaryContent } from "./contract-fixture.mjs";

const repositoryRoot = resolve(import.meta.dirname, "../..");

async function run(command, args) {
  await new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { cwd: repositoryRoot, stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code, signal) => code === 0 && !signal ? resolvePromise() : reject(new Error(`${command} ${args.join(" ")} failed`)));
  });
}

const fixture = await temporaryContent();
try {
  await run(process.execPath, ["apps/docs/scripts/build-docs.mjs", "--content-root", fixture.root]);
  for (const locale of ["en", "vi"]) {
    const html = await readFile(resolve(repositoryRoot, `apps/docs/out/${locale}/stable/index.html`), "utf8");
    assert.equal((html.match(/<h1\b/g) ?? []).length, 1, `${locale} stable output must contain one H1`);
    assert.match(html, new RegExp(`<html lang="${locale}"`));
    assert.match(html, new RegExp(`class="docs-frame" lang="${locale}"`));
    const markdown = await readFile(resolve(repositoryRoot, `apps/docs/out/${locale}/stable.md`), "utf8");
    assert.match(markdown, /^#\s+\S/);
    assert.equal((markdown.match(/^#\s+/gm) ?? []).length, 1, `${locale} Markdown sibling must contain one H1`);
  }
} finally {
  await rm(fixture.root, { recursive: true, force: true });
}
