import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.env.KAOPU_FARMLAND_SOURCE_ROOT;
if (!root) throw new Error('KAOPU_FARMLAND_SOURCE_ROOT is required');
const rounds = path.join(root, 'farmland-object-dna/research/r045-autonomous-rebuild');
const R39 = await import(pathToFileURL(path.join(rounds, 'round-39/r045_round39_kernel.mjs')));
const R38 = await import(pathToFileURL(path.join(rounds, 'round-38/r045_round38_kernel.mjs')));
const R30 = await import(pathToFileURL(path.join(rounds, 'round-30/r045_round30_kernel.mjs')));

const compatible = (a, b) => a.groupIndex === b.groupIndex
  && Math.abs(a.step - b.step) <= Math.max(.18, .24 * .5 * (a.step + b.step))
  && Math.abs(a.index - b.index) <= 3;
const stableSide = (x, z, dx, dz, base, sign) => {
  const n1 = R38.terraceStateAt(x + 6 * dx * sign, z + 6 * dz * sign);
  const n2 = R38.terraceStateAt(x + 12 * dx * sign, z + 12 * dz * sign);
  return n1.mask > .12 && n2.mask > .12
    && compatible(base, n1) && compatible(base, n2) && compatible(n1, n2);
};

// These ten material R39 continuation-gain samples were discovered on the same 6 m audit lattice used by
// R39. Keeping the coordinates explicit turns the expensive discovery sweep into a bounded replay.
const fixedPromotions = [
  [-106, -108], [-52, -102], [-142, -72], [-112, -54], [-16, -54],
  [-52, -30], [104, -30], [68, -24], [86, -24], [68, 0]
];
const samples = fixedPromotions.map(([x, z]) => {
  const base = R38.terraceStateAt(x, z);
  const gradient = R30.gradient(x, z);
  const mag = Math.hypot(gradient.dx, gradient.dz);
  const tangent = [-gradient.dz / mag, gradient.dx / mag];
  const gain = R39.stableRunContinuationGain(x, z);
  const tangentBacked = stableSide(x, z, tangent[0], tangent[1], base, -1)
    || stableSide(x, z, tangent[0], tangent[1], base, 1);
  const axisTangentAngleDeg = Math.acos(Math.min(1, Math.abs(tangent[0]))) * 180 / Math.PI;
  return {
    x, z, gain,
    heightChangeFromR38: R39.height(x, z) - R38.height(x, z),
    baseMask: base.mask,
    gradient,
    contourTangent: tangent,
    axisTangentAngleDeg,
    fixedAxisNormalProjection: Math.abs(gradient.dx) / mag,
    tangentBacked
  };
});
const angles = samples.map(s => s.axisTangentAngleDeg).sort((a, b) => a - b);
const q = p => angles[Math.floor((angles.length - 1) * p)];
const worst = [...samples].sort((a, b) => b.axisTangentAngleDeg - a.axisTangentAngleDeg)[0];
const thresholdCrossings = samples.filter(s => s.baseMask <= .12 && s.baseMask + s.gain > .12);
const axisOnlyThresholdCrossings = thresholdCrossings.filter(s => !s.tangentBacked);
const worstAxisOnlyThresholdCrossing = [...axisOnlyThresholdCrossings].sort((a, b) => b.axisTangentAngleDeg - a.axisTangentAngleDeg)[0];

// Minimal classifier control: rotate an otherwise identical two-cell run by 90 degrees.
// R39 samples only x +/- 6 and x +/- 12, so the rotated support is invisible to it.
const cell = (mask = 0) => ({ mask, groupIndex: 1, step: 1, index: 4 });
const key = (x, z) => `${x},${z}`;
const classifier = map => {
  const base = cell(0.1);
  const side = sign => {
    const n1 = map.get(key(6 * sign, 0)) || cell();
    const n2 = map.get(key(12 * sign, 0)) || cell();
    return n1.mask > .12 && n2.mask > .12
      && compatible(base, n1) && compatible(base, n2) && compatible(n1, n2);
  };
  return side(-1) || side(1);
};
const horizontal = new Map([[key(-6, 0), cell(.5)], [key(-12, 0), cell(.5)]]);
const rotated90 = new Map([[key(0, -6), cell(.5)], [key(0, -12), cell(.5)]]);
const rotationControl = { horizontalAccepted: classifier(horizontal), rotated90Accepted: classifier(rotated90) };

const metrics = {
  fixedPromotionCount: samples.length,
  allPromotionGainsPositive: samples.every(s => s.gain > 0),
  axisOnlyCount: samples.filter(s => !s.tangentBacked).length,
  thresholdCrossingCount: thresholdCrossings.length,
  axisOnlyThresholdCrossingCount: axisOnlyThresholdCrossings.length,
  axisVsContourAngleDeg: {
    min: q(0), median: q(.5), p90: q(.9), max: q(1),
    over30: angles.filter(a => a > 30).length,
    over45: angles.filter(a => a > 45).length
  },
  worst,
  worstAxisOnlyThresholdCrossing,
  rotationControl,
  samples
};

