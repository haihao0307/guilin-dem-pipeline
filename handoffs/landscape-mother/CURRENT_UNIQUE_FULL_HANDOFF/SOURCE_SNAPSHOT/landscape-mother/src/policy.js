/* Numeric contracts only. No renderer dependency, image assets or texture access. */
(function install(root) {
'use strict';
const VERSION = '2026-08-31';
function requireValue(condition, message) {
  if (!condition) throw new Error(`PURE_NUMERIC_GATE: ${message}`);
}
function validateContract(contract) {
  const runtime = contract?.runtime;
  const rules = contract?.rules;
  requireValue(runtime?.topology === 'fixed-full-grid', 'one fixed complete topology is required');
  requireValue(!Object.prototype.hasOwnProperty.call(contract, 'runtimeTiers'), 'quality-dependent geometry is forbidden');
  for (const name of ['lodEnabled', 'textureSamplingEnabled', 'geometryCameraDependent', 'geometryDeviceDependent', 'motionQualitySwitching']) {
    requireValue(rules?.[name] === false, `${name} must be explicitly false`);
  }
  const sample = contract?.sample;
  requireValue(Number.isInteger(sample?.fixedSubdivision) && sample.fixedSubdivision >= 1, 'fixedSubdivision must be a positive integer');
  for (const name of ['desktopSubdivision', 'mobileSubdivision', 'desktopRenderGrid', 'mobileRenderGrid']) {
    requireValue(!Object.prototype.hasOwnProperty.call(sample, name), `device-specific geometry setting ${name} is forbidden`);
  }
  requireValue(runtime.triangleStride === 1, 'no grid nodes may be skipped');
  requireValue(runtime.materialMultiplier === 1, 'material detail may not silently change with runtime mode');
  requireValue(Number.isFinite(runtime.maxDpr) && runtime.maxDpr > 0, 'a fixed framebuffer policy is required');
  requireValue(contract.displacementBudget?.sourceNodeMaxErrorM === 0, 'source-node error budget must be zero');
  requireValue(contract.displacementBudget?.peakShiftMaxM === 0, 'peak-shift budget must be zero');
  return true;
}
function buildGridIndices(grid) {
  requireValue(Number.isSafeInteger(grid) && grid >= 2, 'invalid grid');
  const count = (grid - 1) * (grid - 1) * 6;
  requireValue(Number.isSafeInteger(count) && grid * grid <= 0xffffffff, 'grid exceeds index range');
  requireValue(count * 4 <= 512 * 1024 * 1024, 'index allocation exceeds explicit working budget; no automatic coarsening');
  const result = new Uint32Array(count);
  let offset = 0;
  for (let row = 0; row < grid - 1; row += 1) {
    for (let column = 0; column < grid - 1; column += 1) {
      const a = row * grid + column;
      const b = a + 1;
      const c = a + grid;
      const d = c + 1;
      result[offset++] = a; result[offset++] = c; result[offset++] = b;
      result[offset++] = b; result[offset++] = c; result[offset++] = d;
    }
  }
  return result;
}
function indexSignature(indices) {
  // Fast diagnostic signature only. Source provenance continues to use SHA256.
  let hash = 2166136261;
  for (let i = 0; i < indices.length; i += 1) {
    const value = indices[i];
    for (let shift = 0; shift < 32; shift += 8) {
      hash = Math.imul(hash ^ ((value >>> shift) & 255), 16777619) >>> 0;
    }
  }
  return `fnv1a32:${hash.toString(16).padStart(8, '0')}`;
}
function auditRiverSegments(segments, sideM) {
  requireValue(Array.isArray(segments), 'river segments must be a numeric array');
  requireValue(Number.isFinite(sideM) && sideM > 0, 'invalid river scope');
  const nodes = new Map();
  let invalidSegments = 0;
  let heightDisagreementCount = 0;
  const keyOf = (x, z) => `${Object.is(x, -0) ? 0 : x}:${Object.is(z, -0) ? 0 : z}`;
  const touch = (x, y, z) => {
    const key = keyOf(x, z);
    if (!nodes.has(key)) nodes.set(key, { x, z, y, degree: 0, neighbors: new Set() });
    const node = nodes.get(key);
    if (node.y !== y) heightDisagreementCount += 1;
    node.degree += 1;
    return key;
  };
  for (const segment of segments) {
    const numbers = ['x0', 'y0', 'z0', 'x1', 'y1', 'z1'].map(name => segment[name]);
    if (!numbers.every(Number.isFinite) || (segment.x0 === segment.x1 && segment.z0 === segment.z1)) {
      invalidSegments += 1;
      continue;
    }
    const a = touch(segment.x0, segment.y0, segment.z0);
    const b = touch(segment.x1, segment.y1, segment.z1);
    nodes.get(a).neighbors.add(b); nodes.get(b).neighbors.add(a);
  }
  const seen = new Set();
  let componentCount = 0;
  for (const key of nodes.keys()) {
    if (seen.has(key)) continue;
    componentCount += 1;
    const stack = [key]; seen.add(key);
    while (stack.length) {
      const next = stack.pop();
      for (const neighbor of nodes.get(next).neighbors) {
        if (!seen.has(neighbor)) { seen.add(neighbor); stack.push(neighbor); }
      }
    }
  }
  const internalDegreeOneEndpoints = [];
  const boundaryEpsilon = 0.0001; // Classifies existing clipping endpoints; never changes coordinates.
  for (const [key, node] of nodes) {
    const onBoundary = Math.abs(Math.abs(node.x) - sideM / 2) <= boundaryEpsilon ||
      Math.abs(Math.abs(node.z) - sideM / 2) <= boundaryEpsilon;
    if (node.degree === 1 && !onBoundary) internalDegreeOneEndpoints.push(key);
  }
  return Object.freeze({
    method: 'exact-coordinate-segment-graph-diagnostic',
    segmentCount: segments.length,
    nodeCount: nodes.size,
    componentCount,
    invalidSegments,
    heightDisagreementCount,
    internalDegreeOneEndpoints,
    sourceIdsAndTerminiVerified: false,
    finalMeshContinuityVerified: false,
    visualGapCount: null,
    continuityPass: false,
    status: 'requires-source-topology-and-final-mesh-validation',
  });
}
function checkFrameInvariants(frames) {
  requireValue(Array.isArray(frames) && frames.length >= 2, 'multiple real observations are required');
  const first = frames[0];
  const keys = ['grid', 'spacing', 'indexSignature', 'triangleCount', 'materialMultiplier', 'maxDpr'];
  for (const frame of frames) for (const key of keys) {
    requireValue(frame[key] !== undefined && frame[key] !== null, `missing frame observation ${key}`);
    requireValue(frame[key] === first[key], `camera interaction changed ${key}`);
  }
  return true;
}
const api = Object.freeze({ version: VERSION, validateContract, buildGridIndices, indexSignature, auditRiverSegments, checkFrameInvariants });
if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (root) root.LandscapeMotherPureNumeric = api;
})(typeof window === 'undefined' ? null : window);
