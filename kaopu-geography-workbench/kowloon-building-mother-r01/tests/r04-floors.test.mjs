import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import * as THREE from '../../hk-three-buildings-r01/viewer/vendor/three.module.js';
import {buildFloors as buildR03Floors} from '../r03/floors.mjs';
import {defaultFloorConfig, validateFloorConfig, buildFloors, inspectFloors} from '../r04/floors.mjs';

const score = JSON.parse(await readFile(new URL('../../hk-three-buildings-r01/geometry/B359971994401063C0.score.json', import.meta.url), 'utf8'));
const near = (a, b, tolerance = 1e-5) => assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);
const cfg = changes => ({...defaultFloorConfig(), enabled: true, ...changes});
const length = Math.hypot(3.25, -8.4375), u = [3.25 / length, -8.4375 / length], v = [-u[1], u[0]];
const pilotPolygon = [[1.2, -1.3], [4.92, -1.3], [4.92, 1.3], [1.2, 1.3]]
  .map(([s, t]) => [3 + u[0] * s + v[0] * t, -8 + u[1] * s + v[1] * t]);
const pilot = {openingId: 'stair-001:upper-slab-opening', hostSlabId: 'slab-002', purpose: 'stair', polygon2D: pilotPolygon};
const extraCfg = changes => cfg({additionalOpenings: [structuredClone(pilot)], ...changes});
const rectangle = (x, y, width, depth) => [[x, y], [x + width, y], [x + width, y + depth], [x, y + depth]];
const area = ring => Math.abs(ring.reduce((sum, a, i) => {
  const b = ring[(i + 1) % ring.length]; return sum + a[0] * b[1] - a[1] * b[0];
}, 0) / 2);

function topArea(mesh) {
  const positions = mesh.geometry.getAttribute('position');
  const surface = mesh.geometry.userData.surfaces.find(s => s.role === 'top');
  let sum = 0;
  for (let i = surface.start; i < surface.start + surface.count; i += 3) {
    const a = new THREE.Vector3().fromBufferAttribute(positions, i);
    const b = new THREE.Vector3().fromBufferAttribute(positions, i + 1);
    const c = new THREE.Vector3().fromBufferAttribute(positions, i + 2);
    sum += b.sub(a).cross(c.sub(a)).length() / 2;
  }
  return sum;
}
const geometryBuffers = mesh => ({
  position: Array.from(mesh.geometry.getAttribute('position').array),
  normal: Array.from(mesh.geometry.getAttribute('normal').array),
  groups: mesh.geometry.groups,
});
function syntheticScore(loops, roofTop = 10) {
  const s = structuredClone(score), operations = [{id: 'p000', kind: 'roofPlane', heightPlane: [0, 0, roofTop], loops}];
  for (const ring of loops) for (let i = 0; i < ring.length; i++) {
    operations.push({id: `p${String(operations.length).padStart(3, '0')}`, kind: 'wallStrip',
      edge: [ring[i], ring[(i + 1) % ring.length]], bottom: 0, top: roofTop});
  }
  s.reconstruction.operations = operations;
  return s;
}

test('r04 floor adapter and tests leave immutable r03 and current entry unchanged', async () => {
  for (const [path, expected] of [
    ['../r03/floors.mjs', '1cba90c1701e36040c601abec769e6acb3a9c66445b3cc5d595c1b2d7876c85d'],
    ['../floors.mjs', '6f8b1d92c21c21ba6fea6632d3ebd584295b4b178776c9167f9a27d3ede6c4a5'],
    ['../index.html', '1c5a58b3125e0465b12a80d600ba3a9e9c564a960b88c76eb87232570d74001c'],
  ]) assert.equal(createHash('sha256').update(await readFile(new URL(path, import.meta.url))).digest('hex'), expected);
});

test('r04 without extra openings preserves all 21 r03 slab geometries and actual FFLs', () => {
  const c = cfg(), a = buildR03Floors(THREE, score, c), b = buildFloors(THREE, score, c);
  const state = inspectFloors(score, c);
  assert.equal(state.slabCount, 21);
  assert.equal(state.additionalOpeningCount, 0);
  assert.equal(state.openings.length, 21);
  near(state.floors[0].fflM, 3.40000191);
  near(state.floors[1].fflM, 6.60000191);
  a.children.forEach((mesh, i) => assert.deepEqual(geometryBuffers(mesh), geometryBuffers(b.children[i])));
  assert.deepEqual(state.slabs[0].loops, state.footprint.loops);
});

