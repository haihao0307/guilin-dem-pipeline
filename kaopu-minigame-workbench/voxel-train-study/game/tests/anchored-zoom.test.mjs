import assert from 'node:assert/strict';
import * as THREE from '../../vendor/three.module.js';
import {createGameTrain} from '../train-model.mjs';
import {projectAnchor, putAnchorAtNdc, zoomSubject, canvasPoint, verticalFov} from '../anchored-zoom.mjs';
import {projectFrame, zoomFrame} from '../bounds-zoom.mjs';

const WIDTH = 2048, HEIGHT = 1024;
const trainBounds = new THREE.Box3().setFromObject(createGameTrain().root);
const anchor = trainBounds.getCenter(new THREE.Vector3());
const points = [];
for (const x of [trainBounds.min.x, trainBounds.max.x])
  for (const y of [trainBounds.min.y, trainBounds.max.y])
    for (const z of [trainBounds.min.z, trainBounds.max.z]) points.push(new THREE.Vector3(x, y, z));
function setup() {
  const camera = new THREE.PerspectiveCamera(32, WIDTH / HEIGHT, .1, 180);
  const target = new THREE.Vector3(-2.2, 2.8, 1);
  camera.position.set(5, 23, 37); camera.zoom = 1.06;
  camera.lookAt(target); camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  return {camera, target};
}
const almost = (a, b, tolerance = 1e-9) => assert(Math.abs(a - b) <= tolerance, `${a} != ${b}`);
const assertAnchor = (camera, expected) => {
  const actual = projectAnchor(camera, anchor); almost(actual.x, expected.x); almost(actual.y, expected.y);
};
const act = (s, extra) => zoomSubject({...s, anchor, width: WIDTH, height: HEIGHT, ...extra});
let count = 0;
function test(label, work) { work(); count++; console.log(`PASS ${label}`); }

