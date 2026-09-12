export const THREE_R186_BIN_COUNT = 4096;
export const THREE_R186_SORT_DIRECTION_THRESHOLD = 0.9995;

export function depthBinR39(depth, nearDepth, farDepth, binCount = THREE_R186_BIN_COUNT) {
  const range = Math.max(farDepth - nearDepth, 0.0001);
  const raw = Math.floor((depth - nearDepth) * (binCount - 1) / range);
  return Math.min(binCount - 1, Math.max(0, raw));
}

export function analyzeDepthBinsR39(depths, nearDepth, farDepth, binCount = THREE_R186_BIN_COUNT) {
  const bins = depths.map(depth => depthBinR39(depth, nearDepth, farDepth, binCount));
  const members = new Map();
  bins.forEach((bin, index) => {
    if (!members.has(bin)) members.set(bin, []);
    members.get(bin).push(index);
  });
  const nonEqualDepthCollisions = [];
  for (const [bin, indices] of members) {
    const values = indices.map(index => depths[index]);
    const span = Math.max(...values) - Math.min(...values);
    if (indices.length > 1 && span > 0) nonEqualDepthCollisions.push({ bin, indices, depthSpan: span });
  }
  return {
    bins,
    nominalDepthStep: (farDepth - nearDepth) / (binCount - 1),
    nonEqualDepthCollisions,
  };
}

export function validateGaussianSortingEvidenceR39({ depths, nearDepth, farDepth, fixedViewGpuCompared = false, targetDeviceTested = false }) {
  const analysis = analyzeDepthBinsR39(depths, nearDepth, farDepth);
  const errors = [];
  if (analysis.nonEqualDepthCollisions.length) errors.push('non-equal-depths-share-counting-sort-bin');
  if (!fixedViewGpuCompared) errors.push('fixed-view-gpu-sort-comparison-missing');
  if (!targetDeviceTested) errors.push('target-device-sort-evidence-missing');
  return { errors, analysis };
}

