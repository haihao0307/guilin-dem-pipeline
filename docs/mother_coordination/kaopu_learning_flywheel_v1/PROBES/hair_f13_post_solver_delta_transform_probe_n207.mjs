const NODE_COUNT = 25;
const DISPLAY_COUNT = 49;
const GUIDE_LENGTH_M = 0.15;
const ROTATION_DEG = 45;
const BODY_DELTA_LIMIT_M = 0.035;
const FIXTURE_ARC_DRIFT_LIMIT = 0.005;

const length3 = v => Math.hypot(v[0], v[1], v[2]);
const sub3 = (a, b) => a.map((v, i) => v - b[i]);
const add3 = (a, b) => a.map((v, i) => v + b[i]);
const scale3 = (a, s) => a.map(v => v * s);
const mix3 = (a, b, t) => a.map((v, i) => v * (1 - t) + b[i] * t);

function rotateZ(p, radians) {
  const c = Math.cos(radians), s = Math.sin(radians);
  return [p[0] * c - p[1] * s, p[0] * s + p[1] * c, p[2]];
}

function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function segmentLengths(points) {
  return points.slice(1).map((p, i) => length3(sub3(p, points[i])));
}

function centerlineMetrics(rest, deformed) {
  const restSegments = segmentLengths(rest);
  const deformedSegments = segmentLengths(deformed);
  const ratios = deformedSegments.map((v, i) => v / restSegments[i] - 1);
  const restArc = restSegments.reduce((a, b) => a + b, 0);
  const deformedArc = deformedSegments.reduce((a, b) => a + b, 0);
  return {
    restArcLengthM: restArc,
    deformedArcLengthM: deformedArc,
    totalArcLengthDriftRatio: deformedArc / restArc - 1,
    maxSegmentStretchRatio: Math.max(...ratios),
    maxSegmentCompressionRatio: Math.min(...ratios),
    rootErrorM: length3(sub3(deformed[0], rest[0])),
    finite: deformed.flat().every(Number.isFinite)
  };
}

function f13WriteBoundedDelta(rawDelta, nodeIndex) {
  const magnitude = length3(rawDelta);
  const scale = magnitude > 0
    ? BODY_DELTA_LIMIT_M * Math.tanh(magnitude / BODY_DELTA_LIMIT_M) / magnitude
    : 1;
  const mobilityWeight = nodeIndex < 2 ? 0 : 1;
  return scale3(rawDelta, scale * mobilityWeight);
}

function f13ShaderDelta(writeDeltas, t) {
  const u = Math.pow(Math.max(0, Math.min(1, t)), 1 / 1.3) * 24;
  const n = Math.min(23, Math.floor(u));
  const f = u - n;
  return scale3(mix3(writeDeltas[n], writeDeltas[n + 1], f), smoothstep(0, 0.10, t));
}

function classify(receipt) {
  if (!receipt.subjectBound) return "HOLD_SUBJECT_UNBOUND";
  if (!receipt.restAndDeformedBound) return "HOLD_POST_SOLVER_CENTERLINES_UNBOUND";
  if (!receipt.postWriteMetrics) return "HOLD_POST_SOLVER_ARC_RECEIPT_MISSING";
  if (!receipt.thresholdFrozen) return "HOLD_POST_SOLVER_ARC_THRESHOLD_UNFROZEN";
  if (!receipt.positiveControlPresent) return "HOLD_POST_SOLVER_POSITIVE_CONTROL_MISSING";
  if (!receipt.positiveControlRejected) return "HOLD_POST_SOLVER_POSITIVE_CONTROL_NOT_REJECTED";
  if (Math.abs(receipt.postWriteMetrics.totalArcLengthDriftRatio) > receipt.arcDriftLimit ||
      receipt.postWriteMetrics.maxSegmentStretchRatio > receipt.segmentLimit ||
      receipt.postWriteMetrics.maxSegmentCompressionRatio < -receipt.segmentLimit) {
    return "REJECT_POST_SOLVER_DISPLAY_STRETCH";
  }
  return "SCOPED_POST_SOLVER_DISPLAY_INEXTENSIBILITY_VERIFIED_NOT_FULL_HAIR_PHYSICS";
}

const radians = ROTATION_DEG * Math.PI / 180;
const denseRest = Array.from({length: DISPLAY_COUNT}, (_, i) => [GUIDE_LENGTH_M * i / 48, 0, 0]);
const coarseRest = Array.from({length: NODE_COUNT}, (_, i) => [GUIDE_LENGTH_M * Math.pow(i / 24, 1.3), 0, 0]);
const coarseRawSolver = coarseRest.map(p => rotateZ(p, radians));
const rawSolverDeltas = coarseRawSolver.map((p, i) => sub3(p, coarseRest[i]));
const writeDeltas = rawSolverDeltas.map(f13WriteBoundedDelta);
const coarseAfterWrite = coarseRest.map((p, i) => add3(p, writeDeltas[i]));
const denseAfterShader = denseRest.map((p, i) => add3(p, f13ShaderDelta(writeDeltas, i / 48)));
const denseExactRigid = denseRest.map(p => rotateZ(p, radians));

