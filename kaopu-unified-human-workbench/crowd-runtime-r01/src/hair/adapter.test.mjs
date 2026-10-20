// Math/lifecycle tests only. These do not claim a rendered F13/GPU benchmark.
import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from '../../../perf-audit/hair/f13/vendor/three.module.js';
import { assertRigid, createMotionFacade, placeSolver } from './placement.mjs';
import { createHairFactory, SOURCE_LOCK } from './index.mjs';

const vector = (matrix, p) => new THREE.Vector3(...p).applyMatrix4(matrix).toArray();
const near = (actual, expected, tolerance = 1e-9) => {
  assert.equal(actual.length, expected.length);
  actual.forEach((v, i) => assert.ok(Math.abs(v - expected[i]) < tolerance, `${i}: ${v} != ${expected[i]}`));
};
const pose = (x, yaw = 0) => new THREE.Matrix4().makeTranslation(x, .2, -1)
  .multiply(new THREE.Matrix4().makeRotationY(yaw));

function motionFixture() {
  return {
    active: true, playing: true, version: 0, time: 0, advances: 0,
    native: {}, skinCache: { target: { textures: [new THREE.Texture()] } },
    airVelocity: [1, 0, .5], kinematics: null, input: null,
    skinMatrix() { return this.active ? new THREE.Matrix4().makeTranslation(this.version * .02, .03, 0) : new THREE.Matrix4(); },
    sampleDisplay(index, p) { return this.active ? p.map((v, i) => v + (i === 0 ? this.version * .02 : 0)) : p; },
    sampleDisplayInto(index, x, y, z, out) { out.set?.([x + this.version * .02, y, z]); if (!out.set) { out[0] = x + this.version * .02; out[1] = y; out[2] = z; } return out; },
    advance(dt) { this.advances++; this.time += dt; },
    prepareRender() {},
    updateKinematics(frame) { this.kinematics = { x: frame.elements[12] }; this.input = { air: [...this.airVelocity] }; },
  };
}

function photoFixture() {
  const frame = new THREE.Matrix4().makeTranslation(0, .5, 0);
  const shape = { rest: frame.clone(), frame: frame.clone(), previous: frame.clone(),
    inverse: frame.clone().invert(), previousInverse: frame.clone().invert() };
  const data = Float64Array.from([.1, .6, .2, .15, .65, .25]);
  return {
    reference: data.slice(), restFrame: frame.clone(), inverseRest: frame.clone().invert(),
    binding: { frame: frame.clone(), restFrame: frame.clone(), inverse: frame.clone().invert(),
      frameVersion: 0, nativeKey: 'old', fullNativeKey: 'old' },
    dynamics: { q: data.slice(), rest: data.slice(), previous: data.slice(), equilibrium: data.slice(),
      sleepReference: data.slice(), positions: data.slice(), anchors: data.slice(),
      velocity: Float64Array.from([1, 2, 3, 4, 5, 6]),
      lengths: new Float64Array([.1]), localBend: new Float64Array([.01, .02, .03]),
      equilibriumFrame: frame.clone(), contactCache: [1, 2], bundleFriction: { count: 2 }, writeOffsets() {} },
    collisions: { bodyFrame: frame.clone(), bodyInverse: frame.clone().invert(),
      headFrame: frame.clone(), previousHead: frame.clone(), headInverse: frame.clone().invert(), shapes: [shape],
      surface: { frame: frame.clone(), previousFrame: frame.clone(), inverse: frame.clone().invert(), dispose() {} } },
  };
}

