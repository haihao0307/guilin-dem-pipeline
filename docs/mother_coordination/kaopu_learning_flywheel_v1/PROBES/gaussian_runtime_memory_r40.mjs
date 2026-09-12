import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  expectedThreeR186CpuVisibleBytesR40,
  validateThreeR186RuntimeMemoryEvidenceR40,
} from '../ADAPTERS/gaussian_runtime_memory_gate_r40.mjs';

const threeRoot = process.env.THREE_R186_ROOT;
if (!threeRoot) throw new Error('Set THREE_R186_ROOT to mrdoob/three.js r186 commit 148ef33ecb6d2502ff796d4554abd1549c95d519');

const { GaussianSplat } = await import(pathToFileURL(path.join(threeRoot, 'examples/jsm/objects/GaussianSplat.js')).href);
const { SH_BAND_WORDS, createGaussianSplatGeometry } = await import(pathToFileURL(path.join(threeRoot, 'examples/jsm/utils/GaussianSplatUtils.js')).href);
const { PerspectiveCamera } = await import(pathToFileURL(path.join(threeRoot, 'build/three.webgpu.js')).href);

const tests = [];
const failures = [];
function assert(condition, message) { if (!condition) throw new Error(message); }
function test(name, fn) {
  try { tests.push({ name, pass: true, detail: fn() }); }
  catch (error) { const detail = String(error.message || error); tests.push({ name, pass: false, detail }); failures.push({ name, detail }); }
}

function fixture(count, degree, autoSort = true) {
  const centers = new Float32Array(count * 3);
  const covariances = new Float32Array(count * 6);
  const colors = new Uint8ClampedArray(count * 4);
  for (let i = 0; i < count; i++) {
    centers[i * 3] = i * 0.001;
    covariances.set([1, 0, 0, 1, 0, 1], i * 6);
    colors.set([128, 128, 128, 255], i * 4);
  }
  const sphericalHarmonics = {};
  for (let band = 1; band <= degree; band++) {
    sphericalHarmonics[`sh${band}`] = new Uint32Array(count * SH_BAND_WORDS[band]);
    sphericalHarmonics[`sh${band}`].fill(0x80808080);
  }
  const source = createGaussianSplatGeometry(centers, covariances, colors, sphericalHarmonics);
  return new GaussianSplat(source, { autoSort });
}

function inventory(splat) {
  const entries = [];
  const add = (label, view) => {
    if (!ArrayBuffer.isView(view)) throw new Error(`${label} is not an ArrayBuffer view`);
    entries.push({ label, view });
  };
  for (const [name, attribute] of Object.entries(splat.splatGeometry.attributes)) add(`source.${name}`, attribute.array);
  for (const [name, attribute] of Object.entries(splat.geometry.attributes)) add(`draw.${name}`, attribute.array);
  add('draw.index', splat.geometry.index.array);
  for (const name of ['centerRead', 'covarianceARead', 'covarianceBRead', 'colorRead']) add(`storage.${name}`, splat._buffers[name].value.array);
  for (let degree = 1; degree <= splat._buffers.sphericalHarmonicsDegree; degree++) {
    add(`storage.sh${degree}`, splat._buffers[`sphericalHarmonics${degree}Attribute`].array);
  }
  if (splat._buffers.sphericalHarmonicsContributionRead) add('storage.lazyShContribution', splat._buffers.sphericalHarmonicsContributionRead.value.array);
  add('sort.order', splat._sort.orderAttribute.array);
  add('sort.bin', splat._sort.binRead.value.array);
  add('sort.histogram', splat._sort.histogramAtomic.value.array);
  add('sort.offset', splat._sort.offsetAtomic.value.array);
  add('sort.cpuBins', splat._sort._cpuBins);
  add('sort.cpuCounts', splat._sort._cpuCounts);
  add('sort.cpuOffsets', splat._sort._cpuOffsets);

  const unique = new Map();
  for (const { label, view } of entries) {
    const prior = unique.get(view.buffer);
    if (prior) prior.aliases.push(label);
    else unique.set(view.buffer, { bytes: view.buffer.byteLength, aliases: [label] });
  }
  const buffers = [...unique.values()].sort((a, b) => a.aliases[0].localeCompare(b.aliases[0]));
  return { totalBytes: buffers.reduce((sum, item) => sum + item.bytes, 0), uniqueBufferCount: buffers.length, buffers };
}

const counts = [1, 17, 1024];
const matrix = [];
for (let degree = 0; degree <= 3; degree++) {
  for (const count of counts) {
    const splat = fixture(count, degree);
    const before = inventory(splat);
    const expectedBefore = expectedThreeR186CpuVisibleBytesR40(count, degree);
    const camera = new PerspectiveCamera(60, 1, 0.01, 100);
    camera.updateMatrixWorld(true);
    const dispatched = splat.updateSphericalHarmonics({ backend: { isWebGLBackend: false }, compute() {} }, camera);
    const after = inventory(splat);
    const expectedAfter = expectedThreeR186CpuVisibleBytesR40(count, degree, { webgpuShContribution: true });
    matrix.push({ degree, count, before: before.totalBytes, expectedBefore: expectedBefore.total, afterWebgpuShUpdate: after.totalBytes, expectedAfter: expectedAfter.total, dispatched, uniqueBuffersBefore: before.uniqueBufferCount, uniqueBuffersAfter: after.uniqueBufferCount });
  }
}

