import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const THREE_R186_ROOT = process.env.THREE_R186_ROOT;
if (!THREE_R186_ROOT) {
  throw new Error('Set THREE_R186_ROOT to a checkout of mrdoob/three.js at 148ef33ecb6d2502ff796d4554abd1549c95d519.');
}
const { GaussianSplatPLYLoader } = await import(pathToFileURL(resolve(THREE_R186_ROOT, 'examples/jsm/loaders/GaussianSplatPLYLoader.js')));
const { SPZLoader } = await import(pathToFileURL(resolve(THREE_R186_ROOT, 'examples/jsm/loaders/SPZLoader.js')));

const SPZ_MAGIC = 0x5053474e;

function makeSpzV3Degree4() {
  const count = 1;
  const shDegree = 4;
  const fractionalBits = 12;
  const shBytes = 72;
  const raw = new Uint8Array(16 + 9 + 1 + 3 + 3 + 4 + shBytes);
  const view = new DataView(raw.buffer);
  view.setUint32(0, SPZ_MAGIC, true);
  view.setUint32(4, 3, true);
  view.setUint32(8, count, true);
  raw[12] = shDegree;
  raw[13] = fractionalBits;
  raw[14] = 0;
  let o = 16;
  // position = (1, 2, 3) at 12 fractional bits, int24 little endian.
  for (const v of [4096, 8192, 12288]) {
    raw[o++] = v & 255; raw[o++] = (v >>> 8) & 255; raw[o++] = (v >>> 16) & 255;
  }
  raw[o++] = 255; // alpha
  raw.set([128, 128, 128], o); o += 3; // color
  raw.set([160, 160, 160], o); o += 3; // exp(0)=1 scales
  // v3 smallest-three identity quaternion: largest index w=3, other components zero.
  const packedIdentity = 3 << 30;
  view.setUint32(o, packedIdentity, true); o += 4;
  for (let i = 0; i < shBytes; i++) raw[o + i] = (128 + i) & 255;
  const compressed = gzipSync(raw);
  return compressed.buffer.slice(compressed.byteOffset, compressed.byteOffset + compressed.byteLength);
}

function covarianceFromPlyQuaternion() {
  const ply = `ply
format ascii 1.0
element vertex 1
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
0 0 0 0 0.6931471805599453 1.0986122886681098 0.7071067811865476 0 0 0.7071067811865476 0 0 0 0
`;
  const geometry = new GaussianSplatPLYLoader().parse(ply);
  return Array.from(geometry.getAttribute('covariance').array);
}

function colmapCameraCenter(qwxyz, t) {
  const [w, x, y, z] = qwxyz;
  const R = [
    [1 - 2*y*y - 2*z*z, 2*x*y - 2*z*w, 2*x*z + 2*y*w],
    [2*x*y + 2*z*w, 1 - 2*x*x - 2*z*z, 2*y*z - 2*x*w],
    [2*x*z - 2*y*w, 2*y*z + 2*x*w, 1 - 2*x*x - 2*y*y],
  ];
  return [0, 1, 2].map(i => -(R[0][i]*t[0] + R[1][i]*t[1] + R[2][i]*t[2]));
}

function rdfToRub({position, quaternion, sh1}) {
  return {
    position: [position[0], -position[1], -position[2]],
    quaternion: [quaternion[0], -quaternion[1], -quaternion[2], quaternion[3]],
    sh1: [-sh1[0], -sh1[1], sh1[2]],
  };
}

function quantizePosition(v, fractionalBits = 12) {
  const s = 1 << fractionalBits;
  return Math.round(v * s) / s;
}

function quantizeLogScale(v) {
  const byte = Math.max(0, Math.min(255, Math.round((v + 10) * 16)));
  return byte / 16 - 10;
}

function quantizeSh(v, bits) {
  const bucket = 1 << (8 - bits);
  let q = Math.round(v * 128) + 128;
  q = Math.floor((q + bucket / 2) / bucket) * bucket;
  q = Math.max(0, Math.min(255, q));
  return (q - 128) / 128;
}

const tests = [];
function test(name, fn) {
  try { fn(); tests.push({name, status:'pass'}); }
  catch (error) { tests.push({name, status:'fail', error:String(error)}); }
}

test('three-r186-actual-spz-v3-degree4-drops-band4', () => {
  const loader = new SPZLoader();
  const geometry = loader.parse(makeSpzV3Degree4());
  assert.equal(geometry.getAttribute('sphericalHarmonics3').itemSize, 6);
  assert.equal(geometry.getAttribute('sphericalHarmonics4'), undefined);
});

test('three-r186-actual-ply-uses-wxyz-and-builds-anisotropic-covariance', () => {
  const c = covarianceFromPlyQuaternion();
  assert.equal(c.length, 6);
  // 90 degrees about Z rotates diag(1,4,9) to diag(4,1,9).
  assert.ok(Math.abs(c[0] - 4) < 1e-5);
  assert.ok(Math.abs(c[3] - 1) < 1e-5);
  assert.ok(Math.abs(c[5] - 9) < 1e-5);
});

