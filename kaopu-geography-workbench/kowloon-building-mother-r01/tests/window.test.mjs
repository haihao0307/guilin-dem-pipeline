import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import * as THREE from '../../hk-three-buildings-r01/viewer/vendor/three.module.js';
import {reconstructBuffers} from '../../hk-three-buildings-r01/geometry/reconstruct.mjs';
import {defaultWindowConfig, validateWindow, cutHostedWindow, buildWindow, inspectWindow} from '../r03/window.mjs';

const score = JSON.parse(await readFile(new URL('../../hk-three-buildings-r01/geometry/B359971994401063C0.score.json', import.meta.url), 'utf8'));
const cfg = changes => ({...defaultWindowConfig(), enabled: true, ...changes});
const near = (a, b, tolerance = 1e-8) => assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);
const nearVector = (a, b, tolerance = 1e-8) => a.forEach((v, i) => near(v, b[i], tolerance));
function areaOfPatch(s, id) {
  const data = reconstructBuffers(s, THREE), patch = data.patches.find(p => p.id === id);
  let area = 0;
  for (let i = patch.start * 3; i < (patch.start + patch.count) * 3; i += 9) {
    const a = new THREE.Vector3(...data.positions.slice(i, i + 3));
    const b = new THREE.Vector3(...data.positions.slice(i + 3, i + 6));
    const c = new THREE.Vector3(...data.positions.slice(i + 6, i + 9));
    area += b.sub(a).cross(c.sub(a)).length() / 2;
  }
  return area;
}
function worldPoint(object, xyz) {
  object.updateWorldMatrix(true, true);
  return object.localToWorld(new THREE.Vector3(...xyz)).toArray();
}

test('disabled default preserves measured source and contains no invented measured-window claim', () => {
  const original = JSON.stringify(score), result = cutHostedWindow(score);
  assert.notEqual(result, score);
  assert.deepEqual(result, score);
  assert.equal(JSON.stringify(score), original);
  assert.equal(buildWindow(THREE, score).visible, false);
  assert.equal(inspectWindow(score).measuredWindowDimensions, false);
});

test('real wallProfile hole removes width × height without mutating host or unrelated patches', () => {
  const original = JSON.stringify(score), c = cfg(), result = cutHostedWindow(score, c);
  const host = result.reconstruction.operations.find(o => o.id === c.hostPatchId);
  assert.equal(host.kind, 'wallProfile');
  assert.equal(host.loops.length, 2);
  near(areaOfPatch(score, c.hostPatchId) - areaOfPatch(result, c.hostPatchId), c.width * c.height, 3e-5);
  assert.equal(JSON.stringify(score), original);
  assert.deepEqual(result.reconstruction.operations.filter(o => o.id !== c.hostPatchId),
    score.reconstruction.operations.filter(o => o.id !== c.hostPatchId));
  assert.deepEqual(cutHostedWindow(result, c), result, 'recutting must not accumulate holes');
  const disabled = cutHostedWindow(result, {...c, enabled: false});
  assert.deepEqual(disabled.reconstruction.operations, score.reconstruction.operations);
});

test('basis is normalized, right-handed, actual p003 host tangent and outward normal', () => {
  const state = validateWindow(score, cfg()), {x, y, z} = state.basis;
  near(Math.hypot(...x), 1); near(Math.hypot(...z), 1);
  nearVector(new THREE.Vector3(...x).cross(new THREE.Vector3(...y)).toArray(), z);
  const [a, b] = state.host.edge;
  nearVector(x, [(b[0] - a[0]) / state.host.length, 0, -(b[1] - a[1]) / state.host.length]);
  near(state.aperture.left + state.aperture.right, state.host.length);
});

