import fs from 'node:fs';
import crypto from 'node:crypto';

const stable = value => {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
};

const digest = value => `sha256:${crypto.createHash('sha256').update(stable(value)).digest('hex')}`;

function evaluate(contract, observed) {
  const contractDigest = digest(contract);
  if (!contract?.claimId || !contract?.subjectHeadSha || !Array.isArray(contract?.requiredGates)) {
    return {verdict: 'UNKNOWN_CLAIM_CONTRACT_MISSING', contractDigest};
  }
  if (observed?.subjectHeadSha !== contract.subjectHeadSha) {
    return {verdict: 'HOLD_CLAIM_SUBJECT_MISMATCH', contractDigest};
  }
  if (contract.requiresTaskAnchor && !observed.taskAnchorDigest) {
    return {verdict: 'HOLD_TASK_ANCHOR_MISSING', contractDigest};
  }
  if (contract.requiresTaskAnchor && observed.taskAnchorDigest !== contract.taskAnchorDigest) {
    return {verdict: 'HOLD_TASK_ANCHOR_MISMATCH', contractDigest};
  }

  const receipts = observed.gateReceipts || [];
  const required = contract.requiredGates.map(gate => typeof gate === 'string' ? {gateId: gate} : gate);
  const missing = required.filter(gate => !receipts.some(receipt => receipt.gateId === gate.gateId));
  if (missing.length) {
    return {verdict: 'HOLD_REQUIRED_GATE_MISSING', missingGateIds: missing.map(gate => gate.gateId), contractDigest};
  }

  for (const gate of required) {
    const receipt = receipts.find(item => item.gateId === gate.gateId);
    if (receipt.subjectHeadSha !== contract.subjectHeadSha) {
      return {verdict: 'HOLD_GATE_SUBJECT_MISMATCH', gateId: gate.gateId, contractDigest};
    }
    if (['skipped', 'cancelled', 'neutral', 'unknown'].includes(receipt.conclusion)) {
      return {verdict: 'HOLD_REQUIRED_GATE_NOT_RUN', gateId: gate.gateId, contractDigest};
    }
    if (receipt.conclusion !== 'success') {
      return {verdict: 'HOLD_REQUIRED_GATE_FAIL', gateId: gate.gateId, contractDigest};
    }
    if (gate.independentVerifierRequired && receipt.producerId === receipt.verifierId) {
      return {verdict: 'HOLD_SELF_APPROVED_GATE_RUN', gateId: gate.gateId, contractDigest};
    }
  }

  return {verdict: 'CLAIM_VERIFIED', verifiedClaim: contract.claimId, contractDigest};
}

const fixturePath = process.argv[2] || new URL('./claim_gate_fixture_n42.json', import.meta.url);
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
const byId = new Map(fixture.cases.map(testCase => [testCase.id, testCase]));
const results = fixture.cases.map(testCase => {
  const contract = testCase.contractRef ? byId.get(testCase.contractRef).contract : testCase.contract;
  const actual = evaluate(contract, testCase.observed);
  return {
    id: testCase.id,
    expectedVerdict: testCase.expectedVerdict,
    actualVerdict: actual.verdict,
    passed: actual.verdict === testCase.expectedVerdict,
    missingGateIds: actual.missingGateIds || [],
    gateId: actual.gateId || null,
    verifiedClaim: actual.verifiedClaim || null,
    contractDigest: actual.contractDigest
  };
});

const output = {
  schema: 'kaopu.claim-gate-dependency-result/1.0',
  candidateCaseId: fixture.candidateCaseId,
  total: results.length,
  passed: results.filter(result => result.passed).length,
  failed: results.filter(result => !result.passed).length,
  allPassed: results.every(result => result.passed),
  results
};

process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
if (!output.allPassed) process.exitCode = 1;
