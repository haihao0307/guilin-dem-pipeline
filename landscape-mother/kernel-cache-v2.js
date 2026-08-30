(() => {
'use strict';
const base = window.LandscapeMotherFormationCache;
const graph = window.ProceduralFieldReference;
if (!base || !graph) throw new Error('Landscape Mother V2 field graph dependencies are missing');

function buildFormationCache(manifest, contract, grid = 161) {
  const cache = base.buildFormationCache(manifest, contract, grid);
  const names = [
    'graphMacro', 'graphStructure', 'graphMicro', 'graphWeather',
    'graphCavity', 'graphProtrusion', 'graphSeparation', 'graphColorDriver',
  ];
  for (const name of names) cache.arrays[name] = new Float32Array(grid * grid);
  const seedBank = contract.seedBank || graph.deriveSeeds(contract.seeds?.shape || 1);
  const settings = contract.fieldGraph?.settings || {};
  for (let row = 0; row < grid; row += 1) {
    const z = row * cache.spacing - cache.side * 0.5;
    const northing = manifest.center[1] - z;
    for (let column = 0; column < grid; column += 1) {
      const x = column * cache.spacing - cache.side * 0.5;
      const easting = manifest.center[0] + x;
      const index = row * grid + column;
      const fields = graph.evaluateFields(easting, northing, seedBank, settings);
      cache.arrays.graphMacro[index] = fields.macro;
      cache.arrays.graphStructure[index] = fields.structure;
      cache.arrays.graphMicro[index] = fields.micro;
      cache.arrays.graphWeather[index] = fields.weather;
      cache.arrays.graphCavity[index] = fields.cavity;
      cache.arrays.graphProtrusion[index] = fields.protrusion;
      cache.arrays.graphSeparation[index] = fields.separation;
      cache.arrays.graphColorDriver[index] = fields.colorDriver;
    }
  }
  cache.seedBank = Object.freeze({ ...seedBank });
  cache.fieldGraphVersion = contract.fieldGraph?.version || '1.0.0';
  return cache;
}

window.LandscapeMotherFormationCache = Object.freeze({
  ...base,
  buildFormationCache,
});
})();
