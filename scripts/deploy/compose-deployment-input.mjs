#!/usr/bin/env node
// Compose an immutable deployment input from the release pin.
//
//   node scripts/deploy/compose-deployment-input.mjs \
//     --environment staging|production \
//     --product-sha <40-hex> --evidence-sha <40-hex> \
//     [--units docs,edge] [--pin releases/ariadnev.json] --out deployment/inputs/<name>.json
//
// Every digest is computed from committed bytes: the synchronised bundle,
// manifest, and checksums under `releases/`, the trusted schema digest from
// `packages/contracts`, and the ingress policy digest for the environment. No
// value is typed by hand, so an input can only describe what the repository
// actually contains at the commit it names.

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { TRUSTED_SCHEMA_DIGEST } from "../../packages/contracts/dist/index.js";
import { digestPolicy, loadPolicy } from "../edge-ingress-policy.mjs";
import { repoRoot, validateDeploymentInput } from "./validate-deployment-input.mjs";

function argument(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1 || !process.argv[index + 1] || process.argv[index + 1].startsWith("--")) {
    if (fallback !== undefined) return fallback;
    throw new Error(`--${name} is required`);
  }
  return process.argv[index + 1];
}

const sha256 = (buffer) => `sha256:${createHash("sha256").update(buffer).digest("hex")}`;

export function composeDeploymentInput({ environment, productSha, evidenceSha, units, pinPath }) {
  const pin = JSON.parse(readFileSync(resolve(repoRoot, pinPath), "utf8"));
  const bundle = readFileSync(resolve(repoRoot, pin.bundle));
  if (pin.bundleSha256 && sha256(bundle) !== `sha256:${pin.bundleSha256}`) throw new Error("bundle bytes do not match the release pin's bundleSha256");
  const manifest = readFileSync(resolve(repoRoot, pin.manifest));
  const checksums = readFileSync(resolve(repoRoot, pin.bundle.replace(/[^/]+$/, "checksums.txt")));
  return {
    schemaVersion: 1,
    environment,
    topology: "candidate-b",
    productSha,
    qualificationEvidenceSha: evidenceSha,
    release: { tag: pin.tag, version: pin.version, coreSha: pin.sourceSha },
    digests: {
      docsBundle: sha256(bundle),
      docsManifest: sha256(manifest),
      docsSchema: TRUSTED_SCHEMA_DIGEST,
      checksums: sha256(checksums),
    },
    units,
    ingressPolicyDigest: digestPolicy(loadPolicy(), environment),
  };
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop())) {
  const input = composeDeploymentInput({
    environment: argument("environment"),
    productSha: argument("product-sha"),
    evidenceSha: argument("evidence-sha"),
    units: argument("units", "docs,edge").split(",").filter(Boolean),
    pinPath: argument("pin", "releases/ariadnev.json"),
  });
  const { valid, errors } = validateDeploymentInput(input);
  if (!valid) {
    console.error(`composed input is invalid:\n  ${errors.join("\n  ")}`);
    process.exit(1);
  }
  const out = argument("out");
  writeFileSync(resolve(repoRoot, out), `${JSON.stringify(input, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ wrote: out, environment: input.environment, release: input.release.tag, units: input.units }));
}
