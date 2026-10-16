import fs from 'node:fs';
import assert from 'node:assert/strict';

const fixture = JSON.parse(fs.readFileSync(new URL('./material_prepromotion_closure_n166.json', import.meta.url)));

export function classify(input) {
  if (!input.subjectSha || !input.workflowHeadSha || input.subjectSha !== input.workflowHeadSha) {
    return 'HOLD_CLAIM_EXACT_GATE_SUBJECT_UNBOUND';
  }
  if (input.gateConclusion !== 'success' || !input.gateCompletedAt) {
    return 'HOLD_CLAIM_CRITICAL_EVIDENCE_INCOMPLETE';
  }
  if (input.promotedAt && new Date(input.gateCompletedAt) >= new Date(input.promotedAt)) {
    return 'POST_PROMOTION_REVALIDATED__PREPROMOTION_SEQUENCE_EXCEPTION_RETAINED';
  }
  if (!input.independentVerifierReceipt) {
    return 'HOLD_PREPROMOTION_INDEPENDENT_VERIFIER_UNBOUND';
  }
  if (!input.promotedAt) return 'PREPROMOTION_GATE_VERIFIED__PROMOTION_ELIGIBLE';
  return 'PROMOTION_SEQUENCE_VERIFIED';
}

const beforeMerge = {
  subjectSha: 'candidate',
  workflowHeadSha: 'candidate',
  gateCompletedAt: '2026-10-16T19:30:00Z',
  gateConclusion: 'success',
  independentVerifierReceipt: true
};

const cases = [
  ['missing exact subject identity', {...beforeMerge, subjectSha: null}, 'HOLD_CLAIM_EXACT_GATE_SUBJECT_UNBOUND'],
  ['green workflow belongs to another head', {...beforeMerge, workflowHeadSha: 'other'}, 'HOLD_CLAIM_EXACT_GATE_SUBJECT_UNBOUND'],
  ['exact head but gate failed', {...beforeMerge, gateConclusion: 'failure'}, 'HOLD_CLAIM_CRITICAL_EVIDENCE_INCOMPLETE'],
  ['current initial Material commit entered main before its green run', fixture.initialMaterialCommit, fixture.initialMaterialCommit.expectedState],
  ['current refined Material commit entered main before its green run', fixture.refinementCommit, fixture.refinementCommit.expectedState],
  ['prepromotion exact-head gate lacks independent verifier', {...beforeMerge, independentVerifierReceipt: false}, 'HOLD_PREPROMOTION_INDEPENDENT_VERIFIER_UNBOUND'],
  ['exact-head gate and independent verifier complete before any promotion', beforeMerge, 'PREPROMOTION_GATE_VERIFIED__PROMOTION_ELIGIBLE'],
  ['main ref updated only after exact-head gate and verifier', {...beforeMerge, promotedAt: '2026-10-16T19:31:00Z'}, 'PROMOTION_SEQUENCE_VERIFIED']
];

const results = cases.map(([name, input, expected]) => {
  const actual = classify(input);
  assert.equal(actual, expected, name);
  return {name, expected, actual, pass: true};
});

const output = {
  schema: 'kaopu/material-prepromotion-closure-result@1',
  fixture: 'material_prepromotion_closure_n166.json',
  passed: results.length,
  total: results.length,
  initialState: classify(fixture.initialMaterialCommit),
  refinementState: classify(fixture.refinementCommit),
  claimBoundary: fixture.claimBoundary,
  results
};

fs.writeFileSync(new URL('./material_prepromotion_closure_result_n166.json', import.meta.url), JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify(output, null, 2));
