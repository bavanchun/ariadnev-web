import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { parseDocsContentCatalog } from "../../apps/docs/src/lib/content-catalog.ts";
import { GENERATED_PASSTHROUGH_SCREEN_KINDS, REGISTERED_SCREEN_KINDS, hasRegisteredScreen, isGeneratedPassthroughScreen } from "../../apps/docs/src/components/docs-screen-registry.ts";

const repositoryRoot = resolve(import.meta.dirname, "../..");

async function currentCatalog() {
  const raw = await readFile(resolve(repositoryRoot, "apps/docs/content/generated/catalog.json"), "utf8");
  return parseDocsContentCatalog(JSON.parse(raw));
}

test("every authored screenKind declared in the catalog is covered by the registry", async () => {
  const catalog = await currentCatalog();
  const declared = new Set(
    catalog.pages
      .map((page) => page.screenKind)
      .filter((kind) => typeof kind === "string" && !isGeneratedPassthroughScreen(kind)),
  );
  for (const kind of declared) {
    assert.ok(
      hasRegisteredScreen(kind),
      `authored screenKind "${kind}" has no registry owner in docs-screen-registry.ts`,
    );
  }
});

test("generated-pass-through screenKinds and authored registry keys do not overlap", () => {
  for (const kind of REGISTERED_SCREEN_KINDS) {
    assert.ok(
      !isGeneratedPassthroughScreen(kind),
      `screenKind "${kind}" is declared both as an authored composition and a generated pass-through`,
    );
  }
  for (const kind of GENERATED_PASSTHROUGH_SCREEN_KINDS) {
    assert.ok(
      !hasRegisteredScreen(kind),
      `screenKind "${kind}" is declared both as a generated pass-through and an authored composition`,
    );
  }
});

test("registered screenKinds match the canonical Living Atlas naming pattern", () => {
  const pattern = /^D\d{2}-[a-z][a-z0-9-]*$/;
  for (const kind of REGISTERED_SCREEN_KINDS) {
    assert.match(kind, pattern, `screenKind "${kind}" does not match the D<NN>-<slug> naming pattern`);
  }
});

test("the docs-home page is present in both locales of the current stable edition", async () => {
  const catalog = await currentCatalog();
  for (const locale of ["en", "vi"]) {
    const home = catalog.pages.find(
      (page) => page.locale === locale && page.version === catalog.currentStable && page.canonicalId === "core/index",
    );
    assert.ok(home, `${locale} docs-home is missing from the current stable edition`);
    assert.equal(home.screenKind, "D01-current-docs-home", `${locale} docs-home did not carry the D01 screenKind`);
  }
});

test("the previous-home page carries D02 in both locales of the previous stable edition", async () => {
  const catalog = await currentCatalog();
  for (const locale of ["en", "vi"]) {
    const home = catalog.pages.find(
      (page) => page.locale === locale && page.version === catalog.previousStable && page.canonicalId === "core/index",
    );
    assert.ok(home, `${locale} previous-home is missing from the previous stable edition`);
    assert.equal(home.screenKind, "D02-previous-home", `${locale} previous-home did not carry the D02 screenKind`);
    assert.ok(hasRegisteredScreen(home.screenKind), "D02 screenKind must have a registry owner");
  }
});

test("every authored D03-D11 screen carries its screenKind in both locales of the current stable", async () => {
  const catalog = await currentCatalog();
  // canonicalId → expected screenKind. `canonicalId` is stable across
  // locale/version pairs and is written from the authored source path, so
  // asserting against it survives a title rename in either locale.
  const expected = new Map([
    ["core/get-started/installation", "D03-installation"],
    ["core/get-started/first-install", "D04-first-install"],
    ["core/concepts/kit-and-adapt-engine", "D05-kit-adapt"],
    ["core/concepts/graph-execution", "D06-graph-execution"],
    ["core/concepts/evaluation", "D07-evaluation"],
    ["core/guides/upgrading", "D08-upgrading"],
    ["core/guides/configuration", "D09-configuration"],
    ["core/guides/uninstall-and-doctor", "D10-doctor-audit-backups-uninstall"],
    ["core/guides/migration-from-vcskill", "D11-migration"],
  ]);
  for (const locale of ["en", "vi"]) {
    for (const [canonicalId, kind] of expected) {
      const page = catalog.pages.find(
        (candidate) => candidate.locale === locale && candidate.version === catalog.currentStable && candidate.canonicalId === canonicalId,
      );
      assert.ok(page, `${locale} ${canonicalId} is missing from the current stable edition`);
      assert.equal(page.screenKind, kind, `${locale} ${canonicalId} did not carry the ${kind} screenKind`);
      assert.ok(hasRegisteredScreen(kind), `${kind} must have a registry owner`);
    }
  }
});
