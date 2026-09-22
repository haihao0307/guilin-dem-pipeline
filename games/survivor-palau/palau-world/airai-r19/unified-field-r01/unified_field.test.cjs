'use strict';

const assert = require('node:assert/strict');
const {
  STATUS,
  known,
  unknown,
  nodata,
  composeFreeSurface,
  composeWaterDepth,
  validateWorldScorePage,
  validateWaveBasisCandidate,
  conductObservation,
} = require('./unified_field.cjs');

const t = '1944-10-12T06:00:00Z';
const space = 'PALAU_UTM53N';
const egm96 = 'EGM96_ORTHOMETRIC_HEIGHT';
const chartDatum = 'NOAA_ENC_LOCAL_SOUNDING_DATUM_CODE_24';

function sample(value, verticalReference = egm96, extras = {}) {
  return known(value, {
    representedTime: t,
    spaceFrame: space,
    verticalReference,
    unit: 'm',
    evidenceLevel: 'TEST_FIXTURE',
    adoptionState: 'REVIEWED_CANDIDATE',
    ...extras,
  });
}

// Missing Airai transfer stays Unknown; no zero fallback.
{
  const result = composeFreeSurface({
    referenceLevel: sample(0),
    regionalTide: sample(0.62),
    localTideCorrection: unknown('Airai transfer function not validated'),
    nonTidalResidual: sample(0),
    waveDisplacement: sample(0.11),
  });
  assert.equal(result.status, STATUS.UNKNOWN);
  assert.match(result.reason, /localTideCorrection/);
}

// An unverified numeric zero is not adoptable evidence.
{
  const zeroGuess = known(0, {
    representedTime: t,
    spaceFrame: space,
    verticalReference: egm96,
    evidenceLevel: 'NONE',
    adoptionState: 'GUESSED_DEFAULT',
  });
  const result = composeFreeSurface({
    referenceLevel: sample(0),
    regionalTide: sample(0.62),
    localTideCorrection: zeroGuess,
    nonTidalResidual: sample(0),
    waveDisplacement: sample(0.11),
  });
  assert.equal(result.status, STATUS.INVALID);
}

// Chart-datum bed cannot be subtracted from an EGM96 surface without a bridge.
{
  const result = composeWaterDepth({
    freeSurface: sample(0.5, egm96),
    bedElevation: sample(-12, chartDatum),
  });
  assert.equal(result.status, STATUS.CONFLICT);
  assert.match(result.reason, /verticalReference mismatch/);
}

// Compatible datum, time and space produce a deterministic depth.
{
  const result = composeWaterDepth({
    freeSurface: sample(0.5, egm96),
    bedElevation: sample(-2.25, egm96),
  });
  assert.equal(result.status, STATUS.KNOWN);
  assert.equal(result.value, 2.75);
  assert.equal(result.meta.wetDryState, 'WET');
}

// NoData remains unavailable through query composition.
{
  const result = composeWaterDepth({
    freeSurface: sample(0.5, egm96),
    bedElevation: nodata('source raster has NoData'),
  });
  assert.equal(result.status, STATUS.UNKNOWN);
}

// Time mismatch is rejected.
{
  const otherTime = sample(-2, egm96, { representedTime: '1944-10-12T06:01:00Z' });
  const result = composeWaterDepth({ freeSurface: sample(0.5), bedElevation: otherTime });
  assert.equal(result.status, STATUS.CONFLICT);
  assert.match(result.reason, /representedTime mismatch/);
}

// World Score follows the Small Mother kernel order and requires evidence.
{
  const page = {
    time: { representedTime: t },
    identity: { id: 'KAOPU:SURVIVOR_PALAU:STONE_MONEY:R19' },
    truthState: { epistemicState: 'derived_candidate', absenceState: 'Unknown' },
    strategy: { id: 'EVIDENCE_BOUND_MULTI_FIELD' },
    precision: { P_space: 30, P_time: 60 },
    query: { id: 'surfaceAt' },
    functions: [{ id: 'waterDepth' }],
    evidence: { sources: ['DEM_F0130', 'NOAA_ENC_SOUNDG'] },
  };
  assert.equal(validateWorldScorePage(page).status, STATUS.KNOWN);
  assert.equal(conductObservation(page, {
    representedTime: t,
    spaceFrame: space,
    precision: { P_space: 30 },
    requestedFields: ['bedElevation', 'regionalTide'],
  }).status, STATUS.KNOWN);
}

// Wave basis may encode verified fields, but cannot replace source truth.
{
  const candidate = {
    sourceFieldId: 'PALAU_R19_EGM96_CANONICAL_DEM',
    sourceFieldSha256: '6ace836106dcc93c69a0d16fee1e8b8a2a93b4446f9e34af1eb1994e3d1b975c',
    basis: 'evidence_bounded_multiscale_wave_basis',
    bands: [
      { id: 'low', wavelengthM: [5000, 80000] },
      { id: 'mid', wavelengthM: [300, 5000] },
    ],
    reconstruction: {
      rmse: 1.5,
      maxAbsError: 8,
      coverageFraction: 0.91,
      allowedRmse: 2,
      allowedMaxAbsError: 10,
    },
    residualChannel: { retained: true },
    noDataPolicy: 'PRESERVE_NODATA',
    epistemicState: 'derived_candidate',
    adoptionState: 'REVIEWED_CANDIDATE',
  };
  assert.equal(validateWaveBasisCandidate(candidate).status, STATUS.KNOWN);
  assert.equal(validateWaveBasisCandidate({ ...candidate, adoptionState: 'CANONICAL_TRUTH' }).status, STATUS.INVALID);
}

console.log('R19 unified field contract tests: PASS');
