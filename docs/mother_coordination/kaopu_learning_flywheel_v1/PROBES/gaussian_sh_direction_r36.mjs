import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const [spzPath, metadataPath] = process.argv.slice(2);
const threeRoot = process.env.THREE_R186_ROOT;
if (!spzPath || !metadataPath || !threeRoot) {
  throw new Error('usage: THREE_R186_ROOT=... node gaussian_sh_direction_r36.mjs fixture.spz metadata.json');
}

const threeSourcePath = path.join(threeRoot, 'examples/jsm/objects/GaussianSplat.js');
const threeSource = fs.readFileSync(threeSourcePath, 'utf8');
const { SPZLoader } = await import(pathToFileURL(path.join(threeRoot, 'examples/jsm/loaders/SPZLoader.js')).href);
const input = fs.readFileSync(spzPath);
const geometry = await new SPZLoader().parse(input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength));
const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));

const BAND_COMPONENTS = [0, 9, 15, 21];
const GRAPHDECO = {
  c1: 0.4886025119029199,
  c2: [1.0925484305920792, -1.0925484305920792, 0.31539156525252005, -1.0925484305920792, 0.5462742152960396],
  c3: [-0.5900435899266435, 2.890611442640554, -0.4570457994644658, 0.3731763325901154, -0.4570457994644658, 1.445305721320277, -0.5900435899266435],
};
const THREE_R186 = {
  c1: 0.4886025,
  c2: [1.0925484, -1.0925484, 0.3153915, -1.0925484, 0.5462742],
  c3: [-0.5900436, 2.8906114, -0.4570458, 0.3731763, -0.4570458, 1.4453057, -0.5900436],
};

const tests = [];
const failures = [];
function assert(condition, message) {
  if (!condition) throw new Error(message);
}
function test(name, fn) {
  try {
    tests.push({ name, pass: true, detail: fn() });
  } catch (error) {
    const detail = String(error.message || error);
    tests.push({ name, pass: false, detail });
    failures.push({ name, detail });
  }
}
function normalize(v) {
  const n = Math.hypot(...v);
  return v.map(x => x / n);
}
function rubFromRdf([x, y, z]) {
  return [x, -y, -z];
}
function negate(v) {
  return v.map(x => -x);
}

function weights([x, y, z], constants) {
  const xx = x * x;
  const yy = y * y;
  const zz = z * z;
  const xy = x * y;
  return [
    -constants.c1 * y,
    constants.c1 * z,
    -constants.c1 * x,
    constants.c2[0] * x * y,
    constants.c2[1] * y * z,
    constants.c2[2] * (2 * zz - xx - yy),
    constants.c2[3] * x * z,
    constants.c2[4] * (xx - yy),
    constants.c3[0] * y * (3 * xx - yy),
    constants.c3[1] * xy * z,
    constants.c3[2] * y * (4 * zz - xx - yy),
    constants.c3[3] * z * (2 * zz - 3 * xx - 3 * yy),
    constants.c3[4] * x * (4 * zz - xx - yy),
    constants.c3[5] * z * (xx - yy),
    constants.c3[6] * x * (xx - 3 * yy),
  ];
}
function evaluate(coefficients, direction, constants) {
  const w = weights(direction, constants);
  const rgb = [0, 0, 0];
  for (let coefficient = 0; coefficient < 15; coefficient++) {
    for (let channel = 0; channel < 3; channel++) {
      rgb[channel] += coefficients[coefficient * 3 + channel] * w[coefficient];
    }
  }
  return rgb;
}
function maxRgbError(a, b) {
  return Math.max(...a.map((value, i) => Math.abs(value - b[i])));
}
function unpackThreeCoefficients() {
  const result = [];
  for (let degree = 1; degree <= 3; degree++) {
    const words = geometry.getAttribute(`sphericalHarmonics${degree}`).array;
    let remaining = BAND_COMPONENTS[degree];
    for (const word of words) {
      for (let byteIndex = 0; byteIndex < 4 && remaining > 0; byteIndex++, remaining--) {
        const byte = (word >>> (byteIndex * 8)) & 0xff;
        result.push((byte - 128) / 128);
      }
    }
  }
  return result;
}

const source = metadata.sourceSh;
const converted = metadata.directConvertedSh;
const loaded = unpackThreeCoefficients();
const directionsRdf = [
  [1, 0, 0], [0, 1, 0], [0, 0, 1], [-1, 0, 0], [0, -1, 0], [0, 0, -1],
  [1, 1, 1], [1, 1, -1], [1, -1, 1], [-1, 1, 1],
  [2, 1, 3], [-3, 2, 1], [1, -4, 2], [-2, -1, 4],
].map(normalize);

