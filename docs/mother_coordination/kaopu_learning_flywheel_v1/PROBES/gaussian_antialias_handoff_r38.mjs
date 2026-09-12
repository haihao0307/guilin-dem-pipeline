import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  parseBrushPlyRenderMode,
  readSpzV4Antialiased,
  validateGaussianAntialiasHandoff,
} from '../ADAPTERS/gaussian_antialias_handoff_gate_r38.mjs';

const [plyPath, cliSpzPath, explicitMipSpzPath, nativeJsonPath] = process.argv.slice(2);
const threeRoot = process.env.THREE_R186_ROOT;
if (!plyPath || !cliSpzPath || !explicitMipSpzPath || !nativeJsonPath || !threeRoot) {
  throw new Error('usage: THREE_R186_ROOT=... node gaussian_antialias_handoff_r38.mjs mip.ply cli.spz explicit.spz native.json');
}

const { SPZLoader } = await import(pathToFileURL(path.join(threeRoot, 'examples/jsm/loaders/SPZLoader.js')).href);
const ply = fs.readFileSync(plyPath);
const cliSpz = fs.readFileSync(cliSpzPath);
const explicitMipSpz = fs.readFileSync(explicitMipSpzPath);
const native = JSON.parse(fs.readFileSync(nativeJsonPath, 'utf8'));

async function load(bytes) {
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  return new SPZLoader().parse(buffer);
}

const [cliGeometry, mipGeometry] = await Promise.all([load(cliSpz), load(explicitMipSpz)]);
const tests = [];
const failures = [];
function assert(condition, message) { if (!condition) throw new Error(message); }
function test(name, fn) {
  try { tests.push({ name, pass: true, detail: fn() }); }
  catch (error) { const detail = String(error.message || error); tests.push({ name, pass: false, detail }); failures.push({ name, detail }); }
}
function arraysEqual(a, b) {
  return a.length === b.length && a.every((value, index) => Object.is(value, b[index]));
}
function geometrySnapshot(geometry) {
  const names = Object.keys(geometry.attributes).sort();
  return Object.fromEntries(names.map(name => [name, {
    itemSize: geometry.getAttribute(name).itemSize,
    normalized: geometry.getAttribute(name).normalized,
    array: Array.from(geometry.getAttribute(name).array),
  }]));
}
function threeAlphaScale(a, b, c) {
  const detBase = a * c - b * b;
  const det = (a + 0.3) * (c + 0.3) - b * b;
  return Math.sqrt(Math.max(detBase / Math.max(det, 0.000001), 0));
}
function graphdecoAlphaScale(a, b, c, antialiasing) {
  if (!antialiasing) return 1;
  const detBase = a * c - b * b;
  const det = (a + 0.3) * (c + 0.3) - b * b;
  return Math.sqrt(Math.max(0.000025, detBase / det));
}

test('Brush-style PLY mip comment is present and typed', () => {
  const parsed = parseBrushPlyRenderMode(ply);
  assert(parsed.errors.length === 0 && parsed.renderMode === 'mip', JSON.stringify(parsed));
  return parsed;
});

test('actual Niantic PLY loader and default conversion lose the mip declaration', () => {
  assert(native.plyLoaderAntialiased === false, 'PLY loader unexpectedly preserved mip comment');
  assert(native.cliPathHeaderFlags === 0, `unexpected flags ${native.cliPathHeaderFlags}`);
  assert(native.cliPathDecodedAntialiased === false, 'round-trip flag unexpectedly true');
  return native;
});

test('explicit Niantic antialiased state survives actual SPZ v4 pack and unpack', () => {
  const parsed = readSpzV4Antialiased(explicitMipSpz);
  assert(parsed.errors.length === 0 && parsed.antialiased === true, JSON.stringify(parsed));
  assert(native.explicitMipHeaderFlags === 1 && native.explicitMipDecodedAntialiased === true, JSON.stringify(native));
  return parsed;
});

