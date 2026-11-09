import {loadBytes, loadJSON, unzip} from './upstream/fast-assets.mjs';
import {assertFiniteCoordinates, facesOf, materialHash, requirePerson, sha, stable} from './upstream/source-contract.mjs';
import {MeshContact, outwardPacket, vertexNormals} from './upstream/mesh-contact.mjs';
import {refineSewnBoundaries, unmatchedSewnSites} from './upstream/seam-refinement.mjs';
import {smoothSewnNormals} from './upstream/sewn-normals-r0433.mjs';
import {layerLayout, withSettings} from './upstream/material-settings.mjs';

const DEFAULTS = {
  inner: {presetId: 'T08', materialId: 'knit-fine-0'},
  outer: {presetId: 'T03', materialId: 'knit-soft-0'},
  pants: {presetId: 'P02', materialId: 'denim-raw'}
};
const OUTER_CIRCUMFERENCE_EASE_MM = 100;
const ENVELOPE_SAFETY_M = 0.00035;
const BODY_MARGIN_M = 0.0005;
const bodyCache = new WeakMap();
const sourcePackets = new Map();
let catalogs;

function materialCatalogs() {
  return catalogs ??= Promise.all([
    loadJSON(new URL('./upstream/materials.json', import.meta.url)),
    loadJSON(new URL('./upstream/pattern-catalog.json', import.meta.url))
  ]);
}

const pauseForUI = () => new Promise(resolve => setTimeout(resolve, 0));

function span(positions, axis, ids = null) {
  let lo = Infinity, hi = -Infinity;
  if (ids) {
    for (const i of ids) {lo = Math.min(lo, positions[i * 3 + axis]); hi = Math.max(hi, positions[i * 3 + axis]);}
  } else {
    for (let k = axis; k < positions.length; k += 3) {lo = Math.min(lo, positions[k]); hi = Math.max(hi, positions[k]);}
  }
  return {lo, hi, size: hi - lo};
}

function weightedVertices(host, names, threshold = 0.35) {
  const rig = host.model.lastBodyDriver?.rig;
  const w = rig?.weights;
  if (!w?.ptr || !rig.names) return [];
  const joints = new Set(names.map(name => rig.names.indexOf(name)).filter(j => j >= 0));
  const ids = [];
  for (let i = 0; i < host.model.bodyCount; i++) {
    let weight = 0;
    for (let k = w.ptr[i]; k < w.ptr[i + 1]; k++) if (joints.has(w.joints[k])) weight += w.values[k];
    if (weight > threshold) ids.push(i);
  }
  return ids;
}

// The same width/height grading rule retained in platform-person.mjs. It is a
// recorded paper edit; the nearest-triangle transfer below is placement only.
function bodyGrade(host, kind) {
  const names = kind === 'pants' ? ['spine01', 'upperleg01.L', 'upperleg01.R'] : ['spine02', 'spine03', 'upperarm01.L', 'upperarm01.R'];
  const measurements = [];
  for (const name of names) {
    const ids = weightedVertices(host, [name]);
    if (ids.length < 12) continue;
    const oldWidth = span(host.oldBodyPositions, 0, ids).size;
    const oldDepth = span(host.oldBodyPositions, 2, ids).size;
    if (oldWidth < 1e-6 || oldDepth < 1e-6) continue;
    measurements.push({joint: name, vertices: ids.length,
      widthRatio: span(host.bodyPositions, 0, ids).size / oldWidth,
      depthRatio: span(host.bodyPositions, 2, ids).size / oldDepth});
  }
  const length = span(host.bodyPositions, 1).size / span(host.oldBodyPositions, 1).size;
  const width = measurements.length ? Math.min(1.4, Math.max(1, ...measurements.map(r => (r.depthRatio + r.widthRatio) * 0.5)) * 1.02) : 1;
  if (!(Number.isFinite(length) && length > 0 && Number.isFinite(width))) throw new Error('人物尺寸比例无效。');
  return {width, length, measurements,
    method: measurements.length ? 'Retained MP05 rig-weighted span grading rule' : 'No native rig measurement available; preserve paper width and transfer same-topology body positions',
    productionSizeGradeCertified: false};
}

