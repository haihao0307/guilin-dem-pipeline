import fs from 'node:fs';
import assert from 'node:assert/strict';

const fixture = JSON.parse(fs.readFileSync(new URL('./hair_f10_frame_twist_continuity_n161.json', import.meta.url)));

const HOLD_UNBOUND = 'VOLUME_AND_ORTHONORMAL_SECTION_FRAMES_VERIFIED__HOLD_ARC_LENGTH_NORMALIZED_TWIST_CONTINUITY_UNBOUND';

function segmentLengths(centers) {
  return centers.slice(1).map((p, i) => Math.hypot(...p.map((v, axis) => v - centers[i][axis])));
}

function unwrapDeltaDeg(a, b) {
  let d = b - a;
  while (d > 180) d -= 360;
  while (d <= -180) d += 360;
  return d;
}

function maxTwistRateDegPerMM(angles, lengths) {
  return Math.max(...lengths.map((ds, i) => Math.abs(unwrapDeltaDeg(angles[i], angles[i + 1])) / ds));
}

export function legacyF10ContinuityPass(anglesDeg) {
  if (!anglesDeg || anglesDeg.length < 2) return false;
  const noOverNinetyDegreeStep = anglesDeg.slice(1).every((angle, i) =>
    Math.cos(unwrapDeltaDeg(anglesDeg[i], angle) * Math.PI / 180) > 0
  );
  return noOverNinetyDegreeStep && Math.max(...anglesDeg.map((x) => Math.abs(x))) * Math.PI / 180 > 0.05;
}

export function classify(input) {
  if (!input.framesValid) return 'HOLD_FRAME_ORTHONORMALITY_INVALID';
  if (!input.centers || !input.twistAnglesDeg || input.centers.length !== input.twistAnglesDeg.length || input.centers.length < 2) {
    return HOLD_UNBOUND;
  }
  const lengths = segmentLengths(input.centers);
  if (lengths.some((x) => !Number.isFinite(x) || x <= (input.arcLengthEpsilonMM ?? 1e-6))) {
    return 'HOLD_ARC_LENGTH_DEGENERATE';
  }
  if (!Number.isFinite(input.twistRateBudgetDegPerMM) || input.twistRateBudgetDegPerMM <= 0) {
    return 'HOLD_TWIST_RATE_BUDGET_UNFROZEN';
  }
  if (input.positiveControlSawtoothRejected !== true) return 'HOLD_POSITIVE_CONTROL_MISSING';
  const maxRate = maxTwistRateDegPerMM(input.twistAnglesDeg, lengths);
  if (maxRate > input.twistRateBudgetDegPerMM) return 'HOLD_TWIST_RATE_SPIKE';
  if (!Number.isFinite(input.refinementErrorDeg) || !Number.isFinite(input.refinementToleranceDeg) ||
      input.refinementErrorDeg > input.refinementToleranceDeg) {
    return 'HOLD_SAMPLING_REFINEMENT_UNBOUND';
  }
  if (!Number.isFinite(input.reversalErrorDeg) || !Number.isFinite(input.reversalToleranceDeg) ||
      input.reversalErrorDeg > input.reversalToleranceDeg) {
    return 'HOLD_REVERSAL_SYMMETRY_UNBOUND';
  }
  return 'FRAME_TWIST_CONTINUITY_VERIFIED';
}

const valid = {
  framesValid: true,
  centers: [[0, 0, 0], [1, 0, 0], [2, 0, 0], [3, 0, 0]],
  twistAnglesDeg: [0, 2, 4, 6],
  twistRateBudgetDegPerMM: 10,
  positiveControlSawtoothRejected: true,
  refinementErrorDeg: 0.1,
  refinementToleranceDeg: 0.5,
  reversalErrorDeg: 0.1,
  reversalToleranceDeg: 0.5
};

const sawtooth = {
  ...valid,
  centers: [[0, 0, 0], [0.1, 0, 0], [0.2, 0, 0], [0.3, 0, 0], [0.4, 0, 0]],
  twistAnglesDeg: [0, 44, -44, 44, -44],
  twistRateBudgetDegPerMM: 100
};

const current = fixture.currentEvidence;
const cases = [
  ['F10 current receipt does not bind rate/refinement', current, fixture.expectedState],
  ['invalid frame is rejected first', {...valid, framesValid: false}, 'HOLD_FRAME_ORTHONORMALITY_INVALID'],
  ['repeated center is degenerate', {...valid, centers: [[0,0,0], [0,0,0], [1,0,0], [2,0,0]]}, 'HOLD_ARC_LENGTH_DEGENERATE'],
  ['task threshold must be frozen', {...valid, twistRateBudgetDegPerMM: null}, 'HOLD_TWIST_RATE_BUDGET_UNFROZEN'],
  ['sawtooth positive control is mandatory', {...valid, positiveControlSawtoothRejected: null}, 'HOLD_POSITIVE_CONTROL_MISSING'],
  ['legacy-positive sawtooth fails rate gate', sawtooth, 'HOLD_TWIST_RATE_SPIKE'],
  ['short segment exposes spacing-sensitive rate spike', {...valid, centers: [[0,0,0], [0.01,0,0], [1.01,0,0], [2.01,0,0]], twistAnglesDeg: [0,5,10,15], twistRateBudgetDegPerMM: 100}, 'HOLD_TWIST_RATE_SPIKE'],
  ['refinement mismatch holds', {...valid, refinementErrorDeg: 1}, 'HOLD_SAMPLING_REFINEMENT_UNBOUND'],
  ['reversal mismatch holds', {...valid, reversalErrorDeg: 1}, 'HOLD_REVERSAL_SYMMETRY_UNBOUND'],
  ['bounded smooth sequence verifies', valid, 'FRAME_TWIST_CONTINUITY_VERIFIED']
];

assert.equal(legacyF10ContinuityPass(sawtooth.twistAnglesDeg), true, 'constructed sawtooth must pass the current local predicate');

const results = cases.map(([name, input, expected]) => {
  const actual = classify(input);
  assert.equal(actual, expected, name);
  return {name, expected, actual, pass: true};
});

const output = {
  schema: 'kaopu/hair-bundle-frame-twist-continuity-result@1',
  fixture: 'hair_f10_frame_twist_continuity_n161.json',
  passed: results.length,
  total: results.length,
  currentState: classify(current),
  falsePositiveMechanism: {
    anglesDeg: sawtooth.twistAnglesDeg,
    sectionSpacingMM: 0.1,
    passesObservedF10Predicate: legacyF10ContinuityPass(sawtooth.twistAnglesDeg),
    candidateState: classify(sawtooth),
    note: 'This is a synthetic positive control, not an observation that F10 contains the artifact.'
  },
  results
};

fs.writeFileSync(new URL('./hair_f10_frame_twist_continuity_result_n161.json', import.meta.url), JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify(output, null, 2));
