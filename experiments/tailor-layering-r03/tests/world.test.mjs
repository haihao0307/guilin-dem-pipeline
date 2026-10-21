// Numerical integration probes on the retained, real garment paper and native
// body. These are not visual acceptance tests or a no-intersection certificate.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { auditMeshIntersections } from './mesh-intersections.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const upstream = path.join(root, 'reference/mp05-studio-r10');
const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'kaopu-layer-world-test-'));
after(() => fs.rm(temporary, { recursive: true, force: true }));
for (const name of ['layer-world.mjs', 'layer-contact.mjs', 'layer-initialization.mjs', 'body-envelope.mjs','local-broadphase.mjs', 'garment-prep.mjs']) {
  await fs.copyFile(path.join(root, 'src', name), path.join(temporary, name));
}
await fs.symlink(upstream, path.join(temporary, 'upstream'), 'dir');
const { LayerWorld } = await import(pathToFileURL(path.join(temporary, 'layer-world.mjs')));
const { prepareGarment } = await import(pathToFileURL(path.join(temporary, 'garment-prep.mjs')));
const readGzipJSON = async name => JSON.parse(gunzipSync(await fs.readFile(path.join(upstream, name))));
const native = await readGzipJSON('assets/native-person.json.gz');
const lock = JSON.parse(await fs.readFile(path.join(upstream, 'SOURCE_LOCK.json'), 'utf8'));
const body = { positions: new Float64Array(native.positions.length), faces: Uint32Array.from(native.faces) };
for (let i = 0; i < native.positions.length; i += 3) {
  body.positions[i] = native.positions[i];
  body.positions[i + 1] = native.positions[i + 2];
  body.positions[i + 2] = -native.positions[i + 1];
}
const rows = [];
for (const id of ['T08', 'T03']) {
  const packet = await readGzipJSON(`native/${id}.json.gz`);
  rows.push({
    id, packet, family: 'knit', thickness: .002,
    positions: Float64Array.from(packet.record.positionsMm.flatMap(([x, y, z]) => [x * .001, y * .001 - lock.person.groundShiftM, z * .001])),
  });
}
const bytes = await fs.readFile(path.join(upstream, 'cloth-kernel.wasm'));
let world;

test('whole-step candidate visits include separate measure calls and measured solve residuals', () => {
  const host={_work:{layer:{solveCalls:0,measureCalls:0,candidateVisits:0,vertexFaceTests:0,edgeEdgeTests:0}}};
  LayerWorld.prototype.recordContactWork.call(host,{candidateCount:0,residualCandidateCount:23,timings:{vertexFaceTests:7}},'measure');
  LayerWorld.prototype.recordContactWork.call(host,{candidateCount:31,residualCandidateCount:5,timings:{edgeEdgeTests:9}},'solve');
  assert.deepEqual(host._work.layer,{solveCalls:1,measureCalls:1,candidateVisits:59,vertexFaceTests:7,edgeEdgeTests:9});
});

