import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import * as THREE from '../../hk-three-buildings-r01/viewer/vendor/three.module.js';
import {buildFloors} from '../r04/floors.mjs';
import {deriveCirculationProposal, buildCirculation} from '../r05/circulation.mjs';
import {defaultGuardConfig, deriveGuardProposal, buildGuards} from '../r05/guards.mjs';
import {DOOR_ROLE_PRESETS, defaultDoorConfig, deriveDoorProposal, buildDoor, inspectDoor, sampleDoorSweep, setDoorAngle, auditDoorHostGeometry, auditDoorPassage} from '../r05/door.mjs';
const score = JSON.parse(await readFile(new URL('../../hk-three-buildings-r01/geometry/B359971994401063C0.score.json', import.meta.url), 'utf8'));
const near = (a, b, eps = 1e-5) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);
const graph = deriveCirculationProposal(score, {enabled: true}, {enabled: true});
function setup(config = {}, floorConfig = null) {
  const circulation = floorConfig ? deriveCirculationProposal(score, {enabled: true, ...floorConfig}, {enabled: true}) : graph;
  const proposal = deriveDoorProposal(circulation.floorState, circulation.pairs[0], {enabled: true, ...config});
  return {circulation, proposal, door: buildDoor(THREE, proposal)};
}
function parts(door) {
  return {host: door.getObjectByName(door.userData.hostName), frame: door.getObjectByName(door.userData.frameName),
    pivot: door.getObjectByName(door.userData.pivotName), leaf: door.getObjectByName(`${door.name}:leaf`)};
}
function obstacleAt(door, local, size = 0.03) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), new THREE.MeshBasicMaterial());
  mesh.name = 'test-external-solid'; mesh.position.copy(door.localToWorld(new THREE.Vector3(...local)));
  mesh.updateMatrixWorld(true); return mesh;
}
function poseSnapshot(door) {
  door.updateWorldMatrix(true, true); const matrices = [];
  door.traverse(o => matrices.push([o.name, [...o.matrixWorld.elements]]));
  return {matrices, userData: JSON.stringify(door.userData)};
}

test('door defaults disabled; partition is openly proposed, role presets do not change dimensions or infer use', () => {
  const before = JSON.stringify(graph), p = deriveDoorProposal(graph.floorState, graph.pairs[0]);
  assert.equal(defaultDoorConfig().enabled, false); assert.equal(p.effectiveEnabled, false);
  assert.equal(p.host.type, 'PROPOSED_PARTITION'); assert.equal(p.host.observed, false);
  assert.equal(p.host.editable, true); assert.equal(p.actualBuildingUse, 'unknown');
  assert.equal(p.interiorEvidence, 'unknown'); assert.match(p.dimensionsAre, /not_hotel_or_Hong_Kong/);
  assert.ok(Object.values(p.safety).every(x => x === false));
  for (const role of ['entry', 'service', 'room']) {
    assert.deepEqual(Object.keys(DOOR_ROLE_PRESETS[role]).sort(), ['label', 'role']);
    const other = deriveDoorProposal(graph.floorState, graph.pairs[0], {role});
    assert.deepEqual(other.opening, p.opening); assert.deepEqual(other.host, p.host);
  }
  assert.equal(buildDoor(THREE, p).visible, false); assert.equal(JSON.stringify(graph), before);
});

test('host threshold uses exact floor002 FFL and a right-handed local basis away from the stairs', () => {
  const {proposal: p, door} = setup();
  near(p.host.width, 2.6); near(p.host.bottomFFLM, graph.floorState.floors[1].fflM, 1e-12);
  near(p.opening.bottomFFLM, p.host.bottomFFLM, 1e-12); near(p.threshold.elevationM, p.host.bottomFFLM, 1e-12);
  assert.equal(p.hostSlabId, 'slab-002'); assert.equal(p.parentFloorId, 'floor-002');
  const {x, y, z} = p.basis; const cross = new THREE.Vector3(...x).cross(new THREE.Vector3(...y));
  cross.toArray().forEach((n, i) => near(n, z[i])); near(door.matrix.determinant(), 1);
  const run = graph.pairs[0].basis.runEastNorth;
  near(z[0], -run[0]); near(z[2], run[1]);
  const host = parts(door).host;
  host.children.forEach(m => {m.geometry.computeBoundingBox(); const b = m.geometry.boundingBox.clone().applyMatrix4(m.matrixWorld); near(b.min.y, m.name.includes('lintel') ? p.host.bottomFFLM + p.config.height : p.host.bottomFFLM);});
});

