import fs from 'node:fs';
import assert from 'node:assert/strict';

export function classify(input) {
  if (!input.technicalGatePassed) return 'HOLD_FUNCTIONAL_GATE_FAIL';
  if (!input.exactSubjectBound) return 'HOLD_CORRECTION_SCOPE_UNBOUND';
  if (!input.allPairFramesBound) return 'HOLD_VISUAL_PAIR_COVERAGE_INCOMPLETE';
  if (!input.independentVisualReview) return 'HOLD_INDEPENDENT_VISUAL_REVIEW_MISSING';
  if (!input.visualClaimInRequiredManifest || !input.executableDefectOracle || !input.oracleRun) {
    return 'TECHNICAL_DELTA_VERIFIED__HOLD_VISUAL_CORRECTION_CLAIM_NOT_EXECUTABLE';
  }
  if (!input.knownBadControlDetected) return 'HOLD_USER_CORRECTION_POSITIVE_CONTROL_MISSING';
  if (!input.candidateDefectAbsentOrReduced) return 'HOLD_USER_CORRECTION_SIGNATURE_RECURRED';
  if (input.claimScope !== 'NAMED_VIEW_SUBSET') return 'HOLD_CORRECTION_SCOPE_UNBOUND';
  if (input.userAccepted) return 'PARTIAL_CORRECTION_USER_ACCEPTED_SCOPED__PARENT_OPEN';
  return 'PARTIAL_CORRECTION_VERIFIED_SCOPED__HOLD_PARENT_CORRECTION_OPEN';
}

const fixturePath = new URL('./lip_visual_claim_executability_n174.json', import.meta.url);
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
const byCaseId = new Map(fixture.cases.map((item) => [item.id, item]));

function materialize(item) {
  const base = item.input ? structuredClone(item.input) : materialize(byCaseId.get(item.inputFrom));
  Object.assign(base, item.override || {});
  return base;
}

let passed = 0;
for (const item of fixture.cases) {
  const actual = classify(materialize(item));
  assert.equal(actual, item.expect, `${item.id}: expected ${item.expect}, got ${actual}`);
  passed += 1;
}
console.log(JSON.stringify({ passed, total: fixture.cases.length, result: 'PASS' }));
