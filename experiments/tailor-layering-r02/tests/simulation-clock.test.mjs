import test from 'node:test';
import assert from 'node:assert/strict';
import {runFixedStepLoop} from '../src/simulation-clock.mjs';

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => {resolve = yes; reject = no;});
  return {promise, resolve, reject};
};

test('default timer progresses without requesting a paint callback or awaiting a GPU task', async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'requestAnimationFrame');
  let animationRequests = 0, completed = 0, gpuFinished = false;
  const gpu = deferred();
  gpu.promise.then(() => {gpuFinished = true;});
  Object.defineProperty(globalThis, 'requestAnimationFrame', {configurable: true, value() {
    animationRequests++;
    throw new Error('No paint callbacks are available in this test.');
  }});
  try {
    const result = await runFixedStepLoop({
      step: async () => {await Promise.resolve(); completed++;},
      active: () => completed < 3,
      periodMS: 1,
    });
    assert.deepEqual(result, {steps: 3});
    assert.equal(animationRequests, 0);
    assert.equal(gpuFinished, false);
  } finally {
    gpu.resolve();
    if (descriptor) Object.defineProperty(globalThis, 'requestAnimationFrame', descriptor);
    else delete globalThis.requestAnimationFrame;
  }
});

test('fast asynchronous steps run serially and never start above the requested rate', async () => {
  let clock = 0, completed = 0, inFlight = 0, maxInFlight = 0;
  const starts = [], waits = [];
  const result = await runFixedStepLoop({
    step: async (...args) => {
      assert.deepEqual(args, [], 'The clock must not replace the caller-owned fixed simulation dt.');
      starts.push(clock);
      maxInFlight = Math.max(maxInFlight, ++inFlight);
      await Promise.resolve();
      clock += 3;
      inFlight--;
      completed++;
    },
    active: () => completed < 4,
    periodMS: 10,
    now: () => clock,
    wait: async ms => {waits.push(ms); clock += ms;},
  });
  assert.deepEqual(result, {steps: 4});
  assert.deepEqual(starts, [0, 10, 20, 30]);
  assert.deepEqual(waits, [7, 7, 7]);
  assert.equal(maxInFlight, 1);
  assert.equal(inFlight, 0);
});

test('early timer wakeups are rechecked before another fixed step starts', async () => {
  let clock = 0, completed = 0;
  const starts = [], waits = [];
  await runFixedStepLoop({
    step: async () => {starts.push(clock); clock += 3; completed++;},
    active: () => completed < 3,
    periodMS: 10,
    now: () => clock,
    wait: async ms => {waits.push(ms); clock += ms > 1 ? ms - .5 : ms;},
  });
  assert.deepEqual(starts, [0, 10, 20]);
  assert.deepEqual(waits, [7, .5, 7, .5]);
});

test('the default fractional 120 Hz deadline does not create a zero-delay rounding loop', async () => {
  let clock = 100, completed = 0;
  const starts = [], waits = [], period = 1000 / 120;
  await runFixedStepLoop({
    step: async () => {starts.push(clock); completed++;},
    active: () => completed < 4,
    now: () => clock,
    wait: async ms => {
      waits.push(ms);
      assert.ok(waits.length <= 3, 'Reaching a deadline must not require another timer because of subtraction rounding.');
      clock += ms;
    },
  });
  assert.equal(waits.length, 3);
  for (let i = 1; i < starts.length; i++) assert.equal(starts[i], starts[i - 1] + period);
});

test('slow steps and late timers yield without catch-up bursts or skipped worker steps', async () => {
  let clock = 0, completed = 0;
  const starts = [], waits = [];
  await runFixedStepLoop({
    step: async () => {starts.push(clock); clock += completed === 0 ? 35 : 2; completed++;},
    active: () => completed < 4,
    periodMS: 10,
    now: () => clock,
    wait: async ms => {
      waits.push(ms);
      // First step overruns; the next timer is then delayed by 100 ms.
      clock += ms + (waits.length === 2 ? 100 : 0);
    },
  });
  assert.equal(completed, 4);
  assert.deepEqual(starts, [0, 35, 145, 155]);
  assert.deepEqual(waits, [0, 8, 8]);
});

test('cancelling an outstanding worker waits for completion and launches no second worker', async () => {
  const worker = deferred();
  let enabled = true, started = 0, completed = 0, waits = 0, settled = false;
  const loop = runFixedStepLoop({
    step: async () => {started++; await worker.promise; completed++;},
    active: () => enabled,
    now: () => 0,
    wait: async () => {waits++;},
  });
  loop.then(() => {settled = true;});
  assert.equal(started, 1);
  enabled = false;
  await Promise.resolve();
  assert.equal(settled, false, 'The outstanding real step must remain owned until its worker result returns.');
  assert.equal(completed, 0);
  assert.equal(waits, 0);
  worker.resolve();
  assert.deepEqual(await loop, {steps: 1});
  assert.equal(started, 1);
  assert.equal(completed, 1);
  assert.equal(waits, 0);
});

test('cancelling during a timer prevents its wakeup from launching a new worker', async () => {
  const timer = deferred(), timerStarted = deferred();
  let enabled = true, clock = 0, started = 0;
  const loop = runFixedStepLoop({
    step: async () => {started++;},
    active: () => enabled,
    periodMS: 10,
    now: () => clock,
    wait: async ms => {timerStarted.resolve(ms); await timer.promise; clock += ms;},
  });
  assert.equal(await timerStarted.promise, 10);
  enabled = false;
  timer.resolve();
  assert.deepEqual(await loop, {steps: 1});
  assert.equal(started, 1);
});

test('an inactive loop dispatches nothing, and step failures propagate without retry', async () => {
  let calls = 0;
  assert.deepEqual(await runFixedStepLoop({step: () => {calls++;}, active: () => false}), {steps: 0});
  assert.equal(calls, 0);
  const failure = new Error('Real worker failed.');
  await assert.rejects(runFixedStepLoop({step: async () => {calls++; throw failure;}, active: () => true}), error => error === failure);
  assert.equal(calls, 1);
});

test('invalid scheduling inputs are rejected before dispatch', async () => {
  for (const periodMS of [0, -1, Infinity, NaN]) {
    await assert.rejects(runFixedStepLoop({step() {}, active: () => true, periodMS}), RangeError);
  }
  await assert.rejects(runFixedStepLoop({step() {}, active: () => true, now: () => NaN}), RangeError);
  await assert.rejects(runFixedStepLoop({step: null, active: () => true}), TypeError);
});
