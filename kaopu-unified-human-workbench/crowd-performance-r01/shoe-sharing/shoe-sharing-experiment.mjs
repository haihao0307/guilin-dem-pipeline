import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import * as T from 'three';
import {buildStyle} from '../cloth/shoe-workshop/r14/src/model.mjs';
import {StyleMaterials} from '../cloth/shoe-workshop/r14/src/materials.mjs';
import {prepareSharedNativeShoe} from './shared-native-shoes.mjs';

const outURL = new URL('./results/latest-shoe-sharing.json', import.meta.url);
const recorded = JSON.parse(await fs.readFile(new URL('./evidence/recorded-shoe-sharing.json', import.meta.url)));
const counts = JSON.parse(await fs.readFile(new URL('../cloth/shoe-counts.json', import.meta.url)));
const source = {repository: recorded.sourceRepository, source: recorded.sourceCommit, sourceFiles: recorded.sourceFilesVerified};
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const sourceChecks = [];
for (const file of source.sourceFiles) {
  const bytes = await fs.readFile(new URL('../cloth/' + file.path, import.meta.url));
  const actual = sha(bytes);
  assert.equal(actual, file.sha256, 'Changed native source: ' + file.path);
  sourceChecks.push({path: file.path, sha256: actual});
}

// R14 heritage initialization uses scanned textures, not the GPU LeatherKernel
// branch. Provide only native image decoding plus a declared anisotropy input.
// No fake renderer.render / shader baking / GPU context is supplied.
let decoderRequire = createRequire(import.meta.url);
try { decoderRequire.resolve('@napi-rs/canvas'); } catch (error) {
  if (!process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES) throw new Error('Run npm install --ignore-scripts in shoe-sharing/ to install the pinned WebP decoder.', {cause: error});
  decoderRequire = createRequire(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES + '/package.json');
}
const decoderPackage = decoderRequire('@napi-rs/canvas/package.json');
assert.equal(decoderPackage.version, '0.1.100', 'Use the recorded native WebP decoder version.');
const {Image} = decoderRequire('@napi-rs/canvas');
const imageSources = new WeakMap();
globalThis.innerWidth = 1280;
globalThis.document = {
  createElementNS(_namespace, name) {
    assert.equal(name, 'img', 'Native material factory unexpectedly needs other DOM features');
    const image = new Image();
    image.addEventListener = (event, handler) => {
      image['on' + event] = () => {
        if (event === 'load') imageSources.set(image, sha(image.src));
        handler.call(image);
      };
    };
    image.removeEventListener = event => {image['on' + event] = undefined;};
    return image;
  }
};
const scanBytes = await fs.readFile(new URL('../cloth/shoe-workshop/r04/vendor/scan-data.json', import.meta.url));
assert.equal(sha(scanBytes), '72a9b6f1075edb2f6b929bf4ad3b02cb603f80f71af3b809594df5fea0095055');
const scan = JSON.parse(scanBytes);
const capabilities = {capabilities: {getMaxAnisotropy: () => 8}};
const nativeMaterials = new StyleMaterials(capabilities, scan);
await nativeMaterials.init();

function bufferSnapshot(attribute) {
  if (!attribute) return null;
  const array = attribute.array;
  assert.ok(array && !attribute.isInterleavedBufferAttribute, 'Unexpected interleaved native geometry');
  return {type: array.constructor.name, itemSize: attribute.itemSize,
    count: attribute.count, normalized: attribute.normalized, usage: attribute.usage,
    gpuType: attribute.gpuType, byteLength: array.byteLength,
    sha256: sha(new Uint8Array(array.buffer, array.byteOffset, array.byteLength))};
}
function geometrySnapshot(geometry) {
  return {attributes: Object.fromEntries(Object.keys(geometry.attributes).sort()
    .map(key => [key, bufferSnapshot(geometry.attributes[key])])),
    index: bufferSnapshot(geometry.index), groups: geometry.groups,
    drawRange: {start: geometry.drawRange.start, count: String(geometry.drawRange.count)},
    morphTargetsRelative: geometry.morphTargetsRelative,
    boundingBox: geometry.boundingBox ? [geometry.boundingBox.min.toArray(), geometry.boundingBox.max.toArray()] : null};
}
const geometryHash = geometry => sha(JSON.stringify(geometrySnapshot(geometry)));

