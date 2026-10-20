import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import * as THREE from '../../hk-three-buildings-r01/viewer/vendor/three.module.js';
import {defaultFloorConfig, validateFloorConfig, buildFloors} from '../r04/floors.mjs';
import {defaultCirculationConfig, deriveCirculationProposal, buildCirculation, inspectCirculation} from '../r05/circulation.mjs';

const score = JSON.parse(await readFile(new URL('../../hk-three-buildings-r01/geometry/B359971994401063C0.score.json', import.meta.url), 'utf8'));
const near = (a, b, eps = 2e-5) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);
const centroid = loop => [0, 1].map(i => loop.reduce((n, p) => n + p[i], 0) / loop.length);
function setup(changes = {}, floorChanges = {}, input = score) {
  const floorConfig = {...defaultFloorConfig(), enabled: true, ...floorChanges};
  const config = {...defaultCirculationConfig(), enabled: true, ...changes};
  const derived = deriveCirculationProposal(input, floorConfig, config);
  const group = buildCirculation(THREE, derived), floors = buildFloors(THREE, input, derived.configWithOpenings);
  return {floorConfig, config, derived, group, floors, meshes: [...group.children.flatMap(g => g.children), ...floors.children]};
}
const down = (meshes, q, h) => new THREE.Raycaster(new THREE.Vector3(q[0], h + 0.0001, -q[1]), new THREE.Vector3(0, -1, 0)).intersectObjects(meshes, false)[0];
function assertClosed(mesh) {
  const p = mesh.geometry.getAttribute('position'), edges = new Map();
  const key = i => [p.getX(i), p.getY(i), p.getZ(i)].map(x => x.toFixed(5)).join(',');
  for (let i = 0; i < p.count; i += 3) for (let j = 0; j < 3; j++) {
    const a = key(i + j), b = key(i + (j + 1) % 3); assert.notEqual(a, b);
    const k = [a, b].sort().join('|'); edges.set(k, (edges.get(k) ?? 0) + 1);
  }
  for (const count of edges.values()) assert.equal(count, 2);
}
const rectangle = (x, y, w, d) => [[x, y], [x + w, y], [x + w, y + d], [x, y + d]];
function synthetic(loops, top = 30) {
  const s = structuredClone(score), ops = [{id: 'p000', kind: 'roofPlane', heightPlane: [0, 0, top], loops}];
  for (const ring of loops) for (let i = 0; i < ring.length; i++) ops.push({id: `p${String(ops.length).padStart(3, '0')}`,
    kind: 'wallStrip', edge: [ring[i], ring[(i + 1) % ring.length]], bottom: 0, top});
  s.reconstruction.operations = ops; return s;
}

test('bounded defaults are off; no physical cuts, inferred navigation or certified claims are added', () => {
  const d = deriveCirculationProposal(score, defaultFloorConfig());
  assert.equal(d.enabled, false); assert.equal(d.effectiveEnabled, false);
  assert.equal(d.validation.activationReady, true); assert.equal(d.pairs.length, 2);
  assert.deepEqual(d.openingRecords, []); assert.equal(d.floorState.additionalOpeningCount, 0);
  assert.equal(d.graph.connected, false);
  for (const k of ['realLocationVerified', 'structuralSupportVerified', 'buildingComplianceVerified', 'groundConnectionAdded',
    'elevatorAdded', 'circulationComplete', 'evacuationPermitted', 'navigationConnectionEnabled', 'propagatedBeyondFloor003']) assert.equal(d[k], false);
  const g = buildCirculation(THREE, d); assert.equal(g.visible, false);
  assert.doesNotThrow(() => JSON.stringify(inspectCirculation(d, g)));
});

