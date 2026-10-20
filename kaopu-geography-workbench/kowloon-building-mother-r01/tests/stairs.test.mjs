import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import * as THREE from '../../hk-three-buildings-r01/viewer/vendor/three.module.js';
import {defaultFloorConfig, inspectFloors, buildFloors} from '../r04/floors.mjs';
import {defaultStairConfig, deriveStairProposal, buildStairs, inspectStairs} from '../r04/stairs.mjs';

const score = JSON.parse(await readFile(new URL('../../hk-three-buildings-r01/geometry/B359971994401063C0.score.json', import.meta.url), 'utf8'));
const near = (a, b, eps = 1e-5) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);
function setup(stairChanges = {}, floorChanges = {}) {
  const stairConfig = {...defaultStairConfig(), enabled: true, ...stairChanges};
  const floorConfig = {...defaultFloorConfig(), enabled: true, ...floorChanges};
  const base = inspectFloors(score, floorConfig), proposal = deriveStairProposal(base, stairConfig);
  floorConfig.additionalOpenings = proposal.openingRecords;
  const state = inspectFloors(score, floorConfig), stairs = buildStairs(THREE, state, stairConfig);
  const floors = buildFloors(THREE, score, floorConfig);
  return {stairConfig, floorConfig, base, state, proposal, stairs, floors};
}
const centroid = loop => [0, 1].map(axis => loop.reduce((sum, p) => sum + p[axis], 0) / loop.length);
function downwardHit(meshes, p, elevation) {
  const ray = new THREE.Raycaster(new THREE.Vector3(p[0], elevation + 0.01, -p[1]), new THREE.Vector3(0, -1, 0));
  return ray.intersectObjects(meshes, false)[0];
}
function assertClosed(mesh) {
  const pos = mesh.geometry.getAttribute('position'), edges = new Map();
  const key = i => [pos.getX(i), pos.getY(i), pos.getZ(i)].map(x => x.toFixed(5)).join(',');
  for (let i = 0; i < pos.count; i += 3) for (let j = 0; j < 3; j++) {
    const a = key(i + j), b = key(i + (j + 1) % 3);
    assert.notEqual(a, b, 'No degenerate mesh edge');
    const k = [a, b].sort().join('|'); edges.set(k, (edges.get(k) ?? 0) + 1);
  }
  for (const count of edges.values()) assert.equal(count, 2, 'Every welded undirected edge belongs to exactly two faces');
}

test('default remains disabled with no cut or active navigation; all claims remain explicitly authored', () => {
  const before = JSON.stringify(score), base = inspectFloors(score), p = deriveStairProposal(base);
  assert.equal(p.enabled, false);
  assert.equal(p.effectiveEnabled, false);
  assert.deepEqual(p.openingRecords, []);
  assert.equal(p.proposedOpeningRecords.length, 1);
  assert.equal(p.interiorEvidence, 'unknown');
  for (const key of ['realLocationVerified', 'structuralSupportVerified', 'buildingComplianceVerified',
    'groundConnectionAdded', 'elevatorAdded', 'doorsModeled', 'guardsModeled', 'circulationComplete',
    'evacuationPermitted', 'navigationConnectionEnabled']) assert.equal(p[key], false);
  assert.equal(JSON.stringify(score), before);
  const g = buildStairs(THREE, base);
  assert.equal(g.visible, false);
  assert.equal(g.children.length, 3);
  assert.doesNotThrow(() => JSON.stringify(inspectStairs(base, {}, g)));
  assert.doesNotThrow(() => g.toJSON());
});

