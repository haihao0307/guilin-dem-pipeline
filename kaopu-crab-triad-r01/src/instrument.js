export const VERSION = 'KCR1.0.0-dev';
export const ABI = 'KCR1';
export const STATUS = 'CONTRACT_SCAFFOLD_NO_GEOMETRY';

export const CONTRACT = Object.freeze({
  domain: 'decapod-crab-form-provisional',
  units: 'metre',
  upAxis: 'Y',
  forwardAxis: '+Z',
  scoreSchema: 'kaopu.crab.resolved/1',
  identityPresets: 0,
  exampleScoresEmbedded: 0,
  emptyPlayerProducesObject: false,
  sharedOperators: Object.freeze([
    'chartSurface',
    'stitchSurfaceCharts',
    'assembleRigidRegion',
    'buildAppendageChain',
    'mirrorPairWithAsymmetryOverride',
    'solveConstrainedJointFrames',
    'solveChela',
    'solveSensoryAppendage',
    'solveFootContact',
    'solveCrabGaitPhase',
    'evaluateExoskeletonMaterial',
    'emitScoreDefinedSpinesAndSetae'
  ])
});

const REQUIRED_TOP_LEVEL = Object.freeze([
  'schema',
  'id',
  'version',
  'object',
  'world',
  'instrument',
  'source',
  'surface',
  'regions',
  'appendages',
  'appearance',
  'rig',
  'motion',
  'evidence',
  'unknowns',
  'acceptance'
]);

