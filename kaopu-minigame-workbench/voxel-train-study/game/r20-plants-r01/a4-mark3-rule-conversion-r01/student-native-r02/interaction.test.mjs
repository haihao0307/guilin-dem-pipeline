/** CPU-only regression tests. No server, browser, network, WebGL, or teacher geometry. */
import assert from 'node:assert/strict';
import test from 'node:test';
import {buildA4Shell} from '../student-native-r01/src/a4-shell.mjs';
import {buildMark3Shell} from '../student-native-r01/src/coach-shell.mjs';
import {
  SHELL_LIMITS, DEFAULT_SHELL_PARAMETERS, validateShellParameters,
  createViewState, selectView, orbitView, setViewZoom,
  baselineMetresPerPixel, createRebuildQueue, createRenderQueue,
} from './interaction.mjs';

function assertFiniteGeometry(result) {
  assert(result.parts.length > 0);
  for (const part of result.parts) {
    assert(part.positions.length > 0, part.name + ' positions missing');
    assert(part.positions.every(Number.isFinite), part.name + ' nonfinite positions');
    assert(part.normals.every(Number.isFinite), part.name + ' nonfinite normals');
    assert(part.uvs.every(Number.isFinite), part.name + ' nonfinite UVs');
    assert(part.indices.every(index => index >= 0 && index < part.positions.length / 3), part.name + ' invalid indices');
  }
}

for (const topHeight of [3.85, 4.03, 4.20]) for (const sideTuck of [0.03, 0.11, 0.20]) {
  test(`native locomotive range: topHeight=${topHeight}, sideTuck=${sideTuck}`, () => {
    const shell = buildA4Shell({main: {topHeight, sideTuck}});
    assertFiniteGeometry(shell);
    assert.equal(shell.parameters.main.topHeight, topHeight);
    assert.equal(shell.parameters.main.sideTuck, sideTuck);
  });
}
for (const roofTop of [3.55, 3.81, 4.05]) {
  test(`native coach range: roofTop=${roofTop}`, () => {
    const shell = buildMark3Shell({roofTop});
    assertFiniteGeometry(shell);
    assert.equal(shell.parameters.roofTop, roofTop);
  });
}

test('only documented shell parameters can change; invalid and locked fields fail', () => {
  assert.deepEqual(validateShellParameters({}), DEFAULT_SHELL_PARAMETERS);
  assert.deepEqual(validateShellParameters({coachRoofTop: 3.9}), {...DEFAULT_SHELL_PARAMETERS, coachRoofTop: 3.9});
  for (const [key, range] of Object.entries(SHELL_LIMITS)) {
    assert.equal(validateShellParameters({[key]: range.min})[key], range.min);
    assert.equal(validateShellParameters({[key]: range.max})[key], range.max);
    for (const value of [range.min - 0.001, range.max + 0.001, NaN, Infinity, -Infinity, '3.9', null]) {
      assert.throws(() => validateShellParameters({[key]: value}), RangeError);
    }
  }
  for (const key of ['driveDiameter', 'axisZ', 'bogieCentres', 'bodyWidth', 'main', 'rear', 'constructor', '__proto__']) {
    assert.throws(() => validateShellParameters({[key]: 1}), RangeError);
  }
  for (const value of [null, [], 4, 'shell']) assert.throws(() => validateShellParameters(value), TypeError);
  assert.deepEqual(DEFAULT_SHELL_PARAMETERS, {locoTopHeight: 4.03, locoSideTuck: 0.11, coachRoofTop: 3.81});
});

test('orbit is explicitly gated; canonical views restore direction and zoom', () => {
  const state = createViewState(), initial = {...state};
  assert.equal(orbitView(state, 25, 15), false);
  assert.deepEqual(state, initial);
  state.free = true;
  assert.equal(orbitView(state, 25, 15), true);
  assert.notEqual(state.yaw, initial.yaw);
  setViewZoom(state, 3);
  selectView(state, 'side');
  assert.deepEqual(state, initial);
  for (const view of ['front', 'top', 'side']) {
    state.free = true; setViewZoom(state, 4); selectView(state, view);
    assert.equal(state.free, false); assert.equal(state.zoom, 1); assert.equal(state.view, view);
  }
  assert.equal(setViewZoom(state, 100), 6);
  assert.equal(setViewZoom(state, 0.001), 0.5);
  assert.throws(() => setViewZoom(state, NaN), TypeError);
  assert.throws(() => selectView(state, 'perspective'), RangeError);
});

