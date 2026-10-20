import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import * as THREE from '../../hk-three-buildings-r01/viewer/vendor/three.module.js';
import {cutHostedWindow, defaultWindowConfig} from '../r03/window.mjs';
import {defaultFloorConfig, validateFloorConfig, buildFloors, inspectFloors} from '../r03/floors.mjs';

const score = JSON.parse(await readFile(new URL('../../hk-three-buildings-r01/geometry/B359971994401063C0.score.json', import.meta.url), 'utf8'));
const cfg = changes => ({...defaultFloorConfig(), enabled: true, ...changes});
const near = (a, b, epsilon = 1e-5) => assert.ok(Math.abs(a - b) < epsilon, `${a} != ${b}`);
const area = ring => Math.abs(ring.reduce((sum, a, i) => {
  const b = ring[(i + 1) % ring.length]; return sum + a[0] * b[1] - a[1] * b[0];
}, 0) / 2);
function inside(p, ring, boundary = true) {
  let result = false;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    const cross = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
    if (Math.abs(cross) < 1e-5 && p[0] >= Math.min(a[0], b[0]) - 1e-5 && p[0] <= Math.max(a[0], b[0]) + 1e-5
      && p[1] >= Math.min(a[1], b[1]) - 1e-5 && p[1] <= Math.max(a[1], b[1]) + 1e-5) return boundary;
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) result = !result;
  }
  return result;
}
function patchArea(mesh, role) {
  const positions = mesh.geometry.getAttribute('position');
  const surface = mesh.geometry.userData.surfaces.find(s => s.role === role);
  let sum = 0;
  for (let i = surface.start; i < surface.start + surface.count; i += 3) {
    const a = new THREE.Vector3().fromBufferAttribute(positions, i);
    const b = new THREE.Vector3().fromBufferAttribute(positions, i + 1);
    const c = new THREE.Vector3().fromBufferAttribute(positions, i + 2);
    sum += b.sub(a).cross(c.sub(a)).length() / 2;
  }
  return sum;
}
function syntheticScore(loops, roofTop = 10) {
  const s = structuredClone(score), operations = [{id: 'p000', kind: 'roofPlane', heightPlane: [0, 0, roofTop], loops}];
  for (const ring of loops) for (let i = 0; i < ring.length; i++) {
    operations.push({id: `p${String(operations.length).padStart(3, '0')}`, kind: 'wallStrip',
      edge: [ring[i], ring[(i + 1) % ring.length]], bottom: 0, top: roofTop});
  }
  s.reconstruction.operations = operations;
  return s;
}

test('disabled default leaves measured source untouched, retains hidden slabs and reserves an authored void', () => {
  const original = JSON.stringify(score), state = inspectFloors(score), group = buildFloors(THREE, score);
  assert.equal(JSON.stringify(score), original);
  assert.equal(group.visible, false);
  assert.equal(group.children.length, 21);
  assert.deepEqual(state.includedSlabIds, []);
  assert.deepEqual(state.visibleSlabIds, []);
  assert.equal(state.measuredFloorCount, null);
  assert.equal(state.originalFloorCount, 'unknown');
  assert.equal(state.measuredInteriorLevels, false);
  assert.deepEqual(state.serviceCoreVoid.loop, [[-1, -1], [1, -1], [1, 1], [-1, 1]]);
  assert.equal(state.footprint.designHoleCount, 1);
  assert.ok(state.slabs.every(s => s.bottom > state.envelope.base));
  for (const key of ['foundationsAdded', 'liftsAdded', 'stairsAdded', 'roomLayoutAdded', 'buildingComplianceVerified']) {
    assert.equal(state.authoredPolicy[key], false);
  }
  assert.doesNotThrow(() => JSON.stringify(inspectFloors(score, {}, group)));
  assert.doesNotThrow(() => group.toJSON());
});

