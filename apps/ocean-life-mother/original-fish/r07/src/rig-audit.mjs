import crypto from 'node:crypto';
import fs from 'node:fs';

const SEMANTIC_PATTERNS = Object.freeze({
  root: /(^|[_ .-])(root|master|armature|fish)([_ .-]|$)/i,
  axial: /(spine|body|torso|backbone|vertebra|centerline|axis|trunk)/i,
  tail: /(tail|caudal|peduncle)/i,
  dorsalFin: /(dorsal)/i,
  analFin: /(^|[_ .-])anal([_ .-]|$)/i,
  pectoralFin: /(pectoral|pec[_ .-]?fin)/i,
  pelvicFin: /(pelvic|ventral[_ .-]?fin)/i,
  jaw: /(jaw|mandible|maxill)/i,
  operculum: /(gill|operc|branchial)/i,
  eye: /(eye|cornea|iris|pupil)/i
});

export function auditGltfJson(gltf) {
  if (!gltf || typeof gltf !== 'object') throw new Error('gltf object required');
  const nodes = Array.isArray(gltf.nodes) ? gltf.nodes : [];
  const skins = Array.isArray(gltf.skins) ? gltf.skins : [];
  const animations = Array.isArray(gltf.animations) ? gltf.animations : [];
  const meshes = Array.isArray(gltf.meshes) ? gltf.meshes : [];
  const materials = Array.isArray(gltf.materials) ? gltf.materials : [];
  const accessors = Array.isArray(gltf.accessors) ? gltf.accessors : [];

  const jointSet = new Set();
  for (const skin of skins) for (const j of skin.joints ?? []) jointSet.add(j);

  const semanticMatches = {};
  for (const key of Object.keys(SEMANTIC_PATTERNS)) semanticMatches[key] = [];
  nodes.forEach((node, index) => {
    const name = String(node?.name ?? '');
    for (const [key, pattern] of Object.entries(SEMANTIC_PATTERNS)) {
      if (pattern.test(name)) semanticMatches[key].push({ index, name, isJoint: jointSet.has(index) });
    }
  });

  let channelCount = 0;
  let clipDurationSeconds = 0;
  const pathCounts = { translation: 0, rotation: 0, scale: 0, weights: 0, other: 0 };
  const animatedNodeSet = new Set();
  const clips = [];
  for (const animation of animations) {
    const channels = animation.channels ?? [];
    channelCount += channels.length;
    let duration = 0;
    for (const channel of channels) {
      const path = channel?.target?.path;
      if (Object.hasOwn(pathCounts, path)) pathCounts[path]++; else pathCounts.other++;
      if (Number.isInteger(channel?.target?.node)) animatedNodeSet.add(channel.target.node);
      const sampler = animation.samplers?.[channel.sampler];
      const accessor = Number.isInteger(sampler?.input) ? accessors[sampler.input] : null;
      if (accessor && Number.isFinite(accessor.max?.[0])) duration = Math.max(duration, accessor.max[0]);
    }
    clipDurationSeconds += duration;
    clips.push({ name: animation.name ?? null, channels: channels.length, durationSeconds: duration });
  }

  const materialFlags = {
    separateEyeMaterial: materials.some(m => /eye|iris|pupil/i.test(String(m?.name ?? ''))),
    separateCorneaMaterial: materials.some(m => /cornea/i.test(String(m?.name ?? ''))),
    alphaMaterialCount: materials.filter(m => ['BLEND', 'MASK'].includes(m?.alphaMode)).length,
    materialCount: materials.length
  };

  const semanticCoverage = Object.fromEntries(
    Object.entries(semanticMatches).map(([k, v]) => [k, v.length > 0])
  );
  const semanticCoverageCount = Object.values(semanticCoverage).filter(Boolean).length;

  return {
    nodeCount: nodes.length,
    meshCount: meshes.length,
    skinCount: skins.length,
    uniqueJointCount: jointSet.size,
    animationCount: animations.length,
    channelCount,
    clipDurationSeconds,
    pathCounts,
    animatedNodeCount: animatedNodeSet.size,
    animatedJointCount: [...animatedNodeSet].filter(i => jointSet.has(i)).length,
    semanticCoverage,
    semanticCoverageCount,
    semanticMatches,
    clips,
    materialFlags
  };
}

export function scoreReferenceCandidate(candidate) {
  const c = candidate;
  const reasons = [];

  const rawCompletenessScore =
    Math.min(30, (c.uniqueJointCount ?? 0) / 5) +
    Math.min(30, (c.channelCount ?? 0) / 16) +
    Math.min(20, (c.animationCount ?? 0) * 4 + Math.min(8, (c.clipDurationSeconds ?? 0) / 3)) +
    Math.min(20, (c.semanticCoverageCount ?? 0) * 2);

  const materialScore = Math.min(10,
    (c.materialFlags?.separateEyeMaterial ? 3 : 0) +
    (c.materialFlags?.separateCorneaMaterial ? 3 : 0) +
    Math.min(4, c.materialFlags?.materialCount ?? 0)
  );
  const typicalityScore = c.typicalOriginalFish ? 16 : 0;
  const marineScore = c.marineRelevant ? 8 : 0;
  const rightsScore = c.rightsRoute === 'permissive-review' ? 8 : c.rightsRoute === 'restricted-replace' ? -12 : -6;
  const integrityScore = c.duplicateGeometryVerified ? 8 : 0;
  const sourceAvailabilityScore = c.noRawBytes ? -18 : 8;
  const penalties = (c.overSpecialized ? 14 : 0) + (c.provenanceHold ? 18 : 0);
  const baselineSuitabilityScore = rawCompletenessScore * 0.45 + materialScore + typicalityScore + marineScore + rightsScore + integrityScore + sourceAvailabilityScore - penalties;

  if (c.noRawBytes) reasons.push('exact source bytes unavailable in current runtime');
  if (c.overSpecialized) reasons.push('specialized morphology/material stack may bias shared core');
  if (c.provenanceHold) reasons.push('source provenance or licence chain unresolved');
  if (c.typicalOriginalFish) reasons.push('typical fusiform bony-fish baseline');
  if (c.duplicateGeometryVerified) reasons.push('multiple exports share identical geometry/rig/animation arrays');

  return {
    rawCompletenessScore: Number(rawCompletenessScore.toFixed(3)),
    baselineSuitabilityScore: Number(baselineSuitabilityScore.toFixed(3)),
    reasons
  };
}

export function readGlb(path) {
  const bytes = fs.readFileSync(path);
  const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
  if (bytes.length < 20 || bytes.toString('ascii', 0, 4) !== 'glTF') throw new Error('not glb');
  const version = bytes.readUInt32LE(4);
  const declaredLength = bytes.readUInt32LE(8);
  if (version !== 2 || declaredLength !== bytes.length) throw new Error('invalid glb header');
  const jsonLength = bytes.readUInt32LE(12);
  const jsonType = bytes.toString('ascii', 16, 20);
  if (jsonType !== 'JSON') throw new Error('first chunk is not JSON');
  const jsonText = bytes.subarray(20, 20 + jsonLength).toString('utf8').replace(/\u0000+$/g, '').trim();
  return { sha256, bytes: bytes.length, gltf: JSON.parse(jsonText) };
}

export function auditGlb(path) {
  const source = readGlb(path);
  return { path, sha256: source.sha256, bytes: source.bytes, ...auditGltfJson(source.gltf) };
}