test('partition is real closed jamb/lintel solids with an unfilled through-opening, no transparent fake wall', () => {
  const {proposal: p, door} = setup(), {host} = parts(door);
  assert.equal(host.children.length, 3);
  for (const mesh of host.children) {
    assert.equal(mesh.material.opacity, 1); assert.equal(mesh.material.transparent, false);
    assert.equal(mesh.userData.closedSolid, true);
  }
  const ray = (x, y) => {
    const origin = door.localToWorld(new THREE.Vector3(x, y, 1));
    return new THREE.Raycaster(origin, new THREE.Vector3(...p.basis.z).negate()).intersectObject(host, true);
  };
  assert.equal(ray(0, 1).length, 0, 'Opening actually contains no host-wall triangles');
  assert.ok(ray(0.8, 1).length); assert.ok(ray(0, 2.3).length);
  assert.equal(door.children.some(o => /threshold/i.test(o.name)), false, 'No duplicate floating threshold slab');
});

test('manual dimensions propagate coherently into opening, partition, frame, leaf and handle', () => {
  const {proposal: p, door} = setup({width: 1.1, height: 2.3, wallHeight: 2.8, wallThickness: 0.18,
    leafThickness: 0.06, frameWidth: 0.07, frameDepth: 0.03, clearance: 0.006, handleHeight: 1.15});
  near(p.opening.width, 1.1); near(p.opening.height, 2.3); near(p.frame.width, 1.24);
  near(p.frame.height, 2.37); near(p.leaf.width, 1.088); near(p.leaf.height, 2.288);
  const {leaf, frame} = parts(door); assert.deepEqual(leaf.userData.dimensions, [p.leaf.width, p.leaf.height, 0.06]);
  near(frame.children.find(m => m.name.includes('frame-header')).position.y, 2.335);
  near(door.getObjectByName(`${door.name}:handle-lever-1`).position.y, 1.15);
  assert.equal(sampleDoorSweep(THREE, door).clear, true, 'Updated leaf and handles clear own partition/frame through 100°');
});

test('both handed leaves open away, fixed host/frame/hinges do not move, and angles preserve full plate shape', () => {
  for (const swing of ['left', 'right']) {
    const {door} = setup({swing}), {host, frame, pivot, leaf} = parts(door);
    const fixed = [...host.children, ...frame.children].map(m => [...m.matrixWorld.elements]);
    const vertex = leaf.localToWorld(new THREE.Vector3(0, 0, 0));
    const result = setDoorAngle(THREE, door, 100); assert.equal(result.committed, true);
    assert.equal(result.clear, true); near(pivot.rotation.y, (swing === 'left' ? -100 : 100) * Math.PI / 180);
    const open = leaf.localToWorld(new THREE.Vector3(0, 0, 0));
    assert.ok(open.distanceTo(vertex) > 0.5);
    const local = door.worldToLocal(open.clone()); assert.ok(local.z > 0.3, 'Leaf opens outward, not onto stair run');
    [...host.children, ...frame.children].forEach((m, i) => assert.deepEqual([...m.matrixWorld.elements], fixed[i]));
    const inspection = inspectDoor(door.userData.state, door); assert.equal(inspection.scene.currentAngleDeg, 100);
    assert.equal(inspection.scene.movingPartCount, 8);
  }
});

