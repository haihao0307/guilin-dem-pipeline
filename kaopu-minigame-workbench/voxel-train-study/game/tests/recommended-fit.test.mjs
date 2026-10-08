import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from '../../vendor/three.module.js';
import {createGameTrain} from '../train-model.mjs';
import {verticalFov} from '../anchored-zoom.mjs';
import {pathFrame, makeTerrainProxy, fitRecommendedFrame, framePixels, guardedVerticalFov} from '../recommended-fit.mjs';

const almost = (a, b, epsilon = 1e-8) => assert(Math.abs(a - b) < epsilon, `${a} != ${b}`);
const bounds = new THREE.Box3().setFromObject(createGameTrain().root), trainPoints = [];
for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y])
  for (const z of [bounds.min.z, bounds.max.z]) trainPoints.push(new THREE.Vector3(x, y, z));
const target = new THREE.Vector3(-2.2, 2.8, 1), camera = new THREE.PerspectiveCamera(32, 2048 / 1016, .1, 180);
camera.position.set(5, 23, 37); camera.zoom = 1.06; camera.lookAt(target);
const originalOffset = camera.position.clone().sub(target), originalQuaternion = camera.quaternion.clone();
const proxy = makeTerrainProxy(target);
const fit = fitRecommendedFrame({camera, target, terrainPoints: proxy.main, trainPoints, returnPoints: proxy.returnSurface});
const pose = {position: camera.position.toArray(), target: target.toArray(), zoom: camera.zoom};
const requested = [[2048, 1016], [1920, 1000], [2560, 1336]], viewports = [], guarded = [];
let count = 0;
function test(name, run) { run(); count++; console.log(`PASS ${name}`); }
function resize(width, height, guard = false) {
  camera.aspect = width / height;
  let protection = null;
  if (guard) protection = guardedVerticalFov({camera, trainPoints, terrainPoints: proxy.main,
    returnPoints: proxy.returnSurface, width, height, projection: fit.profile.projection});
  camera.fov = protection?.fov ?? verticalFov(camera.aspect, fit.profile.projection);
  camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  return {width, height, fov: camera.fov, guard: protection,
    main: framePixels(camera, proxy.main, width, height), train: framePixels(camera, trainPoints, width, height),
    fence: framePixels(camera, proxy.fence, width, height), returnSurface: framePixels(camera, proxy.returnSurface, width, height)};
}
test('WORLD path proxy reproduces straight top, both outer turns and lower return', () => {
  for (const [u, expected] of [[-26, [-26, 0]], [10, [10, 0]],
    [10 + 3.8 * Math.PI / 2, [13.8, -3.8]], [-26 - 3.8 * Math.PI / 2, [-29.8, -3.8]],
    [10 + 3.8 * Math.PI, [10, -7.6]]]) {
    const p = pathFrame(u).position; almost(p[0], expected[0]); almost(p[1], expected[1]);
  }
});
test('recommended fit preserves the exact R05 angle and its camera-target vector', () => {
  assert(camera.position.clone().sub(target).distanceTo(originalOffset) < 1e-12);
  assert(camera.quaternion.angleTo(originalQuaternion) < 1e-7);
  assert.equal(fit.constrainedByHeight, false);
  assert(fit.profile.zoom >= .4 && fit.profile.zoom <= 3);
});
test('all three requested viewports fill exactly 95%, centered, without cropping green or train', () => {
  for (const [width, height] of requested) {
    const row = resize(width, height); viewports.push(row);
    almost(row.main.horizontalFraction, .95);
    almost(row.main.left, width - row.main.right);
    assert(row.main.top >= 8 - 1e-7 && row.main.bottom <= height - 8 + 1e-7);
    assert(row.train.top >= 212 - 1e-7 && row.train.bottom <= height - 142 + 1e-7);
    assert(row.train.left > 0 && row.train.right < width);
    assert(row.returnSurface.bottom <= height + 48 + 1e-7);
    assert(row.fence.top > 0 && row.fence.bottom < height);
  }
});
test('resize cycles never mutate the new saved pose or zoom', () => {
  for (let i = 0; i < 30; i++) {
    resize(...requested[i % requested.length]);
    assert.deepEqual({position: camera.position.toArray(), target: target.toArray(), zoom: camera.zoom}, pose);
  }
});
let proxyError;
test('128-segment main proxy agrees with 2048-segment envelope within 0.1 CSS pixels', () => {
  resize(2048, 1016);
  const dense = makeTerrainProxy(target, {arcSegments: 2048});
  const coarseFrame = framePixels(camera, proxy.main, 2048, 1016), denseFrame = framePixels(camera, dense.main, 2048, 1016);
  proxyError = Math.max(...['left', 'right', 'top', 'bottom'].map(k => Math.abs(coarseFrame[k] - denseFrame[k])));
  assert(proxyError < .1, `proxy error ${proxyError}`);
});
test('very wide/short guard retains train-safe HUD bounds and upper terrain without altering pose', () => {
  for (const [width, height] of [[3440, 1440], [2560, 1080], [3840, 600], [1280, 500]]) {
    const row = resize(width, height, true); guarded.push(row);
    assert.equal(row.guard.status, 'vertical-clearance-guard');
    assert(row.train.top >= 212 - 1e-7 && row.train.bottom <= height - 142 + 1e-7);
    assert(row.main.top >= 8 - 1e-7 && row.main.bottom <= height - 8 + 1e-7);
    assert(row.returnSurface.bottom <= height + 48 + 1e-7);
    assert(row.main.horizontalFraction <= .95 + 1e-7);
    almost(row.main.left, width - row.main.right);
    assert.deepEqual({position: camera.position.toArray(), target: target.toArray(), zoom: camera.zoom}, pose);
  }
});
test('guard reports when fixed HUD dimensions leave no centered perspective solution', () => {
  const protection = guardedVerticalFov({camera, trainPoints, width: 1280, height: 400, projection: fit.profile.projection});
  assert.equal(protection.status, 'hud-consumes-center');
});
test('an old restored profile without projection metadata still gets exact R05 projection', () => {
  for (const [width, height] of requested) assert.equal(verticalFov(width / height), 32);
});

const result = {status: 'passed', tests: count, sourceRef: '6562c467', threeRevision: THREE.REVISION,
  fit, cameraMinusTarget: originalOffset.toArray(), proxyErrorPixels: proxyError,
  viewports, guarded, limitations: ['Geometry-only: actual browser rendering, HUD placement and screenshot review still pending.',
    'The return underside is intentionally allowed up to 48 CSS px below the reference viewport.',
    'Projected envelope excludes dynamic trees, stations, smoke, bridges, actors and effects.']};
fs.writeFileSync(new URL('./recommended-fit-results.json', import.meta.url), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({status: 'passed', tests: count, profile: fit.profile, proxyErrorPixels: proxyError,
  viewports: viewports.map(r => ({viewport: [r.width, r.height], horizontalFraction: r.main.horizontalFraction,
    margins: [r.main.left, r.width - r.main.right], trainY: [r.train.top, r.train.bottom], greenBottom: r.main.bottom,
    returnCrop: Math.max(0, r.returnSurface.bottom - r.height)}))}));
