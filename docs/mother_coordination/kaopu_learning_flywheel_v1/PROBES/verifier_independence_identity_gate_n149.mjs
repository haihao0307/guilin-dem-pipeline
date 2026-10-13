import fs from 'node:fs';

const fixturePath = process.argv[2];
if (!fixturePath) throw new Error('fixture path is required');
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

export function classify(input) {
  if (!input.producerIdentityBound) return 'HOLD_PRODUCER_IDENTITY_UNBOUND';
  if (input.claimClass === 'AUTOMATED_CHECK') {
    return input.evidenceReceiptBound
      ? 'AUTOMATED_CHECK_VERIFIED__INDEPENDENT_APPROVAL_PENDING'
      : 'AUDIT_EVIDENCE_CAPTURED__HOLD_INDEPENDENT_VERIFIER_IDENTITY_UNBOUND';
  }
  if (!input.verifierIdentityBound) {
    return input.auditEvidenceCaptured
      ? 'AUDIT_EVIDENCE_CAPTURED__HOLD_INDEPENDENT_VERIFIER_IDENTITY_UNBOUND'
      : 'AUDIT_EVIDENCE_CAPTURED__HOLD_INDEPENDENT_VERIFIER_IDENTITY_UNBOUND';
  }
  if (!input.roleAssignmentBound) return 'HOLD_VERIFIER_ROLE_ASSIGNMENT_MISSING';
  if (input.samePrincipal) return 'REJECT_PRODUCER_SELF_APPROVAL';
  if (input.verifierAuthoredSubjectOrBaseline) return 'HOLD_TECHNICAL_INDEPENDENCE_UNPROVEN';
  if (input.producerCanAlterVerifierDecision) return 'HOLD_MANAGERIAL_DECISION_INDEPENDENCE_UNPROVEN';
  if (!input.verifierOriginalSubjectAccess || !input.verifierOriginalReferenceAccess) {
    return 'HOLD_EVIDENCE_SELECTION_INDEPENDENCE_UNPROVEN';
  }
  if (!input.criteriaFrozenBeforeReview || !input.decisionReceiptBound) {
    return 'HOLD_MANAGERIAL_DECISION_INDEPENDENCE_UNPROVEN';
  }
  return 'INDEPENDENT_VERIFIER_RECEIPT_VERIFIED';
}

const assertions = fixture.fixtures.map((test) => {
  const actual = classify(test.input);
  return {id:test.id, expected:test.expect, actual, passed:actual===test.expect};
});

const result = {
  schema:'kaopu.probe-result/1',
  probeId:'VERIFIER-INDEPENDENCE-IDENTITY-001-N149-CLASSIFICATION-REPLAY',
  boundedQuestion:'Can a separate branch/read-only workflow created and interpreted under an unbound or shared principal be called an independent verifier review?',
  executionLayer:'isolated-node-classification-replay',
  assertions,
  summary:{passed:assertions.filter(x=>x.passed).length,total:assertions.length,allPassed:assertions.every(x=>x.passed)},
  productionChanged:false,
  productionGateRun:false,
  globalR2Changed:false,
  productionThresholds:'UNKNOWN'
};

console.log(JSON.stringify(result,null,2));
if(!result.summary.allPassed) process.exitCode=1;
