'use strict';

const STATUS = Object.freeze({
  KNOWN: 'KNOWN',
  UNKNOWN: 'UNKNOWN',
  NODATA: 'NODATA',
  CONFLICT: 'CONFLICT',
  INVALID: 'INVALID',
});

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function known(value, meta = {}) {
  return { status: STATUS.KNOWN, value, meta: clone(meta) };
}

function unknown(reason, meta = {}) {
  return { status: STATUS.UNKNOWN, reason, meta: clone(meta) };
}

function nodata(reason, meta = {}) {
  return { status: STATUS.NODATA, reason, meta: clone(meta) };
}

function conflict(reason, candidates = [], meta = {}) {
  return { status: STATUS.CONFLICT, reason, candidates: clone(candidates), meta: clone(meta) };
}

function invalid(reason, meta = {}) {
  return { status: STATUS.INVALID, reason, meta: clone(meta) };
}

function isKnown(sample) {
  return Boolean(sample && sample.status === STATUS.KNOWN);
}

function requireKnown(name, sample) {
  if (!sample) return invalid(`${name}: missing sample`);
  if (!isKnown(sample)) {
    return unknown(`${name}: ${sample.status || 'UNKNOWN'}${sample.reason ? ` — ${sample.reason}` : ''}`, {
      dependency: name,
      dependencyStatus: sample.status || STATUS.UNKNOWN,
    });
  }
  return null;
}