test('all 21 volumetric slabs preserve the exact concave footprint and actual empty core hole', () => {
  const c = cfg(), state = inspectFloors(score, c), group = buildFloors(THREE, score, c);
  const outer = state.footprint.loops[0], core = state.footprint.loops[1];
  assert.deepEqual(outer, score.reconstruction.operations[0].loops[0]);
  near(state.footprint.slabAreaSquareMetres, area(outer) - 4);
  for (const mesh of group.children) {
    const positions = mesh.geometry.getAttribute('position'), normals = mesh.geometry.getAttribute('normal');
    assert.ok(mesh.geometry.boundingBox.max.y > mesh.geometry.boundingBox.min.y);
    near(patchArea(mesh, 'top'), area(outer) - 4);
    near(patchArea(mesh, 'bottom'), area(outer) - 4);
    const top = mesh.geometry.userData.surfaces.find(s => s.role === 'top');
    const bottom = mesh.geometry.userData.surfaces.find(s => s.role === 'bottom');
    for (let i = 0; i < positions.count; i++) {
      const p = [positions.getX(i), -positions.getZ(i)];
      assert.ok(inside(p, outer), `Vertex escaped exact footprint: ${p}`);
      assert.ok(!inside(p, core, false), `Vertex entered reserved void: ${p}`);
      assert.ok(positions.getY(i) <= state.envelope.slabCeiling + 1e-5);
    }
    for (const surface of [top, bottom]) for (let i = surface.start; i < surface.start + surface.count; i += 3) {
      const tri = [0, 1, 2].map(j => [positions.getX(i + j), -positions.getZ(i + j)]);
      // Barycentric sampling catches fan triangulation across concave notches
      // and triangles that would cover a reserved void despite valid vertices.
      for (let a = 0; a <= 6; a++) for (let b = 0; b <= 6 - a; b++) {
        const weights = [a / 6, b / 6, (6 - a - b) / 6];
        const p = [0, 1].map(axis => tri.reduce((sum, q, k) => sum + q[axis] * weights[k], 0));
        assert.ok(inside(p, outer));
        assert.ok(!inside(p, core, false));
      }
      near(normals.getY(i), surface === top ? 1 : -1);
    }
    const roles = mesh.geometry.userData.surfaces.map(s => s.role);
    assert.deepEqual(roles, ['top', 'bottom', 'outer-side', 'void-side']);
  }
  // A ray through the void misses every slab, while one through solid floor
  // hits: this checks rendered triangles, not just recipe metadata.
  group.updateMatrixWorld(true);
  const voidRay = new THREE.Raycaster(new THREE.Vector3(0, 100, 0), new THREE.Vector3(0, -1, 0));
  assert.equal(voidRay.intersectObjects(group.children, false).length, 0);
  const solidRay = new THREE.Raycaster(new THREE.Vector3(2, 100, 2), new THREE.Vector3(0, -1, 0));
  assert.ok(solidRay.intersectObjects(group.children, false).length >= state.slabCount);
});

test('source holes survive alongside the authored reserved opening and get vertical void sides', () => {
  const outer = [[-10, -10], [10, -10], [10, 10], [-10, 10]];
  const measuredHole = [[4, 4], [4, 6], [6, 6], [6, 4]];
  const s = syntheticScore([outer, measuredHole]), c = cfg();
  const state = inspectFloors(s, c), mesh = buildFloors(THREE, s, c).children[0];
  assert.equal(state.footprint.sourceHoleCount, 1);
  assert.equal(mesh.geometry.userData.holeCount, 2);
  near(patchArea(mesh, 'top'), 392);
  assert.equal(mesh.geometry.userData.surfaces.filter(s => s.role === 'void-side').length, 2);
  const positions = mesh.geometry.getAttribute('position');
  for (let i = 0; i < positions.count; i++) assert.ok(!inside([positions.getX(i), -positions.getZ(i)], measuredHole, false));
  assert.throws(() => validateFloorConfig(s, cfg({serviceCoreVoid: {centerEast: 5, centerNorth: 5, width: 3, depth: 3}})), /wholly inside/);
});

