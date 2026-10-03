function finitePositive(x) {
  return Number.isFinite(x) && x > 0;
}

function necessaryWitness(x) {
  const w = x.necessaryWitness;
  if (!w || typeof w !== "object" || w.checkerPassed !== true) return null;
  if (w.type === "ANCHOR_DISTANCE_LIPSCHITZ") {
    if (![w.sourceGeodesicM, w.targetEuclideanM, w.sigmaMax, w.toleranceM]
      .every(Number.isFinite) || !finitePositive(w.sourceGeodesicM) ||
      w.sigmaMax < 1 || w.toleranceM < 0) return null;
    const violationM = w.targetEuclideanM - w.sigmaMax * w.sourceGeodesicM;
    return violationM > w.toleranceM ? { type:w.type, violationM } : null;
  }
  if (w.type === "PRESCRIBED_BOUNDARY_ARC_RATIO") {
    if (![w.sourceArcM, w.targetArcM, w.sigmaMin, w.sigmaMax, w.toleranceM]
      .every(Number.isFinite) || !finitePositive(w.sourceArcM) ||
      !finitePositive(w.targetArcM) || w.sigmaMin <= 0 ||
      w.sigmaMin > w.sigmaMax || w.toleranceM < 0 ||
      w.continuousBijectionRequired !== true || w.gatheringOrSlidingAllowed !== false) {
      return null;
    }
    const low = w.sigmaMin * w.sourceArcM;
    const high = w.sigmaMax * w.sourceArcM;
    const violationM = Math.max(low - w.targetArcM, w.targetArcM - high, 0);
    return violationM > w.toleranceM ? { type:w.type, violationM } : null;
  }
  if (w.type === "EXACT_INFEASIBILITY_CERTIFICATE" &&
      w.certificateVerified === true && w.scopeMatchesExactModel === true) {
    return { type:w.type, violationM:null };
  }
  return null;
}

function decide(x) {
  if (!x || typeof x !== "object") return "HOLD_SOLVER_RECEIPT_INVALID";
  if (!x.modelIdentityBound) return "HOLD_MODEL_IDENTITY_UNBOUND";
  if (x.metricWithinLimit === true && x.selfIntersectionDetected === true) {
    return "IMMERSION_NOT_EMBEDDING";
  }
  const witness = necessaryWitness(x);
  if (witness) return "CERTIFIED_INCOMPATIBLE_SCOPED";
  const localFailure = new Set([
    "NO_ACCEPTED_STEP", "MAX_ITERATIONS", "TINY_STEP",
    "LOCAL_INFEASIBILITY", "RESTORATION_FAILURE", "DIVERGING_ITERATES"
  ]);
  if (x.requestedClaim === "CUT_SHAPE_INCOMPATIBLE" &&
      (x.problemClass === "NONCONVEX_LOCAL" || localFailure.has(x.solverTermination))) {
    return "SEWING_INCONCLUSIVE";
  }
  if (x.requestedClaim === "CUT_SHAPE_INCOMPATIBLE") {
    return "HOLD_INCOMPATIBILITY_CLAIM_UNSUPPORTED";
  }
  if (x.metricWithinLimit === true && x.selfIntersectionDetected === false &&
      x.bodyContactChecked === true) return "WEARABLE_EMBEDDING_CANDIDATE";
  return "OBSERVATION_ONLY";
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
  schema:"kaopu.solver-claim-status-gate-result/1",
  passed:passed === cases.length,
  passedCount:passed,
  total:cases.length,
  results
};
console.log(JSON.stringify(out,null,2));
if (!out.passed) process.exit(1);