const rawSolverMetrics = centerlineMetrics(coarseRest, coarseRawSolver);
const coarsePostWriteMetrics = centerlineMetrics(coarseRest, coarseAfterWrite);
const denseExactRigidMetrics = centerlineMetrics(denseRest, denseExactRigid);
const denseDisplayMetrics = centerlineMetrics(denseRest, denseAfterShader);

const base = {
  subjectBound: true,
  restAndDeformedBound: true,
  postWriteMetrics: denseDisplayMetrics,
  thresholdFrozen: true,
  positiveControlPresent: true,
  positiveControlRejected: true,
  arcDriftLimit: FIXTURE_ARC_DRIFT_LIMIT,
  segmentLimit: FIXTURE_ARC_DRIFT_LIMIT
};

const cases = [
  ["subject-unbound", {...base, subjectBound: false}, "HOLD_SUBJECT_UNBOUND"],
  ["solver-green-post-transform-centerlines-unbound", {...base, restAndDeformedBound: false}, "HOLD_POST_SOLVER_CENTERLINES_UNBOUND"],
  ["root-finite-only-post-write-metrics-missing", {...base, postWriteMetrics: null}, "HOLD_POST_SOLVER_ARC_RECEIPT_MISSING"],
  ["threshold-unfrozen", {...base, thresholdFrozen: false}, "HOLD_POST_SOLVER_ARC_THRESHOLD_UNFROZEN"],
  ["positive-control-missing", {...base, positiveControlPresent: false}, "HOLD_POST_SOLVER_POSITIVE_CONTROL_MISSING"],
  ["positive-control-not-rejected", {...base, positiveControlRejected: false}, "HOLD_POST_SOLVER_POSITIVE_CONTROL_NOT_REJECTED"],
  ["rigid-solver-result-distorted-by-post-transform", base, "REJECT_POST_SOLVER_DISPLAY_STRETCH"],
  ["complete-scoped-pass", {...base, postWriteMetrics: {...denseDisplayMetrics, totalArcLengthDriftRatio: 0.001, maxSegmentStretchRatio: 0.002, maxSegmentCompressionRatio: -0.002}}, "SCOPED_POST_SOLVER_DISPLAY_INEXTENSIBILITY_VERIFIED_NOT_FULL_HAIR_PHYSICS"]
].map(([id, receipt, expected]) => {
  const actual = classify(receipt);
  return {id, expected, actual, pass: actual === expected};
});

const output = {
  schema: "kaopu.learning-probe-result/1",
  run: "N207_HAIR_F13_POST_SOLVER_DELTA_TRANSFORM",
  sourceSubject: "codex/hair-structure-lab-r01-20261016@2175d53de12a44dbedb989d3e8b34837f6315dcb",
  boundedQuestion: "Does F13 preserve guide inextensibility after PhotoDynamics.write tanh limiting, node mobility weighting, root ramp, and 25-to-49 shader interpolation?",
  fixture: {
    guideLengthM: GUIDE_LENGTH_M,
    rotationDeg: ROTATION_DEG,
    bodyDeltaLimitM: BODY_DELTA_LIMIT_M,
    nodeCount: NODE_COUNT,
    displayCount: DISPLAY_COUNT,
    classifierOnlyArcDriftLimit: FIXTURE_ARC_DRIFT_LIMIT,
    note: "The limit is a synthetic classifier fixture, not a Hair production threshold."
  },
  observations: {
    rawSolverMetrics,
    coarsePostWriteMetrics,
    denseExactRigidMetrics,
    denseDisplayMetrics,
    solverArcInvariantPreserved: Math.abs(rawSolverMetrics.totalArcLengthDriftRatio) < 1e-12,
    postSolverTransformPreservedSameInvariant: Math.abs(denseDisplayMetrics.totalArcLengthDriftRatio) < 1e-12
  },
  cases,
  summary: {passed: cases.filter(x => x.pass).length, total: cases.length},
  decision: "HOLD_F13_POST_SOLVER_DISPLAY_INEXTENSIBILITY_UNBOUND",
  regressionRouting: "REUSE_HAIR_GUIDE_ARC_LENGTH_INVARIANT_001_ADD_STAGE_EVIDENCE_NO_DUPLICATE_CASE",
  teacherStatus: "NO_NOVELTY",
  lifecycle: {
    POSTED: true,
    postedReceipt: "https://github.com/haihao0307/guilin-dem-pipeline/issues/91#issuecomment-6478996941",
    ACKNOWLEDGED: false,
    IMPLEMENTED: false,
    LEARNING_GATE_RUN: true,
    HAIR_PRODUCTION_GATE_RUN: false,
    ADOPTED: false,
    USER_ACCEPTED: false
  }
};

if (output.summary.passed !== output.summary.total) process.exitCode = 1;
console.log(JSON.stringify(output, null, 2));
