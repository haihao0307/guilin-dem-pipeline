import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  THREE_R186_SORT_DIRECTION_THRESHOLD,
  analyzeDepthBinsR39,
  validateGaussianSortingEvidenceR39,
} from '../ADAPTERS/gaussian_sorting_gate_r39.mjs';

const threeRoot = process.env.THREE_R186_ROOT;
if (!threeRoot) throw new Error('Set THREE_R186_ROOT to mrdoob/three.js r186 commit 148ef33ecb6d2502ff796d4554abd1549c95d519');

const { CountingSort } = await import(pathToFileURL(path.join(threeRoot, 'examples/jsm/gpgpu/CountingSort.js')).href);
const { GaussianSplat } = await import(pathToFileURL(path.join(threeRoot, 'examples/jsm/objects/GaussianSplat.js')).href);
const { createGaussianSplatGeometry } = await import(pathToFileURL(path.join(threeRoot, 'examples/jsm/utils/GaussianSplatUtils.js')).href);
const { PerspectiveCamera } = await import(pathToFileURL(path.join(threeRoot, 'build/three.webgpu.js')).href);

const tests = [];
const failures = [];
function assert(condition, message) { if (!condition) throw new Error(message); }
function test(name, fn) {
  try { tests.push({ name, pass: true, detail: fn() }); }
  catch (error) { const detail = String(error.message || error); tests.push({ name, pass: false, detail }); failures.push({ name, detail }); }
}
function compositeBackToFront(order, colors, alphas) {
  const out = [0, 0, 0, 0];
  for (const index of order) {
    const alpha = alphas[index];
    out[0] = colors[index][0] * alpha + out[0] * (1 - alpha);
    out[1] = colors[index][1] * alpha + out[1] * (1 - alpha);
    out[2] = colors[index][2] * alpha + out[2] * (1 - alpha);
    out[3] = alpha + out[3] * (1 - alpha);
  }
  return out;
}
function depthFromMatrix(point, matrix) {
  const e = matrix.elements;
  return -(e[2] * point[0] + e[6] * point[1] + e[10] * point[2] + e[14]);
}

const nearDepth = 0;
const farDepth = 100;
const depths = [50, 50.000001]; // index 0 near, index 1 far
const analysis = analyzeDepthBinsR39(depths, nearDepth, farDepth);

test('actual Three r186 CPU CountingSort retains input order inside one bin', () => {
  const sort = new CountingSort(2, { binCount: 4096 });
  const keys = analysis.bins.map(bin => 4095 - bin);
  sort.computeCPU(index => keys[index]);
  const approximate = Array.from(sort.orderAttribute.array);
  const exactBackToFront = [1, 0];
  assert(analysis.bins[0] === analysis.bins[1], `fixture missed collision ${analysis.bins}`);
  assert(JSON.stringify(approximate) === '[0,1]', `unexpected same-bin order ${approximate}`);
  assert(JSON.stringify(approximate) !== JSON.stringify(exactBackToFront), 'negative control accidentally exact');
  return { depths, bins: analysis.bins, nominalDepthStep: analysis.nominalDepthStep, approximate, exactBackToFront };
});

test('same-bin order can change transparent color while final alpha stays equal', () => {
  const colors = [[1, 0, 0], [0, 0, 1]];
  const alphas = [0.5, 0.5];
  const exact = compositeBackToFront([1, 0], colors, alphas);
  const collided = compositeBackToFront([0, 1], colors, alphas);
  const maxRgbDifference = Math.max(...exact.slice(0, 3).map((v, i) => Math.abs(v - collided[i])));
  assert(maxRgbDifference === 0.25, `unexpected RGB difference ${maxRgbDifference}`);
  assert(exact[3] === collided[3] && exact[3] === 0.75, 'alpha should be order-independent in this pair');
  return { exactBackToFrontRgba: exact, collidedInputOrderRgba: collided, maxRgbDifference };
});

test('candidate gate keeps bin precision separate from GPU and target-device evidence', () => {
  const result = validateGaussianSortingEvidenceR39({ depths, nearDepth, farDepth });
  assert(result.errors.includes('non-equal-depths-share-counting-sort-bin'), JSON.stringify(result.errors));
  assert(result.errors.includes('fixed-view-gpu-sort-comparison-missing'), JSON.stringify(result.errors));
  assert(result.errors.includes('target-device-sort-evidence-missing'), JSON.stringify(result.errors));
  return result;
});

