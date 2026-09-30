import * as THREE from 'three';

export { THREE };
export const VERSION = 'KF1.0.0';
export const INSTRUMENT_ID = 'kaopu.fish.axial-loft';
export const ABI = 'KF1';

const DEG = Math.PI / 180;
const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;

function asObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} 必须是对象`);
  return value;
}
function finite(value, label) {
  if (!Number.isFinite(value)) throw new Error(`${label} 必须是有限数字`);
  return value;
}
function positive(value, label) {
  finite(value, label);
  if (value <= 0) throw new Error(`${label} 必须大于 0`);
  return value;
}
function orderedStations(stations) {
  if (!Array.isArray(stations) || stations.length < 8 || stations.length > 128) throw new Error('鱼体截面必须有 8–128 个测量站');
  let previous = -Infinity;
  for (const [index, station] of stations.entries()) {
    asObject(station, `截面 ${index}`);
    finite(station.xM, `截面 ${index}.xM`);
    finite(station.centerYM, `截面 ${index}.centerYM`);
    positive(station.halfHeightM, `截面 ${index}.halfHeightM`);
    positive(station.halfWidthM, `截面 ${index}.halfWidthM`);
    if (station.xM <= previous) throw new Error('鱼体截面 xM 必须严格递增');
    if (station.superellipseExponent < 1.4 || station.superellipseExponent > 5) throw new Error('superellipseExponent 必须在 1.4–5 之间');
    previous = station.xM;
  }
}

export function validate(score) {
  const errors = [];
  const warnings = [];
  try {
    asObject(score, 'Resolved Score');
    if (score.schema !== 'kaopu.fish.resolved/1') throw new Error('必须使用 kaopu.fish.resolved/1 完整谱');
    if (score.instrument?.id !== INSTRUMENT_ID || score.instrument?.version !== '1.0.0' || score.instrument?.abi !== ABI) {
      throw new Error('乐器 ID／版本／ABI 与 KF1 不匹配');
    }
    if (score.units !== 'metre' || score.axis !== 'Y_UP') throw new Error('KF1 只接受 metre、Y_UP');
    orderedStations(score.construction?.sections?.stations);
    const bodyBones = score.motion?.skeleton?.bodyBones;
    if (!Array.isArray(bodyBones) || bodyBones.length < 4 || bodyBones.length > 32) throw new Error('身体骨链必须有 4–32 根骨');
    const names = new Set();
    let previousX = -Infinity;
    for (const bone of bodyBones) {
      if (!bone.id || names.has(bone.id)) throw new Error('身体骨名称必须唯一且非空');
      finite(bone.xM, `骨 ${bone.id}.xM`);
      if (bone.xM <= previousX) throw new Error('身体骨 xM 必须严格递增');
      previousX = bone.xM;
      names.add(bone.id);
    }
    const branchBones = score.motion?.skeleton?.branchBones ?? [];
    for (const bone of branchBones) {
      if (!bone.id || names.has(bone.id)) throw new Error('分支骨名称必须唯一且非空');
      if (!names.has(bone.parent)) throw new Error(`分支骨 ${bone.id} 的父骨不存在`);
      if (!Array.isArray(bone.originM) || bone.originM.length !== 3) throw new Error(`分支骨 ${bone.id}.originM 必须为三维坐标`);
      bone.originM.forEach((value, i) => finite(value, `分支骨 ${bone.id}.originM[${i}]`));
      names.add(bone.id);
    }
    const fins = score.construction?.parts?.fins;
    if (!Array.isArray(fins) || fins.length < 1 || fins.length > 24) throw new Error('鳍必须有 1–24 个');
    const finIds = new Set();
    for (const fin of fins) {
      if (!fin.id || finIds.has(fin.id)) throw new Error('鳍 ID 必须唯一且非空');
      if (!['VERTICAL', 'LATERAL'].includes(fin.plane)) throw new Error(`鳍 ${fin.id} 平面无效`);
      if (!names.has(fin.bone)) throw new Error(`鳍 ${fin.id} 指向不存在的骨 ${fin.bone}`);
      if (!Array.isArray(fin.profileM) || fin.profileM.length < 3) throw new Error(`鳍 ${fin.id} 至少需要三个轮廓点`);
      fin.profileM.forEach((point, i) => {
        if (!Array.isArray(point) || point.length !== 2) throw new Error(`鳍 ${fin.id} 轮廓点 ${i} 无效`);
        point.forEach((value, j) => finite(value, `鳍 ${fin.id}.profileM[${i}][${j}]`));
      });
      positive(fin.thicknessM, `鳍 ${fin.id}.thicknessM`);
      finIds.add(fin.id);
    }
    const forbiddenKeys = ['modelUrl', 'meshUrl', 'glbUrl', 'fbxUrl', 'textureUrl', 'runtimeModel', 'runtimeMesh'];
    const queue = [score];
    while (queue.length) {
      const current = queue.pop();
      if (!current || typeof current !== 'object') continue;
      for (const [key, value] of Object.entries(current)) {
        if (forbiddenKeys.includes(key)) throw new Error(`正式谱禁止外部资产字段：${key}`);
        if (value && typeof value === 'object') queue.push(value);
      }
    }
    if (score.provenance?.externalAssetInFormalBuild !== false) throw new Error('provenance.externalAssetInFormalBuild 必须明确为 false');
    if (score.provenance?.visualAcceptance !== false) warnings.push('visualAcceptance 只能由用户改变；当前应保持 false');
    if (score.provenance?.motionAcceptance !== false) warnings.push('motionAcceptance 尚未由用户批准');
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }
  return { valid: errors.length === 0, errors, warnings };
}

export function parseScore(textOrData) {
  const score = typeof textOrData === 'string' ? JSON.parse(textOrData) : structuredClone(textOrData);
  const report = validate(score);
  if (!report.valid) throw new Error(report.errors.join('；'));
  return score;
}

function locateInterval(stations, x) {
  if (x <= stations[0].xM) return { a: stations[0], b: stations[0], t: 0 };
  if (x >= stations.at(-1).xM) return { a: stations.at(-1), b: stations.at(-1), t: 0 };
  let low = 0;
  let high = stations.length - 1;
  while (high - low > 1) {
    const mid = (low + high) >> 1;
    if (stations[mid].xM <= x) low = mid;
    else high = mid;
  }
  const a = stations[low];
  const b = stations[high];
  return { a, b, t: (x - a.xM) / (b.xM - a.xM) };
}
function sectionAt(stations, x) {
  const { a, b, t } = locateInterval(stations, x);
  return {
    xM: x,
    centerYM: lerp(a.centerYM, b.centerYM, t),
    halfHeightM: lerp(a.halfHeightM, b.halfHeightM, t),
    halfWidthM: lerp(a.halfWidthM, b.halfWidthM, t),
    superellipseExponent: lerp(a.superellipseExponent, b.superellipseExponent, t)
  };
}

function colorFor(score, x, vertical01, lateral01) {
  const palette = score.appearance.palette;
  const bottom = new THREE.Color(palette.belly);
  const middle = new THREE.Color(palette.flank);
  const upper = new THREE.Color(palette.upperFlank);
  const dorsal = new THREE.Color(palette.dorsal);
  const marking = new THREE.Color(palette.marking);
  let color;
  if (vertical01 < 0.34) color = bottom.clone().lerp(middle, vertical01 / 0.34);
  else if (vertical01 < 0.72) color = middle.clone().lerp(upper, (vertical01 - 0.34) / 0.38);
  else color = upper.clone().lerp(dorsal, (vertical01 - 0.72) / 0.28);
  const settings = score.appearance.markings;
  const waveA = Math.sin((x + 0.53) * settings.longitudinalFrequency * Math.PI * 2 + Math.sin(vertical01 * 13.1));
  const waveB = Math.cos(vertical01 * settings.verticalFrequency * Math.PI + lateral01 * 4.7 + x * 17.0);
  const spot = 0.5 + 0.5 * waveA * waveB;
  const flankWindow = THREE.MathUtils.smoothstep(vertical01, 0.20, 0.48) * (1 - THREE.MathUtils.smoothstep(vertical01, 0.76, 0.96));
  if (spot > settings.threshold) {
    const amount = settings.strength * flankWindow * THREE.MathUtils.smoothstep(spot, settings.threshold, 1);
    color.lerp(marking, amount);
  }
  return color;
}

function skinWeightsForX(x, boneSpecs) {
  if (x <= boneSpecs[0].xM) return [0, 0, 0, 0, 1, 0, 0, 0];
  const last = boneSpecs.length - 1;
  if (x >= boneSpecs[last].xM) return [last, 0, 0, 0, 1, 0, 0, 0];
  for (let i = 0; i < last; i += 1) {
    const left = boneSpecs[i].xM;
    const right = boneSpecs[i + 1].xM;
    if (x >= left && x <= right) {
      const t = (x - left) / (right - left);
      return [i, i + 1, 0, 0, 1 - t, t, 0, 0];
    }
  }
  return [last, 0, 0, 0, 1, 0, 0, 0];
}

function buildBodyGeometry(score) {
  const sections = score.construction.sections;
  const stations = sections.stations;
  const longitudinalSegments = sections.longitudinalSegments;
  const radialSegments = sections.radialSegments;
  const boneSpecs = score.motion.skeleton.bodyBones;
  const xMin = stations[0].xM;
  const xMax = stations.at(-1).xM;
  const positions = [];
  const uvs = [];
  const colors = [];
  const skinIndices = [];
  const skinWeights = [];
  const indices = [];
  for (let ix = 0; ix <= longitudinalSegments; ix += 1) {
    const u = ix / longitudinalSegments;
    const x = lerp(xMin, xMax, u);
    const section = sectionAt(stations, x);
    const exponent = section.superellipseExponent;
    for (let ir = 0; ir < radialSegments; ir += 1) {
      const v = ir / radialSegments;
      const angle = v * Math.PI * 2;
      const c = Math.cos(angle);
      const s = Math.sin(angle);
      const lateral = section.halfWidthM * Math.sign(c || 1) * Math.pow(Math.abs(c), 2 / exponent);
      const vertical = section.halfHeightM * Math.sign(s || 1) * Math.pow(Math.abs(s), 2 / exponent);
      positions.push(x, section.centerYM + vertical, lateral);
      uvs.push(u, v);
      const color = colorFor(score, x, 0.5 + 0.5 * vertical / section.halfHeightM, lateral / section.halfWidthM);
      colors.push(color.r, color.g, color.b);
      const weights = skinWeightsForX(x, boneSpecs);
      skinIndices.push(...weights.slice(0, 4));
      skinWeights.push(...weights.slice(4));
    }
  }
  for (let ix = 0; ix < longitudinalSegments; ix += 1) {
    const current = ix * radialSegments;
    const next = (ix + 1) * radialSegments;
    for (let ir = 0; ir < radialSegments; ir += 1) {
      const rn = (ir + 1) % radialSegments;
      indices.push(current + ir, next + ir, next + rn, current + ir, next + rn, current + rn);
    }
  }
  const addCap = (head) => {
    const sectionIndex = head ? 0 : longitudinalSegments;
    const station = head ? stations[0] : stations.at(-1);
    const centerIndex = positions.length / 3;
    positions.push(station.xM, station.centerYM, 0);
    uvs.push(head ? 0 : 1, 0.5);
    const color = colorFor(score, station.xM, 0.5, 0);
    colors.push(color.r, color.g, color.b);
    const weights = skinWeightsForX(station.xM, boneSpecs);
    skinIndices.push(...weights.slice(0, 4));
    skinWeights.push(...weights.slice(4));
    const ring = sectionIndex * radialSegments;
    for (let ir = 0; ir < radialSegments; ir += 1) {
      const rn = (ir + 1) % radialSegments;
      if (head) indices.push(centerIndex, ring + rn, ring + ir);
      else indices.push(centerIndex, ring + ir, ring + rn);
    }
  };
  addCap(true);
  addCap(false);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.name = 'KF1_SCORE_DRIVEN_BODY_GEOMETRY';
  return geometry;
}

function makeBodyMaterial(score) {
  const source = score.appearance.materials.body;
  const material = new THREE.MeshPhysicalMaterial({
    vertexColors: true,
    roughness: source.roughness,
    metalness: source.metalness,
    clearcoat: source.clearcoat,
    clearcoatRoughness: 0.48,
    side: THREE.FrontSide
  });
  material.name = 'KF1_PROCEDURAL_WET_SKIN';
  material.customProgramCacheKey = () => `kaopu-fish-scale-field-${VERSION}`;
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vFishUv;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvFishUv = uv;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vFishUv;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec2 scaleUv = vec2(vFishUv.x * ${score.surface.microstructure.scaleColumns.toFixed(1)}, vFishUv.y * ${score.surface.microstructure.scaleRows.toFixed(1)});
        float rowShift = mod(floor(scaleUv.y), 2.0) * 0.5;
        vec2 cell = fract(vec2(scaleUv.x + rowShift, scaleUv.y)) - 0.5;
        float scaleEdge = smoothstep(0.46, 0.34, length(vec2(cell.x, cell.y * 1.35)));
        float scaleShade = mix(0.94, 1.04, scaleEdge);
        diffuseColor.rgb *= scaleShade;
      `);
  };
  return material;
}