test('colmap-pose-is-world-to-camera-and-t-is-not-camera-center', () => {
  const s = Math.SQRT1_2;
  const center = colmapCameraCenter([s, 0, 0, s], [1, 2, 3]);
  assert.ok(center.some((v, i) => Math.abs(v - [1,2,3][i]) > 1));
  assert.deepEqual(center.map(v => Math.round(v)), [-2, 1, -3]);
});

test('rdf-to-rub-must-transform-position-quaternion-and-sh-together', () => {
  const converted = rdfToRub({position:[1,2,3], quaternion:[0.1,0.2,0.3,0.9], sh1:[0.2,-0.4,0.6]});
  assert.deepEqual(converted.position, [1,-2,-3]);
  assert.deepEqual(converted.quaternion, [0.1,-0.2,-0.3,0.9]);
  assert.deepEqual(converted.sh1, [-0.2,0.4,0.6]);
});

test('skipping-rdf-coordinate-extension-is-observably-wrong', () => {
  const p = [1,2,3];
  const expected = rdfToRub({position:p, quaternion:[0,0,0,1], sh1:[1,0,0]}).position;
  const error = Math.hypot(...p.map((v,i) => v - expected[i]));
  assert.ok(error > 7.2 && error < 7.22);
});

test('spz-position-quantization-is-bounded-but-lossy', () => {
  const values = [0.12345, -2.34567, 10.00013];
  const errors = values.map(v => Math.abs(v - quantizePosition(v)));
  assert.ok(Math.max(...errors) <= 0.5 / 4096 + Number.EPSILON);
  assert.ok(Math.max(...errors) > 0);
});

test('spz-log-scale-quantization-is-bounded-but-lossy', () => {
  const values = [-2.131, -0.017, 1.234];
  const relative = values.map(v => Math.abs(Math.exp(quantizeLogScale(v) - v) - 1));
  assert.ok(Math.max(...relative) <= Math.exp(1/32) - 1 + 1e-12);
  assert.ok(Math.max(...relative) > 0);
});

test('spz-default-sh-quantization-is-not-lossless', () => {
  const degree1 = [0.123, -0.456, 0.789].map(v => quantizeSh(v, 5));
  const degree2plus = [0.123, -0.456, 0.789].map(v => quantizeSh(v, 4));
  assert.notDeepEqual(degree1, [0.123, -0.456, 0.789]);
  assert.notDeepEqual(degree2plus, [0.123, -0.456, 0.789]);
});

test('viewer-contract-rejects-unverifiable-coordinate-and-degree-combinations', () => {
  const validate = ({storageCoordinateSystem, hasCoordinateExtension, shDegree}) => {
    const errors = [];
    if (storageCoordinateSystem !== 'RUB' || hasCoordinateExtension) errors.push('three-r186-coordinate-extension-unsupported');
    if (shDegree > 3) errors.push('three-r186-sh-degree-over-3-is-truncated');
    return errors;
  };
  assert.deepEqual(validate({storageCoordinateSystem:'RUB',hasCoordinateExtension:false,shDegree:3}), []);
  assert.equal(validate({storageCoordinateSystem:'RDF',hasCoordinateExtension:true,shDegree:3}).length, 1);
  assert.equal(validate({storageCoordinateSystem:'RUB',hasCoordinateExtension:false,shDegree:4}).length, 1);
});

const failures = tests.filter(t => t.status === 'fail');
const source = [0.12345, -2.34567, 10.00013];
const positionRoundTrip = source.map(v => quantizePosition(v));
const result = {
  schema:'kaopu-gaussian-handoff-result/r33',
  status: failures.length ? 'Candidate-fail' : 'Candidate-pass',
  testsRun: tests.length,
  failures,
  tests,
  actualThreeR186Execution: true,
  trainingExecuted: false,
  gpuViewerExecuted: false,
  userPhotoDatasetAvailable: false,
  interoperabilityCounterexamples: {
    spzCoordinateExtension: 'Three r186 skips vendor extensions; a non-RUB stored cloud is decoded without the required position/quaternion/SH conversion.',
    shDegree4: 'SPZ supports degree 4; Three r186 clamps decoded attributes to degree 3, dropping 27 directional coefficients per splat.',
    colmapPose: 'images.txt stores world-to-camera Hamilton quaternion plus translation; camera center is -R^T T.',
  },
  quantization: {
    positionStepInStoredUnitsAtFractionalBits12: 1/4096,
    sourcePosition: source,
    decodedPosition: positionRoundTrip,
    maxAbsPositionErrorInStoredUnits: Math.max(...source.map((v,i) => Math.abs(v-positionRoundTrip[i]))),
    worstCaseLogScaleRelativeError: Math.exp(1/32)-1,
    defaultSh1Bits:5,
    defaultShRestBits:4,
  },
  frozenChanged:false,
  productionMotherChanged:false,
};
console.log(JSON.stringify(result, null, 2));
if (failures.length) process.exitCode = 1;
