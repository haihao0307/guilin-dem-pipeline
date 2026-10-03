(() => {
'use strict';
const {
  TAU, clamp, smoothstep, hash2, worley2, nearestWaterDistance,
} = window.LandscapeMotherKernelCore;
const { sample } = window.LandscapeMotherFormationCache;
function cellEnvelope(column, row, subdivision) {
  const u = (column % subdivision) / subdivision;
  const v = (row % subdivision) / subdivision;
  const su = Math.sin(Math.PI * u);
  const sv = Math.sin(Math.PI * v);
  return su * su * sv * sv;
}

function createFieldContext(denseTruth, grid, spacing, subdivision, manifest, contract, segments, blurs, cache) {
  const count = denseTruth.length;
  const arrays = {};
  for (const name of [
    'slope', 'curvature', 'tpi', 'rock', 'paddy', 'wet', 'alluvium',
    'bund', 'ditch', 'fracture', 'strata', 'flow', 'sediment', 'unitSeed',
    'surfaceDelta', 'fieldDelta', 'displacement', 'enhanced',
  ]) arrays[name] = new Float32Array(count);
  let minimum = Infinity;
  let maximum = -Infinity;
  for (const value of denseTruth) {
    minimum = Math.min(minimum, value);
    maximum = Math.max(maximum, value);
  }
  return {
    denseTruth, grid, spacing, subdivision, manifest, contract, segments, blurs, cache, arrays,
    minimum, maximum, elevationRange: Math.max(1, maximum - minimum),
    centerE: manifest.center[0], centerN: manifest.center[1], side: manifest.sideM,
    seeds: contract.seeds,
    stats: { surfaceMin: Infinity, surfaceMax: -Infinity, fieldMin: Infinity, fieldMax: -Infinity, paddySum: 0 },
  };
}

function parcelAt(context, x, z, easting, northing) {
  const cache = context.cache;
  const warpX = sample(cache, cache.arrays.fieldWarpX, x, z) * 27;
  const warpZ = sample(cache, cache.arrays.fieldWarpZ, x, z) * 27;
  const angle = 0.29 + sample(cache, cache.arrays.fieldAngle, x, z) * 0.22;
  const ca = Math.cos(angle);
  const sa = Math.sin(angle);
  const rx = (easting + warpX) * ca + (northing + warpZ) * sa;
  const rz = -(easting + warpX) * sa + (northing + warpZ) * ca;
  const cellX = 70;
  const cellZ = 54;
  const cells = worley2(rx / cellX, rz / cellZ, context.seeds.field + 149);
  const boundary = 1 - smoothstep(0.028, 0.12, cells.edge);
  const unitSeed = hash2(cells.cellX, cells.cellZ, context.seeds.field + 277);
  const rowA = 1 - smoothstep(0.91, 0.997, Math.abs(Math.sin((rx + unitSeed * 117) * 0.061)));
  const rowB = 1 - smoothstep(0.925, 0.998, Math.abs(Math.sin((rz - unitSeed * 89) * 0.076)));
  return { boundary, unitSeed, ditch: Math.max(rowA, rowB * 0.64) };
}

function evaluatePoint(context, row, column) {
  const { denseTruth, grid, spacing, subdivision, segments, blurs, arrays, cache } = context;
  const index = row * grid + column;
  const truth = denseTruth[index];
  const leftColumn = Math.max(0, column - 1);
  const rightColumn = Math.min(grid - 1, column + 1);
  const topRow = Math.max(0, row - 1);
  const bottomRow = Math.min(grid - 1, row + 1);
  const left = denseTruth[row * grid + leftColumn];
  const right = denseTruth[row * grid + rightColumn];
  const top = denseTruth[topRow * grid + column];
  const bottom = denseTruth[bottomRow * grid + column];
  const dx = Math.max(spacing, (rightColumn - leftColumn) * spacing);
  const dz = Math.max(spacing, (bottomRow - topRow) * spacing);
  const slopeDegrees = Math.atan(Math.hypot((right - left) / dx, (bottom - top) / dz)) * 180 / Math.PI;
  const slopeNorm = clamp(slopeDegrees / 62);
  const curvatureValue = clamp((blurs.small[index] - blurs.medium[index]) / 8, -1, 1);
  const tpiValue = clamp((truth - blurs.broad[index]) / 44, -1, 1);
  const x = column * spacing - context.side * 0.5;
  const z = row * spacing - context.side * 0.5;
  const easting = context.centerE + x;
  const northing = context.centerN - z;

  const waterDistance = nearestWaterDistance(x, z, segments);
  const waterCore = 1 - smoothstep(3.5, 22, waterDistance);
  const waterInfluence = Math.exp(-waterDistance / 105);
  const elevationT = (truth - context.minimum) / context.elevationRange;
  const lowland = 1 - smoothstep(0.12, 0.54, elevationT);
  const flat = 1 - smoothstep(4.2, 12.5, slopeDegrees);
  const concavity = smoothstep(-0.05, 0.52, -curvatureValue);
  const ridge = smoothstep(0.12, 0.72, tpiValue) * smoothstep(0.10, 0.58, slopeNorm);
  const valley = smoothstep(0.08, 0.68, -tpiValue) * (0.54 + concavity * 0.46);
  const wetness = clamp(waterInfluence * 0.64 + valley * 0.22 + concavity * 0.18, 0, 1);
  const rockMask = clamp(smoothstep(0.21, 0.72, slopeNorm) * 0.72 + ridge * 0.36 + smoothstep(0.16, 0.68, curvatureValue) * 0.18, 0, 1);
  const alluvialMask = clamp(lowland * (0.54 + wetness * 0.46) * (1 - rockMask), 0, 1);

  const parcel = parcelAt(context, x, z, easting, northing);
  const fieldPatch = smoothstep(0.18, 0.72, sample(cache, cache.arrays.fieldPatch, x, z));
  const paddyMask = clamp(lowland * flat * (0.46 + wetness * 0.54) * (0.54 + fieldPatch * 0.46) * (1 - waterCore) * (1 - rockMask), 0, 1);
  const bundMask = paddyMask * parcel.boundary;
  const ditchMask = paddyMask * parcel.ditch * (1 - parcel.boundary * 0.44);

  const fractureMask = smoothstep(
    0.66, 0.93,
    sample(cache, cache.arrays.fractureA, x, z) * 0.64 +
    sample(cache, cache.arrays.fractureB, x, z) * 0.36,
  ) * rockMask;
  const strataPhase = (
    truth * 0.078 + easting * 0.0105 + northing * 0.0048 +
    sample(cache, cache.arrays.strataNoise, x, z) * 1.5
  ) * TAU;
  const strataMask = Math.pow(1 - Math.abs(Math.sin(strataPhase)), 3.2) * rockMask;
  const rill = smoothstep(0.61, 0.91, sample(cache, cache.arrays.moistureRidge, x, z)) * rockMask * wetness;
  const sedimentMask = clamp(alluvialMask * (0.38 + wetness * 0.34 + concavity * 0.28) + smoothstep(0.18, 0.62, -curvatureValue) * (1 - rockMask) * 0.18, 0, 1);

  const envelope = cellEnvelope(column, row, subdivision);
  const meso = (sample(cache, cache.arrays.shape, x, z) - 0.53) * 0.74;
  const micro = (sample(cache, cache.arrays.shapeFine, x, z) - 0.51) * 0.28;
  const profileRecurve = clamp((ridge - valley) * 0.42 + curvatureValue * 0.31, -0.45, 0.45);
  const rockRelief = envelope * rockMask * (meso + micro + strataMask * 0.30 - fractureMask * 0.46 - rill * 0.18 + profileRecurve) * 1.65;
  const soilRelief = envelope * (1 - rockMask) * (sample(cache, cache.arrays.sedimentNoise, x, z) * 0.055 - sedimentMask * 0.025);
  const surface = clamp(rockRelief + soilRelief, -context.contract.displacementBudget.surfaceMaxAbsM, context.contract.displacementBudget.surfaceMaxAbsM);

  const terraceStep = 0.24 + parcel.unitSeed * 0.13;
  const terraceTarget = Math.round(truth / terraceStep) * terraceStep;
  const flatten = clamp((terraceTarget - truth) * 0.30, -0.10, 0.10);
  const field = clamp(cellEnvelope(column, row, subdivision) * (paddyMask * flatten + bundMask * (0.25 + parcel.unitSeed * 0.15) - ditchMask * (0.16 + parcel.unitSeed * 0.10)), -context.contract.displacementBudget.fieldMaxAbsM, context.contract.displacementBudget.fieldMaxAbsM);
  const total = surface + field;

  arrays.slope[index] = slopeNorm;
  arrays.curvature[index] = curvatureValue;
  arrays.tpi[index] = tpiValue;
  arrays.rock[index] = rockMask;
  arrays.paddy[index] = paddyMask;
  arrays.wet[index] = wetness;
  arrays.alluvium[index] = alluvialMask;
  arrays.bund[index] = bundMask;
  arrays.ditch[index] = ditchMask;
  arrays.fracture[index] = fractureMask;
  arrays.strata[index] = strataMask;
  arrays.flow[index] = clamp(waterInfluence * 0.58 + rill * 0.30 + ditchMask * 0.42, 0, 1);
  arrays.sediment[index] = sedimentMask;
  arrays.unitSeed[index] = parcel.unitSeed;
  arrays.surfaceDelta[index] = surface;
  arrays.fieldDelta[index] = field;
  arrays.displacement[index] = total;
  arrays.enhanced[index] = truth + total;
  context.stats.paddySum += paddyMask;
}

window.LandscapeMotherFieldEvaluator = Object.freeze({ createFieldContext, evaluatePoint, cellEnvelope });
})();
