(() => {
'use strict';
const { boxBlur, buildNormals } = window.LandscapeMotherKernelCore;
const { buildFormationCache } = window.LandscapeMotherFormationCache;
const { createFieldContext, evaluatePoint, cellEnvelope } = window.LandscapeMotherFieldEvaluator;

function balanceSourceCells(arrays, denseTruth, grid, subdivision) {
  const sourceCells = (grid - 1) / subdivision;
  for (let sourceRow = 0; sourceRow < sourceCells; sourceRow += 1) {
    for (let sourceColumn = 0; sourceColumn < sourceCells; sourceColumn += 1) {
      const startRow = sourceRow * subdivision;
      const startColumn = sourceColumn * subdivision;
      let sum = 0;
      let weightSum = 0;
      for (let localRow = 1; localRow < subdivision; localRow += 1) {
        for (let localColumn = 1; localColumn < subdivision; localColumn += 1) {
          const row = startRow + localRow;
          const column = startColumn + localColumn;
          const index = row * grid + column;
          const weight = cellEnvelope(column, row, subdivision);
          sum += arrays.displacement[index];
          weightSum += weight;
        }
      }
      const correction = weightSum > 1e-9 ? sum / weightSum : 0;
      for (let localRow = 1; localRow < subdivision; localRow += 1) {
        for (let localColumn = 1; localColumn < subdivision; localColumn += 1) {
          const row = startRow + localRow;
          const column = startColumn + localColumn;
          const index = row * grid + column;
          const amount = correction * cellEnvelope(column, row, subdivision);
          arrays.surfaceDelta[index] -= amount;
          arrays.displacement[index] -= amount;
        }
      }
    }
  }
  for (let index = 0; index < arrays.enhanced.length; index += 1) {
    arrays.enhanced[index] = denseTruth[index] + arrays.displacement[index];
  }
}

function deriveFields(denseTruth, grid, spacing, subdivision, manifest, contract, segments) {
  const blurs = {
    small: boxBlur(denseTruth, grid, grid, Math.max(1, subdivision)),
    medium: boxBlur(denseTruth, grid, grid, Math.max(2, subdivision * 4)),
    broad: boxBlur(denseTruth, grid, grid, Math.max(4, subdivision * 12)),
  };
  const cache = buildFormationCache(manifest, contract, 161);
  const context = createFieldContext(
    denseTruth, grid, spacing, subdivision, manifest, contract, segments, blurs, cache,
  );
  for (let row = 0; row < grid; row += 1) {
    for (let column = 0; column < grid; column += 1) evaluatePoint(context, row, column);
  }

  const arrays = context.arrays;
  balanceSourceCells(arrays, denseTruth, grid, subdivision);
  const truthNormals = buildNormals(denseTruth, grid, spacing);
  const enhancedNormals = buildNormals(arrays.enhanced, grid, spacing);
  const macroBlur = boxBlur(arrays.displacement, grid, grid, Math.max(2, subdivision * 4));
  let macroBlurMaxAbs = 0;
  for (const value of macroBlur) macroBlurMaxAbs = Math.max(macroBlurMaxAbs, Math.abs(value));

  let sourceNodeMaxError = 0;
  let surfaceMin = Infinity;
  let surfaceMax = -Infinity;
  let fieldMin = Infinity;
  let fieldMax = -Infinity;
  for (let index = 0; index < arrays.displacement.length; index += 1) {
    surfaceMin = Math.min(surfaceMin, arrays.surfaceDelta[index]);
    surfaceMax = Math.max(surfaceMax, arrays.surfaceDelta[index]);
    fieldMin = Math.min(fieldMin, arrays.fieldDelta[index]);
    fieldMax = Math.max(fieldMax, arrays.fieldDelta[index]);
  }
  for (let row = 0; row < grid; row += subdivision) {
    for (let column = 0; column < grid; column += subdivision) {
      const index = row * grid + column;
      sourceNodeMaxError = Math.max(sourceNodeMaxError, Math.abs(arrays.enhanced[index] - denseTruth[index]));
    }
  }

  let sourceCellMeanAbsDelta = 0;
  let sourceCellCount = 0;
  for (let sourceRow = 0; sourceRow < manifest.truth.grid[1] - 1; sourceRow += 1) {
    for (let sourceColumn = 0; sourceColumn < manifest.truth.grid[0] - 1; sourceColumn += 1) {
      let sum = 0;
      let samples = 0;
      const startRow = sourceRow * subdivision;
      const startColumn = sourceColumn * subdivision;
      for (let localRow = 0; localRow <= subdivision; localRow += 1) {
        for (let localColumn = 0; localColumn <= subdivision; localColumn += 1) {
          sum += arrays.displacement[(startRow + localRow) * grid + startColumn + localColumn];
          samples += 1;
        }
      }
      sourceCellMeanAbsDelta = Math.max(sourceCellMeanAbsDelta, Math.abs(sum / samples));
      sourceCellCount += 1;
    }
  }

  let truthPeakIndex = 0;
  let enhancedPeakIndex = 0;
  for (let index = 1; index < denseTruth.length; index += 1) {
    if (denseTruth[index] > denseTruth[truthPeakIndex]) truthPeakIndex = index;
    if (arrays.enhanced[index] > arrays.enhanced[enhancedPeakIndex]) enhancedPeakIndex = index;
  }
  const truthPeakColumn = truthPeakIndex % grid;
  const truthPeakRow = Math.floor(truthPeakIndex / grid);
  const enhancedPeakColumn = enhancedPeakIndex % grid;
  const enhancedPeakRow = Math.floor(enhancedPeakIndex / grid);
  const peakShiftM = Math.hypot(
    enhancedPeakColumn - truthPeakColumn,
    enhancedPeakRow - truthPeakRow,
  ) * spacing;

  return {
    minimum: context.minimum,
    maximum: context.maximum,
    truthNormals,
    enhancedNormals,
    enhanced: arrays.enhanced,
    displacement: arrays.displacement,
    surfaceDelta: arrays.surfaceDelta,
    fieldDelta: arrays.fieldDelta,
    fields: {
      slope: arrays.slope, curvature: arrays.curvature, tpi: arrays.tpi,
      rock: arrays.rock, paddy: arrays.paddy, wet: arrays.wet,
      alluvium: arrays.alluvium, bund: arrays.bund, ditch: arrays.ditch,
      fracture: arrays.fracture, strata: arrays.strata, flow: arrays.flow,
      sediment: arrays.sediment, unitSeed: arrays.unitSeed,
    },
    receipt: {
      surfaceRangeM: [surfaceMin, surfaceMax],
      fieldRangeM: [fieldMin, fieldMax],
      sourceNodeMaxErrorM: sourceNodeMaxError,
      sourceCellMeanMaxAbsDeltaM: sourceCellMeanAbsDelta,
      sourceCellCount,
      macroBlurMaxAbsDeltaM: macroBlurMaxAbs,
      peakShiftM,
      paddyCoverage: context.stats.paddySum / denseTruth.length,
    },
  };
}

window.LandscapeMotherKernelFields = Object.freeze({ deriveFields });
})();