test('exact south-wing basis, 20 risers and independent upper-host opening fit the measured concave footprint', () => {
  const {base, state, proposal: p} = setup();
  near(p.lowerFFLM, 3.40000191);
  near(p.upperFFLM, 6.60000191);
  near(p.midFFLM, 5.00000191);
  near(p.dimensions.actualRiser, 0.16);
  assert.equal(p.dimensions.risersPerFlight, 10);
  assert.equal(p.dimensions.totalRisers, 20);
  assert.equal(p.dimensions.totalTreads, 18);
  near(p.dimensions.runLength, 2.52);
  near(p.dimensions.width, 2.6);
  near(p.dimensions.totalLength, 4.92);
  near(p.openingAreaSquareMetres, 9.672);
  near(p.footprintBoundaryClearanceM, 1.7342249207646052);
  near(p.serviceReserveClearanceM, 7.2510558330009);
  const [u, v] = [p.basis.runEastNorth, p.basis.lateralEastNorth];
  near(Math.hypot(...u), 1); near(Math.hypot(...v), 1); near(u[0] * v[0] + u[1] * v[1], 0);
  near(u[0] * v[1] - u[1] * v[0], 1);
  assert.equal(p.openingRecords[0].hostSlabId, 'slab-002');
  assert.equal(state.openings.length, 22);
  assert.equal(base.openings.length, 21);
  assert.deepEqual(state.serviceCoreVoid, base.serviceCoreVoid);
  assert.deepEqual(state.slabs[0], base.slabs[0]);
  assert.deepEqual(state.slabs.slice(2), base.slabs.slice(2));
  near(state.slabs[1].slabAreaSquareMetres, base.slabs[1].slabAreaSquareMetres - 9.672);
});

test('enabled geometry refuses a missing or mismatched physical upper slab cut', () => {
  const base = inspectFloors(score, {...defaultFloorConfig(), enabled: true});
  const c = {...defaultStairConfig(), enabled: true};
  assert.throws(() => buildStairs(THREE, base, c), /matching upper-host/);
  const {state} = setup();
  const bad = structuredClone(state);
  bad.openings.find(o => o.openingId.includes('upper-slab-opening')).footprintLoop[0][0] += 0.01;
  assert.throws(() => buildStairs(THREE, bad, c), /matching upper-host/);
});

test('both stepped flights and intermediate landing are closed positive-volume solids, not floating tread boxes', () => {
  const {proposal: p, stairs} = setup();
  assert.equal(stairs.children.length, 3);
  for (const mesh of stairs.children) {
    assertClosed(mesh);
    assert.equal(mesh.geometry.userData.closedSolid, true);
    assert.ok(mesh.geometry.userData.solidVolumeCubicMetres > 0);
    const normals = mesh.geometry.getAttribute('normal');
    for (let i = 0; i < normals.count; i++) near(Math.hypot(normals.getX(i), normals.getY(i), normals.getZ(i)), 1);
  }
  for (let i = 0; i < 2; i++) {
    near(stairs.children[i].geometry.userData.solidVolumeCubicMetres, p.flights[i].expectedVolumeM3);
    near(p.flights[i].expectedVolumeM3, 0.80472);
    assert.equal(p.flights[i].flightMeshRiserCount, 9);
    assert.equal(p.flights[i].riserCount, 10);
    assert.ok(p.flights[i].profile.every(q => q[1] >= 0));
  }
  near(stairs.children[2].geometry.userData.solidVolumeCubicMetres, 0.624);
  assert.equal(p.floorLandings[0].geometry, 'retained_physical_host_slab_region_no_duplicate_mesh');
  assert.equal(p.floorLandings[1].geometry, 'retained_physical_host_slab_region_no_duplicate_mesh');
});

test('actual tread and landing mesh rays hit every exact design elevation', () => {
  const {proposal: p, stairs, floors} = setup(), meshes = [...stairs.children, ...floors.children];
  for (const patch of p.walkingPatches) {
    const hit = downwardHit(meshes, centroid(patch.footprintLoop), patch.elevationM);
    assert.ok(hit, `No physical tread/landing for ${patch.id}`);
    near(hit.point.y, patch.elevationM);
    if (patch.id.includes(':landing:')) assert.ok(hit.object.name.startsWith('slab-'));
  }
  // The actual upper host has a hole, while the lower slab remains under it.
  const hole = p.openingRecords[0].polygon2D, center = centroid(hole);
  const upper = floors.children.find(m => m.name === p.upperSlabId);
  assert.equal(downwardHit([upper], center, p.upperFFLM + 0.1), undefined);
  near(downwardHit([floors.children[0]], center, p.upperFFLM + 0.1).point.y, p.lowerFFLM);
});