test('one exact-host stair aperture changes slab-002 only and preserves the central reserve on every slab', () => {
  const before = inspectFloors(score, cfg()), state = inspectFloors(score, extraCfg());
  const a = buildFloors(THREE, score, cfg()), b = buildFloors(THREE, score, extraCfg());
  assert.equal(state.floorCount, 21);
  assert.equal(state.slabCount, 21);
  assert.equal(state.openings.length, 22);
  assert.equal(state.additionalOpeningCount, 1);
  assert.deepEqual(state.additionalOpeningIds, [pilot.openingId]);
  assert.deepEqual(state.footprint, before.footprint);
  near(area(pilotPolygon), 9.672);
  state.slabs.forEach((slab, index) => {
    assert.deepEqual(slab.loops[0], score.reconstruction.operations[0].loops[0]);
    assert.deepEqual(slab.loops[1], [[-1, -1], [1, -1], [1, 1], [-1, 1]]);
    assert.equal(slab.loops.length, index === 1 ? 3 : 2);
    assert.equal(slab.openingIds.length, index === 1 ? 2 : 1);
    assert.equal(b.children[index].geometry.userData.holeCount, index === 1 ? 2 : 1);
    if (index !== 1) {
      assert.deepEqual(slab, before.slabs[index]);
      assert.deepEqual(geometryBuffers(a.children[index]), geometryBuffers(b.children[index]));
    }
  });
  const host = state.slabs[1], mesh = b.children[1];
  assert.deepEqual(host.loops[2], pilotPolygon);
  near(host.slabAreaSquareMetres, before.slabs[1].slabAreaSquareMetres - 9.672);
  near(topArea(mesh), host.slabAreaSquareMetres);
  near(mesh.geometry.userData.solidVolumeCubicMetres, host.slabAreaSquareMetres * host.thickness);
  const apertureSides = mesh.geometry.userData.surfaces.find(s => s.openingId === pilot.openingId);
  assert.equal(apertureSides.role, 'void-side');
  assert.equal(apertureSides.count, 24);
  const record = state.openings.find(o => o.openingId === pilot.openingId);
  assert.equal(record.hostSlabId, 'slab-002');
  assert.equal(record.purpose, 'stair');
  assert.equal(record.reservedVolumeId, null);
  assert.equal(record.interiorEvidence, 'unknown');
  assert.equal(record.liftStopInferred, false);
  assert.deepEqual(record.polygon2D, pilotPolygon);
});

test('real ray passes through upper stair opening and hits lower slab, while central shaft stays empty', () => {
  const group = buildFloors(THREE, score, extraCfg());
  const center = [0, 1].map(axis => pilotPolygon.reduce((sum, p) => sum + p[axis], 0) / 4);
  group.updateMatrixWorld(true);
  const ray = new THREE.Raycaster(new THREE.Vector3(center[0], 7, -center[1]), new THREE.Vector3(0, -1, 0));
  assert.equal(ray.intersectObject(group.children[1], false).length, 0);
  const hits = ray.intersectObject(group.children[0], false);
  assert.ok(hits.length > 0);
  near(hits[0].point.y, 3.40000191);
  const core = new THREE.Raycaster(new THREE.Vector3(0, 100, 0), new THREE.Vector3(0, -1, 0));
  assert.equal(core.intersectObjects(group.children, false).length, 0);
});

test('all source footprint vertices survive, source recipe and input config are not mutated', () => {
  const input = extraCfg(), configJSON = JSON.stringify(input), scoreJSON = JSON.stringify(score);
  const group = buildFloors(THREE, score, input);
  for (const mesh of group.children) {
    const position = mesh.geometry.getAttribute('position');
    for (const point of score.reconstruction.operations[0].loops[0]) {
      let found = false;
      for (let i = 0; i < position.count; i++) {
        if (Math.abs(position.getX(i) - point[0]) < 1e-5 && Math.abs(-position.getZ(i) - point[1]) < 1e-5) { found = true; break; }
      }
      assert.ok(found, `Missing source vertex ${point}`);
    }
  }
  assert.equal(JSON.stringify(input), configJSON);
  assert.equal(JSON.stringify(score), scoreJSON);
  assert.doesNotThrow(() => JSON.stringify(inspectFloors(score, input, group)));
  assert.doesNotThrow(() => group.toJSON());
});

test('hidden and assembly-excluded host retains its aperture data without altering other hosts', () => {
  const hidden = extraCfg({floorStates: {'slab-002': {visible: false}}});
  const hiddenState = inspectFloors(score, hidden), hiddenGroup = buildFloors(THREE, score, hidden);
  assert.ok(hiddenState.includedSlabIds.includes('slab-002'));
  assert.ok(!hiddenState.visibleSlabIds.includes('slab-002'));
  assert.equal(hiddenGroup.children[1].visible, false);
  assert.equal(hiddenState.slabs[1].loops.length, 3);
  const excluded = extraCfg({floorStates: {'slab-002': {enabled: false}}});
  const excludedState = inspectFloors(score, excluded);
  assert.ok(!excludedState.includedSlabIds.includes('slab-002'));
  assert.equal(excludedState.openings.find(o => o.openingId === pilot.openingId).effectiveEnabled, false);
  assert.equal(excludedState.slabs[0].effectiveEnabled, true);
  const disabled = extraCfg({enabled: false}), disabledState = inspectFloors(score, disabled);
  assert.equal(buildFloors(THREE, score, disabled).visible, false);
  assert.deepEqual(disabledState.includedSlabIds, []);
  assert.deepEqual(disabledState.visibleSlabIds, []);
  assert.equal(disabledState.slabs[1].loops.length, 3);
  const allHidden = inspectFloors(score, extraCfg({visible: false}));
  assert.equal(allHidden.includedSlabIds.length, 21);
  assert.deepEqual(allHidden.visibleSlabIds, []);
});

