import fs from 'node:fs';
import assert from 'node:assert/strict';

export function classify(input) {
  if (!input.functionalGatePassed) return 'HOLD_FUNCTIONAL_GATE_FAIL';
  if (!input.exactSubjectBound || !input.targetDefectSignatureBound || !input.independentVisualReview) {
    return 'HOLD_USER_CORRECTION_REGRESSION_UNBOUND';
  }
  if (!input.allPlannedPairsPresent) return 'HOLD_VISUAL_PAIR_COVERAGE_INCOMPLETE';
  if (!input.knownBadControlDetected) return 'HOLD_USER_CORRECTION_POSITIVE_CONTROL_MISSING';

  const byId = new Map(input.pairedViews.map((pair) => [pair.id, pair]));
  const claimed = input.claimedViewIds.map((id) => byId.get(id));
  if (claimed.some((pair) => !pair)) return 'HOLD_VISUAL_PAIR_COVERAGE_INCOMPLETE';
  if (claimed.some((pair) => !pair.defectPresentInBadControl || !pair.defectAbsentOrReducedInCandidate)) {
    return 'HOLD_USER_CORRECTION_SIGNATURE_RECURRED';
  }

  const outside = input.pairedViews.filter((pair) => !input.claimedViewIds.includes(pair.id));
  const outsideNotClearlyImproved = outside.some((pair) =>
    ['NO_PRACTICAL_IMPROVEMENT', 'WEAK_IMPROVEMENT'].includes(pair.visualDecision)
  );
  if (input.claimScope === 'WHOLE_LIP' && outsideNotClearlyImproved) {
    return 'HOLD_CORRECTION_SCOPE_OVERCLAIM';
  }

  if (input.claimScope !== 'NAMED_VIEW_SUBSET') return 'HOLD_CORRECTION_SCOPE_UNBOUND';
  if (input.userAccepted) return 'PARTIAL_CORRECTION_USER_ACCEPTED_SCOPED__PARENT_OPEN';
  return 'PARTIAL_CORRECTION_VERIFIED_SCOPED__HOLD_PARENT_CORRECTION_OPEN';
}

const fixturePath = new URL('./lip_visual_partial_scope_n173.json', import.meta.url);
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
const byCaseId = new Map(fixture.cases.map((item) => [item.id, item]));

function materialize(item) {
  const base = item.input
    ? structuredClone(item.input)
    : materialize(byCaseId.get(item.inputFrom));
  Object.assign(base, item.override || {});
  if (item.overridePair) {
    const pair = base.pairedViews.find((candidate) => candidate.id === item.overridePair.id);
    assert.ok(pair, `${item.id}: override pair ${item.overridePair.id} missing`);
    Object.assign(pair, item.overridePair);
  }
  return base;
}

let passed = 0;
for (const item of fixture.cases) {
  const actual = classify(materialize(item));
  assert.equal(actual, item.expect, `${item.id}: expected ${item.expect}, got ${actual}`);
  passed += 1;
}
console.log(JSON.stringify({ passed, total: fixture.cases.length, result: 'PASS' }));
