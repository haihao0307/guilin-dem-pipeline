import fs from 'node:fs';
import assert from 'node:assert/strict';

const fixture = JSON.parse(fs.readFileSync(new URL('./tailor_wear_verdict_derivation_n163.json', import.meta.url)));

export function classify(input) {
  if (!input.rawEvidencePresent) return 'HOLD_RAW_EVIDENCE_MISSING';
  if (!input.committedVerdictGeneratorFound) return 'TRACE_EVIDENCE_PRESENT__HOLD_VERDICT_DERIVATION_UNBOUND';
  if (!input.criteriaFrozenBeforeRun) return 'AUTOMATED_CHECK_EXECUTED__HOLD_PREFROZEN_CRITERIA_UNBOUND';
  if (!input.independentVerifierReceiptFound) return 'AUTOMATED_CHECK_VERIFIED__INDEPENDENT_APPROVAL_PENDING';
  return 'INDEPENDENT_VERIFIER_RECEIPT_VERIFIED';
}

const current = {
  rawEvidencePresent: fixture.rawEvidence.wearTraceSamples === fixture.rawEvidence.wearSeconds,
  committedVerdictGeneratorFound: fixture.codeAudit.committedVerdictGeneratorFound,
  criteriaFrozenBeforeRun: fixture.codeAudit.frozenCriterionReceiptFound,
  independentVerifierReceiptFound: fixture.codeAudit.independentVerifierReceiptFound
};

const complete = {
  rawEvidencePresent: true,
  committedVerdictGeneratorFound: true,
  criteriaFrozenBeforeRun: true,
  independentVerifierReceiptFound: true
};

const cases = [
  ['raw evidence missing', {...complete, rawEvidencePresent: false}, 'HOLD_RAW_EVIDENCE_MISSING'],
  ['current T14 trace exists but verdict derivation is unbound', current, fixture.expectedState],
  ['handwritten pass label without executable derivation', {...current, reportPassField: true}, fixture.expectedState],
  ['predicate committed but criteria chosen after run', {...complete, criteriaFrozenBeforeRun: false}, 'AUTOMATED_CHECK_EXECUTED__HOLD_PREFROZEN_CRITERIA_UNBOUND'],
  ['frozen automated check still awaits independent approval', {...complete, independentVerifierReceiptFound: false}, 'AUTOMATED_CHECK_VERIFIED__INDEPENDENT_APPROVAL_PENDING'],
  ['exact subject, frozen predicate and independent receipt close the gate', complete, 'INDEPENDENT_VERIFIER_RECEIPT_VERIFIED']
];

const results = cases.map(([name, input, expected]) => {
  const actual = classify(input);
  assert.equal(actual, expected, name);
  return {name, expected, actual, pass: true};
});

const output = {
  schema: 'kaopu/tailor-wear-verdict-derivation-result@1',
  fixture: 'tailor_wear_verdict_derivation_n163.json',
  passed: results.length,
  total: results.length,
  currentState: classify(current),
  claimBoundary: {
    rawTraceEvidence: 'PRESENT',
    deterministicVerdictDerivation: 'UNBOUND',
    independentVerifierApproval: 'UNBOUND',
    staticMaterialAcceptance: 'FAILED',
    wearCertification: 'NOT_CLAIMED'
  },
  results
};

fs.writeFileSync(new URL('./tailor_wear_verdict_derivation_result_n163.json', import.meta.url), JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify(output, null, 2));