const centers = new Float32Array([
  0.1, 0, -1.001,  // initially farther, index 0
  -0.1, 0, -1.0,   // initially nearer, index 1
]);
const covariances = new Float32Array([
  0.04, 0, 0, 0.04, 0, 0.0001,
  0.04, 0, 0, 0.04, 0, 0.0001,
]);
const colors = new Uint8ClampedArray([255, 0, 0, 128, 0, 0, 255, 128]);
const splat = new GaussianSplat(createGaussianSplatGeometry(centers, covariances, colors));
const camera = new PerspectiveCamera(60, 1, 0.01, 100);
camera.updateMatrixWorld(true);
const cpuRendererStub = { backend: { isWebGLBackend: true } };
const firstDispatched = splat.updateSort(cpuRendererStub, camera);
const initialOrder = Array.from(splat._sort.orderAttribute.array);
const initialDepths = [[0.1, 0, -1.001], [-0.1, 0, -1]].map(point => depthFromMatrix(point, camera.matrixWorldInverse));

camera.rotation.y = Math.PI / 180;
camera.updateMatrixWorld(true);
const rotatedDepths = [[0.1, 0, -1.001], [-0.1, 0, -1]].map(point => depthFromMatrix(point, camera.matrixWorldInverse));
const secondDispatched = splat.updateSort(cpuRendererStub, camera);
const retainedOrder = Array.from(splat._sort.orderAttribute.array);
const exactRotatedOrder = rotatedDepths[0] > rotatedDepths[1] ? [0, 1] : [1, 0];

test('actual GaussianSplat skips a one-degree resort although exact depth order flips', () => {
  const dot = Math.cos(Math.PI / 180);
  assert(firstDispatched === true, 'initial sort not dispatched');
  assert(initialDepths[0] > initialDepths[1], `initial exact order wrong ${initialDepths}`);
  assert(rotatedDepths[0] < rotatedDepths[1], `fixture did not flip ${rotatedDepths}`);
  assert(dot > THREE_R186_SORT_DIRECTION_THRESHOLD, `one degree unexpectedly exceeds threshold ${dot}`);
  assert(secondDispatched === false, 'one-degree change unexpectedly resorted');
  assert(JSON.stringify(retainedOrder) === JSON.stringify(initialOrder), 'order changed without resort');
  assert(JSON.stringify(retainedOrder) !== JSON.stringify(exactRotatedOrder), 'retained order accidentally exact');
  return { threshold: THREE_R186_SORT_DIRECTION_THRESHOLD, thresholdDegrees: Math.acos(THREE_R186_SORT_DIRECTION_THRESHOLD) * 180 / Math.PI, initialDepths, rotatedDepths, initialOrder, retainedOrder, exactRotatedOrder, resortDispatched: secondDispatched };
});

camera.rotation.y = 2 * Math.PI / 180;
camera.updateMatrixWorld(true);
const thirdDispatched = splat.updateSort(cpuRendererStub, camera);

test('actual GaussianSplat dispatches after a two-degree direction change from last sort', () => {
  assert(thirdDispatched === true, 'two-degree change did not resort');
  return { twoDegreeDot: Math.cos(2 * Math.PI / 180), threshold: THREE_R186_SORT_DIRECTION_THRESHOLD, resortDispatched: thirdDispatched, order: Array.from(splat._sort.orderAttribute.array) };
});

const report = {
  schema: 'kaopu-gaussian-sorting-precision-probe/r39',
  status: failures.length ? 'Candidate-fail' : 'Candidate-pass',
  sourceLocks: { three: '148ef33ecb6d2502ff796d4554abd1549c95d519' },
  testsRun: tests.length,
  failures,
  tests,
  evidenceLimits: {
    deterministicSyntheticSplatsOnly: true,
    actualThreeCountingSortCpuExecuted: true,
    actualThreeGaussianSplatSortDecisionExecuted: true,
    webglFallbackSortPathExercisedWithoutGpuDraw: true,
    gpuCountingSortExecuted: false,
    rasterizationExecuted: false,
    userPhotosAvailable: false,
    targetDeviceTested: false,
    humanAcceptancePerformed: false,
  },
  interpretation: 'The controls prove exact depth order is not guaranteed by r186 approximate sorting; the RGBA values illustrate order sensitivity and are not a real-asset image metric.',
  frozenR1Changed: false,
  productionMotherChanged: false,
};

console.log(JSON.stringify(report, null, 2));
if (failures.length) process.exitCode = 1;