test('framing depends only on immutable baseline envelopes, viewport and standard view', () => {
  const boxes = Object.freeze([
    Object.freeze({min: Object.freeze([-1, 0, -10]), max: Object.freeze([1, 4, 10])}),
    Object.freeze({min: Object.freeze([-1, 0, -11]), max: Object.freeze([1, 3.9, 11])}),
  ]);
  const rectangles = [{width: 1000, height: 300}, {width: 1000, height: 300}];
  const before = Object.fromEntries(['side', 'front', 'top'].map(view => [view, baselineMetresPerPixel(boxes, rectangles, view)]));
  assert.equal(before.side, 22 / 1000 * 1.16);
  assert.equal(before.front, 4 / 300 * 1.16);
  assert.equal(before.top, 22 / 300 * 1.16);
  // Editable geometry changes are deliberately never supplied as framing bounds.
  const edited = validateShellParameters({locoTopHeight: 4.2, locoSideTuck: 0.2, coachRoofTop: 4.05});
  buildA4Shell({main: {topHeight: edited.locoTopHeight, sideTuck: edited.locoSideTuck}});
  buildMark3Shell({roofTop: edited.coachRoofTop});
  for (const view of Object.keys(before)) assert.equal(baselineMetresPerPixel(boxes, rectangles, view), before[view]);
  const twiceAsLarge = rectangles.map(r => ({width: r.width * 2, height: r.height * 2}));
  assert.equal(baselineMetresPerPixel(boxes, twiceAsLarge, 'side'), before.side / 2);
  assert.deepEqual(boxes[1].max, [1, 3.9, 11]);
});

test('queued edits resolve to latest value and dispose superseded in-flight artifacts', async () => {
  const committed = [], disposed = [], busy = [];
  let signalStarted, releaseFirst;
  const started = new Promise(resolve => { signalStarted = resolve; });
  const gate = new Promise(resolve => { releaseFirst = resolve; });
  const queue = createRebuildQueue({
    delay: 1,
    async build(value) { if (value.v === 1) { signalStarted(); await gate; } return value; },
    commit(artifact, value, revision) { committed.push([value.v, revision]); return value; },
    dispose(artifact) { disposed.push(artifact.v); },
    onBusy(value) { busy.push(value); },
  });
  const first = queue.enqueue({v: 1});
  await started;
  const second = queue.enqueue({v: 2}), third = queue.enqueue({v: 3});
  releaseFirst();
  assert.deepEqual(await Promise.all([first, second, third]), [{v: 3}, {v: 3}, {v: 3}]);
  assert.deepEqual(committed, [[3, 3]]);
  assert.deepEqual(disposed, [1]);
  assert.deepEqual(queue.state, {revision: 3, committedRevision: 3, busy: false, running: false});
  assert.equal(busy.at(-1), false);
});

test('synchronous rapid edits coalesce into one build', async () => {
  const builds = [];
  const queue = createRebuildQueue({delay: 1, build: async value => { builds.push(value); return value; }, commit: artifact => artifact});
  const result = await Promise.all([queue.enqueue({roof: 3.7}), queue.enqueue({roof: 3.8}), queue.enqueue({roof: 3.9})]);
  assert.deepEqual(builds, [{roof: 3.9}]);
  assert.deepEqual(result, [{roof: 3.9}, {roof: 3.9}, {roof: 3.9}]);
});

test('failed build rejects its waiters and the queue accepts a later valid edit', async () => {
  const errors = [];
  const queue = createRebuildQueue({
    delay: 1,
    build: async value => { if (value.fail) throw new Error('controlled failure'); return value; },
    commit: artifact => artifact,
    onError: error => errors.push(error.message),
  });
  await assert.rejects(queue.enqueue({fail: true}), /controlled failure/);
  assert.equal(queue.state.busy, false);
  assert.deepEqual(await queue.enqueue({ok: true}), {ok: true});
  assert.deepEqual(errors, ['controlled failure']);
});

