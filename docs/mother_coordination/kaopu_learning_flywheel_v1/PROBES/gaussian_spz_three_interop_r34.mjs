import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  validateGaussianSourceForSpzV4,
  validateGaussianSpzDeclaration,
  validateGaussianSpzV4Envelope,
} from '../ADAPTERS/gaussian_spz_delivery_gate_r34.mjs';

const [spzPath, nianticJsonPath, negativeSpzPath] = process.argv.slice(2);
const threeRoot = process.env.THREE_R186_ROOT;
if (!spzPath || !nianticJsonPath || !negativeSpzPath || !threeRoot) {
  throw new Error('usage: THREE_R186_ROOT=... node gaussian_spz_three_interop_r34.mjs fixture.spz niantic.json negative.spz');
}

const loaderUrl = pathToFileURL(path.join(threeRoot, 'examples/jsm/loaders/SPZLoader.js')).href;
const { SPZLoader } = await import(loaderUrl);
const input = fs.readFileSync(spzPath);
const arrayBuffer = input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength);
const geometry = await new SPZLoader().parse(arrayBuffer);
const expected = JSON.parse(fs.readFileSync(nianticJsonPath, 'utf8'));
const negativeInput = fs.readFileSync(negativeSpzPath);
const negativeBuffer = negativeInput.buffer.slice(negativeInput.byteOffset, negativeInput.byteOffset + negativeInput.byteLength);
const negativeGeometry = await new SPZLoader().parse(negativeBuffer);

const tests = [];
const failures = [];
function test(name, fn) {
  try {
    const detail = fn();
    tests.push({ name, pass: true, detail });
  } catch (error) {
    const detail = String(error.message || error);
    tests.push({ name, pass: false, detail });
    failures.push({ name, detail });
  }
}
async function asyncTest(name, fn) {
  try {
    const detail = await fn();
    tests.push({ name, pass: true, detail });
  } catch (error) {
    const detail = String(error.message || error);
    tests.push({ name, pass: false, detail });
    failures.push({ name, detail });
  }
}
function assert(condition, message) {
  if (!condition) throw new Error(message);
}
function maxAbs(a, b) {
  assert(a.length === b.length, `length ${a.length} != ${b.length}`);
  let result = 0;
  for (let i = 0; i < a.length; i++) result = Math.max(result, Math.abs(a[i] - b[i]));
  return result;
}
function covarianceFromScaleQuaternion(scaleLogs, q) {
  const [x, y, z, w] = q;
  const sx = Math.exp(scaleLogs[0]);
  const sy = Math.exp(scaleLogs[1]);
  const sz = Math.exp(scaleLogs[2]);
  const r = [
    1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w),
    2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w),
    2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y),
  ];
  const d = [sx * sx, sy * sy, sz * sz];
  const c = (i, j) => r[i * 3] * d[0] * r[j * 3] + r[i * 3 + 1] * d[1] * r[j * 3 + 1] + r[i * 3 + 2] * d[2] * r[j * 3 + 2];
  return [c(0, 0), c(0, 1), c(0, 2), c(1, 1), c(1, 2), c(2, 2)];
}

const center = Array.from(geometry.getAttribute('position').array);
const covariance = Array.from(geometry.getAttribute('covariance').array);
const color = Array.from(geometry.getAttribute('color').array);
const shNames = ['sphericalHarmonics1', 'sphericalHarmonics2', 'sphericalHarmonics3'];
const fileView = new DataView(arrayBuffer);
const header = {
  magic: fileView.getUint32(0, true),
  version: fileView.getUint32(4, true),
  count: fileView.getUint32(8, true),
  shDegree: fileView.getUint8(12),
  fractionalBits: fileView.getUint8(13),
  hasExtensions: (fileView.getUint8(14) & 0x02) !== 0,
  numStreams: fileView.getUint8(15),
  tocByteOffset: fileView.getUint32(16, true),
};

test('Niantic v4 output is parsed by actual Three.js r186', () => {
  assert(geometry.getAttribute('position').count === 2, 'wrong splat count');
  return { byteLength: input.byteLength, splatCount: 2 };
});

test('RDF input reaches Three.js in default RUB coordinates', () => {
  const error = maxAbs(center, expected.positions);
  assert(error <= 1e-7, `center mismatch ${error}`);
  return { maxAbsError: error, centers: center };
});

test('Niantic xyzw quaternion and log-scale agree with Three covariance', () => {
  const predicted = [];
  for (let i = 0; i < expected.numPoints; i++) {
    predicted.push(...covarianceFromScaleQuaternion(
      expected.scales.slice(i * 3, i * 3 + 3),
      expected.rotations_xyzw.slice(i * 4, i * 4 + 4),
    ));
  }
  const error = maxAbs(covariance, predicted);
  assert(error <= 3e-6, `covariance mismatch ${error}`);
  return { maxAbsError: error, covariance };
});

