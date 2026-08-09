import { applyStaticResponsePolicy } from "./static-response-policy.js";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const allowedHosts = String(env.ALLOWED_HOSTS || "")
      .split(",")
      .map((host) => host.trim())
      .filter(Boolean);

    if (!allowedHosts.includes(url.hostname)) {
      return new Response("canonical host required", {
        status: 421,
        headers: { "cache-control": "no-store", "x-robots-tag": "noindex" },
      });
    }

    return applyStaticResponsePolicy(await env.ASSETS.fetch(request), url.pathname);
  },
};
