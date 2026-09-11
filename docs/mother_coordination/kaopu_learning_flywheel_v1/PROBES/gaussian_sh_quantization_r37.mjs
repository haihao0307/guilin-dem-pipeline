import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { analyzeGaussianShQuantizationR37 } from '../ADAPTERS/gaussian_sh_quantization_gate_r37.mjs';

const [positivePath, negativePath, metadataPath] = process.argv.slice(2);
const threeRoot = process.env.THREE_R186_ROOT;
if (!positivePath || !negativePath || !metadataPath || !threeRoot) {
  throw new Error('usage: THREE_R186_ROOT=... node gaussian_sh_quantization_r37.mjs positive.spz negative.spz metadata.json');
}

const { SPZLoader } = await import(pathToFileURL(path.join(threeRoot, 'examples/jsm/loaders/SPZLoader.js')).href);
async function load(filePath) {
  const input = fs.readFileSync(filePath);
  return new SPZLoader().parse(input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength));
}
const [positiveGeometry, negativeGeometry] = await Promise.all([load(positivePath), load(negativePath)]);
const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));

const BAND_COMPONENTS = [0, 9, 15, 21];
const BAND_WORDS = [0, 3, 4, 6];
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
function assert(condition, message) { if (!condition) throw new Error(message); }
function test(name, fn) {
  try { tests.push({ name, pass: true, detail: fn() }); }
  catch (error) {
    const detail = String(error.message || error);
    tests.push({ name, pass: false, detail });
    failures.push({ name, detail });
  }
}
function unpackAll(geometry, pointCount) {
  const all = new Array(pointCount * 45);
  for (let point = 0; point < pointCount; point++) {
    let destination = point * 45;
    for (let degree = 1; degree <= 3; degree++) {
      const words = geometry.getAttribute(`sphericalHarmonics${degree}`).array;
      for (let component = 0; component < BAND_COMPONENTS[degree]; component++) {
        const word = words[point * BAND_WORDS[degree] + Math.floor(component / 4)];
        const byte = (word >>> ((component % 4) * 8)) & 0xff;
        all[destination++] = (byte - 128) / 128;
      }
    }
  }
  return all;
}
function weights([x, y, z], c) {
  const xx = x * x, yy = y * y, zz = z * z, xy = x * y;
  return [
    -c.c1 * y, c.c1 * z, -c.c1 * x,
    c.c2[0] * x * y, c.c2[1] * y * z, c.c2[2] * (2 * zz - xx - yy), c.c2[3] * x * z, c.c2[4] * (xx - yy),
    c.c3[0] * y * (3 * xx - yy), c.c3[1] * xy * z, c.c3[2] * y * (4 * zz - xx - yy),
    c.c3[3] * z * (2 * zz - 3 * xx - 3 * yy), c.c3[4] * x * (4 * zz - xx - yy),
    c.c3[5] * z * (xx - yy), c.c3[6] * x * (xx - 3 * yy),
  ];
}
function evaluate(coefficients, offset, direction, constants) {
  const w = weights(direction, constants);
  const rgb = [0, 0, 0];
  for (let coefficient = 0; coefficient < 15; coefficient++) {
    for (let channel = 0; channel < 3; channel++) rgb[channel] += coefficients[offset + coefficient * 3 + channel] * w[coefficient];
  }
  return rgb;
}
function directions(count) {
  const result = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    const z = 1 - 2 * (i + 0.5) / count;
    const radius = Math.sqrt(1 - z * z);
    const phi = golden * i;
    result.push([Math.cos(phi) * radius, Math.sin(phi) * radius, z]);
  }
  return result;
}
function rdfFromRub([x, y, z]) { return [x, -y, -z]; }

const positiveDecoded = unpackAll(positiveGeometry, 64);
const negativeDecoded = unpackAll(negativeGeometry, 1);
const converted = metadata.convertedShRub;
const source = metadata.sourceShRdf;
const directionSetRub = directions(2048);

function coefficientMetrics() {
  const bands = [
    { degree: 1, start: 0, end: 9, naiveHalfStep: 1 / 32, twoStageBound: 9 / 256 },
    { degree: 2, start: 9, end: 24, naiveHalfStep: 1 / 16, twoStageBound: 17 / 256 },
    { degree: 3, start: 24, end: 45, naiveHalfStep: 1 / 16, twoStageBound: 17 / 256 },
  ];
  return bands.map(band => {
    let max = 0, sum = 0, count = 0;
    for (let point = 0; point < 64; point++) {
      for (let i = band.start; i < band.end; i++) {
        const error = Math.abs(converted[point * 45 + i] - positiveDecoded[point * 45 + i]);
        max = Math.max(max, error); sum += error * error; count++;
      }
    }
    return { degree: band.degree, coefficientCount: count, maxError: max, rmse: Math.sqrt(sum / count), naiveHalfStep: band.naiveHalfStep, twoStageBound: band.twoStageBound };
  });
}
function directionalMetrics() {
  let maxError = 0, sum = 0, count = 0, maxAt = null;
  for (let point = 0; point < 64; point++) {
    for (let directionIndex = 0; directionIndex < directionSetRub.length; directionIndex++) {
      const rubDirection = directionSetRub[directionIndex];
      const reference = evaluate(source, point * 45, rdfFromRub(rubDirection), GRAPHDECO);
      const delivered = evaluate(positiveDecoded, point * 45, rubDirection, THREE_R186);
      for (let channel = 0; channel < 3; channel++) {
        const error = Math.abs(reference[channel] - delivered[channel]);
        if (error > maxError) { maxError = error; maxAt = { point, directionIndex, channel }; }
        sum += error * error; count++;
      }
    }
  }
  return { points: 64, directions: directionSetRub.length, samples: count, maxError, rmse: Math.sqrt(sum / count), maxAt };
}

