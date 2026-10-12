import fs from 'node:fs';

const fixturePath = process.argv[2] || new URL('./CANDIDATE_HUMAN_EAR_REFERENCE_ANATOMY_IDENTITY_001.json', import.meta.url);
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

function classify(x) {
  const hasIdentity = Boolean(x.subjectBound && x.referenceSetDigest && x.anatomyAnchorLedgerDigest);
  if (!hasIdentity) return 'HOLD_REFERENCE_ANATOMY_IDENTITY_UNBOUND';
  if ((x.proceduralDefaultsAppliedToUnknown || []).some(id => (x.unknownOrOccludedAnchorIds || []).includes(id))) {
    return 'HOLD_UNKNOWN_REGION_CREATIVE_SUBSTITUTE';
  }
  if (x.referenceApprovedBy && x.referenceApprovedBy === x.producerIdentity) {
    return 'HOLD_REFERENCE_BASELINE_SELF_APPROVED';
  }
  if (!x.comparisonExecuted) return 'HOLD_REFERENCE_COMPARISON_NOT_RUN';
  if (!x.frozenThresholds || !x.verifierIdentity || !x.verifierReceipt) {
    return 'HOLD_REFERENCE_COMPARISON_NOT_RUN';
  }
  return x.comparisonDecision === 'pass'
    ? 'SCOPED_REFERENCE_ANATOMY_VALIDATED'
    : 'REFERENCE_ANATOMY_REGRESSION_DETECTED';
}

const assertions = fixture.fixtures.map(test => ({
  id: test.id,
  expected: test.expect,
  actual: classify(test.input),
  passed: classify(test.input) === test.expect
}));
const result = {
  probeId: 'HUMAN-EAR-REFERENCE-ANATOMY-IDENTITY-001-N145-REPLAY',
  boundedQuestion: fixture.boundedQuestion,
  assertions,
  summary: {
    passed: assertions.filter(x => x.passed).length,
    total: assertions.length,
    allPassed: assertions.every(x => x.passed)
  },
  productionChanged: false,
  globalR2Changed: false,
  productionThresholds: 'UNKNOWN'
};
console.log(JSON.stringify(result, null, 2));
if (!result.summary.allPassed) process.exitCode = 1;
