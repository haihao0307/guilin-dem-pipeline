import assert from 'node:assert/strict';

const N = 49;
const theta = 20 * Math.PI / 180;
const points = fn => Array.from({length: N}, (_, i) => fn(i / (N - 1)));
const add = (a, b) => a.map((v, i) => v + b[i]);
const sub = (a, b) => a.map((v, i) => v - b[i]);
const len = a => Math.hypot(...a);
const arc = p => p.slice(1).reduce((n, q, i) => n + len(sub(q, p[i])), 0);
const drift = (rest, moved) => (arc(moved) - arc(rest)) / arc(rest);

const representative = points(t => [t, 0, 0]);
const parallelFollower = points(t => [t, 0.1, 0]);
const orthogonalFollower = points(t => [0, t, 0]);
const rotatedRepresentative = representative.map(([x, y, z]) => [
  x * Math.cos(theta) - y * Math.sin(theta),
  x * Math.sin(theta) + y * Math.cos(theta), z
]);
const delta = rotatedRepresentative.map((p, i) => sub(p, representative[i]));
const apply = path => path.map((p, i) => add(p, delta[i]));

const geometry = {
  representativeArcDriftRatio: drift(representative, apply(representative)),
  parallelFollowerArcDriftRatio: drift(parallelFollower, apply(parallelFollower)),
  orthogonalFollowerArcDriftRatio: drift(orthogonalFollower, apply(orthogonalFollower)),
  representativeRootError: len(sub(apply(representative)[0], representative[0])),
  orthogonalFollowerRootError: len(sub(apply(orthogonalFollower)[0], orthogonalFollower[0]))
};

function classify(r) {
  if (!r.subjectBound) return 'HOLD_SUBJECT_UNBOUND';
  if (!r.rootBindingBound) return 'HOLD_ROOT_BINDING_UNBOUND';
  if (!r.representativeArcBound) return 'HOLD_REPRESENTATIVE_ARC_RECEIPT_MISSING';
  if (!r.fullFollowerCensus || !r.perFollowerArcBound) return 'HOLD_FOLLOWER_ARC_RECEIPT_MISSING';
  if (!r.thresholdFrozen) return 'HOLD_FOLLOWER_ARC_THRESHOLD_UNFROZEN';
  if (!r.positiveControlDetected) return 'HOLD_FOLLOWER_POSITIVE_CONTROL_MISSING';
  if (r.maxFollowerArcDriftRatio > r.maxAllowedFollowerArcDriftRatio) return 'REJECT_FOLLOWER_ARC_STRETCH';
  return 'SCOPED_FOLLOWER_DELTA_TRANSFER_VERIFIED_NOT_PER_STRAND_PHYSICS';
}

const base = {
  subjectBound: true,
  rootBindingBound: true,
  representativeArcBound: true,
  fullFollowerCensus: true,
  perFollowerArcBound: true,
  thresholdFrozen: true,
  positiveControlDetected: true,
  maxFollowerArcDriftRatio: 0,
  maxAllowedFollowerArcDriftRatio: 0.01
};

const cases = [
  ['subject-unbound', {...base, subjectBound: false}, 'HOLD_SUBJECT_UNBOUND'],
  ['roots-only', {...base, rootBindingBound: false}, 'HOLD_ROOT_BINDING_UNBOUND'],
  ['current-f13-no-representative-arc-receipt', {...base, representativeArcBound: false}, 'HOLD_REPRESENTATIVE_ARC_RECEIPT_MISSING'],
  ['guide-green-followers-unmeasured', {...base, fullFollowerCensus: false, perFollowerArcBound: false}, 'HOLD_FOLLOWER_ARC_RECEIPT_MISSING'],
  ['threshold-after-seeing-result', {...base, thresholdFrozen: false}, 'HOLD_FOLLOWER_ARC_THRESHOLD_UNFROZEN'],
  ['no-orthogonal-follower-positive-control', {...base, positiveControlDetected: false}, 'HOLD_FOLLOWER_POSITIVE_CONTROL_MISSING'],
  ['rigid-guide-delta-stretches-orthogonal-follower', {...base, maxFollowerArcDriftRatio: geometry.orthogonalFollowerArcDriftRatio}, 'REJECT_FOLLOWER_ARC_STRETCH'],
  ['complete-census-scoped-pass', {...base, maxFollowerArcDriftRatio: 0.004}, 'SCOPED_FOLLOWER_DELTA_TRANSFER_VERIFIED_NOT_PER_STRAND_PHYSICS']
].map(([id, input, expected]) => ({id, expected, actual: classify(input), pass: classify(input) === expected}));

const result = {
  schema: 'kaopu.learning-probe/hair-representative-delta-transfer@1',
  sourceSubject: {
    repository: 'haihao0307/guilin-dem-pipeline',
    commit: '2175d53de12a44dbedb989d3e8b34837f6315dcb',
    files: [
      'kaopu-hair-workbench/foundation/f13/src/PhotoDynamics.mjs',
      'kaopu-hair-workbench/foundation/f13/src/PlannedFiberView.mjs',
      'kaopu-hair-workbench/foundation/f13/evidence/verification.json'
    ]
  },
  boundedQuestion: 'Does a length-preserving representative-guide displacement field prove that every displayed follower path in the clump remains inextensible?',
  syntheticFixture: {samples: N, representativeRotationDegrees: 20, geometry},
  cases,
  passed: cases.filter(x => x.pass).length,
  total: cases.length,
  decision: 'HOLD_F13_FOLLOWER_DELTA_TRANSFER_INEXTENSIBILITY_UNBOUND',
  teacher: 'NO_NOVELTY'
};

assert(Math.abs(geometry.representativeArcDriftRatio) < 1e-12);
assert(Math.abs(geometry.parallelFollowerArcDriftRatio) < 1e-12);
assert(geometry.orthogonalFollowerArcDriftRatio > 0.3);
assert.equal(geometry.representativeRootError, 0);
assert.equal(geometry.orthogonalFollowerRootError, 0);
assert.equal(result.passed, result.total);
console.log(JSON.stringify(result, null, 2));
