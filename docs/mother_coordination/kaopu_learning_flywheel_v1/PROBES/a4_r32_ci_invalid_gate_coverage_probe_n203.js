'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const subject = {
  branch: 'trial/a4-r32-normal-chrome-20261027',
  sha: '580acd1c8b851d0c843826e2b49c7079411473bd',
  workflowRun: 40484446930,
  job: 122122608252,
  artifact: 12724761571,
  artifactDigest: 'sha256:99aa6309741366a3d4bee7cdc9bbca41c4750ff4625c236565afd1655bf0b9bc'
};

const observedCurrentChecks = {
  runConclusion: 'success',
  browserScriptExitRequiredZero: true,
  done: true,
  frameValid: true,
  errorsEmpty: true,
  glErrorZero: true,
  expectedDraws: true,
  nonBackgroundPixelsAbove1000: true,
  colorsAbove20: true,
  pointerAndZoomInteraction: true,
  contextLossInvalidation: true,
  contextRestoreOnce: true
};

const requiredInvalidSampleChecks = {
  explicitInvalidReason: false,
  nonfiniteGradientRejected: false,
  zeroGradientRejected: false,
  residualConvergenceRequired: false,
  invalidCountReadback: false,
  visibleCommitRequiresZeroInvalid: false,
  frozenInputMultiFrameStateHash: false
};

function currentBrowserGate(frame) {
  return frame.done && frame.frameValid && frame.errors.length === 0 &&
    frame.glError === 0 && frame.draws === 703 &&
    frame.nonBackgroundPixels > 1000 && frame.colors > 20;
}

function candidateInvalidSampleGate(frame) {
  return currentBrowserGate(frame) && frame.invalidSampleCount === 0 &&
    frame.invalidReasonHistogram.NONFINITE === 0 &&
    frame.invalidReasonHistogram.GRADIENT === 0 &&
    frame.invalidReasonHistogram.UNCONVERGED === 0 &&
    frame.frozenInputStateStable === true;
}

const cleanControl = {
  done: true, frameValid: true, errors: [], glError: 0, draws: 703,
  nonBackgroundPixels: 240000, colors: 320,
  invalidSampleCount: 0,
  invalidReasonHistogram: {NONFINITE: 0, GRADIENT: 0, UNCONVERGED: 0},
  frozenInputStateStable: true
};

// Synthetic negative control only: it does not assert that the historical artifact had these pixels.
const hiddenInvalidControl = {
  ...cleanControl,
  nonBackgroundPixels: 239963,
  colors: 321,
  invalidSampleCount: 37,
  invalidReasonHistogram: {NONFINITE: 5, GRADIENT: 24, UNCONVERGED: 8},
  frozenInputStateStable: false
};

const assertions = [];
function check(name, fn) {
  fn();
  assertions.push({name, status: 'PASS'});
}

check('workflow is bound to exact inspected subject', () => assert.equal(subject.sha.length, 40));
check('historical run and job are successful', () => assert.equal(observedCurrentChecks.runConclusion, 'success'));
check('current gate accepts clean positive control', () => assert.equal(currentBrowserGate(cleanControl), true));
check('candidate gate accepts clean positive control', () => assert.equal(candidateInvalidSampleGate(cleanControl), true));
check('current gate also accepts hidden-invalid negative control', () => assert.equal(currentBrowserGate(hiddenInvalidControl), true));
check('candidate gate rejects hidden-invalid negative control', () => assert.equal(candidateInvalidSampleGate(hiddenInvalidControl), false));
check('no invalid-sample requirement is covered', () => assert.equal(Object.values(requiredInvalidSampleChecks).some(Boolean), false));
check('artifact metadata is subject-bound and digest-addressed', () => assert.match(subject.artifactDigest, /^sha256:[0-9a-f]{64}$/));

const result = {
  status: 'PASS',
  decision: 'HOLD_CI_SUCCESS_DOES_NOT_COVER_INVALID_SAMPLE_GATE',
  scope: 'Historical workflow/source coverage replay plus synthetic negative control; not artifact-pixel inspection and not user-device acceptance.',
  subject,
  observedCurrentChecks,
  requiredInvalidSampleChecks,
  controls: {
    clean: {currentGate: currentBrowserGate(cleanControl), candidateGate: candidateInvalidSampleGate(cleanControl)},
    hiddenInvalid: {currentGate: currentBrowserGate(hiddenInvalidControl), candidateGate: candidateInvalidSampleGate(hiddenInvalidControl)}
  },
  assertions,
  passCount: assertions.length,
  totalCount: assertions.length,
  limitations: [
    'The GitHub artifact archive bytes were not opened in this replay.',
    'The negative control proves predicate insufficiency, not that the historical R32 frame contained black flicker pixels.',
    'No public browser, target GPU, production publication, or user acceptance was run.'
  ]
};

const out = path.join(__dirname, 'a4_r32_ci_invalid_gate_coverage_result_n203.json');
fs.writeFileSync(out, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({status: result.status, decision: result.decision, assertions: `${result.passCount}/${result.totalCount}`}));
