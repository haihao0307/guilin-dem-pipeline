import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
globalThis.window = globalThis;
globalThis.CustomEvent = class CustomEvent { constructor(type, init={}) { this.type=type; this.detail=init.detail; } };
globalThis.dispatchEvent = () => true;

const files = [
  'runtime/manifest.js',
  'runtime/grid-depthDm.js',
  'runtime/grid-uncertaintyDm.js',
  'runtime/grid-nearestM.js',
  'runtime/grid-qualityU8.js',
  'runtime/grid-semanticU8.js',
  'runtime/grid-supportU8.js',
  'runtime/grid-landU8.js',
  'runtime/grid-depareLowerDm.js',
  'runtime/grid-depareUpperDm.js',
  'runtime/grid-depareResidualDm.js',
  'runtime/grid-semanticResidualDm.js',
  'runtime/evidence-vectors.js',
  'palau-world-evidence.js',
];
for (const rel of files) vm.runInThisContext(fs.readFileSync(path.join(here, rel), 'utf8'), {filename:rel});

function assert(ok, message) { if (!ok) throw new Error(message); }
function near(a,b,tol,message){ assert(Math.abs(a-b)<=tol,`${message}: ${a} vs ${b}`); }

assert(globalThis.PalauWorld, 'PalauWorld API missing');
assert(PalauWorld.meta.traditionalLOD === false, 'traditionalLOD must remain false');
assert(PalauWorld.meta.visualAcceptance === false, 'visualAcceptance must remain false');
assert(PalauWorld.meta.productionReady === false, 'productionReady must remain false');
assert(PalauWorld.grid.width === 310 && PalauWorld.grid.height === 310, 'grid shape mismatch');

const utm = PalauWorld.lonLatToUtm53(134.57, 7.35);
near(utm[0], 452541.8925767343, 0.02, 'UTM easting mismatch');
near(utm[1], 812463.2266406205, 0.02, 'UTM northing mismatch');

const center = PalauWorld.sample(134.57, 7.35, 123);
assert(center.valid, 'center sample must be valid');
assert(center.status === 'CANDIDATE_NOT_SURVEY_TRUTH', 'center status mismatch');
assert(center.t === 123, 'time passthrough mismatch');
assert(center.bathymetry.depthMChartDatum > 0, 'center depth must be positive down');
assert(center.bathymetry.datum.soundingDatumName === 'local datum', 'datum name mismatch');
assert(center.bathymetry.datum.mslEquivalence === 'NOT_ASSERTED', 'MSL boundary lost');
assert(center.world.conductor === 'PalauWorld.sample()', 'conductor mismatch');

const known = PalauWorld.sample(134.585, 7.345, 0);
near(known.bathymetry.depthMChartDatum, 30.92, 0.06, 'known depth sample drift');
near(known.bathymetry.uncertaintyM, 7.52, 0.06, 'known uncertainty sample drift');
assert(known.depare.supportName === 'within_depare_or_partial_interval', 'DEPARE support mismatch');

const outside = PalauWorld.sample(134.2, 7.0, 0);
assert(!outside.valid && outside.status === 'OUTSIDE_AIRAI_R12_CORE', 'outside sample boundary failure');

console.log(JSON.stringify({
  status:'PASS',
  assertions:20,
  version:PalauWorld.version,
  centerDepthM:+center.bathymetry.depthMChartDatum.toFixed(3),
  knownDepthM:+known.bathymetry.depthMChartDatum.toFixed(3),
  knownUncertaintyM:+known.bathymetry.uncertaintyM.toFixed(3),
  historicalReproductionMatch:PalauWorld.meta.historicalReceiptComparison.numericReproductionMatch,
}, null, 2));