test('real slab rays support threshold and the outward region at exact FFL, without filling stair apertures', () => {
  const {circulation, proposal: p, door} = setup();
  const floors = buildFloors(THREE, score, circulation.configWithOpenings), slab = floors.children.find(m => m.name === p.hostSlabId);
  const points = [[0, 0, 0], [-p.opening.width / 2 + 0.001, 0, 0], [p.opening.width / 2 - 0.001, 0, 0],
    [0, 0, 0.6], [-0.5, 0, 0.6], [0.5, 0, 0.6]];
  for (const q of points) {
    const world = door.localToWorld(new THREE.Vector3(...q));
    const ray = new THREE.Raycaster(world.clone().add(new THREE.Vector3(0, 0.01, 0)), new THREE.Vector3(0, -1, 0));
    const hit = ray.intersectObject(slab)[0]; assert.ok(hit); near(hit.point.y, p.threshold.elevationM);
  }
  const cut = circulation.pairs[0].proposedOpeningRecords[0].polygon2D;
  const center = [0, 1].map(i => cut.reduce((s, q) => s + q[i], 0) / cut.length);
  assert.equal(new THREE.Raycaster(new THREE.Vector3(center[0], p.threshold.elevationM + 0.01, -center[1]), new THREE.Vector3(0, -1, 0)).intersectObject(slab).length, 0);
});

test('full sampled opening clears actual two-stack stairs, guardrail meshes, first three slabs, own partition and frame', () => {
  const {circulation, door} = setup();
  const stairs = buildCirculation(THREE, circulation), guards = buildGuards(THREE, deriveGuardProposal(circulation, defaultGuardConfig()));
  const floors = buildFloors(THREE, score, circulation.configWithOpenings);
  const obstacles = [stairs, guards, ...floors.children.slice(0, 3)], before = poseSnapshot(door);
  const result = sampleDoorSweep(THREE, door, obstacles);
  assert.equal(result.clear, true); assert.deepEqual(result.collisions, []);
  assert.equal(result.sampleCount, 101); assert.equal(result.maximumStepDeg, 1);
  assert.ok(result.externalObstacleMeshCount > 12); assert.equal(result.selfObstacleMeshCount, 6);
  assert.equal(result.sampling, 'angular_samples_not_continuous_certification'); assert.equal(result.exactContinuousSweepCertified, false);
  assert.deepEqual(poseSnapshot(door), before, 'Sampling never commits a pose');
  assert.ok(result.triangleTests < 5000, 'Broadphase avoids testing all remote slab/stair/rail triangles at every sample');
});

test('full sweep detects an intermediate obstacle missed at closed/open endpoints and rejects commit atomically', () => {
  const {door, proposal: p} = setup(), angle = 42 * Math.PI / 180;
  const obstacle = obstacleAt(door, [p.leaf.pivotLocal[0] + 0.65 * Math.cos(angle), 1.4, p.leaf.pivotLocal[2] + 0.65 * Math.sin(angle)], 0.04);
  assert.equal(sampleDoorSweep(THREE, door, [obstacle], {fromAngleDeg: 0, toAngleDeg: 0}).clear, true);
  assert.equal(sampleDoorSweep(THREE, door, [obstacle], {fromAngleDeg: 100, toAngleDeg: 100}).clear, true);
  const before = poseSnapshot(door), result = setDoorAngle(THREE, door, 100, [obstacle]);
  assert.equal(result.committed, false); assert.equal(result.clear, false);
  assert.ok(result.collisions.some(c => c.angleDeg >= 40 && c.angleDeg <= 44 && c.movingId.endsWith(':leaf')));
  assert.deepEqual(poseSnapshot(door), before);
});

test('visible handle boxes participate in the actual-mesh sweep, including non-indexed obstacle triangles', () => {
  const {door} = setup({angleDeg: 45});
  const handle = door.getObjectByName(`${door.name}:handle-lever-1`), point = handle.getWorldPosition(new THREE.Vector3());
  const obstacle = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, 0.012).toNonIndexed(), new THREE.MeshBasicMaterial());
  obstacle.name = 'handle-only-test'; obstacle.position.copy(point); obstacle.updateMatrixWorld(true);
  const result = sampleDoorSweep(THREE, door, [obstacle], {fromAngleDeg: 45, toAngleDeg: 45});
  assert.equal(result.clear, false); assert.ok(result.collisions.some(c => c.movingId.endsWith('handle-lever-1')));
});

