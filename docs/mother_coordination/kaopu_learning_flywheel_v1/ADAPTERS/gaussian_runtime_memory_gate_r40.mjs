const SH_CUMULATIVE_BYTES_PER_SPLAT = Object.freeze([0, 12, 28, 52]);
const CONSTRUCTOR_FIXED_BYTES = 65_596;

function expectedThreeR186CpuVisibleBytesR40(count, shDegree, { webgpuShContribution = false } = {}) {
  if (!Number.isSafeInteger(count) || count < 0) throw new Error('count must be a non-negative safe integer');
  if (!Number.isInteger(shDegree) || shDegree < 0 || shDegree > 3) throw new Error('shDegree must be 0..3');

  const sourceGeometry = count * (40 + SH_CUMULATIVE_BYTES_PER_SPLAT[shDegree]);
  const constructorStorageCopies = count * 52;
  const countingSort = count * 12 + 65_536;
  const drawGeometry = 60;
  const lazyWebgpuShContribution = webgpuShContribution && shDegree > 0 ? count * 16 : 0;

  return {
    count,
    shDegree,
    sourceGeometry,
    constructorStorageCopies,
    countingSort,
    drawGeometry,
    lazyWebgpuShContribution,
    total: sourceGeometry + constructorStorageCopies + countingSort + drawGeometry + lazyWebgpuShContribution,
    bytesPerSplatExcludingFixed: 104 + SH_CUMULATIVE_BYTES_PER_SPLAT[shDegree] + (lazyWebgpuShContribution ? 16 : 0),
    fixedBytes: CONSTRUCTOR_FIXED_BYTES,
  };
}

function validateThreeR186RuntimeMemoryEvidenceR40({
  count,
  shDegree,
  measuredCpuVisibleBytes,
  targetDevicePeakBytes,
  gpuAllocationBytes,
  loaderPeakBytes,
  humanAcceptance,
} = {}) {
  const expected = expectedThreeR186CpuVisibleBytesR40(count, shDegree);
  const errors = [];
  if (measuredCpuVisibleBytes !== expected.total) errors.push('cpu-visible-constructor-byte-mismatch');
  if (!Number.isFinite(targetDevicePeakBytes)) errors.push('target-device-peak-memory-missing');
  if (!Number.isFinite(gpuAllocationBytes)) errors.push('backend-gpu-allocation-missing');
  if (!Number.isFinite(loaderPeakBytes)) errors.push('loader-decompression-peak-missing');
  if (humanAcceptance !== true) errors.push('human-acceptance-missing');
  return {
    status: errors.length ? 'Candidate-incomplete' : 'Candidate-device-evidence-complete',
    expected,
    errors,
    warning: 'CPU-visible TypedArray bytes are a reproducible lower bound, not process, browser, GPU, loader, or device peak memory.',
  };
}

export {
  CONSTRUCTOR_FIXED_BYTES,
  SH_CUMULATIVE_BYTES_PER_SPLAT,
  expectedThreeR186CpuVisibleBytesR40,
  validateThreeR186RuntimeMemoryEvidenceR40,
};
