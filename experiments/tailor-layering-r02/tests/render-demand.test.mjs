import test from 'node:test';
import assert from 'node:assert/strict';
import {createRenderDemand} from '../src/render-demand.mjs';

function row(id = 'inner', x = 0) {
  return {id, positions: new Float32Array([x, 0, 0, 1, 0, 0, 0, 1, 0]),
    normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
    indices: new Uint32Array([0, 1, 2]), particles: 3, triangles: 1};
}

test('identical cloned worker rows and metadata changes do not invalidate native yarn geometry', () => {
  const demand = createRenderDemand(), applied = [];
  const apply = (id, value) => applied.push({id, value});
  demand.stage([row()]);
  assert.deepEqual(demand.commit({apply}).uploadedIDs, ['inner']);
  const result = demand.stage([{...row(), thickness: .008}]);
  assert.deepEqual(result.unchangedIDs, ['inner']);
  assert.equal(demand.hasPending(), false);
  assert.deepEqual(demand.commit({apply}).uploadedIDs, []);
  assert.equal(applied.length, 1);
  assert.equal(demand.audit().unchangedRows, 1);
});

test('only the newest exact state is applied once at an actual presentation', () => {
  const demand = createRenderDemand(), applied = [];
  const apply = (id, value) => applied.push(value.positions[0]);
  demand.stage([row()]); demand.commit({apply});
  demand.stage([row('inner', .1)]);
  demand.stage([row('inner', .2)]);
  demand.stage([row('inner', .3)]);
  assert.equal(applied.length, 1);
  demand.commit({apply});
  assert.deepEqual(applied, [0, Math.fround(.3)]);
  assert.equal(demand.audit().coalescedRows, 2);
  assert.equal(demand.hasPending(), false);
});

test('hidden geometry stays independent and restores its newest snapshot before display', () => {
  const demand = createRenderDemand(), applied = [];
  const apply = (id, value) => applied.push([id, value.positions[0]]);
  demand.stage([row('inner'), row('outer')]);
  const first = demand.commit({required: id => id === 'outer', apply});
  assert.deepEqual(first.deferredIDs, ['inner']);
  demand.stage([row('inner', .4), row('outer')]);
  assert.equal(demand.hasPending(id => id === 'outer'), false);
  assert.equal(demand.hasPending(), true);
  demand.commit({apply});
  assert.deepEqual(applied, [['outer', 0], ['inner', Math.fround(.4)]]);
  assert.equal(demand.audit().solverStateModified, false);
});

test('a camera-hidden object still updates when the host requires its shadow', () => {
  const demand = createRenderDemand(), applied = [];
  const beauty = new Set(['outer']), shadow = new Set(['inner', 'outer']);
  demand.stage([row('inner'), row('outer')]);
  demand.commit({required: id => beauty.has(id) || shadow.has(id), apply: id => applied.push(id)});
  assert.deepEqual(applied, ['inner', 'outer']);
});

test('normal, topology, tiny displacement and float sign changes are detected exactly', () => {
  const demand = createRenderDemand();
  const apply = () => {};
  demand.stage([row()]); demand.commit({apply});
  const normal = row(); normal.normals[0] = 1e-30;
  demand.stage([normal]); assert.equal(demand.hasPending(), true); demand.commit({apply});
  const topology = {...normal, indices: new Uint32Array([0, 2, 1])};
  demand.stage([topology]); assert.equal(demand.hasPending(), true); demand.commit({apply});
  const tiny = {...topology, positions: topology.positions.slice()}; tiny.positions[0] = 1e-30;
  demand.stage([tiny]); assert.equal(demand.hasPending(), true); demand.commit({apply});
  const negativeZero = row(); negativeZero.positions[0] = -0;
  demand.stage([negativeZero]); demand.commit({apply});
  demand.stage([row()]); assert.equal(demand.hasPending(), true);
});

test('queued arrays are insulated from source mutation and reverted geometry needs no upload', () => {
  const demand = createRenderDemand(), source = row(), applied = [];
  const apply = (id, value) => applied.push(value.positions[0]);
  demand.stage([source]);
  source.positions[0] = 99;
  demand.commit({apply});
  assert.deepEqual(applied, [0]);
  demand.stage([row('inner', 1)]);
  demand.stage([row('inner', 0)]);
  assert.equal(demand.hasPending(), false);
  assert.deepEqual(demand.commit({apply}).uploadedIDs, []);
});

test('failed native deformation remains pending and explicit rebuild invalidation is honored', () => {
  const demand = createRenderDemand();
  demand.stage([row()]);
  assert.throws(() => demand.commit({apply() {throw new Error('native update failed');}}), /native update failed/);
  assert.equal(demand.hasPending(), true);
  demand.commit({apply() {}});
  assert.equal(demand.hasPending(), false);
  assert.equal(demand.invalidate('inner'), 1);
  assert.equal(demand.hasPending(), true);
  assert.deepEqual(demand.commit({apply() {}}).uploadedIDs, ['inner']);
});

test('unloading drops queued geometry and re-adding an id starts a new visual baseline', () => {
  const demand = createRenderDemand();
  demand.stage([row('inner'), row('outer')]);
  demand.commit({apply() {}});
  demand.stage([row('outer', 1)]);
  assert.equal(demand.remove('outer'), true);
  assert.deepEqual(demand.audit().pendingIDs, []);
  assert.equal(demand.audit().garmentCount, 1);
  demand.stage([row('outer')]);
  assert.deepEqual(demand.commit({apply() {}}).uploadedIDs, ['outer']);
});

test('invalid batches cannot partly replace retained garment snapshots', () => {
  const demand = createRenderDemand();
  demand.stage([row()]); demand.commit({apply() {}});
  assert.throws(() => demand.stage([row('inner', 1), row('inner', 2)]), /Duplicate/);
  assert.equal(demand.hasPending(), false);
  assert.throws(() => demand.stage([{...row(), normals: new Float32Array(2)}]), /inconsistent/);
  assert.equal(demand.hasPending(), false);
});