const coeffMetrics = coefficientMetrics();
const dirMetrics = directionalMetrics();

test('Default Niantic two-stage quantizer needs the widened per-band bound', () => {
  assert(coeffMetrics[0].maxError > 1 / 32, 'fixture did not falsify naive SH1 half-step');
  assert(coeffMetrics[0].maxError <= 9 / 256 + 1e-7, `SH1 ${coeffMetrics[0].maxError}`);
  assert(coeffMetrics[1].maxError <= 17 / 256 + 1e-7, `SH2 ${coeffMetrics[1].maxError}`);
  assert(coeffMetrics[2].maxError <= 17 / 256 + 1e-7, `SH3 ${coeffMetrics[2].maxError}`);
  return coeffMetrics;
});

test('Actual arbitrary-coefficient handoff has a measured directional error distribution', () => {
  assert(dirMetrics.maxError > 0, 'fixture accidentally lossless');
  assert(Number.isFinite(dirMetrics.rmse), 'nonfinite directional RMSE');
  return dirMetrics;
});

test('Candidate gate accepts the measured in-domain fixture only with explicit budgets', () => {
  const result = analyzeGaussianShQuantizationR37(
    { numPoints: 64, shDegree: 3, sh: converted },
    { sh: positiveDecoded },
    { maxCoefficientError: 17 / 256 + 1e-7, measuredDirectionalMax: dirMetrics.maxError, maxDirectionalError: 0.25 },
  );
  assert(result.errors.length === 0, result.errors.join(','));
  return result;
});

test('Actual Niantic packer saturates out-of-domain SH and the gate rejects it', () => {
  const expected = metadata.negativeConvertedShRub;
  const result = analyzeGaussianShQuantizationR37(
    { numPoints: 1, shDegree: 3, sh: expected },
    { sh: negativeDecoded },
    { maxCoefficientError: 1 / 16 + 1e-7, measuredDirectionalMax: 0, maxDirectionalError: 0.25 },
  );
  assert(expected[0] === 1.25 && expected[1] === -1.25, `unexpected RDF-to-RUB signs ${expected[0]},${expected[1]}`);
  assert(negativeDecoded[0] === 127 / 128, `positive endpoint ${negativeDecoded[0]}`);
  assert(negativeDecoded[1] === -1, `negative endpoint ${negativeDecoded[1]}`);
  assert(result.errors.includes('source-sh-outside-declared-minus-one-to-one-domain'), 'domain violation not rejected');
  assert(result.errors.includes('coefficient-error-budget-exceeded'), 'destructive error not rejected');
  return { sourcePositiveAfterRdfToRub: expected[0], decodedPositive: negativeDecoded[0], sourceNegativeAfterRdfToRub: expected[1], decodedNegative: negativeDecoded[1], gate: result };
});

test('Missing budgets and a stricter measured-direction budget fail separately', () => {
  const missing = analyzeGaussianShQuantizationR37({ numPoints: 64, shDegree: 3, sh: converted }, { sh: positiveDecoded });
  const strict = analyzeGaussianShQuantizationR37(
    { numPoints: 64, shDegree: 3, sh: converted },
    { sh: positiveDecoded },
    { maxCoefficientError: 17 / 256 + 1e-7, measuredDirectionalMax: dirMetrics.maxError, maxDirectionalError: dirMetrics.maxError / 2 },
  );
  assert(missing.errors.includes('missing-explicit-quantization-budget'), 'missing budget accepted');
  assert(strict.errors.includes('directional-error-budget-exceeded'), 'strict direction budget accepted');
  return { missingBudgetErrors: missing.errors, strictBudgetErrors: strict.errors };
});

const report = {
  schema: 'kaopu-gaussian-sh-quantization-probe/r37',
  status: failures.length ? 'Candidate-fail' : 'Candidate-pass',
  sourceLocks: { graphdeco: '54c035f7834b564019656c3e3fcc3646292f727d', spz: 'affd0ecea7fbb4c265ee119475af7ee5b2997482', three: '148ef33ecb6d2502ff796d4554abd1549c95d519' },
  testsRun: tests.length,
  failures,
  tests,
  evidenceLimits: {
    deterministicSyntheticCoefficientsOnly: true,
    coefficientDomain: [-0.95, 0.95],
    points: 64,
    directions: directionSetRub.length,
    nianticPackerExecuted: true,
    threeR186SpzLoaderExecuted: true,
    graphdecoAndThreeBasisMirroredFromLockedSource: true,
    brushTrainingExecuted: false,
    userPhotosAvailable: false,
    gpuRenderExecuted: false,
    perceptualImageComparisonExecuted: false,
    humanAcceptancePerformed: false,
  },
  interpretation: 'Directional errors are linear SH-contribution errors for this deterministic fixture, not final pixel errors or a universal quality threshold.',
  frozenR1Changed: false,
  productionMotherChanged: false,
};

console.log(JSON.stringify(report, null, 2));
if (failures.length) process.exitCode = 1;