function createBoneHierarchy(score) {
  const bodySpecs = score.motion.skeleton.bodyBones;
  const bodyBones = [];
  const boneById = new Map();
  const absoluteOriginById = new Map();
  for (let i = 0; i < bodySpecs.length; i += 1) {
    const spec = bodySpecs[i];
    const bone = new THREE.Bone();
    bone.name = spec.id;
    if (i === 0) bone.position.set(spec.xM, 0, 0);
    else {
      bone.position.set(spec.xM - bodySpecs[i - 1].xM, 0, 0);
      bodyBones[i - 1].add(bone);
    }
    bodyBones.push(bone);
    boneById.set(spec.id, bone);
    absoluteOriginById.set(spec.id, new THREE.Vector3(spec.xM, 0, 0));
  }
  const branchBones = [];
  for (const spec of score.motion.skeleton.branchBones ?? []) {
    const parent = boneById.get(spec.parent);
    const parentOrigin = absoluteOriginById.get(spec.parent);
    const origin = new THREE.Vector3().fromArray(spec.originM);
    const bone = new THREE.Bone();
    bone.name = spec.id;
    bone.position.copy(origin).sub(parentOrigin);
    parent.add(bone);
    branchBones.push(bone);
    boneById.set(spec.id, bone);
    absoluteOriginById.set(spec.id, origin);
  }
  const allBones = [...bodyBones, ...branchBones];
  return { rootBone: bodyBones[0], bodyBones, branchBones, allBones, boneById, absoluteOriginById };
}

