import fs from "node:fs";

const fixture = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));

function evaluate(input) {
  const reasons = [];
  const preservedClaims = [];
  if (input.exactPayloadMatched === true && input.publishedBlobSha && input.publishedBlobSha === input.currentBlobSha) {
    preservedClaims.push("EXACT_PUBLIC_PAYLOAD_IDENTITY_VERIFIED");
  } else if (input.exactPayloadMatched === false) {
    reasons.push("PUBLIC_PAYLOAD_SUBJECT_MISMATCH");
  } else {
    reasons.push("PUBLIC_PAYLOAD_IDENTITY_UNVERIFIED");
  }
  if (!input.sourceRepository) reasons.push("SOURCE_REPOSITORY_UNDECLARED");
  if (!input.candidateSourceSha || input.sourceObjectResolved !== true) reasons.push("SOURCE_REVISION_UNRESOLVABLE");
  if (!input.verifierIdentity) reasons.push("VERIFIER_IDENTITY_MISSING");
  if (!input.verifierExecutionRoot) reasons.push("VERIFIER_EXECUTION_ROOT_MISSING");
  if (!input.verifierRunId) reasons.push("VERIFIER_RUN_ID_MISSING");
  if (!input.verificationSubjectSha) reasons.push("VERIFIED_SUBJECT_MISSING");
  else if (input.verificationSubjectSha !== input.subjectHeadSha) reasons.push("VERIFIED_SUBJECT_MISMATCH");
  if (!input.verifierEvidenceDigest) reasons.push("VERIFIER_EVIDENCE_DIGEST_MISSING");
  if (input.verifierResult !== "PASS") reasons.push("VERIFIER_GATE_NOT_PASSED");
  if (input.currentPublicBrowserPassed !== true) reasons.push("CURRENT_PUBLIC_BROWSER_FAILED");
  if (reasons.length) return { verdict: "HOLD_CLAIM_SCOPE_INCOMPLETE", reasons, preservedClaims };
  return { verdict: "CLAIM_SCOPE_VERIFIED_NOT_USER_ACCEPTED", reasons: [], preservedClaims };
}

const results = fixture.cases.map((c) => {
  const actual = evaluate(c.input);
  return { id: c.id, actual, expected: c.expected, pass: JSON.stringify(actual) === JSON.stringify(c.expected) };
});
const output = {
  auditId: fixture.auditId,
  summary: { total: results.length, passed: results.filter((r) => r.pass).length, failed: results.filter((r) => !r.pass).length },
  results,
  generatedAt: "2026-10-01T07:52:00Z"
};
console.log(JSON.stringify(output, null, 2));
if (output.summary.failed) process.exitCode = 1;
