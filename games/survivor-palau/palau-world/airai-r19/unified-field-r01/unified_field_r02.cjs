'use strict';

const STATUS = Object.freeze({
  KNOWN: 'KNOWN',
  PARTIAL: 'PARTIAL',
  UNKNOWN: 'UNKNOWN',
  NODATA: 'NODATA',
  CONFLICT: 'CONFLICT',
  INVALID: 'INVALID',
});

const USABLE_ADOPTION = new Set([
  'VERIFIED_FUNCTION',
  'VERIFIED_OBSERVATION',
  'REVIEWED_CANDIDATE',
]);

function clone(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function known(value, meta = {}) {
  return { status: STATUS.KNOWN, value, meta: clone(meta) };
}

function partial(value, unresolved = [], meta = {}) {
  return {
    status: STATUS.PARTIAL,
    value: clone(value),
    unresolved: clone(unresolved),
    meta: clone(meta),
  };
}

function unknown(reason, meta = {}) {
  return { status: STATUS.UNKNOWN, reason, meta: clone(meta) };
}

function nodata(reason, meta = {}) {
  return { status: STATUS.NODATA, reason, meta: clone(meta) };
}

function conflict(reason, candidates = [], meta = {}) {
  return {
    status: STATUS.CONFLICT,
    reason,
    candidates: clone(candidates),
    meta: clone(meta),
  };
}

function invalid(reason, meta = {}) {
  return { status: STATUS.INVALID, reason, meta: clone(meta) };
}

function isKnown(sample) {
  return Boolean(sample && sample.status === STATUS.KNOWN);
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function finiteVector(value, length) {
  return Array.isArray(value) && value.length === length && value.every(isFiniteNumber);
}

function sameExact(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function requireKnown(name, sample) {
  if (!sample) return invalid(`${name}: missing sample`);
  if (!isKnown(sample)) {
    return unknown(
      `${name}: ${sample.status || 'UNKNOWN'}${sample.reason ? ` — ${sample.reason}` : ''}`,
      {
        dependency: name,
        dependencyStatus: sample.status || STATUS.UNKNOWN,
      },
    );
  }
  return null;
}

function ensureAdoptable(sample, name) {
  const problem = requireKnown(name, sample);
  if (problem) return problem;
  const adoption = sample.meta?.adoptionState;
  const evidence = sample.meta?.evidenceLevel;
  if (!USABLE_ADOPTION.has(adoption)) {
    return invalid(`${name}: adoptionState ${String(adoption)} is not usable`, {
      name,
      adoption,
    });
  }
  if (!evidence) return invalid(`${name}: evidenceLevel missing`, { name });
  return null;
}

function normalizedValidTime(sample) {
  const validTime = sample?.meta?.validTime;
  if (validTime) return validTime;
  if (sample?.meta?.representedTime !== undefined && sample?.meta?.representedTime !== null) {
    return { kind: 'instant', at: sample.meta.representedTime };
  }
  return null;
}

function compareTime(value) {
  const numeric = Date.parse(value);
  return Number.isFinite(numeric) ? numeric : value;
}

function coversQueryTime(sample, queryTime) {
  const validTime = normalizedValidTime(sample);
  if (!validTime) return invalid('sample has no representedTime or validTime');
  if (validTime.kind === 'timeless') return known(true);
  if (validTime.kind === 'instant') {
    return validTime.at === queryTime
      ? known(true)
      : conflict('instant sample does not match queryTime', [validTime.at, queryTime]);
  }
  if (validTime.kind === 'interval') {
    if (validTime.start === undefined || validTime.end === undefined) {
      return invalid('interval validTime requires start and end');
    }
    const q = compareTime(queryTime);
    const start = compareTime(validTime.start);
    const end = compareTime(validTime.end);
    return q >= start && q <= end
      ? known(true)
      : conflict('queryTime outside sample valid interval', [validTime, queryTime]);
  }
  return invalid(`unsupported validTime kind ${String(validTime.kind)}`);
}

function validateSamplesAtTime(namedSamples, queryTime) {
  if (queryTime === undefined || queryTime === null) {
    return invalid('queryTime is required');
  }
  for (const [name, sample] of Object.entries(namedSamples)) {
    if (!isKnown(sample)) continue;
    const result = coversQueryTime(sample, queryTime);
    if (!isKnown(result)) {
      return result.status === STATUS.CONFLICT
        ? conflict(`${name}: ${result.reason}`, result.candidates, { dependency: name })
        : invalid(`${name}: ${result.reason}`, { dependency: name });
    }
  }
  return known(queryTime, { field: 'queryTime' });
}

function validateCommonFrame(samples, field = 'spaceFrame') {
  const knownSamples = samples.filter(isKnown);
  if (!knownSamples.length) return unknown(`no known samples for ${field}`);
  const reference = knownSamples[0].meta?.[field];
  if (reference === undefined || reference === null) {
    return invalid(`first known sample has no ${field}`);
  }
  for (const sample of knownSamples.slice(1)) {
    const current = sample.meta?.[field];
    if (current === undefined || current === null) {
      return invalid(`known sample has no ${field}`);
    }
    if (!sameExact(reference, current)) {
      return conflict(`${field} mismatch`, [reference, current]);
    }
  }
  return known(reference, { field });
}

function validateCommonDatum(samples) {
  return validateCommonFrame(samples, 'verticalReference');
}

function scalarValue(sample, name) {
  if (!isFiniteNumber(sample?.value)) {
    return invalid(`${name}: value must be a finite number`);
  }
  return known(sample.value);
}

function inspectExplicitComponents(named, queryTime) {
  const unresolved = [];
  const knownNamed = {};
  let knownSum = 0;

  for (const [name, sample] of Object.entries(named)) {
    if (!sample) {
      unresolved.push({ name, status: STATUS.INVALID, reason: 'missing sample' });
      continue;
    }
    if (!isKnown(sample)) {
      unresolved.push({
        name,
        status: sample.status || STATUS.UNKNOWN,
        reason: sample.reason || null,
      });
      continue;
    }
    const adoptionProblem = ensureAdoptable(sample, name);
    if (adoptionProblem) return adoptionProblem;
    const scalar = scalarValue(sample, name);
    if (!isKnown(scalar)) return scalar;
    knownNamed[name] = sample;
    knownSum += scalar.value;
  }

  const knownSamples = Object.values(knownNamed);
  if (knownSamples.length) {
    const time = validateSamplesAtTime(knownNamed, queryTime);
    if (!isKnown(time)) return time;
    const space = validateCommonFrame(knownSamples);
    if (!isKnown(space)) return space;
    const datum = validateCommonDatum(knownSamples);
    if (!isKnown(datum)) return datum;
    return unresolved.length
      ? partial(
          { knownSum, knownComponents: Object.keys(knownNamed) },
          unresolved,
          {
            queryTime,
            spaceFrame: space.value,
            verticalReference: datum.value,
            finalValueAvailable: false,
          },
        )
      : known(
          { knownSum, knownComponents: Object.keys(knownNamed) },
          {
            queryTime,
            spaceFrame: space.value,
            verticalReference: datum.value,
            finalValueAvailable: true,
          },
        );
  }

  return partial(
    { knownSum: 0, knownComponents: [] },
    unresolved,
    { queryTime, finalValueAvailable: false },
  );
}

function composeFreeSurfaceEvidence({
  referenceLevel,
  regionalTide,
  localTideCorrection,
  nonTidalResidual,
  waveDisplacement,
  queryTime,
}) {
  return inspectExplicitComponents(
    {
      referenceLevel,
      regionalTide,
      localTideCorrection,
      nonTidalResidual,
      waveDisplacement,
    },
    queryTime,
  );
}

function composeFreeSurface(args) {
  const result = composeFreeSurfaceEvidence(args);
  if (result.status === STATUS.PARTIAL) return result;
  if (!isKnown(result)) return result;
  return known(result.value.knownSum, {
    quantityKind: 'instantaneousFreeSurfaceElevation',
    unit: 'm',
    representedTime: result.meta.queryTime,
    validTime: { kind: 'instant', at: result.meta.queryTime },
    spaceFrame: result.meta.spaceFrame,
    verticalReference: result.meta.verticalReference,
    evidenceLevel: 'COMPOSED_FROM_EXPLICIT_COMPONENTS',
    adoptionState: 'REVIEWED_CANDIDATE',
    sourceComponents: result.value.knownComponents,
  });
}

function validateOceanSurfaceState(sample) {
  const problem = requireKnown('oceanSurfaceState', sample);
  if (problem) return problem;
  const adoptionProblem = ensureAdoptable(sample, 'oceanSurfaceState');
  if (adoptionProblem) return adoptionProblem;
  const value = sample.value;
  if (!value || typeof value !== 'object') {
    return invalid('oceanSurfaceState.value must be an object');
  }
  if (!value.surfaceStateId || typeof value.surfaceStateId !== 'string') {
    return invalid('oceanSurfaceState.surfaceStateId missing');
  }
  if (!finiteVector(value.parameterCoord, 2)) {
    return invalid('oceanSurfaceState.parameterCoord must be a finite [q.x,q.z] vector');
  }
  if (!finiteVector(value.horizontalDisplacement, 2)) {
    return invalid('oceanSurfaceState.horizontalDisplacement must be finite [dx,dz]');
  }
  if (!isFiniteNumber(value.eta)) {
    return invalid('oceanSurfaceState.eta must be finite');
  }
  if (!finiteVector(value.normal, 3)) {
    return invalid('oceanSurfaceState.normal must be finite [nx,ny,nz]');
  }
  if (!finiteVector(value.surfaceVelocity, 3)) {
    return invalid('oceanSurfaceState.surfaceVelocity must be finite [vx,vy,vz]');
  }
  const norm = Math.hypot(...value.normal);
  if (Math.abs(norm - 1) > 1e-3) {
    return invalid('oceanSurfaceState.normal must be unit length', { norm });
  }
  if (sample.meta?.quantityKind !== 'oceanSurfaceStateSample') {
    return invalid('oceanSurfaceState meta.quantityKind must be oceanSurfaceStateSample');
  }
  return known(true, { surfaceStateId: value.surfaceStateId });
}

function composeOceanSurfaceEvidence({
  referenceLevel,
  regionalTide,
  localTideCorrection,
  nonTidalResidual,
  oceanSurfaceState,
  queryTime,
}) {
  const stateValidation = validateOceanSurfaceState(oceanSurfaceState);
  if (!isKnown(stateValidation)) return stateValidation;
  const timeValidation = validateSamplesAtTime({ oceanSurfaceState }, queryTime);
  if (!isKnown(timeValidation)) return timeValidation;

  const scalarEvidence = inspectExplicitComponents(
    { referenceLevel, regionalTide, localTideCorrection, nonTidalResidual },
    queryTime,
  );
  if (![STATUS.KNOWN, STATUS.PARTIAL].includes(scalarEvidence.status)) {
    return scalarEvidence;
  }

  const knownScalarSamples = [referenceLevel, regionalTide, localTideCorrection, nonTidalResidual]
    .filter(isKnown);
  const commonSamples = [...knownScalarSamples, oceanSurfaceState];
  const space = validateCommonFrame(commonSamples);
  if (!isKnown(space)) return space;
  const datum = validateCommonDatum(commonSamples);
  if (!isKnown(datum)) return datum;

  const wave = oceanSurfaceState.value;
  const q = wave.parameterCoord;
  const d = wave.horizontalDisplacement;
  const knownBase = scalarEvidence.value.knownSum;
  const knownSurfaceElevation = knownBase + wave.eta;
  const payload = {
    surfaceStateId: wave.surfaceStateId,
    parameterCoord: clone(q),
    horizontalDisplacement: clone(d),
    normal: clone(wave.normal),
    surfaceVelocity: clone(wave.surfaceVelocity),
    knownBaseElevation: knownBase,
    waveEta: wave.eta,
    knownSurfaceElevation,
    knownWorldPosition: [q[0] + d[0], knownSurfaceElevation, q[1] + d[1]],
    finalSurfaceAvailable: scalarEvidence.status === STATUS.KNOWN,
  };

  const meta = {
    queryTime,
    validTime: { kind: 'instant', at: queryTime },
    spaceFrame: space.value,
    verticalReference: datum.value,
    evidenceLevel: 'COMPOSED_FROM_ONE_AUTHORITATIVE_OCEAN_SURFACE_STATE',
    adoptionState: 'REVIEWED_CANDIDATE',
    oneAuthoritativeSurface: true,
  };

  return scalarEvidence.status === STATUS.PARTIAL
    ? partial(payload, scalarEvidence.unresolved, meta)
    : known(payload, meta);
}

function composeOceanSurfaceSample(args) {
  const result = composeOceanSurfaceEvidence(args);
  if (result.status === STATUS.PARTIAL) return result;
  if (!isKnown(result)) return result;
  return result;
}

function extractFreeSurfaceElevation(sample) {
  if (isFiniteNumber(sample?.value)) return known(sample.value);
  if (isFiniteNumber(sample?.value?.knownSurfaceElevation) && sample?.value?.finalSurfaceAvailable === true) {
    return known(sample.value.knownSurfaceElevation);
  }
  return invalid('freeSurface sample has no final numeric elevation');
}

function composeWaterDepth({ freeSurface, bedElevation, queryTime }) {
  for (const [name, sample] of Object.entries({ freeSurface, bedElevation })) {
    const problem = requireKnown(name, sample);
    if (problem) return problem;
    const adoptionProblem = ensureAdoptable(sample, name);
    if (adoptionProblem) return adoptionProblem;
  }

  const time = validateSamplesAtTime({ freeSurface, bedElevation }, queryTime);
  if (!isKnown(time)) return time;
  const space = validateCommonFrame([freeSurface, bedElevation]);
  if (!isKnown(space)) return space;
  const datum = validateCommonDatum([freeSurface, bedElevation]);
  if (!isKnown(datum)) return datum;
  const surface = extractFreeSurfaceElevation(freeSurface);
  if (!isKnown(surface)) return surface;
  const bed = scalarValue(bedElevation, 'bedElevation');
  if (!isKnown(bed)) return bed;

  const value = surface.value - bed.value;
  if (!Number.isFinite(value)) return invalid('water depth is not finite');
  return known(value, {
    quantityKind: 'waterDepth',
    unit: 'm',
    representedTime: queryTime,
    validTime: { kind: 'instant', at: queryTime },
    spaceFrame: space.value,
    verticalReference: datum.value,
    evidenceLevel: 'DERIVED_FROM_COMPATIBLE_SURFACE_AND_BED',
    adoptionState: 'REVIEWED_CANDIDATE',
    wetDryState: value > 0 ? 'WET' : value === 0 ? 'CONTACT' : 'DRY',
  });
}

function validateLayerSeparation(layers) {
  const required = [
    'oceanSurfaceState',
    'waterSurfaceOptics',
    'waterVolumeOptics',
    'oceanEnvironmentAdapter',
    'coastBoundary',
  ];
  const missing = required.filter((key) => !layers?.[key]);
  if (missing.length) return invalid('layer separation contract missing layers', { missing });

  const ids = required.map((key) => layers[key].identityId);
  if (new Set(ids).size !== ids.length) {
    return conflict('Ocean/Coast layers must have distinct identities', ids);
  }

  const forbiddenCapabilities = {
    waterSurfaceOptics: ['writeSurfaceGeometry', 'writeBedGeometry', 'writeTide'],
    waterVolumeOptics: ['writeSurfaceGeometry', 'writeBedGeometry', 'writeTide'],
    oceanEnvironmentAdapter: ['writeSurfaceGeometry', 'writeBedGeometry', 'writeWaterMaterial'],
    coastBoundary: ['writeOceanWaveState', 'writeTide'],
  };

  for (const [layerName, forbidden] of Object.entries(forbiddenCapabilities)) {
    const capabilities = new Set(layers[layerName].capabilities || []);
    const found = forbidden.filter((capability) => capabilities.has(capability));
    if (found.length) {
      return invalid(`${layerName} contains forbidden capabilities`, { found });
    }
  }
  return known(true, { oneSurfaceGeometryAuthority: layers.oceanSurfaceState.identityId });
}

function validateWorldScorePage(page) {
  const required = [
    'time',
    'identity',
    'truthState',
    'strategy',
    'precision',
    'query',
    'functions',
    'evidence',
  ];
  const missing = required.filter((key) => page?.[key] === undefined);
  if (missing.length) return invalid('World Score page missing required sections', { missing });
  if (!page.identity.id) return invalid('World Score identity.id missing');
  if (!page.time.representedTime && page.time.representedTime !== 0) {
    return invalid('World Score representedTime missing');
  }
  if (!Array.isArray(page.evidence.sources) || !page.evidence.sources.length) {
    return invalid('World Score evidence.sources must be non-empty');
  }
  if (!page.truthState.epistemicState) {
    return invalid('World Score truthState.epistemicState missing');
  }
  if (!page.truthState.absenceState) {
    return invalid('World Score truthState.absenceState missing');
  }
  return known(true, {
    validatedOrder: 'Time->Identity->Truth/State->Strategy->Precision->Query->Function->Evidence',
  });
}

function validateWaveBasisCandidate(candidate) {
  const required = [
    'sourceFieldId',
    'sourceFieldSha256',
    'spaceFrame',
    'verticalReference',
    'basis',
    'bands',
    'reconstruction',
    'residualChannel',
    'noDataPolicy',
    'epistemicState',
    'adoptionState',
  ];
  const missing = required.filter((key) => candidate?.[key] === undefined);
  if (missing.length) return invalid('wave candidate missing required fields', { missing });
  if (candidate.epistemicState !== 'derived_candidate') {
    return invalid('wave representation must remain derived_candidate until independently verified');
  }
  if (candidate.adoptionState === 'CANONICAL_TRUTH') {
    return invalid('wave representation cannot replace source truth');
  }
  if (candidate.noDataPolicy !== 'PRESERVE_NODATA') {
    return invalid('wave representation must preserve NoData');
  }
  if (candidate.residualChannel?.retained !== true) {
    return invalid('wave representation must retain non-reconstructible residuals');
  }
  if (!Array.isArray(candidate.bands) || candidate.bands.length === 0) {
    return invalid('wave representation needs at least one evidence-bounded band');
  }
  for (const band of candidate.bands) {
    if (!band.id || !Array.isArray(band.wavelengthM) || band.wavelengthM.length !== 2) {
      return invalid('each wave band requires id and wavelengthM[min,max]');
    }
  }
  const r = candidate.reconstruction;
  const numeric = [r.rmse, r.maxAbsError, r.coverageFraction, r.allowedRmse, r.allowedMaxAbsError];
  if (!numeric.every(Number.isFinite)) {
    return invalid('wave reconstruction metrics and gates must be finite');
  }
  if (!(r.coverageFraction > 0 && r.coverageFraction <= 1)) {
    return invalid('coverageFraction must be in (0,1]');
  }
  if (r.rmse > r.allowedRmse || r.maxAbsError > r.allowedMaxAbsError) {
    return conflict('wave reconstruction exceeds declared error gate', [r]);
  }
  return known(true, {
    promotionCeiling: 'REVIEWED_CANDIDATE',
    sourceTruthRetained: true,
  });
}

function conductObservation(worldScore, request) {
  const pageValidation = validateWorldScorePage(worldScore);
  if (!isKnown(pageValidation)) return pageValidation;
  if (!request?.representedTime) return invalid('ObservationRequest representedTime missing');
  if (!request?.spaceFrame) return invalid('ObservationRequest spaceFrame missing');
  if (!request?.precision) return invalid('ObservationRequest precision missing');
  return known(
    {
      worldId: worldScore.identity.id,
      representedTime: request.representedTime,
      spaceFrame: request.spaceFrame,
      precision: clone(request.precision),
      requestedFields: clone(request.requestedFields || []),
    },
    {
      queryOnly: true,
      identityUnchanged: true,
      worldTruthUnmodified: true,
    },
  );
}

module.exports = {
  STATUS,
  known,
  partial,
  unknown,
  nodata,
  conflict,
  invalid,
  isKnown,
  coversQueryTime,
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
};
