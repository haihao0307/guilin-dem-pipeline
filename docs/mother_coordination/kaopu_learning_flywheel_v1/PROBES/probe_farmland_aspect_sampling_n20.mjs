import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.env.KAOPU_FARMLAND_SOURCE_ROOT;
if (!root) throw new Error('KAOPU_FARMLAND_SOURCE_ROOT is required');
const r29dir = path.join(root, 'farmland-object-dna/research/r045-autonomous-rebuild/round-29');
const r30dir = path.join(root, 'farmland-object-dna/research/r045-autonomous-rebuild/round-30');
const R29 = await import(pathToFileURL(path.join(r29dir, 'r045_round29_kernel.mjs')));
const R30 = await import(pathToFileURL(path.join(r30dir, 'r045_round30_kernel.mjs')));

const deg = 180 / Math.PI;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

function finite(v) {
  return Number.isFinite(v) ? v : null;
}

function candidate(x, z) {
  if (Math.abs(R30.aspectDelta(x, z)) < .01) return null;
  if (R29.nearestExtendedDrainageDistance(x, z) < 18) return null;
  const a = R29.gradient(x, z), b = R30.gradient(x, z);
  const oldMagnitude = Math.hypot(a.dx, a.dz), newMagnitude = Math.hypot(b.dx, b.dz);
  if (oldMagnitude < .01 || newMagnitude < .01) return null;
  const dot = a.dx * b.dx + a.dz * b.dz;
  const cross = a.dx * b.dz - a.dz * b.dx;
  const acosDegrees = Math.acos(clamp(dot / (oldMagnitude * newMagnitude), -1, 1)) * deg;
  const signedAtan2Degrees = Math.atan2(cross, dot) * deg;
  return {
    x, z,
    oldMagnitude, newMagnitude,
    minMagnitude: Math.min(oldMagnitude, newMagnitude),
    gradientDeltaMagnitude: Math.hypot(b.dx - a.dx, b.dz - a.dz),
    acosDegrees,
    signedAtan2Degrees,
    aspectDeltaMeters: R30.aspectDelta(x, z)
  };
}

function scan(name, x0, x1, dx, z0, z1, dz) {
  const samples = [];
  for (let x = x0; x <= x1 + 1e-12; x += dx) for (let z = z0; z <= z1 + 1e-12; z += dz) {
    const q = candidate(x, z);
    if (q) samples.push(q);
  }
  const maximum = samples.reduce((best, q) => !best || q.acosDegrees > best.acosDegrees ? q : best, null);
  const signedAgreementMax = Math.max(0, ...samples.map(q => Math.abs(Math.abs(q.signedAtan2Degrees) - q.acosDegrees)));
  const bands = [
    { name: 'mother_floor_to_0.02', min: .01, max: .02 },
    { name: '0.02_to_0.05', min: .02, max: .05 },
    { name: 'at_least_0.05', min: .05, max: Infinity }
  ].map(b => {
    const subset = samples.filter(q => q.minMagnitude >= b.min && q.minMagnitude < b.max);
    return {
      name: b.name,
      count: subset.length,
      maximumDegrees: subset.length ? Math.max(...subset.map(q => q.acosDegrees)) : null,
      maximumGradientDeltaMagnitude: subset.length ? Math.max(...subset.map(q => q.gradientDeltaMagnitude)) : null
    };
  });
  return { name, lattice: { x0, x1, dx, z0, z1, dz }, count: samples.length, maximum, signedAgreementMax, bands };
}

const mother = scan('mother_10x6', -210, 210, 10, -80, 80, 6);
const shifted = scan('shifted_10x6', -205, 205, 10, -77, 79, 6);
const denser = scan('denser_5x4', -210, 210, 5, -80, 80, 4);

// Identical orthogonal gradient perturbation, applied at two base magnitudes. This is a compact
// conditioning counterexample: direction becomes arbitrarily sensitive as the base gradient tends
// to zero even while the vector perturbation remains fixed.
const perturbation = .01;
const conditioning = [.014, .14].map(baseMagnitude => ({
  baseMagnitude,
  perturbation,
  angleDegrees: Math.atan2(perturbation, baseMagnitude) * deg
}));