function textureSnapshot(texture) {
  const image = texture.image;
  const pixels = image?.data;
  const imageHash = pixels
    ? sha(new Uint8Array(pixels.buffer, pixels.byteOffset, pixels.byteLength))
    : imageSources.get(image);
  assert.ok(imageHash, 'Missing original native texture data fingerprint');
  const result = {type: texture.constructor.name, image: {width: image.width,
    height: image.height, dataSha256: imageHash, decoded: true},
    format: texture.format, dataType: texture.type, colorSpace: texture.colorSpace,
    wrapS: texture.wrapS, wrapT: texture.wrapT, magFilter: texture.magFilter,
    minFilter: texture.minFilter, flipY: texture.flipY, anisotropy: texture.anisotropy,
    generateMipmaps: texture.generateMipmaps, premultiplyAlpha: texture.premultiplyAlpha,
    unpackAlignment: texture.unpackAlignment, mapping: texture.mapping, channel: texture.channel,
    repeat: texture.repeat.toArray(), offset: texture.offset.toArray(), center: texture.center.toArray(),
    rotation: texture.rotation, matrixAutoUpdate: texture.matrixAutoUpdate,
    matrix: texture.matrix.toArray()};
  return result;
}
function canonical(value, seen = new Set()) {
  if (value === undefined) return '<undefined>';
  if (typeof value === 'number' && !Number.isFinite(value)) return String(value);
  if (typeof value === 'function') return value.toString();
  if (value === null || typeof value !== 'object') return value;
  if (value.isTexture) return textureSnapshot(value);
  if (seen.has(value)) throw new Error('Unexpected cyclic material state');
  seen.add(value);
  let result;
  if (ArrayBuffer.isView(value)) result = Array.from(value);
  else if (Array.isArray(value)) result = value.map(v => canonical(v, seen));
  else result = Object.fromEntries(Object.keys(value).sort().filter(k =>
    !['id', 'uuid', 'version', '_listeners', 'onBeforeCompile', 'customProgramCacheKey'].includes(k)).map(k => [k, canonical(value[k], seen)]));
  seen.delete(value);
  return result;
}
function materialSnapshot(material) {
  const shader = {vertexShader: T.ShaderLib.physical.vertexShader,
    fragmentShader: T.ShaderLib.physical.fragmentShader,
    uniforms: T.UniformsUtils.clone(T.ShaderLib.physical.uniforms)};
  material.onBeforeCompile(shader, capabilities);
  return {state: canonical(material), customProgramCacheKey: material.customProgramCacheKey(),
    shaderHookSource: material.onBeforeCompile.toString(), cacheHookSource: material.customProgramCacheKey.toString(),
    shaderSourceSha256: sha(shader.vertexShader + '\n' + shader.fragmentShader),
    compiledUniformValues: canonical(shader.uniforms)};
}
const materialHash = material => sha(JSON.stringify(materialSnapshot(material)));
const listMaterials = value => Array.isArray(value) ? value : [value];
function originalMaterialClone(material) {
  const clone = material.clone();
  // Native R14 copyMaterial explicitly retains these callback references, too.
  clone.onBeforeCompile = material.onBeforeCompile;
  clone.customProgramCacheKey = material.customProgramCacheKey;
  return clone;
}
function nativePerActorShoe(resources, materialCopies) {
  const shoe = new T.Group();
  shoe.scale.setScalar(.001);
  for (const {part, styleId, geometry, material} of resources) {
    const bind = original => {
      if (!materialCopies) return original;
      if (!materialCopies.has(original)) materialCopies.set(original, originalMaterialClone(original));
      return materialCopies.get(original);
    };
    const mesh = new T.Mesh(geometry.clone(), Array.isArray(material) ? material.map(bind) : bind(material));
    mesh.name = part.id;
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.userData = {...part, geometry: undefined, style: styleId};
    shoe.add(mesh);
  }
  return shoe;
}
function placeActor(actor, i) {
  actor.position.set((i % 4) * .65, 0, Math.floor(i / 4) * .75);
  actor.rotation.y = (i % 3) * .11;
}
function createCrowd(registry, n, mode) {
  const crowd = new T.Group(), actors = [], shoes = [];
  for (let i = 0; i < n; i++) {
    const actor = new T.Group();
    placeActor(actor, i);
    let left, right;
    if (mode === 'shared') {
      left = registry.create({name: 'left-' + i});
      right = registry.create({name: 'right-' + i, mirror: true});
    } else {
      left = nativePerActorShoe(registry.resources, mode === 'per-actor-materials' ? new Map() : null);
      // The actual R14 pair implementation already shares both resources.
      right = left.clone(true);
      right.scale.x = -.001;
    }
    left.position.x = .069;
    right.position.x = -.069;
    actor.add(left, right); crowd.add(actor);
    actors.push(actor); shoes.push(left, right);
  }
  crowd.updateMatrixWorld(true);
  return {crowd, actors, shoes, mode};
}
function inventory(crowd) {
  const geometries = new Set(), materials = new Set(), textures = new Set(), buffers = new Set();
  let object3DCount = 0, meshCount = 0;
  crowd.traverse(object => {
    object3DCount++;
    if (!object.isMesh) return;
    meshCount++; geometries.add(object.geometry);
    for (const material of listMaterials(object.material)) materials.add(material);
  });
  for (const geometry of geometries) {
    for (const attribute of [...Object.values(geometry.attributes), geometry.index].filter(Boolean)) buffers.add(attribute.array.buffer);
  }
  for (const material of materials) for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
  return {object3DCount, meshCount, uniqueGeometryCount: geometries.size,
    uniqueMaterialCount: materials.size, uniqueTextureCount: textures.size,
    uniqueGeometryArrayBufferCount: buffers.size,
    retainedGeometryArrayBufferBytes: [...buffers].reduce((n, buffer) => n + buffer.byteLength, 0)};
}
function worldState(object) {
  const state = [];
  object.traverse(node => state.push(node.matrixWorld.toArray()));
  return state;
}
function mutateOnlyFirstLeft(crowd) {
  const b = crowd.actors.length > 1 ? worldState(crowd.actors[1]) : null;
  const right = worldState(crowd.shoes[1]);
  const left = crowd.shoes[0];
  left.position.y += .14;
  left.rotation.x += .47;
  left.rotation.z += .03;
  crowd.crowd.updateMatrixWorld(true);
  assert.deepEqual(worldState(crowd.shoes[1]), right, 'Left-foot transform changed right foot');
  if (b) assert.deepEqual(worldState(crowd.actors[1]), b, 'Actor A transform changed B');
  return {otherShoeUnchanged: true, otherActorUnchanged: b ? true : 'not-applicable'};
}
function validate(crowd, registry, before) {
  const geometryHashes = new Map(), materialHashes = new Map();
  let meshChecks = 0, materialBindingChecks = 0;
  for (const shoe of crowd.shoes) for (let i = 0; i < shoe.children.length; i++) {
    const mesh = shoe.children[i], resource = registry.resources[i];
    if (!geometryHashes.has(mesh.geometry)) geometryHashes.set(mesh.geometry, geometryHash(mesh.geometry));
    assert.equal(geometryHashes.get(mesh.geometry), before.geometry[i], 'Native vertex/normal/UV/index/group mismatch');
    if (crowd.mode === 'shared') assert.equal(mesh.geometry, resource.geometry, 'Geometry was copied');
    const originals = listMaterials(resource.material);
    listMaterials(mesh.material).forEach((material, j) => {
      if (!materialHashes.has(material)) materialHashes.set(material, materialHash(material));
      assert.equal(materialHashes.get(material), before.materials.get(originals[j]), 'Material parameters/shader/texture mismatch');
      assert.equal(material.onBeforeCompile, originals[j].onBeforeCompile, 'Shader hook changed');
      assert.equal(material.customProgramCacheKey, originals[j].customProgramCacheKey, 'Cache hook changed');
      if (crowd.mode === 'shared') assert.equal(material, originals[j], 'Material was copied');
      for (const [key, texture] of Object.entries(originals[j])) if (texture?.isTexture) assert.equal(material[key], texture, 'Texture copied/replaced');
      materialBindingChecks++;
    });
    meshChecks++;
  }
  return {meshChecks, materialBindingChecks, uniqueGeometryChecks: geometryHashes.size,
    uniqueMaterialChecks: materialHashes.size, byteExactGeometry: true,
    materialParametersAndGeneratedShaderSourceEqual: true, nativeTextureReferencesEqual: true};
}
function disposeCrowd(crowd, registry) {
  if (crowd.mode === 'shared') {for (const shoe of crowd.shoes) registry.release(shoe);}
  else {
    const geometry = new Set(), materials = new Set();
    crowd.crowd.traverse(o => {if(o.isMesh) {geometry.add(o.geometry); listMaterials(o.material).forEach(m => materials.add(m));}});
    for (const g of geometry) g.dispose();
    if (crowd.mode === 'per-actor-materials') for (const m of materials) m.dispose();
  }
  crowd.crowd.clear();
}

