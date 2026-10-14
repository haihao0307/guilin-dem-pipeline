import fs from 'node:fs';

const fixture = JSON.parse(fs.readFileSync(new URL('./user_correction_regression_binding_n156.json', import.meta.url), 'utf8'));

function classify(x) {
  if (x.functionalEvidenceValid === false) return 'HOLD_FUNCTIONAL_GATE_FAIL';
  if (!x.userCorrectionRecorded || !x.rejectedSubjectBound || !x.defectSignatureBound || !x.regressionCaseDefined) return 'HOLD_USER_CORRECTION_REGRESSION_UNBOUND';
  if (!x.regressionRun) return 'HOLD_USER_CORRECTION_REGRESSION_NOT_RUN';
  if (!x.positiveControlDetected) return 'HOLD_USER_CORRECTION_POSITIVE_CONTROL_MISSING';
  if (!x.candidateSignaturePass) return 'HOLD_USER_CORRECTION_SIGNATURE_RECURRED';
  return x.userAccepted ? 'USER_ACCEPTED' : 'CORRECTION_REGRESSION_VERIFIED_NOT_USER_ACCEPTED';
}

const assertions = fixture.cases.map(test => ({id: test.id, expected: test.expect, observed: classify(test.input), passed: classify(test.input) === test.expect}));
const result = {
  probeId: 'USER-CORRECTION-REGRESSION-BINDING-001-N156',
  generatedAt: '2026-10-14T19:39:30+08:00',
  boundedQuestion: 'Did the rejected Skin R01 visual correction become an executable regression before R02 was presented?',
  subject: fixture.failure.observedSubject,
  verdict: 'FUNCTIONAL_EVIDENCE_PRESERVED__HOLD_USER_CORRECTION_REGRESSION_UNBOUND',
  assertions,
  summary: {passed: assertions.filter(x => x.passed).length, total: assertions.length, allPassed: assertions.every(x => x.passed)},
  productionChanged: false,
  globalR2Changed: false,
  userAcceptance: false
};
fs.writeFileSync(new URL('./user_correction_regression_binding_result_n156.json', import.meta.url), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result.summary));
if (!result.summary.allPassed) process.exitCode = 1;