const checks = [];
const add = (name, pass, value, limit) => checks.push({ name, pass: Boolean(pass), value, limit });
add('fixed_versions', R29.VERSION === 'R045.29' && R30.VERSION === 'R045.30', { before: R29.VERSION, after: R30.VERSION }, 'R045.29 -> R045.30');
add('mother_lattice_replayed', Math.abs(mother.maximum.acosDegrees - 32.38427408738265) < 1e-9 && mother.maximum.x === -60 && mother.maximum.z === 34, mother.maximum, 'exact published coarse maximum and location');
add('atan2_matches_acos_magnitude', Math.max(mother.signedAgreementMax, shifted.signedAgreementMax, denser.signedAgreementMax) < 1e-9, { mother: mother.signedAgreementMax, shifted: shifted.signedAgreementMax, denser: denser.signedAgreementMax }, '<1e-9 degree on non-degenerate retained samples');
add('denser_lattice_finds_missed_threshold_crossing', denser.maximum.acosDegrees > 35, denser.maximum, '>35 degrees while fixed Mother lattice reports <35 degrees');
add('missed_peak_is_near_flat', denser.maximum.minMagnitude < .02, denser.maximum.minMagnitude, 'minimum old/new gradient magnitude below 0.02');
add('lattice_phase_changes_reported_maximum', Math.abs(shifted.maximum.acosDegrees - mother.maximum.acosDegrees) > .1, { mother: mother.maximum.acosDegrees, shifted: shifted.maximum.acosDegrees }, '>0.1 degree difference under same spacing with shifted origin');
add('conditioning_counterexample_is_live', conditioning[0].angleDegrees > 30 && conditioning[1].angleDegrees < 5, conditioning, 'same 0.01 vector perturbation produces >30 degrees near flat and <5 degrees at 10x magnitude');
add('locks_preserved', R30.snapshot.visualAcceptance === false && R30.snapshot.terraceGeometryEnabled === false && R30.snapshot.waterStateKnown === false && R30.snapshot.productionReady === false, { visualAcceptance: R30.snapshot.visualAcceptance, terraceGeometryEnabled: R30.snapshot.terraceGeometryEnabled, waterStateKnown: R30.snapshot.waterStateKnown, productionReady: R30.snapshot.productionReady }, 'all remain false');

const result = {
  schema: 'kaopu.probe.farmland-aspect-sampling-n20/1',
  source: {
    repository: 'haihao0307/guilin-dem-pipeline',
    commit: 'b542dccc1a44880dbb8a6ba8313bcfa0e6da3726',
    implementationCommit: '86186dd',
    sourceFiniteDifferenceHalfStepMeters: 1,
    motherAspectEligibilityFloor: .01
  },
  passed: checks.every(c => c.pass),
  gateCount: checks.length,
  passedCount: checks.filter(c => c.pass).length,
  checks,
  scans: { mother, shifted, denser },
  conditioning,
  currentBestView: [
    'a maximum angle from one lattice is a sampled diagnostic, not a bound over the continuous support',
    'aspect is ill-conditioned near a flat: preserve gradient magnitude and gradient-vector delta beside signed angle',
    'use atan2(cross,dot) for signed wrapped angle only after both gradients pass a declared magnitude floor',
    'an application-specific magnitude floor is still Unknown here; 0.02 is a diagnostic band, not a proposed production threshold'
  ],
  rejected: [
    'raising the 35 degree threshold merely because a denser lattice found 35.64 degrees',
    'treating the Mother 10x6 metre maximum as a continuous-field guarantee',
    'treating direction on near-flat samples as stable without retaining slope magnitude'
  ],
  unknown: [
    'purpose-specific slope magnitude floor for Farmland classification or geometry acceptance',
    'maximum over the continuous field between all samples',
    'hardware GPU, mobile, public runtime and user visual acceptance'
  ]
};

function canonicalize(value) {
  if (typeof value === 'number' && Number.isFinite(value) && !Number.isInteger(value)) return Number(value.toPrecision(12));
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, canonicalize(v)]));
  return value;
}

const stable = canonicalize(result);
const out = process.env.KAOPU_N20_OUTPUT || new URL('./farmland_aspect_sampling_result_n20.json', import.meta.url);
fs.writeFileSync(out, `${JSON.stringify(stable, null, 2)}\n`);
console.log(JSON.stringify(stable, null, 2));
if (!result.passed) process.exitCode = 2;