function renderHarness({withFence = true, failure = false} = {}) {
  let clock = 0, displayed = {pose: 'initial'}, nextFence = 0;
  const frames = [], timers = [], draws = [], fences = [], deleted = [], waits = [], errors = [];
  const gl = withFence ? {
    SYNC_GPU_COMMANDS_COMPLETE: 1, ALREADY_SIGNALED: 2, CONDITION_SATISFIED: 3, TIMEOUT_EXPIRED: 4, WAIT_FAILED: 5,
    fenceSync() { const fence = {id: ++nextFence, signaled: false}; fences.push(fence); return fence; },
    clientWaitSync(fence, flags, timeout) { waits.push({flags, timeout}); return failure ? 5 : fence.signaled ? 3 : 4; },
    deleteSync(fence) { deleted.push(fence.id); },
    flush() {},
  } : {flush() {}};
  const queue = createRenderQueue({
    gl,
    draw() { clock += 5; draws.push({...displayed}); return {...displayed}; },
    now: () => clock,
    requestFrame(callback) { frames.push(callback); return frames.length; },
    cancelFrame() {},
    defer(callback, delay) { timers.push({callback, delay}); return timers.length; },
    cancelDeferred() {},
    onError(error) { errors.push(error.message); },
  });
  return {queue, frames, timers, draws, fences, deleted, waits, errors,
    setState(value) { displayed = value; },
    runFrame() { assert(frames.length); frames.shift()(); },
    runTimer() { assert(timers.length); const timer = timers.shift(); clock += timer.delay; timer.callback(); },
  };
}

test('render backpressure keeps one GPU frame in flight and coalesces input to latest reset', () => {
  const h = renderHarness();
  h.queue.request(); h.runFrame();
  assert.equal(h.queue.stats.framesSubmitted, 1);
  assert.equal(h.queue.pending, true);
  for (let i = 0; i < 8; i++) { h.setState({pose: 'drag-' + i}); h.queue.request(); }
  h.runTimer();
  assert.equal(h.queue.stats.framesSubmitted, 1);
  assert.equal(h.frames.length, 0);
  assert.equal(h.queue.stats.inFlight, true);
  // Reset supersedes all intermediate drag poses; already submitted GPU work cannot be canceled.
  h.setState({pose: 'reset-side', zoom: 1}); h.queue.request();
  h.fences[0].signaled = true; h.runTimer();
  assert.equal(h.queue.pending, true);
  assert.equal(h.frames.length, 1);
  h.runFrame();
  assert.deepEqual(h.draws, [{pose: 'initial'}, {pose: 'reset-side', zoom: 1}]);
  assert.equal(h.queue.stats.framesSubmitted, 2);
  assert.equal(h.queue.stats.maxFramesInFlight, 1);
  h.fences[1].signaled = true; h.runTimer();
  assert.equal(h.queue.pending, false);
  assert.equal(h.queue.stats.requestedRevision, 10);
  assert.equal(h.queue.stats.completedRevision, 10);
  assert.equal(h.queue.stats.framesCompleted, 2);
  assert.equal(h.queue.stats.coalescedRequests, 9);
  assert.equal(h.queue.stats.lastGpuCompletionVerified, true);
  assert.equal(h.queue.stats.lastCpuSubmissionMs, 5);
  assert.equal(h.queue.stats.lastGpuCompletionElapsedMs, 21);
  assert.deepEqual(h.queue.stats.lastCompletedState, {pose: 'reset-side', zoom: 1});
  assert.deepEqual(h.deleted, [1, 2]);
  assert(h.waits.every(wait => wait.flags === 0 && wait.timeout === 0));
});

test('no-fence render fallback is bounded and never certifies GPU completion', () => {
  const h = renderHarness({withFence: false});
  h.queue.request(); h.runFrame();
  assert.equal(h.timers[0].delay, 250);
  for (let i = 0; i < 30; i++) h.queue.request();
  assert.equal(h.queue.stats.framesSubmitted, 1);
  assert.equal(h.frames.length, 0);
  h.runTimer();
  assert.equal(h.queue.stats.lastGpuCompletionVerified, false);
  assert.equal(h.queue.stats.lastGpuCompletionElapsedMs, null);
  assert.equal(h.queue.stats.mode, 'throttled-no-fence');
  h.runFrame(); h.runTimer();
  assert.equal(h.queue.stats.framesSubmitted, 2);
  assert.equal(h.queue.pending, false);
});

test('failed GPU fence halts submissions and records the failure', () => {
  const h = renderHarness({failure: true});
  h.queue.request(); h.runFrame(); h.runTimer();
  assert.equal(h.queue.pending, false);
  assert.match(h.queue.stats.failed, /GPU fence wait failed/);
  assert.equal(h.errors.length, 1);
  h.queue.request();
  assert.equal(h.frames.length, 0);
  assert.equal(h.queue.stats.framesSubmitted, 1);
});
