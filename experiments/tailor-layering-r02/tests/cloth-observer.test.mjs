import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {installClothObserver, readClothObservation, retainClothSteps} from './cloth-observer.mjs';

async function harness(options) {
  class Worker {
    constructor() {this.calls = []; this.listeners = []; this.failure = null;}
    postMessage(...args) {
      this.calls.push({receiver: this, args});
      if (this.failure) throw this.failure;
      return 'original-result';
    }
    addEventListener(type, listener) {if (type === 'message') this.listeners.push(listener);}
    respond(data) {for (const listener of this.listeners) listener({data});}
  }
  const sandbox = vm.createContext({Worker, performance, structuredClone, Uint8Array, ArrayBuffer});
  const execute = (fn, value) => {
    sandbox.argument = value;
    return vm.runInContext('(' + fn.toString() + ')(argument)', sandbox);
  };
  await installClothObserver({addInitScript: execute}, options);
  return {Worker, sandbox, page: {evaluate: execute}};
}

const input = id => ({id, type: 'init',
  body: {positions: new Float32Array([0, 0, 0]), faces: new Uint32Array()}, rows: []});
const snapshot = (id, step) => ({id, rows: [{id: 'inner',
  positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
  normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
  indices: new Uint32Array([0, 1, 2])}],
  audit: {completedSteps: step, simulationSeconds: step / 120, maxEdgeStretch: 1, seamGapMM: 0}});

test('Worker observation preserves original receiver, arguments, result and pending replies', async () => {
  const {Worker, sandbox, page} = await harness();
  const worker = new Worker(), message = input(1), transfer = [];
  assert.equal(worker.postMessage(message, transfer), 'original-result');
  assert.equal(worker.calls[0].receiver, worker);
  assert.equal(worker.calls[0].args[0], message);
  assert.equal(worker.calls[0].args[1], transfer);
  assert.equal(sandbox.__KAOPU_CI_CLOTH_OBSERVER__.pending.size, 1);
  worker.respond(snapshot(1, 0));
  worker.postMessage({id: 2, type: 'step'});
  const waiting = await readClothObservation(page);
  assert.equal(waiting.responseCount, 1);
  assert.equal(waiting.pending.length, 1, 'Pause must not hide the final in-flight step');
  const next = snapshot(2, 1);
  worker.respond(next);
  const result = await readClothObservation(page, {geometry: true, initialInput: true, checkpoints: true});
  assert.equal(result.pending.length, 0);
  assert.equal(result.responseCount, 2);
  assert.equal(result.snapshot.audit.completedSteps, 1);
  assert.equal(result.checkpoints.length, 2);
  assert.equal(result.checkpointGeneration, 1);
  assert.equal(sandbox.__KAOPU_CI_CLOTH_OBSERVER__.latest, next, 'Per-step response geometry is retained by reference');
  assert.notEqual(sandbox.__KAOPU_CI_CLOTH_OBSERVER__.init, message, 'The one-time init input is an independent copy');
  assert.equal(result.snapshotCopies, 1, 'Receiving steps must not clone every geometry');
  assert.equal(worker.calls.length, 2, 'The observer must never send an extra worker request');
});

test('Selected geometry checkpoints are bounded and a reset begins a distinct generation', async () => {
  const {Worker, page} = await harness({checkpointSteps: [0, 1, 6], checkpointLimit: 2});
  const worker = new Worker();
  worker.postMessage(input(1)); worker.respond(snapshot(1, 0));
  for (const [id, step] of [[2, 1], [3, 2], [4, 6]]) {
    worker.postMessage({id, type: 'step'}); worker.respond(snapshot(id, step));
  }
  let result = await readClothObservation(page, {checkpoints: true});
  assert.equal(result.checkpointCount, 2);
  assert.equal(result.droppedCheckpoints, 1);
  assert.equal(result.retainedCheckpointBytes, 168);
  assert.deepEqual(Array.from(result.checkpoints, row => row.snapshot.audit.completedSteps), [1, 6]);
  worker.postMessage({id: 5, type: 'reset'}); worker.respond(snapshot(5, 0));
  result = await readClothObservation(page, {checkpoints: true});
  assert.equal(result.checkpointGeneration, 2);
  assert.deepEqual(Array.from(result.checkpoints, row => row.generation), [1, 2]);
  assert.equal(result.droppedCheckpoints, 2, 'Dropped geometry must be explicitly disclosed');
});

test('An original postMessage error is preserved and cannot leave a phantom pending request', async () => {
  const {Worker, page} = await harness();
  const worker = new Worker();
  worker.failure = new Error('Original postMessage rejected the payload');
  assert.throws(() => worker.postMessage(input(1)), error => error === worker.failure);
  const result = await readClothObservation(page);
  assert.equal(result.pending.length, 0);
  assert.equal(result.responseCount, 0);
  assert.equal(result.checkpointCount, 0);
  assert.equal(worker.calls.length, 1);
});

test('A later continuous interval can retain its actual intermediate steps without sending solver commands', async () => {
  const {Worker, page} = await harness({checkpointSteps: [0], checkpointLimit: 8});
  const worker = new Worker();
  worker.postMessage(input(1)); worker.respond(snapshot(1, 0));
  await retainClothSteps(page, [241, 246]);
  assert.equal(worker.calls.length, 1);
  worker.postMessage({id: 2, type: 'step'}); worker.respond(snapshot(2, 241));
  const result = await readClothObservation(page, {checkpoints: true});
  assert.deepEqual(Array.from(result.checkpoints, row => row.snapshot.audit.completedSteps), [0, 241]);
  assert.equal(result.pending.length, 0);
  assert.equal(worker.calls.length, 2);
});