test('a rectangle whose corners are inside but bridges a concave notch is rejected', () => {
  const uShape = [[-5, -5], [5, -5], [5, 5], [2, 5], [2, -1], [-2, -1], [-2, 5], [-5, 5]];
  const s = syntheticScore([uShape]);
  const corners = [[-4, -2], [4, -2], [4, 2], [-4, 2]];
  assert.ok(corners.every(p => inside(p, uShape, false)));
  assert.throws(() => validateFloorConfig(s, cfg({serviceCoreVoid: {width: 8, depth: 4}})), /wholly inside/);
});

test('spacing, first offset and thickness propagate deterministically; last slab clips below roof', () => {
  const c = cfg({floorToFloor: 3, firstSlabOffset: 2.9, slabThickness: 0.4});
  const state = inspectFloors(score, c), again = inspectFloors(score, c);
  assert.deepEqual(state, again);
  assert.equal(state.slabCount, 23);
  state.slabs.forEach((slab, i) => {
    near(slab.bottom, state.envelope.base + 2.9 + i * 3);
    near(slab.top - slab.bottom, slab.thickness);
    assert.ok(slab.top <= state.envelope.slabCeiling);
    near(slab.clearHeight, (state.slabs[i + 1]?.bottom ?? state.envelope.roofTop) - slab.top);
    assert.equal(state.floors[i].floorId, slab.floorId);
    assert.equal(state.floors[i].slabId, slab.slabId);
    near(state.floors[i].elevation, slab.top);
  });
  const shortened = structuredClone(score), roofTop = state.envelope.base + 3.35;
  for (const op of shortened.reconstruction.operations) {
    if (op.kind === 'roofPlane') op.heightPlane[2] = roofTop; else op.top = roofTop;
  }
  const clipped = inspectFloors(shortened, cfg()), mesh = buildFloors(THREE, shortened, cfg()).children[0];
  assert.equal(clipped.slabCount, 1);
  assert.equal(clipped.slabs[0].roofClipped, true);
  near(clipped.slabs[0].thickness, 0.1);
  near(clipped.slabs[0].top, roofTop - 0.05);
  assert.ok(mesh.geometry.boundingBox.max.y < roofTop);
});

test('per-floor view visibility and assembly membership are independent', () => {
  const c = cfg({floorStates: {'slab-001': {visible: false}, 'slab-002': {enabled: false}}});
  const state = inspectFloors(score, c), group = buildFloors(THREE, score, c);
  assert.ok(state.includedSlabIds.includes('slab-001'));
  assert.ok(!state.visibleSlabIds.includes('slab-001'));
  assert.ok(!state.includedSlabIds.includes('slab-002'));
  assert.equal(group.children[0].visible, false);
  assert.equal(group.children[1].visible, false);
  assert.equal(group.children[2].visible, true);
  const hidden = inspectFloors(score, {...c, visible: false});
  assert.deepEqual(hidden.includedSlabIds, state.includedSlabIds);
  assert.deepEqual(hidden.visibleSlabIds, []);
  const disabled = inspectFloors(score, {...c, enabled: false});
  assert.deepEqual(disabled.includedSlabIds, []);
  assert.deepEqual(disabled.visibleSlabIds, []);
});

test('floor spaces, one-host openings and the cross-level reserved volume have distinct identities', () => {
  const state = inspectFloors(score, cfg());
  assert.equal(state.editableProposal, true);
  assert.equal(state.interiorEvidence, 'unknown');
  assert.equal(state.openings.length, state.slabCount);
  assert.equal(new Set(state.openings.map(o => o.openingId)).size, state.openings.length);
  for (const floor of state.floors) {
    const slab = state.slabs.find(s => s.slabId === floor.slabId);
    assert.equal(slab.floorId, floor.floorId);
    assert.equal(floor.fflM, floor.sslM);
    assert.equal(floor.sslM, slab.topElevationM);
    assert.equal(floor.labelDisplayOnly, true);
    assert.equal(floor.finishLayerModeled, false);
    assert.equal(floor.interiorEvidence, 'unknown');
    const [opening] = state.openings.filter(o => o.hostSlabId === slab.slabId);
    assert.deepEqual(slab.openingIds, [opening.openingId]);
    assert.equal(opening.reservedVolumeId, state.serviceCoreVolume.volumeId);
    assert.equal(opening.liftStopInferred, false);
  }
  assert.equal(state.serviceCoreVolume.actualServiceCoreMeasured, false);
  assert.equal(state.serviceCoreVolume.liftStopsInferred, false);
  assert.ok(state.serviceCoreVolume.topElevationM > state.slabs[0].topElevationM);
});

