import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createRuntimeCommands, RUNTIME_COMMAND_TYPES} from '../RuntimeCommands.mjs';

// These tests execute the production command module with explicit CPU host
// fixtures. They do not prove browser rendering, GPU completion or geometry.
const tests = [];
async function test(name, run) {
  try { await run(); tests.push({name, pass: true}); }
  catch (error) { tests.push({name, pass: false, error: error.stack}); }
}
function fixture(options = {}) {
  const state = {epoch: 1, mode: 'observation', token: 'A:bottle:1', frame: 7, steps: 0, applied: []};
  const runtime = createRuntimeCommands({
    getEpoch: () => state.epoch, getMode: () => state.mode,
    getTaskToken: () => state.token, getFrameSerial: () => state.frame,
    apply(command) {
      state.applied.push(command);
      const before = state.steps;
      if (command.type === 'step') state.steps++;
      if (['reset', 'stop-verification'].includes(command.type)) { state.epoch++; state.mode = 'observation'; }
      if (command.type === 'start-verification') state.mode = 'verification';
      return {ok: true, code: 'applied', detail: {simulationStepsBefore: before, simulationStepsAfter: state.steps}};
    }, ...options
  });
  const command = (type = 'pick', values = {}) => ({type, payload: {}, expectedEpoch: state.epoch, ...values});
  const drain = (ready = true, frameSerial = state.frame) => runtime.drain({canMutate: ready, frameSerial});
  return {state, runtime, command, drain};
}

await test('readiness gates application and each drain executes at most one FIFO command', () => {
  const f = fixture();
  f.runtime.submit(f.command('step', {id: 's1'})); f.runtime.submit(f.command('step', {id: 's2'}));
  assert.equal(f.drain(false), null); assert.equal(f.state.steps, 0);
  assert.equal(f.runtime.drain({canMutate: 'true', frameSerial: 8}), null);
  const first = f.drain(true, 8);
  assert.equal(first.id, 's1'); assert.equal(f.state.steps, 1); assert.equal(f.runtime.status().pendingCount, 1);
  assert.equal(first.submittedFrameSerial, 7); assert.equal(first.completedFrameSerial, 8);
  assert.equal(first.presentedFrameSerial, null);
  assert.deepEqual(first.detail, {simulationStepsBefore: 0, simulationStepsAfter: 1});
  assert.equal(f.drain(false), null); assert.equal(f.state.steps, 1);
  assert.equal(f.drain(true, 9).id, 's2'); assert.equal(f.state.steps, 2);
  assert.equal(f.runtime.status().revision, 2);
});

await test('payloads detach at enqueue and the handler receives an immutable DTO', () => {
  const f = fixture(), payload = {actorId: 'A', nested: {angle: 35}};
  f.runtime.submit(f.command('window-open', {id: 'copy', payload}));
  payload.actorId = 'B'; payload.nested.angle = 90;
  const exported = f.runtime.snapshot(); exported.queue[0].command.payload.actorId = 'C';
  f.drain();
  assert.deepEqual(f.state.applied[0].payload, {actorId: 'A', nested: {angle: 35}});
  assert(Object.isFrozen(f.state.applied[0])); assert(Object.isFrozen(f.state.applied[0].payload.nested));
});

await test('identical ids are idempotent while queued and after application regardless of object key order', () => {
  const f = fixture();
  f.runtime.submit(f.command('pick', {id: 'once', payload: {actorId: 'A', reason: 'manual'}}));
  const duplicate = f.runtime.submit(f.command('pick', {id: 'once', payload: {reason: 'manual', actorId: 'A'}}));
  assert.equal(duplicate.duplicate, true); assert.equal(f.runtime.status().pendingCount, 1);
  f.drain();
  const repeated = f.runtime.submit(f.command('pick', {id: 'once', payload: {actorId: 'A', reason: 'manual'}}));
  assert.equal(repeated.status, 'applied'); assert.equal(repeated.duplicate, true);
  assert.equal(f.state.applied.length, 1); assert.equal(f.runtime.status().revision, 1);
});