test('touching floor/contact faces are ignored by epsilon but positive penetration is rejected', () => {
  const {door, proposal: p} = setup();
  const block = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.02), new THREE.MeshBasicMaterial());
  block.name = 'contact-test'; block.quaternion.copy(door.quaternion);
  block.position.copy(door.localToWorld(new THREE.Vector3(0, p.config.clearance - 0.05, p.leaf.pivotLocal[2]))); block.updateMatrixWorld(true);
  assert.equal(sampleDoorSweep(THREE, door, [block], {fromAngleDeg: 0, toAngleDeg: 0}).clear, true);
  block.position.y += 0.001; block.updateMatrixWorld(true);
  assert.equal(sampleDoorSweep(THREE, door, [block], {fromAngleDeg: 0, toAngleDeg: 0}).clear, false);
});

test('closed solid containing the leaf is not incorrectly cleared just because no surface crosses its box', () => {
  const {door} = setup(); const block = obstacleAt(door, [0, 1.1, 0.1], 5);
  const result = sampleDoorSweep(THREE, door, [block], {fromAngleDeg: 0, toAngleDeg: 0});
  assert.equal(result.clear, false); assert.ok(result.collisions.some(c => c.movingId.endsWith(':leaf')));
});

test('display hide is independent of membership; parent floor disable suppresses all door descendants', () => {
  const hidden = setup({visible: false}); assert.equal(hidden.door.visible, false); assert.equal(hidden.proposal.effectiveEnabled, true);
  const off = setup({}, {floorStates: {'slab-002': {enabled: false}}});
  assert.equal(off.proposal.effectiveEnabled, false); assert.equal(off.door.visible, false);
  assert.ok(inspectDoor(off.proposal, off.door).scene.meshes.every(m => !m.effectiveVisible));
  const {door} = setup(); const obstacle = obstacleAt(door, [0, 1, 0.09]); obstacle.visible = false;
  assert.equal(sampleDoorSweep(THREE, door, [obstacle], {fromAngleDeg: 0, toAngleDeg: 0}).clear, false);
  obstacle.userData.effectiveEnabled = false;
  assert.equal(sampleDoorSweep(THREE, door, [obstacle], {fromAngleDeg: 0, toAngleDeg: 0}).clear, true);
});

test('basis rotations and inherited source placement are applied once and preserve local door behaviour', () => {
  const changedPlan = structuredClone(graph.pairs[0]), a = 0.15, u = changedPlan.basis.runEastNorth;
  const rotated = [u[0] * Math.cos(a) - u[1] * Math.sin(a), u[0] * Math.sin(a) + u[1] * Math.cos(a)];
  changedPlan.basis.runEastNorth = rotated; changedPlan.basis.lateralEastNorth = [-rotated[1], rotated[0]];
  const p = deriveDoorProposal(graph.floorState, changedPlan, {enabled: true}), door = buildDoor(THREE, p);
  assert.equal(sampleDoorSweep(THREE, door).clear, true);
  const before = door.localToWorld(new THREE.Vector3(0, 0, 0));
  const source = new THREE.Group(); source.position.set(13, 4, -9); source.rotation.y = 0.4; source.add(door); source.updateMatrixWorld(true);
  const expected = before.clone().applyMatrix4(source.matrixWorld), actual = door.localToWorld(new THREE.Vector3(0, 0, 0)); near(actual.distanceTo(expected), 0);
  const stored = [...door.position.toArray()]; assert.equal(setDoorAngle(THREE, door, 90).committed, true);
  assert.deepEqual(door.position.toArray(), stored); assert.deepEqual(p.basis.originEastUpSouth, stored);
});

