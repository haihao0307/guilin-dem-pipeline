import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  analyzeGaussianAppearanceForSpzR186,
  GAUSSIAN_SPZ_APPEARANCE_CONSTANTS_R35,
} from '../ADAPTERS/gaussian_spz_appearance_gate_r35.mjs';

const [spzPath, packerJsonPath] = process.argv.slice(2);
const threeRoot = process.env.THREE_R186_ROOT;
if (!spzPath || !packerJsonPath || !threeRoot) {
  throw new Error('usage: THREE_R186_ROOT=... node gaussian_spz_appearance_r35.mjs fixture.spz packer.json');
}

const { SPZLoader } = await import(pathToFileURL(path.join(threeRoot, 'examples/jsm/loaders/SPZLoader.js')).href);
const { GaussianSplatPLYLoader } = await import(pathToFileURL(path.join(threeRoot, 'examples/jsm/loaders/GaussianSplatPLYLoader.js')).href);
const input = fs.readFileSync(spzPath);
const buffer = input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength);
const geometry = await new SPZLoader().parse(buffer);
const packer = JSON.parse(fs.readFileSync(packerJsonPath, 'utf8'));
const colors = geometry.getAttribute('color').array;

const tests = [];
const failures = [];
function test(name, fn) {
  try {
    tests.push({ name, pass: true, detail: fn() });
  } catch (error) {
    const detail = String(error.message || error);
    tests.push({ name, pass: false, detail });
    failures.push({ name, detail });
  }
}
function assert(condition, message) {
  if (!condition) throw new Error(message);
}
function toUint8Clamp(value) {
  const a = new Uint8ClampedArray(1);
  a[0] = value;
  return a[0];
}

const { spzDcScale, shC0 } = GAUSSIAN_SPZ_APPEARANCE_CONSTANTS_R35;
const expectedDisplayBytes = [];
const unclampedLinear = [];
for (let byte = 0; byte < 256; byte++) {
  const coefficient = (byte / 255 - 0.5) / spzDcScale;
  const linear = coefficient * shC0 + 0.5;
  unclampedLinear.push(linear);
  expectedDisplayBytes.push(toUint8Clamp(linear * 255));
}

test('Actual Niantic packer realizes the complete color and alpha byte matrix', () => {
  assert(packer.version === 4 && packer.numPoints === 256 && packer.shDegree === 0, 'metadata mismatch');
  assert(packer.colorByteMismatches === 0, `color mismatches ${packer.colorByteMismatches}`);
  assert(packer.alphaByteMismatches === 0, `alpha mismatches ${packer.alphaByteMismatches}`);
  return packer;
});

test('Three r186 preserves all 256 packed opacity bytes', () => {
  let maxByteError = 0;
  for (let i = 0; i < 256; i++) maxByteError = Math.max(maxByteError, Math.abs(colors[i * 4 + 3] - i));
  assert(maxByteError === 0, `alpha byte error ${maxByteError}`);
  return { maxByteError };
});

test('Three r186 applies its documented SPZ DC-to-linear LUT exactly', () => {
  let maxByteError = 0;
  for (let i = 0; i < 256; i++) {
    for (let channel = 0; channel < 3; channel++) {
      maxByteError = Math.max(maxByteError, Math.abs(colors[i * 4 + channel] - expectedDisplayBytes[i]));
    }
  }
  assert(maxByteError === 0, `RGB LUT byte error ${maxByteError}`);
  return { maxByteError };
});

test('Three r186 clamps SPZ DC values that SPZ intentionally keeps out of display range', () => {
  const below = [];
  const above = [];
  const safe = [];
  for (let i = 0; i < 256; i++) {
    if (unclampedLinear[i] < 0) below.push(i);
    else if (unclampedLinear[i] > 1) above.push(i);
    else safe.push(i);
  }
  assert(below.length > 0 && above.length > 0, 'no clipping domain found');
  assert(below.every(i => colors[i * 4] === 0), 'low DC not clamped to zero');
  assert(above.every(i => colors[i * 4] === 255), 'high DC not clamped to 255');
  return {
    belowRange: [below[0], below.at(-1)],
    safePackedByteRange: [safe[0], safe.at(-1)],
    aboveRange: [above[0], above.at(-1)],
    clippedPackedByteCount: below.length + above.length,
    safePackedByteCount: safe.length,
    maxLinearClampError: Math.max(-unclampedLinear[0], unclampedLinear[255] - 1),
  };
});

