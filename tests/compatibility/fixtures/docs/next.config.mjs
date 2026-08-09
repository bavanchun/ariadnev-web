import { createMDX } from "fumadocs-mdx/next";

const config = {
  images: { unoptimized: true },
  output: "export",
  trailingSlash: true,
};

export default createMDX({
  configPath: new URL("./source.config.ts", import.meta.url).pathname,
})(config);