function sameExact(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function validateCommonFrame(samples, field = 'spaceFrame') {
  const knownSamples = samples.filter(isKnown);
  if (!knownSamples.length) return unknown(`no known samples for ${field}`);
  const reference = knownSamples[0].meta?.[field];
  if (!reference) return invalid(`first known sample has no ${field}`);
  for (const sample of knownSamples.slice(1)) {
    const current = sample.meta?.[field];
    if (!current) return invalid(`known sample has no ${field}`);
    if (!sameExact(reference, current)) {
      return conflict(`${field} mismatch`, [reference, current]);
    }
  }
  return known(reference, { field });
}

function validateCommonTime(samples) {
  const knownSamples = samples.filter(isKnown);
  if (!knownSamples.length) return unknown('no known samples for representedTime');
  const reference = knownSamples[0].meta?.representedTime;
  if (reference === undefined || reference === null) return invalid('first known sample has no representedTime');
  for (const sample of knownSamples.slice(1)) {
    const current = sample.meta?.representedTime;
    if (current === undefined || current === null) return invalid('known sample has no representedTime');
    if (current !== reference) return conflict('representedTime mismatch', [reference, current]);
  }
  return known(reference, { field: 'representedTime' });
}

function validateCommonDatum(samples) {
  return validateCommonFrame(samples, 'verticalReference');
}

function ensureAdoptable(sample, name) {
  const problem = requireKnown(name, sample);
  if (problem) return problem;
  const adoption = sample.meta?.adoptionState;
  const evidence = sample.meta?.evidenceLevel;
  if (!['VERIFIED_FUNCTION', 'VERIFIED_OBSERVATION', 'REVIEWED_CANDIDATE'].includes(adoption)) {
    return invalid(`${name}: adoptionState ${String(adoption)} is not usable`, { name, adoption });
  }
  if (!evidence) return invalid(`${name}: evidenceLevel missing`, { name });
  return null;
}

function composeFreeSurface({ referenceLevel, regionalTide, localTideCorrection, nonTidalResidual, waveDisplacement }) {
  const named = { referenceLevel, regionalTide, localTideCorrection, nonTidalResidual, waveDisplacement };
  for (const [name, sample] of Object.entries(named)) {
    const problem = requireKnown(name, sample);
    if (problem) return problem;
    const adoptionProblem = ensureAdoptable(sample, name);
    if (adoptionProblem) return adoptionProblem;
  }

  const samples = Object.values(named);
  const time = validateCommonTime(samples);
  if (!isKnown(time)) return time;
  const space = validateCommonFrame(samples);
  if (!isKnown(space)) return space;
  const datum = validateCommonDatum(samples);
  if (!isKnown(datum)) return datum;

  const value = Object.values(named).reduce((sum, sample) => sum + Number(sample.value), 0);
  if (!Number.isFinite(value)) return invalid('free-surface sum is not finite');

  return known(value, {
    quantityKind: 'instantaneousFreeSurfaceElevation',
    unit: 'm',
    representedTime: time.value,
    spaceFrame: space.value,
    verticalReference: datum.value,
    evidenceLevel: 'COMPOSED_FROM_EXPLICIT_COMPONENTS',
    adoptionState: 'REVIEWED_CANDIDATE',
    sourceComponents: Object.keys(named),
  });
}

function composeWaterDepth({ freeSurface, bedElevation }) {
  for (const [name, sample] of Object.entries({ freeSurface, bedElevation })) {
    const problem = requireKnown(name, sample);
    if (problem) return problem;
    const adoptionProblem = ensureAdoptable(sample, name);
    if (adoptionProblem) return adoptionProblem;
  }
  const time = validateCommonTime([freeSurface, bedElevation]);
  if (!isKnown(time)) return time;
  const space = validateCommonFrame([freeSurface, bedElevation]);
  if (!isKnown(space)) return space;
  const datum = validateCommonDatum([freeSurface, bedElevation]);
  if (!isKnown(datum)) return datum;

  const value = Number(freeSurface.value) - Number(bedElevation.value);
  if (!Number.isFinite(value)) return invalid('water depth is not finite');
  return known(value, {
    quantityKind: 'waterDepth',
    unit: 'm',
    representedTime: time.value,
    spaceFrame: space.value,
    verticalReference: datum.value,
    evidenceLevel: 'DERIVED_FROM_COMPATIBLE_SURFACE_AND_BED',
    adoptionState: 'REVIEWED_CANDIDATE',
    wetDryState: value > 0 ? 'WET' : value === 0 ? 'CONTACT' : 'DRY',
  });
}

function validateWorldScorePage(page) {
  const required = ['time', 'identity', 'truthState', 'strategy', 'precision', 'query', 'functions', 'evidence'];
  const missing = required.filter((key) => page?.[key] === undefined);
  if (missing.length) return invalid('World Score page missing required sections', { missing });
  if (!page.identity.id) return invalid('World Score identity.id missing');
  if (!page.time.representedTime && page.time.representedTime !== 0) {
    return invalid('World Score representedTime missing');
  }
  if (!Array.isArray(page.evidence.sources) || !page.evidence.sources.length) {
    return invalid('World Score evidence.sources must be non-empty');
  }
  if (!page.truthState.epistemicState) return invalid('World Score truthState.epistemicState missing');
  if (!page.truthState.absenceState) return invalid('World Score truthState.absenceState missing');
  return known(true, {
    validatedOrder: 'Time->Identity->Truth/State->Strategy->Precision->Query->Function->Evidence',
  });
}

function validateWaveBasisCandidate(candidate) {
  const required = [
    'sourceFieldId',
    'sourceFieldSha256',
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
  const r = candidate.reconstruction;
  if (![r.rmse, r.maxAbsError, r.coverageFraction].every(Number.isFinite)) {
    return invalid('wave reconstruction metrics must be finite');
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
  return known({
    worldId: worldScore.identity.id,
    representedTime: request.representedTime,
    spaceFrame: request.spaceFrame,
    precision: clone(request.precision),
    requestedFields: clone(request.requestedFields || []),
  }, {
    queryOnly: true,
    identityUnchanged: true,
    worldTruthUnmodified: true,
  });
}

module.exports = {
  STATUS,
  known,
  unknown,
  nodata,
  conflict,
  invalid,
  isKnown,
  composeFreeSurface,
  composeWaterDepth,
  validateWorldScorePage,
  validateWaveBasisCandidate,
  conductObservation,
};