test('unknown/invalid dimensions, invalid swing/basis and unsupported placement fail without touching last valid state', () => {
  const {door} = setup(), before = poseSnapshot(door);
  for (const change of [{unknown: 1}, {width: NaN}, {width: -1}, {height: 0}, {height: 2.5}, {wallWidth: 0.95},
    {wallThickness: 0}, {leafThickness: Infinity}, {role: 'hotel'}, {role: 'toString'}, {swing: 'inward'},
    {angleDeg: -1}, {angleDeg: 101}, {enabled: 1}, {floorId: 'floor-999'}, {runOffset: 2}]) {
    assert.throws(() => deriveDoorProposal(graph.floorState, graph.pairs[0], change));
  }
  const badPlan = structuredClone(graph.pairs[0]); badPlan.basis.runEastNorth[0] *= 2;
  assert.throws(() => deriveDoorProposal(graph.floorState, badPlan), /orthonormal/);
  for (const angle of [-1, 101, NaN, Infinity]) assert.throws(() => setDoorAngle(THREE, door, angle));
  for (const change of [{stepDeg: 2}, {stepDeg: 0}, {epsilon: -1}, {toAngleDeg: 101}, {unknown: true}]) assert.throws(() => sampleDoorSweep(THREE, door, [], change));
  assert.deepEqual(poseSnapshot(door), before);
  assert.doesNotThrow(() => JSON.stringify(inspectDoor(door.userData.state, door)));
  assert.doesNotThrow(() => door.toJSON());
});


test('active fixed partition rejects upper-slab penetration before commit while disabled door permits floor-only edits', () => {
  const compact = deriveCirculationProposal(score, {enabled: true, floorToFloor: 2.6}, {enabled: true});
  const before = JSON.stringify(compact);
  assert.throws(() => deriveDoorProposal(compact.floorState, compact.pairs[0], {enabled: true}), /fixed partition penetrates actual slab-003 soffit by 0.100/);
  const disabled = deriveDoorProposal(compact.floorState, compact.pairs[0]);
  assert.equal(disabled.effectiveEnabled, false); assert.equal(disabled.support.fixedHostOverheadClear, false);
  assert.equal(JSON.stringify(compact), before);
  const touching = setup({}, {floorToFloor: 2.7});
  near(touching.proposal.support.overheadSlabs[0].hostClearanceM, 0);
  const floors = buildFloors(THREE, score, touching.circulation.configWithOpenings);
  assert.equal(auditDoorHostGeometry(THREE, touching.door, [floors]).clear, true, 'Contact-only top face is allowed, not positive penetration');
});

test('overhead validation uses actual footprint/holes, not a universal wall-height or global higher-slab rule', () => {
  const plan = graph.pairs[0], {originEastNorth: o, runEastNorth: u, lateralEastNorth: v} = plan.basis;
  const point = (s, t) => [o[0] + u[0] * s + v[0] * t, o[1] + u[1] * s + v[1] * t];
  const hole = {openingId: 'independent-overhead-hole', hostSlabId: 'slab-003', purpose: 'stair',
    polygon2D: [[-0.7, -1.5], [-0.3, -1.5], [-0.3, 1.5], [-0.7, 1.5]].map(([s, t]) => point(s, t))};
  const altered = deriveCirculationProposal(score, {enabled: true, floorToFloor: 2.6, additionalOpenings: [hole]}, {enabled: true});
  const p = deriveDoorProposal(altered.floorState, altered.pairs[0], {enabled: true, runOffset: -0.5});
  assert.equal(p.support.fixedHostOverheadClear, true);
  assert.equal(p.support.overheadSlabs.some(r => r.slabId === 'slab-003'), false);
  const door = buildDoor(THREE, p), floors = buildFloors(THREE, score, altered.configWithOpenings);
  assert.equal(auditDoorHostGeometry(THREE, door, [floors]).clear, true);
});

