const STABLE_SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

function fail(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

export function parseReleaseSelector(searchParams, rawSearch = "") {
  const rawPairs = String(rawSearch).replace(/^\?/, "").split("&").filter(Boolean);
  for (const pair of rawPairs) {
    const separator = pair.indexOf("=");
    const rawKey = separator < 0 ? pair : pair.slice(0, separator);
    const rawValue = separator < 0 ? "" : pair.slice(separator + 1);
    let decodedKey;
    try {
      decodedKey = decodeURIComponent(rawKey.replaceAll("+", " "));
    } catch {
      throw fail("invalid version selector");
    }
    if (decodedKey === "version" && (rawKey !== "version" || rawValue.includes("%"))) {
      throw fail("invalid version selector");
    }
  }

  const versions = searchParams.getAll("version");
  if (versions.length === 0) return { mode: "latest" };
  if (versions.length > 1) throw fail("duplicate version selector");

  const version = versions[0];
  if (version === "") throw fail("invalid version selector");

  if (!STABLE_SEMVER.test(version)) throw fail("invalid version selector");

  return {
    mode: "pinned",
    version,
    tag: `vcskill@${version}`,
  };
}
