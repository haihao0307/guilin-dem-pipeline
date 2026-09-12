import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  expectedThreeR186SpzV4LoaderBytesR41,
  validateThreeR186SpzLoaderMemoryEvidenceR41,
} from '../ADAPTERS/gaussian_spz_loader_memory_gate_r41.mjs';

const threeRoot = process.env.THREE_R186_ROOT;
const fixtureDir = process.argv[2];
if (!threeRoot || !fixtureDir) throw new Error('usage: THREE_R186_ROOT=... node gaussian_spz_loader_memory_r41.mjs <fixture-dir>');

const { SPZLoader } = await import(pathToFileURL(path.join(threeRoot, 'examples/jsm/loaders/SPZLoader.js')).href);
const { ZSTDDecoder } = await import(pathToFileURL(path.join(threeRoot, 'examples/jsm/libs/zstddec.module.js')).href);
const loaderSource = fs.readFileSync(path.join(threeRoot, 'examples/jsm/loaders/SPZLoader.js'), 'utf8');

const tests = [];
const failures = [];
function assert(condition, message) { if (!condition) throw new Error(message); }
function test(name, fn) {
  try { tests.push({ name, pass: true, detail: fn() }); }
  catch (error) { const detail = String(error.message || error); tests.push({ name, pass: false, detail }); failures.push({ name, detail }); }
}
async function testAsync(name, fn) {
  try { tests.push({ name, pass: true, detail: await fn() }); }
  catch (error) { const detail = String(error.message || error); tests.push({ name, pass: false, detail }); failures.push({ name, detail }); }
}
function exactArrayBuffer(buffer) {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}
function sumUniqueBuffers(entries) {
  const unique = new Map();
  for (const { label, view } of entries) {
    if (!ArrayBuffer.isView(view)) throw new Error(`${label} is not an ArrayBuffer view`);
    const prior = unique.get(view.buffer);
    if (prior) prior.aliases.push(label);
    else unique.set(view.buffer, { bytes: view.buffer.byteLength, aliases: [label] });
  }
  return { totalBytes: [...unique.values()].reduce((sum, x) => sum + x.bytes, 0), buffers: [...unique.values()] };
}
function parseHeader(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { count: view.getUint32(8, true), degree: view.getUint8(12), numStreams: view.getUint8(15) };
}

const decoder = new ZSTDDecoder();
await decoder.init();
const fixtureNames = ['d0-varied.spz', 'd1-varied.spz', 'd2-varied.spz', 'd3-varied.spz', 'd3-compressible-1024.spz', 'd3-varied-1024.spz'];
const rows = [];
for (const name of fixtureNames) {
  const nodeBuffer = fs.readFileSync(path.join(fixtureDir, name));
  const arrayBuffer = exactArrayBuffer(nodeBuffer);
  const bytes = new Uint8Array(arrayBuffer);
  const header = parseHeader(bytes);
  const decoded = [];
  const tracingDecoder = {
    decode(compressed, streamSize) {
      const output = decoder.decode(compressed, streamSize);
      decoded.push(output);
      return output;
    },
  };
  const geometry = new SPZLoader().parseRawSPZV4(bytes, tracingDecoder);
  const entries = [{ label: 'compressedInput', view: bytes }];
  decoded.forEach((view, index) => entries.push({ label: `decodedStream${index}`, view }));
  for (const [attribute, value] of Object.entries(geometry.attributes)) entries.push({ label: `geometry.${attribute}`, view: value.array });
  const inventory = sumUniqueBuffers(entries);
  const expected = expectedThreeR186SpzV4LoaderBytesR41(header.count, Math.min(header.degree, 3), bytes.byteLength);
  rows.push({ name, ...header, compressedInputBytes: bytes.byteLength, decodedStreamBytes: decoded.map(x => x.byteLength), geometryBytes: Object.fromEntries(Object.entries(geometry.attributes).map(([k, v]) => [k, v.array.byteLength])), measuredPerLoadReachableArrays: inventory.totalBytes, expectedPerLoadReachableArrays: expected.perLoadReachableArrays, uniqueBufferCount: inventory.buffers.length });
}

await testAsync('actual public Three r186 parse accepts every Niantic v4 fixture', async () => {
  const parsed = [];
  for (const name of fixtureNames) {
    const input = exactArrayBuffer(fs.readFileSync(path.join(fixtureDir, name)));
    const geometry = await new SPZLoader().parse(input);
    parsed.push({ name, count: geometry.getAttribute('position').count, attributes: Object.keys(geometry.attributes) });
  }
  return parsed;
});

test('actual ZSTD decode outputs match declared raw-stream byte formulas for SH0-SH3', () => {
  const expectedPerSplat = [20, 29, 44, 65];
  for (const row of rows.slice(0, 4)) {
    const decoded = row.decodedStreamBytes.reduce((a, b) => a + b, 0);
    assert(decoded === row.count * expectedPerSplat[row.degree], JSON.stringify(row));
  }
  return rows.slice(0, 4).map(row => ({ degree: row.degree, count: row.count, decodedStreamBytes: row.decodedStreamBytes, total: row.decodedStreamBytes.reduce((a, b) => a + b, 0) }));
});