test('Three exposes exactly SH1-SH3 for constrained degree-3 profile', () => {
  for (const name of shNames) assert(geometry.getAttribute(name), `missing ${name}`);
  assert(!geometry.getAttribute('sphericalHarmonics4'), 'unexpected SH4');
  return Object.fromEntries(shNames.map(name => [name, {
    count: geometry.getAttribute(name).count,
    itemSize: geometry.getAttribute(name).itemSize,
  }]));
});

test('Niantic unpacked SH bytes agree exactly with Three packed SH attributes', () => {
  const bandCoefficients = [3, 5, 7];
  let coefficientBase = 0;
  for (let band = 1; band <= 3; band++) {
    const attribute = geometry.getAttribute(`sphericalHarmonics${band}`);
    const actual = new Uint8Array(attribute.array.buffer, attribute.array.byteOffset, attribute.array.byteLength);
    const stride = attribute.itemSize * 4;
    const components = bandCoefficients[band - 1] * 3;
    const predicted = new Uint8Array(expected.numPoints * stride);
    predicted.fill(128);
    for (let point = 0; point < expected.numPoints; point++) {
      const source = point * 45 + coefficientBase * 3;
      const target = point * stride;
      for (let i = 0; i < components; i++) {
        predicted[target + i] = Math.round(expected.sh[source + i] * 128 + 128);
      }
    }
    const error = maxAbs(actual, predicted);
    assert(error === 0, `SH${band} byte mismatch ${error}`);
    coefficientBase += bandCoefficients[band - 1];
  }
  return { maxByteError: 0, paddingByte: 128 };
});

test('SPZ v4 has no extension flag in safe profile', () => {
  const flags = input[14];
  assert((flags & 0x02) === 0, `extension flag set: ${flags}`);
  return { flags, hasExtensions: false };
});

test('Pre-pack source gate rejects actual wrap and saturation inputs', () => {
  const positive = {
    numPoints: 2,
    shDegree: 3,
    positions: [1.250113, 2.500117, 3.750121, -0.125119, 0.375123, -1.500127],
    scales: [Math.log(0.5), Math.log(1.25), Math.log(2), Math.log(0.2), Math.log(0.7), Math.log(1.7)],
    rotations: [0, 0, Math.sin(Math.PI / 8), Math.cos(Math.PI / 8), Math.sin(Math.PI / 8), 0, 0, Math.cos(Math.PI / 8)],
  };
  assert(validateGaussianSourceForSpzV4(positive).length === 0, 'positive source rejected');
  const negative = {
    numPoints: 1,
    shDegree: 0,
    positions: [2048, 0, 0],
    scales: [-11, 6, 0],
    rotations: [0, 0, 0, 1],
  };
  const errors = validateGaussianSourceForSpzV4(negative);
  assert(errors.includes('position-0-outside-signed-int24'), 'position wrap was not rejected');
  assert(errors.includes('scale-0-would-saturate'), 'low scale saturation was not rejected');
  assert(errors.includes('scale-1-would-saturate'), 'high scale saturation was not rejected');
  return { errors };
});

test('Strict declaration gate accepts only typed compatible metadata matching the file header', () => {
  const valid = { format: 'SPZ', version: 4, coordinateSystem: 'RUB', hasExtensions: false, shDegree: 3, metersPerStoredUnit: 1 };
  assert(validateGaussianSpzDeclaration(valid, header).length === 0, 'valid declaration rejected');
  const invalidDegrees = [undefined, NaN, null, -1, 2.5, '3', 4];
  for (const shDegree of invalidDegrees) {
    assert(validateGaussianSpzDeclaration({ ...valid, shDegree }, header).length > 0, `invalid degree accepted: ${String(shDegree)}`);
  }
  assert(validateGaussianSpzDeclaration({ ...valid, metersPerStoredUnit: 0 }, header).length > 0, 'zero unit accepted');
  assert(validateGaussianSpzDeclaration({ ...valid, metersPerStoredUnit: Infinity }, header).length > 0, 'infinite unit accepted');
  assert(validateGaussianSpzDeclaration({ ...valid, hasExtensions: true }, header).length > 0, 'extension-bearing declaration accepted');
  return { invalidDegreeCasesRejected: invalidDegrees.map(String), header };
});

