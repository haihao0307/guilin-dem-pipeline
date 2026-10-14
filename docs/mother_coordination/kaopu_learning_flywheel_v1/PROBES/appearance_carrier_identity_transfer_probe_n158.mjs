import fs from 'node:fs';

const fixture = JSON.parse(fs.readFileSync(new URL('./appearance_carrier_identity_transfer_n158.json', import.meta.url), 'utf8'));

function classify(x) {
  if (x.functionalEvidenceValid === false) return 'HOLD_FUNCTIONAL_GATE_FAIL';
  if (!x.sourceMethodEvidence || !x.sourceLightPathProbe) return 'HOLD_SOURCE_METHOD_EVIDENCE_UNBOUND';
  if (!x.targetTransferPosted) return 'HOLD_TARGET_TRANSFER_NOT_POSTED';
  if (!x.targetAcknowledged) return 'HOLD_TARGET_TRANSFER_UNACKNOWLEDGED';
  if (!x.targetImplemented) return 'HOLD_TARGET_TRANSFER_NOT_IMPLEMENTED';
  if (!x.targetAblationRun) return 'HOLD_TARGET_CARRIER_ABLATION_NOT_RUN';
  if (!x.knownBadControlDetected) return 'HOLD_USER_CORRECTION_POSITIVE_CONTROL_MISSING';
  if (!x.carrierIsolationPass) return 'HOLD_APPEARANCE_CARRIER_IDENTITY_UNBOUND';
  return x.userAccepted ? 'USER_ACCEPTED' : 'CARRIER_IDENTITY_REGRESSION_VERIFIED_NOT_USER_ACCEPTED';
}

const assertions = fixture.cases.map(test => {
  const observed = classify(test.input);
  return {id: test.id, expected: test.expect, observed, passed: observed === test.expect};
});
const currentState = classify(fixture.observed);
const result = {
  probeId: 'USER-CORRECTION-REGRESSION-BINDING-001-SKIN-EAR-CARRIER-N158',
  generatedAt: '2026-10-15T03:42:47+08:00',
  boundedQuestion: fixture.boundedQuestion,
  sourceSubject: {
    pr: fixture.observed.sourcePr,
    sourceSha: fixture.observed.sourceSha,
    buildSha: fixture.observed.sourceBuildSha,
    handoffSha: fixture.observed.sourceHandoffSha,
    lightPathProbeRun: fixture.observed.sourceLightPathProbeRun
  },
  targetSubject: {
    pr: fixture.observed.targetPr,
    headSha: fixture.observed.targetHeadSha,
    transferReceipt: fixture.observed.targetTransferReceipt,
    n158RoutingReceipt: fixture.observed.n158RoutingReceipt
  },
  currentState,
  verdict: 'SOURCE_METHOD_VERIFIED__TARGET_TRANSFER_POSTED__HOLD_TARGET_TRANSFER_UNACKNOWLEDGED__CORRECTION_REGRESSION_UNBOUND',
  assertions,
  summary: {passed: assertions.filter(x => x.passed).length, total: assertions.length, allPassed: assertions.every(x => x.passed)},
  productionChanged: false,
  globalR2Changed: false,
  userAcceptance: false
};

fs.writeFileSync(new URL('./appearance_carrier_identity_transfer_result_n158.json', import.meta.url), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify({currentState, ...result.summary}));
if (!result.summary.allPassed) process.exitCode = 1;
