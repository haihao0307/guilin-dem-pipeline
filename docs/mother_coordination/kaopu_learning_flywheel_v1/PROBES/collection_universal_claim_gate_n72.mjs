function decide(input) {
  if (!input || typeof input !== "object") return "HOLD_COLLECTION_RECORD_INVALID";
  const declared = Array.isArray(input.declaredMemberIds) ? [...new Set(input.declaredMemberIds)] : [];
  const receipts = Array.isArray(input.memberReceipts) ? input.memberReceipts : [];
  if (!input.collectionId || !input.claimId || declared.length === 0) {
    return "HOLD_COLLECTION_RECORD_INVALID";
  }
  const receiptByMember = new Map();
  for (const receipt of receipts) {
    if (!receipt || !receipt.memberId || !declared.includes(receipt.memberId)) continue;
    if (!receipt.artifactSha256 || !receipt.productionMode) continue;
    receiptByMember.set(receipt.memberId, receipt);
  }
  if (declared.some(memberId => !receiptByMember.has(memberId))) {
    return "HOLD_COLLECTION_MEMBER_RECEIPT_MISSING";
  }

  const fallbackMembers = Array.isArray(input.fallbackMemberIds)
    ? [...new Set(input.fallbackMemberIds)] : [];
  const hasFallback = input.fallbackActive === true || fallbackMembers.length > 0;
  if (input.claimQuantifier === "ALL") {
    const unsatisfied = declared.filter(memberId => receiptByMember.get(memberId).satisfiesClaim !== true);
    if (unsatisfied.length > 0 || hasFallback) {
      return input.fallbackDisclosure === true
        ? "HOLD_COLLECTION_CLAIM_NOT_UNIVERSAL"
        : "HOLD_COLLECTION_SILENT_FALLBACK";
    }
    return "COLLECTION_CLAIM_VERIFIED_NOT_USER_ACCEPTED";
  }

  if (input.claimQuantifier === "NAMED_SUBSET") {
    const claimed = Array.isArray(input.claimedMemberIds) ? [...new Set(input.claimedMemberIds)] : [];
    if (claimed.length === 0 || claimed.some(memberId => !declared.includes(memberId))) {
      return "HOLD_COLLECTION_RECORD_INVALID";
    }
    if (claimed.some(memberId => receiptByMember.get(memberId).satisfiesClaim !== true)) {
      return "HOLD_COLLECTION_CLAIM_MEMBER_FAILED";
    }
    if (hasFallback && input.fallbackDisclosure !== true) return "HOLD_COLLECTION_SILENT_FALLBACK";
    if (hasFallback) return "COLLECTION_MIXED_MODE_DISCLOSED_NOT_UNIVERSAL";
    return "COLLECTION_SUBSET_CLAIM_VERIFIED_NOT_USER_ACCEPTED";
  }
  return "HOLD_COLLECTION_RECORD_INVALID";
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
  schema: "kaopu.collection-universal-claim-gate-result/1",
  passed: passedCount === cases.length,
  passedCount,
  total: cases.length,
  results
};
console.log(JSON.stringify(result, null, 2));
if (!result.passed) process.exit(1);
