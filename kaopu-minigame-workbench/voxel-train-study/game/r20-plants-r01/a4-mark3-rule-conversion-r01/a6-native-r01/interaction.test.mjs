/** CPU-only checks. No local server, socket, browser, network or teacher geometry. */
import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {buildA6LocomotiveShell} from './src/a6-locomotive-shell.mjs';
import {buildA6CoachShell} from './src/a6-coach-shell.mjs';
import {buildA6TenderShell} from './src/a6-tender-shell.mjs';
import {buildLocomotiveMechanics} from '../student-native-r01/src/locomotive-mechanics.mjs';
import {buildMark3Mechanics} from '../student-native-r01/src/coach-mechanics.mjs';
import {buildDrivingWheel} from '../student-native-r01/src/driving-wheel.mjs';
import {
  SHELL_LIMITS, DEFAULT_SHELL_PARAMETERS, CONNECTED_LAYOUT, validateShellParameters,
  createViewState, selectView, selectFocus, orbitView, setViewZoom,
  baselineMetresPerPixel, createRebuildQueue, createRenderQueue,
} from './interaction.mjs';

function assertFiniteGeometry(result) {
  assert(result.parts.length > 0);
  let maxY = -Infinity;
  for (const part of result.parts) {
    assert(part.positions.length > 0, part.name + ' positions missing');
    assert(part.positions.every(Number.isFinite), part.name + ' nonfinite positions');
    assert(part.normals.every(Number.isFinite), part.name + ' nonfinite normals');
    assert(part.uvs.every(Number.isFinite), part.name + ' nonfinite UVs');
    assert(part.indices.every(index => index >= 0 && index < part.positions.length / 3), part.name + ' invalid indices');
    for (let i = 1; i < part.positions.length; i += 3) maxY = Math.max(maxY, part.positions[i]);
  }
  return maxY;
}
function digestParts(result) {
  const hash = createHash('sha256');
  for (const part of result.parts) {
    hash.update(part.name);
    for (const key of ['positions', 'normals', 'uvs', 'indices']) {
      const array = part[key]; hash.update(new Uint8Array(array.buffer, array.byteOffset, array.byteLength));
    }
  }
  return hash.digest('hex');
}

for (const commonRoofHeight of [3.98, 4.03, 4.15]) for (const cabForwardShift of [-0.15, 0, 0.15]) {
  test(`A6 linked shell range: roof=${commonRoofHeight}, cab forward=${cabForwardShift}`, () => {
    const locomotive = buildA6LocomotiveShell({topHeight: commonRoofHeight, cabShift: -cabForwardShift});
    const coach = buildA6CoachShell({crownHeight: commonRoofHeight});
    const tender = buildA6TenderShell({crownHeight: commonRoofHeight});
    for (const result of [locomotive, coach, tender]) assertFiniteGeometry(result);
    // Roof crown is distinct from exhaust outlets, seals and roof accessories.
    // Use named body skins; never weaken the check to include exhaust height.
    const roofParts = [
      locomotive.parts.find(part => part.name === 'a6-continuous-body-with-open-canopy-and-wheel-arches'),
      coach.parts.find(part => part.name === 'shell-roof'),
      tender.parts.find(part => part.name === 'tender-continuous-closed-skin'),
    ];
    assert(roofParts.length >= 3 && roofParts.every(Boolean), 'Named primary roof/body skins missing');
    for (const part of roofParts) {
      const actualTop = assertFiniteGeometry({parts: [part]});
      assert(Math.abs(actualTop - commonRoofHeight) < 0.001, `${part.name} crown ${actualTop} differs from common height ${commonRoofHeight}`);
    }
    assert(assertFiniteGeometry(locomotive) > commonRoofHeight + .4, 'Steam outlet overall height is reported separately from the body roof crown');
    assert.equal(locomotive.parameters.topHeight, commonRoofHeight);
    assert.equal(locomotive.parameters.cabShift, -cabForwardShift);
    assert.equal(coach.parameters.crownHeight, commonRoofHeight);
    assert.equal(tender.parameters.crownHeight, commonRoofHeight);
  });
}

test('all inherited native mechanical parts and arrays survive shell edits unchanged', () => {
  const loco = buildLocomotiveMechanics(), coach = buildMark3Mechanics(), wheel = buildDrivingWheel();
  assert.equal(loco.parts.length, 338); assert.equal(coach.parts.length, 238);
  assert.equal(wheel.nominalTreadDiameter, 2.032);
  const before = [loco, coach, wheel].map(digestParts);
  for (const commonRoofHeight of [3.98, 4.15]) for (const cabForwardShift of [-0.15, 0.15]) {
    buildA6LocomotiveShell({topHeight: commonRoofHeight, cabShift: -cabForwardShift});
    buildA6CoachShell({crownHeight: commonRoofHeight}); buildA6TenderShell({crownHeight: commonRoofHeight});
  }
  assert.deepEqual([loco, coach, wheel].map(digestParts), before);
});

