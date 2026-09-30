import assert from 'node:assert/strict';

export function evaluateParent(input) {
  const historicalRun = input.historicalRunConclusion === 'success'
    ? 'HISTORICAL_RUN_VERIFIED_ONLY'
    : 'HISTORICAL_RUN_NOT_VERIFIED';

  if (!input.parentResolvedRevision || input.parentResolvedRevision === 'gh-pages' || input.parentResolvedRevision === 'main') {
    return { historicalRun, rerunDecision: 'HOLD_PARENT_REFERENCE_MUTABLE' };
  }
  if (!input.parentContentDigest) {
    return { historicalRun, rerunDecision: 'HOLD_PARENT_DIGEST_MISSING' };
  }
  if (input.parentReadbackAtResolvedRevision !== true) {
    return { historicalRun, rerunDecision: 'HOLD_PARENT_ARTIFACT_NOT_REPLAYABLE' };
  }
  if (input.parentDigestMatches !== true) {
    return { historicalRun, rerunDecision: 'HOLD_PARENT_DIGEST_MISMATCH' };
  }
  return { historicalRun, rerunDecision: 'PARENT_INPUT_REPLAYABLE' };
}

const fixtures = [
  {
    name: 'observed R03 workflow uses mutable gh-pages parent which is now deleted',
    input: { historicalRunConclusion: 'success', parentResolvedRevision: 'gh-pages', parentContentDigest: null, parentReadbackAtResolvedRevision: false, parentDigestMatches: false },
    expected: { historicalRun: 'HISTORICAL_RUN_VERIFIED_ONLY', rerunDecision: 'HOLD_PARENT_REFERENCE_MUTABLE' }
  },
  {
    name: 'immutable R02 publication commit and blob read back',
    input: { historicalRunConclusion: 'success', parentResolvedRevision: '42ce957cb5b24ca2ae1b0ffaf91d40b8760fd7b4', parentContentDigest: 'gitblob:b214b91798dc71e96215d947198c5188bbb24e85', parentReadbackAtResolvedRevision: true, parentDigestMatches: true },
    expected: { historicalRun: 'HISTORICAL_RUN_VERIFIED_ONLY', rerunDecision: 'PARENT_INPUT_REPLAYABLE' }
  },
  {
    name: 'immutable revision without digest',
    input: { historicalRunConclusion: 'success', parentResolvedRevision: '42ce957cb5b24ca2ae1b0ffaf91d40b8760fd7b4', parentContentDigest: null, parentReadbackAtResolvedRevision: true, parentDigestMatches: true },
    expected: { historicalRun: 'HISTORICAL_RUN_VERIFIED_ONLY', rerunDecision: 'HOLD_PARENT_DIGEST_MISSING' }
  },
  {
    name: 'immutable revision missing after cleanup',
    input: { historicalRunConclusion: 'success', parentResolvedRevision: '42ce957cb5b24ca2ae1b0ffaf91d40b8760fd7b4', parentContentDigest: 'gitblob:x', parentReadbackAtResolvedRevision: false, parentDigestMatches: false },
    expected: { historicalRun: 'HISTORICAL_RUN_VERIFIED_ONLY', rerunDecision: 'HOLD_PARENT_ARTIFACT_NOT_REPLAYABLE' }
  },
  {
    name: 'digest mismatch',
    input: { historicalRunConclusion: 'success', parentResolvedRevision: '42ce957cb5b24ca2ae1b0ffaf91d40b8760fd7b4', parentContentDigest: 'gitblob:wrong', parentReadbackAtResolvedRevision: true, parentDigestMatches: false },
    expected: { historicalRun: 'HISTORICAL_RUN_VERIFIED_ONLY', rerunDecision: 'HOLD_PARENT_DIGEST_MISMATCH' }
  },
  {
    name: 'mutable main alias even when present',
    input: { historicalRunConclusion: 'success', parentResolvedRevision: 'main', parentContentDigest: 'gitblob:x', parentReadbackAtResolvedRevision: true, parentDigestMatches: true },
    expected: { historicalRun: 'HISTORICAL_RUN_VERIFIED_ONLY', rerunDecision: 'HOLD_PARENT_REFERENCE_MUTABLE' }
  },
  {
    name: 'immutable parent can pass if public alias was removed',
    input: { historicalRunConclusion: 'success', parentResolvedRevision: '42ce957cb5b24ca2ae1b0ffaf91d40b8760fd7b4', parentContentDigest: 'gitblob:b214b91798dc71e96215d947198c5188bbb24e85', parentReadbackAtResolvedRevision: true, parentDigestMatches: true, mutableAliasReadback: false },
    expected: { historicalRun: 'HISTORICAL_RUN_VERIFIED_ONLY', rerunDecision: 'PARENT_INPUT_REPLAYABLE' }
  },
  {
    name: 'historical failure is not upgraded by good parent closure',
    input: { historicalRunConclusion: 'failure', parentResolvedRevision: '42ce957cb5b24ca2ae1b0ffaf91d40b8760fd7b4', parentContentDigest: 'gitblob:b214b91798dc71e96215d947198c5188bbb24e85', parentReadbackAtResolvedRevision: true, parentDigestMatches: true },
    expected: { historicalRun: 'HISTORICAL_RUN_NOT_VERIFIED', rerunDecision: 'PARENT_INPUT_REPLAYABLE' }
  },
  {
    name: 'version label is not a revision',
    input: { historicalRunConclusion: 'success', parentResolvedRevision: '', parentContentDigest: 'gitblob:x', parentReadbackAtResolvedRevision: true, parentDigestMatches: true },
    expected: { historicalRun: 'HISTORICAL_RUN_VERIFIED_ONLY', rerunDecision: 'HOLD_PARENT_REFERENCE_MUTABLE' }
  },
  {
    name: 'immutable commit with wrong bytes cannot pass',
    input: { historicalRunConclusion: 'success', parentResolvedRevision: '42ce957cb5b24ca2ae1b0ffaf91d40b8760fd7b4', parentContentDigest: 'gitblob:b214b91798dc71e96215d947198c5188bbb24e85', parentReadbackAtResolvedRevision: true, parentDigestMatches: false },
    expected: { historicalRun: 'HISTORICAL_RUN_VERIFIED_ONLY', rerunDecision: 'HOLD_PARENT_DIGEST_MISMATCH' }
  }
];

const results = fixtures.map(fixture => {
  const actual = evaluateParent(fixture.input);
  assert.deepEqual(actual, fixture.expected, fixture.name);
  return { name: fixture.name, passed: true, actual };
});

console.log(JSON.stringify({
  caseId: 'EPHEMERAL-PUBLIC-PARENT-NOT-REPLAYABLE-001',
  passed: results.length,
  total: fixtures.length,
  results
}, null, 2));
