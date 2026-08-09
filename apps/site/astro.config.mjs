import sitemap from "@astrojs/sitemap";
import { defineConfig } from "astro/config";

export default defineConfig({
  output: "static",
  site: "https://vcskill.vchun.dev",
  trailingSlash: "always",
  integrations: [sitemap()],
  build: { assets: "_astro", format: "directory" },
  vite: { build: { assetsInlineLimit: 0 } },
});