await test('a changed or malformed request cannot replace the first retained id', () => {
  const f = fixture();
  f.runtime.submit(f.command('pick', {id: 'collision', payload: {actorId: 'A'}}));
  assert.equal(f.runtime.submit(f.command('pick', {id: 'collision', payload: {actorId: 'B'}})).code, 'id-conflict');
  assert.equal(f.runtime.submit(f.command('not-a-command', {id: 'collision'})).code, 'id-conflict');
  assert.equal(f.runtime.receipt('collision').status, 'queued');
  f.drain(); assert.equal(f.state.applied[0].payload.actorId, 'A');
  assert.equal(f.runtime.receipt('collision').status, 'applied');
});

await test('generated invalid-id diagnostics cannot overwrite a valid queued external id', () => {
  const f = fixture(), original = f.command('step', {id: 'invalid-command-1'});
  f.runtime.submit(original);
  const invalid = f.runtime.submit(f.command('step', {id: 42}));
  assert.equal(invalid.code, 'invalid-command'); assert.notEqual(invalid.id, original.id);
  assert.equal(f.runtime.receipt(invalid.id), null);
  assert.equal(f.runtime.receipt(original.id).status, 'queued');
  assert.equal(f.runtime.submit(original).duplicate, true);
  f.drain(); assert.equal(f.state.steps, 1); assert.equal(f.runtime.receipt(original.id).status, 'applied');
});

await test('epoch changes reject old task commands without advancing accepted revision', () => {
  const f = fixture();
  f.runtime.submit(f.command('pick', {id: 'old-pick'}));
  f.runtime.submit(f.command('cancel', {id: 'old-cancel'})); f.state.epoch = 3;
  const rejected = f.drain(); assert.equal(rejected.code, 'stale-epoch');
  assert.equal(rejected.submittedEpoch, 1); assert.equal(rejected.epochBefore, 3); assert.equal(rejected.epochAfter, 3);
  assert.equal(f.drain().code, 'stale-epoch');
  assert.equal(f.runtime.status().revision, 0); assert.equal(f.state.applied.length, 0);
});

await test('reset and stop-verification remain current-session controls across in-flight epoch changes', () => {
  for (const type of ['reset', 'stop-verification']) {
    const f = fixture(); f.state.mode = 'verification';
    f.runtime.submit(f.command(type, {id: type}));
    f.state.epoch = 14;
    const result = f.drain(true, 16);
    assert.equal(result.status, 'applied'); assert.equal(result.epochPolicy, 'current-session-control');
    assert.equal(result.submittedEpoch, 1); assert.equal(result.expectedEpoch, 1);
    assert.equal(result.epochBefore, 14); assert.equal(result.epochAfter, 15);
    assert.equal(result.completedFrameSerial, 16); assert.equal(result.presentedFrameSerial, null);
    assert.equal(f.state.mode, 'observation');
  }
});

await test('pause is not a session-wide reset and remains subject to epoch rejection', () => {
  const f = fixture(); f.state.mode = 'verification';
  f.runtime.submit(f.command('pause')); f.state.epoch++;
  assert.equal(f.drain().code, 'stale-epoch'); assert.equal(f.runtime.status().revision, 0);
});

await test('an expected task token prevents a stale cancellation from targeting a later task', () => {
  const f = fixture();
  f.runtime.submit(f.command('cancel', {expectedTaskToken: 'A:bottle:1'})); f.state.token = 'A:bottle:2';
  const result = f.drain(); assert.equal(result.code, 'stale-task'); assert.equal(f.state.applied.length, 0);
  f.runtime.submit(f.command('cancel', {expectedTaskToken: 'A:bottle:2'}));
  assert.equal(f.drain().status, 'applied'); assert.equal(f.runtime.status().revision, 1);
});

await test('explicit no-task expectations cannot silently target a newly appeared task', () => {
  const f = fixture(); f.state.token = undefined;
  assert.equal(f.runtime.submit(f.command('cancel', {expectedTaskToken: null})).status, 'queued');
  f.state.token = 'A:bottle:2'; assert.equal(f.drain().code, 'stale-task');
  assert.equal(f.state.applied.length, 0);
  f.state.token = undefined;
  f.runtime.submit(f.command('cancel', {expectedTaskToken: null}));
  assert.equal(f.drain().status, 'applied');
});

