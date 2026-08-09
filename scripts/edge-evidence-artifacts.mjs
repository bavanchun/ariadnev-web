import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import {
  sanitizeObservedCell,
  sanitizeText,
  validateObservedMatrix,
  validateSanitizedDecision,
  validateStagingStateRecord,
} from "./edge-evidence-policy.mjs";
import { ingressPolicyDigest, loadIngressPolicy } from "./edge-ingress-policy.mjs";

function renderDecision({ matrix, decision, cells, state }) {
  const rationale = sanitizeText(decision.rationale);
  const patterns = decision.routePatterns.map(sanitizeText);
  const commands = decision.commands.map(sanitizeText);
  const deployments = matrix.provenance.deployments;
  return [
    "# Edge Routing Topology Decision",
    "",
    `Observed at: ${matrix.environment.observedAt}`,
    `Selected candidate: ${decision.selectedCandidate}`,
    `Profile: ${state.selectedProfile}`,
    `Base URL: ${state.baseUrl}`,
    `Deployment version: ${deployments["candidate-b-final"].workerVersionId}`,
    `Rollback version: ${deployments["production-legacy"].workerVersionId}`,
    `Rollback result: ${state.rollbackResult}`,
    `Credential policy: operator-attested model=${matrix.attestation.permissionModel}; principal-role=${matrix.attestation.principalRole}; token-scope=${matrix.attestation.tokenScope}; repository=${matrix.attestation.repository}; contents=read; actions=write; contents-write=false; release-write=false; administration=false`,
    `Ingress guard: phase=${state.ingressGuard.phase}; action=${state.ingressGuard.action}; staging-enabled=${state.ingressGuard.enabled}; production-enabled=${state.ingressGuard.productionEnabled}; policy-digest=${state.ingressGuard.policyDigest}`,
    "",
    "## Rationale",
    rationale,
    "",
    "## Route patterns",
    ...patterns.map((value) => `- ${value}`),
    "",
    "## Observed route bindings",
    ...matrix.provenance.routeBindings.map((binding) => `- ${binding.host}${binding.pattern} (observed)`),
    "",
    "## Deployment provenance",
    ...Object.entries(deployments).map(([ref, deployment]) => `- ${ref}: ${deployment.environment}; ${deployment.profile}; ${deployment.purpose}; ${deployment.workerVersionId}; binding=${deployment.bindingStateRef}; retained=${deployment.retained}`),
    "",
    "## Transition provenance",
    ...matrix.provenance.transitions.map((transition) => `- ${transition.id}: mechanics=${transition.mechanicsResult}; application=${transition.applicationResult}; restored=${transition.restoredDeploymentRef}`),
    "",
    "## Explicit failed compatibility probe",
    ...matrix.provenance.compatibilityProbes.map((probe) => `- ${probe.id}#${probe.repetition}: expected=${probe.expectedStatus}; observed=${probe.status}; ${probe.contentClass}; retained-as-failure=true`),
    "",
    "The failed staging legacy compatibility probe does not satisfy rollback. The rollback target is the unchanged live production legacy deployment and existing credential context; mutation is prohibited until the rollback window closes.",
    "",
    "## Commands",
    ...commands.map((value) => `- ${value}`),
    "",
    "## Observed matrix",
    ...cells.map((cell) => `- ${cell.id}#${cell.repetition}: ${cell.pass ? "passed" : "failed"}; ${cell.status} ${cell.contentClass} ${cell.cacheControl} ${cell.requestPath}; deployment=${cell.deploymentRef}; cache=${cell.cacheState}${cell.notes ? `; ${cell.notes}` : ""}`),
    "",
  ].join("\n");
}

export async function writeDecisionArtifacts({ decisionPath, statePath, observedMatrix, decision, stagingState }) {
  validateSanitizedDecision(decision);
  validateObservedMatrix(observedMatrix, decision.selectedCandidate);
  const state = validateStagingStateRecord(stagingState);
  const ingressPolicy = await loadIngressPolicy();
  const expectedIngressDigest = ingressPolicyDigest(ingressPolicy, "staging");
  if (observedMatrix.provenance.ingressGuard.policyDigest !== expectedIngressDigest || state.ingressGuard.policyDigest !== expectedIngressDigest) {
    throw new Error("staging ingress evidence must match the source-controlled policy digest");
  }
  const finalDeployment = observedMatrix.provenance.deployments["candidate-b-final"];
  const rollbackDeployment = observedMatrix.provenance.deployments["production-legacy"];
  if (state.workerVersionId !== finalDeployment.workerVersionId) {
    throw new Error("retained staging version must equal observed deployment version");
  }
  if (state.baseUrl !== observedMatrix.environment.baseUrl.replace(/\/?$/, "/")) {
    throw new Error("retained staging URL must equal observed environment URL");
  }
  if (state.selectedProfile !== observedMatrix.environment.profile) {
    throw new Error("retained staging profile must equal observed environment profile");
  }
  if (state.selectedProfile !== "combined") throw new Error("selected Candidate B requires the combined profile");
  if (stagingState.rollbackOwner !== observedMatrix.provenance.rollbackTarget.owner || stagingState.expiryOwner !== observedMatrix.provenance.rollbackTarget.expiryOwner || stagingState.rollbackResult !== "passed-composite") {
    throw new Error("staging rollback record must equal observed rollback provenance");
  }
  if (state.rollbackTarget.workerVersionId !== rollbackDeployment.workerVersionId || state.rollbackTarget.baseUrl !== rollbackDeployment.baseUrl.replace(/\/?$/, "/")) {
    throw new Error("rollback target must equal retained production provenance");
  }
  const cells = observedMatrix.cells.map(sanitizeObservedCell);
  const markdown = `${renderDecision({ matrix: observedMatrix, decision, cells, state })}\n`;
  const stateJson = { ...state, observedAt: observedMatrix.environment.observedAt };
  await Promise.all([mkdir(dirname(decisionPath), { recursive: true }), mkdir(dirname(statePath), { recursive: true })]);
  await Promise.all([writeFile(decisionPath, markdown), writeFile(statePath, `${JSON.stringify(stateJson, null, 2)}\n`)]);
}
