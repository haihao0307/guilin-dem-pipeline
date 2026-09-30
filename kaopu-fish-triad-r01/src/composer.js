export const COMPOSER_VERSION = 'KC1.0.0';

export function deepMerge(base, delta) {
  if (Array.isArray(delta)) return structuredClone(delta);
  if (!delta || typeof delta !== 'object') return delta;
  const output = base && typeof base === 'object' && !Array.isArray(base) ? structuredClone(base) : {};
  for (const [key, value] of Object.entries(delta)) {
    if (value && typeof value === 'object' && !Array.isArray(value) && output[key] && typeof output[key] === 'object' && !Array.isArray(output[key])) {
      output[key] = deepMerge(output[key], value);
    } else {
      output[key] = structuredClone(value);
    }
  }
  return output;
}

export function compileSourceScore(baseScore, sourceScore, baseSha256) {
  const parent = sourceScore?.object?.parentScore;
  if (!parent) throw new Error('Source Score 缺少 parentScore');
  if (parent.id !== baseScore.id || parent.version !== baseScore.version) throw new Error('Source Score 引用的基谱 ID／版本不匹配');
  if (parent.sha256 !== baseSha256) throw new Error('Source Score 引用的基谱 SHA-256 不匹配');
  const resolved = deepMerge(baseScore, sourceScore);
  resolved.schema = 'kaopu.fish.resolved/1';
  resolved.object.parentScore.resolved = true;
  resolved.provenance = { ...(resolved.provenance ?? {}), baseScoreSha256: baseSha256 };
  return resolved;
}

export function createReferenceLedgerEntry({ packageName, sha256, vertices, triangles, textureCount, rigged }) {
  return {
    source: packageName,
    sha256,
    role: 'REFERENCE_TEACHER_ONLY',
    canProve: ['visible surface', 'silhouette', 'proportions', 'fin placement', 'material observation'],
    cannotProve: ['species identity', 'internal skeleton', 'natural motion', 'muscle mechanics'],
    observed: { vertices, triangles, textureCount, rigged },
    allowedInFormalRuntime: false,
    status: 'DISTILLED_INDEX_ONLY'
  };
}

export function compareSectionStations(referenceStations, candidateStations) {
  if (!Array.isArray(referenceStations) || !Array.isArray(candidateStations) || referenceStations.length !== candidateStations.length) {
    return { comparable: false, reason: 'station count mismatch' };
  }
  const fields = ['xM', 'centerYM', 'halfHeightM', 'halfWidthM', 'superellipseExponent'];
  let maxAbsolute = 0;
  let squared = 0;
  let count = 0;
  for (let i = 0; i < referenceStations.length; i += 1) {
    for (const field of fields) {
      const delta = Number(candidateStations[i][field]) - Number(referenceStations[i][field]);
      maxAbsolute = Math.max(maxAbsolute, Math.abs(delta));
      squared += delta * delta;
      count += 1;
    }
  }
  return { comparable: true, maxAbsolute, rms: Math.sqrt(squared / count), count };
}

export const KC1 = Object.freeze({ COMPOSER_VERSION, deepMerge, compileSourceScore, createReferenceLedgerEntry, compareSectionStations });