const checks = [];
const add = (name, pass, value, limit) => checks.push({ name, pass: Boolean(pass), value, limit });
add('fixed_source_versions', R39.VERSION === 'R045.39' && R38.VERSION === 'R045.38', { r39: R39.VERSION, r38: R38.VERSION }, 'R045.39 over R045.38');
add('fixed_gain_samples_replay', samples.length === 10 && samples.every(s => s.gain > .008), { count: samples.length, minGain: Math.min(...samples.map(s => s.gain)) }, 'ten fixed R39 continuation-gain samples, each gain > 0.008');
add('fixed_axis_materially_misaligned', metrics.axisVsContourAngleDeg.over30 >= 6 && metrics.axisVsContourAngleDeg.max > 50, metrics.axisVsContourAngleDeg, 'at least 6/10 over 30 degrees and max over 50 degrees');
add('axis_support_not_equivalent_to_tangent_support', metrics.axisOnlyCount >= 3, metrics.axisOnlyCount, 'at least three gain samples lack the analogous two-cell support along the local contour tangent');
add('worst_case_is_cross_contour_material', worst.axisTangentAngleDeg > 50 && worst.fixedAxisNormalProjection > .78 && worst.gain > .07 && worst.tangentBacked === false, worst, '>50 degrees, >0.78 normal projection, >0.07 gain, no tangent-backed pair');
add('axis_only_support_changes_active_topology', metrics.axisOnlyThresholdCrossingCount >= 2 && worstAxisOnlyThresholdCrossing.axisTangentAngleDeg > 40 && worstAxisOnlyThresholdCrossing.fixedAxisNormalProjection > .67, { count: metrics.axisOnlyThresholdCrossingCount, worst: worstAxisOnlyThresholdCrossing }, 'at least two axis-only gains cross active threshold; worst is >40 degrees from tangent and >0.67 normal projection');
add('classifier_fails_rotation_control', rotationControl.horizontalAccepted === true && rotationControl.rotated90Accepted === false, rotationControl, 'otherwise identical support changes result under 90-degree rotation');
add('production_locks_preserved', R39.snapshot.visualAcceptance === false && R39.snapshot.parcelGenerationEnabled === false && R39.snapshot.waterStateKnown === false && R39.snapshot.productionReady === false, { visualAcceptance: R39.snapshot.visualAcceptance, parcelGenerationEnabled: R39.snapshot.parcelGenerationEnabled, waterStateKnown: R39.snapshot.waterStateKnown, productionReady: R39.snapshot.productionReady }, 'all remain false');

const result = {
  schema: 'kaopu.probe.farmland-contour-direction-n24/1',
  source: { repository: 'haihao0307/guilin-dem-pipeline', commit: '3f7eaf4f12a07d26c67c8e4659d8eceff5c691d5', version: R39.VERSION },
  passed: checks.every(c => c.pass),
  gateCount: checks.length,
  passedCount: checks.filter(c => c.pass).length,
  checks,
  metrics,
  candidate: {
    status: 'frame-aware topology contract; no production continuation algorithm or tolerance selected',
    minimumReceipt: [
      'declare the height-field version and derivative scale used to define local contour tangent',
      'separate orientation-independent connected-component/topology evidence from axis-specific row diagnostics',
      'test rotated and offset lattices plus local-tangent alignment; retain low-gradient Unknown band and drainage locks'
    ]
  },
  currentBestView: [
    'A world-X row run is a sampling diagnostic, not a coordinate-invariant terrace-family topology contract.',
    'For contour-following morphology, neighborhood direction must be derived from a declared local terrain frame or topology must be measured without privileging a world axis.',
    'Local tangent following is itself only a Candidate: it is unstable on near-flat terrain, depends on derivative scale, and does not override drainage or field-evidence locks.'
  ],
  rejected: [
    'same-family and stair-compatible x-neighbours prove contour-following continuation',
    'lower horizontal row fragmentation proves better two-dimensional nested/branching/merging topology',
    'the analysis tangent is an accepted production algorithm'
  ],
  unknown: [
    'Mother-selected rotation-invariant topology representation and acceptance tolerances',
    'behaviour on near-flat/critical points, real mesh and LOD transitions',
    'hardware/public runtime, Mother acknowledgement or adoption, and user visual acceptance'
  ]
};

function canonicalize(value) {
  if (typeof value === 'number' && Number.isFinite(value) && !Number.isInteger(value)) return Number(value.toPrecision(10));
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, canonicalize(v)]));
  return value;
}
const stable = canonicalize(result);
const out = process.env.KAOPU_N24_OUTPUT || new URL('./farmland_contour_direction_result_n24.json', import.meta.url);
fs.writeFileSync(out, `${JSON.stringify(stable, null, 2)}\n`);
console.log(JSON.stringify(stable, null, 2));
if (!stable.passed) process.exitCode = 2;