test('settling accepts only simultaneous hard strain, contact and body limits, without chasing a stricter preference', () => {
  // Exercise the actual stopping controller with measured-state witnesses.
  // These scalar witnesses are a controller regression, not a cloth fixture.
  // The first three states each fail a different hard limit; combining their
  // individually good metrics would incorrectly accept a nonexistent state.
  const states = [
    {stretch:1.3985151538280451,penetration:.0004596615309791219,body:2e-6},
    {stretch:1.46,penetration:.00038245409254624666,body:0},
    {stretch:1.342757502559026,penetration:.0008683956260341378,body:0},
    {stretch:1.4097817022530017,penetration:.00038245409254624666,body:0},
  ];
  let stage=0;const measuredBodyAt=[];
  const host={recordContactWork:LayerWorld.prototype.recordContactWork,measureContacts:LayerWorld.prototype.measureContacts,rows:[{id:'controller-fixture',enabled:true,s:{count:0,p:new Float64Array(),w:new Float64Array(),edges:[],family:'knit'}}],options:{contactEnabled:true,friction:0},surfaces:()=>[],
    contacts:{measure:()=>({residualMaxPenetration:states[stage].penetration}),solve:()=>{stage++;return{};}},
    audit:({bodySamples=false}={})=>({maxEdgeStretch:states[stage].stretch,...(bodySamples?{bodyThicknessOverlapMM:0,bodyInsideVertices:0}:{})}),
    measureBodyEnvelope:()=>{measuredBodyAt.push(stage);return{maxHalfThicknessOverlapM:states[stage].body};},
    projectBody:()=>{},envelope:()=>{},
  };
  const result=LayerWorld.prototype.settle.call(host,{maxPasses:10});
  assert.equal(stage,3,'all three invalid coupled states require another pass');
  assert.equal(result.passes,3,'the first fully acceptable state ends work');
  assert.deepEqual(result.observations.slice(1).map(o=>o.active.length),[0,1,0],'only a violated hard strain limit requests active strain repair');
  assert.equal(result.converged,true);
  assert.equal(result.preferredTargetMet,false,'a missed preference is disclosed, not used to disturb accepted geometry');
  assert.deepEqual(measuredBodyAt,[0,3],'body geometry is freshly measured on the same candidate state');
  assert.equal(result.measurement.residualMaxPenetration,states[3].penetration);
  assert.equal(result.audit.maxEdgeStretch,states[3].stretch);
  assert.deepEqual(result.acceptanceLimits,{maxEdgeStretch:1.45,maxResidualPenetrationM:.0005,bodyHalfThicknessOverlapToleranceMM:.001});

  stage=0;states.forEach(s=>{s.stretch=1.39;s.penetration=.0003;s.body=2e-6;});
  measuredBodyAt.length=0;
  const rejected=LayerWorld.prototype.settle.call(host,{maxPasses:2});
  assert.equal(stage,2);
  assert.equal(rejected.converged,false,'an unresolved body-envelope violation remains a failure at the work cap');
  assert.equal(rejected.bodyEnvelope.maxHalfThicknessOverlapM,2e-6);
});

test('dynamic tail repairs only a garment exceeding the hard strain limit and stops after its failed edges pass', () => {
  const makeRow=(id,stretch)=>({id,enabled:true,s:{count:2,p:Float64Array.of(0,0,0,.01*stretch,0,0),
    w:Float64Array.of(1,2),edges:[{a:0,b:1,rest:.01}],family:'knit'}});
  const rows=[makeRow('pants',1.30),makeRow('inner',1.29),makeRow('outer',1.46)];
  // Repairing the first outer edge stretches its initially valid neighbour
  // above 1.45. The local counter must notice that new violation before stop.
  Object.assign(rows[2].s,{count:3,p:Float64Array.of(0,0,0,.0146,0,0,.029,0,0),
    w:Float64Array.of(1,2,1),edges:[{a:0,b:1,rest:.01},{a:1,b:2,rest:.01}]});
  const before=rows.map(a=>a.s.p.slice()),rests=rows.map(a=>a.s.edges.map(e=>e.rest)),projected=[];
  const ratio=a=>Math.max(...a.s.edges.map(e=>Math.hypot(...[0,1,2].map(d=>a.s.p[e.b*3+d]-a.s.p[e.a*3+d]))/e.rest));
  const host={recordContactWork:LayerWorld.prototype.recordContactWork,measureContacts:LayerWorld.prototype.measureContacts,rows,options:{contactEnabled:true,friction:0},surfaces:()=>[],
    contacts:{measure:()=>({residualMaxPenetration:0}),solve:()=>({})},
    audit:({bodySamples=false}={})=>({maxEdgeStretch:Math.max(...rows.map(ratio)),...(bodySamples?{bodyThicknessOverlapMM:0,bodyInsideVertices:0}:{})}),
    measureBodyEnvelope:()=>({maxHalfThicknessOverlapM:0}),projectBody:()=>{},envelope:()=>{},
    projectBodyVertex:a=>projected.push(a.id),
  };
  const result=LayerWorld.prototype.settle.call(host,{maxPasses:20});
  assert.equal(result.converged,true);
  assert.equal(result.passes,1);
  assert.deepEqual(result.observations[1].active.map(a=>[a.garment,a.corrections,a.hardViolatedEdges]),
    [['pants',0,0],['inner',0,0],['outer',2,0]]);
  assert.deepEqual(rows[0].s.p,before[0]);
  assert.deepEqual(rows[1].s.p,before[1]);
  assert.ok(ratio(rows[2])>1.18&&ratio(rows[2])<=1.45,'the extra repair stops at the unchanged hard limit without chasing a preferred rest bound');
  assert.deepEqual(projected,['outer','outer','outer','outer']);
  assert.deepEqual(rows.map(a=>a.s.edges.map(e=>e.rest)),rests,'original paper rest lengths are preserved');
  const massWeightedDisplacement=Array.from(rows[2].s.w,(w,i)=>(rows[2].s.p[i*3]-before[2][i*3])/w).reduce((sum,v)=>sum+v,0);
  assert.ok(Math.abs(massWeightedDisplacement)<1e-15,'original inverse-mass weighting is preserved');
});