await test('verification mode accepts only reset, stop-verification and pause at submission', () => {
  for (const type of RUNTIME_COMMAND_TYPES) {
    const f = fixture(); f.state.mode = 'verification';
    const result = f.runtime.submit(f.command(type));
    const allowed = ['reset', 'stop-verification', 'pause'].includes(type);
    assert.equal(result.status, allowed ? 'queued' : 'rejected', type);
    assert.equal(result.code, allowed ? 'queued' : 'verification-running', type);
  }
});

await test('mode is rechecked at drain after a previously queued command starts verification', () => {
  const f = fixture();
  f.runtime.submit(f.command('start-verification')); f.runtime.submit(f.command('move-target'));
  assert.equal(f.drain().status, 'applied');
  assert.equal(f.drain().code, 'verification-running'); assert.equal(f.state.applied.length, 1);
  assert.equal(f.runtime.status().revision, 1);
});

await test('nested drains cannot re-enter application', () => {
  let runtime, count = 0;
  const f = fixture({apply() { count++; assert.equal(runtime.drain({canMutate: true, frameSerial: 10}), null); return {ok: true, code: 'ok'}; }});
  runtime = f.runtime;
  runtime.submit(f.command('step')); runtime.submit(f.command('step'));
  f.drain(); assert.equal(count, 1); assert.equal(runtime.status().pendingCount, 1);
  f.drain(); assert.equal(count, 2);
});

await test('queue capacity is 32 and overflow is an explicit retained rejection', () => {
  const f = fixture();
  for (let i = 0; i < 32; i++) assert.equal(f.runtime.submit(f.command('step', {id: 'q' + i})).status, 'queued');
  assert.equal(f.runtime.submit(f.command('step', {id: 'overflow'})).code, 'queue-full');
  assert.equal(f.runtime.status().pendingCount, 32); assert.equal(f.runtime.status().droppedCounts.queueFull, 1);
  assert.equal(f.runtime.receipt('overflow').code, 'queue-full');
  for (let i = 0; i < 32; i++) assert.equal(f.drain().id, 'q' + i);
  assert.equal(f.state.steps, 32); assert.equal(f.runtime.status().pendingCount, 0);
});

await test('history and deduplication memory are bounded with honest eviction counts', () => {
  const f = fixture();
  for (let i = 0; i < 140; i++) { f.runtime.submit(f.command('pause', {id: 'h' + i})); f.drain(); }
  const snapshot = f.runtime.snapshot();
  assert.equal(snapshot.history.length, 128); assert.equal(snapshot.historyCount, 128);
  assert.equal(snapshot.droppedCounts.historyEvicted, 12); assert.equal(snapshot.droppedCounts.idempotencyEvicted, 12);
  assert.equal(f.runtime.receipt('h0'), null); assert.equal(f.runtime.receipt('h139').status, 'applied');
  assert.match(snapshot.idempotencyScope, /outside the retry window/);
});

await test('status, receipt and history reads are detached from internal ownership', () => {
  const f = fixture(); f.runtime.submit(f.command('step', {id: 'dto'})); f.drain();
  const status = f.runtime.status(), receipt = f.runtime.receipt('dto'), snapshot = f.runtime.snapshot();
  status.revision = 99; status.counts.applied = 99; status.lastReceipt.status = 'failed';
  receipt.detail.simulationStepsAfter = 99; snapshot.history[0].code = 'forged'; snapshot.history.length = 0;
  assert.equal(f.runtime.status().revision, 1); assert.equal(f.runtime.status().counts.applied, 1);
  assert.equal(f.runtime.receipt('dto').status, 'applied'); assert.equal(f.runtime.receipt('dto').detail.simulationStepsAfter, 1);
  assert.equal(f.runtime.snapshot().history[0].code, 'applied');
});