test('actual fixed-host external audit clears default stairs/guards/slabs but catches deliberate fixed partition penetration', () => {
  const {circulation, door} = setup();
  const stairs = buildCirculation(THREE, circulation), guards = buildGuards(THREE, deriveGuardProposal(circulation));
  const floors = buildFloors(THREE, score, circulation.configWithOpenings);
  const before = poseSnapshot(door), result = auditDoorHostGeometry(THREE, door, [stairs, guards, floors]);
  assert.equal(result.clear, true); assert.equal(result.fixedMeshCount, 6); assert.ok(result.externalObstacleMeshCount > 12);
  const intruder = obstacleAt(door, [0.8, 1.2, 0], 0.1); intruder.name = 'deliberate-guard-penetration';
  const bad = auditDoorHostGeometry(THREE, door, [stairs, guards, floors, intruder]);
  assert.equal(bad.clear, false); assert.ok(bad.collisions.some(c => c.obstacleId === intruder.name && c.fixedId.includes('host-jamb')));
  intruder.visible = false; assert.equal(auditDoorHostGeometry(THREE, door, [intruder]).clear, false);
  intruder.userData.effectiveEnabled = false; assert.equal(auditDoorHostGeometry(THREE, door, [intruder]).clear, true);
  assert.deepEqual(poseSnapshot(door), before);
});


test('fully open left and right doors admit an actually supported 0.70 by 1.90 m swept L-corridor to both shared-floor lane centres', () => {
  for (const swing of ['left', 'right']) {
    const {circulation, door} = setup({swing, angleDeg: 100});
    const stairs = buildCirculation(THREE, circulation), guards = buildGuards(THREE, deriveGuardProposal(circulation));
    const floors = buildFloors(THREE, score, circulation.configWithOpenings), before = poseSnapshot(door);
    const r = auditDoorPassage(THREE, door, [stairs, guards, floors]);
    assert.equal(r.clear, true); assert.equal(r.geometryClear, true); assert.equal(r.supported, true);
    near(r.widthM, 0.7); near(r.heightM, 1.9); near(r.thresholdFFLM, circulation.floorState.floors[1].fflM);
    assert.equal(r.volumes.length, 3); assert.equal(r.paths.length, 2);
    assert.deepEqual(r.paths[0].nodesDoorLocal, [[0, 0, 1], [0, 0, -0.6], [0.7, 0, -0.6]]);
    assert.deepEqual(r.paths[1].nodesDoorLocal, [[0, 0, 1], [0, 0, -0.6], [-0.7, 0, -0.6]]);
    assert.equal(r.supportRayCount, 234); assert.deepEqual(r.supportErrors, []); assert.deepEqual(r.collisions, []);
    assert.ok(r.triangleTests > 0); assert.match(r.basis, /full_swept_rectangular_prisms/);
    assert.equal(r.navigationConnectionEnabled, false); assert.equal(r.egressCertified, false);
    assert.deepEqual(poseSnapshot(door), before, 'Corridor test never changes the displayed door pose');
  }
});

test('closed and 45-degree display poses block the same straight doorway corridor even though the door motion sweep clears', () => {
  const {circulation} = setup(), stairs = buildCirculation(THREE, circulation);
  const guards = buildGuards(THREE, deriveGuardProposal(circulation)), floors = buildFloors(THREE, score, circulation.configWithOpenings);
  for (const swing of ['left', 'right']) for (const angleDeg of [0, 45]) {
    const {door} = setup({swing, angleDeg}), r = auditDoorPassage(THREE, door, [stairs, guards, floors]);
    assert.equal(sampleDoorSweep(THREE, door, [stairs, guards, floors]).clear, true);
    assert.equal(r.clear, false); assert.equal(r.supported, true);
    assert.ok(r.collisions.some(c => c.obstacleId.endsWith(':leaf')));
    assert.ok(r.collisions.every(c => c.obstacleId.startsWith(door.name)), 'Rail/stair solids are not the approach obstruction');
  }
});

