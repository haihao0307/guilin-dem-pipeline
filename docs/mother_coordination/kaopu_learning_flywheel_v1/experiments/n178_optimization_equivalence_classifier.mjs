import assert from 'node:assert/strict';

export function classify(e) {
  if (!e.sourceBound || !e.inputBound || !e.thresholdsUnchanged || e.rollbackCountedAsAccepted)
    return 'INVALID_EVIDENCE';
  if (e.pairedRun && !e.exactStateEquality)
    return 'REFERENCE_COMPARISON_FAILED';
  const paired = e.pairedRun && e.exactStateEquality && e.pairedAcceptedSteps > 0 && e.pairedFieldsComplete;
  const long = e.candidateLongRun && e.candidateLongRunPassed && e.longRunAuditedSteps > 0;
  if (paired && long) return 'TRACE_EQUIVALENCE_VERIFIED_SCOPED__LONG_RUN_ACCEPTANCE_VERIFIED';
  if (paired) return 'TRACE_EQUIVALENCE_VERIFIED_SCOPED__LONG_RUN_UNKNOWN';
  if (long) return 'LONG_RUN_ACCEPTANCE_VERIFIED__EQUIVALENCE_UNPROVEN';
  return 'INSUFFICIENT_EVIDENCE';
}

const base = {
  sourceBound: true,
  inputBound: true,
  thresholdsUnchanged: true,
  rollbackCountedAsAccepted: false,
  pairedRun: true,
  exactStateEquality: true,
  pairedAcceptedSteps: 8,
  pairedFieldsComplete: true,
  candidateLongRun: true,
  candidateLongRunPassed: true,
  longRunAuditedSteps: 240
};

const cases = [
  [base, 'TRACE_EQUIVALENCE_VERIFIED_SCOPED__LONG_RUN_ACCEPTANCE_VERIFIED'],
  [{...base, candidateLongRun: false, candidateLongRunPassed: false, longRunAuditedSteps: 0}, 'TRACE_EQUIVALENCE_VERIFIED_SCOPED__LONG_RUN_UNKNOWN'],
  [{...base, pairedRun: false, exactStateEquality: false, pairedAcceptedSteps: 0, pairedFieldsComplete: false}, 'LONG_RUN_ACCEPTANCE_VERIFIED__EQUIVALENCE_UNPROVEN'],
  [{...base, exactStateEquality: false}, 'REFERENCE_COMPARISON_FAILED'],
  [{...base, sourceBound: false}, 'INVALID_EVIDENCE'],
  [{...base, inputBound: false}, 'INVALID_EVIDENCE'],
  [{...base, thresholdsUnchanged: false}, 'INVALID_EVIDENCE'],
  [{...base, rollbackCountedAsAccepted: true}, 'INVALID_EVIDENCE'],
  [{...base, pairedFieldsComplete: false, candidateLongRun: false, candidateLongRunPassed: false, longRunAuditedSteps: 0}, 'INSUFFICIENT_EVIDENCE'],
  [{...base, pairedRun: false, exactStateEquality: false, pairedAcceptedSteps: 0, pairedFieldsComplete: false, candidateLongRun: false, candidateLongRunPassed: false, longRunAuditedSteps: 0}, 'INSUFFICIENT_EVIDENCE']
];

for (const [fixture, expected] of cases) assert.equal(classify(fixture), expected);
console.log(JSON.stringify({passed: cases.length, total: cases.length}));