test('world placement moves each owned point once and preserves material/constraint data', () => {
  const p = photoFixture(), before = [...p.reference], lengths = [...p.dynamics.lengths], bends = [...p.dynamics.localBend];
  const m = pose(3, .6);
  placeSolver(p, m);
  near([...p.reference], [...vector(m, before.slice(0, 3)), ...vector(m, before.slice(3))]);
  near([...p.dynamics.q], [...p.reference]);
  near(p.collisions.shapes[0].frame.elements, m.clone().multiply(new THREE.Matrix4().makeTranslation(0, .5, 0)).elements);
  near(p.collisions.shapes[0].frame.clone().multiply(p.collisions.shapes[0].inverse).elements, new THREE.Matrix4().elements);
  assert.deepEqual([...p.dynamics.lengths], lengths);
  assert.deepEqual([...p.dynamics.localBend], bends);
  assert.equal(p.dynamics.bundleFriction.count, 0);
  assert.equal(p.binding.nativeKey, null);
  assert.throws(() => assertRigid(new THREE.Matrix4().makeScale(1.2, 1.2, 1.2)), /rigid/);
});

test('world collision transport follows a moving/turning root without double translation', () => {
  const motion = motionFixture(), bridge = createMotionFacade(THREE, motion);
  const initial = pose(-2, -.4), current = pose(4, .8), point = [.1, .6, .2];
  bridge.sync(initial, true); bridge.enable(); motion.version = 5; bridge.sync(current);
  const transported = vector(bridge.facade.skinMatrix('head'), vector(initial, point));
  const expected = vector(current.clone().multiply(motion.skinMatrix('head')), point);
  near(transported, expected);
});

test('hair reads a final body pose and keeps its own kinematic history', () => {
  const motion = motionFixture(), bridge = createMotionFacade(THREE, motion), p = [.1, .2, .3];
  motion.version = 7;
  assert.equal(bridge.facade.active, false);
  near(bridge.facade.sampleDisplay(0, p), p);
  bridge.sync(pose(1), true); bridge.enable();
  bridge.facade.advance(1 / 60);
  assert.equal(motion.advances, 0);
  assert.equal(motion.time, 0);
  near(bridge.facade.sampleDisplay(0, p), [.24, .2, .3]);
  bridge.facade.updateKinematics(pose(1), 1 / 60);
  assert.equal(motion.kinematics, null);
  assert.equal(motion.input, null);
  assert.equal(bridge.state.kinematics.x, 1);
});

test('a still native pose retains world collider transport without stale skin samples', () => {
  const motion = motionFixture(), bridge = createMotionFacade(THREE, motion);
  const initial = pose(-2), current = pose(3, .4), p = [.1, .2, .3];
  bridge.sync(initial, true); bridge.enable(); motion.active = false; motion.playing = false; motion.version = 10; bridge.sync(current);
  assert.equal(bridge.facade.active, false);
  bridge.withBoneTransport(() => {
    assert.equal(bridge.facade.active, true);
    assert.equal(bridge.facade.playing, false);
    near(vector(bridge.facade.skinMatrix('neck'), vector(initial, p)), vector(current, p));
    near(bridge.facade.sampleDisplayInto(0, ...p, new Float64Array(3)), p);
  });
  assert.equal(bridge.facade.active, false);
});

class TestPhotoDynamics {
  constructor(fibers, motion, viewer) {
    assert.deepEqual(viewer.mesh.matrixWorld.elements, new THREE.Matrix4().elements);
    assert.equal(motion.active, false);
    Object.assign(this, photoFixture());
    this.fibers = fibers; this.motion = motion; this.viewer = viewer;
    this.binding.center = [0, 0, 0];
    this.binding.updateFrame = () => {
      this.binding.frame.copy(viewer.mesh.matrixWorld).multiply(new THREE.Matrix4().makeTranslation(0, .5, 0));
      this.binding.inverse.copy(this.binding.frame).invert();
    };
    this.enabled = true; this.wind = false; this.peak = 0;
    this.dynamics.steps = 0; this.dynamics.time = 0;
  }
  update(dt) { this.motion.advance(dt); this.binding.updateFrame(); this.dynamics.steps++; this.dynamics.time += dt; this.fibers.deformations[0] += dt; return true; }
  reset() { this.fibers.deformations.fill(0); }
  report() { throw new Error('Expensive diagnostics must not run in normal updates/reports'); }
}

