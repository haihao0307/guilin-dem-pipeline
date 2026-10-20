import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import * as THREE from '../../hk-three-buildings-r01/viewer/vendor/three.module.js';
import {defaultFloorConfig, buildFloors} from '../r04/floors.mjs';
import {defaultCirculationConfig, deriveCirculationProposal, buildCirculation} from '../r05/circulation.mjs';
import {defaultGuardConfig, deriveGuardProposal, buildGuards, inspectGuards, auditGuardGeometry} from '../r05/guards.mjs';

const score = JSON.parse(await readFile(new URL('../../hk-three-buildings-r01/geometry/B359971994401063C0.score.json', import.meta.url), 'utf8'));
const near = (a, b, eps = 1e-5) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);
function setup(guardChanges = {}, floorChanges = {}, circulationChanges = {}) {
  const floorConfig = {...defaultFloorConfig(), enabled: true, ...floorChanges};
  const circulation = deriveCirculationProposal(score, floorConfig, {...defaultCirculationConfig(), enabled: true, ...circulationChanges});
  const derived = deriveGuardProposal(circulation, {...defaultGuardConfig(), ...guardChanges});
  const floors = buildFloors(THREE, score, circulation.configWithOpenings);
  const stairs = buildCirculation(THREE, circulation), guards = buildGuards(THREE, derived);
  return {circulation, derived, floors, stairs, guards};
}
function assertClosed(mesh) {
  const geometry = mesh.geometry, pos = geometry.attributes.position, index = geometry.index, edges = new Map();
  const key = i => [pos.getX(i), pos.getY(i), pos.getZ(i)].map(x => x.toFixed(5)).join(',');
  for (let i = 0; i < (index ? index.count : pos.count); i += 3) {
    const ids = [0, 1, 2].map(j => index ? index.getX(i + j) : i + j);
    for (let j = 0; j < 3; j++) {
      const a = key(ids[j]), b = key(ids[(j + 1) % 3]); assert.notEqual(a, b, `Degenerate edge ${mesh.name}`);
      const k = [a, b].sort().join('|'); edges.set(k, (edges.get(k) ?? 0) + 1);
    }
  }
  for (const n of edges.values()) assert.equal(n, 2, `Unclosed tube ${mesh.name}`);
  for (const n of pos.array) assert.ok(Number.isFinite(n));
  assert.ok(geometry.userData.solidVolumeCubicMetres > 0);
}
const liveMeshes = group => group.children.filter(m => m.userData.effectiveEnabled);
function localPoint(stair, s, t, h) {
  const [o, u, v] = [stair.basis.originEastNorth, stair.basis.runEastNorth, stair.basis.lateralEastNorth];
  return new THREE.Vector3(o[0] + s * u[0] + t * v[0], h, -(o[1] + s * u[1] + t * v[1]));
}
function clearSegment(meshes, a, b) {
  const d = b.clone().sub(a), n = d.length();
  const hits = new THREE.Raycaster(a, d.normalize(), 0, n).intersectObjects(meshes, false);
  assert.equal(hits.length, 0, `Unexpected cross-bar ${hits[0]?.object?.name}`);
}

test('guards are original closed solids with separate handrail/guard roles and explicit uncertified claims', () => {
  const {derived: d, guards} = setup();
  assert.equal(d.effectiveEnabled, true); assert.equal(d.effectiveVisible, true);
  assert.equal(d.config.height, 1); assert.equal(d.config.postRadius, 0.025);
  assert.ok(d.railRuns.some(r => r.kind === 'flight-edge'));
  assert.ok(d.railRuns.some(r => r.kind === 'landing-edge'));
  assert.ok(d.railRuns.some(r => r.kind === 'floor-opening-edge'));
  assert.ok(d.beams.some(r => r.role === 'graspable-handrail-proposal'));
  for (const flag of ['structuralSupportVerified', 'buildingComplianceVerified', 'guardBalusterGapCertified',
    'climbabilityCertified', 'impactResistanceCertified', 'handrailGraspabilityCertified', 'evacuationPermitted', 'circulationComplete']) assert.equal(d[flag], false);
  for (const mesh of guards.children) assertClosed(mesh);
  assert.equal(d.summary.postCount, d.posts.length);
  assert.equal(d.summary.supportContactCount, d.supportInterfaces.length);
  assert.equal(new Set(d.posts.map(p => p.start.map(n => n.toFixed(6)).join(','))).size, d.posts.length);
  assert.doesNotThrow(() => guards.toJSON()); assert.doesNotThrow(() => JSON.stringify(inspectGuards(d, guards)));
});