test('hinge remains fixed, glass follows leaf, fixed frame and aperture do not swing', () => {
  const closed = buildWindow(THREE, score, cfg({angleDegrees: 0}));
  const open = buildWindow(THREE, score, cfg({angleDegrees: 70}));
  const a = inspectWindow(score, cfg(), closed), b = inspectWindow(score, cfg({angleDegrees: 70}), open);
  nearVector(a.scene.hingeWorld, b.scene.hingeWorld);
  nearVector(a.scene.fixedFrameMatrixWorld, b.scene.fixedFrameMatrixWorld);
  assert.deepEqual(a.aperture, b.aperture);
  const refs = open.userData.refs;
  assert.equal(refs.glass.parent, refs.leaf);
  assert.equal(refs.leaf.parent, refs.pivot);
  assert.notDeepEqual(a.scene.glassMatrixWorld, b.scene.glassMatrixWorld);
  const d = b.dimensions;
  nearVector(worldPoint(refs.glass, [0, 0, 0]), worldPoint(refs.leaf, [d.leafWidth / 2, d.leafHeight / 2, 0]));
  nearVector(worldPoint(closed.userData.refs.leaf, [0, 0, 0]), worldPoint(refs.leaf, [0, 0, 0]));
  const outwardClosed = closed.worldToLocal(new THREE.Vector3(...worldPoint(closed.userData.refs.leaf, [d.leafWidth, 0, 0])));
  const outwardOpen = open.worldToLocal(new THREE.Vector3(...worldPoint(refs.leaf, [d.leafWidth, 0, 0])));
  assert.ok(outwardOpen.z > outwardClosed.z);
});

test('opening dimensions drive both actual frame and real cut; bars and glass are volumetric', () => {
  for (const [width, height] of [[0.55, 1.2], [0.68, 1.6]]) {
    const c = cfg({width, height}), g = buildWindow(THREE, score, c), state = inspectWindow(score, c);
    near(areaOfPatch(score, 'p003') - areaOfPatch(cutHostedWindow(score, c), 'p003'), width * height, 3e-5);
    const bounds = new THREE.Box3();
    for (const bar of g.userData.refs.fixedFrame.children) {
      assert.equal(bar.geometry.type, 'BoxGeometry');
      bar.geometry.computeBoundingBox();
      bounds.union(bar.geometry.boundingBox.clone().translate(bar.position));
    }
    near(bounds.max.x - bounds.min.x, width, 1e-6);
    near(bounds.max.y - bounds.min.y, height, 1e-6);
    near(bounds.max.z - bounds.min.z, c.frameDepth, 1e-6);
    assert.ok(g.userData.refs.glass.geometry.parameters.depth > 0);
    near(state.aperture.areaSquareMetres, width * height);
  }
});

test('sweep envelope conservatively contains every box corner over the whole opening interval', () => {
  for (const angleDegrees of [0, 17, 45, 80]) {
    const s = validateWindow(score, cfg({angleDegrees})), d = s.dimensions, box = s.clearance;
    for (let step = 0; step <= 200; step++) {
      const t = angleDegrees * Math.PI / 180 * step / 200;
      for (const x of [0, d.leafWidth]) for (const y of [0, d.leafHeight]) for (const z of [-d.sashDepth / 2, d.sashDepth / 2]) {
        const p = [x * Math.cos(t) - z * Math.sin(t), y, x * Math.sin(t) + z * Math.cos(t)].map((v, i) => v + d.pivotLocal[i]);
        p.forEach((v, i) => assert.ok(v >= box.min[i] && v <= box.max[i]));
      }
    }
    assert.equal(box.collisionVerified, false);
    assert.equal(box.buildingComplianceVerified, false);
    assert.equal(s.collisionStatus, 'not_verified');
  }
});

test('tint and angle validation reject invalid values and the actual glass uses selected color', () => {
  for (const angleDegrees of [-1, 80.1, NaN, Infinity, '30']) {
    assert.throws(() => validateWindow(score, cfg({angleDegrees})), /angleDegrees/);
  }
  for (const glassColor of ['red', '#fff', '#zz9999', -1, 0x1000000, null]) {
    assert.throws(() => validateWindow(score, cfg({glassColor})), /glassColor/);
  }
  for (const glassColor of ['#4B6F8A', 0x4b6f8a]) {
    const g = buildWindow(THREE, score, cfg({glassColor}));
    assert.equal(g.userData.refs.glass.material.attenuationColor.getHexString(), '4b6f8a');
    assert.equal(g.userData.refs.glass.material.type, 'MeshPhysicalMaterial');
    assert.equal(g.userData.refs.glass.material.opacity, 1);
    assert.equal(g.userData.refs.glass.material.ior, 1.5);
    assert.ok(g.userData.refs.glass.material.transmission > 0);
  }
});

