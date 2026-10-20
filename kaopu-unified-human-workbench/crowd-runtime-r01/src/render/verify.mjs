// Interface/state tests for the routing adaptation. No GPU context, framebuffer
// precision, native image appearance or performance is claimed by this test.
import assert from 'node:assert/strict';
import {writeFile, readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as THREE from '../cloth/upstream/vendor/three.module.js';
import {installFacePassRouting} from './face-pass-routing.mjs';

const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera();
scene.background = new THREE.Color(.1, .2, .3);
const meshes = [new THREE.Mesh(), new THREE.Mesh()], clothing = new THREE.Mesh(), brow = new THREE.Mesh();
const light = new THREE.DirectionalLight();
meshes[0].layers.enable(2); meshes[1].layers.enable(4); light.layers.enable(6);
scene.add(...meshes, clothing, brow, light);
const targets = Array.from({length: 3}, () => ({width: 640, height: 480, samples: 0,
  depthTexture: {type: 'unsigned-int', format: 'depth'}, resolveDepthBuffer: true}));
let current = targets[0], readFB = {label: 'selected-aux-read'}, calls = [], shouldThrow = false;
const originalRead = readFB, sourceFB = {label: 'resolved-beauty-depth'};
const gl = {READ_FRAMEBUFFER_BINDING: 1, READ_FRAMEBUFFER: 2, DEPTH_BUFFER_BIT: 3, NEAREST: 4,
  getParameter(value) {assert.equal(value, this.READ_FRAMEBUFFER_BINDING); return readFB;},
  bindFramebuffer(target, framebuffer) {assert.equal(target, this.READ_FRAMEBUFFER); readFB = framebuffer; calls.push(['bind', framebuffer]);},
  blitFramebuffer(...args) {calls.push(['blit', ...args]);}, isContextLost: () => false};
const renderer = {autoClear: true, getContext: () => gl, getRenderTarget: () => current,
  properties: {get: target => ({__webglFramebuffer: target === targets[0] ? sourceFB : {}})}};
let expectedFiltered = false;
// Represents the already-installed native HairPassCache boundary. Real cache
// installation order and private original draws are separately source-reviewed.
const hairWrapper = (renderScene, renderCamera) => {
  calls.push(['existing-hair-wrapper', current]);
  if (expectedFiltered) {
    assert.equal(renderScene, scene); assert.equal(renderCamera, camera);
    assert.ok(meshes.every(mesh => camera.layers.test(mesh.layers)));
    assert.equal(camera.layers.test(clothing.layers), false);
    assert.equal(camera.layers.test(brow.layers), false);
    assert.equal(camera.layers.test(light.layers), true);
    assert.equal(renderer.autoClear, false); assert.equal(scene.background, null);
  }
  if (shouldThrow) throw Error('Injected native render error');
  return 'existing-render-result';
};
renderer.render = hairWrapper;
const viewer = {renderer, scene, mesh: new THREE.Mesh(), faceDiffusion: {targets}, render() {}};
const masks = [...meshes, clothing, brow, light].map(object => object.layers.mask), cameraMask = camera.layers.mask, background = scene.background;
const checks = [];
const check = (name, fn) => {fn(); checks.push({name, passed: true});};
const routing = installFacePassRouting(viewer, {getMeshes: () => meshes});
function restored() {
  assert.equal(readFB, originalRead); assert.equal(camera.layers.mask, cameraMask);
  assert.deepEqual([...meshes, clothing, brow, light].map(object => object.layers.mask), masks);
  assert.equal(renderer.autoClear, true); assert.equal(scene.background, background);
}
check('beauty pass forwards without depth copies or mesh filtering', () => {
  assert.equal(renderer.render(scene, camera), 'existing-render-result');
  assert.equal(calls.filter(row => row[0] === 'blit').length, 0); restored();
});
check('both auxiliary targets contain every actor mesh and exact original depth-only blit parameters', () => {
  expectedFiltered = true;
  for (const target of targets.slice(1)) {
    current = target; assert.equal(renderer.render(scene, camera), 'existing-render-result'); restored();
  }
  const blits = calls.filter(row => row[0] === 'blit');
  assert.equal(blits.length, 2);
  for (const row of blits) assert.deepEqual(row.slice(1), [0, 0, 640, 480, 0, 0, 640, 480, gl.DEPTH_BUFFER_BIT, gl.NEAREST]);
  assert.equal(routing.audit().lastSkinMeshes, 2);
});
check('failure restores read framebuffer, camera, every mesh, light, background and clear state', () => {
  shouldThrow = true; assert.throws(() => renderer.render(scene, camera), /Injected/); shouldThrow = false;
  restored();
});
check('original MSAA, type, format, size and resolved-depth guards retain full-render fallback', () => {
  expectedFiltered = false;
  for (const [object, key, value] of [[current, 'samples', 4], [current.depthTexture, 'type', 'wrong'],
    [current.depthTexture, 'format', 'wrong'], [current, 'width', 320], [targets[0], 'resolveDepthBuffer', false]]) {
    const old = object[key], before = calls.filter(row => row[0] === 'blit').length;
    object[key] = value; renderer.render(scene, camera); object[key] = old;
    assert.equal(calls.filter(row => row[0] === 'blit').length, before); restored();
  }
  assert.equal(routing.audit().fallbackPasses, 5);
});
check('other scenes and disabled routing retain original calls and do not alter masks', () => {
  const other = new THREE.Scene(); renderer.render(other, camera); restored();
  routing.setEnabled(false); renderer.render(scene, camera); restored(); routing.setEnabled(true);
});
const audit = routing.audit();
check('disposing the outer routing restores the exact existing hair wrapper', () => {
  routing.dispose(); assert.equal(renderer.render, hairWrapper); assert.equal(viewer.facePassRouting, undefined);
  routing.dispose(); assert.equal(renderer.render, hairWrapper);
});
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const evidence = {schema: 'multi-person-face-routing-interface-verification/1', atUTC: new Date().toISOString(),
  scope: 'routing/state restoration under mocked GL interface; no real framebuffer, GPU benchmark or visual acceptance',
  originalSourceSHA256: sha(await readFile(new URL('../../vendor/mp05/face-pass-routing.mjs', import.meta.url))),
  adapterSHA256: sha(await readFile(new URL('./face-pass-routing.mjs', import.meta.url))),
  tests: checks, audit};
await writeFile(new URL('./verification.json', import.meta.url), JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify({passed: checks.length, total: checks.length, scope: evidence.scope}));