test('existing source holes are preserved and can neither overlap nor be enclosed by a new aperture', () => {
  const outer = rectangle(-10, -10, 20, 20), sourceHole = rectangle(4, 4, 2, 2);
  const s = syntheticScore([outer, sourceHole]);
  const stair = {...pilot, polygon2D: rectangle(-6, -6, 2, 2)};
  const state = inspectFloors(s, cfg({additionalOpenings: [stair]}));
  assert.deepEqual(state.slabs[1].loops, [outer, sourceHole, [[-1, -1], [1, -1], [1, 1], [-1, 1]], stair.polygon2D]);
  assert.equal(state.slabs[1].openingIds.length, 3);
  near(topArea(buildFloors(THREE, s, cfg({additionalOpenings: [stair]})).children[1]), 388);
  for (const polygon2D of [rectangle(3, 3, 4, 4), rectangle(5, 5, 2, 2)]) {
    assert.throws(() => validateFloorConfig(s, cfg({additionalOpenings: [{...pilot, polygon2D}]})), /disjoint/);
  }
});

test('missing hosts and duplicate opening identities fail instead of being silently dropped or reassigned', () => {
  assert.throws(() => inspectFloors(score, cfg({additionalOpenings: [{...pilot, hostSlabId: 'slab-999'}]})), /missing host/);
  assert.throws(() => inspectFloors(score, cfg({additionalOpenings: [pilot, {...pilot, hostSlabId: 'slab-003'}]})), /Duplicate openingId/);
  assert.throws(() => inspectFloors(score, cfg({additionalOpenings: [{...pilot, openingId: 'slab-001:opening-001'}]})), /Duplicate openingId/);
  const short = syntheticScore([rectangle(-10, -20, 30, 40)], 5);
  assert.throws(() => inspectFloors(short, extraCfg()), /missing host slab slab-002/);
});

test('out-of-footprint, service-overlapping, self-intersecting and degenerate apertures fail, even hidden', () => {
  for (const polygon2D of [
    rectangle(100, 100, 2, 2), rectangle(-0.5, -0.5, 1, 1), rectangle(-2, -2, 4, 4),
    rectangle(1, -0.5, 1, 1), [[2, -10], [6, -12], [2, -12], [6, -10]],
    [[2, -10], [3, -10], [4, -10]], [[2, -10], [2, -10], [4, -11]],
    [[2, -10], [3, -10], [Infinity, -11]], [[2, -10], [3, -10], [4]],
  ]) assert.throws(() => validateFloorConfig(score, extraCfg({enabled: false, additionalOpenings: [{...pilot, polygon2D}]})));
  assert.throws(() => validateFloorConfig(score, extraCfg({additionalOpenings: [pilot, {...pilot, openingId: 'stair-002:overlap'}]})), /disjoint/);
  for (const invalid of [
    {additionalOpenings: null}, {additionalOpenings: {}}, {additionalOpenings: [null]},
    {additionalOpenings: [{...pilot, purpose: 'lift'}]}, {additionalOpenings: [{...pilot, openingId: ''}]},
    {additionalOpenings: [{...pilot, hostSlabId: 'floor-002'}]},
  ]) assert.throws(() => validateFloorConfig(score, cfg(invalid)));
});

test('concave host rejection checks edges, not just the aperture corners', () => {
  const uShape = [[-5, -5], [5, -5], [5, 5], [2, 5], [2, -1], [-2, -1], [-2, 5], [-5, 5]];
  const s = syntheticScore([uShape]);
  assert.throws(() => validateFloorConfig(s, cfg({serviceCoreVoid: {enabled: false},
    additionalOpenings: [{...pilot, polygon2D: rectangle(-4, -2, 8, 4)}]})), /wholly inside/);
});

test('parent placement moves the holed slab once, without baking translation into source or openings', () => {
  const c = extraCfg(), group = buildFloors(THREE, score, c), parent = new THREE.Group();
  parent.add(group); parent.position.set(6, 3, -8);
  const inspection = inspectFloors(score, c, group);
  assert.deepEqual(group.position.toArray(), [0, 0, 0]);
  assert.deepEqual(inspection.scene.slabs[1].matrixWorld.slice(12, 15), [6, 3, -8]);
  assert.deepEqual(inspection.slabs[1].loops[2], pilotPolygon);
  assert.deepEqual(inspection.openings.find(o => o.openingId === pilot.openingId).polygon2D, pilotPolygon);
});