test('exactly two adjacent stair groups derive both independent cuts without changing any other slab or source loop', () => {
  const {derived:d, floorConfig, floors} = setup(), base = validateFloorConfig(score, floorConfig);
  const original = buildFloors(THREE, score, floorConfig);
  assert.deepEqual(d.pairs.map(p => [p.lowerFloorId, p.upperFloorId]), [['floor-001', 'floor-002'], ['floor-002', 'floor-003']]);
  assert.equal(d.floorState.floorCount, 21); assert.equal(d.floorState.openings.length, 23);
  assert.deepEqual(d.openingRecords.map(o => o.hostSlabId), ['slab-002', 'slab-003']);
  assert.deepEqual(d.floorState.serviceCoreVoid, base.serviceCoreVoid);
  for (let i = 0; i < 21; i++) {
    assert.deepEqual(d.floorState.slabs[i].loops.slice(0, 2), base.slabs[i].loops);
    if ([1, 2].includes(i)) {assert.equal(d.floorState.slabs[i].loops.length, 3); continue;}
    assert.deepEqual(d.floorState.slabs[i], base.slabs[i]);
    assert.deepEqual(Array.from(floors.children[i].geometry.attributes.position.array), Array.from(original.children[i].geometry.attributes.position.array));
  }
  near(d.pairs[0].upperFFLM, d.pairs[1].lowerFFLM); near(d.pairs[1].upperFFLM, 9.80000191);
});

test('preexisting source holes, service reserve and unrelated exact-host openings all survive pair derivation', () => {
  const outer = rectangle(-20, -25, 40, 50), sourceHole = rectangle(-10, 5, 2, 2);
  const extra = {openingId: 'unrelated:keep', hostSlabId: 'slab-006', purpose: 'stair', polygon2D: rectangle(10, 10, 1, 1)};
  const {derived:d, floors} = setup({}, {additionalOpenings: [extra]}, synthetic([outer, sourceHole]));
  for (const slab of d.floorState.slabs) {
    assert.deepEqual(slab.loops[0], outer); assert.deepEqual(slab.loops[1], sourceHole);
    assert.deepEqual(slab.loops[2], [[-1,-1],[1,-1],[1,1],[-1,1]]);
  }
  assert.deepEqual(d.configWithOpenings.additionalOpenings[0], extra);
  assert.equal(new THREE.Raycaster(new THREE.Vector3(-9, 100, -6), new THREE.Vector3(0,-1,0)).intersectObjects(floors.children).length, 0);
  assert.equal(new THREE.Raycaster(new THREE.Vector3(0, 100, 0), new THREE.Vector3(0,-1,0)).intersectObjects(floors.children).length, 0);
});

test('shared floor002 landing is one retained slab region with an explicit right-arrival to left-departure edge', () => {
  const {derived:d, group, floors} = setup(), shared = d.sharedLandings[0];
  assert.equal(d.sharedLandings.length, 1); assert.equal(shared.hostSlabId, 'slab-002');
  assert.equal(shared.duplicatedMeshCount, 0); assert.equal(group.children.length, 2);
  assert.equal(group.children.flatMap(g => g.children).length, 6);
  const edges = d.graph.edges; assert.deepEqual(edges.map(e => e.kind), ['authored_stair_group', 'retained_slab_transfer', 'authored_stair_group']);
  assert.equal(edges[1].from, 'stair-001-002:arrival'); assert.equal(edges[1].to, 'stair-002-003:departure');
  assert.equal(d.graph.connected, true); assert.equal(d.graph.navigationConnectionEnabled, false);
  const [a, b] = edges[1].walkPath.map(n => n.positionLocalEastUpSouth), slab = floors.children[1];
  for (let i = 0; i <= 100; i++) {
    const t = i / 100, q = [a[0]*(1-t)+b[0]*t, -(a[2]*(1-t)+b[2]*t)];
    const hit = down([slab], q, shared.elevationM); assert.ok(hit); near(hit.point.y, shared.elevationM);
    assert.equal(hit.object.name, 'slab-002');
  }
  near(Math.hypot(a[0]-b[0],a[2]-b[2]), 1.4);
  assert.equal(group.userData.geometryAudit.sharedSupportRayCount, 33);
});

