import {createAssetLoader} from './assets.mjs';
import {requirePerson, materialHash, sha, stable} from './upstream/source-contract.mjs';
import {verifyOutfitMembers} from './upstream/outfits-r043.mjs';
import {refineSewnBoundaries} from './upstream/seam-refinement.mjs';
import {refineRiseTriangles} from './upstream/rise-refinement.mjs';
import {withSettings} from './upstream/material-settings.mjs';
import {BodySDF} from './upstream/material-physics.mjs';

const identityKeys = ['geometrySHA256', 'topologySHA256', 'stateSHA256', 'adapterFingerprint'];
export const DEFAULT_OUTFIT = Object.freeze({top: 'T03', bottom: 'P02', topMaterial: 'denim-bleach', bottomMaterial: 'denim-bleach'});

export function validateActorPacket(packet) {
  const {rig, positions, faces, bodyCount} = packet || {};
  if (rig?.source !== 'anny' || rig.names?.length !== 104 || rig.parents?.length !== 104) throw Error('Clothing requires the original 104-bone Anny rig');
  if (positions?.length !== 25417 * 3 || faces?.length !== 50624 * 3 || bodyCount !== 9253) throw Error('Clothing requires the retained native control topology, not the dense display mesh');
  for (const values of [positions, faces, rig.weights?.ptr, rig.weights?.joints, rig.weights?.values, rig.restPositionsPerInfluence]) {
    if (!values?.length || !Array.from(values).every(Number.isFinite)) throw Error('Missing or nonfinite original body influence data');
  }
  if (rig.weights.ptr.length !== bodyCount + 1 || rig.weights.joints.length !== rig.weights.values.length || rig.restPositionsPerInfluence.length !== rig.weights.values.length * 3) throw Error('Original unpruned body influences are inconsistent');
  for (const matrices of [rig.restMatrices, rig.skinMatrices]) if (matrices?.length !== 104 || matrices.some(m => m.length !== 16 || !Array.from(m).every(Number.isFinite))) throw Error('Invalid native row-major rig matrices');
  if (packet.headSkinIndices?.length !== positions.length / 3 - bodyCount || packet.headSkinWeights?.length !== packet.headSkinIndices.length) throw Error('Original head binding is incomplete');
  if (packet.bindingRange && (packet.bindingRange.length !== positions.length / 3 * 2 || !packet.bindingPacked?.length)) throw Error('NativeBinding range/packed must describe control vertices');
  if (!packet.sourceRevision) throw Error('A current native actor source revision is required for live joint fitting');
  const order = packet.boneOrder || rig.names.map((_, i) => i), seen = new Set();
  for (const j of order) {if (!Number.isInteger(j) || j < 0 || j >= 104 || seen.has(j) || rig.parents[j] >= 0 && !seen.has(rig.parents[j])) throw Error('Native bone order is not parent-first'); seen.add(j);}
  if (seen.size !== 104) throw Error('Native bone order is incomplete');
  return true;
}

function converted(native) {
  const p = new Float32Array(native.length);
  for (let i = 0; i < p.length; i += 3) p.set([native[i], native[i + 2], -native[i + 1]], i);
  return p;
}

/** Exact MP05 platform-person width/height grading rule, scoped per actor. */
export function nativeSizeGrades(actor, oldPositions, newPositions) {
  const rig = actor.rig;
  const measures = names => {
    const w = rig.weights, ratios = [];
    for (const name of names) {
      const j = rig.names.indexOf(name); if (j < 0) continue;
      const ids = [];
      for (let i = 0; i < actor.bodyCount; i++) {
        let weight = 0;
        for (let k = w.ptr[i]; k < w.ptr[i + 1]; k++) if (w.joints[k] === j) weight += w.values[k];
        if (weight > .35) ids.push(i);
      }
      if (ids.length < 12) continue;
      const span = (p, axis) => {let lo = Infinity, hi = -Infinity; for (const i of ids) {lo = Math.min(lo, p[i * 3 + axis]); hi = Math.max(hi, p[i * 3 + axis]);} return hi - lo;};
      ratios.push({joint: name, depthRatio: span(newPositions, 2) / span(oldPositions, 2), widthRatio: span(newPositions, 0) / span(oldPositions, 0)});
    }
    return ratios;
  };
  const top = measures(['spine02', 'spine03', 'upperarm01.L', 'upperarm01.R']);
  const bottom = measures(['spine01', 'upperleg01.L', 'upperleg01.R']);
  const factor = rows => Math.min(1.4, Math.max(1, ...rows.map(r => (r.depthRatio + r.widthRatio) * .5)) * 1.02);
  const height = p => {let lo = Infinity, hi = -Infinity; for (let i = 1; i < p.length; i += 3) {lo = Math.min(lo, p[i]); hi = Math.max(hi, p[i]);} return hi - lo;};
  const length = height(newPositions) / height(oldPositions);
  const result = {top: {width: factor(top), length, measurements: top}, bottom: {width: factor(bottom), length, measurements: bottom}};
  if (![length, result.top.width, result.bottom.width].every(v => Number.isFinite(v) && v > 0)) throw Error('Invalid native body size grading');
  return result;
}

