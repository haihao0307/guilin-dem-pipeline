import fs from 'node:fs';
import path from 'node:path';

const here = path.dirname(new URL(import.meta.url).pathname);
const fixturePath = path.join(here, 'visual_golden_fixture_n38.json');
const resultPath = path.join(here, 'visual_golden_result_n38.json');
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

function captureState(record) {
  const shot = record.screenshotCapture;
  return record.workflowConclusion === 'success' && shot?.captured && shot.paths?.length
    ? 'VISUAL_EVIDENCE_CAPTURED'
    : 'HOLD_VISUAL_EVIDENCE_MISSING';
}

function stateRoundtripState(record) {
  const s = record.stateRoundtrip;
  return s?.baselineTupleFrozen && s.transitionSequenceComplete && s.returnedTupleEqual && s.repeatCyclePassed
    ? 'STATE_ROUNDTRIP_VERIFIED'
    : 'UNKNOWN_NOT_RUN';
}

function visualRegressionState(record) {
  if (record.independentVisualObservation?.decision === 'reject') {
    return 'REJECTED_BY_VISUAL_OBSERVATION';
  }
  if (!record.baseline?.approved || !record.baseline.baselineApprovalReceipt) {
    return 'HOLD_NO_APPROVED_VISUAL_BASELINE';
  }
  if (record.baseline.updatedForCurrentCandidate &&
      record.baseline.baselineApprovedBy === record.producerIdentity) {
    return 'HOLD_BASELINE_UPDATE_SELF_APPROVED';
  }
  if (!record.screenshotCapture?.currentImageDigest || !record.baseline.baselineImageDigest) {
    return 'HOLD_VISUAL_IMAGE_IDENTITY_INCOMPLETE';
  }
  if (!record.screenshotCapture.comparisonExecuted || !record.comparison) {
    return 'HOLD_VISUAL_COMPARISON_NOT_RUN';
  }
  if (record.baseline.environment !== record.comparison.environment) {
    return 'HOLD_VISUAL_ENVIRONMENT_MISMATCH';
  }
  if (typeof record.comparison.actualDiff !== 'number' ||
      typeof record.comparison.threshold !== 'number') {
    return 'HOLD_VISUAL_COMPARISON_INCOMPLETE';
  }
  return record.comparison.actualDiff <= record.comparison.threshold
    ? 'VISUAL_REGRESSION_VERIFIED'
    : 'VISUAL_REGRESSION_DETECTED';
}

const first = fixture.historicalFirstRun;
const repair = fixture.historicalRepairRun;
const controls = fixture.counterfactualControls;
const observations = {
  firstCapture: captureState(first),
  firstVisualClaim: visualRegressionState(first),
  repairCapture: captureState(repair),
  repairStateRoundtrip: stateRoundtripState(repair),
  repairVisualClaim: visualRegressionState(repair),
  approvedIndependentBaseline: visualRegressionState(controls.approvedIndependentBaseline),
  selfApprovedBaselineUpdate: visualRegressionState(controls.selfApprovedBaselineUpdate),
  environmentMismatch: visualRegressionState(controls.environmentMismatch),
  regressionDetected: visualRegressionState(controls.regressionDetected)
};

const assertions = [
  ['first subject is pinned', first.testedSubjectSha === '2ae157f09512db7505ff64a1f78dfce4a97f039b'],
  ['first run identity is pinned', first.runId === '35890512697' && first.jobId === '107281492832'],
  ['first successful capture remains valid', observations.firstCapture === 'VISUAL_EVIDENCE_CAPTURED'],
  ['first stronger visual claim is rejected by observation', observations.firstVisualClaim === 'REJECTED_BY_VISUAL_OBSERVATION'],
  ['first run did not execute a golden comparison', first.screenshotCapture.comparisonExecuted === false],
  ['repair subject and run are pinned', repair.testedSubjectSha === 'd1e9b56f6456673d214ed165a8801a0beca0d249' && repair.runId === '35891489740'],
  ['repair state roundtrip is independently valid', observations.repairStateRoundtrip === 'STATE_ROUNDTRIP_VERIFIED'],
  ['repair visual regression claim still lacks an approved golden', observations.repairVisualClaim === 'HOLD_NO_APPROVED_VISUAL_BASELINE'],
  ['independently approved compatible golden passes', observations.approvedIndependentBaseline === 'VISUAL_REGRESSION_VERIFIED'],
  ['producer self-approved golden update is held', observations.selfApprovedBaselineUpdate === 'HOLD_BASELINE_UPDATE_SELF_APPROVED'],
  ['incompatible rendering environment is held', observations.environmentMismatch === 'HOLD_VISUAL_ENVIRONMENT_MISMATCH'],
  ['diff beyond frozen threshold is detected', observations.regressionDetected === 'VISUAL_REGRESSION_DETECTED']
].map(([name, passed]) => ({name, passed}));

const result = {
  probeId: 'VISUAL-GOLDEN-UPDATE-SEPARATION-001-N38-REPLAY',
  generatedAt: '2026-09-25T13:43:01+08:00',
  boundedQuestion: 'Can a producer-created or producer-updated visual golden authorize the same candidate?',
  assertions,
  summary: {
    passed: assertions.filter(x => x.passed).length,
    total: assertions.length,
    allPassed: assertions.every(x => x.passed)
  },
  observations,
  classification: 'Candidate partial',
  productionChanged: false,
  globalR2Changed: false,
  userAcceptance: 'Unknown'
};

fs.writeFileSync(resultPath, `${JSON.stringify(result, null, 2)}\n`);
if (!result.summary.allPassed) process.exitCode = 1;
console.log(JSON.stringify(result.summary));