test('actual native body and T08/T03 garments step with finite positions and welded seam agreement', async () => {
  const began = performance.now();
  world = await LayerWorld.create(body, rows, bytes);
  const creationMS = performance.now() - began;
  assert.deepEqual(world.rows.map(a => a.s.count), [4314, 2226]);
  assert.deepEqual(world.rows.map(a => a.s.faces.length / 3), [8466, 4220]);
  assert.equal(body.faces.length / 3, 50624);
  const observations = [];
  for (let i = 0; i < 2; i++) {
    const start = performance.now();
    assert.equal(world.step(1 / 120), world);
    const actualWallMS = performance.now() - start;
    const audit = world.audit({ bodySamples: true });
    for (const a of world.rows) {
      assert.ok([...a.s.p, ...a.s.v, ...a.s.output, ...a.s.normals].every(Number.isFinite));
      assert.notEqual(a.s.p.byteOffset, world.rows.find(b => b !== a).s.p.byteOffset);
    }
    assert.equal(audit.seamGapMM, 0);
    assert.equal(audit.bodySampledVertices, 6540);
    assert.equal(audit.contact.measuredAfterBodyProjection, true);
    assert.equal(audit.fullFreeClothMembrane, false);
    assert.ok(Number.isFinite(audit.bodyMinimumMM));
    assert.ok(Number.isFinite(audit.contact.residualMaxPenetration));
    observations.push({ actualWallMS, stageTimingsMS: audit.stageTimingsMS,
      contactCount: audit.contact.contactCount, residualMM: audit.contact.residualMaxPenetration * 1000,
      maxEdgeStretch: audit.maxEdgeStretch, bodyMinimumMM: audit.bodyMinimumMM,
      bodyInsideVertices: audit.bodyInsideVertices, seamGapMM: audit.seamGapMM });
  }
  console.log('WORLD_NUMERICAL_PROBE ' + JSON.stringify({
    input: 'retained original T08/T03 with one-time welded-layer initialization; no prepareGarment body transfer or paper edits',
    visualAccepted: false, creationMS, particles: 6540, garmentTriangles: 12686, bodyTriangles: 50624,
    observations,
  }));
});

test('thickness updates body clearance, invalid settings are atomic, and retired WASM blocks are reused', () => {
  world.setThickness('T03', .008);
  assert.equal(world.rows.find(a => a.id === 'T03').s.settings.clearanceMM, 4.5);
  const settings = { ...world.options };
  assert.throws(() => world.set({ friction: .5, substeps: 0 }), /子步数/);
  assert.deepEqual(world.options, settings);
  assert.throws(() => world.set({ iterations: Infinity }), /有限数/);
  assert.throws(() => world.step(0), /时间步/);
  const allocated = world.poolBytes;
  world.remove('T03');
  assert.equal(world.rows.length, 1);
  assert.equal(world.lastContact, null);
  world.add(rows[1]);
  assert.equal(world.rows.length, 2);
  assert.equal(world.poolBytes, allocated);
  assert.ok(world.reusedBytes > 0);
  assert.equal(world.time, 0, 'adding a layer records a new initial configuration');
  for (const a of world.rows) {
    assert.deepEqual(a.saved, a.s.p);
    assert.deepEqual(a.s.old, a.s.p);
    assert.ok(a.s.v.every(v => v === 0));
  }
});

