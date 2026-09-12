const SPZ_RAW_STREAM_BYTES_PER_SPLAT = Object.freeze([20, 29, 44, 65]);
const THREE_GEOMETRY_BYTES_PER_SPLAT = Object.freeze([40, 52, 68, 92]);
const THREE_SPZ_LOADER_LUT_BYTES = 9_472;

function expectedThreeR186SpzV4LoaderBytesR41(count, shDegree, compressedInputBytes) {
  if (!Number.isSafeInteger(count) || count < 0) throw new Error('count must be a non-negative safe integer');
  if (!Number.isInteger(shDegree) || shDegree < 0 || shDegree > 3) throw new Error('shDegree must be 0..3');
  if (!Number.isSafeInteger(compressedInputBytes) || compressedInputBytes < 0) throw new Error('compressedInputBytes must be a non-negative safe integer');
  const decodedStreams = count * SPZ_RAW_STREAM_BYTES_PER_SPLAT[shDegree];
  const outputGeometry = count * THREE_GEOMETRY_BYTES_PER_SPLAT[shDegree];
  const perLoadReachableArrays = compressedInputBytes + decodedStreams + outputGeometry;
  return {
    count,
    shDegree,
    compressedInputBytes,
    decodedStreams,
    outputGeometry,
    perLoadReachableArrays,
    sharedModuleLookupTables: THREE_SPZ_LOADER_LUT_BYTES,
    concurrentJsArrayBufferLowerBound: perLoadReachableArrays + THREE_SPZ_LOADER_LUT_BYTES,
    excluded: ['ZSTD WebAssembly memory and allocator high-water mark', 'FileLoader/fetch/network copies', 'Promise and JS object overhead', 'subsequent GaussianSplat constructor buffers', 'GPU allocations', 'browser/OS process overhead'],
  };
}

function validateThreeR186SpzLoaderMemoryEvidenceR41({ count, shDegree, compressedInputBytes, measuredPerLoadReachableArrays, wasmPeakBytes, browserPeakBytes, targetDeviceTested = false } = {}) {
  const expected = expectedThreeR186SpzV4LoaderBytesR41(count, shDegree, compressedInputBytes);
  const errors = [];
  if (measuredPerLoadReachableArrays !== expected.perLoadReachableArrays) errors.push('reachable-array-byte-mismatch');
  if (!Number.isFinite(wasmPeakBytes)) errors.push('zstd-wasm-peak-missing');
  if (!Number.isFinite(browserPeakBytes)) errors.push('browser-process-peak-missing');
  if (targetDeviceTested !== true) errors.push('target-device-load-test-missing');
  return {
    status: errors.length ? 'Candidate-incomplete' : 'Candidate-device-load-evidence-complete',
    expected,
    errors,
    warning: 'Compressed file bytes and concurrent JS ArrayBuffers do not bound ZSTD WASM, fetch, browser, constructor, GPU, or process peak memory.',
  };
}

export {
  SPZ_RAW_STREAM_BYTES_PER_SPLAT,
  THREE_GEOMETRY_BYTES_PER_SPLAT,
  THREE_SPZ_LOADER_LUT_BYTES,
  expectedThreeR186SpzV4LoaderBytesR41,
  validateThreeR186SpzLoaderMemoryEvidenceR41,
};
