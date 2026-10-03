function decide(x) {
  if (!x || typeof x !== "object") return "HOLD_CAPABILITY_RECEIPT_INVALID";
  if (x.artifactIdentityBound !== true) return "HOLD_ARTIFACT_IDENTITY_UNBOUND";
  if (x.environmentIdentityBound !== true) return "HOLD_ENVIRONMENT_IDENTITY_UNBOUND";

  if (x.requestedClaimScope === "ALL_BROWSERS_AND_DEVICES") {
    return "REJECT_UNSCOPED_RUNTIME_CLAIM";
  }
  if (x.requestedClaimScope !== "EXACT_ENVIRONMENT") {
    return "HOLD_RUNTIME_CLAIM_SCOPE_UNBOUND";
  }

  if (x.capabilityPreflightStatus === "NOT_RUN" ||
      x.capabilityPreflightStatus == null) {
    return "HOLD_CAPABILITY_PREFLIGHT_MISSING";
  }
  const fixtureMatches =
    typeof x.requiredCapabilityId === "string" &&
    typeof x.requiredContextFingerprint === "string" &&
    x.requiredCapabilityId === x.fixtureCapabilityId &&
    x.requiredContextFingerprint === x.fixtureContextFingerprint;
  if (x.capabilityFixtureIsolated !== true || !fixtureMatches) {
    return "HOLD_CAPABILITY_PREFLIGHT_SCOPE_MISMATCH";
  }

  if (x.capabilityPreflightStatus === "FAIL") {
    return "ENVIRONMENT_CAPABILITY_BLOCKER_ARTIFACT_UNKNOWN";
  }
  if (x.capabilityPreflightStatus !== "PASS") {
    return "HOLD_CAPABILITY_RECEIPT_INVALID";
  }

  if (x.artifactRuntimeStatus === "FAIL") {
    return "SCOPED_ARTIFACT_RUNTIME_FAILURE";
  }
  if (x.artifactRuntimeStatus === "PASS" &&
      x.criticalInteractionStatus === "PASS") {
    return "SCOPED_ARTIFACT_RUNTIME_PASS";
  }
  return "HOLD_ARTIFACT_RUNTIME_EVIDENCE_INCOMPLETE";
}

const cases = JSON.parse(process.argv[2]);
let passed = 0;
const results = cases.map(c => {
  const got = decide(c.input);
  const ok = got === c.expect;
  if (ok) passed++;
  return { id:c.id, expect:c.expect, got, passed:ok };
});
const out = {
  schema:"kaopu.verifier-capability-precondition-gate-result/1",
  passed:passed === cases.length,
  passedCount:passed,
  total:cases.length,
  results
};
console.log(JSON.stringify(out,null,2));
if (!out.passed) process.exit(1);
