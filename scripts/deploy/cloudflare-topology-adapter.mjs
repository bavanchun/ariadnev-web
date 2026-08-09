import { createHash } from "node:crypto";

const DOCS_ZONE_NAME = "vchun.dev";
const WORKER_ENVIRONMENT = "production";
const SAFE_PROVIDER_ID = /^[A-Za-z0-9-]{1,64}$/;
const DNS_SETTING_KEYS = ["flatten_cname", "ipv4_only", "ipv6_only"];

function topologyError(message, code = "TOPOLOGY_ADAPTER_FAILED") {
  const error = new Error(message);
  error.code = code;
  return error;
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

function sha256(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function providerId(value) {
  if (typeof value !== "string" || !SAFE_PROVIDER_ID.test(value)) throw topologyError("Cloudflare returned an unsafe opaque identifier");
  return encodeURIComponent(value);
}

async function request(fetchImpl, token, path, { method = "GET", body } = {}) {
  if (!token) throw topologyError("Cloudflare token is required for topology restoration");
  const response = await fetchImpl(`https://api.cloudflare.com/client/v4${path}`, {
    method,
    headers: { authorization: `Bearer ${token}`, ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    redirect: "error",
    signal: AbortSignal.timeout(15_000),
  });
  if (response.status === 204 && response.ok) return null;
  let payload;
  try { payload = await response.json(); } catch { payload = null; }
  if (!response.ok || payload?.success !== true) {
    const codes = Array.isArray(payload?.errors) ? payload.errors.map((entry) => Number(entry?.code)).filter(Number.isFinite).slice(0, 5) : [];
    throw topologyError(`Cloudflare topology request failed: status=${response.status}; codes=${codes.join(",") || "none"}`);
  }
  return payload.result;
}

function exactQuery(entries, predicate, ambiguousMessage) {
  if (!Array.isArray(entries) || entries.some((entry) => !predicate(entry)) || entries.length > 1) throw topologyError(ambiguousMessage);
  return entries;
}

async function resolveZone(fetchImpl, token) {
  const zones = await request(fetchImpl, token, `/zones?name=${encodeURIComponent(DOCS_ZONE_NAME)}&status=active&per_page=2`);
  if (!Array.isArray(zones) || zones.length !== 1 || zones[0]?.name !== DOCS_ZONE_NAME
    || typeof zones[0]?.id !== "string" || typeof zones[0]?.account?.id !== "string") {
    throw topologyError("one exact zone/account is required for docs restoration");
  }
  return { zoneId: zones[0].id, accountId: zones[0].account.id };
}

async function listDocsDomains(fetchImpl, token, accountId, zoneId, hostname) {
  const query = new URLSearchParams({ environment: WORKER_ENVIRONMENT, hostname, zone_id: zoneId, per_page: "2" });
  const domains = await request(fetchImpl, token, `/accounts/${providerId(accountId)}/workers/domains?${query}`);
  return exactQuery(domains, (entry) => entry?.hostname === hostname
    && entry?.zone_id === zoneId
    && typeof entry?.service === "string"
    && (entry.environment === undefined || entry.environment === null || entry.environment === WORKER_ENVIRONMENT)
    && typeof entry?.id === "string" && SAFE_PROVIDER_ID.test(entry.id), "docs hostname has ambiguous or inexact Worker ownership");
}

async function listDocsDns(fetchImpl, token, zoneId, hostname) {
  const query = new URLSearchParams({ name: hostname, per_page: "2" });
  const records = await request(fetchImpl, token, `/zones/${providerId(zoneId)}/dns_records?${query}`);
  return exactQuery(records, (entry) => entry?.name === hostname && typeof entry?.id === "string" && SAFE_PROVIDER_ID.test(entry.id), "docs hostname has ambiguous or inexact DNS state");
}

function normalizeSettings(settings) {
  if (settings === undefined || settings === null) return {};
  if (typeof settings !== "object" || Array.isArray(settings) || Object.keys(settings).some((key) => !DNS_SETTING_KEYS.includes(key))) {
    throw topologyError("docs DNS settings contain an unsupported field");
  }
  return Object.fromEntries(DNS_SETTING_KEYS.filter((key) => typeof settings[key] === "boolean").map((key) => [key, settings[key]]));
}

function normalizeDnsRecord(record) {
  if (!record || !["A", "AAAA", "CNAME"].includes(record.type) || typeof record.name !== "string"
    || typeof record.content !== "string" || !Number.isInteger(record.ttl) || typeof record.proxied !== "boolean") {
    throw topologyError("docs DNS record is not exactly restorable");
  }
  const tags = record.tags === undefined ? [] : record.tags;
  if (!Array.isArray(tags) || tags.some((tag) => typeof tag !== "string")) throw topologyError("docs DNS tags are malformed");
  return {
    type: record.type,
    name: record.name,
    content: record.content,
    ttl: record.ttl,
    proxied: record.proxied,
    comment: typeof record.comment === "string" ? record.comment : null,
    tags: [...tags].sort((left, right) => left < right ? -1 : left > right ? 1 : 0),
    settings: normalizeSettings(record.settings),
  };
}

function dnsRecordBody(record) {
  const body = {
    type: record.type,
    name: record.name,
    content: record.content,
    ttl: record.ttl,
    proxied: record.proxied,
    tags: record.tags,
    settings: record.settings,
  };
  if (record.comment !== null) body.comment = record.comment;
  return body;
}

function assertOwner(domains, owner, candidateName) {
  if (owner.ownerType === "unassigned") {
    if (domains.length !== 0) throw topologyError("exact docs Worker ownership was not restored");
  } else if (domains.length !== 1 || domains[0].service !== owner.workerName || domains[0].service === candidateName) {
    throw topologyError("exact docs Worker ownership was not restored");
  }
}

function assertDns(records, dns) {
  if (!dns.present) {
    if (records.length !== 0) throw topologyError("exact docs DNS prestate was not restored");
    return;
  }
  if (records.length !== 1) throw topologyError("exact docs DNS prestate was not restored");
  const actual = normalizeDnsRecord(records[0]);
  if (stableStringify(actual) !== stableStringify(dns.record) || sha256(stableStringify(actual)) !== dns.recordDigest) {
    throw topologyError("exact docs DNS prestate was not restored");
  }
}

async function restoreDocsPrestate(context) {
  const fetchImpl = context.topologyFetchAdapter || fetch;
  const docs = context.firstCutover.docsHost;
  const candidateName = docs.candidateWorkerName;
  const [owner, dns] = docs.orderedPrestate;
  const { zoneId, accountId } = await resolveZone(fetchImpl, context.cloudflareToken);

  const candidateDomains = await listDocsDomains(fetchImpl, context.cloudflareToken, accountId, zoneId, docs.hostname);
  if (candidateDomains.length !== 1 || candidateDomains[0].service !== candidateName) {
    throw topologyError("docs hostname is not owned by the exact rollback candidate");
  }
  await listDocsDns(fetchImpl, context.cloudflareToken, zoneId, docs.hostname);

  if (owner.ownerType === "worker") {
    await request(fetchImpl, context.cloudflareToken, `/accounts/${providerId(accountId)}/workers/domains`, {
      method: "PUT",
      body: { hostname: docs.hostname, service: owner.workerName, zone_id: zoneId },
    });
  } else {
    await request(fetchImpl, context.cloudflareToken, `/accounts/${providerId(accountId)}/workers/domains/${providerId(candidateDomains[0].id)}`, { method: "DELETE" });
  }

  const domainsAfterOwnership = await listDocsDomains(fetchImpl, context.cloudflareToken, accountId, zoneId, docs.hostname);
  assertOwner(domainsAfterOwnership, owner, candidateName);

  const dnsAfterOwnership = await listDocsDns(fetchImpl, context.cloudflareToken, zoneId, docs.hostname);
  if (!dns.present && dnsAfterOwnership.length === 1) {
    await request(fetchImpl, context.cloudflareToken, `/zones/${providerId(zoneId)}/dns_records/${providerId(dnsAfterOwnership[0].id)}`, { method: "DELETE" });
  } else if (dns.present) {
    const desired = dns.record;
    const current = dnsAfterOwnership.length === 1 ? normalizeDnsRecord(dnsAfterOwnership[0]) : null;
    if (!current || stableStringify(current) !== stableStringify(desired)) {
      const path = dnsAfterOwnership.length === 1
        ? `/zones/${providerId(zoneId)}/dns_records/${providerId(dnsAfterOwnership[0].id)}`
        : `/zones/${providerId(zoneId)}/dns_records`;
      await request(fetchImpl, context.cloudflareToken, path, { method: dnsAfterOwnership.length === 1 ? "PUT" : "POST", body: dnsRecordBody(desired) });
    }
  }

  assertOwner(await listDocsDomains(fetchImpl, context.cloudflareToken, accountId, zoneId, docs.hostname), owner, candidateName);
  assertDns(await listDocsDns(fetchImpl, context.cloudflareToken, zoneId, docs.hostname), dns);
}

function wranglerEnvironment(cloudflareToken) {
  return { injectedEnvironmentVariables: { CLOUDFLARE_API_TOKEN: cloudflareToken, NO_COLOR: "1" } };
}

export async function defaultTopologyAdapter(operation, context) {
  if (operation === "restore-legacy-version") {
    await context.commandAdapter(["pnpm", "exec", "wrangler", "rollback", context.firstCutover.legacyWorker.versionId, "--config", "wrangler.toml", "--yes"], wranglerEnvironment(context.cloudflareToken));
  } else if (operation === "restore-legacy-bindings") {
    await context.commandAdapter(["pnpm", "exec", "wrangler", "triggers", "deploy", "--config", "wrangler.toml"], wranglerEnvironment(context.cloudflareToken));
  } else if (operation === "restore-docs-prestate") await restoreDocsPrestate(context);
  else throw topologyError("broad or undeclared topology restore operation", "UNDECLARED_RESTORE_OPERATION");
}