test('geometric path has exactly 20 continuous rises and every horizontal segment has real supporting geometry', () => {
  const {proposal: p, stairs, floors} = setup(), meshes = [...stairs.children, ...floors.children];
  const path = p.walkPath.map(n => n.positionLocalEastUpSouth);
  near(path[0][1], p.lowerFFLM); near(path.at(-1)[1], p.upperFFLM);
  let risers = 0, totalRise = 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i], dh = b[1] - a[1], horizontal = Math.hypot(a[0] - b[0], a[2] - b[2]);
    if (dh > 1e-7) {near(horizontal, 0); near(dh, p.dimensions.actualRiser); risers++; totalRise += dh;}
    else {
      near(dh, 0);
      if (horizontal > 1e-7) {
        const q = [(a[0] + b[0]) / 2, -(a[2] + b[2]) / 2];
        near(downwardHit(meshes, q, a[1]).point.y, a[1]);
      }
    }
  }
  assert.equal(risers, 20); near(totalRise, p.floorDeltaM);
  // Last risers are real host/mid-landing vertical faces, not phantom treads.
  for (const f of p.flights) {
    const t = (f.lateral[0] + f.lateral[1]) / 2;
    const s = f.sStart + f.direction * p.dimensions.runLength;
    const [u, v, o] = [p.basis.runEastNorth, p.basis.lateralEastNorth, p.basis.originEastNorth];
    const point = [o[0] + u[0] * s + v[0] * t, o[1] + u[1] * s + v[1] * t];
    const direction = new THREE.Vector3(u[0] * f.direction, 0, -u[1] * f.direction);
    const origin = new THREE.Vector3(point[0], f.endFFL - p.dimensions.actualRiser / 2, -point[1]).addScaledVector(direction, -0.01);
    const hits = new THREE.Raycaster(origin, direction).intersectObjects(meshes, false);
    assert.ok(hits.length); near(hits[0].distance, 0.01);
  }
});

test('vertical clearance is tested against actual slab and stair solids across tread and landing patches', () => {
  const {proposal: p, stairs, floors} = setup(), meshes = [...stairs.children, ...floors.children];
  near(p.headroom.minimumClearanceM, 3);
  let minRay = Infinity;
  for (const patch of p.walkingPatches) {
    const mid = centroid(patch.footprintLoop);
    // Interior samples include near-corner rays, not merely a centerline.
    const samples = [mid, ...patch.footprintLoop.map(q => [q[0] * 0.95 + mid[0] * 0.05, q[1] * 0.95 + mid[1] * 0.05])];
    for (const q of samples) {
      const ray = new THREE.Raycaster(new THREE.Vector3(q[0], patch.elevationM + 1e-4, -q[1]), new THREE.Vector3(0, 1, 0));
      const hit = ray.intersectObjects(meshes, false)[0];
      assert.ok(hit, `No overhead test hit for ${patch.id}`);
      assert.ok(hit.distance + 1e-4 >= p.config.minHeadroom - 1e-5);
      minRay = Math.min(minRay, hit.distance + 1e-4);
    }
  }
  near(minRay, 3);
  assert.throws(() => setup({minHeadroom: 2.7}, {floorToFloor: 2.8}), /headroom/);
});

