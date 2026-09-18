import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.env.KAOPU_FARMLAND_SOURCE_ROOT;
if (!root) throw new Error('KAOPU_FARMLAND_SOURCE_ROOT is required');
const rounds = path.join(root, 'farmland-object-dna/research/r045-autonomous-rebuild');
const R36 = await import(pathToFileURL(path.join(rounds, 'round-36/r045_round36_kernel.mjs')));
const R35 = await import(pathToFileURL(path.join(rounds, 'round-35/r045_round35_kernel.mjs')));
const motherQa = JSON.parse(fs.readFileSync(path.join(rounds, 'round-36/r045_round36_qa_result.json'), 'utf8'));

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

const z = -108;
let lo = 42.75, hi = 43;
const threshold = 0.035;
const clearance = x => R35.terraceDrainageClearance(x, z);
const initialBracket = { lo, hi, loClearance: clearance(lo), hiClearance: clearance(hi) };
if (!(initialBracket.loClearance < threshold && initialBracket.hiClearance > threshold)) {
  throw new Error(`fixed bracket no longer crosses the R36 clearance threshold: ${JSON.stringify(initialBracket)}`);
}
for (let i = 0; i < 50; i++) {
  const mid = (lo + hi) / 2;
  if (clearance(mid) > threshold) hi = mid;
  else lo = mid;
}
const boundaryX = (lo + hi) / 2;
const epsilonMeters = 1e-6;

function pairReceipt(pair) {
  if (!pair) return null;
  return {
    axis: pair.axis,
    angle: pair.angle,
    distance: pair.distance,
    groupIndex: pair.groupIndex,
    indexGap: pair.indexGap,
    stepGap: pair.stepGap,
    strength: pair.strength
  };
}

function sample(x) {
  const r36 = R36.terraceStateAt(x, z);
  const r35 = R35.terraceStateAt(x, z);
  const drain = clearance(x);
  const taper = smoothstep(threshold, threshold + 0.02, drain);
  const currentHeight = R36.height(x, z);
  const inheritedHeight = R35.height(x, z);
  const candidateHeight = inheritedHeight + taper * (currentHeight - inheritedHeight);
  return {
    x,
    drain,
    broad: R35.broadTerraceEligibility(x, z),
    groupEnvelope: R35.terraceGroupEnvelope(x, z),
    oldMask: r35.mask,
    currentMask: r36.mask,
    currentTarget: r36.stitchStrength,
    oldGroupIndex: r35.groupIndex,
    oldIndex: r35.index,
    oldRaw: r35.raw,
    pair: pairReceipt(R36.contourPairAt(x, z)),
    currentAcceptedPair: pairReceipt(r36.stitchPair),
    inheritedHeight,
    currentHeight,
    currentLift: currentHeight - inheritedHeight,
    taper,
    candidateHeight
  };
}

const left = sample(boundaryX - epsilonMeters);
const right = sample(boundaryX + epsilonMeters);
const farInside = sample(44);
const pairIdentity = ['axis', 'angle', 'distance', 'groupIndex'].every(k => left.pair?.[k] === right.pair?.[k]);
const metrics = {
  boundary: { x: boundaryX, z, threshold, bisectionIterations: 50, epsilonMeters, spanMeters: 2 * epsilonMeters },
  initialBracket,
  left,
  right,
  inheritedHeightJump: Math.abs(right.inheritedHeight - left.inheritedHeight),
  currentHeightJump: Math.abs(right.currentHeight - left.currentHeight),
  currentLiftJump: Math.abs(right.currentLift - left.currentLift),
  currentMaskJump: Math.abs(right.currentMask - left.currentMask),
  candidateHeightJump: Math.abs(right.candidateHeight - left.candidateHeight),
  pairIdentity,
  motherQa: { passed: motherQa.passed, gateCount: motherQa.gateCount, passedCount: motherQa.passedCount, coarseMaxAddedStep: motherQa.metrics?.maxAddedStep },
  farInside: { x: farInside.x, drain: farInside.drain, taper: farInside.taper, currentHeight: farInside.currentHeight, candidateHeight: farInside.candidateHeight }
};

