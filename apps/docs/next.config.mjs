import { createMDX } from "fumadocs-mdx/next";

const config = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  poweredByHeader: false,
};

export default createMDX({
  configPath: new URL("./source.config.ts", import.meta.url).pathname,
})(config);