function assert(condition, code) {
  if (!condition) throw new Error(code);
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function validateResolvedScore(score) {
  assert(isObject(score), 'CRAB_SCORE_MUST_BE_OBJECT');
  for (const key of REQUIRED_TOP_LEVEL) assert(Object.hasOwn(score, key), `CRAB_SCORE_MISSING:${key}`);
  assert(score.schema === CONTRACT.scoreSchema, 'CRAB_SCORE_SCHEMA_MISMATCH');
  assert(score.world?.units === 'metre', 'CRAB_SCORE_UNITS_MUST_BE_METRE');
  assert(score.world?.upAxis === 'Y', 'CRAB_SCORE_UP_AXIS_MUST_BE_Y');
  assert(score.world?.forwardAxis === '+Z', 'CRAB_SCORE_FORWARD_AXIS_MUST_BE_POSITIVE_Z');
  assert(score.instrument?.id === 'kaopu.crab.exoskeleton-appendage', 'CRAB_SCORE_INSTRUMENT_ID_MISMATCH');
  assert(score.instrument?.abi === ABI, 'CRAB_SCORE_ABI_MISMATCH');
  assert(score.source?.role === 'REFERENCE_TEACHER_ONLY', 'CRAB_SCORE_SOURCE_ROLE_INVALID');
  assert(score.source?.formalRuntimeAllowed === false, 'CRAB_SCORE_TEACHER_RUNTIME_FORBIDDEN');
  assert(score.surface?.method === 'SOURCE_DERIVED_CONTINUOUS_CHARTS', 'CRAB_SCORE_SURFACE_METHOD_INVALID');
  assert(Array.isArray(score.surface?.charts) && score.surface.charts.length > 0, 'CRAB_SCORE_SURFACE_CHARTS_REQUIRED');
  assert(Array.isArray(score.regions) && score.regions.length > 0, 'CRAB_SCORE_REGIONS_REQUIRED');
  assert(Array.isArray(score.appendages) && score.appendages.length > 0, 'CRAB_SCORE_APPENDAGES_REQUIRED');
  assert(score.speciesPreset === undefined, 'CRAB_SCORE_SPECIES_PRESET_FORBIDDEN');
  assert(score.crabType === undefined, 'CRAB_SCORE_CRAB_TYPE_DISPATCH_FORBIDDEN');

  const ids = new Set();
  for (const appendage of score.appendages) {
    assert(typeof appendage?.id === 'string' && appendage.id.length > 0, 'CRAB_APPENDAGE_ID_REQUIRED');
    assert(!ids.has(appendage.id), `CRAB_APPENDAGE_ID_DUPLICATE:${appendage.id}`);
    ids.add(appendage.id);
    assert(['LEFT', 'RIGHT', 'MIDLINE'].includes(appendage.side), `CRAB_APPENDAGE_SIDE_INVALID:${appendage.id}`);
    assert(Array.isArray(appendage.segments) && appendage.segments.length > 0, `CRAB_APPENDAGE_SEGMENTS_REQUIRED:${appendage.id}`);
    for (const segment of appendage.segments) {
      assert(isObject(segment.joint), `CRAB_SEGMENT_JOINT_REQUIRED:${appendage.id}:${segment.id ?? '?'}`);
      assert(Array.isArray(segment.joint.axis) && segment.joint.axis.length === 3, `CRAB_SEGMENT_JOINT_AXIS_INVALID:${appendage.id}:${segment.id ?? '?'}`);
      assert(Number(segment.joint.minDeg) <= Number(segment.joint.restDeg), `CRAB_SEGMENT_REST_BELOW_MIN:${appendage.id}:${segment.id ?? '?'}`);
      assert(Number(segment.joint.restDeg) <= Number(segment.joint.maxDeg), `CRAB_SEGMENT_REST_ABOVE_MAX:${appendage.id}:${segment.id ?? '?'}`);
    }
  }

  if (score.acceptance?.rigAccepted || score.acceptance?.motionAccepted) {
    assert(score.acceptance?.staticSurfaceAccepted === true, 'CRAB_STATIC_ACCEPTANCE_REQUIRED_BEFORE_RIG_OR_MOTION');
  }
  if (score.acceptance?.productionReady) {
    assert(
      score.acceptance.staticSurfaceAccepted && score.acceptance.rigAccepted && score.acceptance.motionAccepted,
      'CRAB_PRODUCTION_READY_REQUIRES_ALL_ACCEPTANCE'
    );
  }
  return score;
}

export function measureScore(score) {
  validateResolvedScore(score);
  const segmentCount = score.appendages.reduce((sum, appendage) => sum + appendage.segments.length, 0);
  const sourceSampleCount = score.surface.charts.reduce((sum, chart) => sum + Number(chart.sourceSampleCount ?? 0), 0);
  return Object.freeze({
    chartCount: score.surface.charts.length,
    seamCount: score.surface.seams?.length ?? 0,
    regionCount: score.regions.length,
    appendageCount: score.appendages.length,
    segmentCount,
    sourceSampleCount,
    jointCount: Number(score.rig?.jointCount ?? 0),
    formalSurfaceFraction: Number(score.surface.coverage?.formalSurfaceFraction ?? 0)
  });
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (isObject(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function fingerprintScore(score) {
  validateResolvedScore(score);
  const text = canonical(score);
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `kcr1-fnv1a32-${hash.toString(16).padStart(8, '0')}`;
}

export function snapshot(score) {
  return Object.freeze({
    version: VERSION,
    abi: ABI,
    status: STATUS,
    scoreId: score?.id ?? null,
    measurements: measureScore(score),
    fingerprint: fingerprintScore(score)
  });
}

export function buildScore(score) {
  validateResolvedScore(score);
  const error = new Error('CRAB_INSTRUMENT_GEOMETRY_NOT_IMPLEMENTED_UNTIL_FIRST_TEACHER_IS_FROZEN');
  error.code = 'CRAB_INSTRUMENT_NOT_READY';
  throw error;
}

export function dispose() {
  return true;
}

export const KCR1 = Object.freeze({
  VERSION,
  ABI,
  STATUS,
  CONTRACT,
  validateResolvedScore,
  measureScore,
  fingerprintScore,
  snapshot,
  buildScore,
  dispose
});