const checks = [];
const add = (name, pass, value, limit) => checks.push({ name, pass: Boolean(pass), value, limit });
add('fixed_version_and_mother_qa_receipt', R36.VERSION === 'R045.36' && motherQa.passed === true && motherQa.passedCount === motherQa.gateCount, { version: R36.VERSION, motherQa: metrics.motherQa }, 'R045.36 and its persisted QA passes all gates');
add('clearance_boundary_is_refined', Math.abs(left.drain - threshold) < 1e-6 && Math.abs(right.drain - threshold) < 1e-6 && left.drain < threshold && right.drain > threshold, metrics.boundary, 'two-micrometre bracket straddles drain clearance 0.035');
add('substrate_is_continuous_at_boundary', metrics.inheritedHeightJump < 1e-5, metrics.inheritedHeightJump, '< 0.00001 m across epsilon sides');
add('same_pair_exists_on_both_sides', pairIdentity && left.pair && right.pair && left.pair.strength > .5 && right.pair.strength > .5, { pairIdentity, left: left.pair, right: right.pair }, 'same strong contour pair exists across boundary');
add('hard_gate_creates_material_epsilon_seam', metrics.currentHeightJump > .075 && metrics.currentMaskJump > .45, { heightJump: metrics.currentHeightJump, maskJump: metrics.currentMaskJump, spanMeters: metrics.boundary.spanMeters }, '>7.5 cm height and >0.45 mask jump across 2 micrometres');
add('hard_gate_is_the_changing_predicate', left.currentTarget === 0 && right.currentTarget > .5 && left.broad > .8 && right.broad > .8 && left.groupEnvelope > .9 && right.groupEnvelope > .9, { left: { drain: left.drain, target: left.currentTarget, broad: left.broad, group: left.groupEnvelope }, right: { drain: right.drain, target: right.currentTarget, broad: right.broad, group: right.groupEnvelope } }, 'drain threshold crosses while pair and other eligibility remain material');
add('zero_at_boundary_taper_removes_epsilon_jump_in_candidate', metrics.candidateHeightJump < 1e-5 && left.taper === 0 && right.taper < 1e-8, { candidateHeightJump: metrics.candidateHeightJump, leftTaper: left.taper, rightTaper: right.taper }, '<0.00001 m candidate jump; taper tends to zero at threshold');
add('candidate_reaches_current_inside_band', farInside.taper === 1 && farInside.candidateHeight === farInside.currentHeight, metrics.farInside, 'candidate exactly equals R36 once clearance >= 0.055');
add('production_locks_preserved', R36.snapshot.visualAcceptance === false && R36.snapshot.parcelGenerationEnabled === false && R36.snapshot.waterStateKnown === false && R36.snapshot.productionReady === false, { visualAcceptance: R36.snapshot.visualAcceptance, parcelGenerationEnabled: R36.snapshot.parcelGenerationEnabled, waterStateKnown: R36.snapshot.waterStateKnown, productionReady: R36.snapshot.productionReady }, 'all remain false');

const result = {
  schema: 'kaopu.probe.farmland-stitch-boundary-n23/1',
  source: { repository: 'haihao0307/guilin-dem-pipeline', commit: '692e472abcdd52a677d029c5c42c7d0d56baf189', version: R36.VERSION },
  passed: checks.every(c => c.pass),
  gateCount: checks.length,
  passedCount: checks.filter(c => c.pass).length,
  checks,
  metrics,
  candidate: {
    status: 'analysis-only boundary-compatible envelope; not a production parameter choice',
    formula: 'h_candidate = h_R35 + smoothstep(0.035, 0.055, drainage_clearance) * (h_R36 - h_R35)',
    purpose: 'demonstrate the zero-at-boundary contract; 0.02 mask-space width is not accepted for production'
  },
  currentBestView: [
    'A continuous source mask does not make a gated effect continuous when the effect begins with non-zero amplitude immediately after the eligibility predicate changes.',
    'For a continuous output, every soft eligibility boundary must multiply the effect increment by an envelope that tends to zero at the boundary; hard safety exclusions and intentionally discontinuous terrace risers must remain separately named.',
    'A coarse neighbor cliff bound cannot substitute for epsilon-side tests at every branch, threshold and discrete selector boundary.'
  ],
  rejected: [
    'R045.36 39/39 coarse QA proves sub-grid stitch continuity',
    'smoothstep inside safety scoring guarantees continuity when an earlier hard return bypasses the score',
    'the analysis-only 0.02 taper width is a production recommendation or visual acceptance'
  ],
  unknown: [
    'which R36 predicates are intended hard safety boundaries versus soft morphology eligibility',
    'accepted transition width and gradient/curvature tolerances at the real camera and mesh resolution',
    'Mother implementation, hardware/public runtime and user visual acceptance'
  ]
};

function canonicalize(value) {
  if (typeof value === 'number' && Number.isFinite(value) && !Number.isInteger(value)) return Number(value.toPrecision(10));
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, canonicalize(v)]));
  return value;
}

const stable = canonicalize(result);
const out = process.env.KAOPU_N23_OUTPUT || new URL('./farmland_stitch_boundary_result_n23.json', import.meta.url);
fs.writeFileSync(out, `${JSON.stringify(stable, null, 2)}\n`);
console.log(JSON.stringify(stable, null, 2));
if (!result.passed) process.exitCode = 2;