test('stair solids cannot penetrate lower slab and stay inside the actual upper aperture until arrival', () => {
  const {proposal: p, stairs, state} = setup();
  const upper = state.slabs.find(s => s.slabId === p.upperSlabId);
  for (const mesh of stairs.children) {
    const pos = mesh.geometry.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      assert.ok(pos.getY(i) >= p.lowerFFLM - 1e-5);
      assert.ok(pos.getY(i) < p.upperFFLM);
    }
  }
  // Final tread lies above slab soffit, but only inside the cut. At the shared
  // vertical boundary it contacts the slab face without any overlap volume.
  assert.ok(p.flights[1].treads.at(-1).elevationM > upper.bottom);
  const [u, v, o] = [p.basis.runEastNorth, p.basis.lateralEastNorth, p.basis.originEastNorth];
  for (const mesh of stairs.children) {
    const pos = mesh.geometry.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      const de = pos.getX(i) - o[0], dn = -pos.getZ(i) - o[1], s = de * u[0] + dn * u[1], t = de * v[0] + dn * v[1];
      assert.ok(s >= p.config.landingDepth - 1e-5 && s <= p.dimensions.totalLength + 1e-5);
      assert.ok(Math.abs(t) <= p.dimensions.width / 2 + 1e-5);
    }
  }
});

test('actual endpoint elevation edits recalculate risers and cut while retaining pure immutable inputs', () => {
  const {base, proposal: p} = setup({}, {floorToFloor: 3.6});
  near(p.floorDeltaM, 3.6); near(p.dimensions.actualRiser, 0.15);
  assert.equal(p.dimensions.risersPerFlight, 12);
  assert.equal(p.dimensions.totalTreads, 22);
  near(p.dimensions.runLength, 3.08);
  const before = JSON.stringify(base), again = deriveStairProposal(base, {...defaultStairConfig(), enabled: true});
  assert.deepEqual(again, p); assert.equal(JSON.stringify(base), before);
});

test('disable suppresses active output, hide affects only display, and host placement is inherited exactly once', () => {
  const active = setup(), hidden = setup({visible: false});
  assert.equal(hidden.stairs.visible, false);
  assert.equal(hidden.stairs.userData.state.effectiveEnabled, true);
  assert.deepEqual(hidden.proposal.openingRecords, active.proposal.openingRecords);
  for (const changes of [{enabled: false}, {floorStates: {'slab-001': {enabled: false}}},
    {floorStates: {'slab-002': {enabled: false}}}]) {
    const item = setup({}, changes);
    assert.equal(item.stairs.userData.state.effectiveEnabled, false);
    assert.equal(item.stairs.visible, false);
    assert.equal(item.stairs.userData.state.navigationConnectionEnabled, false);
  }
  const parent = new THREE.Group(); parent.add(active.stairs);
  const before = inspectStairs(active.state, active.stairConfig, active.stairs);
  parent.position.set(12, 4, -9);
  const after = inspectStairs(active.state, active.stairConfig, active.stairs);
  assert.deepEqual(active.stairs.position.toArray(), [0, 0, 0]);
  for (let i = 0; i < after.scene.solids.length; i++) {
    after.scene.solids[i].matrixWorld.slice(12, 15).forEach((n, j) => near(n - before.scene.solids[i].matrixWorld[12 + j], [12, 4, -9][j]));
  }
  assert.deepEqual(before.walkPath, after.walkPath);
});

test('invalid fit, bounds, endpoints, landing joints and unrelated holes fail without clipping or inference', () => {
  for (const change of [
    {originEast: 100}, {originEast: 0, originNorth: 0}, {runEast: 0, runNorth: 0},
    {flightWidth: 0}, {flightWidth: 2, landingDepth: 1.2}, {targetRiser: NaN},
    {lowerFloorId: 'floor-002', upperFloorId: 'floor-001'}, {upperFloorId: 'floor-003'},
    {upperFloorId: 'floor-999'}, {landingThickness: 0.1}, {enabled: 1}, {notAParameter: true},
  ]) assert.throws(() => setup(change));
  assert.throws(() => setup({}, {slabThickness: 0.1}), /final riser face/);
  const {base, proposal} = setup(), extra = structuredClone(base);
  extra.openings.push({openingId: 'unrelated-hole', hostSlabId: 'slab-001', footprintLoop: proposal.floorLandings[0].footprintLoop});
  assert.throws(() => deriveStairProposal(extra, {...defaultStairConfig(), enabled: true}), /retained stair floor landing/);
});