function compareAcrossDirections(sourceCoefficients, targetCoefficients, directionMap, sourceConstants = GRAPHDECO, targetConstants = GRAPHDECO) {
  let maxError = 0;
  let errorSum = 0;
  for (const direction of directionsRdf) {
    const sourceRgb = evaluate(sourceCoefficients, direction, sourceConstants);
    const targetRgb = evaluate(targetCoefficients, directionMap(direction), targetConstants);
    const error = maxRgbError(sourceRgb, targetRgb);
    maxError = Math.max(maxError, error);
    errorSum += error;
  }
  return { maxError, meanMaxChannelError: errorSum / directionsRdf.length, directions: directionsRdf.length };
}

test('Pinned Three r186 source uses center-minus-camera and the locked SH1-SH3 basis', () => {
  assert(threeSource.includes('normalize( center.sub( localCameraPosition ) )'), 'view direction contract changed');
  for (const token of ['y.mul( - 0.4886025 )', 'xy.mul( z ).mul( 2.8906114 )', 'x.mul( xx.sub( yy.mul( 3 ) ) ).mul( - 0.5900436 )']) {
    assert(threeSource.includes(token), `missing basis token: ${token}`);
  }
  return {
    graphdecoRendererBlob: 'e12f4b68037e4437feb670d7f8750b4846cca4cb',
    graphdecoShUtilsBlob: 'bbca7d192aa3a7edf8c5b2d24dee535eac765785',
    threeGaussianSplatBlob: '06d37fe6af583cf8cbdf8bd93565403bc3b94691',
  };
});

test('Actual Niantic RDF-to-RUB conversion preserves the SH1-SH3 directional function', () => {
  const result = compareAcrossDirections(source, converted, rubFromRdf);
  assert(result.maxError < 1e-7, `functional conversion error ${result.maxError}`);
  return result;
});

test('Actual Niantic packing and Three r186 loading preserve the quantization-grid coefficients', () => {
  let maxCoefficientError = 0;
  for (let i = 0; i < converted.length; i++) maxCoefficientError = Math.max(maxCoefficientError, Math.abs(converted[i] - loaded[i]));
  assert(loaded.length === 45, `loaded ${loaded.length} coefficients`);
  assert(maxCoefficientError === 0, `coefficient error ${maxCoefficientError}`);
  return { coefficientCount: loaded.length, maxCoefficientError };
});

test('Three r186 rounded SH basis preserves the GraphDECO directional function within source-rounding error', () => {
  const result = compareAcrossDirections(source, loaded, rubFromRdf, GRAPHDECO, THREE_R186);
  assert(result.maxError < 2e-7, `basis/interop error ${result.maxError}`);
  return result;
});

test('Flipping positions/directions without transforming SH is a detected negative control', () => {
  const result = compareAcrossDirections(source, source, rubFromRdf);
  assert(result.maxError > 0.5, `negative control too weak ${result.maxError}`);
  return result;
});

test('Using camera-minus-center instead of center-minus-camera is a detected negative control', () => {
  const result = compareAcrossDirections(source, loaded, direction => negate(rubFromRdf(direction)), GRAPHDECO, THREE_R186);
  assert(result.maxError > 0.5, `negative control too weak ${result.maxError}`);
  return result;
});

const report = {
  schema: 'kaopu-gaussian-sh-direction-probe/r36',
  status: failures.length ? 'Candidate-fail' : 'Candidate-pass',
  sourceLocks: {
    graphdeco: '54c035f7834b564019656c3e3fcc3646292f727d',
    spz: 'affd0ecea7fbb4c265ee119475af7ee5b2997482',
    three: '148ef33ecb6d2502ff796d4554abd1549c95d519',
  },
  testsRun: tests.length,
  failures,
  tests,
  evidenceLimits: {
    syntheticDirectionalFixtureOnly: true,
    nianticCoordinateConverterExecuted: true,
    nianticPackerExecuted: true,
    threeR186SpzLoaderExecuted: true,
    threeRendererSourceAuthenticatedButGpuNotExecuted: true,
    brushTrainingExecuted: false,
    userPhotosAvailable: false,
    gpuRenderExecuted: false,
    perceptualImageComparisonExecuted: false,
    humanAcceptancePerformed: false,
  },
  observationRootNote: 'Three and SPZ form one dependent delivery chain; GraphDECO supplies the trainer-reference convention. This is derived interoperability evidence, not physical corroboration.',
  frozenR1Changed: false,
  productionMotherChanged: false,
};

console.log(JSON.stringify(report, null, 2));
if (failures.length) process.exitCode = 1;
