import { fetchReleaseAssetStream, getInstallerResponse, getReleaseMetadata, getVersionResponseBody, toEdgeResponse } from "./github-release.js";
import { parseReleaseSelector } from "./release-selector.js";
import { applyStaticResponsePolicy } from "./static-response-policy.js";

const LANDING_CACHE_CONTROL = "public, max-age=300";
const INSTALL_HINT = "vcskill — install:  curl -fsSL https://vcskill.vchun.dev/install | bash\n";

function edgeError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export function classifyRoute(pathname) {
  if (pathname === "/install" || pathname === "/install.sh") {
    return { kind: "install", file: "install.sh", contentType: "text/x-shellscript; charset=utf-8" };
  }
  if (pathname === "/install.ps1") {
    return { kind: "install", file: "install.ps1", contentType: "text/plain; charset=utf-8" };
  }
  if (pathname === "/version") return { kind: "version" };

  if (pathname.startsWith("/download/")) {
    return { kind: "download", encodedAsset: pathname.slice("/download/".length) };
  }

  return { kind: "site" };
}

function validateAssetName(encodedAsset) {
  let decoded;
  try {
    decoded = decodeURIComponent(encodedAsset);
  } catch {
    throw edgeError(400, "invalid asset name");
  }

  if (decoded !== encodedAsset && decoded.includes("%")) throw edgeError(400, "invalid asset name");
  if (decoded.length === 0 || decoded.length > 255) throw edgeError(400, "invalid asset name");
  if (/[\\/\0-\x1f\x7f]/.test(decoded)) throw edgeError(400, "invalid asset name");
  if (decoded === "." || decoded === ".." || decoded.includes("..")) throw edgeError(400, "invalid asset name");
  return decoded;
}

function defaultSiteResponse(pathname, landingHtml = "") {
  if (pathname === "/" || pathname === "/index.html") {
    return new Response(landingHtml, {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": LANDING_CACHE_CONTROL,
      },
    });
  }

  return new Response(INSTALL_HINT, {
    status: 404,
    headers: { "content-type": "text/plain" },
  });
}

export function createEdgeWorker({ fetchImpl = fetch, siteFetcher = null, landingHtml = "" } = {}) {
  return {
    async fetch(request, env = {}) {
      const url = new URL(request.url);
      const route = classifyRoute(url.pathname);

      const allowedHosts = String(env.ALLOWED_HOSTS || "vcskill.vchun.dev,staging.vcskill.vchun.dev")
        .split(",")
        .map((host) => host.trim())
        .filter(Boolean);
      if (url.protocol !== "https:" || url.port || !allowedHosts.includes(url.hostname)) {
        return new Response("canonical host required", {
          status: 421,
          headers: { "cache-control": "no-store", "x-robots-tag": "noindex" },
        });
      }

      if (!env.GH_TOKEN && (env.TOPOLOGY_MODE === "combined" || route.kind !== "site")) {
        return new Response("worker misconfigured: GH_TOKEN unset", { status: 500 });
      }

      try {
        if (route.kind === "install") {
          return await getInstallerResponse({
            fetchImpl,
            token: env.GH_TOKEN,
            filename: route.file,
            contentType: route.contentType,
          });
        }

        if (route.kind === "version") {
          const selector = parseReleaseSelector(url.searchParams, url.search);
          const { release } = await getReleaseMetadata({ fetchImpl, token: env.GH_TOKEN, selector });
          return new Response(getVersionResponseBody(release), {
            headers: {
              "content-type": "text/plain",
              "cache-control": "no-store",
            },
          });
        }

        if (route.kind === "download") {
          const selector = parseReleaseSelector(url.searchParams, url.search);
          const assetName = validateAssetName(route.encodedAsset);
          const upstream = await fetchReleaseAssetStream({
            fetchImpl,
            token: env.GH_TOKEN,
            assetName,
            selector,
          });
          return new Response(upstream.body, {
            status: upstream.status,
            headers: {
              "content-type": "application/octet-stream",
              "content-disposition": `attachment; filename="${assetName}"`,
              "cache-control": "no-store",
            },
          });
        }
      } catch (error) {
        if (route.kind === "version") return toEdgeResponse(error, { emptyBody: true });
        return toEdgeResponse(error);
      }

      if (env.ASSETS?.fetch) {
        const assetResponse = await env.ASSETS.fetch(request);
        return applyStaticResponsePolicy(assetResponse, url.pathname);
      }

      if (typeof siteFetcher === "function") {
        return siteFetcher(request, env);
      }

      if (env.SITE?.fetch) {
        return env.SITE.fetch(request);
      }

      return defaultSiteResponse(url.pathname, landingHtml);
    },
  };
}

export default createEdgeWorker();