/** Same paper/binding edit as gradeGarmentToPlatform; no singleton runtime. */
async function gradePacket(source, grade, identity) {
  const packet = structuredClone(source);
  packet.sourceTemplate = {binding: source.binding, staticGate: source.record.staticGate, panelsUV: source.spec.panels.map(p => p.uvMm)};
  for (const panel of packet.spec.panels) panel.uvMm = panel.uvMm.map(([u, v]) => [u * grade.width, v * grade.length]);
  packet.binding = {...packet.binding, person: identity, sourcePaperSHA256: source.binding.paperSHA256,
    paperSHA256: await sha(stable(packet.spec.panels)), materialSHA256: await materialHash(packet.spec),
    recipeHash: await sha(stable({source: source.binding.recipeHash, grade, target: identity})), sizeGrade: grade};
  packet.record.staticGate = {passed: false, sourcePassed: !!source.record.staticGate.passed, reason: 'New-person size grade requires new live fit and visual acceptance'};
  return packet;
}

export async function prepareNativeOutfit({actorPacket, personIdentity, outfit = {}, materialSettings = {}, assets = createAssetLoader(), onProgress = () => {}} = {}) {
  validateActorPacket(actorPacket);
  if (identityKeys.some(k => !/^[a-f0-9]{64}$/.test(personIdentity?.[k] || ''))) throw Error('Current native person identity is incomplete');
  const actor = structuredClone(actorPacket);
  actor.positions = Float32Array.from(actor.positions); actor.faces = Uint32Array.from(actor.faces);
  if (await sha(actor.positions.buffer) !== personIdentity.geometrySHA256 || await sha(actor.faces.buffer) !== personIdentity.topologySHA256) throw Error('Actor packet differs from the current original model identity');
  // The external scheduler is the sole motion owner. No action clips are used.
  delete actor.clips;
  const [lock, materials, personManifest, frozen, metadata, rawSDF] = await Promise.all([
    assets.json('SOURCE_LOCK.json'), assets.json('materials.json'), assets.json('assets/PERSON_MANIFEST.json'),
    assets.gzipJSON('assets/native-person.json.gz'), assets.json('assets/body-sdf-grid.json'), assets.unzip('assets/common-body.sdfd.gz')
  ]);
  const oldNative = Float32Array.from(frozen.positions), oldFaces = Uint32Array.from(frozen.faces);
  if (await sha(oldNative.buffer) !== personManifest.geometrySHA256 || await sha(oldFaces.buffer) !== personManifest.topologySHA256) throw Error('Original fit reference geometry is inconsistent');
  if (personIdentity.topologySHA256 !== personManifest.topologySHA256) throw Error('Current body topology differs from the native garment correspondence');
  actor.fittingOrigin = converted(oldNative); actor.restSourceIdentity = personManifest; actor.targetIdentity = personIdentity;
  const grades = nativeSizeGrades(actor, actor.fittingOrigin, converted(actor.positions));
  const choice = {...DEFAULT_OUTFIT, ...outfit};
  if (choice.top !== 'T03' || choice.bottom !== 'P02') throw Error('This integration currently supports the original T03 + P02 pair');
  const templates = await Promise.all([choice.top, choice.bottom].map(async id => {
    const entry = lock.garments[id], packet = await assets.gzipJSON(entry.path);
    requirePerson(packet.binding.person, lock.person.person);
    if (packet.binding.presetId !== id || !entry.sourceStaticPassed || !packet.record.staticGate?.passed) throw Error('Original garment static/source gate failed: ' + id);
    return packet;
  }));
  const sourceProof = await verifyOutfitMembers(templates, lock.person.person), rows = [];
  for (let i = 0; i < 2; i++) {
    const role = i ? 'bottom' : 'top', materialID = i ? choice.bottomMaterial : choice.topMaterial;
    const material = materials.find(m => m.id === materialID);
    if (!material) throw Error('Unknown original garment material: ' + materialID);
    const packet = await refineRiseTriangles(await refineSewnBoundaries(await gradePacket(templates[i], grades[role], personIdentity)));
    const positions = new Float32Array(packet.record.positionsMm.length * 3);
    packet.record.positionsMm.forEach((v, j) => positions.set([Math.fround(v[0] / 1000), Math.fround(Math.fround(v[1] / 1000) - lock.person.groundShiftM), Math.fround(v[2] / 1000)], j * 3));
    rows.push({packet, positions, info: withSettings(material, materialSettings[role] || {}), role, materialID});
  }
  const targetProof = await verifyOutfitMembers(rows.map(row => row.packet), personIdentity);
  onProgress({phase: '原裁片来源、当前人物身份与尺码已核对', fraction: .1});
  return {actor, rows, lock, assets, personIdentity, grades, choice, proof: {source: sourceProof, target: targetProof},
    sdf: new BodySDF(metadata, new Int16Array(rawSDF), lock.person.groundShiftM)};
}
