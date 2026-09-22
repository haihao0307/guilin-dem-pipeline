'use strict';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {
  STATUS,
  validateWorldScorePage,
  validateLayerSeparation,
} = require('./unified_field_r02.cjs');

const registryPath = path.join(__dirname, 'R19_UNIFIED_FIELD_REGISTRY_R02.json');
const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));

assert.equal(
  registry.kernelOrder,
  'Time->Identity->Truth/State->Strategy->Precision->Query->Function->Evidence',
);
assert.equal(registry.rules.oneWorldIdentity, true);
assert.equal(registry.rules.oneOceanSurfaceGeometryAuthority, true);
assert.equal(registry.rules.unknownIsNotZero, true);
assert.equal(registry.rules.noDataIsNotZero, true);
assert.equal(registry.rules.staticFieldUsesExplicitValidityInterval, true);
assert.equal(registry.rules.waveRepresentationMayReplaceSourceTruth, false);
assert.equal(registry.rules.malakalMayBeCopiedAsExactAiraiLocalTide, false);
assert.equal(registry.rules.opticsMayWriteSurfaceGeometry, false);
assert.equal(registry.rules.environmentAdapterMayWriteOceanState, false);

assert.ok(Array.isArray(registry.pages) && registry.pages.length >= 18);
const ids = new Set();
for (const page of registry.pages) {
  const result = validateWorldScorePage(page);
  assert.equal(result.status, STATUS.KNOWN, `${page?.identity?.id}: ${JSON.stringify(result)}`);
  assert.ok(!ids.has(page.identity.id), `duplicate identity ${page.identity.id}`);
  ids.add(page.identity.id);
}

for (const requiredId of [
  'COAST_BOUNDARY',
  'OCEAN_SURFACE_STATE',
  'WATER_SURFACE_OPTICS',
  'WATER_VOLUME_OPTICS',
  'OCEAN_ENVIRONMENT_ADAPTER',
  'INSTANTANEOUS_FREE_SURFACE',
  'WORLD_WATER_DEPTH',
  'WORLD_WET_DRY_STATE',
]) {
  assert.ok(ids.has(requiredId), `missing page ${requiredId}`);
}

const separation = validateLayerSeparation(registry.layerSeparation);
assert.equal(separation.status, STATUS.KNOWN, JSON.stringify(separation));
assert.equal(separation.meta.oneSurfaceGeometryAuthority, 'OCEAN_SURFACE_STATE');

const localTransfer = registry.pages.find((page) => page.identity.id === 'AIRAI_LOCAL_TIDE_TRANSFER');
const residual = registry.pages.find((page) => page.identity.id === 'AIRAI_1944_NON_TIDAL_RESIDUAL');
assert.equal(localTransfer.truthState.epistemicState, 'unknown');
assert.equal(localTransfer.truthState.adoptionState, 'NOT_ADOPTED');
assert.equal(residual.truthState.epistemicState, 'unknown');
assert.equal(residual.truthState.adoptionState, 'NOT_ADOPTED');

const dem = registry.pages.find((page) => page.identity.id === 'PALAU_R19_EGM96_CANONICAL_DEM');
assert.equal(dem.time.validTime.kind, 'interval');
assert.equal(dem.truthState.absenceState, 'NoData');

const surface = registry.pages.find((page) => page.identity.id === 'OCEAN_SURFACE_STATE');
assert.match(surface.precision.P_physics, /eta\/dx\/dz\/normal\/velocity/);

console.log(`R19 unified field registry R02 validation: PASS (${registry.pages.length} pages)`);
