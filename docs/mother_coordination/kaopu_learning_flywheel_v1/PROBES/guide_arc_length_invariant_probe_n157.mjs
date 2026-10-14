import fs from 'node:fs';

const fixture = JSON.parse(fs.readFileSync(new URL('./guide_arc_length_invariant_n157.json', import.meta.url), 'utf8'));

function classify(x) {
  if (x.rootPinned === false) return 'HOLD_ROOT_PIN_FAIL';
  if (x.modalBendingEvidence === false) return 'HOLD_REDUCED_BENDING_EVIDENCE_MISSING';
  if (!x.restCenterlineBound || !x.deformedCenterlineBound || !x.segmentMetricBound || !x.totalMetricBound || !x.motionEnvelopeComplete) return 'HOLD_GUIDE_ARC_LENGTH_INVARIANT_UNBOUND';
  if (!x.thresholdBasisBound) return 'HOLD_GUIDE_ARC_LENGTH_THRESHOLD_UNBOUND';
  if (!x.positiveControlRun || !x.positiveControlDetected) return 'HOLD_ARC_LENGTH_POSITIVE_CONTROL_MISSING';
  if (x.maxSegmentStretchRatio > x.maxSegmentStretchLimit || x.totalArcLengthDriftRatio > x.totalArcLengthDriftLimit) return 'HOLD_GUIDE_STRETCH_OUT_OF_BOUND';
  return 'SCOPED_GUIDE_INEXTENSIBILITY_VERIFIED_NOT_FULL_ROD';
}

const assertions = fixture.cases.map(test => {
  const observed = classify(test.input);
  return {id: test.id, expected: test.expect, observed, passed: observed === test.expect};
});

const result = {
  probeId: fixture.probeId,
  generatedAt: fixture.generatedAt,
  boundedQuestion: 'Does Hair R05-M3 prove that positional grab bends a guide without satisfying the target through unmeasured centerline stretch?',
  subject: fixture.failure.observedSubject,
  verdict: 'REDUCED_BENDING_AND_RELEASE_VERIFIED__HOLD_GUIDE_ARC_LENGTH_INVARIANT_UNBOUND',
  assertions,
  summary: {passed: assertions.filter(x => x.passed).length, total: assertions.length, allPassed: assertions.every(x => x.passed)},
  productionChanged: false,
  globalR2Changed: false,
  userAcceptance: false
};

fs.writeFileSync(new URL('./guide_arc_length_invariant_result_n157.json', import.meta.url), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result.summary));
if (!result.summary.allPassed) process.exitCode = 1;