function shapeFromProfile(profile) {
  const shape = new THREE.Shape();
  shape.moveTo(profile[0][0], profile[0][1]);
  for (let i = 1; i < profile.length; i += 1) shape.lineTo(profile[i][0], profile[i][1]);
  shape.closePath();
  return shape;
}
function makeFinMaterial(score) {
  const materialData = score.appearance.materials.fin;
  return new THREE.MeshPhysicalMaterial({
    color: score.appearance.palette.fin,
    roughness: materialData.roughness,
    metalness: materialData.metalness,
    transparent: materialData.opacity < 1,
    opacity: materialData.opacity,
    side: THREE.DoubleSide,
    clearcoat: 0.08
  });
}
function buildFin(fin, parentBone, parentOrigin, material) {
  const geometry = new THREE.ExtrudeGeometry(shapeFromProfile(fin.profileM), {
    depth: fin.thicknessM,
    bevelEnabled: false,
    curveSegments: 1,
    steps: 1
  });
  geometry.translate(0, 0, -fin.thicknessM / 2);
  if (fin.plane === 'LATERAL') geometry.rotateX(Math.PI / 2);
  geometry.computeVertexNormals();
  geometry.name = `KF1_FIN_${fin.id}`;
  const mesh = new THREE.Mesh(geometry, material.clone());
  mesh.name = fin.id;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const root = new THREE.Vector3(fin.rootXM, fin.rootYM, fin.rootZM ?? 0);
  mesh.position.copy(root).sub(parentOrigin);
  parentBone.add(mesh);

  const rayPositions = [];
  const rayCount = clamp(Math.round(fin.rayCount ?? 0), 0, 24);
  if (rayCount > 0) {
    const outline = fin.profileM.slice(1);
    for (let i = 0; i < rayCount; i += 1) {
      const t = rayCount === 1 ? 0.5 : i / (rayCount - 1);
      const scaled = t * (outline.length - 1);
      const j = Math.floor(scaled);
      const k = Math.min(outline.length - 1, j + 1);
      const p = [lerp(outline[j][0], outline[k][0], scaled - j), lerp(outline[j][1], outline[k][1], scaled - j)];
      if (fin.plane === 'VERTICAL') rayPositions.push(0, 0, fin.thicknessM * 0.55, p[0], p[1], fin.thicknessM * 0.55);
      else rayPositions.push(0, fin.thicknessM * -0.55, 0, p[0], fin.thicknessM * -0.55, p[1]);
    }
    const rayGeometry = new THREE.BufferGeometry();
    rayGeometry.setAttribute('position', new THREE.Float32BufferAttribute(rayPositions, 3));
    const rays = new THREE.LineSegments(rayGeometry, new THREE.LineBasicMaterial({ color: 0x292d2e, transparent: true, opacity: 0.42 }));
    rays.name = `${fin.id}-rays`;
    mesh.add(rays);
  }
  return mesh;
}

