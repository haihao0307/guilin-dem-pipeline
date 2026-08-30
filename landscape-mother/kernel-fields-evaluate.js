(() => {
'use strict';
const {
  TAU, clamp, smoothstep, fbm2, ridged2, nearestWaterDistance,
  parcelGrammar, anchorEnvelope,
} = window.LandscapeMotherKernelCore;

function createFieldContext(denseTruth, grid, spacing, subdivision, manifest, contract, segments, blurs) {
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
    denseTruth, grid, spacing, subdivision, manifest, contract, segments, blurs, arrays,
    minimum, maximum, elevationRange: Math.max(1, maximum - minimum),
    centerE: manifest.center[0], centerN: manifest.center[1], side: manifest.sideM,
    seeds: contract.seeds,
    stats: { surfaceMin: Infinity, surfaceMax: -Infinity, fieldMin: Infinity, fieldMax: -Infinity, paddySum: 0 },
  };
}

function evaluatePoint(context, row, column) {
  const { denseTruth, grid, spacing, subdivision, segments, blurs, arrays, seeds } = context;
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
  const gx = (right - left) / dx;
  const gz = (bottom - top) / dz;
  const slopeDegrees = Math.atan(Math.hypot(gx, gz)) * 180 / Math.PI;
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
  const rockMask = clamp(
    smoothstep(0.21, 0.72, slopeNorm) * 0.72 +
    ridge * 0.36 + smoothstep(0.16, 0.68, curvatureValue) * 0.18,
    0, 1,
  );
  const alluvialMask = clamp(lowland * (0.54 + wetness * 0.46) * (1 - rockMask), 0, 1);

  const parcel = parcelGrammar(easting, northing, seeds.field);
  const fieldPatch = smoothstep(
    0.18, 0.72,
    fbm2(easting * 0.0025, northing * 0.0025, seeds.field + 401, 4) * 0.5 + 0.5,
  );
  const paddyMask = clamp(
    lowland * flat * (0.46 + wetness * 0.54) * (0.54 + fieldPatch * 0.46) *
    (1 - waterCore) * (1 - rockMask),
    0, 1,
  );
  const bundMask = paddyMask * parcel.boundary;
  const ditchMask = paddyMask * parcel.ditch * (1 - parcel.boundary * 0.44);

  const fractureA = ridged2(easting * 0.019, northing * 0.019, seeds.fracture, 4);
  const fractureB = ridged2(easting * 0.051 + 9.2, northing * 0.051 - 4.7, seeds.fracture + 331, 3);
  const fractureMask = smoothstep(0.66, 0.93, fractureA * 0.64 + fractureB * 0.36) * rockMask;
  const strataPhase = (
    truth * 0.078 + easting * 0.0105 + northing * 0.0048 +
    fbm2(easting * 0.006, northing * 0.006, seeds.strata, 3) * 1.5
  ) * TAU;
  const strataMask = Math.pow(1 - Math.abs(Math.sin(strataPhase)), 3.2) * rockMask;
  const rill = smoothstep(
    0.61, 0.91,
    ridged2(easting * 0.033, northing * 0.033, seeds.moisture + 71, 4),
  ) * rockMask * wetness;
  const sedimentMask = clamp(
    alluvialMask * (0.38 + wetness * 0.34 + concavity * 0.28) +
    smoothstep(0.18, 0.62, -curvatureValue) * (1 - rockMask) * 0.18,
    0, 1,
  );

  const envelope = anchorEnvelope(column, row, subdivision);
  const meso = (ridged2(easting * 0.015, northing * 0.015, seeds.shape, 5) - 0.53) * 0.74;
  const micro = (ridged2(easting * 0.061, northing * 0.061, seeds.shape + 991, 4) - 0.51) * 0.28;
  const profileRecurve = clamp((ridge - valley) * 0.42 + curvatureValue * 0.31, -0.45, 0.45);
  const rockRelief = envelope * rockMask * (
    meso + micro + strataMask * 0.30 - fractureMask * 0.46 - rill * 0.18 + profileRecurve
  );
  const soilRelief = envelope * (1 - rockMask) * (
    fbm2(easting * 0.085, northing * 0.085, seeds.sediment, 3) * 0.055 - sedimentMask * 0.025
  );
  const surface = clamp(
    rockRelief + soilRelief,
    -context.contract.displacementBudget.surfaceMaxAbsM,
    context.contract.displacementBudget.surfaceMaxAbsM,
  );

  const terraceStep = 0.24 + parcel.unitSeed * 0.13;
  const terraceTarget = Math.round(truth / terraceStep) * terraceStep;
  const flatten = clamp((terraceTarget - truth) * 0.30, -0.10, 0.10);
  const field = clamp(
    envelope * (
      paddyMask * flatten + bundMask * (0.25 + parcel.unitSeed * 0.15) -
      ditchMask * (0.16 + parcel.unitSeed * 0.10)
    ),
    -context.contract.displacementBudget.fieldMaxAbsM,
    context.contract.displacementBudget.fieldMaxAbsM,
  );
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

  const stats = context.stats;
  stats.surfaceMin = Math.min(stats.surfaceMin, surface);
  stats.surfaceMax = Math.max(stats.surfaceMax, surface);
  stats.fieldMin = Math.min(stats.fieldMin, field);
  stats.fieldMax = Math.max(stats.fieldMax, field);
  stats.paddySum += paddyMask;
}

window.LandscapeMotherFieldEvaluator = Object.freeze({ createFieldContext, evaluatePoint });
})();
