import fs from "node:fs";

const fixturePath = process.argv[2];
if (!fixturePath) throw new Error("usage: node disclosed_inference_gate_n44.mjs <fixtures.json>");

const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
const allowedBases = new Set(["REFERENCE_MATCH", "MEASURED_RELATION", "APPROVED_CONSTRAINT", "PHYSICS_DERIVED"]);

function evaluate(input) {
  if (input.receiptHeadSha !== fixture.subjectHeadSha) {
    return { verdict: "HOLD_SUBJECT_HEAD_MISMATCH", reasons: ["SUBJECT_HEAD_MISMATCH"], preservedEvidence: [] };
  }

  const preservedEvidence = [...(input.machineEvidence || [])];
  if (input.claimType === "STRUCTURAL_REPLAY") {
    return { verdict: "STRUCTURAL_EVIDENCE_PRESERVED_ONLY", reasons: [], preservedEvidence };
  }

  const referenceLocked = input.userInstructionRequiresReplication === true;
  const reasons = [];
  if (referenceLocked && input.declaredTaskMode !== "REPLICATION_LOCKED") reasons.push("TASK_MODE_UNDECLARED");
  if (referenceLocked && input.referenceCoverageComplete !== true) reasons.push("REFERENCE_COVERAGE_INCOMPLETE");

  const visibleInferences = input.visibleInferences || [];
  const scope = new Set(input.inferenceAuthorizationScope || []);
  if (visibleInferences.length > 0 && input.creativeAuthorization !== true) {
    reasons.push("VISIBLE_INFERENCE_UNAUTHORIZED");
  } else if (visibleInferences.some((item) => !scope.has(item))) {
    reasons.push("VISIBLE_INFERENCE_SCOPE_EXCEEDED");
  }

  if ((input.visibleDeltaBases || []).some((basis) => !allowedBases.has(basis))) reasons.push("VISIBLE_DELTA_BASIS_INVALID");
  if (input.independentReferenceVerifier !== true) reasons.push("INDEPENDENT_REFERENCE_VERIFIER_MISSING");
  else if (input.referenceVerifierPassed !== true) reasons.push("REFERENCE_VERIFIER_NOT_PASSED");

  if (reasons.length > 0) return { verdict: "HOLD_REFERENCE_CLAIM_AUTHORIZATION", reasons, preservedEvidence };
  if (input.claimType === "AUTHORIZED_APPROXIMATION") {
    return { verdict: "AUTHORIZED_APPROXIMATE_CANDIDATE_NOT_REFERENCE_VERIFIED", reasons: [], preservedEvidence };
  }
  return { verdict: "REFERENCE_CANDIDATE_READY_NOT_USER_ACCEPTED", reasons: [], preservedEvidence };
}

const results = fixture.cases.map((testCase) => {
  const actual = evaluate(testCase.input);
  return { id: testCase.id, actual, expected: testCase.expected, pass: JSON.stringify(actual) === JSON.stringify(testCase.expected) };
});
const output = {
  candidateId: fixture.candidateId,
  subjectHeadSha: fixture.subjectHeadSha,
  summary: { total: results.length, passed: results.filter((x) => x.pass).length, failed: results.filter((x) => !x.pass).length },
  results,
  generatedAt: "2026-09-29T07:38:09Z"
};
console.log(JSON.stringify(output, null, 2));
if (output.summary.failed > 0) process.exitCode = 1;
