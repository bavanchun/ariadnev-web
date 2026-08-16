import { createProcessor } from "@mdx-js/mdx";

interface MarkdownNode {
  readonly type: string;
  readonly depth?: number;
  readonly url?: string;
  readonly children?: readonly MarkdownNode[];
}

const processor = createProcessor({ format: "mdx" });
const forbiddenNodeTypes = new Set([
  "definition",
  "html",
  "image",
  "imageReference",
  "linkReference",
  "mdxFlowExpression",
  "mdxJsxFlowElement",
  "mdxJsxTextElement",
  "mdxTextExpression",
  "mdxjsEsm",
]);
const allowedSchemes = new Set(["http", "https", "mailto", "tel"]);

function stripFrontmatter(markdown: string): string {
  return markdown.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "").trim();
}

function unsafeMarkdown(): never {
  throw new Error("docs source is not safe public Markdown");
}

function validateLink(url: string): void {
  if (/[\u0000-\u001f\u007f]/.test(url) || url.includes("\\") || url.startsWith("//")) unsafeMarkdown();
  const scheme = /^([A-Za-z][A-Za-z0-9+.-]*):/.exec(url)?.[1]?.toLowerCase();
  if (scheme && !allowedSchemes.has(scheme)) unsafeMarkdown();
}

function inspectNode(node: MarkdownNode, links: string[]): void {
  if (forbiddenNodeTypes.has(node.type) || (node.type === "heading" && node.depth === 1)) unsafeMarkdown();
  if (node.type === "link") {
    if (typeof node.url !== "string") unsafeMarkdown();
    validateLink(node.url);
    links.push(node.url);
  }
  for (const child of node.children ?? []) inspectNode(child, links);
}

function analyzePublicMarkdown(markdown: string): { readonly body: string; readonly links: readonly string[] } {
  const body = stripFrontmatter(markdown);
  let tree: MarkdownNode;
  try {
    tree = processor.parse(body) as MarkdownNode;
  } catch {
    return unsafeMarkdown();
  }
  const links: string[] = [];
  inspectNode(tree, links);
  return { body, links: Object.freeze(links) };
}

export function publicMarkdown(markdown: string): string {
  return `${analyzePublicMarkdown(markdown).body}\n`;
}

export function publicMarkdownLinks(markdown: string): readonly string[] {
  return analyzePublicMarkdown(markdown).links;
}
