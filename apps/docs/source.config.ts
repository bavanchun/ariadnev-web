import { defineConfig, defineDocs } from "fumadocs-mdx/config";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveDocsContentRoot } from "./src/lib/docs-content-root.ts";

const appRoot = fileURLToPath(new URL("./", import.meta.url));
const contentRoot = resolveDocsContentRoot(appRoot);

export const docs = defineDocs({
  dir: resolve(contentRoot, "generated/docs"),
  docs: {
    postprocess: { includeProcessedMarkdown: true },
  },
});

export default defineConfig();
