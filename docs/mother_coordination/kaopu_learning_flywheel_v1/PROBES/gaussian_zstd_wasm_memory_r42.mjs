import fs from 'node:fs';
import path from 'node:path';
import { validateThreeR186ZstdWasmEvidenceR42 } from '../ADAPTERS/gaussian_zstd_wasm_gate_r42.mjs';

const threeRoot = process.env.THREE_R186_ROOT;
const fixtureDir = process.argv[2];
if (!threeRoot || !fixtureDir) throw new Error('usage: THREE_R186_ROOT=... node gaussian_zstd_wasm_memory_r42.mjs <fixture-dir>');

const decoderPath = path.join(threeRoot, 'examples/jsm/libs/zstddec.module.js');
const pinnedSource = fs.readFileSync(decoderPath, 'utf8');
const exportNeedle = 'export{Q as ZSTDDecoder};';
if (!pinnedSource.includes(exportNeedle)) throw new Error('fixed r186 decoder export shape changed');

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

async function instrumentedModule(id) {
  const source = pinnedSource.replace(exportNeedle, `${exportNeedle}export function __memoryBytes(){return I?.exports?.memory?.buffer?.byteLength??0}`) + `\n//# sourceURL=kaopu-zstd-r42-${id}.mjs`;
  return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
}
function xorshiftByteSequenceMatches(bytes) {
  let state = 0x42c0ffee;
  for (let i = 0; i < bytes.length; i++) {
    state ^= state << 13; state >>>= 0;
    state ^= state >>> 17; state >>>= 0;
    state ^= state << 5; state >>>= 0;
    if (bytes[i] !== (state & 0xff)) return false;
  }
  return true;
}
function exactBytes(name) {
  const b = fs.readFileSync(path.join(fixtureDir, name));
  return new Uint8Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
}
async function isolatedDecode(id, fixtureName, rawBytes, pattern) {
  const module = await instrumentedModule(id);
  const decoder = new module.ZSTDDecoder();
  const beforeInit = module.__memoryBytes();
  await decoder.init();
  const afterInit = module.__memoryBytes();
  const compressed = exactBytes(fixtureName);
  const output = decoder.decode(compressed, rawBytes);
  const afterDecode = module.__memoryBytes();
  const valid = pattern === 'zero' ? output.every(value => value === 0) : xorshiftByteSequenceMatches(output);
  return { module, decoder, beforeInit, afterInit, afterDecode, compressedBytes: compressed.byteLength, outputBytes: output.byteLength, outputVerified: valid };
}

const oneMiB = 1024 * 1024;
const twentyFourMiB = 24 * 1024 * 1024;
const small = await isolatedDecode('small', 'small-varied.zst', oneMiB, 'varied');
const largeZero = await isolatedDecode('large-zero', 'large-zero.zst', twentyFourMiB, 'zero');
const largeVaried = await isolatedDecode('large-varied', 'large-varied.zst', twentyFourMiB, 'varied');
let repeatedSmallAfterLarge;

await testAsync('fixed decoder initializes one 16 MiB WebAssembly linear memory', async () => {
  for (const row of [small, largeZero, largeVaried]) {
    assert(row.beforeInit === 0, JSON.stringify(row));
    assert(row.afterInit === 16 * 1024 * 1024, JSON.stringify(row));
  }
  return { initialBytes: small.afterInit, initialMiB: small.afterInit / oneMiB, wasmPageBytes: 65536 };
});

test('actual decoded outputs match the zero and deterministic-varied sources', () => {
  for (const row of [small, largeZero, largeVaried]) assert(row.outputVerified, JSON.stringify(row));
  return [small, largeZero, largeVaried].map(({ compressedBytes, outputBytes, outputVerified }) => ({ compressedBytes, outputBytes, outputVerified }));
});

