function validateThreeR186ZstdWasmEvidenceR42({
  initialBytes,
  afterLargeDecodeBytes,
  afterSmallDecodeBytes,
  outputVerified = false,
  safariMeasured = false,
  processPeakMeasured = false,
} = {}) {
  const errors = [];
  if (!Number.isSafeInteger(initialBytes) || initialBytes <= 0) errors.push('initial-wasm-memory-missing');
  if (!Number.isSafeInteger(afterLargeDecodeBytes) || afterLargeDecodeBytes < initialBytes) errors.push('large-decode-wasm-memory-invalid');
  if (!Number.isSafeInteger(afterSmallDecodeBytes) || afterSmallDecodeBytes < afterLargeDecodeBytes) errors.push('post-small-decode-wasm-memory-invalid');
  if (outputVerified !== true) errors.push('decoded-output-verification-missing');
  if (safariMeasured !== true) errors.push('safari-wasm-memory-missing');
  if (processPeakMeasured !== true) errors.push('browser-process-peak-missing');
  return {
    status: errors.length ? 'Candidate-incomplete' : 'Candidate-device-evidence-complete',
    errors,
    warning: 'WebAssembly.Memory byteLength is a retained linear-memory capacity observation, not live allocations, JavaScript heap, GPU memory, or process peak.',
  };
}

export { validateThreeR186ZstdWasmEvidenceR42 };