function staticLoftGeometry(stations, radialSegments = 24, longitudinalSegments = 32, origin = [0, 0, 0]) {
  const formatted = stations.map(([x, centerY, halfHeight, halfWidth]) => ({ xM: x, centerYM: centerY, halfHeightM: halfHeight, halfWidthM: halfWidth, superellipseExponent: 2.2 }));
  const positions = [];
  const indices = [];
  for (let ix = 0; ix <= longitudinalSegments; ix += 1) {
    const u = ix / longitudinalSegments;
    const x = lerp(formatted[0].xM, formatted.at(-1).xM, u);
    const section = sectionAt(formatted, x);
    for (let ir = 0; ir < radialSegments; ir += 1) {
      const angle = ir / radialSegments * Math.PI * 2;
      positions.push(x - origin[0], section.centerYM - origin[1] + Math.sin(angle) * section.halfHeightM, Math.cos(angle) * section.halfWidthM - origin[2]);
    }
  }
  for (let ix = 0; ix < longitudinalSegments; ix += 1) {
    const a = ix * radialSegments;
    const b = (ix + 1) * radialSegments;
    for (let ir = 0; ir < radialSegments; ir += 1) {
      const rn = (ir + 1) % radialSegments;
      indices.push(a + ir, b + ir, b + rn, a + ir, b + rn, a + rn);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function makeCurveTube(points, radius, segments = 28) {
  const vectors = points.map((point) => new THREE.Vector3(...point));
  const curve = vectors.length === 2
    ? new THREE.LineCurve3(vectors[0], vectors[1])
    : new THREE.CatmullRomCurve3(vectors, false, 'centripetal');
  return new THREE.TubeGeometry(curve, segments, radius, 6, false);
}

function attachHeadDetails(score, hierarchy, bodyMaterial, root) {
  const parts = score.construction.parts;
  const headBone = hierarchy.boneById.get('head');
  const headOrigin = hierarchy.absoluteOriginById.get('head');
  const eyeData = parts.eyes;
  const eyeWhiteMaterial = new THREE.MeshPhysicalMaterial({ color: 0xd4d0b9, roughness: 0.3, metalness: 0.02, clearcoat: 0.35 });
  const irisMaterial = new THREE.MeshPhysicalMaterial({ color: score.appearance.palette.iris, roughness: 0.32, clearcoat: 0.45 });
  const pupilMaterial = new THREE.MeshPhysicalMaterial({ color: score.appearance.palette.pupil, roughness: 0.22, clearcoat: 0.5 });
  for (const side of [-1, 1]) {
    const group = new THREE.Group();
    group.name = side > 0 ? 'eye-left' : 'eye-right';
    group.position.set(eyeData.centerXM - headOrigin.x, eyeData.centerYM, side * eyeData.lateralM);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(eyeData.radiusM, 24, 16), eyeWhiteMaterial);
    const iris = new THREE.Mesh(new THREE.SphereGeometry(eyeData.irisRadiusM, 20, 12), irisMaterial);
    iris.scale.z = 0.36;
    iris.position.z = side * eyeData.radiusM * 0.83;
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(eyeData.pupilRadiusM, 18, 10), pupilMaterial);
    pupil.scale.z = 0.28;
    pupil.position.z = side * eyeData.radiusM * 1.02;
    group.add(eye, iris, pupil);
    headBone.add(group);
  }

  const mouth = parts.mouth;
  const line = mouth.openingSideProfileM;
  const mouthShape = new THREE.Shape();
  mouthShape.moveTo(line[0][0] - headOrigin.x, line[0][1] + 0.003);
  for (const [x, y] of line.slice(1)) mouthShape.lineTo(x - headOrigin.x, y + 0.003);
  for (const [x, y] of [...line].reverse()) mouthShape.lineTo(x - headOrigin.x, y - 0.006);
  mouthShape.closePath();
  const mouthGeometry = new THREE.ShapeGeometry(mouthShape, 12);
  const mouthMaterial = new THREE.MeshStandardMaterial({ color: score.appearance.palette.mouthInterior, roughness: 0.82, side: THREE.DoubleSide });
  for (const side of [-1, 1]) {
    const interior = new THREE.Mesh(mouthGeometry, mouthMaterial);
    interior.name = `mouth-interior-${side > 0 ? 'left' : 'right'}`;
    interior.position.z = side * mouth.interiorHalfWidthM;
    headBone.add(interior);
  }

  const jawBone = hierarchy.boneById.get('jaw');
  const jawOrigin = hierarchy.absoluteOriginById.get('jaw');
  const jawGeometry = staticLoftGeometry(mouth.lowerJawStations, 22, 28, jawOrigin.toArray());
  jawGeometry.name = 'KF1_LOWER_JAW';
  const jawMesh = new THREE.Mesh(jawGeometry, bodyMaterial.clone());
  jawMesh.name = 'lower-jaw';
  jawMesh.castShadow = true;
  jawBone.add(jawMesh);

  const toothData = mouth.dentition;
  const toothMaterial = new THREE.MeshStandardMaterial({ color: 0xe7dfc7, roughness: 0.48 });
  const addTeeth = (parent, origin, count, lower) => {
    for (const side of [-1, 1]) {
      for (let i = 0; i < count; i += 1) {
        const t = count === 1 ? 0.5 : i / (count - 1);
        const x = lerp(toothData.startXM, toothData.endXM, t);
        const baseY = lerp(0.121, 0.132, t) + (lower ? -0.004 : 0.006);
        const height = toothData.toothHeightM * (0.72 + 0.28 * Math.sin((i + 1) * 1.7) ** 2);
        const geometry = new THREE.ConeGeometry(toothData.toothRadiusM, height, 7, 1);
        const tooth = new THREE.Mesh(geometry, toothMaterial);
        tooth.position.set(x - origin.x, baseY - origin.y, side * 0.019 - origin.z);
        if (!lower) tooth.rotation.z = Math.PI;
        parent.add(tooth);
      }
    }
  };
  addTeeth(headBone, headOrigin, toothData.upperCountPerSide, false);
  addTeeth(jawBone, jawOrigin, toothData.lowerCountPerSide, true);

  const featureMaterial = new THREE.MeshStandardMaterial({ color: 0x334247, roughness: 0.55 });
  const gill = parts.gillCover;
  for (const side of [-1, 1]) {
    const points = gill.curveM.map(([x, y]) => [x - headOrigin.x, y, side * 0.057]);
    const mesh = new THREE.Mesh(makeCurveTube(points, gill.tubeRadiusM), featureMaterial);
    mesh.name = `gill-cover-${side}`;
    headBone.add(mesh);
  }
  return { jawBone };
}

function makeLateralLine(score, hierarchy, material) {
  const curve = score.construction.parts.lateralLine.curveM;
  const radius = score.construction.parts.lateralLine.tubeRadiusM;
  const group = new THREE.Group();
  group.name = 'lateral-line-segments';
  const bodySpecs = score.motion.skeleton.bodyBones;
  for (const side of [-1, 1]) {
    for (let i = 0; i < curve.length - 1; i += 1) {
      const [x1, y1] = curve[i];
      const [x2, y2] = curve[i + 1];
      const mid = (x1 + x2) / 2;
      let nearest = 0;
      for (let j = 1; j < bodySpecs.length; j += 1) if (Math.abs(bodySpecs[j].xM - mid) < Math.abs(bodySpecs[nearest].xM - mid)) nearest = j;
      const bone = hierarchy.bodyBones[nearest];
      const originX = bodySpecs[nearest].xM;
      const z1 = side * (sectionAt(score.construction.sections.stations, x1).halfWidthM + 0.0008);
      const z2 = side * (sectionAt(score.construction.sections.stations, x2).halfWidthM + 0.0008);
      const geometry = makeCurveTube([[x1 - originX, y1, z1], [x2 - originX, y2, z2]], radius, 8);
      const line = new THREE.Mesh(geometry, material.clone());
      bone.add(line);
    }
  }
  return group;
}

export function build(resolvedScore, worldContext = {}) {
  const score = parseScore(resolvedScore);
  const root = new THREE.Group();
  root.name = score.object.id;
  root.userData.kaopu = { instrument: INSTRUMENT_ID, version: VERSION, objectId: score.object.id };
  const hierarchy = createBoneHierarchy(score);
  const geometry = buildBodyGeometry(score);
  const bodyMaterial = makeBodyMaterial(score);
  const body = new THREE.SkinnedMesh(geometry, bodyMaterial);
  body.name = 'score-driven-skinned-body';
  body.frustumCulled = false;
  body.castShadow = true;
  body.receiveShadow = true;
  body.add(hierarchy.rootBone);
  const skeleton = new THREE.Skeleton(hierarchy.allBones);
  body.bind(skeleton);
  root.add(body);

  const finMaterial = makeFinMaterial(score);
  const finMeshes = [];
  for (const fin of score.construction.parts.fins) {
    const bone = hierarchy.boneById.get(fin.bone);
    const origin = hierarchy.absoluteOriginById.get(fin.bone);
    finMeshes.push(buildFin(fin, bone, origin, finMaterial));
  }
  const details = attachHeadDetails(score, hierarchy, bodyMaterial, root);
  makeLateralLine(score, hierarchy, new THREE.MeshStandardMaterial({ color: 0x394a4d, roughness: 0.6 }));
  const skeletonHelper = new THREE.SkeletonHelper(body);
  skeletonHelper.name = 'KF1_SKELETON_HELPER';
  skeletonHelper.visible = false;
  root.add(skeletonHelper);

  const handle = {
    score,
    root,
    body,
    skeleton,
    skeletonHelper,
    geometry,
    bodyMaterial,
    finMeshes,
    hierarchy,
    jawBone: details.jawBone,
    state: { mode: score.performance.initialState.mode, time: score.performance.time, worldInputs: worldContext },
    disposed: false
  };
  update(handle, handle.state.time, worldContext, handle.state);
  root.updateMatrixWorld(true);
  return handle;
}

function modeFor(handle, savedState) {
  const requested = savedState?.mode ?? handle.state.mode ?? handle.score.behavior.states.default;
  const mode = handle.score.motion.modes[requested];
  if (!mode) throw new Error(`未知动作模式：${requested}`);
  return { id: requested, data: mode };
}

export function update(handle, time, worldInputs = {}, savedState = {}) {
  if (!handle || handle.disposed) throw new Error('不能更新已释放或无效的 PerformerHandle');
  finite(time, 'time');
  const { id, data } = modeFor(handle, savedState);
  const bodyBones = handle.hierarchy.bodyBones;
  bodyBones.forEach((bone) => bone.rotation.set(0, 0, 0));
  handle.hierarchy.branchBones.forEach((bone) => bone.rotation.set(0, 0, 0));
  const phaseBase = time * (data.frequencyHz ?? 0) * Math.PI * 2;
  if (id === 'RIG_SERIAL_CHECK') {
    const active = Math.floor(time * 1.35) % bodyBones.length;
    bodyBones[active].rotation.y = Math.sin(phaseBase) * (data.amplitudeDeg ?? 0) * DEG;
  } else {
    const count = bodyBones.length;
    for (let i = 0; i < count; i += 1) {
      const u = i / Math.max(1, count - 1);
      const envelope = 0.12 + (data.tailGain ?? 1) * Math.pow(u, 2.35);
      const travelling = Math.sin(phaseBase - i * (data.phaseLagRad ?? 0.5));
      const biasLocal = (data.biasDeg ?? 0) / Math.max(1, count - 1) * THREE.MathUtils.smoothstep(u, 0.18, 1);
      bodyBones[i].rotation.y = ((data.amplitudeDeg ?? 0) * envelope * travelling + biasLocal) * DEG;
      bodyBones[i].rotation.z = Math.sin(phaseBase * 0.55 - i * 0.22) * (data.amplitudeDeg ?? 0) * 0.035 * u * DEG;
    }
  }
  const roll = (data.rollDeg ?? 0) * Math.sin(phaseBase * 0.5) * DEG;
  bodyBones[0].rotation.x = roll;
  if (handle.jawBone) handle.jawBone.rotation.z = Math.max(0, Math.sin(phaseBase - 0.4)) * (data.jawDeg ?? 0) * DEG;
  const left = handle.hierarchy.boneById.get('pectoral_left');
  const right = handle.hierarchy.boneById.get('pectoral_right');
  const common = data.pectoralDeg ?? 0;
  const leftDeg = data.pectoralLeftDeg ?? common;
  const rightDeg = data.pectoralRightDeg ?? common;
  if (left) left.rotation.x = (leftDeg * (0.65 + 0.35 * Math.sin(phaseBase + 0.7))) * DEG;
  if (right) right.rotation.x = (-rightDeg * (0.65 + 0.35 * Math.sin(phaseBase + Math.PI + 0.7))) * DEG;
  handle.state = { mode: id, time, worldInputs: structuredClone(worldInputs) };
  handle.root.updateMatrixWorld(true);
  handle.skeleton.update();
  return { mode: id, time, worldInputs: handle.state.worldInputs };
}

export function measure(handle) {
  if (!handle || handle.disposed) throw new Error('不能测量已释放或无效的 PerformerHandle');
  let meshes = 0;
  let vertices = 0;
  let triangles = 0;
  let materials = 0;
  handle.root.traverse((object) => {
    if (object.isMesh || object.isSkinnedMesh) {
      meshes += 1;
      const geometry = object.geometry;
      vertices += geometry?.getAttribute('position')?.count ?? 0;
      triangles += geometry?.index ? geometry.index.count / 3 : (geometry?.getAttribute('position')?.count ?? 0) / 3;
      materials += Array.isArray(object.material) ? object.material.length : object.material ? 1 : 0;
    }
  });
  const bounds = new THREE.Box3().setFromObject(handle.root);
  const size = new THREE.Vector3();
  bounds.getSize(size);
  return {
    objectId: handle.score.object.id,
    meshes,
    vertices,
    triangles: Math.round(triangles),
    materials,
    bones: handle.skeleton.bones.length,
    bounds: { min: bounds.min.toArray(), max: bounds.max.toArray(), size: size.toArray() },
    bodyGeometryBytes: Object.values(handle.geometry.attributes).reduce((sum, attribute) => sum + attribute.array.byteLength, 0) + (handle.geometry.index?.array.byteLength ?? 0)
  };
}

function copyAttribute(geometry, name) {
  const attribute = geometry.getAttribute(name);
  return attribute ? attribute.array.slice() : null;
}
function quickFingerprint(arrays) {
  let hash = 2166136261 >>> 0;
  for (const array of arrays) {
    if (!array) continue;
    const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
    for (let i = 0; i < bytes.length; i += 1) {
      hash ^= bytes[i];
      hash = Math.imul(hash, 16777619) >>> 0;
    }
  }
  return hash.toString(16).padStart(8, '0');
}
export function snapshot(handle) {
  if (!handle || handle.disposed) throw new Error('不能快照已释放或无效的 PerformerHandle');
  const arrays = {
    position: copyAttribute(handle.geometry, 'position'),
    normal: copyAttribute(handle.geometry, 'normal'),
    skinIndex: copyAttribute(handle.geometry, 'skinIndex'),
    skinWeight: copyAttribute(handle.geometry, 'skinWeight'),
    index: handle.geometry.index?.array.slice() ?? null,
    boneMatrices: handle.skeleton.boneMatrices.slice()
  };
  return {
    instrument: `${INSTRUMENT_ID}@${VERSION}`,
    objectId: handle.score.object.id,
    mode: handle.state.mode,
    time: handle.state.time,
    measure: measure(handle),
    arrays,
    diagnosticFingerprint32: quickFingerprint(Object.values(arrays))
  };
}
function arraysEqual(a, b) {
  if (a === null || b === null) return a === b;
  if (a.constructor !== b.constructor || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) if (!Object.is(a[i], b[i])) return false;
  return true;
}
export function compareSnapshots(a, b) {
  const keys = ['position', 'normal', 'skinIndex', 'skinWeight', 'index', 'boneMatrices'];
  const differences = keys.filter((key) => !arraysEqual(a.arrays[key], b.arrays[key]));
  return { equal: differences.length === 0, differences, measureEqual: JSON.stringify(a.measure) === JSON.stringify(b.measure) };
}
export function equalSnapshots(a, b) { return compareSnapshots(a, b).equal; }

export function explain(scorePath) {
  const map = {
    'construction.sections.stations': '鱼体对象专用的轴向中心、宽度、高度和横截面形状；由谱拥有。',
    'construction.parts.fins': '鳍的位置、轮廓、厚度和挂接骨；由谱拥有，乐器只提供通用挤出与绑定。',
    'motion.skeleton': '对象骨位与分支骨位置；谱提供，乐器建立真正 Skeleton。',
    'motion.modes': '频率、幅度、相位和耦合；谱提供，乐器执行传播。',
    'appearance': '本对象的调色、斑纹与材质参数；谱提供，乐器执行程序化表面。'
  };
  return map[scorePath] ?? '该路径未在 KF1 解释索引中登记。';
}

export function dispose(handle) {
  if (!handle || handle.disposed) return;
  const geometries = new Set();
  const materials = new Set();
  handle.root.traverse((object) => {
    if (object.geometry) geometries.add(object.geometry);
    if (Array.isArray(object.material)) object.material.forEach((material) => materials.add(material));
    else if (object.material) materials.add(object.material);
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
  handle.skeleton.dispose();
  handle.root.clear();
  handle.disposed = true;
}

export const KF1 = Object.freeze({ VERSION, INSTRUMENT_ID, ABI, validate, parseScore, build, update, measure, snapshot, compareSnapshots, equalSnapshots, explain, dispose });
