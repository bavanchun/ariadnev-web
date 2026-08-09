const REPO = "bavanchun/vcskill";
const API_ORIGIN = "https://api.github.com";
const USER_AGENT = "vcskill-edge-worker";
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_REDIRECTS = 5;
const MAX_RELEASE_BYTES = 1_000_000;
const MAX_RELEASE_ASSETS = 200;
const STORAGE_HOSTS = new Set([
  "objects.githubusercontent.com",
  "release-assets.githubusercontent.com",
  "github-releases.githubusercontent.com",
]);
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

function edgeError(status, message, options = {}) {
  const error = new Error(message);
  error.status = status;
  error.expose = options.expose ?? true;
  return error;
}

function githubHeaders(token, accept) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: accept,
    "User-Agent": USER_AGENT,
  };
}

function requireToken(token) {
  if (!token) throw edgeError(500, "worker misconfigured: GH_TOKEN unset");
}

function assertApiOrigin(url) {
  const parsed = new URL(url);
  if (parsed.origin !== API_ORIGIN) throw edgeError(502, "asset origin is not allowed");
}

function assertAllowedStorageUrl(url) {
  const parsed = new URL(url);
  const githubS3 = /^github-production-release-asset-[0-9a-f]+\.s3\.amazonaws\.com$/i.test(parsed.hostname);
  if (parsed.protocol !== "https:" || (!STORAGE_HOSTS.has(parsed.hostname) && !githubS3)) {
    throw edgeError(502, "asset redirect origin is not allowed");
  }
}

function remainingTimeout(deadline) {
  const remaining = deadline - Date.now();
  if (remaining <= 0) throw edgeError(502, "upstream timeout");
  return remaining;
}

async function fetchWithDeadline(fetchImpl, url, init, deadline, consumeResponse = null) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), remainingTimeout(deadline));
  try {
    const response = await fetchImpl(url, { ...init, signal: controller.signal });
    if (consumeResponse) return await consumeResponse(response);
    return response;
  } catch (error) {
    if (controller.signal.aborted || error?.name === "TimeoutError" || error?.name === "AbortError") {
      throw edgeError(502, "upstream timeout");
    }
    if (Number.isInteger(error?.status)) throw error;
    throw edgeError(502, "upstream fetch failed");
  } finally {
    // For streaming responses this releases the header deadline before the body
    // is returned to the client. The shared deadline still bounds metadata and
    // every redirect hop, but never aborts a healthy download mid-stream.
    clearTimeout(timeoutId);
  }
}

function buildAssetRequestHeaders(url, token) {
  const origin = new URL(url).origin;
  if (origin === API_ORIGIN) return githubHeaders(token, "application/octet-stream");
  return {
    Accept: "application/octet-stream",
    "User-Agent": USER_AGENT,
  };
}

async function discardBody(response) {
  try {
    await response.body?.cancel();
  } catch {
    // The response is already unusable; cancellation is best-effort cleanup.
  }
}

async function readBoundedJson(response) {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_RELEASE_BYTES) {
    throw edgeError(502, "release metadata too large");
  }
  const reader = response.body?.getReader();
  if (!reader) throw edgeError(502, "release metadata missing");
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > MAX_RELEASE_BYTES) {
      await reader.cancel();
      throw edgeError(502, "release metadata too large");
    }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();
  try {
    return JSON.parse(text);
  } catch {
    throw edgeError(502, "release metadata invalid");
  }
}

function releaseEndpoint(selector) {
  if (selector.mode === "latest") return `${API_ORIGIN}/repos/${REPO}/releases/latest`;
  const encodedTag = encodeURIComponent(selector.tag).replace("%40", "@");
  return `${API_ORIGIN}/repos/${REPO}/releases/tags/${encodedTag}`;
}

function validateReleaseIdentity(selector, release) {
  if (selector.mode === "pinned" && release?.tag_name !== selector.tag) {
    throw edgeError(404, "release tag mismatch");
  }
}

export async function getReleaseMetadata({
  fetchImpl = fetch,
  token,
  selector,
  deadline = Date.now() + REQUEST_TIMEOUT_MS,
}) {
  requireToken(token);
  return fetchWithDeadline(
    fetchImpl,
    releaseEndpoint(selector),
    {
      headers: githubHeaders(token, "application/vnd.github+json"),
      redirect: "manual",
    },
    deadline,
    async (response) => {
      if (!response.ok) {
        if (selector.mode === "pinned" && response.status === 404) throw edgeError(404, "release not found");
        throw edgeError(502, "release lookup failed");
      }

      const release = await readBoundedJson(response);
      if (!Array.isArray(release.assets) || release.assets.length > MAX_RELEASE_ASSETS) {
        throw edgeError(502, "release asset metadata invalid");
      }
      validateReleaseIdentity(selector, release);
      return { release };
    },
  );
}

export function getVersionResponseBody(release) {
  return String(release?.tag_name || "").replace(/^vcskill@/, "").replace(/^v/, "");
}

export async function fetchReleaseAssetStream({
  fetchImpl = fetch,
  token,
  assetName,
  selector,
  timeoutMs = REQUEST_TIMEOUT_MS,
}) {
  const deadline = Date.now() + timeoutMs;
  const { release } = await getReleaseMetadata({ fetchImpl, token, selector, deadline });
  const asset = (release.assets || []).find((entry) => entry.name === assetName);
  if (!asset) throw edgeError(404, `asset not found: ${assetName}`);
  assertApiOrigin(asset.url);

  let currentUrl = asset.url;
  let remainingRedirects = MAX_REDIRECTS;
  while (true) {
    const response = await fetchWithDeadline(
      fetchImpl,
      currentUrl,
      {
        headers: buildAssetRequestHeaders(currentUrl, token),
        redirect: "manual",
      },
      deadline,
    );

    if (REDIRECT_STATUSES.has(response.status)) {
      if (remainingRedirects <= 0) throw edgeError(502, "asset redirect limit exceeded");
      const nextLocation = response.headers.get("location");
      if (!nextLocation) throw edgeError(502, "asset redirect missing location");
      await discardBody(response);
      currentUrl = new URL(nextLocation, currentUrl).toString();
      assertAllowedStorageUrl(currentUrl);
      remainingRedirects -= 1;
      continue;
    }

    if (!response.ok) {
      await discardBody(response);
      return new Response("asset upstream unavailable", { status: response.status });
    }
    return response;
  }
}

export async function getInstallerResponse({
  fetchImpl = fetch,
  token,
  filename,
  contentType,
  timeoutMs = REQUEST_TIMEOUT_MS,
}) {
  requireToken(token);
  const response = await fetchWithDeadline(
    fetchImpl,
    `${API_ORIGIN}/repos/${REPO}/contents/${filename}?ref=main`,
    {
      headers: githubHeaders(token, "application/vnd.github.raw"),
      redirect: "manual",
    },
    Date.now() + timeoutMs,
  );

  const body = response.ok ? response.body : "installer upstream unavailable";
  return new Response(body, {
    status: response.status,
    headers: {
      "content-type": contentType,
      "cache-control": "no-store",
    },
  });
}

export function toEdgeResponse(error, options = {}) {
  const status = error?.status ?? 502;
  const body = options.emptyBody || error?.expose === false ? "" : (error?.message || "");
  return new Response(body, { status });
}