test('same 24 MiB output size reaches different retained WASM capacities by compressed input size', () => {
  assert(largeZero.outputBytes === largeVaried.outputBytes, 'raw outputs differ in size');
  assert(largeZero.compressedBytes < largeVaried.compressedBytes, 'compression control failed');
  assert(largeZero.afterDecode < largeVaried.afterDecode, JSON.stringify({ largeZero, largeVaried }));
  return {
    rawOutputBytes: largeZero.outputBytes,
    zeroCompressedBytes: largeZero.compressedBytes,
    variedCompressedBytes: largeVaried.compressedBytes,
    zeroRetainedWasmBytes: largeZero.afterDecode,
    variedRetainedWasmBytes: largeVaried.afterDecode,
  };
});

await testAsync('freed decode allocations do not shrink WebAssembly.Memory and a new decoder shares the module high-water mark', async () => {
  const module = largeVaried.module;
  const highWater = module.__memoryBytes();
  const secondDecoder = new module.ZSTDDecoder();
  await secondDecoder.init();
  const afterSecondInit = module.__memoryBytes();
  const output = secondDecoder.decode(exactBytes('small-varied.zst'), oneMiB);
  const afterSmallDecode = module.__memoryBytes();
  repeatedSmallAfterLarge = { highWaterBytes: highWater, afterSecondDecoderInitBytes: afterSecondInit, afterSmallDecodeBytes: afterSmallDecode };
  assert(xorshiftByteSequenceMatches(output), 'small repeat output mismatch');
  assert(afterSecondInit === highWater, `${afterSecondInit} != ${highWater}`);
  assert(afterSmallDecode === highWater, `${afterSmallDecode} != ${highWater}`);
  return { highWaterBytes: highWater, afterSecondDecoderInitBytes: afterSecondInit, afterSmallDecodeBytes: afterSmallDecode, sharedModuleInstance: true };
});

test('candidate gate keeps WASM capacity separate from Safari and process peak', () => {
  const result = validateThreeR186ZstdWasmEvidenceR42({ initialBytes: largeVaried.afterInit, afterLargeDecodeBytes: largeVaried.afterDecode, afterSmallDecodeBytes: largeVaried.afterDecode, outputVerified: true });
  assert(result.errors.includes('safari-wasm-memory-missing'), JSON.stringify(result));
  assert(result.errors.includes('browser-process-peak-missing'), JSON.stringify(result));
  return result;
});

const report = {
  schema: 'kaopu-gaussian-zstd-wasm-memory-probe/r42',
  status: failures.length ? 'Candidate-fail' : 'Candidate-pass',
  sourceLocks: { three: '148ef33ecb6d2502ff796d4554abd1549c95d519' },
  testsRun: tests.length,
  failures,
  fixtures: {
    smallVaried: { compressedBytes: small.compressedBytes, rawBytes: small.outputBytes },
    largeZero: { compressedBytes: largeZero.compressedBytes, rawBytes: largeZero.outputBytes },
    largeVaried: { compressedBytes: largeVaried.compressedBytes, rawBytes: largeVaried.outputBytes },
  },
  observations: {
    initialWasmBytes: small.afterInit,
    afterSmallVariedBytes: small.afterDecode,
    afterLargeZeroBytes: largeZero.afterDecode,
    afterLargeVariedBytes: largeVaried.afterDecode,
    largeVariedRetainedAfterSmallDecodeBytes: repeatedSmallAfterLarge.afterSmallDecodeBytes,
  },
  tests,
  evidenceLimits: {
    fixedThreeDecoderExecuted: true,
    decoderSourceInstrumentedInMemoryToExposePrivateWasmCapacity: true,
    decodedBytesVerified: true,
    actualSpzContainerParsedThisCycle: false,
    liveWasmAllocationsMeasured: false,
    javascriptHeapMeasured: false,
    browserProcessPeakMeasured: false,
    safariOrIphoneTested: false,
    gpuTested: false,
    userPhotosAvailable: false,
    humanAcceptancePerformed: false,
  },
  interpretation: 'WebAssembly.Memory byteLength records retained module capacity/high-water behavior, not live allocations or total process peak. Synthetic ZSTD streams isolate decoder behavior and are not real-asset statistics.',
  frozenR1Changed: false,
  productionMotherChanged: false,
};

console.log(JSON.stringify(report, null, 2));
if (failures.length) process.exitCode = 1;
