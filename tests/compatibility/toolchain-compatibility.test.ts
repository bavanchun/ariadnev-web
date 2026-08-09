import { execFileSync } from "node:child_process";
import { compile } from "@mdx-js/mdx";
import { create, insert, load, save, search } from "@orama/orama";
import tailwindPostcss from "@tailwindcss/postcss";
import postcss from "postcss";
import { describe, expect, it } from "vitest";

describe("frozen toolchain", () => {
  it("compiles the reserved TypeScript API surface", () => {
    expect(() => execFileSync("pnpm", ["exec", "tsc", "-p", "tsconfig.compatibility.json"], {
      cwd: process.cwd(),
      stdio: "pipe",
    })).not.toThrow();
  });

  it("compiles MDX and Tailwind through PostCSS", async () => {
    const mdx = await compile("# Compatibility\n\nStatic content.");
    expect(String(mdx)).toContain("Compatibility");
    const css = await postcss([tailwindPostcss()]).process("@import 'tailwindcss';", { from: undefined });
    expect(css.css).toContain("--font-sans");
  });

  it("round-trips an isolated Orama index", () => {
    const database = create({ schema: { title: "string", locale: "string", version: "string" } });
    insert(database, { title: "Install vcskill", locale: "en", version: "stable" });
    const raw = save(database);
    const restored = create({ schema: { title: "string", locale: "string", version: "string" } });
    load(restored, raw);
    const result = search(restored, { term: "install", where: { locale: "en", version: "stable" } });
    expect(result.count).toBe(1);
  });

  it.each([
    ["astro", ["--version"], /^\s*astro\s+v?7\.2\.0/m],
    ["next", ["--version"], /16\.3\.0/],
    ["playwright", ["--version"], /1\.62\.1/],
    ["wrangler", ["--version"], /4\.120\.0/],
  ])("resolves the exact %s CLI", (binary, args, expected) => {
    const output = execFileSync("pnpm", ["exec", binary, ...args], { cwd: process.cwd(), encoding: "utf8" });
    expect(output).toMatch(expected);
  });
});
