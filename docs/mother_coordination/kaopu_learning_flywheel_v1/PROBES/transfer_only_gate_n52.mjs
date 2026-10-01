import fs from "node:fs";

const fixture = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));

function evaluate(input) {
  if (input.receiptHeadSha !== input.subjectHeadSha) {
    return { verdict: "HOLD_SUBJECT_HEAD_MISMATCH", reasons: ["SUBJECT_HEAD_MISMATCH"], preservedEvidence: [] };
  }
  const preservedEvidence = [];
  if (input.sourceTreeSha && input.sourceTreeSha === input.destinationTreeSha) preservedEvidence.push("SOURCE_SNAPSHOT_TREE_VERIFIED");
  if (input.sourceEntrypointBlob && input.sourceEntrypointBlob === input.activeEntrypointBlob) preservedEvidence.push("ACTIVE_ENTRYPOINT_BLOB_VERIFIED");
  if (input.taskMode == null || input.taskMode === "") {
    return { verdict: "HOLD_PHASE_CONTRACT", reasons: ["PHASE_TASK_MODE_UNDECLARED"], preservedEvidence };
  }
  if (input.taskMode === "ADAPTATION_AUTHORIZED") {
    const reasons = [];
    if (input.adaptationAuthorized !== true) reasons.push("ADAPTATION_AUTHORIZATION_MISSING");
    if (!input.adaptationAuthorizationSource) reasons.push("ADAPTATION_AUTHORIZATION_SOURCE_MISSING");
    if (!input.adaptationBaseSha) reasons.push("ADAPTATION_BASE_MISSING");
    if (input.independentVerifier !== true) reasons.push("INDEPENDENT_PHASE_VERIFIER_MISSING");
    else if (input.verifierPassed !== true) reasons.push("PHASE_VERIFIER_NOT_PASSED");
    if (reasons.length) return { verdict: "HOLD_PHASE_CONTRACT", reasons, preservedEvidence };
    return { verdict: "NOT_APPLICABLE_ADAPTATION_PHASE", reasons: [], preservedEvidence };
  }
  if (input.taskMode !== "TRANSFER_ONLY") {
    return { verdict: "HOLD_PHASE_CONTRACT", reasons: ["PHASE_TASK_MODE_INVALID"], preservedEvidence };
  }
  const reasons = [];
  const anchorComplete = [input.sourceCommit, input.sourcePath, input.sourceTreeSha, input.destinationTreeSha, input.sourceEntrypointBlob, input.activeEntrypointBlob].every(Boolean);
  if (!anchorComplete) reasons.push("TRANSFER_ANCHOR_INCOMPLETE");
  else {
    if (input.sourceTreeSha !== input.destinationTreeSha) reasons.push("SOURCE_TREE_MISMATCH");
    if (input.sourceEntrypointBlob !== input.activeEntrypointBlob) reasons.push("ACTIVE_ENTRYPOINT_BLOB_MISMATCH");
    const allowed = new Set(input.authorizedDeltaPaths || []);
    if ((input.semanticDeltaPaths || []).some((path) => !allowed.has(path))) reasons.push("UNAUTHORIZED_SEMANTIC_DELTA");
  }
  if (input.independentVerifier !== true) reasons.push("INDEPENDENT_TRANSFER_VERIFIER_MISSING");
  else if (input.verifierPassed !== true) reasons.push("TRANSFER_VERIFIER_NOT_PASSED");
  if (reasons.length) return { verdict: "HOLD_TRANSFER_ONLY_CONTRACT", reasons, preservedEvidence };
  return { verdict: "TRANSFER_ONLY_VERIFIED_NOT_USER_ACCEPTED", reasons: [], preservedEvidence };
}

const results = fixture.cases.map((c) => {
  const actual = evaluate(c.input);
  return { id: c.id, actual, expected: c.expected, pass: JSON.stringify(actual) === JSON.stringify(c.expected) };
});
const output = {
  candidateId: fixture.candidateId,
  summary: { total: results.length, passed: results.filter((r) => r.pass).length, failed: results.filter((r) => !r.pass).length },
  results,
  generatedAt: "2026-10-01T01:46:47Z"
};
console.log(JSON.stringify(output, null, 2));
if (output.summary.failed) process.exitCode = 1;
