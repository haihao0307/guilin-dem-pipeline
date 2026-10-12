import fs from 'node:fs';

const fixturePath = process.argv[2]
  || new URL('./CANDIDATE_TESTED_SUBJECT_NOT_MUTABLE_HEAD_001.json', import.meta.url);
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
const cases = fixture.attestationExtensionCandidate?.fixtures || [];

export function classify(input) {
  if (!input.artifactDigestMatches) return 'HOLD_ARTIFACT_DIGEST_MISMATCH';
  if (!input.attestationPresent) return 'HOLD_PROVENANCE_ATTESTATION_MISSING';
  if (!input.signatureVerified) return 'HOLD_PROVENANCE_SIGNATURE_INVALID';
  if (input.signerRepository !== input.expectedRepository
    || input.signerWorkflow !== input.expectedWorkflow) {
    return 'HOLD_PROVENANCE_SIGNER_SCOPE_MISMATCH';
  }
  if (input.sourceSha !== input.expectedSourceSha
    || input.sourceRef !== input.expectedSourceRef) {
    return 'HOLD_PROVENANCE_SOURCE_MISMATCH';
  }
  if (input.workflowConclusion !== 'success') {
    return 'HOLD_PROVENANCE_WORKFLOW_NOT_SUCCESS';
  }
  return input.existingPromotionGatesPassed
    ? 'PROVENANCE_VERIFIED__PROMOTION_ELIGIBLE'
    : 'PROVENANCE_VERIFIED__PROMOTION_HOLD_EXISTING_GATES';
}

const assertions = cases.map((test) => {
  const actual = classify(test.input);
  return {
    id: test.id,
    expected: test.expect,
    actual,
    passed: actual === test.expect
  };
});

const result = {
  schema: 'kaopu.probe-result/1',
  probeId: 'TESTED-SUBJECT-NOT-MUTABLE-HEAD-001-N147-ATTESTATION-REPLAY',
  boundedQuestion: 'Can signed artifact provenance distinguish stale/relabelled artifacts and wrong producer/workflow/source identity without bypassing existing semantic gates?',
  executionLayer: 'isolated-node-classification-replay',
  assertions,
  summary: {
    passed: assertions.filter((x) => x.passed).length,
    total: assertions.length,
    allPassed: assertions.every((x) => x.passed)
  },
  productionChanged: false,
  productionGateRun: false,
  globalR2Changed: false,
  productionThresholds: 'UNKNOWN'
};

console.log(JSON.stringify(result, null, 2));
if (!result.summary.allPassed) process.exitCode = 1;
