/**
 * Targeted CPU regression using the unchanged F13 CollisionProxies constructor,
 * its ten actual collider records, and NativeMotion's matrix/kinematic APIs.
 * The retained MP05 104-bone person supplies the rig and control geometry.
 * A head-joint binding fixture replaces fine P01 facial landmarks; only GPU
 * raster/readback is suppressed. This is not a full hair-solver or visual test.
 *
 * node --loader ./src/actors/test-loader.mjs ./src/hair/reset-history.verify.mjs
 */
import assert from 'node:assert/strict';
import {readFile, writeFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import * as THREE from '../cloth/upstream/vendor/three.module.js';
import {NativeMotion} from '../../vendor/f13/vendor/fiber/NativeMotion.mjs';
import {CollisionProxies} from '../../vendor/f13/vendor/fiber/CollisionProxies.mjs';
import {SurfaceContactField} from '../../vendor/f13/vendor/fiber/SurfaceContactField.mjs';
import {createMotionFacade, placeSolver, resetCollisionHistory} from './placement.mjs';

const DT = 1 / 60, checks = [];
function checked(name, fn) {fn(); checks.push({name, passed: true});}
function near(a, b, tolerance = 1e-9) {
  assert.equal(a.length, b.length);
  for (let i = 0; i < a.length; i++) assert.ok(Math.abs(a[i] - b[i]) < tolerance, `${i}: ${a[i]} != ${b[i]}`);
}
const matrixNear = (a, b) => near(a.elements, b.elements);
const sourceBytes = await readFile(new URL('../cloth/upstream/assets/native-person.json.gz', import.meta.url));
const retained = JSON.parse(gunzipSync(sourceBytes));
const model = {...retained, faces: Uint32Array.from(retained.faces),
  lastBodyDriver: {rig: retained.rig},
  // Fine segmentation is irrelevant to this reset test: GPU raster is skipped.
  gnm: {componentId: new Uint8Array(Math.max(...retained.canonical.gnmRecipes.flatMap(r => r.slice(0, 2))) + 1)}};
assert.equal(retained.rig.names.length, 104);
const display = Float32Array.from(retained.positions);
for (let i = 0; i < display.length; i += 3) {
  display[i + 1] = retained.positions[i + 2]; display[i + 2] = -retained.positions[i + 1];
}
const geometry = new THREE.BufferGeometry();
geometry.setAttribute('position', new THREE.BufferAttribute(display, 3));
geometry.setIndex(new THREE.BufferAttribute(model.faces, 1));
const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
const viewer = {mesh, geometry, renderer: {}};
const motion = new NativeMotion(model, viewer);
motion.native = {names: retained.rig.names, boneData: new Float32Array(104 * 16)};
for (let i = 0; i < 104; i++) for (const diagonal of [0, 5, 10, 15]) motion.native.boneData[i * 16 + diagonal] = 1;
let poseRefreshes = 0;
motion.skinCache = {target: {textures: [new THREE.Texture()]}, update() {poseRefreshes++;}};
motion.active = true;
const bridge = createMotionFacade(THREE, motion);
viewer.hairNativeMotion = bridge.facade;
const head = retained.rig.restMatrices[retained.rig.names.indexOf('head')];
const headLocal = new THREE.Matrix4().makeTranslation(head[3], head[11], -head[7]);
const inverseHead = headLocal.clone().invert();
const localPoints = new Float32Array(display.length), point = new THREE.Vector3();
for (let i = 0; i < display.length; i += 3) {
  point.fromArray(display, i).applyMatrix4(inverseHead).toArray(localPoints, i);
}
const binding = {model, viewer, frame: headLocal.clone(), inverse: inverseHead.clone(),
  restFrame: headLocal.clone(), frameVersion: 0,
  sourcePositions: localPoints.slice(model.bodyCount * 3),
  bodyAt(y) {
    const slices = tolerance => {
      const points = [];
      for (let i = 0; i < model.bodyCount * 3; i += 3) {
        if (Math.abs(localPoints[i + 1] - y) < tolerance && Math.abs(localPoints[i]) < .255) points.push(localPoints.subarray(i, i + 3));
      }
      return points;
    };
    let points = slices(.012); if (points.length < 8) points = slices(.03);
    if (!points.length) return [.08, -.14, .08];
    const front = Math.max(...points.map(p => p[2])), back = Math.min(...points.map(p => p[2]));
    return [Math.max(.035, ...points.map(p => Math.abs(p[0]))) + .004, (front + back) * .5, Math.max(.035, (front - back) * .5) + .006];
  },
  updateFrame() {
    const next = mesh.matrixWorld.clone().multiply(headLocal);
    if (!this.frame.equals(next)) this.frameVersion++;
    this.frame.copy(next); this.inverse.copy(next).invert();
  }};
const raster = SurfaceContactField.prototype.rasterGPU;
let skippedRasterCalls = 0;
SurfaceContactField.prototype.rasterGPU = function () {skippedRasterCalls++;};
let collisions;
try {
  collisions = new CollisionProxies(binding);
  const originalUpdate = collisions.update;
  collisions.update = function (...args) {return bridge.withBoneTransport(() => originalUpdate.apply(this, args));};
  const photo = {binding, collisions, restFrame: headLocal.clone(), inverseRest: inverseHead.clone(),
    dynamics: {equilibriumFrame: headLocal.clone(), contactCache: [null],
      bundleFriction: {count: 24}, writeOffsets() {}}};
  const initial = new THREE.Matrix4().makeTranslation(-.61, .978207004904747, 0);
  const relocated = new THREE.Matrix4().makeTranslation(-1.83, .978207004904747, -.24)
    .multiply(new THREE.Matrix4().makeRotationY(.65));
  placeSolver(photo, initial); mesh.matrixWorld.copy(initial);
  bridge.sync(initial, true); bridge.enable(); binding.updateFrame();
  const move = matrix => {mesh.matrixWorld.copy(matrix); motion.version++; motion.boneWorld.clear(); bridge.sync(matrix); binding.updateFrame();};
  collisions.update(DT, true);
  const fixedParameters = JSON.stringify({friction: collisions.friction, radii: collisions.shapes.map(s => s.r), bones: collisions.shapes.map(s => s.bone)});
  const sample = () => {const s = collisions.shapes.find(s => s.part === 'neck'); return {frame: s.frame, previous: s.previous, q: [0, 0, 0], normal: [1, 0, 0]};};

  // Reproduce the former omission using the original next-step update.
  move(relocated); collisions.update(DT);
  const formerFalseSpeed = Math.hypot(...collisions.surfaceVelocity(sample()));
  checked('negative control: missing history reset produces UI displacement velocity', () => {
    assert.ok(formerFalseSpeed > 50); assert.equal(collisions.fastMotion, true);
  });

  move(initial); collisions.update(DT, true);
  move(relocated); bridge.resetKinematics(); photo.dynamics.bundleFriction.count = 24;
  resetCollisionHistory(photo);
  checked('original reset API synchronizes head, ten shapes, inverses and surface history', () => {
    assert.equal(collisions.shapes.length, 10);
    matrixNear(collisions.previousHead, collisions.headFrame);
    for (const s of collisions.shapes) {matrixNear(s.previous, s.frame); matrixNear(s.previousInverse, s.inverse);}
    matrixNear(collisions.surface.previousFrame, collisions.surface.frame);
    assert.equal(collisions.fastMotion, false); assert.equal(photo.dynamics.bundleFriction.count, 0);
  });
  const resetVelocity = collisions.surfaceVelocity(sample());
  const resetImpulse = collisions.resolveVelocity(null, [0, 0, 0], .05, sample());
  checked('reset contact speed and contact impulse contain no placement jump', () => {
    near(resetVelocity, [0, 0, 0]); near(resetImpulse, [0, 0, 0]);
  });
  collisions.update(DT);
  checked('first unchanged native step has zero artificial collider velocity', () => {
    near(collisions.surfaceVelocity(sample()), [0, 0, 0]); assert.equal(collisions.fastMotion, false);
    bridge.facade.updateKinematics(binding.frame, DT);
    near(bridge.facade.input.linear, [0, 0, 0]); near(bridge.facade.input.angular, [0, 0, 0]);
  });
  const next = relocated.clone(); next.elements[12] += .002;
  move(next); collisions.update(DT);
  const actualStepVelocity = collisions.surfaceVelocity(sample());
  checked('subsequent 2 mm movement uses only its own 1/60-second velocity', () => {
    near(actualStepVelocity, [.002 / DT, 0, 0]);
    assert.equal(JSON.stringify({friction: collisions.friction, radii: collisions.shapes.map(s => s.r), bones: collisions.shapes.map(s => s.bone)}), fixedParameters);
    assert.equal(motion.time, 0);
  });
  const files = ['index.mjs', 'placement.mjs', 'reset-history.verify.mjs'];
  const hashes = {};
  for (const file of files) hashes[file] = createHash('sha256').update(await readFile(new URL(file, import.meta.url))).digest('hex');
  const receipt = {scope: 'original F13 collider reset API; retained MP05 104-bone/control-mesh fixture; head-joint binding fixture; GPU raster/readback suppressed',
    fullSolverOrBrowserTest: false, nativeColliderCount: collisions.shapes.length,
    formerFalseSpeedMetersPerSecond: formerFalseSpeed, resetVelocityMetersPerSecond: resetVelocity,
    nextTrueVelocityMetersPerSecond: actualStepVelocity, poseRefreshes, skippedRasterCalls, checks, files: hashes};
  await writeFile(new URL('reset-history-verification.json', import.meta.url), JSON.stringify(receipt, null, 2) + '\n');
  console.log(JSON.stringify(receipt));
} finally {
  SurfaceContactField.prototype.rasterGPU = raster;
  collisions?.surface.dispose(); geometry.dispose(); mesh.material.dispose();
}
