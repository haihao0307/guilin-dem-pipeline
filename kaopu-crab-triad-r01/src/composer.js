export const COMPOSER_VERSION = 'KCC1.0.0-dev';
export const SOURCE_ROLE = 'REFERENCE_TEACHER_ONLY';

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function deepMerge(base, delta) {
  if (Array.isArray(delta)) return structuredClone(delta);
  if (!isPlainObject(delta)) return delta;
  const output = isPlainObject(base) ? structuredClone(base) : {};
  for (const [key, value] of Object.entries(delta)) {
    output[key] = isPlainObject(value) && isPlainObject(output[key])
      ? deepMerge(output[key], value)
      : structuredClone(value);
  }
  return output;
}

export function compileSourceScore(baseScore, sourceScore, baseSha256) {
  const parent = sourceScore?.object?.parentScore;
  if (!parent) throw new Error('CRAB_SOURCE_PARENT_MISSING');
  if (parent.id !== baseScore?.id || parent.version !== baseScore?.version) {
    throw new Error('CRAB_SOURCE_PARENT_ID_VERSION_MISMATCH');
  }
  if (parent.sha256 !== baseSha256) throw new Error('CRAB_SOURCE_PARENT_SHA256_MISMATCH');

  const resolved = deepMerge(baseScore, sourceScore);
  resolved.schema = 'kaopu.crab.resolved/1';
  resolved.object = { ...resolved.object, parentScore: { ...parent, resolved: true } };
  resolved.provenance = {
    ...(resolved.provenance ?? {}),
    baseScoreSha256: baseSha256,
    composerVersion: COMPOSER_VERSION
  };
  assertTeacherExcludedFromFormalRuntime(resolved);
  return resolved;
}

export function createReferenceLedgerEntry({
  packageName,
  sha256,
  positions,
  triangles,
  normals,
  uvPoints = 0,
  materials = 0,
  hierarchyNodes = 1,
  rigged = false
}) {
  if (!packageName) throw new Error('CRAB_REFERENCE_PACKAGE_NAME_REQUIRED');
  if (!/^[0-9a-f]{64}$/.test(sha256)) throw new Error('CRAB_REFERENCE_SHA256_INVALID');
  return {
    source: packageName,
    sha256,
    role: SOURCE_ROLE,
    canProve: [
      'visible complete surface present in source',
      'surface connectivity present in source',
      'silhouette and measured proportions',
      'visible appendage count and placement',
      'visible material and microstructure evidence'
    ],
    cannotProve: [
      'taxonomic identity without independent verification',
      'missing or occluded anatomy',
      'internal muscle and biological joint mechanics',
      'natural gait or behaviour without motion evidence'
    ],
    observed: { positions, triangles, normals, uvPoints, materials, hierarchyNodes, rigged },
    formalRuntimeAllowed: false,
    status: 'TEACHER_PINNED_NOT_DISTILLED'
  };
}

export function createEmptySourceScore({ id, label, baseId, baseVersion, baseSha256 }) {
  if (!id || !baseId || !baseVersion) throw new Error('CRAB_SOURCE_SCORE_IDENTITY_REQUIRED');
  if (!/^[0-9a-f]{64}$/.test(baseSha256)) throw new Error('CRAB_BASE_SHA256_INVALID');
  return {
    schema: 'kaopu.crab.source/1',
    id,
    version: '0.0.1',
    object: {
      label: label ?? id,
      identityStatus: 'UNRESOLVED',
      parentScore: { id: baseId, version: baseVersion, sha256: baseSha256, resolved: false }
    },
    source: null,
    surface: { method: 'SOURCE_DERIVED_CONTINUOUS_CHARTS', charts: [], seams: [], coverage: null, error: null },
    regions: [],
    appendages: [],
    appearance: { materials: [], microrelief: [], spines: [], setae: [] },
    rig: { status: 'PENDING_STATIC_ACCEPTANCE', rootFrame: null, jointCount: 0 },
    motion: { status: 'PENDING_STATIC_ACCEPTANCE', clips: [], contactModel: null },
    evidence: [],
    unknowns: [],
    acceptance: {
      staticSurfaceAccepted: false,
      rigAccepted: false,
      motionAccepted: false,
      productionReady: false
    }
  };
}

export function assertTeacherExcludedFromFormalRuntime(score) {
  if (score?.source?.formalRuntimeAllowed !== false) {
    throw new Error('CRAB_TEACHER_MUST_BE_EXCLUDED_FROM_FORMAL_RUNTIME');
  }
  const forbiddenKeys = new Set([
    'teacherMesh',
    'sourceMesh',
    'fbxBytes',
    'glbBytes',
    'objBytes',
    'rawXYZ',
    'sourceVertexCache',
    'textureBytes'
  ]);
  const visit = (value, path = '$') => {
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, `${path}[${index}]`));
      return;
    }
    if (!isPlainObject(value)) return;
    for (const [key, item] of Object.entries(value)) {
      if (forbiddenKeys.has(key)) throw new Error(`CRAB_FORMAL_RUNTIME_FORBIDDEN_FIELD:${path}.${key}`);
      visit(item, `${path}.${key}`);
    }
  };
  visit(score);
  return true;
}

export function summarizeSurfaceCoverage(score) {
  const charts = score?.surface?.charts ?? [];
  const regions = score?.regions ?? [];
  const appendages = score?.appendages ?? [];
  const sampleCount = charts.reduce((sum, chart) => sum + Number(chart.sourceSampleCount ?? 0), 0);
  return {
    chartCount: charts.length,
    regionCount: regions.length,
    appendageCount: appendages.length,
    sourceSampleCount: sampleCount,
    formalSurfaceFraction: Number(score?.surface?.coverage?.formalSurfaceFraction ?? 0),
    staticSurfaceAccepted: score?.acceptance?.staticSurfaceAccepted === true
  };
}

export const KCC1 = Object.freeze({
  COMPOSER_VERSION,
  SOURCE_ROLE,
  deepMerge,
  compileSourceScore,
  createReferenceLedgerEntry,
  createEmptySourceScore,
  assertTeacherExcludedFromFormalRuntime,
  summarizeSurfaceCoverage
});
