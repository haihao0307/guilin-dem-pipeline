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
for (const name of ['layer-world.mjs', 'layer-contact.mjs', 'layer-initialization.mjs', 'garment-prep.mjs']) {
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