await test('invalid envelopes, payloads and oversized requests never enter the handler', () => {
  const f = fixture(), cycle = {}; cycle.self = cycle;
  const invalid = [
    f.command('unknown'), {...f.command(), expectedEpoch: undefined}, {...f.command(), expectedEpoch: -1},
    f.command('pick', {id: ''}), f.command('pick', {expectedTaskToken: ''}),
    f.command('pick', {payload: {x: Infinity}}), f.command('pick', {payload: {x: () => {}}}),
    f.command('pick', {payload: {x: undefined}}), f.command('pick', {payload: new Date()}),
    f.command('pick', {payload: null}), f.command('pick', {payload: []}),
    f.command('pick', {payload: 'bad'}), f.command('pick', {payload: 3}),
    f.command('pick', {payload: cycle}), f.command('pick', {payload: {text: 'x'.repeat(16385)}})
  ];
  for (const command of invalid) assert.equal(f.runtime.submit(command).code, 'invalid-command');
  assert.equal(f.runtime.status().pendingCount, 0); assert.equal(f.drain(), null); assert.equal(f.state.applied.length, 0);
});

await test('handler rejection does not advance accepted-command revision', () => {
  const f = fixture({apply: () => ({ok: false, code: 'actor-busy', detail: {actorId: 'A'}})});
  f.runtime.submit(f.command('pick')); const result = f.drain();
  assert.equal(result.status, 'rejected'); assert.equal(result.code, 'actor-busy');
  assert.equal(result.revision, 0); assert.equal(f.runtime.status().revision, 0);
});

await test('handler exceptions are diagnosed, rethrown and terminate further command application', () => {
  const error = Error('physical invariant failed');
  const f = fixture({apply() { throw error; }});
  f.runtime.submit(f.command('pick', {id: 'broken'})); f.runtime.submit(f.command('step'));
  assert.throws(() => f.drain(), thrown => thrown === error);
  assert.equal(f.runtime.receipt('broken').status, 'failed'); assert.equal(f.runtime.receipt('broken').code, 'apply-exception');
  assert.equal(f.runtime.status().failure.message, error.message); assert.equal(f.runtime.status().draining, false);
  assert.equal(f.runtime.status().revision, 0); assert.equal(f.drain(), null);
  assert.equal(f.runtime.submit(f.command('pick')).code, 'runtime-failed');
});

await test('async handlers are rejected because late mutation would escape the completed-frame barrier', () => {
  const f = fixture({apply: () => Promise.resolve({ok: true, code: 'late'})});
  f.runtime.submit(f.command('step'));
  assert.throws(() => f.drain(), /synchronous/); assert.equal(f.runtime.status().revision, 0);
  assert.equal(f.runtime.status().lastReceipt.status, 'failed');
});

await test('mutable handler result objects do not leak into retained receipts', () => {
  const result = {ok: true, code: 'done', detail: {nested: {value: 3}}};
  const f = fixture({apply: () => result});
  f.runtime.submit(f.command('pause', {id: 'result-copy'})); f.drain(); result.detail.nested.value = 42;
  assert.equal(f.runtime.receipt('result-copy').detail.nested.value, 3);
});

await test('invalid runtime context and missing task-token access reject rather than silently apply', () => {
  const f = fixture({getMode: () => 'unowned'});
  assert.equal(f.runtime.submit(f.command('pick')).code, 'invalid-runtime-context');
  assert.match(f.runtime.status().contextError, /mode/);
  const g = fixture({getTaskToken() { throw Error('task lookup unavailable'); }});
  g.runtime.submit(g.command('cancel', {expectedTaskToken: 'A:bottle:1'}));
  assert.equal(g.drain().code, 'task-context-unavailable'); assert.equal(g.state.applied.length, 0);
});

await test('constructor bounds cannot be silently raised beyond the reviewed memory contract', () => {
  for (const options of [{queueLimit: 33}, {historyLimit: 129}, {payloadByteLimit: 16385}, {queueLimit: 0}])
    assert.throws(() => fixture(options), /bounded/);
});

const sourceHash = createHash('sha256').update(readFileSync(new URL('../RuntimeCommands.mjs', import.meta.url))).digest('hex');
const report = {schema: 'kaopu/runtime-command-contract-qa@1',
  scope: 'Production RuntimeCommands module with CPU host/readiness fixtures; no real GPU, browser, native geometry or public delivery claim',
  sourceSHA256: sourceHash, passed: tests.every(item => item.pass), counts: {passed: tests.filter(item => item.pass).length, total: tests.length}, tests};
console.log(JSON.stringify(report, null, 2));
if (!report.passed) process.exitCode = 1;
