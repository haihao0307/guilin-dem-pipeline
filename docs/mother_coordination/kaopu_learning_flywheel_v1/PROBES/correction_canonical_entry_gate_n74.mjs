function decide(input) {
  if (!input || input.candidateVerified !== true || !input.candidateIdentity ||
      !input.candidateBuildMarker || input.candidateInvariantsPass !== true) {
    return "HOLD_CORRECTION_RECEIPT_INCOMPLETE";
  }
  if (input.fixedEntryReadbackPerformed !== true || !input.fixedEntryIdentity ||
      !input.fixedEntryBuildMarker) {
    return "HOLD_CORRECTION_RECEIPT_INCOMPLETE";
  }
  if (input.fixedEntryAutomaticallyResolvesCandidate !== true ||
      input.fixedEntryBuildMarker !== input.candidateBuildMarker) {
    return "HOLD_CANONICAL_ENTRY_STALE";
  }
  if (input.fixedEntryIdentity !== input.candidateIdentity) {
    return "HOLD_CANONICAL_ENTRY_IDENTITY_MISMATCH";
  }
  if (input.fixedEntryInvariantsPass !== true) {
    return "HOLD_CORRECTION_INVARIANT_FAILED";
  }
  return "CORRECTION_PROMOTED_NOT_USER_ACCEPTED";
}

const cases = JSON.parse(process.argv[2]);
let passedCount = 0;
const results = cases.map(testCase => {
  const got = decide(testCase.input);
  const passed = got === testCase.expect;
  if (passed) passedCount += 1;
  return { id: testCase.id, expect: testCase.expect, got, passed };
});
const result = {
  schema: "kaopu.correction-canonical-entry-gate-result/1",
  passed: passedCount === cases.length,
  passedCount,
  total: cases.length,
  results
};
console.log(JSON.stringify(result, null, 2));
if (!result.passed) process.exit(1);
