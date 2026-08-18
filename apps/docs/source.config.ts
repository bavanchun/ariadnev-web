import { defineConfig, defineDocs } from "fumadocs-mdx/config";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import { resolveDocsContentRoot } from "./src/lib/docs-content-root.ts";

const rawRoot = fileURLToPath(new URL("./", import.meta.url));
const appRoot = rawRoot.replace(/[/\\]\.source[/\\]?$/, "");
const contentRoot = resolveDocsContentRoot(appRoot);

export const docs = defineDocs({
  dir: resolve(contentRoot, "generated/docs"),
  docs: {
    postprocess: { includeProcessedMarkdown: true },
  },
});

// Heading permalinks: rehype-autolink-headings wraps each heading (H2-H4) with
// a `<a class="heading-anchor" href="#slug" aria-label="Permalink to …">`.
// Fumadocs already runs rehype-slug (headings receive stable `id`s), so the
// autolink runs after slugging. Behavior: "wrap" so the entire heading text
// becomes the link surface and the anchor sits at the start of the heading;
// a small CSS `::before` rule renders the `#` sigil that appears on hover.
// Byte impact: ~40B raw HTML per heading, ~5-10B compressed after brotli-9.
export default defineConfig({
  mdxOptions: {
    rehypePlugins: [
      [rehypeAutolinkHeadings, {
        behavior: "prepend",
        properties: {
          className: "heading-anchor",
          ariaLabel: "Permalink",
          tabIndex: -1,
        },
        content: { type: "text", value: "#" },
      }],
    ],
  },
});
