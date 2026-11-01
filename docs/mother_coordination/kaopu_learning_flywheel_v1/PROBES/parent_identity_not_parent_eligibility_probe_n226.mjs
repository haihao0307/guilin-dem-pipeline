const fixtures = [
  {
    id: 'KNOWN_REJECTED_HASH',
    input: {
      parentArtifactDigest: 'sha256:a7f6005d2b80fa3e80fba53067ccd997ad87abc6044c6758ad45909fdc3f739c',
      registryStatus: 'REJECTED'
    },
    expect: 'HOLD_REJECTED_DESCENDANT_PRESENT'
  },
  {
    id: 'KNOWN_PARTIAL_NOT_ACCEPTED_HASH',
    input: {
      parentArtifactDigest: 'sha256:e55963b24cfead249b416a55eff23f4973cd764a4e88bbd753e5e3eb4e10f59c',
      registryStatus: 'PARTIAL_NOT_ACCEPTED'
    },
    expect: 'HOLD_PARENT_ELIGIBILITY_UNBOUND'
  },
  {
    id: 'UNKNOWN_HASH_NOT_IN_REJECT_REGISTRY',
    input: {
      parentArtifactDigest: 'sha256:70c5304757435335853cfe97e619f6140c6597507dab0a97dd1a7bae8d8c9241',
      registryStatus: 'UNREVIEWED_NOT_AUTO_ACCEPTED'
    },
    expect: 'HOLD_PARENT_ELIGIBILITY_UNBOUND'
  },
  {
    id: 'DENYLIST_ABSENCE_CLAIMED_AS_ELIGIBILITY',
    input: {
      parentArtifactDigest: 'sha256:unknown-parent',
      registryStatus: 'UNREVIEWED_NOT_AUTO_ACCEPTED',
      denylistAbsenceClaimedAsEligibility: true
    },
    expect: 'REJECT_DENYLIST_ABSENCE_AS_PROMOTION_ELIGIBILITY'
  },
  {
    id: 'CONTROL_EXACT_SCOPED_ELIGIBILITY',
    input: {
      parentArtifactDigest: 'sha256:eligible-parent',
      registryStatus: 'ELIGIBLE_FOR_SCOPED_INHERITANCE',
      parentVerifierVerdict: 'ACCEPTED_FOR_SCOPED_INHERITANCE',
      parentAcceptedScope: ['rear-cover-support'],
      inheritedScope: ['rear-cover-support'],
      changedScope: ['rear-cover-surface'],
      independentVerifierIdentity: 'verifier:independent',
      childArtifactDigest: 'sha256:child'
    },
    expect: 'CANDIDATE_LINEAGE_ELIGIBLE_NOT_USER_ACCEPTED'
  }
];

function classify(input) {
  if (input.denylistAbsenceClaimedAsEligibility) {
    return 'REJECT_DENYLIST_ABSENCE_AS_PROMOTION_ELIGIBILITY';
  }
  if (input.registryStatus === 'REJECTED') return 'HOLD_REJECTED_DESCENDANT_PRESENT';
  if (input.registryStatus !== 'ELIGIBLE_FOR_SCOPED_INHERITANCE') {
    return 'HOLD_PARENT_ELIGIBILITY_UNBOUND';
  }
  const required = [
    'parentVerifierVerdict',
    'parentAcceptedScope',
    'inheritedScope',
    'changedScope',
    'independentVerifierIdentity',
    'childArtifactDigest'
  ];
  if (required.some((key) => input[key] == null)) return 'HOLD_PARENT_ELIGIBILITY_UNBOUND';
  return 'CANDIDATE_LINEAGE_ELIGIBLE_NOT_USER_ACCEPTED';
}

const results = fixtures.map((fixture) => {
  const actual = classify(fixture.input);
  return { id: fixture.id, expect: fixture.expect, actual, passed: actual === fixture.expect };
});
const output = {
  caseId: 'PARENT-IDENTITY-NOT-PARENT-ELIGIBILITY-001',
  increment: 'N226_REJECT_REGISTRY_UNKNOWN_FAIL_CLOSED',
  total: results.length,
  passed: results.filter((result) => result.passed).length,
  allPassed: results.every((result) => result.passed),
  results
};
console.log(JSON.stringify(output, null, 2));
if (!output.allPassed) process.exitCode = 1;
