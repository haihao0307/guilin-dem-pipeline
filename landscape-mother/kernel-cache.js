(() => {
'use strict';
const { fbm2, ridged2, clamp } = window.LandscapeMotherKernelCore;

function buildFormationCache(manifest, contract, grid = 161) {
  const arrays = {};
  for (const name of [
    'shape', 'shapeFine', 'fractureA', 'fractureB', 'strataNoise',
    'moistureRidge', 'sedimentNoise', 'fieldPatch', 'fieldWarpX',
    'fieldWarpZ', 'fieldAngle',
  ]) arrays[name] = new Float32Array(grid * grid);
  const side = manifest.sideM;
  const spacing = side / (grid - 1);
  const centerE = manifest.center[0];
  const centerN = manifest.center[1];
  const seeds = contract.seeds;

  for (let row = 0; row < grid; row += 1) {
    const z = row * spacing - side * 0.5;
    const northing = centerN - z;
    for (let column = 0; column < grid; column += 1) {
      const x = column * spacing - side * 0.5;
      const easting = centerE + x;
      const index = row * grid + column;
      arrays.shape[index] = ridged2(easting * 0.015, northing * 0.015, seeds.shape, 5);
      arrays.shapeFine[index] = ridged2(easting * 0.061, northing * 0.061, seeds.shape + 991, 4);
      arrays.fractureA[index] = ridged2(easting * 0.019, northing * 0.019, seeds.fracture, 4);
      arrays.fractureB[index] = ridged2(easting * 0.051 + 9.2, northing * 0.051 - 4.7, seeds.fracture + 331, 3);
      arrays.strataNoise[index] = fbm2(easting * 0.006, northing * 0.006, seeds.strata, 3);
      arrays.moistureRidge[index] = ridged2(easting * 0.033, northing * 0.033, seeds.moisture + 71, 4);
      arrays.sedimentNoise[index] = fbm2(easting * 0.085, northing * 0.085, seeds.sediment, 3);
      arrays.fieldPatch[index] = fbm2(easting * 0.0025, northing * 0.0025, seeds.field + 401, 4) * 0.5 + 0.5;
      arrays.fieldWarpX[index] = fbm2(easting * 0.0022, northing * 0.0022, seeds.field + 31, 4);
      arrays.fieldWarpZ[index] = fbm2(easting * 0.0022 + 7.4, northing * 0.0022 - 5.1, seeds.field + 73, 4);
      arrays.fieldAngle[index] = fbm2(easting * 0.00061, northing * 0.00061, seeds.field + 91, 3);
    }
  }
  return { grid, spacing, side, arrays };
}

function sample(cache, array, x, z) {
  const gx = clamp((x + cache.side * 0.5) / cache.spacing, 0, cache.grid - 1);
  const gz = clamp((z + cache.side * 0.5) / cache.spacing, 0, cache.grid - 1);
  const x0 = Math.floor(gx);
  const z0 = Math.floor(gz);
  const x1 = Math.min(cache.grid - 1, x0 + 1);
  const z1 = Math.min(cache.grid - 1, z0 + 1);
  const tx = gx - x0;
  const tz = gz - z0;
  const a = array[z0 * cache.grid + x0];
  const b = array[z0 * cache.grid + x1];
  const c = array[z1 * cache.grid + x0];
  const d = array[z1 * cache.grid + x1];
  const top = a + (b - a) * tx;
  const bottom = c + (d - c) * tx;
  return top + (bottom - top) * tz;
}

window.LandscapeMotherFormationCache = Object.freeze({ buildFormationCache, sample });
})();