test('authored transmission and roughness drive physical glass, retain opacity 1 and validate range', () => {
  assert.equal(defaultWindowConfig().glassTransmission, 0.82);
  assert.equal(defaultWindowConfig().glassRoughness, 0.08);
  for (const [glassTransmission, glassRoughness] of [[0, 0], [0.43, 0.29], [1, 1]]) {
    const c = cfg({glassTransmission, glassRoughness});
    const material = buildWindow(THREE, score, c).userData.refs.glass.material;
    assert.equal(material.transmission, glassTransmission);
    assert.equal(material.roughness, glassRoughness);
    assert.equal(material.opacity, 1);
    assert.equal(material.ior, 1.5);
    assert.equal(inspectWindow(score, c).config.glassTransmission, glassTransmission);
    assert.equal(inspectWindow(score, c).config.glassRoughness, glassRoughness);
  }
  for (const key of ['glassTransmission', 'glassRoughness']) {
    for (const value of [-0.001, 1.001, NaN, Infinity, '0.5', null]) {
      assert.throws(() => validateWindow(score, cfg({[key]: value})), new RegExp(key));
    }
  }
});

test('host fitting, minimum glass room, unknown types and unsupported deformation fail explicitly', () => {
  for (const invalid of [
    {width: 100}, {width: 0.701}, {sill: 0}, {sill: 70}, {centerAlongWall: 0},
    {height: -1}, {width: 0.18}, {frameWidth: 0}, {frameDepth: 0},
    {hostPatchId: 'p000'}, {hostPatchId: 'missing'}, {type: 'invented'}, {enabled: 'true'},
  ]) assert.throws(() => validateWindow(score, cfg(invalid)));
  const stretched = structuredClone(score); stretched.edits.scaleEast = 1.5;
  assert.throws(() => validateWindow(stretched, cfg()), /non-unit/);
});

test('parent assembly transform carries every component and hinge exactly once', () => {
  const g = buildWindow(THREE, score, cfg({angleDegrees: 45}));
  const parent = new THREE.Group(); parent.add(g); parent.updateMatrixWorld(true);
  const before = inspectWindow(score, cfg({angleDegrees: 45}), g);
  parent.position.set(7, 4, -3);
  const after = inspectWindow(score, cfg({angleDegrees: 45}), g);
  nearVector(after.scene.hingeWorld, before.scene.hingeWorld.map((v, i) => v + [7, 4, -3][i]));
  for (const key of ['fixedFrameMatrixWorld', 'glassMatrixWorld']) {
    nearVector(after.scene[key].slice(12, 15), before.scene[key].slice(12, 15).map((v, i) => v + [7, 4, -3][i]));
  }
});

test('building rotations 0, 90 and 180 degrees preserve the wall-relative hinge and sash relationship', () => {
  const c=cfg({angleDegrees:45}),group=buildWindow(THREE,score,c),parent=new THREE.Group();parent.add(group);parent.updateMatrixWorld(true);
  const first=inspectWindow(score,c,group),hinge=new THREE.Vector3(...first.scene.hingeWorld);
  const fixed=group.userData.refs.fixedFrame.matrix.clone(),pivot=group.userData.refs.pivot.matrix.clone();
  for(const theta of [0,Math.PI/2,Math.PI]){
    parent.rotation.y=theta;parent.updateMatrixWorld(true);const state=inspectWindow(score,c,group);
    nearVector(state.scene.hingeWorld,hinge.clone().applyAxisAngle(new THREE.Vector3(0,1,0),theta).toArray());
    assert.deepEqual(group.userData.refs.fixedFrame.matrix.elements,fixed.elements);
    assert.deepEqual(group.userData.refs.pivot.matrix.elements,pivot.elements);
    assert.equal(state.scene.displayedAngleDegrees,45);
  }
});