await asyncTest('Strict envelope gate catches truncation that actual Three.js r186 accepts', async () => {
  const truncated = input.subarray(0, input.length - 1);
  const truncatedBuffer = truncated.buffer.slice(truncated.byteOffset, truncated.byteOffset + truncated.byteLength);
  let threeAccepted = false;
  try {
    await new SPZLoader().parse(truncatedBuffer);
    threeAccepted = true;
  } catch (error) {
    threeAccepted = false;
  }
  const declaration = { format: 'SPZ', version: 4, coordinateSystem: 'RUB', hasExtensions: false, shDegree: 3, metersPerStoredUnit: 1 };
  const gateErrors = validateGaussianSpzV4Envelope(truncated, declaration);
  assert(threeAccepted, 'counterexample changed: Three rejected the truncated stream');
  assert(gateErrors.includes('compressed-streams-do-not-exactly-cover-file'), 'strict gate missed truncation');
  return { removedBytes: 1, threeR186Accepted: true, strictGateRejected: true, gateErrors };
});

await asyncTest('Strict envelope gate catches trailing bytes that actual Three.js r186 ignores', async () => {
  const appended = new Uint8Array(input.length + 1);
  appended.set(input);
  appended[appended.length - 1] = 0xa5;
  const appendedBuffer = appended.buffer.slice(appended.byteOffset, appended.byteOffset + appended.byteLength);
  let threeAccepted = false;
  try {
    await new SPZLoader().parse(appendedBuffer);
    threeAccepted = true;
  } catch (error) {
    threeAccepted = false;
  }
  const declaration = { format: 'SPZ', version: 4, coordinateSystem: 'RUB', hasExtensions: false, shDegree: 3, metersPerStoredUnit: 1 };
  const gateErrors = validateGaussianSpzV4Envelope(appended, declaration);
  assert(threeAccepted, 'counterexample changed: Three rejected the trailing byte');
  assert(gateErrors.includes('compressed-streams-do-not-exactly-cover-file'), 'strict gate missed trailing byte');
  return { appendedBytes: 1, threeR186Accepted: true, strictGateRejected: true, gateErrors };
});

test('Uncompressed checkpoint cannot be reconstructed exactly from SPZ', () => {
  const originalRdf = [1.250113, 2.500117, 3.750121, -0.125119, 0.375123, -1.500127];
  const originalRub = [originalRdf[0], -originalRdf[1], -originalRdf[2], originalRdf[3], -originalRdf[4], -originalRdf[5]];
  const positionError = maxAbs(center, originalRub);
  assert(positionError > 0, 'unexpected lossless position round-trip');
  assert(positionError <= 1 / 8192 + 1e-9, `position error exceeds half step: ${positionError}`);
  return { maxAbsPositionErrorStoredUnits: positionError, halfStep: 1 / 8192 };
});

test('Actual Niantic packer wraps out-of-range position and saturates log-scale', () => {
  const center = Array.from(negativeGeometry.getAttribute('position').array);
  const n = expected.negativeFixture;
  assert(center[0] === -2048, `expected wrapped x=-2048, got ${center[0]}`);
  assert(n.decodedPositionRub[0] === -2048, `Niantic unpack mismatch ${n.decodedPositionRub[0]}`);
  assert(n.decodedLogScales[0] === -10, `low scale did not saturate: ${n.decodedLogScales[0]}`);
  assert(n.decodedLogScales[1] === 5.9375, `high scale did not saturate: ${n.decodedLogScales[1]}`);
  return {
    inputPositionStoredUnits: n.inputPositionRdf,
    decodedPositionStoredUnits: n.decodedPositionRub,
    inputLogScales: n.inputLogScales,
    decodedLogScales: n.decodedLogScales,
    implication: 'pre-pack source-range validation is mandatory; post-pack envelope checks cannot recover lost intent',
  };
});

const report = {
  schema: 'kaopu-gaussian-spz-three-interop-probe/r34',
  status: failures.length ? 'Candidate-fail' : 'Candidate-pass',
  sourceLocks: {
    spz: 'affd0ecea7fbb4c265ee119475af7ee5b2997482',
    three: '148ef33ecb6d2502ff796d4554abd1549c95d519',
  },
  profile: { format: 'SPZ v4', coordinateSystem: 'RUB', extensions: false, maxShDegree: 3 },
  testsRun: tests.length,
  failures,
  tests,
  evidenceLimits: {
    syntheticCloudOnly: true,
    nianticPackerExecuted: true,
    nianticUnpackerExecuted: true,
    threeR186LoaderExecuted: true,
    brushTrainingExecuted: false,
    userPhotosAvailable: false,
    gpuRenderExecuted: false,
    humanAcceptancePerformed: false,
  },
  frozenR1Changed: false,
  productionMotherChanged: false,
};

console.log(JSON.stringify(report, null, 2));
if (failures.length) process.exitCode = 1;
