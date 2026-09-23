'use strict';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { validateLedger } = require('./kaopu_core_r03.cjs');

const schema = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'R19_KAOPU_CORE_SCHEMA_R03.json'), 'utf8'),
);
const ledger = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'R19_KAOPU_CORE_LEDGER_R03.json'), 'utf8'),
);

function copy(value) {
  return JSON.parse(JSON.stringify(value));
}

function expectFailure(candidate, expectedCode) {
  const result = validateLedger(candidate, schema);
  assert.equal(result.ok, false, `expected failure ${expectedCode}, received PASS`);
  assert.equal(result.code, expectedCode, JSON.stringify(result));
}

const result = validateLedger(ledger, schema);
assert.equal(result.ok, true, JSON.stringify(result));
assert.equal(result.meta.entryCount, 22);
assert.ok(result.meta.totalObservations >= 22);
assert.ok(result.meta.totalClaims >= 22);
assert.equal(
  new Set(result.meta.entryIds).size,
  result.meta.entryIds.length,
  'entry identities must be unique',
);

// Every R02 unified-field identity must be represented in the full KAOPU Core ledger.
for (const requiredId of [
  'USER_COMPLETE_PALAU_OVERVIEW',
  'USER_AIRAI_YELLOW_STORY_AOI',
  'USER_YELLOW_AOI_GEOGRAPHIC_CANDIDATE',
  'PALAU_R19_EGM96_CANONICAL_DEM',
  'NOAA_ENC_COALNE_LNDARE',
  'COAST_BOUNDARY',
  'NOAA_ENC_SOUNDG',
  'NOAA_ENC_DEPCNT_DEPARE',
  'NOAA_ENC_MQUAL_SEABED_HAZARDS',
  'ALLEN_REEF_GEOMORPHIC_BENTHIC',
  'GMRT_AIRAI_CONTEXT',
  'R19_AOI_BATHYMETRY_CANDIDATE',
  'MALAKAL_REGIONAL_ASTRONOMICAL_TIDE',
  'AIRAI_LOCAL_TIDE_TRANSFER',
  'AIRAI_1944_NON_TIDAL_RESIDUAL',
  'OCEAN_SURFACE_STATE',
  'WATER_SURFACE_OPTICS',
  'WATER_VOLUME_OPTICS',
  'OCEAN_ENVIRONMENT_ADAPTER',
  'INSTANTANEOUS_FREE_SURFACE',
  'WORLD_WATER_DEPTH',
  'WORLD_WET_DRY_STATE',
]) {
  assert.ok(result.meta.entryIds.includes(requiredId), `missing KAOPU entry ${requiredId}`);
}

// Missing property-level uncertainty is illegal.
{
  const candidate = copy(ledger);
  delete candidate.entries[0].uncertainty;
  expectFailure(candidate, 'MISSING_KEYS');
}

// A Claim cannot cite a nonexistent Observation.
{
  const candidate = copy(ledger);
  candidate.entries[0].claims[0].supportObservationIds = ['OBS_DOES_NOT_EXIST'];
  expectFailure(candidate, 'CLAIM_OBSERVATION');
}

// Unknown values cannot be silently filled with numeric zero.
{
  const candidate = copy(ledger);
  const entry = candidate.entries.find((item) => item.identity.id === 'AIRAI_LOCAL_TIDE_TRANSFER');
  entry.quantityState[0].value = 0;
  expectFailure(candidate, 'UNKNOWN_VALUE');
}

// Copies cannot inflate the declared independent evidence count.
{
  const candidate = copy(ledger);
  candidate.entries[0].provenance.independenceSummary.declaredIndependentRootCount = 2;
  expectFailure(candidate, 'INDEPENDENCE_COUNT');
}

// Current Best View cannot overwrite source evidence.
{
  const candidate = copy(ledger);
  candidate.entries[0].view.overwritesEvidence = true;
  expectFailure(candidate, 'VIEW');
}

// Observation and Claim payloads cannot be mixed.
{
  const candidate = copy(ledger);
  candidate.entries[0].observations[0].assertedWorldValue = 'invented geometry';
  expectFailure(candidate, 'OBSERVATION_CLAIM_MIX');
}

// The ledger-level Current Best View policy must remain non-destructive.
{
  const candidate = copy(ledger);
  candidate.currentBestViewPolicy.overwritesConflict = true;
  expectFailure(candidate, 'VIEW_POLICY');
}

// A raw source hash cannot be moved into a Claim.
{
  const candidate = copy(ledger);
  candidate.entries[0].claims[0].sourceSha256 = '0'.repeat(64);
  expectFailure(candidate, 'CLAIM_ASSET_MIX');
}

console.log(
  `R19 KAOPU Core R03 validation: PASS (${result.meta.entryCount} entries, ` +
    `${result.meta.totalObservations} observations, ${result.meta.totalClaims} claims)`,
);
