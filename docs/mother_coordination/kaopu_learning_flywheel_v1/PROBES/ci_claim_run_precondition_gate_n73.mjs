import assert from 'node:assert/strict';

function decide(x) {
  const exact = x.runs.filter(r => r.headSha === x.claimedHeadSha);
  if (exact.length === 0) return 'HOLD_CLAIM_NO_WORKFLOW_RUN';
  const run = exact[0];
  if (run.conclusion !== 'success') return 'HOLD_CLAIM_RUN_NOT_SUCCESS';
  for (const step of x.requiredSteps) {
    if (run.steps?.[step] !== 'success') return 'HOLD_CLAIM_INCOMPLETE';
  }
  if (!x.proofPredicatesMatch) return 'HOLD_CLAIM_INVALID';
  return 'CLAIM_VERIFIED';
}

const fixtures = [
  {
    name: 'hypothetical-zero-run-precondition-control-not-current-r15-evidence',
    claimedHeadSha: '4fdc1213914a668e6d63017081c128c7ef3edc4b',
    runs: [], requiredSteps: ['verify'], proofPredicatesMatch: false,
    expected: 'HOLD_CLAIM_NO_WORKFLOW_RUN'
  },
  {
    name: 'run-belongs-to-different-head',
    claimedHeadSha: '4fdc1213914a668e6d63017081c128c7ef3edc4b',
    runs: [{ headSha: '2f4639c9d73ff58303072697f5c10e541e0703fa', conclusion: 'success', steps: { verify: 'success' } }],
    requiredSteps: ['verify'], proofPredicatesMatch: true,
    expected: 'HOLD_CLAIM_NO_WORKFLOW_RUN'
  },
  {
    name: 'exact-run-required-step-missing',
    claimedHeadSha: '4fdc1213914a668e6d63017081c128c7ef3edc4b',
    runs: [{ headSha: '4fdc1213914a668e6d63017081c128c7ef3edc4b', conclusion: 'success', steps: {} }],
    requiredSteps: ['verify'], proofPredicatesMatch: true,
    expected: 'HOLD_CLAIM_INCOMPLETE'
  },
  {
    name: 'exact-run-complete-control',
    claimedHeadSha: '4fdc1213914a668e6d63017081c128c7ef3edc4b',
    runs: [{ headSha: '4fdc1213914a668e6d63017081c128c7ef3edc4b', conclusion: 'success', steps: { verify: 'success' } }],
    requiredSteps: ['verify'], proofPredicatesMatch: true,
    expected: 'CLAIM_VERIFIED'
  }
];

const results = fixtures.map(f => ({ name: f.name, actual: decide(f), expected: f.expected }));
for (const r of results) assert.equal(r.actual, r.expected, r.name);
console.log(JSON.stringify({ schema: 'kaopu.probe-result/1', probe: 'CI-CLAIM-RUN-PRECONDITION-N73', passed: results.length, total: results.length, results }, null, 2));