test('all six generated stair meshes are closed solids and every tread and landing has actual support at its FFL', () => {
  const {derived:d, group, meshes} = setup();
  for (const mesh of group.children.flatMap(g => g.children)) {
    assertClosed(mesh); assert.equal(mesh.geometry.userData.closedSolid, true); assert.ok(mesh.geometry.userData.solidVolumeCubicMetres > 0);
  }
  for (const plan of d.pairs) for (const patch of plan.walkingPatches) {
    const hit = down(meshes, centroid(patch.footprintLoop), patch.elevationM);
    assert.ok(hit, patch.id); near(hit.point.y, patch.elevationM);
    if (patch.id.includes(':landing:floor-')) assert.equal(hit.object.name, patch.id.endsWith('001') ? 'slab-001' : patch.id.endsWith('002') ? 'slab-002' : 'slab-003');
  }
});

test('the ordered geometric graph path has 40 real rises and every horizontal connection is mesh-supported', () => {
  const {derived:d, meshes} = setup(); let riseCount = 0, totalRise = 0;
  const path = d.graph.edges.flatMap(e => e.walkPath.map(n => n.positionLocalEastUpSouth));
  for (let i = 1; i < path.length; i++) {
    const [a,b] = [path[i-1],path[i]], dh = b[1]-a[1], length = Math.hypot(a[0]-b[0],a[2]-b[2]);
    if (dh > 1e-7) {near(length,0); near(dh,0.16); riseCount++; totalRise += dh;}
    else {near(dh,0); if (length > 1e-7) near(down(meshes,[(a[0]+b[0])/2,-(a[2]+b[2])/2],a[1]).point.y,a[1]);}
  }
  assert.equal(riseCount,40); near(totalRise,6.4);
});

test('rays pass both exact stair apertures but not retained floor landing; original central reserve remains empty', () => {
  const {derived:d, floors} = setup(), q = centroid(d.openingRecords[0].polygon2D);
  for (const index of [1,2]) assert.equal(down([floors.children[index]],q,20), undefined);
  near(down([floors.children[0]],q,20).point.y,d.pairs[0].lowerFFLM);
  const retained = centroid(d.sharedLandings[0].footprintLoop);
  near(down([floors.children[1]],retained,20).point.y,d.pairs[0].upperFFLM);
  assert.equal(down(floors.children,[0,0],100),undefined);
});

test('full-patch and real upward rays include both stacked stair solids and actual cut slab soffits', () => {
  const {derived:d, group, meshes} = setup(), audit = group.userData.geometryAudit;
  near(d.geometryAudit.minimumClearanceM,2.84); assert.equal(audit.actualMeshesChecked,true);
  assert.ok(audit.headroomRayCount >= 210); near(audit.minimumRayClearanceM,2.84008,0.0001);
  const blockerKinds = new Set();
  for (const p of d.pairs) for (const patch of p.walkingPatches) {
    const q = centroid(patch.footprintLoop), hit = new THREE.Raycaster(new THREE.Vector3(q[0],patch.elevationM+0.0001,-q[1]),new THREE.Vector3(0,1,0)).intersectObjects(meshes)[0];
    assert.ok(hit); assert.ok(hit.point.y-patch.elevationM >= p.config.minHeadroom-1e-5);
    blockerKinds.add(hit.object.name.startsWith('slab-')?'slab':'stair');
  }
  assert.deepEqual([...blockerKinds].sort(),['slab','stair']);
  assert.throws(()=>setup({stair:{minHeadroom:2.9}}),/Stacked stair geometric headroom/);
  assert.doesNotThrow(()=>setup({stair:{minHeadroom:2.83}}));
});

test('actual inter-stack solid bounds prove vertical separation and ignore zero-volume intended contact', () => {
  const {group} = setup(), audit = group.userData.geometryAudit;
  assert.equal(audit.interStackPairs.length,9); assert.deepEqual(audit.interStackCollisions,[]);
  for (const pair of audit.interStackPairs) {assert.equal(pair.volumeOverlap,false); assert.ok(pair.verticalSeparationM > 0);}
  for (const a of group.children[0].children) for (const b of group.children[1].children) {
    const boxA = new THREE.Box3().setFromObject(a), boxB = new THREE.Box3().setFromObject(b);
    assert.ok(boxA.max.y < boxB.min.y);
  }
});

