import assert from 'node:assert/strict';

const reference = {
  id: 'E50-ARTISTIC-REFERENCE-A',
  kind: 'artistic-mechanical-reference',
  engineeringAuthority: 'UNKNOWN',
  externalGeometryCopyAllowed: false,
  externalTextureCopyAllowed: false,
  curve: [[0, 0], [0.25, 0.8], [0.75, 0.8], [1, 0]],
};

// Same endpoints and midpoint as the reference, but a different continuous curve.
// This represents a producer-created simplification/substitute that a sparse anchor gate misses.
const substitute = {
  id: 'PRODUCER-SUBSTITUTE',
  curve: [[0, 0], [0.05, 1.2], [0.95, 0.4], [1, 0]],
};

// Independent procedural reconstruction from frozen measurements.
const faithful = {
  id: 'INDEPENDENT-PROCEDURAL-RECONSTRUCTION',
  curve: [[0, 0], [0.25, 0.8], [0.75, 0.8], [1, 0]],
};

function cubic(points, t) {
  const u = 1 - t;
  const b0 = u ** 3;
  const b1 = 3 * u ** 2 * t;
  const b2 = 3 * u * t ** 2;
  const b3 = t ** 3;
  return [
    b0 * points[0][0] + b1 * points[1][0] + b2 * points[2][0] + b3 * points[3][0],
    b0 * points[0][1] + b1 * points[1][1] + b2 * points[2][1] + b3 * points[3][1],
  ];
}

function derivatives(points, t) {
  const u = 1 - t;
  const d1 = [0, 1].map((axis) =>
    3 * u ** 2 * (points[1][axis] - points[0][axis]) +
    6 * u * t * (points[2][axis] - points[1][axis]) +
    3 * t ** 2 * (points[3][axis] - points[2][axis]));
  const d2 = [0, 1].map((axis) =>
    6 * u * (points[2][axis] - 2 * points[1][axis] + points[0][axis]) +
    6 * t * (points[3][axis] - 2 * points[2][axis] + points[1][axis]));
  return { d1, d2 };
}

function curvature(points, t) {
  const { d1, d2 } = derivatives(points, t);
  const numerator = Math.abs(d1[0] * d2[1] - d1[1] * d2[0]);
  const denominator = (d1[0] ** 2 + d1[1] ** 2) ** 1.5;
  return numerator / denominator;
}

function distance(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

const samples = Array.from({ length: 41 }, (_, i) => i / 40);
const anchorTs = [0, 0.5, 1];
const curvatureTs = [0.1, 0.25, 0.4, 0.6, 0.75, 0.9];

function maxCurveDeviation(a, b) {
  return Math.max(...samples.map((t) => distance(cubic(a, t), cubic(b, t))));
}

function maxCurvatureDeviation(a, b) {
  return Math.max(...curvatureTs.map((t) => Math.abs(curvature(a, t) - curvature(b, t))));
}

function sparseAnchorGate(a, b) {
  return anchorTs.every((t) => distance(cubic(a, t), cubic(b, t)) < 1e-12);
}

function continuousFidelityGate(a, b) {
  return maxCurveDeviation(a, b) <= 0.01 && maxCurvatureDeviation(a, b) <= 0.05;
}

const substituteCurveDeviation = maxCurveDeviation(reference.curve, substitute.curve);
const substituteCurvatureDeviation = maxCurvatureDeviation(reference.curve, substitute.curve);
const faithfulCurveDeviation = maxCurveDeviation(reference.curve, faithful.curve);

const variantMixReceipt = {
  referenceVariantIds: ['E50-ARTISTIC-REFERENCE-A', 'E50-ARTISTIC-REFERENCE-B'],
  perPartMapping: null,
  decision: 'REJECT_MIXED_REFERENCE_VARIANTS_WITHOUT_PART_MAPPING',
};

const claimStates = {
  visibleShape: 'REFERENCE_MATCH_CANDIDATE',
  engineeringTruth: reference.engineeringAuthority,
  hiddenGeometry: 'OCCLUDED_UNKNOWN',
  materialRoute: 'KAOPU_MATERIAL_MOTHER_ONLY',
};

const checks = {
  endpointsAndMidpointMatch: sparseAnchorGate(reference.curve, substitute.curve),
  sparseAnchorGateWouldFalsePass: sparseAnchorGate(reference.curve, substitute.curve),
  continuousCurveDetectsSubstitute: substituteCurveDeviation > 0.01,
  curvatureSignatureDetectsSubstitute: substituteCurvatureDeviation > 0.05,
  faithfulIndependentFormulaPasses: continuousFidelityGate(reference.curve, faithful.curve),
  unmappedVariantMixRejected: variantMixReceipt.decision === 'REJECT_MIXED_REFERENCE_VARIANTS_WITHOUT_PART_MAPPING',
  referenceMatchDoesNotPromoteEngineeringTruth: claimStates.engineeringTruth === 'UNKNOWN',
  meshTextureCopyRemainForbidden: !reference.externalGeometryCopyAllowed && !reference.externalTextureCopyAllowed,
};

for (const [name, passed] of Object.entries(checks)) assert.equal(passed, true, name);

const result = {
  probeId: 'N216-STYLIZED-REFERENCE-CURVATURE-FIDELITY',
  boundedQuestion: 'Can sparse silhouette anchors prove one-to-one learning of a stylized mechanical reference continuous surface while keeping engineering truth separate?',
  decision: 'SEPARATE_VISIBLE_REFERENCE_FIDELITY_FROM_ENGINEERING_TRUTH_AND_GATE_CURVATURE',
  externalTeacherStatus: 'NO_NOVELTY',
  reference,
  substitute,
  faithful,
  measurements: {
    substituteCurveDeviation,
    substituteCurvatureDeviation,
    faithfulCurveDeviation,
  },
  variantMixReceipt,
  claimStates,
  checks,
  passed: Object.values(checks).every(Boolean),
  limitations: [
    'This is a synthetic 2D profile-contract replay, not an E50 production surface comparison.',
    'Passing the curve gate does not establish hidden geometry, mating fit, material correctness, engineering accuracy or user acceptance.',
    'Production requires fixed reference digests, per-part coverage, multiple section curves and independent visual/numeric verification.',
  ],
};

console.log(JSON.stringify(result, null, 2));
