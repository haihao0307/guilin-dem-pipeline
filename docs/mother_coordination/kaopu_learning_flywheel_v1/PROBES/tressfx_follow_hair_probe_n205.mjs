import assert from 'node:assert/strict';

const samples = 33;
const radius = 0.10;
const rootOffset = [0, 0.005, 0];
const tipSeparationFactor = 2.0;

const add = (a, b) => a.map((v, i) => v + b[i]);
const mul = (a, s) => a.map(v => v * s);
const sub = (a, b) => a.map((v, i) => v - b[i]);
const dot = (a, b) => a.reduce((n, v, i) => n + v * b[i], 0);
const length = a => Math.hypot(...a);
const unit = a => mul(a, 1 / length(a));
const arcLength = points => points.slice(1).reduce((n, p, i) => n + length(sub(p, points[i])), 0);

// Quarter-circle guide. Its root tangent is +X, so +Y is a legal vector in
// the root-tangent plane used by TressFX GenerateFollowHairs().
const guide = Array.from({length: samples}, (_, k) => {
  const theta = (Math.PI / 2) * k / (samples - 1);
  return [radius * Math.sin(theta), radius * (1 - Math.cos(theta)), 0];
});

// Exact TressFX 4.1 rule at ba0bdac: guideVert + rootOffset *
// (1 + tipSeparationFactor * k / numVerticesPerStrand).
const follower = guide.map((p, k) => add(p, mul(rootOffset,
  1 + tipSeparationFactor * k / samples)));

const guideArc = arcLength(guide);
const followerArc = arcLength(follower);
const rootPositionError = length(sub(follower[0], guide[0]));
const tipTheta = Math.PI / 2;
const tipTangent = unit([Math.cos(tipTheta), Math.sin(tipTheta), 0]);
const tipOffset = sub(follower.at(-1), guide.at(-1));
const tipTangentLeak = Math.abs(dot(tipOffset, tipTangent));
const tipPerpendicularSeparation = Math.sqrt(Math.max(0,
  dot(tipOffset, tipOffset) - dot(tipOffset, tipTangent) ** 2));

const result = {
  schema: 'kaopu.learning-probe/tressfx-follow-hair-counterexample@1',
  source: {
    repository: 'GPUOpen-Effects/TressFX',
    commit: 'ba0bdacdfb964e38522fda812bf23169bc5fa603',
    file: 'src/TressFX/TressFXAsset.cpp',
    function: 'TressFXAsset::GenerateFollowHairs'
  },
  fixture: {samples, radius, rootOffset, tipSeparationFactor},
  measurements: {
    guideArcLength: guideArc,
    followerArcLength: followerArc,
    arcLengthDriftRatio: (followerArc - guideArc) / guideArc,
    rootPositionError,
    tipOffsetLength: length(tipOffset),
    tipTangentLeak,
    tipPerpendicularSeparation
  },
  existingGateReplays: {
    N151_activeRootGuideCoverage: rootPositionError > 0
      ? 'REJECT_SHARED_STRAND_UV_WITH_NONZERO_ROOT_OFFSET'
      : 'PASS',
    N157_guideArcLengthInvariant: Math.abs(followerArc - guideArc) > 1e-12
      ? 'HOLD_GUIDE_STRETCH_OUT_OF_BOUND'
      : 'PASS',
    N161_frameTwistContinuity: tipTangentLeak > 1e-12
      ? 'HOLD_TRANSPORTED_FRAME_IDENTITY_UNBOUND'
      : 'PASS'
  },
  decision: 'REJECTED',
  reason: 'The fixed root-frame offset is not transported along the curved guide; it changes centerline length, leaks into the tip tangent, and does not provide an independently surface-bound follower root.'
};

assert(rootPositionError > 0);
assert(Math.abs(result.measurements.arcLengthDriftRatio) > 1e-4);
assert(tipTangentLeak > 0.01);
assert(tipPerpendicularSeparation < 1e-10);
assert.equal(result.decision, 'REJECTED');

console.log(JSON.stringify(result, null, 2));