test('visibility does not change membership or cuts; endpoint disable propagates only its dependent stair edges', () => {
  const active = setup(), hidden = setup({visible:false},{floorStates:{'slab-002':{visible:false}}});
  assert.deepEqual(hidden.derived.openingRecords,active.derived.openingRecords);
  assert.equal(hidden.derived.graph.connected,true); assert.equal(hidden.group.visible,false);
  for (const [id,expected] of [['slab-001',[false,true]],['slab-002',[false,false]],['slab-003',[true,false]]]) {
    const {derived:d} = setup({}, {floorStates:{[id]:{enabled:false}}});
    assert.deepEqual(d.pairs.map(p=>p.effectiveEnabled),expected); assert.equal(d.graph.connected,false);
    assert.equal(d.graph.edges[1].effectiveEnabled,false); assert.equal(d.floorState.additionalOpeningCount,2);
  }
  const off = setup({}, {enabled:false}); assert.equal(off.derived.effectiveEnabled,false); assert.equal(off.group.visible,false);
});

test('pair disable removes only its owned aperture and never leaves a live shared transfer edge', () => {
  for (const [id,host] of [['stair-001-002','slab-003'],['stair-002-003','slab-002']]) {
    const {derived:d,group} = setup({pairStates:{[id]:{enabled:false}}});
    assert.equal(d.openingRecords.length,1); assert.equal(d.openingRecords[0].hostSlabId,host);
    assert.equal(d.graph.connected,false); assert.equal(d.graph.edges[1].effectiveEnabled,false);
    assert.equal(group.children.find(g=>g.name===id).visible,false);
  }
});

test('all local geometry, paths and shared slab receive parent rotation/translation exactly once', () => {
  const {derived:d,group,floors} = setup(), parent = new THREE.Group(); parent.add(group,floors);
  const local = new THREE.Vector3().fromArray(d.sharedLandings[0].walkPath[0].positionLocalEastUpSouth);
  const before = inspectCirculation(d,group); parent.position.set(12,4,-9); parent.rotation.y=0.73; parent.updateMatrixWorld(true);
  const after = inspectCirculation(d,group);
  assert.deepEqual(group.position.toArray(),[0,0,0]); assert.deepEqual(floors.position.toArray(),[0,0,0]);
  for (const pair of after.scene.pairs) for (const solid of pair.solids) assert.deepEqual(solid.matrixWorld,Array.from(parent.matrixWorld.elements));
  assert.deepEqual(before.graph,after.graph);
  const world = local.clone().applyMatrix4(parent.matrixWorld), ray = new THREE.Raycaster(world.clone().add(new THREE.Vector3(0,0.01,0)),new THREE.Vector3(0,-1,0));
  near(ray.intersectObject(floors.children[1])[0].point.y,world.y);
  parent.visible=false; assert.equal(inspectCirculation(d,group).scene.effectiveVisible,false); assert.equal(d.graph.connected,true);
});

test('parameter recomputation updates both pairs, endpoint FFL and cuts atomically; reset is deterministic and pure', () => {
  const config = {...defaultCirculationConfig(),enabled:true}, floorConfig={...defaultFloorConfig(),enabled:true};
  const oldScore=JSON.stringify(score), oldFloor=JSON.stringify(floorConfig), oldConfig=JSON.stringify(config);
  const a=deriveCirculationProposal(score,floorConfig,config);
  const changed=setup({stair:{treadDepth:0.3,flightWidth:1.25,landingDepth:1.25}},{floorToFloor:3.6});
  assert.equal(changed.derived.pairs[0].dimensions.totalRisers,24); near(changed.derived.pairs[1].lowerFFLM,7.00000191);
  assert.deepEqual(changed.derived.pairs[0].floorLandings[1].footprintLoop,changed.derived.pairs[1].floorLandings[0].footprintLoop);
  const again=deriveCirculationProposal(score,a.configWithOpenings,config); assert.deepEqual(again,a);
  const reset=deriveCirculationProposal(score,a.configWithOpenings,defaultCirculationConfig());
  assert.equal(reset.openingRecords.length,0); assert.equal(reset.floorState.additionalOpeningCount,0);
  assert.equal(JSON.stringify(score),oldScore); assert.equal(JSON.stringify(floorConfig),oldFloor); assert.equal(JSON.stringify(config),oldConfig);
});