function torsoCircumference(host) {
  const all = span(host.bodyPositions, 1);
  const y = all.lo + all.size * 0.72;
  const trunk = weightedVertices(host, ['spine01', 'spine02', 'spine03']);
  let ids = trunk.filter(i => Math.abs(host.bodyPositions[i * 3 + 1] - y) < 0.045);
  if (ids.length < 12) ids = trunk;
  if (ids.length < 12) {
    ids = [];
    const count = host.model.bodyCount || host.bodyPositions.length / 3;
    for (let i = 0; i < count; i++) if (Math.abs(host.bodyPositions[i * 3 + 1] - y) < 0.045 && Math.abs(host.bodyPositions[i * 3]) < 0.24) ids.push(i);
  }
  if (ids.length < 12) throw new Error('原人物躯干截面不足，不能估计外层纸样的松量。');
  const a = span(host.bodyPositions, 0, ids).size * 0.5;
  const b = span(host.bodyPositions, 2, ids).size * 0.5;
  const circumference = Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));
  if (!(circumference > 0.35 && circumference < 2)) throw new Error('原人物躯干截面估计不合理。');
  return {meters: circumference, widthM: a * 2, depthM: b * 2, vertices: ids.length,
    method: 'Ellipse perimeter from the native torso section; an ease reference, not a finished-garment circumference measurement'};
}

function bodyMeshes(host) {
  let value = bodyCache.get(host);
  if (!value) {
    if (host.bodyPositions.length !== host.oldBodyPositions.length) throw new Error('人物对应拓扑长度不同。');
    value = {old: new MeshContact(host.oldBodyPositions, host.bodyFaces), current: new MeshContact(host.bodyPositions, host.bodyFaces)};
    bodyCache.set(host, value);
  }
  return value;
}

function totalPaperArea(spec) {
  let area = 0;
  for (const p of spec.panels) for (const [i, j, k] of p.triangles) {
    const a = p.uvMm[i], b = p.uvMm[j], c = p.uvMm[k];
    area += Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) * 0.5;
  }
  return area;
}

function materialEnvelope(info) {
  const layout = layerLayout(info);
  if (info.family === 'knit') {
    // continuous-solid's uOffset translates the complete native yarn outside
    // its carrier. layout.inner/outer are offsets, not half physical thickness.
    return {renderOffsetMeters: layout.outer * 0.001,
      nativeThicknessMeters: layout.nativeEnvelope.thickness,
      thickness: layout.nativeEnvelope.thickness + ENVELOPE_SAFETY_M,
      nativeEnvelope: layout.nativeEnvelope, sourceLayoutMM: layout};
  }
  if (info.family === 'denim') {
    const nativeThicknessMeters = info.geometry.thickness * (info.visualWeave?.reliefScale || 1) * 0.001;
    return {renderOffsetMeters: (info.geometry.thickness * 0.6 + 0.25) * 0.001,
      nativeThicknessMeters, thickness: nativeThicknessMeters + ENVELOPE_SAFETY_M,
      nativeEnvelope: null, sourceLayoutMM: layout};
  }
  throw new Error('本轮仅接入原针织和牛仔实体面料。');
}

function normalizedBaryNormal(contact, face, weights, output) {
  output.fill(0);
  for (let j = 0; j < 3; j++) {
    const k = contact.faces[face + j] * 3;
    for (let d = 0; d < 3; d++) output[d] += contact.normals[k + d] * weights[j];
  }
  const length = Math.hypot(...output);
  if (!(length > 1e-10)) throw new Error('人体对应三角形没有有效法线。');
  for (let d = 0; d < 3; d++) output[d] /= length;
}

function garmentNormals(positions, packet) {
  const normals = vertexNormals(positions, facesOf(packet.spec));
  smoothSewnNormals({attributes: {
    position: {array: positions, count: positions.length / 3},
    normal: {array: normals, count: normals.length / 3}
  }}, packet.spec, packet.record.activeSeams);
  return normals;
}