test('every full post base contacts its real tread, platform or retained host slab and no guard penetrates walking solids', () => {
  const {derived, guards, stairs, floors} = setup();
  const audit = auditGuardGeometry(THREE, derived, guards, [stairs, floors]);
  assert.equal(audit.valid, true); assert.equal(audit.actualMeshesChecked, true);
  assert.equal(audit.supportContactCount, derived.posts.length);
  assert.ok(audit.supportSampleCount >= derived.posts.length * 12);
  assert.deepEqual(audit.unsupported, []); assert.deepEqual(audit.collisions, []);
  assert.ok(audit.triangleTests > 0);
  assert.equal(audit.intendedNamedHostOnly, true);
  assert.equal(audit.rayStartAboveBaseM, 0.0005); assert.equal(audit.rayMaximumDistanceM, 0.001);
  assert.ok(audit.minimumRetainedMarginM > 0.00999);
  assert.ok(audit.minimumHostTopNormalDot > 0.999999);
  for (const c of audit.supportContacts) {
    assert.ok(c.surfaceBoundaryEdgeCount >= 4); assert.ok(c.fullCapRadiusM >= derived.config.postRadius);
    assert.ok(c.retainedMarginM > 0.00999); assert.ok(c.geometryBaseErrorM < 1e-5);
    if (c.supportKind !== 'retained-slab-top') assert.equal(c.surfaceBoundaryEdgeCount, 4);
    assert.ok(c.actualHostHitElevationRangeM.every(h => Math.abs(h - c.expectedBaseLocalEastUpSouth[1]) < 1e-5));
  }
  for (const contact of audit.supportContacts) assert.ok(contact.maximumContactErrorM < 1e-5);
});

test('guard offsets report actual free flight passage rather than the nominal stair width', () => {
  const {derived} = setup();
  assert.equal(derived.clearWidths.length, 4);
  for (const w of derived.clearWidths) {near(w.nominalWidthM, 1.2); near(w.actualClearWidthM, 1.08); near(w.postCenterInsetM, 0.035);}
  const changed = setup({postRadius: 0.04}).derived;
  for (const w of changed.clearWidths) near(w.actualClearWidthM, 1.02);
});

test('actual stair mouth centerlines, shared transfer and door aperture have no cross-bars', () => {
  const {circulation: c, guards} = setup(), meshes = liveMeshes(guards);
  for (const p of c.pairs) {
    for (const f of p.flights) {
      const t = (f.lateral[0] + f.lateral[1]) / 2;
      const s = p.config.landingDepth;
      const height = f.direction === 1 ? f.startFFL : f.endFFL;
      for (const rise of [0.3, 0.85, 0.975]) clearSegment(meshes,
        localPoint(p, s - 0.3, t, height + rise), localPoint(p, s + 0.3, t, height + rise));
    }
    const back = p.config.landingDepth + p.dimensions.runLength + p.config.landingDepth / 2;
    for (const rise of [0.3, 0.85, 0.975]) clearSegment(meshes,
      localPoint(p, back, -0.7, p.midFFLM + rise), localPoint(p, back, 0.7, p.midFFLM + rise));
  }
  const p = c.pairs[0];
  for (const rise of [0.3, 0.85, 0.975]) {
    clearSegment(meshes, localPoint(p, 0.6, -0.7, p.upperFFLM + rise), localPoint(p, 0.6, 0.7, p.upperFFLM + rise));
    clearSegment(meshes, localPoint(p, -0.1, -0.45, p.upperFFLM + rise), localPoint(p, -0.1, 0.45, p.upperFFLM + rise));
  }
});

test('tread/elevation and radius edits regenerate real contacts and solids without mutating the source', () => {
  const normal = setup(), changed = setup({height: 1.15}, {floorToFloor: 3.6});
  assert.notEqual(changed.derived.posts.length, normal.derived.posts.length);
  assert.ok(changed.derived.posts.some(p => p.support.elevationM > 10));
  const before = JSON.stringify(changed.circulation);
  assert.deepEqual(deriveGuardProposal(changed.circulation, {height: 1.15}), changed.derived);
  assert.equal(before, JSON.stringify(changed.circulation));
  const audit = auditGuardGeometry(THREE, changed.derived, changed.guards, [changed.stairs, changed.floors]);
  assert.equal(audit.valid, true);
});

test('disabled shared host suppresses adjacent guards, hiding affects only display, and parent placement is inherited once', () => {
  const disabled = setup({}, {floorStates: {'slab-002': {enabled: false}}});
  assert.equal(disabled.derived.effectiveEnabled, false); assert.equal(disabled.guards.visible, false);
  assert.ok(disabled.derived.solids.every(s => !s.effectiveEnabled));
  const hidden = setup({visible: false});
  assert.equal(hidden.derived.effectiveEnabled, true); assert.equal(hidden.derived.effectiveVisible, false);
  assert.ok(hidden.derived.solids.every(s => s.effectiveEnabled && !s.effectiveVisible));
  const active = setup(), before = inspectGuards(active.derived, active.guards);
  const parent = new THREE.Group(); parent.position.set(12, 4, -9); parent.add(active.guards);
  const after = inspectGuards(active.derived, active.guards);
  assert.deepEqual(active.guards.position.toArray(), [0, 0, 0]);
  for (let i = 0; i < after.scene.solids.length; i++) [12, 4, -9].forEach((v, j) => near(after.scene.solids[i].matrixWorld[12 + j] - before.scene.solids[i].matrixWorld[12 + j], v));
});