test('two complete-population actors share immutable resources and dispose only their state', () => {
  const scene = new THREE.Scene(), renderer = {}, renderViewer = { scene, renderer };
  const geometry = new THREE.InstancedBufferGeometry(); geometry.instanceCount = SOURCE_LOCK.strands;
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3));
  const pathTexture = new THREE.DataTexture(new Float32Array(SOURCE_LOCK.pathTextureBytes / 4), 2048, 2732, THREE.RGBAFormat, THREE.FloatType);
  const restTexture = new THREE.DataTexture(new Float32Array(4), 1, 1, THREE.RGBAFormat, THREE.FloatType);
  const template = Object.assign(Object.create({ uniforms() {}, color() {} }), {
    api: {}, parts: [], count: SOURCE_LOCK.strands, samples: Array.from({ length: 43 }, () => ({})),
    partRanges: [], pathRootError: 0, pathTexture, restTexture, deformationTexture: new THREE.Texture(),
    u: Object.fromEntries(['pathMap', 'restVertices', 'poseMap', 'deformationMap', 'activePose', 'physicsOn',
      'nativeDepth', 'useNativeDepth', 'nativeMeshWorld', 'headCenter'].map(k => [k,
      { value: k === 'headCenter' ? new THREE.Vector3() : k === 'nativeMeshWorld' ? new THREE.Matrix4() : null }])),
  });
  template.material = new THREE.ShaderMaterial({ uniforms: template.u });
  template.mesh = new THREE.Mesh(geometry, template.material); scene.add(template.mesh);
  const cache = { v: renderViewer, hairs: new Set([template]), stats: {},
    attach(h) { this.hairs.add(h); }, detach(h) { this.hairs.delete(h); } };
  renderViewer.hairPassCache = cache;
  let geometryDisposals = 0, pathDisposals = 0;
  geometry.addEventListener('dispose', () => geometryDisposals++);
  pathTexture.addEventListener('dispose', () => pathDisposals++);
  const makeActor = (id, x) => {
    const worldRoot = new THREE.Group(), mesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial());
    mesh.geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3));
    worldRoot.position.x = x; worldRoot.add(mesh); scene.add(worldRoot);
    const motion = motionFixture();
    return { id, model: {}, worldRoot, motion, viewer: { scene, renderer, mesh, geometry: mesh.geometry, hairNativeMotion: motion } };
  };
  const factory = createHairFactory({ THREE, template, PhotoDynamics: TestPhotoDynamics, renderViewer });
  const a = makeActor('a', -1), b = makeActor('b', 2), ah = factory.create(a), bh = factory.create(b);
  assert.equal(template.mesh.visible, false);
  assert.equal(cache.hairs.size, 2);
  assert.equal(ah.fibers.mesh.geometry, bh.fibers.mesh.geometry);
  assert.equal(ah.fibers.pathTexture, bh.fibers.pathTexture);
  assert.notEqual(ah.fibers.material, bh.fibers.material);
  assert.notEqual(ah.fibers.u, bh.fibers.u);
  assert.notEqual(ah.fibers.deformations, bh.fibers.deformations);
  assert.notEqual(ah.dynamics.dynamics.q, bh.dynamics.dynamics.q);
  ah.update(1 / 60, 1);
  assert.equal(a.motion.advances, 0);
  assert.equal(bh.fibers.deformations[0], 0);
  assert.throws(() => ah.update(1 / 60, 1), /already consumed/);
  assert.equal(ah.report().strands, SOURCE_LOCK.strands);
  ah.update(0, 2);
  assert.equal(ah.fibers.u.physicsOn.value, 1);
  a.worldRoot.position.x = 3; ah.update(1 / 60, 3);
  assert.equal(ah.dynamics.binding.frame.elements[12], 3);
  ah.dispose(); ah.dispose();
  assert.equal(cache.hairs.size, 1);
  assert.equal(geometryDisposals, 0); assert.equal(pathDisposals, 0);
  factory.dispose();
  assert.equal(cache.hairs.size, 1); assert.ok(cache.hairs.has(template));
  assert.equal(template.mesh.visible, true);
  assert.equal(geometryDisposals, 0); assert.equal(pathDisposals, 0);
});
