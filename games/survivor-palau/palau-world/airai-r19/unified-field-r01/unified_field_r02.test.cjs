'use strict';

const assert = require('node:assert/strict');
const {
  STATUS,
  known,
  unknown,
  nodata,
  composeFreeSurfaceEvidence,
  composeFreeSurface,
  validateOceanSurfaceState,
  composeOceanSurfaceEvidence,
  composeOceanSurfaceSample,
  composeWaterDepth,
  validateLayerSeparation,
  validateWorldScorePage,
  validateWaveBasisCandidate,
  conductObservation,
} = require('./unified_field_r02.cjs');

const t = '1944-10-12T06:00:00Z';
const t2 = '1944-10-12T06:01:00Z';
const space = 'PALAU_UTM53N';
const egm96 = 'EGM96_ORTHOMETRIC_HEIGHT';
const chartDatum = 'NOAA_ENC_LOCAL_SOUNDING_DATUM_CODE_24';

function assertClose(actual, expected, tolerance = 1e-12) {
  assert.ok(
    Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`,
  );
}

function assertVectorClose(actual, expected, tolerance = 1e-12) {
  assert.equal(actual.length, expected.length);
  for (let i = 0; i < actual.length; i += 1) assertClose(actual[i], expected[i], tolerance);
}

function scalar(value, options = {}) {
  const representedTime = options.representedTime ?? t;
  const validTime = options.validTime ?? { kind: 'instant', at: representedTime };
  return known(value, {
    representedTime,
    validTime,
    spaceFrame: options.spaceFrame ?? space,
    verticalReference: options.verticalReference ?? egm96,
    unit: 'm',
    evidenceLevel: options.evidenceLevel ?? 'TEST_FIXTURE',
    adoptionState: options.adoptionState ?? 'REVIEWED_CANDIDATE',
  });
}

function oceanState(overrides = {}) {
  const value = {
    surfaceStateId: 'OCEAN_MOTHER_CANONICAL_SURFACE_R019',
    parameterCoord: [1000, 2000],
    horizontalDisplacement: [0.35, -0.18],
    eta: 0.12,
    normal: [0, 1, 0],
    surfaceVelocity: [0.4, 0.08, -0.2],
    ...(overrides.value || {}),
  };
  return known(value, {
    representedTime: overrides.representedTime ?? t,
    validTime: overrides.validTime ?? { kind: 'instant', at: overrides.representedTime ?? t },
    spaceFrame: overrides.spaceFrame ?? space,
    verticalReference: overrides.verticalReference ?? egm96,
    quantityKind: 'oceanSurfaceStateSample',
    evidenceLevel: 'TEST_OCEAN_SURFACE_STATE',
    adoptionState: 'REVIEWED_CANDIDATE',
  });
}

// Missing local transfer and non-tidal residual remain explicit PARTIAL components.
{
  const result = composeFreeSurfaceEvidence({
    referenceLevel: scalar(0),
    regionalTide: scalar(0.62),
    localTideCorrection: unknown('Airai local transfer not validated'),
    nonTidalResidual: unknown('1944 pressure/wind/surge not observed'),
    waveDisplacement: scalar(0.11),
    queryTime: t,
  });
  assert.equal(result.status, STATUS.PARTIAL);
  assertClose(result.value.knownSum, 0.73);
  assert.equal(result.unresolved.length, 2);
  assert.equal(result.meta.finalValueAvailable, false);
}

// A complete, datum-compatible decomposition yields one numeric free surface.
{
  const result = composeFreeSurface({
    referenceLevel: scalar(0),
    regionalTide: scalar(0.62),
    localTideCorrection: scalar(-0.04),
    nonTidalResidual: scalar(0.03),
    waveDisplacement: scalar(0.11),
    queryTime: t,
  });
  assert.equal(result.status, STATUS.KNOWN);
  assertClose(result.value, 0.72);
}

// A guessed zero is still rejected even though it is numeric.
{
  const result = composeFreeSurface({
    referenceLevel: scalar(0),
    regionalTide: scalar(0.62),
    localTideCorrection: scalar(0, { adoptionState: 'GUESSED_DEFAULT', evidenceLevel: 'NONE' }),
    nonTidalResidual: scalar(0.03),
    waveDisplacement: scalar(0.11),
    queryTime: t,
  });
  assert.equal(result.status, STATUS.INVALID);
}

// Static bed is valid across an interval and can be queried with an instantaneous surface.
{
  const surface = composeFreeSurface({
    referenceLevel: scalar(0),
    regionalTide: scalar(0.62),
    localTideCorrection: scalar(-0.04),
    nonTidalResidual: scalar(0.03),
    waveDisplacement: scalar(0.11),
    queryTime: t,
  });
  const bed = scalar(-2.25, {
    representedTime: 'terrain-static-over-story-interval',
    validTime: {
      kind: 'interval',
      start: '1944-10-01T00:00:00Z',
      end: '1944-10-31T23:59:59Z',
    },
  });
  const depth = composeWaterDepth({ freeSurface: surface, bedElevation: bed, queryTime: t });
  assert.equal(depth.status, STATUS.KNOWN);
  assertClose(depth.value, 2.97);
  assert.equal(depth.meta.wetDryState, 'WET');
}

// The same static bed cannot be silently used outside its declared validity interval.
{
  const surface = scalar(0.5, { representedTime: '1944-11-03T06:00:00Z' });
  const bed = scalar(-2.25, {
    representedTime: 'terrain-static-over-october',
    validTime: {
      kind: 'interval',
      start: '1944-10-01T00:00:00Z',
      end: '1944-10-31T23:59:59Z',
    },
  });
  const depth = composeWaterDepth({
    freeSurface: surface,
    bedElevation: bed,
    queryTime: '1944-11-03T06:00:00Z',
  });
  assert.equal(depth.status, STATUS.CONFLICT);
  assert.match(depth.reason, /outside sample valid interval/);
}

// NOAA chart datum and EGM96 cannot be mixed without an explicit bridge.
{
  const result = composeWaterDepth({
    freeSurface: scalar(0.5),
    bedElevation: scalar(-12, { verticalReference: chartDatum }),
    queryTime: t,
  });
  assert.equal(result.status, STATUS.CONFLICT);
  assert.match(result.reason, /verticalReference mismatch/);
}

// NoData remains unresolved and never becomes zero.
{
  const result = composeWaterDepth({
    freeSurface: scalar(0.5),
    bedElevation: nodata('source DEM NoData'),
    queryTime: t,
  });
  assert.equal(result.status, STATUS.UNKNOWN);
}

// One OceanSurfaceState provides eta, horizontal displacement, normal and velocity.
{
  const state = oceanState();
  assert.equal(validateOceanSurfaceState(state).status, STATUS.KNOWN);
  const result = composeOceanSurfaceSample({
    referenceLevel: scalar(0),
    regionalTide: scalar(0.62),
    localTideCorrection: scalar(-0.04),
    nonTidalResidual: scalar(0.03),
    oceanSurfaceState: state,
    queryTime: t,
  });
  assert.equal(result.status, STATUS.KNOWN);
  assert.equal(result.value.surfaceStateId, 'OCEAN_MOTHER_CANONICAL_SURFACE_R019');
  assertVectorClose(result.value.knownWorldPosition, [1000.35, 0.73, 1999.82]);
  assert.deepEqual(result.value.surfaceVelocity, [0.4, 0.08, -0.2]);
  assert.equal(result.meta.oneAuthoritativeSurface, true);
}

// Missing Airai transfer produces a partial Ocean sample, not a false final elevation.
{
  const result = composeOceanSurfaceEvidence({
    referenceLevel: scalar(0),
    regionalTide: scalar(0.62),
    localTideCorrection: unknown('Airai transfer missing'),
    nonTidalResidual: scalar(0.03),
    oceanSurfaceState: oceanState(),
    queryTime: t,
  });
  assert.equal(result.status, STATUS.PARTIAL);
  assert.equal(result.value.finalSurfaceAvailable, false);
  assertClose(result.value.knownSurfaceElevation, 0.77);
  assert.equal(result.unresolved[0].name, 'localTideCorrection');
}

// Non-unit normals are invalid and cannot enter rendering, contact or buoyancy queries.
{
  const badState = oceanState({ value: { normal: [0, 2, 0] } });
  const result = validateOceanSurfaceState(badState);
  assert.equal(result.status, STATUS.INVALID);
  assert.match(result.reason, /unit length/);
}

// Instantaneous Ocean state cannot be reused at a different world time.
{
  const result = composeOceanSurfaceSample({
    referenceLevel: scalar(0, { representedTime: t2 }),
    regionalTide: scalar(0.62, { representedTime: t2 }),
    localTideCorrection: scalar(-0.04, { representedTime: t2 }),
    nonTidalResidual: scalar(0.03, { representedTime: t2 }),
    oceanSurfaceState: oceanState({ representedTime: t }),
    queryTime: t2,
  });
  assert.equal(result.status, STATUS.CONFLICT);
}

// Ocean geometry, optics, volume, environment and coast boundary have distinct authority.
{
  const result = validateLayerSeparation({
    oceanSurfaceState: {
      identityId: 'OCEAN_SURFACE_STATE',
      capabilities: ['readWaveState', 'queryGeometry', 'queryNormal', 'queryVelocity'],
    },
    waterSurfaceOptics: {
      identityId: 'WATER_SURFACE_OPTICS',
      capabilities: ['readNormal', 'readSkyRadiance', 'shadeInterface'],
    },
    waterVolumeOptics: {
      identityId: 'WATER_VOLUME_OPTICS',
      capabilities: ['readSurfaceIntersection', 'readBed', 'integrateAbsorptionScattering'],
    },
    oceanEnvironmentAdapter: {
      identityId: 'OCEAN_ENVIRONMENT_ADAPTER',
      capabilities: ['readSun', 'readSky', 'readWind'],
    },
    coastBoundary: {
      identityId: 'COAST_BOUNDARY',
      capabilities: ['querySolid', 'queryBoundaryNormal', 'queryBedSlope'],
    },
  });
  assert.equal(result.status, STATUS.KNOWN);
  assert.equal(result.meta.oneSurfaceGeometryAuthority, 'OCEAN_SURFACE_STATE');
}

// Optical layer attempting to write surface geometry is rejected.
{
  const result = validateLayerSeparation({
    oceanSurfaceState: { identityId: 'OCEAN_SURFACE_STATE', capabilities: ['queryGeometry'] },
    waterSurfaceOptics: {
      identityId: 'WATER_SURFACE_OPTICS',
      capabilities: ['shadeInterface', 'writeSurfaceGeometry'],
    },
    waterVolumeOptics: { identityId: 'WATER_VOLUME_OPTICS', capabilities: ['integrateAbsorptionScattering'] },
    oceanEnvironmentAdapter: { identityId: 'OCEAN_ENVIRONMENT_ADAPTER', capabilities: ['readWind'] },
    coastBoundary: { identityId: 'COAST_BOUNDARY', capabilities: ['querySolid'] },
  });
  assert.equal(result.status, STATUS.INVALID);
}

// World Score page and Observation Request remain query-only.
{
  const page = {
    time: { representedTime: t },
    identity: { id: 'OCEAN_SURFACE_STATE' },
    truthState: { epistemicState: 'modelled_runtime_candidate', absenceState: 'Unknown' },
    strategy: { id: 'ONE_AUTHORITATIVE_SURFACE_QUERY' },
    precision: { P_space: 1, P_time: 1 / 60 },
    query: { id: 'surfaceAt' },
    functions: [{ id: 'surfaceAt', sideEffects: false }],
    evidence: { sources: ['frozen Ocean Mother contract'] },
  };
  assert.equal(validateWorldScorePage(page).status, STATUS.KNOWN);
  const request = conductObservation(page, {
    representedTime: t,
    spaceFrame: space,
    precision: { P_space: 1, P_time: 1 / 60 },
    requestedFields: ['eta', 'normal', 'surfaceVelocity'],
  });
  assert.equal(request.status, STATUS.KNOWN);
  assert.equal(request.meta.worldTruthUnmodified, true);
}

// Wave compression stays reversible, source-bound and below declared error gates.
{
  const candidate = {
    sourceFieldId: 'PALAU_R19_EGM96_CANONICAL_DEM',
    sourceFieldSha256: '6ace836106dcc93c69a0d16fee1e8b8a2a93b4446f9e34af1eb1994e3d1b975c',
    spaceFrame: space,
    verticalReference: egm96,
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
  assert.equal(
    validateWaveBasisCandidate({ ...candidate, adoptionState: 'CANONICAL_TRUTH' }).status,
    STATUS.INVALID,
  );
}

console.log('R19 unified field R02 tests: PASS');
