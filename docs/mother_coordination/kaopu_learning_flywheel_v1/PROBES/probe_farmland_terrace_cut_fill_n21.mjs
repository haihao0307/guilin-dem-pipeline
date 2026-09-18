import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.env.KAOPU_FARMLAND_SOURCE_ROOT;
if (!root) throw new Error('KAOPU_FARMLAND_SOURCE_ROOT is required');
const sourceDir = path.join(root, 'farmland-object-dna/research/r045-autonomous-rebuild/round-32');
const K = await import(pathToFileURL(path.join(sourceDir, 'r045_round32_kernel.mjs')));

const bounds = { xmin: -230, xmax: 130, zmin: -140, zmax: 20 };

function integrate(step, phaseX = .5, phaseZ = .5) {
  let fill = 0, cut = 0, activeArea = 0, samples = 0, maxAbs = 0;
  const area = step * step;
  for (let z = bounds.zmin + phaseZ * step; z < bounds.zmax; z += step) {
    for (let x = bounds.xmin + phaseX * step; x < bounds.xmax; x += step) {
      const s = K.terraceStateAt(x, z), d = s.delta;
      if (d > 0) fill += d * area;
      else cut += -d * area;
      if (s.mask > 0) activeArea += area;
      maxAbs = Math.max(maxAbs, Math.abs(d));
      samples++;
    }
  }
  const net = fill - cut;
  return {
    stepMeters: step,
    phase: [phaseX, phaseZ],
    sampleCount: samples,
    activeAreaSquareMeters: activeArea,
    fillCubicMeters: fill,
    cutCubicMeters: cut,
    netCubicMeters: net,
    imbalanceFractionOfMovedVolume: net / (fill + cut),
    fillCutRatio: fill / cut,
    maxAbsDeltaMeters: maxAbs
  };
}

// A 1 m midpoint lattice is a bounded dense estimate, not an exact continuous integral.
const denseEstimate = integrate(1, .5, .5);
const phasePairs = [[.125, .125], [.375, .625], [.625, .375], [.875, .875]];
const phaseSweeps = [2, 4, 8].map(stepMeters => {
  const runs = phasePairs.map(([px, pz]) => integrate(stepMeters, px, pz));
  const range = key => {
    const values = runs.map(r => r[key]);
    return { min: Math.min(...values), max: Math.max(...values) };
  };
  return {
    stepMeters,
    phaseCount: runs.length,
    fillCubicMeters: range('fillCubicMeters'),
    cutCubicMeters: range('cutCubicMeters'),
    netCubicMeters: range('netCubicMeters'),
    imbalanceFraction: range('imbalanceFractionOfMovedVolume'),
    maxAbsDeltaMeters: range('maxAbsDeltaMeters'),
    worstAbsNetDifferenceFromDenseEstimateCubicMeters: Math.max(...runs.map(r => Math.abs(r.netCubicMeters - denseEstimate.netCubicMeters)))
  };
});

// Reproduce the R045.32 QA lattice exactly. Its published pos/neg values have
// units of sampled metres until multiplied by the 4 m x 4 m cell area.
let positiveSampleMeters = 0, negativeSampleMeters = 0, qaCount = 0;
for (let z = -132; z <= 10; z += 4) {
  for (let x = -220; x <= 120; x += 4) {
    const d = K.terraceDelta(x, z);
    if (d > 0) positiveSampleMeters += d;
    else negativeSampleMeters += -d;
    qaCount++;
  }
}
const qaCellArea = 16;
const motherLattice = {
  sampleCount: qaCount,
  positiveSampleMeters,
  negativeSampleMeters,
  assumedCellAreaSquareMeters: qaCellArea,
  fillCubicMeters: positiveSampleMeters * qaCellArea,
  cutCubicMeters: negativeSampleMeters * qaCellArea,
  netCubicMeters: (positiveSampleMeters - negativeSampleMeters) * qaCellArea
};