async function placeOnNativeBody(packet, host, extraM, envelope, progress) {
  const meshes = bodyMeshes(host), old = meshes.old, current = meshes.current;
  const count = packet.record.positionsMm.length;
  const carrier = new Float32Array(count * 3), normal = new Float64Array(3), sample = new Float64Array(4);
  let largestTransferM = 0, largestInitialProjectionM = 0, projectedVertices = 0;
  for (let i = 0; i < count; i++) {
    const source = packet.record.positionsMm[i];
    const p = [source[0] * 0.001, source[1] * 0.001 - host.groundShift, source[2] * 0.001];
    const face = old.nearest(...p);
    if (face < 0) throw new Error('原衣片没有可用的人体三角形对应。');
    const q = old.best;
    const bary = [q[4], q[5], q[6]];
    const transfer = [-q[1], -q[2], -q[3]];
    for (let j = 0; j < 3; j++) {
      const k = current.faces[face + j] * 3;
      for (let d = 0; d < 3; d++) transfer[d] += current.p[k + d] * bary[j];
    }
    normalizedBaryNormal(current, face, bary, normal);
    largestTransferM = Math.max(largestTransferM, Math.hypot(...transfer));
    for (let d = 0; d < 3; d++) carrier[i * 3 + d] = p[d] + transfer[d] + normal[d] * extraM;
    current.sample(carrier[i * 3], carrier[i * 3 + 1], carrier[i * 3 + 2], sample);
    if (sample[0] < 0.001) {
      const correction = 0.001 - sample[0];
      for (let d = 0; d < 3; d++) carrier[i * 3 + d] += sample[d + 1] * correction;
      largestInitialProjectionM = Math.max(largestInitialProjectionM, correction); projectedVertices++;
    }
    if (i % 768 === 0) {progress({phase: '按原人体拓扑放置独立衣片', fraction: 0.4 + 0.35 * i / count}); await pauseForUI();}
  }
  const oriented = outwardPacket(packet, carrier, current);
  packet = oriented.packet;
  const normals = garmentNormals(carrier, packet);
  const positions = new Float32Array(carrier.length);
  let minimumInitialBodyDistanceM = Infinity;
  for (let i = 0; i < count; i++) {
    for (let d = 0; d < 3; d++) positions[i * 3 + d] = carrier[i * 3 + d] + normals[i * 3 + d] * envelope.renderOffsetMeters;
    current.sample(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2], sample);
    const minimum = envelope.thickness * 0.5 + BODY_MARGIN_M;
    if (sample[0] < minimum) {
      const correction = minimum - sample[0];
      for (let d = 0; d < 3; d++) positions[i * 3 + d] += sample[d + 1] * correction;
      largestInitialProjectionM = Math.max(largestInitialProjectionM, correction); projectedVertices++;
    }
    // Match nativeGarmentMesh's original mm -> Float32 m -> Y-up conversion.
    positions[i * 3 + 1] = Math.fround(Math.fround(positions[i * 3 + 1] + host.groundShift) - host.groundShift);
    current.sample(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2], sample);
    minimumInitialBodyDistanceM = Math.min(minimumInitialBodyDistanceM, sample[0]);
  }
  packet.record.positionsMm = Array.from({length: count}, (_, i) => [positions[i * 3] * 1000, (positions[i * 3 + 1] + host.groundShift) * 1000, positions[i * 3 + 2] * 1000]);
  assertFiniteCoordinates(packet.spec, positions);
  return {packet, positions, normals: garmentNormals(positions, packet), orientation: oriented.signs,
    largestTransferM, largestInitialProjectionM, projectedVertices, minimumInitialBodyDistanceM};
}

