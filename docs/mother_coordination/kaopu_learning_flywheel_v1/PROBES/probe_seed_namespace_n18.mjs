import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const sourceRoot = process.argv[2];
if (!sourceRoot) throw new Error('usage: node probe_seed_namespace_n18.mjs <v26-package-root>');

const kernel = await import(pathToFileURL(path.join(sourceRoot, 'src/v26_transfer_kernel.mjs')));
const eventKernel = await import(pathToFileURL(path.join(sourceRoot, 'src/v26_event_geometry_kernel.mjs')));
const preset = JSON.parse(await readFile(path.join(sourceRoot, 'REFERENCE_PRESET.json'), 'utf8'));

const seedKeys = Object.keys(kernel.SEED_PRIMES);
const seeds = kernel.seedDNA(
  preset.runtimeDNA.seedBase,
  preset.runtimeDNA.seedBase % 997,
  preset.childSeedOffset,
);
const params = {
  ...preset.noiseDNA,
  ...preset.gaeaDNA,
  ...preset.baseCompositeDefaults,
};
const controls = {
  ...preset.baseCompositeDefaults,
  ...preset.resolvedControls,
};

function sha(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function points(nx, ny, nz) {
  const out = [];
  for (let z = 0; z < nz; z++) for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
    out.push([
      -1.37 + (x + 0.37) * 2.74 / nx,
      -0.83 + (y + 0.61) * 1.66 / ny,
      -1.11 + (z + 0.23) * 2.22 / nz,
    ]);
  }
  return out;
}

function flattenAt(p, currentSeeds) {
  const fields = kernel.evaluateFields(p, currentSeeds, params);
  const regions = kernel.firedMaterialRegions(fields, p, currentSeeds, params);
  return {
    q0: fields.q[0], q1: fields.q[1], q2: fields.q[2],
    rugged: fields.rugged,
    strata: fields.strata,
    microErosion: fields.microErosion,
    plateEdge: fields.plateEdge,
    flow: fields.flow,
    rockMap: fields.rockMap,
    protrusion: fields.protrusion,
    cavity: fields.cavity,
    separation: fields.separation,
    geometryOffset: kernel.geometryOffset(fields, params),
    regionRed: regions.red,
    regionDeepRed: regions.deepRed,
    regionCarbon: regions.carbon,
    regionAsh: regions.ash,
    regionMineral: regions.mineral,
    regionOxide: regions.oxide,
    regionWet: regions.wet,
  };
}

function deltaSummary(baseRows, changedRows) {
  const names = Object.keys(baseRows[0]);
  const result = {};
  for (const name of names) {
    let sumSq = 0;
    let maxAbs = 0;
    for (let i = 0; i < baseRows.length; i++) {
      const d = changedRows[i][name] - baseRows[i][name];
      sumSq += d * d;
      maxAbs = Math.max(maxAbs, Math.abs(d));
    }
    result[name] = {
      rms: Math.sqrt(sumSq / baseRows.length),
      maxAbs,
      changed: maxAbs > 1e-14,
    };
  }
  return result;
}

function pearson(a, b) {
  const n = a.length;
  let sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0;
  for (let i = 0; i < n; i++) {
    sa += a[i]; sb += b[i]; saa += a[i] * a[i]; sbb += b[i] * b[i]; sab += a[i] * b[i];
  }
  const numerator = n * sab - sa * sb;
  const denominator = Math.sqrt((n * saa - sa * sa) * (n * sbb - sb * sb));
  return denominator === 0 ? null : numerator / denominator;
}

const fieldPoints = points(16, 12, 8);
const baseRows = fieldPoints.map((p) => flattenAt(p, seeds));
const fieldFanout = {};
for (const key of seedKeys) {
  const altered = { ...seeds, [key]: seeds[key] + 1 };
  const changedRows = fieldPoints.map((p) => flattenAt(p, altered));
  const deltas = deltaSummary(baseRows, changedRows);
  fieldFanout[key] = {
    changedOutputs: Object.entries(deltas).filter(([, v]) => v.changed).map(([name]) => name),
    deltas,
  };
}

const eventArgs = {
  dimensions: preset.runtimeDNA.shapeRatio,
  runtimeDNA: preset.runtimeDNA,
  noiseDNA: preset.noiseDNA,
  controls,
  seeds,
  damageLevel: preset.damageLevel,
};
const baseEvents = eventKernel.buildV26Events(eventArgs);
const baseEventHash = sha(baseEvents);
const eventFanout = {};
for (const key of seedKeys) {
  const altered = { ...seeds, [key]: seeds[key] + 1 };
  const events = eventKernel.buildV26Events({ ...eventArgs, seeds: altered });
  eventFanout[key] = {
    changed: sha(events) !== baseEventHash,
    sha256: sha(events),
    counts: Object.fromEntries(Object.entries(events).map(([name, rows]) => [name, rows.length])),
  };
}

