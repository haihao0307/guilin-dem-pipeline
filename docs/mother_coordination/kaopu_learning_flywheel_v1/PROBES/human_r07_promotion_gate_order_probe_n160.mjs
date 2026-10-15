import fs from 'node:fs';
import assert from 'node:assert/strict';

const fixture = JSON.parse(fs.readFileSync(new URL('./human_r07_promotion_gate_order_n160.json', import.meta.url)));
const critical = ['boundedPromotionCheck', 'exactRebuild', 'candidateBrowser', 'exactPublicBrowser', 'finalGateReport'];

function fullSuccess(attempt) {
  return attempt?.conclusion === 'success' && critical.every((key) => attempt[key] === 'success');
}

export function classify(input) {
  if (!input.userAuthorized) return 'HOLD_USER_AUTHORIZATION_MISSING';
  if (input.runtimeDigest !== input.testedRuntimeDigest) return 'HOLD_UNTESTED_RUNTIME_DESCENDANT';
  if (input.attempts.length !== input.attemptCount || input.attempts.some((a, i) => a.attempt !== i + 1)) {
    return 'HOLD_ATTEMPT_LINEAGE_INCOMPLETE';
  }
  const success = input.attempts.find(fullSuccess);
  if (!input.promotionObservedByAt) {
    return success ? 'ELIGIBLE_FOR_PROMOTION' : 'HOLD_PREPROMOTION_GATE_INCOMPLETE';
  }
  if (!success) return 'PROMOTED_WITHOUT_PREPROMOTION_FINAL_CLOSURE';
  const passedBeforePromotion = Date.parse(success.completedAt) <= Date.parse(input.promotionObservedByAt);
  return passedBeforePromotion
    ? 'PROMOTION_ORDER_VERIFIED'
    : 'POST_PROMOTION_REVALIDATED__PREPROMOTION_SEQUENCE_EXCEPTION_RETAINED';
}

const base = {
  userAuthorized: fixture.subject.userAuthorized,
  runtimeDigest: fixture.subject.runtimeSHA256,
  testedRuntimeDigest: fixture.subject.runtimeSHA256,
  promotionObservedByAt: fixture.subject.promotionObservedByAt,
  attemptCount: fixture.workflow.attemptCount,
  attempts: fixture.workflow.attempts
};

const cases = [
  ['missing user authority', {...base, userAuthorized: false}, 'HOLD_USER_AUTHORIZATION_MISSING'],
  ['runtime mutated after test', {...base, runtimeDigest: 'different'}, 'HOLD_UNTESTED_RUNTIME_DESCENDANT'],
  ['attempt lineage dropped', {...base, attempts: [base.attempts[1]]}, 'HOLD_ATTEMPT_LINEAGE_INCOMPLETE'],
  ['gate incomplete before any promotion', {...base, promotionObservedByAt: null, attemptCount: 1, attempts: [base.attempts[0]]}, 'HOLD_PREPROMOTION_GATE_INCOMPLETE'],
  ['complete gate makes candidate eligible', {...base, promotionObservedByAt: null, attemptCount: 1, attempts: [{...base.attempts[1], attempt: 1}]}, 'ELIGIBLE_FOR_PROMOTION'],
  ['promotion while only cancelled attempt exists', {...base, attemptCount: 1, attempts: [base.attempts[0]]}, 'PROMOTED_WITHOUT_PREPROMOTION_FINAL_CLOSURE'],
  ['success after canonical claim retains sequence exception', base, fixture.expectedState],
  ['success before promotion verifies ordering', {...base, promotionObservedByAt: '2026-10-15T04:00:00Z'}, 'PROMOTION_ORDER_VERIFIED'],
  ['user approval does not waive gate ordering', {...base, attemptCount: 1, attempts: [base.attempts[0]], userAuthorized: true}, 'PROMOTED_WITHOUT_PREPROMOTION_FINAL_CLOSURE']
];

const results = cases.map(([name, input, expected]) => {
  const actual = classify(input);
  assert.equal(actual, expected, name);
  return {name, expected, actual, pass: true};
});

const output = {
  schema: 'kaopu/promotion-gate-order-result@1',
  fixture: 'human_r07_promotion_gate_order_n160.json',
  passed: results.length,
  total: results.length,
  currentState: classify(base),
  temporalFacts: {
    canonicalClaimIssuedAt: fixture.subject.canonicalClaimIssuedAt,
    finalSuccessfulGateCompletedAt: fixture.workflow.attempts[1].completedAt,
    orderingSatisfied: false
  },
  results
};

fs.writeFileSync(new URL('./human_r07_promotion_gate_order_result_n160.json', import.meta.url), JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify(output, null, 2));
