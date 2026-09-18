import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.env.KAOPU_FARMLAND_SOURCE_ROOT;
if (!root) throw new Error('KAOPU_FARMLAND_SOURCE_ROOT is required');
const rounds = path.join(root, 'farmland-object-dna/research/r045-autonomous-rebuild');
const R33 = await import(pathToFileURL(path.join(rounds, 'round-33/r045_round33_kernel.mjs')));
const R31 = await import(pathToFileURL(path.join(rounds, 'round-31/r045_round31_kernel.mjs')));
const R30 = await import(pathToFileURL(path.join(rounds, 'round-30/r045_round30_kernel.mjs')));

const C = (x, a, b) => Math.max(a, Math.min(b, x));
const S = (a, b, x) => { const t = C((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const stair01 = f => S(.40, .60, f);
const groupStepOffsets = [.015, -.012, .010];
const groupPhaseOffsets = [.035, -.025, .018];

function family(x, z, i) {
  const base = R30.height(x, z);
  const step = R31.terraceStepHeight(x, z) * (1 + groupStepOffsets[i]);
  const phase = R31.terracePhaseWarp(x, z) + groupPhaseOffsets[i] + .018 * Math.sin((z + 1.7 * x) / 44 + i * .9);
  const u = (base + phase) / step, index = Math.floor(u), frac = u - index;
  const target = (index + stair01(frac)) * step - phase;
  return { base, step, phase, index, frac, raw: target - base, target };
}

function commonMask(x, z) {
  const envelope = R33.terraceGroupEnvelope(x, z);
  if (envelope <= 0) return 0;
  const drainClear = R33.terraceDrainageClearance(x, z);
  if (drainClear <= 0) return 0;
  const riverGap = Math.abs(z - R30.riverZ(x));
  const riverClear = S(R30.riverW(x) + 18, R30.riverW(x) + 44, riverGap);
  if (riverClear <= 0) return 0;
  return C(drainClear * riverClear * R33.permissionBridge(x, z), 0, 1);
}

function blendedFamilies(x, z) {
  const weights = R33.terraceGroupWeights(x, z), sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0) return null;
  const families = weights.map((_, i) => family(x, z, i));
  const raw = families.reduce((a, f, i) => a + weights[i] * f.raw, 0) / sum;
  const mask = R33.terraceGroupEnvelope(x, z) * commonMask(x, z);
  return { delta: .84 * mask * raw, families, weights, sum };
}

const spacing = 4;
let switchPairs = 0, refinedSeams = 0, refinedIndexChanging = 0, seamOverFiveCm = 0;
let maxCoarseDeltaJump = 0, maxSeamDeltaJump = 0, maxSeam = null;
let overlapSamples = 0, blendOffFamily = 0, maxBlendOffFamily = 0, maxBlend = null;

function refine(ax, az, bx, bz, ai, bi) {
  const difference = t => {
    const x = ax + (bx - ax) * t, z = az + (bz - az) * t;
    const weights = R33.terraceGroupWeights(x, z);
    return weights[ai] - weights[bi];
  };
  let lo = 0, hi = 1, dlo = difference(0), dhi = difference(1);
  if (dlo * dhi > 0) return;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2, dm = difference(mid);
    if (dlo * dm <= 0) { hi = mid; dhi = dm; }
    else { lo = mid; dlo = dm; }
  }
  const t = (lo + hi) / 2, eps = 1e-7;
  const ta = Math.max(0, t - eps), tb = Math.min(1, t + eps);
  const xa = ax + (bx - ax) * ta, za = az + (bz - az) * ta;
  const xb = ax + (bx - ax) * tb, zb = az + (bz - az) * tb;
  const a = R33.terraceStateAt(xa, za), b = R33.terraceStateAt(xb, zb);
  if (a.groupIndex === b.groupIndex) return;
  refinedSeams++;
  if (a.index !== b.index) refinedIndexChanging++;
  const deltaJump = Math.abs(a.delta - b.delta);
  if (deltaJump > .05) seamOverFiveCm++;
  if (deltaJump > maxSeamDeltaJump) {
    maxSeamDeltaJump = deltaJump;
    maxSeam = {
      boundary: { x: (xa + xb) / 2, z: (za + zb) / 2 },
      a: { x: xa, z: za, group: a.group, groupIndex: a.groupIndex, index: a.index, frac: a.frac, step: a.step, phase: a.phase, mask: a.mask, delta: a.delta },
      b: { x: xb, z: zb, group: b.group, groupIndex: b.groupIndex, index: b.index, frac: b.frac, step: b.step, phase: b.phase, mask: b.mask, delta: b.delta },
      heightJump: Math.abs(R33.height(xa, za) - R33.height(xb, zb)),
      baseJump: Math.abs(a.base - b.base)
    };
  }
}

for (let z = -132; z <= 10; z += spacing) {
  for (let x = -220; x <= 120; x += spacing) {
    const state = R33.terraceStateAt(x, z), weights = R33.terraceGroupWeights(x, z);
    const sorted = weights.map((value, index) => ({ value, index })).sort((a, b) => b.value - a.value);
    if (state.mask > .12 && sorted[1].value > .24) {
      overlapSamples++;
      const blended = blendedFamilies(x, z);
      const activeDeltas = blended.families
        .map((f, i) => ({ weight: weights[i], delta: .84 * state.mask * f.raw, family: f }))
        .filter(v => v.weight > .24);
      const offFamily = Math.min(...activeDeltas.map(v => Math.abs(blended.delta - v.delta)));
      if (offFamily > .05) blendOffFamily++;
      if (offFamily > maxBlendOffFamily) {
        maxBlendOffFamily = offFamily;
        maxBlend = { x, z, weights, blendedDelta: blended.delta, activeDeltas };
      }
    }

    const neighbors = [[x + spacing, z], [x, z + spacing]];
    for (const [nx, nz] of neighbors) {
      if (nx > 120 || nz > 10) continue;
      const next = R33.terraceStateAt(nx, nz);
      if (state.mask <= .12 || next.mask <= .12 || state.groupIndex === next.groupIndex) continue;
      switchPairs++;
      maxCoarseDeltaJump = Math.max(maxCoarseDeltaJump, Math.abs(state.delta - next.delta));
      refine(x, z, nx, nz, state.groupIndex, next.groupIndex);
    }
  }
}

const blendOffFamilyFraction = blendOffFamily / (overlapSamples || 1);
const maxSeamReceipt = { ...maxSeam, baseJumpLessThanOneMicrometre: maxSeam.baseJump < 1e-6 };
delete maxSeamReceipt.baseJump;
const checks = [];
const add = (name, pass, value, limit) => checks.push({ name, pass: Boolean(pass), value, limit });
add('fixed_version', R33.VERSION === 'R045.33', R33.VERSION, 'R045.33');
add('overlap_and_switches_exist', overlapSamples > 600 && switchPairs > 100, { overlapSamples, switchPairs }, '>600 overlap samples and >100 coarse switch pairs');
add('switch_boundaries_refined', refinedSeams === switchPairs, { refinedSeams, switchPairs }, 'every coarse switch pair yields an epsilon-scale dominant-family switch');
add('hard_winner_has_material_epsilon_seams', maxSeamDeltaJump > .75 && maxSeam.baseJump < 1e-5, maxSeamReceipt, '>0.75 m terrace delta jump while substrate change is <1e-5 m');
add('seams_are_not_only_level_index_changes', maxSeam.a.index === maxSeam.b.index && refinedIndexChanging < refinedSeams, { maximumIndices: [maxSeam.a.index, maxSeam.b.index], refinedIndexChanging, refinedSeams }, 'same terrace index at maximum seam; not all seams change index');
add('material_seams_are_common_in_sampled_switches', seamOverFiveCm > 100, { seamOverFiveCm, refinedSeams }, '>100 refined switch pairs exceed 5 cm');
add('naive_height_blend_loses_family_level_identity', blendOffFamilyFraction > .60 && maxBlendOffFamily > .35, { overlapSamples, blendOffFamily, blendOffFamilyFraction, maxBlendOffFamily, maxBlend }, '>60% of overlap samples more than 5 cm from every active family and maximum >0.35 m');
add('production_locks_preserved', R33.snapshot.visualAcceptance === false && R33.snapshot.parcelGenerationEnabled === false && R33.snapshot.waterStateKnown === false && R33.snapshot.productionReady === false, { visualAcceptance: R33.snapshot.visualAcceptance, parcelGenerationEnabled: R33.snapshot.parcelGenerationEnabled, waterStateKnown: R33.snapshot.waterStateKnown, productionReady: R33.snapshot.productionReady }, 'all remain false');

const result = {
  schema: 'kaopu.probe.farmland-terrace-family-junction-n22/1',
  source: { repository: 'haihao0307/guilin-dem-pipeline', commit: 'f8b180f1b1bda01885bdef6e3a2ab25e0c2257f8', version: R33.VERSION },
  passed: checks.every(c => c.pass), gateCount: checks.length, passedCount: checks.filter(c => c.pass).length, checks,
  sampling: { boundsMeters: { xmin: -220, xmax: 120, zmin: -132, zmax: 10 }, coarseSpacingMeters: spacing, bisectionIterations: 40, epsilonSegmentFraction: 1e-7 },
  metrics: { overlapSamples, switchPairs, refinedSeams, refinedIndexChanging, seamOverFiveCm, maxCoarseDeltaJump, maxSeamDeltaJump, maxSeam: maxSeamReceipt, blendOffFamily, blendOffFamilyFraction, maxBlendOffFamily, maxBlend },
  currentBestView: [
    'R045.33 uses a continuous max envelope but chooses step and phase from a discontinuous dominant-family label; continuity of the mask therefore does not imply continuity of the composed height',
    'interpolating already-quantized family heights removes the hard switch but creates intermediate elevations that need not belong to any family level',
    'branch and merge design should version family identity, junction topology and height compositing separately, then audit value seams, gradients, cut/fill and the existing visual and hydraulic locks'
  ],
  rejected: [
    'overlapping smooth family weights guarantee a continuous terraced height',
    'a four-metre neighbor bound detects epsilon-scale label-switch seams',
    'linear blending of quantized family heights preserves terrace-level identity',
    'the probe authorizes a production algorithm or proves agricultural truth'
  ],
  unknown: [
    'which junction topology and family-label transition the Farmland Mother will choose',
    'an accepted seam, gradient and cut/fill tolerance for the actual use',
    'hardware GPU, public runtime, Mother implementation/adoption and user visual acceptance'
  ]
};

function canonicalize(value) {
  // Keep the replay receipt stable across libm/CPU implementations. The first
  // CI run differed only in the last serialized digits of an epsilon-side
  // substrate delta, not in any gate or reported engineering-scale result.
  if (typeof value === 'number' && Number.isFinite(value) && !Number.isInteger(value)) return Number(value.toPrecision(9));
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, canonicalize(v)]));
  return value;
}

const stable = canonicalize(result);
const out = process.env.KAOPU_N22_OUTPUT || new URL('./farmland_terrace_family_junction_result_n22.json', import.meta.url);
fs.writeFileSync(out, `${JSON.stringify(stable, null, 2)}\n`);
console.log(JSON.stringify(stable, null, 2));
if (!result.passed) process.exitCode = 2;
