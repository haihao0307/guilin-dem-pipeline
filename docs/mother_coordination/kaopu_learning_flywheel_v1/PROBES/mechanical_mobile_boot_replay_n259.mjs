import assert from 'node:assert/strict';
import fs from 'node:fs';

const inputPath = process.argv[2] ?? './n259_mechanical_mobile_boot_observations.json';
const evidence = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

assert.equal(evidence.existingRegression, 'USER-VISIBLE-BOOT-BEFORE-PAYLOAD-001');
assert.equal(evidence.newRegressionCreated, false);
assert.equal(evidence.observations.length, 4);

const byName = Object.fromEntries(evidence.observations.map(item => [item.fileName, item]));

for (const name of ['IMG_8593.png', 'IMG_8594.png', 'IMG_8597.png']) {
  assert.ok(byName[name].decision.includes('PASS_VISIBLE_FAILURE_SHELL_OBSERVED'));
  assert.ok(byName[name].decision.includes('HOLD_FINAL_RUNTIME_NOT_READY'));
}

const blank = byName['IMG_8596.png'];
assert.ok(blank.decision.includes('REJECT_USER_VISIBLE_BOOT_CLAIM_FOR_OBSERVED_SESSION'));
assert.ok(blank.decision.includes('HOLD_EXACT_SUBJECT_UNBOUND'));
assert.ok(blank.decision.includes('HOLD_ROOT_CAUSE_UNKNOWN'));
assert.ok(!blank.decision.includes('HOLD_USER_DEVICE_CAPABILITY_UNKNOWN') ||
  blank.decision.includes('HOLD_DEVICE_AND_BROWSER_IDENTITY_UNKNOWN'));

assert.ok(evidence.nonClaims.some(x => x.includes('does not prove that WebGPU caused')));
assert.ok(evidence.nonClaims.some(x => x.includes('not proven to be the same URL')));
assert.ok(evidence.minimumMechanicalTrial.faults.includes('hold response before primary payload'));
assert.ok(evidence.minimumMechanicalTrial.requiredEvidence.includes('visible build/head marker'));

const result = {
  schema: 'kaopu.probe-result/1',
  probeId: 'N259-MECHANICAL-MOBILE-BOOT-REPLAY',
  existingRegression: evidence.existingRegression,
  checks: {
    visibleFailureShellObservations: '3/3 PASS',
    blankSessionRejectsBootClaim: 'PASS',
    exactSubjectRemainsUnknown: 'PASS',
    rootCauseRemainsUnknown: 'PASS',
    deviceCapabilityNotInferred: 'PASS',
    duplicateRegressionAvoided: 'PASS'
  },
  conclusion: 'EXISTING_N33_REGRESSION_APPLIES_TO_NEW_MECHANICAL_OBSERVATION',
  lifecycle: {
    implemented: 'evidence replay only',
    gateRun: true,
    adopted: false,
    userAccepted: false
  }
};

console.log(JSON.stringify(result, null, 2));