/**
 * Produce one independent original garment for free-cloth initialization.
 *
 * positions and packet.record.positionsMm represent the PHYSICAL yarn-envelope
 * mid-surface. positions uses Y-up meters. The packet retains the original mm
 * origin: [x*1000, (y+host.groundShift)*1000, z*1000].
 *
 * Each rendered frame must use carrier = physicalPositions - outwardNormals *
 * renderOffsetMeters, pass those same normals to the original solid deformer,
 * and leave the original shader's uOffset intact. No placement offset is a
 * persistent constraint. The rest metric remains the edited, separate UV paper.
 */
export async function prepareGarment({host, presetId, kind = 'inner', progress = () => {}} = {}) {
  const choice = DEFAULTS[kind];
  if (!choice || !host?.sourceLock || !Number.isFinite(host.groundShift)) throw new Error('衣物角色或原人物来源不完整。');
  presetId ||= choice.presetId;
  const entry = host.sourceLock.garments[presetId];
  if (!entry) throw new Error('没有这一件原版衣物：' + presetId);
  progress({phase: '校验原裁片、接缝和实体材料 · ' + presetId, fraction: 0.05});
  let pending = sourcePackets.get(entry.sha256);
  if (!pending) {
    pending = (async () => JSON.parse(new TextDecoder().decode(await unzip(await loadBytes(new URL('./upstream/' + entry.path, import.meta.url), entry.sha256)))))();
    sourcePackets.set(entry.sha256, pending);
  }
  const [source, [materials, patterns]] = await Promise.all([pending, materialCatalogs()]);
  requirePerson(source.binding.person, host.sourceLock.person.person);
  if (source.binding.presetId !== presetId || await materialHash(source.spec) !== source.binding.materialSHA256) throw new Error('原纸样身份校验失败。');
  if (!source.record.staticGate?.passed || !entry.sourceStaticPassed) throw new Error('原衣物没有通过来源静态检查。');
  const material = materials.find(m => m.id === choice.materialId);
  if (!material) throw new Error('原实体面料没有找到。');
  const info = withSettings(material), envelope = materialEnvelope(info), grade = bodyGrade(host, kind);
  const section = kind === 'outer' ? torsoCircumference(host) : null;
  const extraM = kind === 'outer' ? OUTER_CIRCUMFERENCE_EASE_MM * 0.001 / (2 * Math.PI) : 0;
  const easeWidth = section ? 1 + OUTER_CIRCUMFERENCE_EASE_MM / (section.meters * 1000) : 1;
  let packet = structuredClone(source);
  packet.sourceTemplate = {binding: structuredClone(source.binding), staticGate: structuredClone(source.record.staticGate),
    panelsUV: source.spec.panels.map(p => structuredClone(p.uvMm)),
    recordProvenance: Object.fromEntries(['solver', 'metrics', 'productionReady', 'frameCount', 'nativeBinding', 'sourceBody'].filter(k => k in source.record).map(k => [k, structuredClone(source.record[k])]))};
  const sourceAreaMM2 = totalPaperArea(source.spec), originalVertexCount = source.record.positionsMm.length;
  for (const panel of packet.spec.panels) panel.uvMm = panel.uvMm.map(([u, v]) => [u * grade.width * easeWidth, v * grade.length]);
  progress({phase: '沿原接缝边界细分，再放置外层松量', fraction: 0.3});
  packet = await refineSewnBoundaries(packet);
  if (unmatchedSewnSites(packet).length) throw new Error('仍有未参与原接缝约束的边界点。');
  const fitted = await placeOnNativeBody(packet, host, extraM, envelope, progress);
  packet = fitted.packet;
  const placementReport = {
    schema: 'kaopu-independent-layer-placement@1', presetId, materialId: info.id,
    sourcePacketSHA256: entry.sha256, sourceBinding: structuredClone(source.binding), targetPerson: structuredClone(host.identity),
    sourceStaticPassed: true, currentStaticPassed: false, dynamicsSolved: false, materialCalibrated: false,
    originalVertexCount, preparedVertexCount: fitted.positions.length / 3,
    originalPanels: source.spec.panels.length, preparedPanels: packet.spec.panels.length,
    seamRefinement: packet.record.meshRefinement || null,
    bodyGrade: grade, additionalPaperWidthFactor: easeWidth, paperLengthFactor: grade.length,
    requestedCircumferenceEaseMM: section ? OUTER_CIRCUMFERENCE_EASE_MM : 0, torsoReference: section,
    sourcePaperAreaMM2: sourceAreaMM2, preparedPaperAreaMM2: totalPaperArea(packet.spec),
    placementMethod: 'Nearest original-body triangle and barycentric displacement to the same-topology current native body; original cloth residual retained',
    initialOutwardPlacementMM: extraM * 1000, persistentOutwardConstraint: false, bodyGeometryChanged: false,
    largestBodyTransferMM: fitted.largestTransferM * 1000,
    largestInitialBodyProjectionMM: fitted.largestInitialProjectionM * 1000,
    initialProjectionCorrections: fitted.projectedVertices,
    minimumInitialBodyVertexDistanceMM: fitted.minimumInitialBodyDistanceM * 1000,
    bodyDistanceScope: 'Prepared vertices against actual native-body triangles; no edge/face or continuous-time certificate',
    orientation: fitted.orientation,
    nativeYarnThicknessMM: envelope.nativeThicknessMeters * 1000,
    collisionThicknessMM: envelope.thickness * 1000,
    envelopeSafetyMM: ENVELOPE_SAFETY_M * 1000,
    renderOffsetMM: envelope.renderOffsetMeters * 1000,
    nativeEnvelope: envelope.nativeEnvelope,
    coordinateContract: 'Y-up meters for physical mid-surface; packet uses original mm origin; render carrier = mid-surface - outward normal * renderOffsetMeters',
    paperEditScope: section ? 'Independent panel UV width enlarged for a 100 mm estimated torso-circumference allowance; not a certified finished-garment size' : 'Retained MP05 body-size grading only',
    followUpRequired: 'Joint free-cloth settlement and visual review; source static acceptance does not accept this new layering'
  };
  const invalidated = ['materialToSolverGroup', 'nativeBinding', 'wholeSeamAudit', 'jointRefinement', 'sourceBody', 'trial', 'metrics', 'actions'];
  for (const key of invalidated) delete packet.record[key];
  packet.record.staticGate = {passed: false, sourcePassed: true, reason: 'Independent paper grading and current-body multilayer placement require a new live solve and review'};
  packet.record.productionReady = false;
  packet.record.frameCount = 0;
  packet.record.temporaryPins = [];
  packet.record.solver = {type: 'initial-layer-placement', solved: false, reducedCloth: false};
  packet.record.positionSemantics = 'physical-yarn-envelope-mid-surface';
  packet.record.layerPlacement = placementReport;
  packet.binding = {...packet.binding, person: structuredClone(host.identity),
    sourcePaperSHA256: source.binding.paperSHA256, sourceMaterialSHA256: source.binding.materialSHA256,
    sourceRecipeHash: source.binding.recipeHash,
    paperSHA256: await sha(stable(packet.spec.panels)), materialSHA256: await materialHash(packet.spec),
    materialPresetId: info.id, materialSettingsSHA256: await sha(stable(info)),
    recipeHash: await sha(stable({source: source.binding.recipeHash, placement: placementReport})),
    patternSizingOrigin: 'INDEPENDENT_PAPER_GRADE_AND_LAYER_EASE_REQUIRES_CURRENT_LIVE_FIT',
    sizeGrade: {...grade, additionalLayerWidth: easeWidth}};
  progress({phase: '独立衣片已准备，等待叠穿求解 · ' + presetId, fraction: 1});
  return {id: kind, name: patterns.find(p => p.id === presetId)?.label || presetId, presetId,
    packet, positions: fitted.positions, normals: fitted.normals,
    family: info.family, info, thickness: envelope.thickness,
    renderOffsetMeters: envelope.renderOffsetMeters,
    color: info.family === 'knit' ? info.parameters['base-dye'] : info.geometry.warpDye,
    placementReport};
}