test('invalid joins, fits, geometry parameters and erased shared landing are rejected without clipping or silent inference', () => {
  for (const change of [{stair:{originEast:100}},{stair:{originEast:0,originNorth:0}},
    {stair:{runEast:0,runNorth:0}},{stair:{flightWidth:2}},{stair:{targetRiser:NaN}},
    {stair:{lowerFloorId:'floor-002'}},{pairStates:{'stair-003-004':{enabled:true}}},{enabled:1},
    {stair:{landingThickness:0.1}},{notAParameter:true}]) assert.throws(()=>setup(change));
  assert.throws(()=>setup({}, {slabThickness:0.1}),/final riser/);
  const {derived:d}=setup(), overlap={openingId:'unrelated:erase-shared',hostSlabId:'slab-002',purpose:'stair',polygon2D:d.sharedLandings[0].footprintLoop};
  assert.throws(()=>setup({}, {additionalOpenings:[overlap]}),/retained stair floor landing/);
});

test('disabled circulation preserves otherwise-valid floor-only edits but strict activation cannot bypass invalid stairs', () => {
  for (const floorChanges of [{floorToFloor:0.8,slabThickness:0.1},{slabThickness:0.1},{firstSlabOffset:100}]) {
    const floor={...defaultFloorConfig(),enabled:true,...floorChanges};
    const d=deriveCirculationProposal(score,floor,{enabled:false});
    assert.equal(d.validation.activationReady,false); assert.equal(d.pairs.length,0); assert.equal(d.floorState.additionalOpeningCount,0);
    assert.doesNotThrow(()=>buildCirculation(THREE,d));
    assert.throws(()=>deriveCirculationProposal(score,floor,{enabled:true}));
  }
});

test('both groups close final risers against real midlanding and cut-host faces without volumetric slab penetration', () => {
  const {derived:d, group, floors, meshes} = setup();
  for (const [index,p] of d.pairs.entries()) {
    const {originEastNorth:o,runEastNorth:u,lateralEastNorth:v}=p.basis;
    for (const f of p.flights) {
      const t=(f.lateral[0]+f.lateral[1])/2, s=f.sStart+f.direction*p.dimensions.runLength;
      const pt=[o[0]+u[0]*s+v[0]*t,o[1]+u[1]*s+v[1]*t];
      const direction=new THREE.Vector3(u[0]*f.direction,0,-u[1]*f.direction);
      const origin=new THREE.Vector3(pt[0],f.endFFL-p.dimensions.actualRiser/2,-pt[1]).addScaledVector(direction,-0.01);
      const hit=new THREE.Raycaster(origin,direction).intersectObjects(meshes)[0];
      assert.ok(hit); near(hit.distance,0.01);
      assert.equal(hit.object.name,f.direction===1?p.midLanding.landingId:p.upperSlabId);
    }
    for (const mesh of group.children[index].children) {
      const pos=mesh.geometry.attributes.position;
      for(let i=0;i<pos.count;i++) {
        assert.ok(pos.getY(i)>=p.lowerFFLM-2e-5);
        const de=pos.getX(i)-o[0],dn=-pos.getZ(i)-o[1],s=de*u[0]+dn*u[1],t=de*v[0]+dn*v[1];
        assert.ok(s>=p.config.landingDepth-2e-5 && s<=p.dimensions.totalLength+2e-5);
        assert.ok(Math.abs(t)<=p.dimensions.width/2+2e-5);
      }
    }
    // Retained endpoint slab region has only the floor-owned closed mesh.
    assert.equal(floors.children.filter(m=>m.name===p.upperSlabId).length,1);
  }
});
