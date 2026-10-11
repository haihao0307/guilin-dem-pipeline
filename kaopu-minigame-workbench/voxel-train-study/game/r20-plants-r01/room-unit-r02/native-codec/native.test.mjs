import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {encode, pinnedDependencies} from './codec.mjs';
import {loadNativeDwelling} from '../room-native.mjs';
import {mountNativeDwelling} from '../host-qa.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const host = process.env.ROOM_HOST_GAME_ROOT || path.resolve(root, '../train-plants-r01-20261010/candidate/kaopu-minigame-workbench/voxel-train-study/game/r20-plants-r01');
const THREE = await import(pathToFileURL(path.resolve(host, '../../vendor/three.module.js')));
const dependencies = {};
for (const pin of pinnedDependencies()) dependencies[pin.id] = new Uint8Array(await readFile(path.join(root, pin.id.replaceAll('__', '/'))));

test('real SQLite sample regenerates original source wall and timber, preserving incomplete inspection status', async () => {
  const bytes = await readFile(path.join(root, 'native-codec/samples/original-material-dwelling.KaoPu'));
  const room = await loadNativeDwelling(bytes, {THREE, dependencyBytes: dependencies});
  try {
    assert.equal(room.proof.nativeContainer.profile, 'kaopu.dwelling-unit/0.2-experimental');
    assert.equal(room.proof.nativeContainer.dependencyPinsVerified, true);
    assert.equal(room.proof.nativeContainer.recipeOnly, true);
    assert.equal(room.proof.nativeContainer.wallBindingMode, 'declared');
    assert(room.proof.sources.wall.every(proof => proof.bindingMode === 'declared'));
    assert.equal(room.proof.completeDwellingDelivery, false);
    assert.equal(room.proof.status, 'inspection-in-progress');
    assert.equal(room.proof.wallCount, 4);
    assert.equal(room.proof.timberCount, 69);
    assert.equal(room.proof.originalWoodShader && room.proof.originalWallField, true);
    assert.equal(room.proof.imageTextures + room.proof.importedMeshes, 0);
    assert.equal(room.proof.hostDynamicLightingIntegrated, false);
    assert(room.proof.omissions.length > 0);
    assert(room.measure().meshDrawCalls > 0);
  } finally {room.dispose();}
});

test('restore proof reports the recipe-selected declared or legacy binding without a fixed legacy claim', async () => {
  for (const wallBindingMode of ['declared', 'legacy']) {
    const room = await loadNativeDwelling(await encode({wallBindingMode}), {THREE, dependencyBytes: dependencies});
    try {
      assert.equal(room.recipe.wallBindingMode, wallBindingMode);
      assert.equal(room.proof.nativeContainer.wallBindingMode, wallBindingMode);
      assert.deepEqual(room.proof.nativeContainer.materialGenerators, ['OriginalTimber-v3', 'BrickR3.12']);
      assert(room.proof.sources.wall.every(proof => proof.bindingMode === wallBindingMode));
    } finally {room.dispose();}
  }
});

test('all four source timber presets and closed-door recipe rebuild through verified closure', async () => {
  for (const presetId of ['yunnan_dark_aged_v2', 'yunnan_warm_medium_v2', 'yunnan_light_weathered_v2', 'yunnan_lacquered_chestnut_v2']) {
    const room = await loadNativeDwelling(await encode({presetId, doorOpen: false}), {THREE, dependencyBytes: dependencies});
    try {
      assert.equal(room.recipe.presetId, presetId);
      assert.equal(room.proof.doorOpen, false);
      assert.equal(room.graph.edges[0].enabled, false);
      assert(room.proof.sources.wood.every(proof => proof.preset === presetId));
      room.setDoorOpen(true);
      assert.equal(room.graph.edges[0].enabled, true);
      room.setInspectionCutaway(true);
      assert.equal(room.groups.roof.visible || room.groups.front.visible || room.groups.door.visible, false);
      room.setInspectionCutaway(false);
      assert.equal(room.groups.roof.visible && room.groups.front.visible && room.groups.door.visible, true);
      assert.equal(room.update(123.5), 123.5);
      assert.equal(room.proof.worldSeconds, 123.5);
      assert.throws(() => room.update(NaN), /authoritative world time/);
    } finally {room.dispose(); room.dispose();}
  }
});

test('bad native bytes or source pins are rejected before constructing the first host group', async () => {
  let built = false;
  const guarded = {get Group() {built = true; throw new Error('Must not build');}};
  const corruptFile = new Uint8Array(await encode({})); corruptFile[24] ^= 1;
  await assert.rejects(() => loadNativeDwelling(corruptFile, {THREE: guarded, dependencyBytes: dependencies}), /IMMUTABLE_CONTAINER_MISMATCH/);
  const corruptDependencies = {...dependencies, 'room-unit.mjs': new Uint8Array(1)};
  await assert.rejects(() => loadNativeDwelling(corruptFile, {THREE: guarded, dependencyBytes: corruptDependencies}), /LOADED_RULE_SIZE_MISMATCH/);
  assert.equal(built, false);
});

test('host mount uses only existing THREE and scene; repeated mount/dispose and deep paths work', async () => {
  const savedFetch = globalThis.fetch, scene = new THREE.Scene(), paths = [];
  const guarded = {...THREE};
  for (const name of ['WebGLRenderer', 'PerspectiveCamera', 'OrthographicCamera', 'Clock']) guarded[name] = class {constructor() {throw new Error('Must reuse host ' + name);}};
  globalThis.fetch = async url => {
    const file = fileURLToPath(url);
    assert(file.startsWith(root + path.sep), 'Only module-local dependency files may be read');
    paths.push(path.relative(root, file));
    return new Response(await readFile(file));
  };
  try {
    for (let index = 0; index < 2; index++) {
      const room = await mountNativeDwelling({THREE: guarded, scene, position: [1, 2, 3], yaw: .5});
      assert.equal(scene.children.length, 1);
      assert.deepEqual(room.root.position.toArray(), [1, 2, 3]);
      assert.equal(room.root.rotation.y, .5);
      room.update(4321.25);
      assert.equal(room.proof.worldSeconds, 4321.25);
      room.dispose();
      assert.equal(scene.children.length, 0);
    }
    assert(paths.includes('native/timber/original-core.mjs'));
    assert(paths.includes('native/timber/three-adapter.mjs'));
    await assert.rejects(() => mountNativeDwelling({THREE: guarded, scene, position: [0, Infinity, 0]}), /Finite rigid/);
  } finally {globalThis.fetch = savedFetch;}
  const source = await readFile(path.join(root, 'host-qa.mjs'), 'utf8');
  assert(!/requestAnimationFrame\(|setInterval\(|setTimeout\(|Date\.now\(|addEventListener\(/.test(source));
});