const rows = [], styles = [];
for (const id of ['penny', 'chelsea', 'monk', 'canvas']) {
  const model = buildStyle(id);
  const registry = prepareSharedNativeShoe(model, nativeMaterials);
  const before = {geometry: registry.resources.map(r => geometryHash(r.geometry)), materials: new Map()};
  for (const r of registry.resources) for (const m of listMaterials(r.material)) before.materials.set(m, materialHash(m));
  const one = registry.create();
  const oneInventory = inventory(one);
  registry.release(one);
  const known = counts.rows.find(row => row.id === id);
  assert.equal(oneInventory.retainedGeometryArrayBufferBytes, known.geometryBufferBytes, 'Native byte count drift');
  assert.equal(model.report.triangles, known.triangles, 'Native triangle count drift');
  assert.equal(model.parts.length, known.meshParts, 'Native mesh part count drift');
  styles.push({id, originalOneShoe: oneInventory, vertices: known.vertices,
    triangles: known.triangles, params: model.last.params,
    geometryFingerprints: registry.resources.map((r, i) => ({part: r.part.id, sha256: before.geometry[i], attributes: Object.keys(r.geometry.attributes), indexType: r.geometry.index.array.constructor.name})),
    materialFingerprints: [...before.materials].map(([material, hash]) => ({name: material.name, type: material.type,
      sha256: hash, shaderSourceSha256: materialSnapshot(material).shaderSourceSha256,
      parameters: canonical(material)}))});
  for (const n of [1, 4, 8, 16]) {
    const baseline = createCrowd(registry, n, 'per-actor-geometry');
    const candidate = createCrowd(registry, n, 'shared');
    const beforeBase = inventory(baseline.crowd), beforeShared = inventory(candidate.crowd);
    const baseIsolation = mutateOnlyFirstLeft(baseline), sharedIsolation = mutateOnlyFirstLeft(candidate);
    assert.deepEqual(worldState(candidate.crowd), worldState(baseline.crowd), 'World transforms differ');
    const baseChecks = validate(baseline, registry, before);
    const sharedChecks = validate(candidate, registry, before);
    const sharedGeometry = registry.resources.map(r => geometryHash(r.geometry));
    assert.deepEqual(sharedGeometry, before.geometry, 'Shared source geometry was mutated');
    for (const [m, hash] of before.materials) assert.equal(materialHash(m), hash, 'Shared source material mutated');
    assert.equal(beforeBase.retainedGeometryArrayBufferBytes, known.geometryBufferBytes * n);
    assert.equal(beforeShared.retainedGeometryArrayBufferBytes, known.geometryBufferBytes);
    assert.equal(beforeBase.meshCount, beforeShared.meshCount);
    const isolated = createCrowd(registry, n, 'per-actor-materials');
    const isolatedInventory = inventory(isolated.crowd);
    const isolatedChecks = validate(isolated, registry, before);
    assert.equal(isolatedInventory.uniqueMaterialCount, oneInventory.uniqueMaterialCount * n);
    const row = {style: id, actors: n, shoes: n * 2,
      nativePerActorGeometrySharedMaterials: beforeBase,
      sharedAcrossActors: beforeShared,
      perActorMaterialCopyAlternative: isolatedInventory,
      geometryBytesSaved: beforeBase.retainedGeometryArrayBufferBytes - beforeShared.retainedGeometryArrayBufferBytes,
      geometrySavingPercent: 100 * (1 - beforeShared.retainedGeometryArrayBufferBytes / beforeBase.retainedGeometryArrayBufferBytes),
      checks: {baseIsolation, sharedIsolation, worldTransformsExactlyEqual: true,
        baseChecks, sharedChecks, isolatedMaterialCopyChecks: isolatedChecks,
        sharedSourceBuffersUnchangedAfterTransforms: true, sourceMaterialsUnchanged: true}};
    rows.push(row);
    console.log(JSON.stringify({style: id, actors: n, shoes: n * 2,
      beforeBytes: beforeBase.retainedGeometryArrayBufferBytes, afterBytes: beforeShared.retainedGeometryArrayBufferBytes,
      savingPercent: row.geometrySavingPercent, sourcePreserved: true}));
    disposeCrowd(isolated, registry); disposeCrowd(candidate, registry); disposeCrowd(baseline, registry);
  }
  assert.equal(registry.activeCount, 0);
  registry.disposeGeometry();
  globalThis.gc?.();
}
for (const file of sourceChecks) assert.equal(sha(await fs.readFile(new URL('../cloth/' + file.path, import.meta.url))), file.sha256, 'Native source was modified');
// Replay check is separate from within-run native preservation assertions.
assert.deepEqual(rows, recorded.rows, 'Published replay differs from the original resource inventories or validation results');
for (const style of styles) {
  const expected = recorded.styles.find(s => s.id === style.id);
  assert.deepEqual(style.geometryFingerprints, expected.geometryFingerprints, 'Historical native geometry fingerprints changed');
  assert.deepEqual(style.materialFingerprints, expected.materialFingerprints, 'Historical native material fingerprints changed');
}
const evidence = {schema: 'native-shoe-resource-sharing-experiment@1', timestampUTC: new Date().toISOString(),
  sourceRepository: source.repository, sourceCommit: source.source, sourceFilesVerified: sourceChecks,
  scanData: {repositoryPath: 'shoe-workshop/r04/vendor/scan-data.json', sourceCommit: source.source,
    byteLength: scanBytes.length, sha256: sha(scanBytes), decodedWith: '@napi-rs/canvas native WebP decoder'},
  runtime: {node: process.version, threeRevision: T.REVISION,
    threeFileSha256: sha(await fs.readFile(process.env.THREE_PATH)), anisotropyInput: 8,
    gpuContextCreated: false, shaderSourcesGeneratedButNotGpuCompiled: true},
  scope: {measured: ['reachable typed-array ArrayBuffer bytes', 'unique BufferGeometry/Material/Texture objects',
    'independent Object3D transforms', 'native geometry and material/shader/texture identity'],
    notMeasured: ['GPU FPS', 'GPU VRAM', 'total process heap', 'material object bytes',
      'visual rendering', 'wearer fit', 'dynamic shoe flex physics', 'cloth/hair/body costs'],
    nativePairAlreadyShared: true,
    nativePairSourceLocation: 'shoe-workshop/r14/src/main.mjs:136',
    primaryBaseline: 'N independent native-geometry copies, each actor pair already shares geometry; one native StyleMaterials manager shared',
    secondaryBaseline: 'Optional per-actor Material copies (native parameters, shader callbacks and textures retained); do not claim repository already does this',
    candidate: 'Same exact size/bend/style/material recipe shares BufferGeometry and Material across all actors; each shoe owns distinct Object3D transforms',
    geometryPayloadIsExactCpuArrayBufferInventory: true,
    geometryPayloadIsNotGpuAllocationMeasurement: true,
    meshPartsDrawCallsAndTrianglesAreNotReduced: true,
    varyingSizeOrBendOrMaterialNeedsAnotherResourceKey: true,
    perActorVertexDeformationMustFirstDetachSharedGeometry: true,
    upstreamSourceUnmodified: true},
  allChecksPassed: true, reproducesRecordedInventoriesAndFingerprints: true,
  decoderPackage: {name: decoderPackage.name, version: decoderPackage.version}, styles, rows};
await fs.mkdir(new URL('./results/', import.meta.url), {recursive: true});
await fs.writeFile(outURL, JSON.stringify(evidence, null, 2) + '\n');
nativeMaterials.dispose();
console.log(JSON.stringify({allChecksPassed: true, cases: rows.length, evidenceFile: outURL.pathname}));