test('failed native finish restores cloth state, simulation time and reported contact evidence', () => {
  world.reset();
  // Give the transaction actual per-surface history and pending contacts to
  // restore; clearing them would alter the next attempt's collision semantics.
  world.contacts.solve(world.surfaces(),{passes:1});
  const contactBefore=world.contacts.checkpoint();
  const before = world.rows.map(a => ({ p: a.s.p.slice(), v: a.s.v.slice(), old: a.s.old.slice() }));
  const nativeExports = world.e;
  world.e = { ...nativeExports, finish: () => 0 };
  try {
    assert.throws(() => world.step(1 / 120), /已恢复/);
  } finally {
    world.e = nativeExports;
  }
  world.rows.forEach((a, i) => {
    assert.deepEqual(a.s.p, before[i].p);
    assert.deepEqual(a.s.v, before[i].v);
    assert.deepEqual(a.s.old, before[i].old);
    assert.equal(a.s.time, 0);
    assert.equal(a.s.steps, 0);
  });
  assert.equal(world.time, 0);
  assert.equal(world.steps, 0);
  assert.equal(world.lastContact, null);
  assert.equal(world.totalCorrections, 0);
  const contactAfter=world.contacts.checkpoint();
  for(const key of ['history','sides','frameSides','edgeReferences','pending'])assert.deepEqual(contactAfter[key],contactBefore[key],key+' is restored with the failed step');
});