test('actual-mesh audit rejects unintended walking-solid overlap and unsupported bases, not intended assembly joints', () => {
  const {derived, guards, stairs, floors} = setup();
  const obstacle = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), new THREE.MeshBasicMaterial());
  obstacle.name = 'deliberate-walking-solid-obstacle'; obstacle.position.fromArray(derived.posts[0].start); obstacle.position.y += 0.5;
  const audit = auditGuardGeometry(THREE, derived, guards, [stairs, floors, obstacle], {reject: false});
  assert.ok(audit.collisions.some(c => c.walkingSolidId === obstacle.name));
  assert.throws(() => auditGuardGeometry(THREE, derived, guards, [stairs, floors, obstacle]), /unintended walking-solid overlaps/);
  assert.throws(() => auditGuardGeometry(THREE, derived, guards, [stairs]), /unsupported bases/);
});

test('bounded guard parameters and required physical circulation fail explicitly', () => {
  const {circulation} = setup();
  for (const c of [{height: 0.1}, {height: 0.8}, {postRadius: 0}, {edgeClearance: -1}, {maximumPostSpacing: Infinity}, {enabled: 1}, {noSuchKey: 2}]) assert.throws(() => deriveGuardProposal(circulation, c));
  assert.throws(() => deriveGuardProposal({pairs: []}));
  const bad = structuredClone(circulation); bad.pairs[1].upperFloorId = 'floor-020';
  assert.throws(() => deriveGuardProposal(bad), /bounded/);
});


test('disabling the upper pair closes the unused left opening edge but leaves the real lower-pair arrival open', () => {
  const {derived, circulation, guards, stairs, floors} = setup({}, {}, {pairStates: {'stair-002-003': {enabled: false}}});
  const residual = derived.railRuns.find(r => r.railRunId === 'floor-002:opening-guard:residual-front');
  assert.match(residual.hazardBoundary, /unused left/);
  assert.ok(derived.railRuns.filter(r => r.stairId === 'stair-002-003').every(r => !r.effectiveEnabled));
  const p = circulation.pairs[0], ray = new THREE.Raycaster(localPoint(p, 0.9, -0.7, p.upperFFLM + 0.975),
    localPoint(p, 1.5, -0.7, p.upperFFLM + 0.975).sub(localPoint(p, 0.9, -0.7, p.upperFFLM + 0.975)).normalize(), 0, 0.6);
  assert.ok(ray.intersectObjects(liveMeshes(guards), false).length);
  clearSegment(liveMeshes(guards), localPoint(p, 0.9, 0.7, p.upperFFLM + 0.975), localPoint(p, 1.5, 0.7, p.upperFFLM + 0.975));
  assert.equal(auditGuardGeometry(THREE, derived, guards, [stairs, floors]).valid, true);
});


test('short named-host proof rejects a physically lifted post even if its symbolic planned support is unchanged', () => {
  const {derived, guards, stairs, floors} = setup();
  const post = guards.getObjectByName('guard-post-53'); post.position.y += 0.002;
  const audit = auditGuardGeometry(THREE, derived, guards, [stairs, floors], {reject: false});
  const contact = audit.supportContacts.find(c => c.supportId === post.name);
  assert.equal(contact.supported, false); assert.ok(contact.geometryBaseErrorM > 0.0019);
  assert.equal(contact.maximumContactErrorM, null);
});

test('support proof requires an upward actual host face and full-cap retained margin, not any ray hit', () => {
  const {derived, circulation, guards, stairs, floors} = setup();
  floors.remove(floors.getObjectByName('slab-001'));
  const downwardFace = new THREE.Mesh(new THREE.PlaneGeometry(50, 50).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({side: THREE.DoubleSide}));
  downwardFace.name = 'slab-001'; downwardFace.position.y = circulation.pairs[0].lowerFFLM;
  const faceAudit = auditGuardGeometry(THREE, derived, guards, [stairs, floors, downwardFace], {reject: false});
  const faceContacts = faceAudit.supportContacts.filter(c => c.hostGeometryId === 'slab-001');
  assert.ok(faceContacts.length);
  assert.ok(faceContacts.every(c => !c.supported && c.minimumHostTopNormalDot < -0.999999 && c.maximumContactErrorM < 1e-5));
  const clean = setup(), outer = clean.guards.getObjectByName('guard-post-53'), v = clean.circulation.pairs[1].basis.lateralEastNorth;
  outer.position.set(-v[0] * 0.02, 0, v[1] * 0.02);
  const edgeAudit = auditGuardGeometry(THREE, clean.derived, clean.guards, [clean.stairs, clean.floors], {reject: false});
  const edgeContact = edgeAudit.supportContacts.find(c => c.supportId === outer.name);
  assert.equal(edgeContact.supported, false); assert.ok(edgeContact.retainedMarginM < -0.0099);
});