test('visible rail behind doorway is the intentional same-floor center-gap bar beyond the transfer turn, not a doorway cross-bar', () => {
  const {circulation, door} = setup({angleDeg: 100}), guards = buildGuards(THREE, deriveGuardProposal(circulation));
  const rail = guards.children.find(m => m.userData.role === 'guard-toprail'
    && m.userData.railRunIds.includes('floor-002:opening-guard:residual-front'));
  assert.ok(rail); assert.deepEqual(rail.userData.hostFloorIds, ['floor-002']);
  const inverse = door.matrixWorld.clone().invert().multiply(rail.matrixWorld), pos = rail.geometry.attributes.position;
  let minS = Infinity, maxS = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    const p = new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(inverse);
    minS = Math.min(minS, -p.z); maxS = Math.max(maxS, -p.z); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
  }
  assert.ok(minS > 1.13 && maxS < 1.2); assert.ok(minY > 0.94 && maxY < 1.01);
  const floors = buildFloors(THREE, score, circulation.configWithOpenings);
  const r = auditDoorPassage(THREE, door, [guards, floors]);
  const maxCorridorS = Math.max(...r.volumes.map(v => -v.minDoorLocal[2])); near(maxCorridorS, 0.95);
  assert.ok(minS - maxCorridorS > 0.18); assert.equal(r.clear, true);
});

test('corridor detects an actual solid beside the centreline inside the lateral swept volume, and refuses missing slab support', () => {
  const {circulation, door} = setup({angleDeg: 100}), floors = buildFloors(THREE, score, circulation.configWithOpenings);
  const obstacle = obstacleAt(door, [0.8, 1, -0.3], 0.05); obstacle.name = 'off-centre-lateral-obstruction';
  const bad = auditDoorPassage(THREE, door, [floors, obstacle]);
  assert.equal(bad.clear, false); assert.ok(bad.collisions.some(c => c.volumeId.endsWith('turn-to-departure') && c.obstacleId === obstacle.name));
  assert.ok(bad.collisions.every(c => c.volumeId !== 'door-passage:approach-through-frame'));
  assert.equal(bad.supported, true);
  const unsupported = auditDoorPassage(THREE, door, []);
  assert.equal(unsupported.geometryClear, true); assert.equal(unsupported.supported, false); assert.equal(unsupported.clear, false);
  assert.ok(unsupported.supportErrors.some(e => e.includes('Actual slab-002 support ray failed')));
});

test('fixed casing is proud of the partition with back-face contact, no overlapping wall volume or z-fighting front faces', () => {
  for (const config of [{}, {wallThickness: 0.18, frameDepth: 0.03, leafThickness: 0.06, clearance: 0.006}]) {
    const {door, proposal: p} = setup(config), {host, frame} = parts(door);
    const boxLocal = mesh => {mesh.geometry.computeBoundingBox(); mesh.updateMatrix(); return mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrix);};
    const walls = host.children.map(boxLocal), casing = frame.children.filter(m => m.userData.role === 'fixed-frame-solid');
    assert.equal(casing.length, 3);
    for (const mesh of casing) {
      const box = boxLocal(mesh); near(box.min.z, p.config.wallThickness / 2, 1e-7);
      near(box.max.z, p.config.wallThickness / 2 + p.config.frameDepth, 1e-7);
      assert.equal(mesh.material.polygonOffset, false, 'Geometry contact, not polygonOffset masking');
      let positiveContact = false;
      for (const wall of walls) {
        const overlap = ['x', 'y', 'z'].map(axis => Math.min(box.max[axis], wall.max[axis]) - Math.max(box.min[axis], wall.min[axis]));
        assert.equal(overlap.every(v => v > 1e-7), false, 'No positive-volume frame/partition intersection');
        if (overlap[0] > 1e-7 && overlap[1] > 1e-7) {near(overlap[2], 0, 1e-7); positiveContact = true;}
        assert.ok(box.max.z - wall.max.z >= p.config.frameDepth - 1e-7, 'Front surfaces are physically separated by casing depth');
      }
      assert.equal(positiveContact, true, 'Each casing solid has real back-face contact with its host');
    }
    for (const plate of frame.children.filter(m => m.userData.role === 'visible-fixed-hinge-plate')) {
      near(boxLocal(plate).min.z, p.config.wallThickness / 2 + p.config.frameDepth, 1e-7);
    }
    assert.equal(sampleDoorSweep(THREE, door).clear, true, 'Proud frame still clears leaf/handles over full 0–100 degree sweep');
  }
});