const sweep2 = phaseSweeps.find(s => s.stepMeters === 2);
const sweep4 = phaseSweeps.find(s => s.stepMeters === 4);
const sweep8 = phaseSweeps.find(s => s.stepMeters === 8);
const checks = [];
const add = (name, pass, value, limit) => checks.push({ name, pass: Boolean(pass), value, limit });
add('fixed_version', K.VERSION === 'R045.32', K.VERSION, 'R045.32');
add('mother_lattice_replayed', Math.abs(positiveSampleMeters - 57.30621464383817) < 1e-9 && Math.abs(negativeSampleMeters - 57.541002772850895) < 1e-9, motherLattice, 'exact R045.32 sampled pos/neg replay');
add('dense_estimate_has_both_cut_and_fill', denseEstimate.fillCubicMeters > 800 && denseEstimate.cutCubicMeters > 800, denseEstimate, 'both exceed 800 m3 on the declared 1 m lattice');
add('mother_lattice_is_near_balanced_but_not_a_certificate', Math.abs(motherLattice.netCubicMeters) < 5 && sweep4.netCubicMeters.min < -100 && sweep4.netCubicMeters.max > 100, { motherLatticeNet: motherLattice.netCubicMeters, phaseSweep: sweep4.netCubicMeters }, 'published phase near zero while other 4 m phases reverse sign beyond +/-100 m3');
add('four_meter_phase_uncertainty_is_large', sweep4.netCubicMeters.max - sweep4.netCubicMeters.min > 250, sweep4.netCubicMeters, 'phase range >250 m3');
add('coarsening_increases_worst_net_difference', sweep8.worstAbsNetDifferenceFromDenseEstimateCubicMeters > sweep4.worstAbsNetDifferenceFromDenseEstimateCubicMeters && sweep4.worstAbsNetDifferenceFromDenseEstimateCubicMeters > sweep2.worstAbsNetDifferenceFromDenseEstimateCubicMeters, { two: sweep2.worstAbsNetDifferenceFromDenseEstimateCubicMeters, four: sweep4.worstAbsNetDifferenceFromDenseEstimateCubicMeters, eight: sweep8.worstAbsNetDifferenceFromDenseEstimateCubicMeters }, '2 m < 4 m < 8 m for this fixed phase set');
add('max_height_change_does_not_bound_volume_error', sweep4.maxAbsDeltaMeters.max - sweep4.maxAbsDeltaMeters.min < .04 && sweep4.netCubicMeters.max - sweep4.netCubicMeters.min > 250, { maxDeltaRange: sweep4.maxAbsDeltaMeters, netRange: sweep4.netCubicMeters }, 'similar sampled max delta alongside large net-volume range');
add('locks_preserved', K.snapshot.visualAcceptance === false && K.snapshot.parcelGenerationEnabled === false && K.snapshot.waterStateKnown === false && K.snapshot.productionReady === false, { visualAcceptance: K.snapshot.visualAcceptance, parcelGenerationEnabled: K.snapshot.parcelGenerationEnabled, waterStateKnown: K.snapshot.waterStateKnown, productionReady: K.snapshot.productionReady }, 'all remain false');

const result = {
  schema: 'kaopu.probe.farmland-terrace-cut-fill-n21/1',
  source: {
    repository: 'haihao0307/guilin-dem-pipeline',
    commit: '888f6b190ca10b6b4ae3cf2739c0da2e38629194',
    version: K.VERSION,
    coordinateUnits: 'meters',
    heightUnits: 'meters'
  },
  passed: checks.every(c => c.pass),
  gateCount: checks.length,
  passedCount: checks.filter(c => c.pass).length,
  checks,
  boundsMeters: bounds,
  denseEstimate,
  phaseSweeps,
  motherLattice,
  currentBestView: [
    'positive and negative height changes prove only that both cut-like and fill-like samples exist; they do not prove earthwork balance',
    'cut and fill receipts require declared support, height and coordinate units, cell area, signed volume, grid spacing and origin phase',
    'R045.32 is numerically near-balanced on its retained 4 m lattice, but other 4 m phases reverse the net sign and span more than 250 m3',
    'even a converged geometric volume is not a soil-mass certificate without density, bulking/compaction, boundary import/export and construction history'
  ],
  rejected: [
    'both positive and negative samples imply balanced cut and fill',
    'an unweighted sum of sampled height deltas is already a volume receipt',
    'one near-zero coarse-lattice net value proves conservation',
    'a bounded maximum height delta bounds integrated earthwork error',
    'synthetic terrace geometry is hydraulic, geotechnical or erosion truth'
  ],
  unknown: [
    'continuous-domain cut and fill integrals and a justified convergence tolerance',
    'soil density, bulking, compaction, spoil/import policy and construction sequence',
    'actual surveyed terrace sections and field microtopography',
    'hardware GPU, public runtime, Mother adoption and user visual acceptance'
  ]
};

function canonicalize(value) {
  if (typeof value === 'number' && Number.isFinite(value) && !Number.isInteger(value)) return Number(value.toPrecision(12));
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, canonicalize(v)]));
  return value;
}

const stable = canonicalize(result);
const out = process.env.KAOPU_N21_OUTPUT || new URL('./farmland_terrace_cut_fill_result_n21.json', import.meta.url);
fs.writeFileSync(out, `${JSON.stringify(stable, null, 2)}\n`);
console.log(JSON.stringify(stable, null, 2));
if (!result.passed) process.exitCode = 2;