test('R05 reproduces the defect: off-axis subject drift grows with zoom', () => {
  const {camera} = setup(), before = projectAnchor(camera, anchor);
  camera.zoom *= 1.5; camera.updateProjectionMatrix();
  const after = projectAnchor(camera, anchor);
  almost(after.x, before.x * 1.5); almost(after.y, before.y * 1.5);
  assert(Math.abs(after.x - before.x) * WIDTH / 2 > 100);
  console.log('  R05 drift pixels:', (after.x - before.x) * WIDTH / 2, -(after.y - before.y) * HEIGHT / 2);
});
test('repeated wheel zoom preserves subject anchor after manual orbit and pan', () => {
  const s = setup();
  const orbit = new THREE.Spherical().setFromVector3(s.camera.position.clone().sub(s.target));
  orbit.theta += .24; orbit.phi -= .11;
  s.camera.position.copy(s.target).add(new THREE.Vector3().setFromSpherical(orbit));
  const pan = new THREE.Vector3(3.8, -1.2, 2.3);
  s.camera.position.add(pan); s.target.add(pan); s.camera.lookAt(s.target);
  const initial = projectAnchor(s.camera, anchor), offset = s.camera.position.clone().sub(s.target);
  for (let i = 0; i < 35; i++) { act(s, {factor: Math.exp(.025)}); assertAnchor(s.camera, initial); }
  assert(s.camera.position.clone().sub(s.target).distanceTo(offset) < 1e-9);
  for (let i = 0; i < 35; i++) { act(s, {factor: Math.exp(-.025)}); assertAnchor(s.camera, initial); }
  almost(s.camera.zoom, 1.06);
});
test('a stationary-midpoint pinch never introduces a translation', () => {
  const s = setup(), before = projectAnchor(s.camera, anchor);
  act(s, {factor: 1.5}); assertAnchor(s.camera, before);
});
test('pinch midpoint movement is exact in CSS pixels for any FOV and viewport', () => {
  for (const [width, height] of [[390, 844], [844, 390], [1440, 900], [2048, 1024]]) {
    const s = setup(); s.camera.aspect = width / height;
    s.camera.fov = verticalFov(width / height); s.camera.updateProjectionMatrix();
    const before = projectAnchor(s.camera, anchor);
    zoomSubject({...s, anchor, width, height, factor: 1.38, dx: 37, dy: -23});
    const after = projectAnchor(s.camera, anchor);
    almost((after.x - before.x) * width / 2, 37, 1e-7);
    almost(-(after.y - before.y) * height / 2, -23, 1e-7);
  }
});
test('zoom limits do not accumulate pan or lose the subject', () => {
  const s = setup(), before = projectAnchor(s.camera, anchor);
  act(s, {factor: 100}); almost(s.camera.zoom, 3); assertAnchor(s.camera, before);
  const saved = s.camera.position.clone(); assert.equal(act(s, {factor: 2}), false);
  assert.equal(s.camera.position.distanceTo(saved), 0);
  act(s, {factor: .001}); almost(s.camera.zoom, .4); assertAnchor(s.camera, before);
});
test('gesture scaling composes: many partial pinches equal one full pinch', () => {
  const a = setup(), b = setup(), ratio = 1.6;
  act(a, {factor: ratio, dx: 61, dy: -17});
  for (let i = 0; i < 16; i++) act(b, {factor: ratio ** (1 / 16), dx: 61 / 16, dy: -17 / 16});
  almost(a.camera.zoom, b.camera.zoom);
  assert(a.camera.position.distanceTo(b.camera.position) < 1e-8);
  assert(a.target.distanceTo(b.target) < 1e-8);
});
test('new horizontal projection keeps width and locked camera pose through resize', () => {
  const s = setup(), projection = {kind: 'horizontal', referenceAspect: 16 / 9};
  s.camera.fov = verticalFov(s.camera.aspect, projection); s.camera.updateProjectionMatrix();
  const before = projectAnchor(s.camera, anchor), position = s.camera.position.toArray(), target = s.target.toArray(), zoom = s.camera.zoom;
  for (const aspect of [1.4, 16 / 9, 2, 2.2]) {
    s.camera.aspect = aspect; s.camera.fov = verticalFov(aspect, projection); s.camera.updateProjectionMatrix();
    almost(projectAnchor(s.camera, anchor).x, before.x);
    assert.deepEqual(s.camera.position.toArray(), position); assert.deepEqual(s.target.toArray(), target); assert.equal(s.camera.zoom, zoom);
  }
});
test('legacy projection remains exactly the old R05 formula', () => {
  almost(verticalFov(2), 32); almost(verticalFov(.5), 2 * Math.atan(Math.tan(32 * Math.PI / 360) / .5) * 180 / Math.PI);
});
test('portrait and CSS-rotated logical coordinates stay correct with canvas offsets', () => {
  const rect = {left: 20, top: 50, right: 420, width: 400, height: 800};
  assert.deepEqual(canvasPoint({clientX: 120, clientY: 250}, rect, 400, 800), {x: 100, y: 200});
  assert.deepEqual(canvasPoint({clientX: 120, clientY: 250}, rect, 800, 400, true), {x: 200, y: 300});
});
test('hidden or degenerate anchor/input is rejected without changing a saved camera', () => {
  const s = setup(), position = s.camera.position.toArray(), zoom = s.camera.zoom;
  assert.equal(act(s, {factor: NaN}), false);
  assert.equal(zoomSubject({...s, anchor: s.camera.position.clone(), width: WIDTH, height: HEIGHT, factor: 1.2}), false);
  assert.equal(putAnchorAtNdc(s.camera, s.target, anchor, {x: Infinity, y: 0}), false);
  assert.deepEqual(s.camera.position.toArray(), position); assert.equal(s.camera.zoom, zoom);
});
test('strict projected-bounds policy preserves screen center after arbitrary manual orbit/pan', () => {
  for (const theta of [-.6, -.2, .2, .6]) for (const phi of [.4, .8, 1.3]) {
    const s = setup(), orbit = new THREE.Spherical(46, phi, theta);
    s.camera.position.copy(s.target).add(new THREE.Vector3().setFromSpherical(orbit));
    s.target.add(new THREE.Vector3(1.2, -.3, .8)); s.camera.position.add(new THREE.Vector3(1.2, -.3, .8));
    s.camera.lookAt(s.target);
    const before = projectFrame(s.camera, points), offset = s.camera.position.clone().sub(s.target);
    for (let i = 0; i < 40; i++) {
      zoomFrame({...s, points, width: WIDTH, height: HEIGHT, factor: 1.02});
      const after = projectFrame(s.camera, points);
      almost(after.x, before.x, 1e-9); almost(after.y, before.y, 1e-9);
    }
    assert(s.camera.position.clone().sub(s.target).distanceTo(offset) < 1e-9);
  }
});
test('strict bounds pinch ends in the same place whether delivered in one or many events', () => {
  const a = setup(), b = setup(), before = projectFrame(a.camera, points);
  zoomFrame({...a, points, width: WIDTH, height: HEIGHT, factor: 1.7, dx: -71, dy: 45});
  for (let i = 0; i < 16; i++) zoomFrame({...b, points, width: WIDTH, height: HEIGHT, factor: 1.7 ** (1 / 16), dx: -71 / 16, dy: 45 / 16});
  const after = projectFrame(a.camera, points);
  almost((after.x - before.x) * WIDTH / 2, -71, 1e-7);
  almost(-(after.y - before.y) * HEIGHT / 2, 45, 1e-7);
  assert(a.camera.position.distanceTo(b.camera.position) < 1e-8);
  assert(a.target.distanceTo(b.target) < 1e-8);
});
console.log(JSON.stringify({status: 'passed', tests: count, threeRevision: THREE.REVISION, scope: 'projection geometry; event wiring and visual fit still require browser QA'}));