test('coach connection is one documented rigid display translation, never array deformation', () => {
  assert(Math.abs(CONNECTED_LAYOUT.coachOffsetZ + CONNECTED_LAYOUT.coachFrontLocalZ - CONNECTED_LAYOUT.tenderRearZ - CONNECTED_LAYOUT.gap) < 1e-12);
  assert.equal(CONNECTED_LAYOUT.coachOffsetZ, 32.34);
  const view = readFileSync(new URL('./view.mjs', import.meta.url), 'utf8');
  assert.match(view, /buildGroup\(coach, 'editable-a6-coach-shell', coachTransform\)/);
  assert.match(view, /addMechanical\(connectedScene, coachMechanics, 'locked-coach-mechanics', coachTransform\)/);
  assert.equal((view.match(/new T\.OrthographicCamera\(\)/g) ?? []).length, 1);
  assert.match(view, /Capture ONCE/);
});

test('only documented linked shell parameters can change; locked fields are rejected', () => {
  assert.deepEqual(validateShellParameters({}), DEFAULT_SHELL_PARAMETERS);
  assert.deepEqual(validateShellParameters({commonRoofHeight: 4.1}), {...DEFAULT_SHELL_PARAMETERS, commonRoofHeight: 4.1});
  for (const [key, range] of Object.entries(SHELL_LIMITS)) {
    assert.equal(validateShellParameters({[key]: range.min})[key], range.min);
    assert.equal(validateShellParameters({[key]: range.max})[key], range.max);
    for (const value of [range.min - .001, range.max + .001, NaN, Infinity, -Infinity, '4', null]) assert.throws(() => validateShellParameters({[key]: value}), RangeError);
  }
  for (const key of ['driveDiameter', 'axisZ', 'coachOffsetZ', 'bogieCentres', 'bodyWidth', 'topHeight', 'roofTop', 'main', 'rear', 'constructor', '__proto__']) assert.throws(() => validateShellParameters({[key]: 1}), RangeError);
  for (const value of [null, [], 4, 'shell']) assert.throws(() => validateShellParameters(value), TypeError);
  assert.deepEqual(DEFAULT_SHELL_PARAMETERS, {commonRoofHeight: 4.03, cabForwardShift: 0});
});

test('free orbit is explicit; canonical views restore direction and zoom', () => {
  const state = createViewState(), initial = {...state};
  assert.equal(orbitView(state, 25, 15), false); assert.deepEqual(state, initial);
  state.free = true; assert.equal(orbitView(state, 25, 15), true); assert.notEqual(state.yaw, initial.yaw);
  setViewZoom(state, 3); selectView(state, 'side'); assert.deepEqual(state, initial);
  for (const view of ['front', 'top', 'side']) {
    state.free = true; setViewZoom(state, 4); selectView(state, view);
    assert.equal(state.free, false); assert.equal(state.zoom, 1); assert.equal(state.view, view);
  }
  assert.equal(setViewZoom(state, 100), 6); assert.equal(setViewZoom(state, .001), .5);
  assert.throws(() => setViewZoom(state, NaN), TypeError); assert.throws(() => selectView(state, 'perspective'), RangeError);
});

test('explicit focus preserves zoom, projection and state; never implies automatic fitting', () => {
  const state = createViewState(); setViewZoom(state, 2.75);
  const {focus, ...before} = state;
  for (const name of ['locomotive', 'coach', 'train']) {
    selectFocus(state, name); assert.equal(state.focus, name);
    const {focus, ...after} = state; assert.deepEqual(after, before);
  }
  assert.throws(() => selectFocus(state, 'unknown'), RangeError);
});

test('metric framing uses only immutable default train bounds, not edited shells or focus', () => {
  const boxes = Object.freeze([Object.freeze({min: Object.freeze([-1.4, 0, -2]), max: Object.freeze([1.4, 4.03, 43.83])})]);
  const rectangles = [{width: 1000, height: 500}];
  const before = Object.fromEntries(['side', 'front', 'top'].map(view => [view, baselineMetresPerPixel(boxes, rectangles, view)]));
  assert.equal(before.side, 45.83 / 1000 * 1.16); assert.equal(before.front, 4.03 / 500 * 1.16); assert.equal(before.top, 45.83 / 500 * 1.16);
  const state = createViewState(); selectFocus(state, 'coach');
  for (const view of Object.keys(before)) assert.equal(baselineMetresPerPixel(boxes, rectangles, view), before[view]);
  assert.equal(baselineMetresPerPixel(boxes, [{width: 2000, height: 1000}], 'side'), before.side / 2);
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
