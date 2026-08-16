// Frozen compatibility probes for every framework and tool later phases use.
//
// This exists because an empty package script proves nothing. If the pinned
// dependency graph cannot actually resolve and expose the exact APIs Phases
// 5-12 depend on, that has to fail here — before those phases branch in
// parallel and discover it separately.
//
// Each probe imports through the owning package's own resolution root, so it
// tests what that app will really see at build time rather than a hoisted
// coincidence at the workspace root.

import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const requireFrom = (packageDir: string) => createRequire(join(repoRoot, packageDir, "package.json"));
const manifest = (relativePath: string) => JSON.parse(readFileSync(join(repoRoot, relativePath), "utf8"));

/** Every dependency must be an exact version; a range would break reproducibility. */
function expectExactVersions(record: Record<string, string> | undefined, label: string): void {
  for (const [name, range] of Object.entries(record ?? {})) {
    if (range.startsWith("workspace:")) continue;
    expect(range, `${label} ${name} must be pinned exactly`).toMatch(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/);
  }
}

describe("dependency pinning", () => {
  it.each([
    "package.json",
    "apps/site/package.json",
    "apps/docs/package.json",
    "packages/contracts/package.json",
    "packages/tokens/package.json",
    "workers/edge/package.json",
  ])("%s pins every dependency exactly", (path) => {
    const pkg = manifest(path);
    expectExactVersions(pkg.dependencies, path);
    expectExactVersions(pkg.devDependencies, path);
  });

  it("pins the package manager and the node engine at the workspace root", () => {
    const root = manifest("package.json");
    expect(root.packageManager).toMatch(/^pnpm@\d+\.\d+\.\d+$/);
    expect(root.engines.node).toBeTruthy();
  });

  it("reserves the stable release-sync and qualification command names", () => {
    const scripts = manifest("package.json").scripts;
    expect(scripts["sync:release"]).toBeTruthy();
    expect(scripts["test:qualification"]).toBeTruthy();
  });

  it("ships a committed lockfile", () => {
    expect(existsSync(join(repoRoot, "pnpm-lock.yaml"))).toBe(true);
  });
});

describe("app build graphs stay independent", () => {
  it("neither app depends on the other, and only packages/* are shared", () => {
    const site = manifest("apps/site/package.json");
    const docs = manifest("apps/docs/package.json");
    const siteDeps = Object.keys({ ...site.dependencies, ...site.devDependencies });
    const docsDeps = Object.keys({ ...docs.dependencies, ...docs.devDependencies });

    expect(siteDeps).not.toContain("@ariadnev-web/docs");
    expect(docsDeps).not.toContain("@ariadnev-web/site");
    // A framework package appearing in both would couple the two build graphs.
    expect(siteDeps).not.toContain("next");
    expect(docsDeps).not.toContain("astro");
  });

  it("the contracts package leaks no framework dependency", () => {
    const contracts = manifest("packages/contracts/package.json");
    expect(contracts.dependencies ?? {}).toEqual({});
    const source = readFileSync(join(repoRoot, "packages/contracts/src/index.ts"), "utf8");
    for (const framework of ["astro", "next", "react", "fumadocs"]) {
      expect(source).not.toContain(framework);
    }
  });
});

describe("Phase 6 site toolchain", () => {
  const require = requireFrom("apps/site");

  it("resolves Astro and exposes its config API", async () => {
    const astro = await import(require.resolve("astro/config"));
    expect(typeof astro.defineConfig).toBe("function");
  });

  it("resolves PostCSS and can process a stylesheet", async () => {
    const postcss = (await import(require.resolve("postcss"))).default;
    const result = await postcss([]).process("a{color:red}", { from: undefined });
    expect(result.css).toBe("a{color:red}");
  });

  it("resolves sharp for font and image processing", async () => {
    const sharp = (await import(require.resolve("sharp"))).default;
    const png = await sharp({ create: { width: 2, height: 2, channels: 3, background: "#fff" } }).png().toBuffer();
    expect(png.subarray(1, 4).toString("ascii")).toBe("PNG");
  });
});

describe("Phase 7 docs toolchain", () => {
  const require = requireFrom("apps/docs");

  it("resolves Next and its build entrypoint", () => {
    expect(existsSync(require.resolve("next/package.json"))).toBe(true);
    const next = JSON.parse(readFileSync(require.resolve("next/package.json"), "utf8"));
    expect(next.version).toBe("16.3.0");
  });

  it("resolves the Fumadocs core, UI, and MDX packages at one aligned version", () => {
    const core = JSON.parse(readFileSync(require.resolve("fumadocs-core/package.json"), "utf8"));
    const ui = JSON.parse(readFileSync(require.resolve("fumadocs-ui/package.json"), "utf8"));
    expect(core.version).toBe(ui.version);
    expect(existsSync(require.resolve("fumadocs-mdx/package.json"))).toBe(true);
  });

  it("resolves the MDX compiler Fumadocs builds on", async () => {
    const mdx = await import(require.resolve("@mdx-js/mdx"));
    expect(typeof mdx.compile).toBe("function");
  });

  it("resolves Orama and can build and query a build-time index", async () => {
    const orama = await import(require.resolve("@orama/orama"));
    const index = orama.create({ schema: { title: "string", body: "string" } });
    orama.insert(index, { title: "install", body: "curl the installer" });
    const found = orama.search(index, { term: "installer" });
    const hits = found instanceof Promise ? (await found).count : found.count;
    expect(hits).toBeGreaterThan(0);
  });

  it("resolves React 19 for both the app and its renderer", () => {
    const react = JSON.parse(readFileSync(require.resolve("react/package.json"), "utf8"));
    const reactDom = JSON.parse(readFileSync(require.resolve("react-dom/package.json"), "utf8"));
    expect(react.version).toBe(reactDom.version);
    expect(react.version.startsWith("19.")).toBe(true);
  });
});

describe("Phase 3 and 12 edge toolchain", () => {
  const require = requireFrom("workers/edge");

  it("resolves Wrangler and the Workers types", () => {
    const wrangler = JSON.parse(readFileSync(require.resolve("wrangler/package.json"), "utf8"));
    expect(wrangler.version).toBe("4.120.0");
    expect(existsSync(require.resolve("@cloudflare/workers-types/package.json"))).toBe(true);
  });

  it("keeps every Wrangler profile the topology references on disk", () => {
    const topology = JSON.parse(readFileSync(join(repoRoot, "deployment/topology.json"), "utf8"));
    for (const unit of topology.units) {
      const configs = typeof unit.wranglerConfig === "string" ? [unit.wranglerConfig] : Object.values(unit.wranglerConfig);
      for (const config of configs as string[]) {
        // Phase 6 and 7 own their app configs; only the edge configs exist yet.
        if (!config.startsWith("workers/edge/")) continue;
        expect(existsSync(join(repoRoot, config)), `${config} is missing`).toBe(true);
      }
    }
  });
});

describe("Phase 11 qualification toolchain", () => {
  const require = requireFrom(".");

  it("resolves Lighthouse for the performance budget runs", () => {
    const lighthouse = JSON.parse(readFileSync(require.resolve("lighthouse/package.json"), "utf8"));
    expect(lighthouse.version).toBe("13.4.1");
  });

  it("resolves Playwright for the browser and viewport matrix", async () => {
    const playwright = await import(require.resolve("playwright"));
    expect(typeof playwright.chromium.launch).toBe("function");
  });
});
