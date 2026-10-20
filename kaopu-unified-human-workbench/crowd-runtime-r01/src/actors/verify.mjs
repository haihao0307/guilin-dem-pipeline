/** No GPU rendering or FPS. Uses original NativeMotion/NativeBinding and
 * original 104-bone retained MP05 person as a CPU interface fixture. Its control
 * mesh deliberately has no display refinement; it is NOT the browser P01/R07.
 * The browser factory always uses the actual source viewer's complete mesh.
 */
import assert from 'node:assert/strict';
import {readFile, writeFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {NativeMotion} from '../../../perf-audit/hair/f13/vendor/fiber/NativeMotion.mjs';
import {buildStyle, STYLES} from '../../../perf-audit/garments/shoe-workshop/r14/src/model.mjs';
import {createNativeActorFactory} from './NativeActorFactory.mjs';
import {measureNativeFeet, createNativeShoeFactory} from './NativeShoeBinding.mjs';

globalThis.window = {};
const fixtureBytes = await readFile(new URL('../../../perf-audit/garments/mp05-r10/assets/native-person.json.gz', import.meta.url));
const fixture = JSON.parse(gunzipSync(fixtureBytes));
const model = {...fixture, positions: Float32Array.from(fixture.positions), faces: Uint32Array.from(fixture.faces),
  lastBodyDriver: {rig: fixture.rig, packet: {weights: fixture.rig.weights, restPositionsPerInfluence: fixture.rig.restPositionsPerInfluence}}};
const geometry = new THREE.BufferGeometry();
const display = new Float32Array(model.positions.length);
for (let i = 0; i < display.length; i += 3) display.set([model.positions[i], model.positions[i + 2], -model.positions[i + 1]], i);
geometry.setAttribute('position', new THREE.BufferAttribute(display, 3)); geometry.setIndex(new THREE.BufferAttribute(model.faces, 1));
geometry.computeVertexNormals();
geometry.addGroup(0, 12000, 0); geometry.addGroup(12000, model.faces.length - 12000, 1);
const material = new THREE.MeshPhysicalMaterial({roughness: .42}), secondary = new THREE.MeshStandardMaterial({roughness: .71});
const immutableShapeTexture = new THREE.DataTexture(new Float32Array([.1, .2, .3, 1]), 1, 1);
const optical = {uFPass: {value: 0}, uCKeyView: {value: new THREE.Vector3(1, 2, 3)},
  nativeShapeTest: {value: new THREE.Vector3(1, 2, 3)}, nativeInputTexture: {value: immutableShapeTexture}};
material.onBeforeCompile = shader => {
  Object.assign(shader.uniforms, optical);
};
const scene = new THREE.Scene(), renderer = {getContext() {throw Error('A GPU operation is outside this test');}};
const mesh = new THREE.Mesh(geometry, [material, secondary]);
mesh.position.y = -Math.min(...Array.from(model.positions).filter((_, i) => i % 3 === 2));
scene.add(mesh); mesh.updateMatrixWorld(true);
const viewer = {mesh, geometry, scene, renderer, skin: {material},
  surfaces: new Map([['fixture-control', {geometry, levels: []}]]),
  currentOcular: {source: geometry, geometry, pairs: []}};
const raw = {model, viewer, motion: new NativeMotion(model, viewer)};
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const geometryHash = () => sha(Buffer.concat([...Object.values(geometry.attributes), geometry.index]
  .map(a => Buffer.from(a.array.buffer, a.array.byteOffset, a.array.byteLength))));
const beforeHash = geometryHash();
const factory = await createNativeActorFactory({THREE, raw});
const a = await factory.create({id: 'a', position: [-1.3, 0, .2], rotationY: -.25, mode: 'walk', phaseSeconds: .21});
const b = await factory.create({id: 'b', position: [1.3, 0, -.2], rotationY: .4, mode: 'run', phaseSeconds: .08});
const checks = [];
function checked(name, callback) { callback(); checks.push({name, passed: true}); }
checked('original full-CSR 104-bone constructors and native captured clips', () => {
  assert.ok(a.motion instanceof NativeMotion); assert.ok(b.motion instanceof NativeMotion);
  assert.equal(a.motion.native.names.length, 104);
  assert.equal(a.motion.native.report.weightsTruncated, false);
  assert.equal(a.motion.mode, 'walk'); assert.equal(b.motion.mode, 'run');
  assert.ok(a.motion.clip.metrics.sourceClip); assert.ok(b.motion.clip.metrics.sourceClip);
  assert.notEqual(a.motion.clip, b.motion.clip);
});
checked('shared original mesh attributes/groups with independent material and bone/cache resources', () => {
  assert.equal(a.mesh.geometry, geometry); assert.equal(b.mesh.geometry, geometry);
  assert.equal(a.mesh.material.length, 2); assert.equal(a.mesh.geometry.groups.length, 2);
  assert.notEqual(a.mesh.material[0], b.mesh.material[0]);
  assert.notEqual(a.motion.native.boneData, b.motion.native.boneData);
  assert.notEqual(a.motion.native.bones, b.motion.native.bones);
  assert.notEqual(a.motion.skinCache.target, b.motion.skinCache.target);
  assert.notEqual(a.finalSkinMatrixData.buffer, b.finalSkinMatrixData.buffer);
});
checked('each material receives one animation header and its own same-actor native uniforms', () => {
  const shaders = [];
  for (const actor of [a, b]) {
    for (const mat of actor.mesh.material) {
      const template = THREE.ShaderLib[mat.isMeshPhysicalMaterial ? 'physical' : 'standard'];
      const shader = {vertexShader: template.vertexShader, fragmentShader: template.fragmentShader, uniforms: THREE.UniformsUtils.clone(template.uniforms)};
      mat.onBeforeCompile(shader, renderer); shaders.push(shader);
      assert.equal((shader.vertexShader.match(/void mrEvaluate\(/g) || []).length, 1);
      assert.equal(shader.uniforms.mrBones.value, actor.motion.native.bones);
      assert.equal(shader.uniforms.mrCache0.value, actor.motion.skinCache.target.textures[0]);
    }
  }
  assert.equal(shaders[0].uniforms.nativeShapeTest, optical.nativeShapeTest);
  assert.equal(shaders[2].uniforms.nativeShapeTest, optical.nativeShapeTest);
  assert.equal(shaders[0].uniforms.nativeInputTexture.value, immutableShapeTexture);
  optical.uFPass.value = 2; optical.uCKeyView.value.set(-3, 4, 5);
  for (const shader of [shaders[0], shaders[2]]) {
    assert.equal(shader.uniforms.uFPass.value, 2);
    assert.deepEqual(shader.uniforms.uCKeyView.value.toArray(), [-3, 4, 5]);
  }
  assert.notEqual(shaders[0].uniforms.mrBones, shaders[2].uniforms.mrBones);
  assert.notEqual(shaders[0].uniforms.mrActive, shaders[2].uniforms.mrActive);
  optical.uFPass.value = 0;
});
checked('source detachment preserves original optical-control visibility and new actors', () => {
  assert.ok(factory.sourceObjects.includes(raw.viewer.mesh));
  factory.detachSource();
  assert.equal(raw.viewer.mesh.parent, null); assert.equal(raw.viewer.mesh.visible, true);
  assert.equal(a.worldRoot.parent, scene); assert.equal(b.worldRoot.parent, scene);
});
checked('tick duplicate is ignored; A phase does not advance or overwrite B', () => {
  const bBefore = [...b.finalSkinMatrixData], t = a.motion.time, version = a.motion.version;
  assert.equal(a.advance(1 / 60, 1), true); assert.equal(a.advance(1 / 60, 1), false);
  assert.ok(Math.abs(a.motion.time - t - 1 / 60) < 1e-12);
  assert.equal(a.motion.version, version + 1); assert.deepEqual([...b.finalSkinMatrixData], bBefore);
  assert.equal(a.frameSequence, 1); assert.equal(b.frameSequence, -1);
  assert.throws(() => a.advance(1 / 60, 0), /Monotonic/);
});
checked('clothing reference packet remains neutral with complete unpruned influences', () => {
  assert.equal(a.actorPacket.positions, model.positions); assert.equal(a.actorPacket.bindingPacked, a.motion.native.packed);
  assert.equal(a.actorPacket.rig.weights.values.length, fixture.rig.weights.values.length);
  for (const row of a.actorPacket.rig.skinMatrices) assert.deepEqual(row, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
});

// Native geometry is genuine R14. This test's material stub deliberately makes
// no appearance claim; exact original material equivalence was separately
// checked in the retained shoe-sharing experiment. No DOM/GPU is emulated.
const testMaterial = new THREE.MeshStandardMaterial(), shoeFactory = await createNativeShoeFactory({THREE, renderer,
  buildStyle, styles: STYLES, nativeMaterials: {get() {return testMaterial;}}});
const footMeasurements = measureNativeFeet(THREE, model, a.motion.native);
const shoesA = shoeFactory.bind(a), shoesB = shoeFactory.bind(b);
const shoeGeometries = shoesA.items[0].shoe.children.map(o => o.geometry);
const hashShoe = () => sha(Buffer.concat(shoeGeometries.flatMap(g => [...Object.values(g.attributes), g.index])
  .map(at => Buffer.from(at.array.buffer, at.array.byteOffset, at.array.byteLength))));
const shoeBefore = hashShoe();
checked('native toe and full-weight foot selection; mirrored millimetre scale', () => {
  for (const side of ['L', 'R']) {assert.ok(footMeasurements[side].vertices.length > 100); assert.ok(footMeasurements[side].lengthM > .2 && footMeasurements[side].lengthM < .35);}
  for (const shoes of [shoesA, shoesB]) {
    assert.deepEqual(shoes.items[0].shoe.scale.toArray(), [.001, .001, .001]);
    assert.deepEqual(shoes.items[1].shoe.scale.toArray(), [-.001, .001, .001]);
    assert.ok(shoes.requiredSoleLiftM > .005 && shoes.requiredSoleLiftM < .04);
    assert.equal(shoes.report().independentFootwearPhysics, false);
  }
  assert.equal(shoeFactory.report().uniqueNativeRecipes, 1);
});
checked('foot animation and root placement change A independently; shared buffers remain untouched', () => {
  for (let i = 0; i < shoeGeometries.length; i++) assert.equal(shoesA.items[0].shoe.children[i].geometry, shoesB.items[1].shoe.children[i].geometry);
  const bBefore = shoesB.items.map(item => [...item.frame.matrixWorld.elements]);
  const aBefore = [...shoesA.items[0].frame.matrixWorld.elements];
  a.advance(1 / 60, 2); a.worldRoot.position.x += .7; a.worldRoot.rotation.y += .2; shoesA.update(2);
  assert.notDeepEqual(shoesA.items[0].frame.matrixWorld.elements, aBefore);
  assert.deepEqual(shoesB.items.map(item => [...item.frame.matrixWorld.elements]), bBefore);
  for (const item of shoesA.items) {
    const expected = a.worldRoot.matrixWorld.clone().multiply(a.baseMeshMatrix)
      .multiply(a.motion.skinMatrix(item.foot.footName)).multiply(item.restFit);
    expected.elements.forEach((v, i) => assert.ok(Math.abs(v - item.frame.matrixWorld.elements[i]) < 1e-12));
  }
  assert.equal(hashShoe(), shoeBefore); assert.equal(geometryHash(), beforeHash);
});
await a.setMotion('jump', {phaseSeconds: .3});
checked('original captured jump and neutral idle remain finite with fixed bone lengths', () => {
  assert.equal(a.motion.mode, 'jump'); assert.ok(a.motion.clip.metrics.sourceClip);
  a.advance(1 / 60, 3); assert.ok(a.finalSkinMatrixData.every(Number.isFinite));
  assert.ok(a.motion.sampler.boneError() < 1e-5);
});
await a.setMotion('idle');
checked('idle publishes a neutral current pose instead of stale jump matrices', () => {
  a.advance(1 / 60, 4);
  a.finalSkinMatrices.forEach(row => row.forEach((v, i) => assert.ok(Math.abs(v - (i % 5 === 0 ? 1 : 0)) < 2e-6)));
});
const beforeDispose = {actor: a.report(), shoes: shoeFactory.report()};
let originalGeometryDisposals = 0, sharedShoeDisposals = 0;
geometry.addEventListener('dispose', () => originalGeometryDisposals++);
for (const g of shoeGeometries) g.addEventListener('dispose', () => sharedShoeDisposals++);
a.dispose();
checked('disposing A preserves B and every shared geometry', () => {
  assert.equal(originalGeometryDisposals, 0); assert.equal(sharedShoeDisposals, 0);
  assert.equal(shoeFactory.report().actors, 1); assert.equal(factory.actors.size, 1);
  b.advance(1 / 60, 5); assert.ok(b.finalSkinMatrixData.every(Number.isFinite));
});
factory.dispose(); shoeFactory.dispose(); raw.motion.dispose();
checked('last shoe owner releases each native geometry once; donor body ownership retained', () => {
  assert.equal(sharedShoeDisposals, shoeGeometries.length); assert.equal(originalGeometryDisposals, 0);
});
const evidence = {schema: 'native-crowd-actor-interface-verification/1', measuredAtUTC: new Date().toISOString(),
  scope: 'CPU interface/coordinate/resource verification using original F13 motion code and retained MP05 104-bone control-topology fixture; no browser P01 rendering, no GPU timings or FPS',
  fixtureCompressedSHA256: sha(fixtureBytes), completeBrowserDisplayMeshTested: false,
  tests: checks, nativeControlGeometrySHA256Before: beforeHash, nativeControlGeometrySHA256After: geometryHash(),
  nativeShoeGeometrySHA256Before: shoeBefore, nativeShoeGeometrySHA256After: hashShoe(),
  feet: Object.fromEntries(Object.entries(footMeasurements).map(([side, f]) => [side,
    {footBone: f.footName, toeBones: f.toeNames, vertices: f.vertices.length, lengthM: f.lengthM, widthM: f.widthM}])),
  beforeDispose};
await writeFile(new URL('./verification.json', import.meta.url), JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify({passed: checks.length, total: checks.length, scope: evidence.scope,
  shoeGroundLiftM: beforeDispose.actor.shoes.requiredSoleLiftM, originalShoeRecipes: beforeDispose.shoes.uniqueNativeRecipes}));