test('actual constructor bytes match the deduplicated lower-bound formula for SH0-SH3', () => {
  for (const row of matrix) assert(row.before === row.expectedBefore, JSON.stringify(row));
  return matrix.map(({ degree, count, before }) => ({ degree, count, bytes: before }));
});

test('actual first WebGPU SH update adds exactly 16 bytes per splat only when SH is present', () => {
  for (const row of matrix) {
    assert(row.afterWebgpuShUpdate === row.expectedAfter, JSON.stringify(row));
    assert(row.dispatched === (row.degree > 0), `unexpected dispatch ${JSON.stringify(row)}`);
  }
  return matrix.map(row => ({ degree: row.degree, count: row.count, addedBytes: row.afterWebgpuShUpdate - row.before, dispatched: row.dispatched }));
});

test('source SH arrays are aliased by storage nodes and counted once', () => {
  const splat = fixture(17, 3);
  const result = inventory(splat);
  for (let degree = 1; degree <= 3; degree++) {
    const aliases = result.buffers.find(item => item.aliases.includes(`source.sphericalHarmonics${degree}`))?.aliases || [];
    assert(aliases.includes(`storage.sh${degree}`), `SH${degree} storage did not alias source: ${aliases}`);
  }
  return result.buffers.filter(item => item.aliases.some(alias => alias.includes('sphericalHarmonics')));
});

test('autoSort false does not avoid constructor sort allocation', () => {
  const enabled = inventory(fixture(1024, 3, true));
  const disabled = inventory(fixture(1024, 3, false));
  assert(enabled.totalBytes === disabled.totalBytes, `${enabled.totalBytes} != ${disabled.totalBytes}`);
  return { autoSortTrueBytes: enabled.totalBytes, autoSortFalseBytes: disabled.totalBytes, difference: disabled.totalBytes - enabled.totalBytes };
});

test('one-million-splat projection is arithmetic from the executed formula, not a device peak', () => {
  const constructor = expectedThreeR186CpuVisibleBytesR40(1_000_000, 3);
  const afterWebgpuSh = expectedThreeR186CpuVisibleBytesR40(1_000_000, 3, { webgpuShContribution: true });
  return {
    constructorBytes: constructor.total,
    constructorMiB: constructor.total / 1048576,
    afterFirstWebgpuShBytes: afterWebgpuSh.total,
    afterFirstWebgpuShMiB: afterWebgpuSh.total / 1048576,
    excluded: ['GPU allocation/padding/copies', 'SPZ and ZSTD loader peak', 'browser and JS object overhead', 'render targets', 'OS process peak'],
  };
});

test('candidate gate refuses to treat constructor bytes as target-device memory acceptance', () => {
  const expected = expectedThreeR186CpuVisibleBytesR40(1024, 3);
  const result = validateThreeR186RuntimeMemoryEvidenceR40({ count: 1024, shDegree: 3, measuredCpuVisibleBytes: expected.total });
  for (const missing of ['target-device-peak-memory-missing', 'backend-gpu-allocation-missing', 'loader-decompression-peak-missing', 'human-acceptance-missing']) {
    assert(result.errors.includes(missing), JSON.stringify(result));
  }
  return result;
});

const report = {
  schema: 'kaopu-gaussian-runtime-memory-probe/r40',
  status: failures.length ? 'Candidate-fail' : 'Candidate-pass',
  sourceLocks: { three: '148ef33ecb6d2502ff796d4554abd1549c95d519' },
  testsRun: tests.length,
  failures,
  formula: {
    constructorFixedBytes: 65596,
    constructorBytesPerSplatByShDegree: { 0: 104, 1: 116, 2: 132, 3: 156 },
    postFirstWebgpuShBytesPerSplatByShDegree: { 0: 104, 1: 132, 2: 148, 3: 172 },
  },
  tests,
  evidenceLimits: {
    actualThreeGaussianSplatConstructorExecuted: true,
    actualLazyWebgpuShAllocationPathExecutedWithoutGpuBackend: true,
    uniqueArrayBuffersDeduplicatedByIdentity: true,
    actualGpuAllocationMeasured: false,
    loaderOrZstdPeakMeasured: false,
    browserProcessPeakMeasured: false,
    userPhotosAvailable: false,
    targetDeviceTested: false,
    humanAcceptancePerformed: false,
  },
  interpretation: 'The exact TypedArray inventory is a reproducible CPU-visible lower bound for this fixed constructor path. It is not total runtime, browser, GPU, loader, or device peak memory.',
  frozenR1Changed: false,
  productionMotherChanged: false,
};

console.log(JSON.stringify(report, null, 2));
if (failures.length) process.exitCode = 1;