test('Float PLY loading has the same r186 DC clamp, so PLY viewing is not a fidelity bypass', () => {
  const ply = `ply
format ascii 1.0
element vertex 2
property float x
property float y
property float z
property float scale_0
property float scale_1
property float scale_2
property float rot_0
property float rot_1
property float rot_2
property float rot_3
property float f_dc_0
property float f_dc_1
property float f_dc_2
property float opacity
end_header
0 0 0 0 0 0 1 0 0 0 -3 -3 -3 0
1 0 0 0 0 0 1 0 0 0 3 3 3 0
`;
  const plyColors = new GaussianSplatPLYLoader().parse(ply).getAttribute('color').array;
  assert(plyColors[0] === 0 && plyColors[4] === 255, `unexpected PLY colors ${plyColors[0]},${plyColors[4]}`);
  return { lowDcByte: plyColors[0], highDcByte: plyColors[4] };
});

test('Candidate appearance gate rejects the r186-incompatible DC domain', () => {
  const safe = analyzeGaussianAppearanceForSpzR186({ numPoints: 1, colors: [0, 0, 0], alphas: [0] });
  assert(safe.errors.length === 0, `safe source rejected: ${safe.errors}`);
  const risky = analyzeGaussianAppearanceForSpzR186({ numPoints: 1, colors: [-3, 3, 4], alphas: [-100] });
  assert(risky.errors.some(error => error.includes('three-r186-dc-would-clamp')), 'Three clamp not detected');
  assert(risky.errors.some(error => error.includes('spz-dc-would-saturate')), 'SPZ saturation not detected');
  assert(risky.warnings.includes('alpha-0-quantizes-to-endpoint'), 'alpha endpoint not reported');
  return risky;
});

test('Early DC clamp is not equivalent to the source-defined post-SH clamp', () => {
  const cases = [
    { dc: -0.2, sh: 0.3 },
    { dc: 1.2, sh: -0.3 },
  ];
  const clamp01 = value => Math.max(0, Math.min(1, value));
  const results = cases.map(({ dc, sh }) => ({
    dc,
    sh,
    sourceOrder: clamp01(dc + sh),
    r186Order: clamp01(clamp01(dc) + sh),
  }));
  assert(results.every(result => Math.abs(result.sourceOrder - result.r186Order) > 0.19), 'counterexample collapsed');
  return {
    results,
    interpretation: 'Executable arithmetic counterexample only; no GPU render or perceptual claim.',
  };
});

const report = {
  schema: 'kaopu-gaussian-spz-appearance-probe/r35',
  status: failures.length ? 'Candidate-fail' : 'Candidate-pass',
  sourceLocks: {
    spz: 'affd0ecea7fbb4c265ee119475af7ee5b2997482',
    three: '148ef33ecb6d2502ff796d4554abd1549c95d519',
  },
  testsRun: tests.length,
  failures,
  tests,
  evidenceLimits: {
    syntheticByteMatrixOnly: true,
    nianticPackerExecuted: true,
    threeR186SpzLoaderExecuted: true,
    threeR186PlyLoaderExecuted: true,
    brushTrainingExecuted: false,
    userPhotosAvailable: false,
    gpuRenderExecuted: false,
    perceptualImageComparisonExecuted: false,
    humanAcceptancePerformed: false,
  },
  frozenR1Changed: false,
  productionMotherChanged: false,
};

console.log(JSON.stringify(report, null, 2));
if (failures.length) process.exitCode = 1;
