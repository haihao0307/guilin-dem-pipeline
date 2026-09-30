import fs from 'node:fs';

const fixturePath = process.argv[2];
const outputPath = process.argv[3];
if (!fixturePath || !outputPath) {
  throw new Error('usage: node tree_developmental_causal_gate_n50.mjs fixture.json result.json');
}

const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

function finiteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function adequateIntervention(intervention) {
  return Boolean(
    intervention &&
    intervention.nonUniform === true &&
    intervention.reversed === true &&
    finiteNumber(intervention.gradientMagnitude) &&
    intervention.gradientMagnitude > 0
  );
}

function vectorMagnitude(vector) {
  if (!Array.isArray(vector) || vector.length === 0 || !vector.every(finiteNumber)) return null;
  return Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
}

function cosineSimilarity(a, b) {
  const ma = vectorMagnitude(a);
  const mb = vectorMagnitude(b);
  if (ma === null || mb === null || ma === 0 || mb === 0 || a.length !== b.length) return null;
  return a.reduce((sum, value, index) => sum + value * b[index], 0) / (ma * mb);
}

function evaluate(c) {
  const holds = [];
  const notes = [];

  if (c.crossesDeclaredStageBoundary !== true) {
    if (c.crossesDeclaredStageBoundary === false && c.stageBoundarySourceFact) {
      return { decision: 'NOT_APPLICABLE_STAGE_BOUNDARY', holds, notes: ['The tested pair stays inside one declared stage.'] };
    }
    holds.push('HOLD_STAGE_BOUNDARY_EVIDENCE_MISSING');
  }

  if (c.ageDriverOnlyGlobalGeometryScalar === true) {
    holds.push('HOLD_DEVELOPMENT_ONLY_SCALAR');
  }

  if (c.crossesDeclaredStageBoundary === true) {
    const events = Array.isArray(c.developmentalEventTrace) ? c.developmentalEventTrace : [];
    const validEvents = events.filter(event => event && event.stableOrganId && event.eventId && event.stateBefore !== event.stateAfter);
    if (c.organLineageStableIds !== true || validEvents.length === 0) {
      holds.push('HOLD_TOPOLOGY_WITHOUT_EVENT_LINEAGE');
    }
  }

  const lightAdequate = adequateIntervention(c.lightIntervention);
  const soilAdequate = adequateIntervention(c.soilMoistureIntervention);
  if (!lightAdequate) holds.push('HOLD_LIGHT_INTERVENTION_INADEQUATE');
  if (!soilAdequate) holds.push('HOLD_SOIL_INTERVENTION_INADEQUATE');

  const shootLight = vectorMagnitude(c.shootResponseSignature?.toLight);
  const rootSoil = vectorMagnitude(c.rootResponseSignature?.toSoil);
  if (lightAdequate && !(shootLight > (c.minimumResponseMagnitude ?? 0))) {
    holds.push('HOLD_SHOOT_LIGHT_RESPONSE_MISSING');
  }
  if (soilAdequate && !(rootSoil > (c.minimumResponseMagnitude ?? 0))) {
    holds.push('HOLD_ROOT_SOIL_RESPONSE_MISSING');
  }

  const directCosine = cosineSimilarity(c.shootResponseSignature?.combined, c.rootResponseSignature?.combined);
  const reflectedCosine = cosineSimilarity(
    c.shootResponseSignature?.combined,
    Array.isArray(c.rootResponseSignature?.combined)
      ? c.rootResponseSignature.combined.map((value, index) => index === 1 ? -value : value)
      : null
  );
  const conflationLimit = c.maximumAbsoluteResponseCosine ?? 0.999;
  if (c.sharedGenericRecursion === true && (
    (directCosine !== null && Math.abs(directCosine) >= conflationLimit) ||
    (reflectedCosine !== null && Math.abs(reflectedCosine) >= conflationLimit)
  )) {
    holds.push('HOLD_ROOT_SHOOT_RESPONSE_CONFLATED');
  }

  const collar = c.collarContinuity || {};
  const collarPass = finiteNumber(collar.positionGap) && finiteNumber(collar.tangentAngleDegrees) &&
    finiteNumber(collar.maxPositionGap) && finiteNumber(collar.maxTangentAngleDegrees) &&
    collar.positionGap <= collar.maxPositionGap &&
    collar.tangentAngleDegrees <= collar.maxTangentAngleDegrees;
  if (!collarPass) holds.push('HOLD_COLLAR_DISCONTINUITY');

  const receipt = c.verifierReceipt;
  const receiptComplete = Boolean(
    receipt &&
    c.producerIdentity &&
    c.producerExecutionRoot &&
    receipt.verifierIdentity &&
    receipt.verifierExecutionRoot &&
    receipt.verificationRunId &&
    receipt.evidenceDigest
  );
  let verifierIndependent = null;
  if (!receiptComplete) {
    holds.push('HOLD_VERIFIER_EVIDENCE_MISSING');
  } else {
    verifierIndependent = c.producerIdentity !== receipt.verifierIdentity &&
      c.producerExecutionRoot !== receipt.verifierExecutionRoot;
    if (!verifierIndependent) holds.push('HOLD_VERIFIER_NOT_INDEPENDENT');
    if (!c.subjectSha || receipt.verificationSubjectSha !== c.subjectSha) {
      holds.push('HOLD_VERIFIED_SUBJECT_MISMATCH');
    }
    if (receipt.result !== 'PASS') holds.push('HOLD_VERIFIER_GATE_NOT_PASSED');
  }

  return {
    decision: holds.length ? holds[0] : 'TREE_CAUSAL_SEPARATION_VERIFIED_ONLY',
    holds: [...new Set(holds)],
    notes,
    diagnostics: { directCosine, reflectedCosine, shootLight, rootSoil, verifierIndependent }
  };
}

const results = fixture.cases.map(c => {
  const observed = evaluate(c);
  const pass = observed.decision === c.expectedDecision &&
    (c.expectedHolds || []).every(state => observed.holds.includes(state));
  return { id: c.id, expectedDecision: c.expectedDecision, expectedHolds: c.expectedHolds || [], observed, pass };
});

const output = {
  runId: fixture.runId,
  generatedAt: new Date().toISOString(),
  cases: results,
  summary: {
    total: results.length,
    passed: results.filter(result => result.pass).length,
    failed: results.filter(result => !result.pass).length
  }
};

fs.writeFileSync(outputPath, JSON.stringify(output, null, 2) + '\n');
if (output.summary.failed) process.exitCode = 1;