test('deduplicated input plus decoded streams plus output geometry matches the concurrent per-load lower bound', () => {
  for (const row of rows) assert(row.measuredPerLoadReachableArrays === row.expectedPerLoadReachableArrays, JSON.stringify(row));
  return rows.map(row => ({ name: row.name, measured: row.measuredPerLoadReachableArrays, expected: row.expectedPerLoadReachableArrays, uniqueBufferCount: row.uniqueBufferCount }));
});

test('fixed loader lookup tables add 9472 shared bytes independent of asset count', () => {
  const declarations = [
    { pattern: 'new Float32Array( 256 )', bytes: 256 * 4 },
    { pattern: 'new Uint8ClampedArray( 256 )', bytes: 256 },
    { pattern: 'new Float64Array( 1024 )', bytes: 1024 * 8 },
  ];
  for (const item of declarations) assert(loaderSource.includes(item.pattern), `missing ${item.pattern}`);
  const total = declarations.reduce((sum, item) => sum + item.bytes, 0);
  assert(total === 9472, `unexpected LUT bytes ${total}`);
  return { declarations, total };
});

test('same count and SH degree can have different compressed sizes but identical decoded/output allocation', () => {
  const compressible = rows.find(row => row.name === 'd3-compressible-1024.spz');
  const varied = rows.find(row => row.name === 'd3-varied-1024.spz');
  assert(compressible.compressedInputBytes !== varied.compressedInputBytes, JSON.stringify({ compressible, varied }));
  assert(compressible.decodedStreamBytes.reduce((a, b) => a + b, 0) === varied.decodedStreamBytes.reduce((a, b) => a + b, 0), 'decoded sizes differ');
  assert(JSON.stringify(compressible.geometryBytes) === JSON.stringify(varied.geometryBytes), 'geometry sizes differ');
  return {
    count: 1024,
    degree: 3,
    compressibleFileBytes: compressible.compressedInputBytes,
    variedFileBytes: varied.compressedInputBytes,
    fileSizeRatio: varied.compressedInputBytes / compressible.compressedInputBytes,
    eachDecodedStreamBytes: varied.decodedStreamBytes.reduce((a, b) => a + b, 0),
    eachOutputGeometryBytes: Object.values(varied.geometryBytes).reduce((a, b) => a + b, 0),
  };
});

test('candidate gate refuses compressed and reachable bytes as target-device peak acceptance', () => {
  const row = rows.find(x => x.name === 'd3-varied-1024.spz');
  const result = validateThreeR186SpzLoaderMemoryEvidenceR41({ count: row.count, shDegree: 3, compressedInputBytes: row.compressedInputBytes, measuredPerLoadReachableArrays: row.measuredPerLoadReachableArrays });
  for (const missing of ['zstd-wasm-peak-missing', 'browser-process-peak-missing', 'target-device-load-test-missing']) assert(result.errors.includes(missing), JSON.stringify(result));
  return result;
});

const report = {
  schema: 'kaopu-gaussian-spz-loader-memory-probe/r41',
  status: failures.length ? 'Candidate-fail' : 'Candidate-pass',
  sourceLocks: { three: '148ef33ecb6d2502ff796d4554abd1549c95d519', spz: 'affd0ecea7fbb4c265ee119475af7ee5b2997482' },
  testsRun: tests.length,
  failures,
  formulas: {
    rawDecodedStreamBytesPerSplatByShDegree: { 0: 20, 1: 29, 2: 44, 3: 65 },
    outputGeometryBytesPerSplatByShDegree: { 0: 40, 1: 52, 2: 68, 3: 92 },
    sharedLoaderLookupTablesBytes: 9472,
  },
  rows,
  tests,
  evidenceLimits: {
    actualNianticV4EncoderExecuted: true,
    actualThreePublicParseExecuted: true,
    actualThreeParseRawV4WithRealZstdDecodeExecuted: true,
    concurrentJsArrayBuffersRetainedByTracingWrapper: true,
    zstdWasmAllocatorPeakMeasured: false,
    fetchOrFileLoaderCopiesMeasured: false,
    browserProcessPeakMeasured: false,
    gaussianSplatConstructorOverlapMeasured: false,
    userPhotosAvailable: false,
    targetDeviceTested: false,
    humanAcceptancePerformed: false,
  },
  interpretation: 'The probe establishes a fixed-source concurrent JS ArrayBuffer lower bound during SPZ v4 parsing. It does not establish ZSTD WASM, fetch, browser, constructor-overlap, GPU, or device peak memory.',
  frozenR1Changed: false,
  productionMotherChanged: false,
};

console.log(JSON.stringify(report, null, 2));
if (failures.length) process.exitCode = 1;