const correlationPoints = points(32, 24, 8);
const series = Object.fromEntries(seedKeys.map((key) => [
  key,
  correlationPoints.map((p) => kernel.valueNoise3(p[0] * 7.31, p[1] * 5.17, p[2] * 6.43, seeds[key])),
]));
const pairwise = [];
for (let i = 0; i < seedKeys.length; i++) for (let j = i + 1; j < seedKeys.length; j++) {
  const a = seedKeys[i], b = seedKeys[j];
  pairwise.push({ a, b, r: pearson(series[a], series[b]) });
}
pairwise.sort((a, b) => Math.abs(b.r) - Math.abs(a.r));

const serializedFieldFanout = Object.fromEntries(Object.entries(fieldFanout).map(([key, row]) => [key, {
  changedOutputs: row.changedOutputs,
  geometryOffsetDelta: row.deltas.geometryOffset,
}]));
const serializedEventFanout = Object.fromEntries(Object.entries(eventFanout).map(([key, row]) => [key, {
  changed: row.changed,
  sha256: row.sha256,
  countsChangedFromBase: Object.fromEntries(Object.entries(row.counts).filter(([name, value]) => value !== baseEvents[name].length)),
}]));

const checks = [];
function check(name, condition, detail) {
  checks.push({ name, pass: Boolean(condition), detail });
}
const continuousChanged = (key, output) => fieldFanout[key].deltas[output].changed;
const eventChanged = (key) => eventFanout[key].changed;
check('seed_values_distinct_for_locked_preset', new Set(Object.values(seeds)).size === seedKeys.length, seeds);
check('master_has_no_current_continuous_consumer', fieldFanout.master.changedOutputs.length === 0, fieldFanout.master.changedOutputs);
check('shape_has_no_current_continuous_consumer', fieldFanout.shape.changedOutputs.length === 0, fieldFanout.shape.changedOutputs);
check('damage_has_no_current_continuous_consumer', fieldFanout.damage.changedOutputs.length === 0, fieldFanout.damage.changedOutputs);
check('inclusion_has_no_current_continuous_consumer', fieldFanout.inclusion.changedOutputs.length === 0, fieldFanout.inclusion.changedOutputs);
check('color_does_not_change_continuous_geometry_offset', !continuousChanged('color', 'geometryOffset'), fieldFanout.color.changedOutputs);
check('water_does_not_change_continuous_geometry_offset', !continuousChanged('water', 'geometryOffset'), fieldFanout.water.changedOutputs);
check('pore_does_not_change_continuous_geometry_offset', !continuousChanged('pore', 'geometryOffset'), fieldFanout.pore.changedOutputs);
check('detail_changes_continuous_geometry_offset', continuousChanged('detail', 'geometryOffset'), fieldFanout.detail.changedOutputs);
check('detail_changes_all_primary_fields', ['rugged','strata','microErosion','plateEdge','flow','rockMap','protrusion','cavity','separation'].every((name) => continuousChanged('detail', name)), fieldFanout.detail.changedOutputs);
check('event_seed_partition_matches_source', ['damage','pore','weather','inclusion'].every(eventChanged) && ['master','shape','color','water','detail'].every((key) => !eventChanged(key)), Object.fromEntries(seedKeys.map((key) => [key, eventChanged(key)])));
check('same_seed_control_correlation_is_one', Math.abs(pearson(series.detail, series.detail) - 1) < 1e-12, pearson(series.detail, series.detail));
check('finite_pairwise_correlations', pairwise.every((row) => Number.isFinite(row.r)), pairwise.slice(0, 3));

const result = {
  schema: 'kaopu.seed-namespace-probe.n18/1',
  status: 'candidate-partial-fixed-source-cpu-verified',
  source: {
    repository: 'haihao0307/HOUSE',
    commit: 'c6223d36ceeb827e3894fc181340c284b1cbfa73',
    packagePath: 'yunnan-courtyard-architecture-factory-v5.2.1-full-local/yunnan-courtyard-architecture-factory-v5.2.1-full-local/brick-mother/skills/v26-composite-material-dna-transfer-r1',
  },
  sampleDesign: {
    fieldPoints: fieldPoints.length,
    correlationPoints: correlationPoints.length,
    mutation: 'one named seed at a time, +1 integer',
    correlation: 'Pearson r over same-coordinate raw valueNoise3 samples; descriptive finite sample only',
  },
  lockedSeeds: seeds,
  fieldFanout: serializedFieldFanout,
  eventFanout: serializedEventFanout,
  rawNoiseCorrelation: {
    strongestAbsolutePair: pairwise[0],
    strongestFive: pairwise.slice(0, 5),
    pairCount: pairwise.length,
    sameSeedControl: pearson(series.detail, series.detail),
  },
  eventBase: {
    sha256: baseEventHash,
    counts: Object.fromEntries(Object.entries(baseEvents).map(([name, rows]) => [name, rows.length])),
  },
  checks,
  summary: {
    passed: checks.filter((x) => x.pass).length,
    total: checks.length,
  },
  boundaries: {
    statisticalIndependenceProved: false,
    hardwareGpuVerified: false,
    browserVerified: false,
    motherAdoption: 'Unknown',
    physicalTruth: 'Unknown',
  },
};

console.log(JSON.stringify(result, null, 2));
if (checks.some((x) => !x.pass)) process.exitCode = 1;