test('prepared original P02/T08/T03 advance continuously with bounded strain and independent intersection checks', async () => {
  // Asset transport only: execute the actual browser preparation module and
  // retain its hash validation, seam refinement, mid-surface and paper edits.
  // The fixture deliberately holds old=current; the new viewer's live native
  // body transfer and appearance require the separate browser acceptance run.
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, options) => {
    const url = new URL(String(input));
    if (url.protocol === 'file:') return new Response(await fs.readFile(fileURLToPath(url)));
    return originalFetch(input, options);
  };
  const host = {
    sourceLock: lock, groundShift: lock.person.groundShiftM, identity: lock.person.person,
    oldBodyPositions: Float32Array.from(body.positions), bodyPositions: Float32Array.from(body.positions),
    bodyFaces: body.faces, model: { bodyCount: native.bodyCount, lastBodyDriver: { rig: native.rig } },
  };
  const prepared = [], prepStart = performance.now();
  try {
    for (const [kind, presetId] of [['pants', 'P02'], ['inner', 'T08'], ['outer', 'T03']]) {
      const garment = await prepareGarment({ host, presetId, kind });
      prepared.push({ ...garment, role: kind === 'pants' ? 'bottom' : 'top' });
    }
  } finally { globalThis.fetch = originalFetch; }
  const preparationMS = performance.now() - prepStart;
  const preparedWorld = await LayerWorld.create({ positions: host.bodyPositions, faces: host.bodyFaces }, prepared, bytes);
  const initialization = preparedWorld.audit().initialization;
  assert.equal(initialization.applied, true);
  assert.ok(initialization.after.contactCount < initialization.before.contactCount);
  assert.ok(initialization.after.residualMaxPenetration < initialization.before.residualMaxPenetration);
  assert.equal(initialization.persistentLayerOffset, false);
  assert.equal(initialization.visualAccepted, false);
  assert.ok(initialization.after.maxEdgeStretch < initialization.orderedPlacementAfter.maxEdgeStretch,
    'reciprocal initialization relaxation repairs paper strain caused by ordered placement');
  assert.ok(initialization.after.residualMaxPenetration < initialization.orderedPlacementAfter.residualMaxPenetration);
  const preparedReset = preparedWorld.rows.map(a => a.s.p.slice());
  assert.deepEqual(preparedWorld.rows.map(a => a.id), ['pants', 'inner', 'outer']);
  assert.deepEqual(prepared.map(a => a.positions.length / 3), [3230, 4766, 2334]);
  assert.ok(preparedWorld.rows[0].s.w.some(w => w === 0), 'retained pants waist pins participate as fixed particles');
  for (const a of preparedWorld.rows) {
    assert.equal(a.s.settings.clearanceMM, Math.max(2, a.thickness * 500 + .5));
    assert.equal(a.source.packet.record.staticGate.passed, false, 'placement must not retain original static acceptance');
    assert.equal(a.source.placementReport.persistentOutwardConstraint, false);
  }
  const observations = [];
  const geometry=()=>auditMeshIntersections(preparedWorld.rows.map(a=>({id:a.id,positions:a.s.p,indices:a.s.faces})),{sampleLimit:8});
  const initializedGeometry=geometry();
  assert.equal(initializedGeometry.hasReportedIntersections,false);
  assert.equal(initializedGeometry.degenerateTriangles,0);
  for (let step = 0; step < 24; step++) {
    const before = preparedWorld.rows.map(a => a.s.p.slice());
    const start = performance.now();
    preparedWorld.step(1 / 120);
    const actualWallMS = performance.now() - start;
    const inspectGeometry=step===0||(step+1)%6===0;
    const snapshot = preparedWorld.snapshot({ bodySamples: inspectGeometry }), audit = snapshot.audit;
    assert.equal(audit.seamGapMM, 0);
    assert.ok(audit.maxEdgeStretch<1.4,'sustained cloth/body projection must not reproduce the R01 2.38x short-edge stretch');
    assert.ok(audit.contact.residualMaxPenetration<.0005,'measured remaining middle-surface thickness violation stays below 0.5 mm in this fixture');
    let intersectionAudit=null;
    if(inspectGeometry){
      assert.equal(audit.bodySampledVertices,preparedWorld.rows.reduce((n,a)=>n+a.s.count,0));
      assert.match(audit.bodyMetric,/no edge or whole-surface certificate/);
      assert.equal(audit.bodyInsideVertices,0);
      assert.equal(audit.bodyThicknessOverlappingVertices,0,'all sampled vertices keep at least their own half-thickness from the body');
      intersectionAudit=geometry();
      assert.equal(intersectionAudit.hasReportedIntersections,false,'independent edge/triangle and coplanar test reports no cross-garment intersections');
      assert.equal(intersectionAudit.degenerateTriangles,0);
    }
    assert.ok(Number.isFinite(audit.contact.residualMaxPenetration));
    assert.equal(audit.contact.measuredAfterBodyProjection, true);
    const movement = preparedWorld.rows.map((a, i) => {
      assert.ok([...a.s.p, ...a.s.v, ...a.s.output, ...a.s.normals].every(Number.isFinite));
      let maxDisplacementM = 0;
      for (let j = 0; j < a.s.count; j++) {
        const k = j * 3, displacement = Math.hypot(a.s.p[k] - before[i][k], a.s.p[k + 1] - before[i][k + 1], a.s.p[k + 2] - before[i][k + 2]);
        if (a.s.w[j] === 0) assert.equal(displacement, 0);
        maxDisplacementM = Math.max(maxDisplacementM, displacement);
      }
      assert.ok(maxDisplacementM > 0, a.id + ' has its own evolving physical coordinates');
      assert.equal(snapshot.rows[i].positions.length, a.source.positions.length);
      return { id: a.id, maxDisplacementMM: maxDisplacementM * 1000 };
    });
    observations.push({ step:step+1,actualWallMS, stageTimingsMS: audit.stageTimingsMS, contactCount: audit.contact.contactCount,
      residualMM: audit.contact.residualMaxPenetration * 1000, maxEdgeStretch: audit.maxEdgeStretch,
      bodyMinimumMM: audit.bodyMinimumMM, bodyInsideVertices: audit.bodyInsideVertices, seamGapMM: audit.seamGapMM, movement,intersectionAudit });
  }
  assert.ok(Math.abs(preparedWorld.time-.2)<1e-12,'24 accepted steps advance 0.2 simulated seconds, without resets or frozen garments');
  console.log('PREPARED_LAYERING_NUMERICAL_PROBE ' + JSON.stringify({
    input: 'actual prepareGarment P02/T08/T03; real frozen native body with old=current', visualAccepted: false,
    preparationMS, initialization,initializedGeometry,simulatedSeconds:preparedWorld.time,garmentTriangles: preparedWorld.rows.reduce((n, a) => n + a.s.faces.length / 3, 0),
    garments: preparedWorld.rows.map(a => ({ id: a.id, particles: a.s.count, thicknessMM: a.thickness * 1000,
      bodyClearanceMM: a.s.settings.clearanceMM, fixedParticles: a.s.w.filter(w => w === 0).length })), observations,
  }));
  preparedWorld.reset();
  preparedWorld.rows.forEach((a, i) => {
    assert.deepEqual(a.s.p, preparedReset[i], 'reset returns the initialized physical surfaces');
    assert.deepEqual(a.s.old, a.s.p);
  });
});
