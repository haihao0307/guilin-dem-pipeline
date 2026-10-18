import assert from 'node:assert/strict';

export function classifyArchiveTrial(x) {
  if (!x.subjectBound || !x.archiveDigestBound) return 'HOLD_ARCHIVE_SUBJECT_UNBOUND';
  if (x.identityMismatch) {
    return x.rejectedBeforeMutation
      ? 'IDENTITY_MISMATCH_REJECTED_SCOPED'
      : 'HOLD_IDENTITY_REJECTION_UNPROVEN';
  }
  if (!x.sameContextTupleExact || !x.sameContextPixelsExact) {
    return 'HOLD_VISUAL_STATE_ROUNDTRIP_INCOMPLETE';
  }
  if (!x.freshConsumerContext || x.producerContextId === x.consumerContextId || !x.producerContextClosed) {
    return 'SAME_CONTEXT_ROUNDTRIP_VERIFIED__HOLD_FRESH_CONTEXT_PORTABILITY_UNTESTED';
  }
  if (x.legacyArchiveMissingRequiredState && x.claimsExactRestore) {
    return 'HOLD_LEGACY_ARCHIVE_EXACT_RESTORE_OVERCLAIM';
  }
  if (!x.freshTupleExact || !x.freshPixelsExact || !x.calibrationExact || !x.geometryExact) {
    return 'HOLD_FRESH_CONTEXT_PORTABILITY_MISMATCH';
  }
  if (!x.repeatFreshContextExact) return 'HOLD_FRESH_CONTEXT_REPEAT_UNBOUND';
  return 'ARCHIVE_PORTABILITY_VERIFIED_SCOPED';
}

const base = {
  subjectBound: true,
  archiveDigestBound: true,
  identityMismatch: false,
  rejectedBeforeMutation: false,
  sameContextTupleExact: true,
  sameContextPixelsExact: true,
  freshConsumerContext: true,
  producerContextId: 'producer-A',
  consumerContextId: 'consumer-B',
  producerContextClosed: true,
  legacyArchiveMissingRequiredState: false,
  claimsExactRestore: true,
  freshTupleExact: true,
  freshPixelsExact: true,
  calibrationExact: true,
  geometryExact: true,
  repeatFreshContextExact: true
};

const fixtures = [
  ['pr303-current-same-page', { ...base, freshConsumerContext: false, consumerContextId: 'producer-A', producerContextClosed: false }, 'SAME_CONTEXT_ROUNDTRIP_VERIFIED__HOLD_FRESH_CONTEXT_PORTABILITY_UNTESTED'],
  ['new-page-same-browser-context', { ...base, producerContextId: 'browser-context-A', consumerContextId: 'browser-context-A' }, 'SAME_CONTEXT_ROUNDTRIP_VERIFIED__HOLD_FRESH_CONTEXT_PORTABILITY_UNTESTED'],
  ['archive-digest-unbound', { ...base, archiveDigestBound: false }, 'HOLD_ARCHIVE_SUBJECT_UNBOUND'],
  ['fresh-context-calibration-mismatch', { ...base, calibrationExact: false }, 'HOLD_FRESH_CONTEXT_PORTABILITY_MISMATCH'],
  ['legacy-archive-exact-overclaim', { ...base, legacyArchiveMissingRequiredState: true }, 'HOLD_LEGACY_ARCHIVE_EXACT_RESTORE_OVERCLAIM'],
  ['identity-mismatch-mutated-first', { ...base, identityMismatch: true }, 'HOLD_IDENTITY_REJECTION_UNPROVEN'],
  ['identity-mismatch-rejected-first', { ...base, identityMismatch: true, rejectedBeforeMutation: true }, 'IDENTITY_MISMATCH_REJECTED_SCOPED'],
  ['fresh-context-repeat-unbound', { ...base, repeatFreshContextExact: false }, 'HOLD_FRESH_CONTEXT_REPEAT_UNBOUND'],
  ['fresh-context-positive', base, 'ARCHIVE_PORTABILITY_VERIFIED_SCOPED'],
  ['pr305-r01-1-run-39095533327', { ...base, producerContextId: 'pr305-producer', consumerContextId: 'pr305-reader-1+2' }, 'ARCHIVE_PORTABILITY_VERIFIED_SCOPED']
];

const results = fixtures.map(([name, input, expected]) => {
  const actual = classifyArchiveTrial(input);
  assert.equal(actual, expected, name);
  return { name, expected, actual, pass: true };
});

process.stdout.write(JSON.stringify({ probe: 'lip_archive_fresh_context_n171', passed: results.length, failed: 0, results }, null, 2) + '\n');