test('parent assembly placement carries slabs once and optional scene inspection is serializable', () => {
  const c = cfg(), group = buildFloors(THREE, score, c), parent = new THREE.Group();
  parent.add(group);
  const before = inspectFloors(score, c, group);
  parent.position.set(13, 4, -7);
  const after = inspectFloors(score, c, group);
  assert.deepEqual(group.position.toArray(), [0, 0, 0]);
  after.scene.slabs.forEach((slab, i) => slab.matrixWorld.slice(12, 15).forEach((v, axis) =>
    near(v - before.scene.slabs[i].matrixWorld[12 + axis], [13, 4, -7][axis])));
  assert.deepEqual(after.slabs, before.slabs);
  parent.visible = false;
  assert.equal(inspectFloors(score, c, group).scene.slabs[0].effectiveVisible, false);
  assert.doesNotThrow(() => JSON.stringify(after));
});

test('hosted-window cut and authored common roof-top changes remain compatible', () => {
  const cut = cutHostedWindow(score, {...defaultWindowConfig(), enabled: true});
  assert.deepEqual(inspectFloors(cut, cfg()), inspectFloors(score, cfg()));
  const edited = structuredClone(score);
  for (const op of edited.reconstruction.operations) {
    if (op.kind === 'roofPlane') op.heightPlane[2] = 80; else op.top = 80;
  }
  assert.equal(inspectFloors(edited, cfg()).slabCount, 24);
  assert.deepEqual(inspectFloors(edited, cfg()).footprint, inspectFloors(score, cfg()).footprint);
});

test('invalid dimensions, voids, topology, scaling and unsupported roof types fail explicitly', () => {
  for (const invalid of [
    {floorToFloor: 0}, {floorToFloor: NaN}, {slabThickness: 0}, {slabThickness: -1},
    {slabThickness: 1, floorToFloor: 1}, {firstSlabOffset: 0}, {roofClearance: -1},
    {enabled: 1}, {visible: 'true'}, {floorStates: {'slab-001': {opacity: 0}}},
    {serviceCoreVoid: {width: 0}}, {serviceCoreVoid: {centerEast: Infinity}},
    {serviceCoreVoid: {centerEast: 100}}, {serviceCoreVoid: {width: 100, depth: 100}},
  ]) assert.throws(() => validateFloorConfig(score, cfg(invalid)));
  const stretched = structuredClone(score); stretched.edits.scaleHeight = 1.5;
  assert.throws(() => validateFloorConfig(stretched, cfg()), /non-unit/);
  const sloped = structuredClone(score); sloped.reconstruction.operations[0].heightPlane[0] = 0.1;
  assert.throws(() => validateFloorConfig(sloped, cfg()), /horizontal/);
  const missing = structuredClone(score); missing.reconstruction.operations.pop();
  assert.throws(() => validateFloorConfig(missing, cfg()), /every exact footprint edge/);
  const mismatch = structuredClone(score); mismatch.reconstruction.operations[1].top -= 1;
  assert.throws(() => validateFloorConfig(mismatch, cfg()), /share the roof top/);
  const tooShort = syntheticScore([[[-5, -5], [5, -5], [5, 5], [-5, 5]]], 2);
  assert.equal(inspectFloors(tooShort, cfg()).slabCount, 0);
  assert.equal(buildFloors(THREE, tooShort, cfg()).children.length, 0);
});