test('handoff gate rejects silent Brush mip comment to false SPZ flag', () => {
  const errors = validateGaussianAntialiasHandoff({ plyBytes: ply, spzBytes: cliSpz });
  assert(errors.includes('brush-render-mode-spz-flag-mismatch'), JSON.stringify(errors));
  assert(errors.includes('three-r186-hardcodes-mip-compensation-for-default-source'), JSON.stringify(errors));
  assert(validateGaussianAntialiasHandoff({ plyBytes: ply, spzBytes: explicitMipSpz }).length === 0, 'explicit mip path rejected');
  return { errors, explicitMipPathAcceptedBySemanticGate: true };
});

test('actual Three.js r186 loader collapses false and true SPZ flags to identical geometry', () => {
  const a = geometrySnapshot(cliGeometry);
  const b = geometrySnapshot(mipGeometry);
  assert(JSON.stringify(a) === JSON.stringify(b), 'geometry differs');
  assert(!('antialiased' in cliGeometry.userData) && !('antialiased' in mipGeometry.userData), 'flag unexpectedly exposed in userData');
  return { attributes: Object.keys(a), flagExposedInGeometryUserData: false, snapshotsIdentical: true };
});

test('Three r186 hard-coded compensation disagrees with non-AA source semantics', () => {
  const a = 1, b = 0, c = 1;
  const three = threeAlphaScale(a, b, c);
  const sourceDefault = graphdecoAlphaScale(a, b, c, false);
  assert(Math.abs(three - 10 / 13) < 1e-12, `unexpected Three factor ${three}`);
  assert(sourceDefault === 1 && Math.abs(sourceDefault - three) > 0.23, 'negative control did not separate');
  return { rawCovariance: [a, b, c], threeR186AlphaScale: three, graphdecoDefaultAlphaScale: sourceDefault, absoluteDifference: sourceDefault - three };
});

test('ordinary AA formula aligns, but singular numerical floor remains different', () => {
  const ordinaryThree = threeAlphaScale(1, 0.1, 2);
  const ordinaryGraphdeco = graphdecoAlphaScale(1, 0.1, 2, true);
  assert(Math.abs(ordinaryThree - ordinaryGraphdeco) < 1e-15, 'ordinary formula mismatch');
  const singularThree = threeAlphaScale(0, 0, 0);
  const singularGraphdeco = graphdecoAlphaScale(0, 0, 0, true);
  assert(singularThree === 0 && singularGraphdeco === 0.005, 'singular control changed');
  return { ordinaryMaxAbsDifference: Math.abs(ordinaryThree - ordinaryGraphdeco), singularThree, singularGraphdeco, singularDifference: 0.005 };
});

const report = {
  schema: 'kaopu-gaussian-antialias-handoff-probe/r38',
  status: failures.length ? 'Candidate-fail' : 'Candidate-pass',
  sourceLocks: {
    brush: '063945e797e0b3b7fd60b0feb7b9010385dd4bda',
    spz: 'affd0ecea7fbb4c265ee119475af7ee5b2997482',
    graphdeco: '54c035f7834b564019656c3e3fcc3646292f727d',
    graphdecoRasterizer: '9c5c2028f6fbee2be239bc4c9421ff894fe4fbe0',
    three: '148ef33ecb6d2502ff796d4554abd1549c95d519',
  },
  testsRun: tests.length,
  failures,
  tests,
  evidenceLimits: {
    syntheticSingleSplatOnly: true,
    brushExecutableRun: false,
    brushExportSourceInspected: true,
    nianticPlyLoaderExecuted: true,
    nianticPackerAndUnpackerExecuted: true,
    threeR186LoaderExecuted: true,
    gpuRenderExecuted: false,
    userPhotosAvailable: false,
    humanAcceptancePerformed: false,
  },
  frozenR1Changed: false,
  productionMotherChanged: false,
};

console.log(JSON.stringify(report, null, 2));
if (failures.length) process.exitCode = 1;

