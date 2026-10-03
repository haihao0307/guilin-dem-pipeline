function decide(x) {
  if (!x || typeof x !== "object") return "HOLD_OBSERVATION_RECORD_INVALID";
  if (!x.objectIdentityBound) return "HOLD_OBJECT_IDENTITY_UNBOUND";
  if (x.conflict === true) return "HOLD_OBSERVATION_CONFLICT";
  if (!x.uncertaintyState) return "HOLD_UNCERTAINTY_UNDECLARED";
  if (["OCCLUDED","UNKNOWN","SOURCE_MISSING"].includes(x.uncertaintyState)) {
    return "OBSERVATION_UNCERTAIN_NOT_ANCHOR";
  }
  const roots = Array.isArray(x.independentEvidenceRoots)
    ? new Set(x.independentEvidenceRoots).size : 0;
  if (x.visualCorrespondence === true && !x.anatomicalOrGeometricSupport) {
    return "OBSERVATION_CORRESPONDENCE_CANDIDATE";
  }
  if (!x.partIdentityBound || !x.boundaryDefined) {
    return "OBSERVATION_PART_IDENTITY_INCOMPLETE";
  }
  if (!x.crossViewStable && !x.temporalStable) {
    return "OBSERVATION_STABILITY_UNPROVEN";
  }
  if (!x.anatomicalOrGeometricSupport) {
    return "OBSERVATION_CORRESPONDENCE_CANDIDATE";
  }
  if (roots < 2) return "OBSERVATION_INDEPENDENCE_INSUFFICIENT";
  if (!x.relationInvariantsDefined) {
    return "OBSERVATION_RELATION_ANCHOR_INCOMPLETE";
  }
  return "GRAMMAR_ANCHOR_CANDIDATE";
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
  schema:"kaopu.visual-listener-anchor-gate-result/1",
  passed:passed===cases.length,
  passedCount:passed,
  total:cases.length,
  results
};
console.log(JSON.stringify(out,null,2));
if (!out.passed) process.exit(1);
