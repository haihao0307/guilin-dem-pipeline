import assert from 'node:assert/strict';

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

class EpochAwareLatestFrameScheduler {
  constructor(draw, { epoch = 1, maxEpochMigrations = 1 } = {}) {
    this.draw = draw;
    this.epoch = epoch;
    this.maxEpochMigrations = maxEpochMigrations;
    this.requested = 0;
    this.completed = 0;
    this.pending = null;
    this.running = false;
    this.waiters = [];
    this.latestAccepted = null;
    this.retryRequired = [];
    this.events = [];
  }

  request(meta = {}) {
    const revision = ++this.requested;
    const request = {
      ...meta,
      revision,
      resourceEpoch: this.epoch,
      epochMigrations: meta.epochMigrations ?? 0,
    };
    this.pending = request;
    const waiter = deferred();
    this.waiters.push({ revision, ...waiter });
    this.events.push(['request', revision, this.epoch]);
    void this.run();
    return { revision, promise: waiter.promise };
  }

  async run() {
    if (this.running || !this.pending) return;
    const request = this.pending;
    this.pending = null;
    this.running = true;
    this.events.push(['draw-start', request.revision, request.resourceEpoch]);
    try {
      const value = await this.draw(request);
      if (request.resourceEpoch !== this.epoch) {
        this.events.push(['stale-epoch-completion', request.revision, request.resourceEpoch]);
        return;
      }
      this.completed = Math.max(this.completed, request.revision);
      this.latestAccepted = { revision: request.revision, resourceEpoch: request.resourceEpoch, value };
      const done = this.waiters.filter((w) => w.revision <= request.revision);
      this.waiters = this.waiters.filter((w) => w.revision > request.revision);
      for (const waiter of done) waiter.resolve(value);
      this.events.push(['draw-accepted', request.revision, request.resourceEpoch]);
    } catch (error) {
      await this.handleFailure(request, error);
    } finally {
      this.running = false;
      if (this.pending) queueMicrotask(() => void this.run());
    }
  }

  async handleFailure(request, error) {
    const failureScope = error.failureScope ?? 'draw-local';
    this.events.push(['failure', request.revision, request.resourceEpoch, failureScope, error.reason ?? null]);

    if (failureScope === 'draw-local') {
      const failed = this.waiters.filter((w) => w.revision <= request.revision);
      this.waiters = this.waiters.filter((w) => w.revision > request.revision);
      for (const waiter of failed) waiter.reject(error);
      return;
    }

    if (failureScope !== 'device-lost') throw error;

    const superseding = this.pending;
    this.pending = null;
    const affected = this.waiters.filter((w) => w.revision <= request.revision);
    this.waiters = this.waiters.filter((w) => w.revision > request.revision);
    for (const waiter of affected) waiter.reject(error);

    if (!superseding) return;
    if (error.reason === 'destroyed') {
      const terminal = this.waiters.filter((w) => w.revision <= superseding.revision);
      this.waiters = this.waiters.filter((w) => w.revision > superseding.revision);
      for (const waiter of terminal) waiter.reject(error);
      this.events.push(['terminal-no-reissue', superseding.revision, superseding.resourceEpoch]);
      return;
    }

    if (superseding.epochMigrations >= this.maxEpochMigrations) {
      const exhausted = Object.assign(new Error('epoch migration budget exhausted'), {
        code: 'RETRY_EXHAUSTED',
        revision: superseding.revision,
        resourceEpoch: superseding.resourceEpoch,
      });
      const terminal = this.waiters.filter((w) => w.revision <= superseding.revision);
      this.waiters = this.waiters.filter((w) => w.revision > superseding.revision);
      for (const waiter of terminal) waiter.reject(exhausted);
      this.events.push(['retry-exhausted', superseding.revision, superseding.resourceEpoch]);
      return;
    }

    this.retryRequired.push({
      revision: superseding.revision,
      resourceEpoch: superseding.resourceEpoch,
      status: 'RETRY_REQUIRED',
    });
    this.events.push(['retry-required', superseding.revision, superseding.resourceEpoch]);
    this.epoch += 1;
    this.pending = {
      ...superseding,
      resourceEpoch: this.epoch,
      epochMigrations: superseding.epochMigrations + 1,
    };
    this.events.push(['reissued', superseding.revision, this.epoch]);
  }
}

const settle = async () => {
  for (let i = 0; i < 8; i += 1) await new Promise((resolve) => setImmediate(resolve));
};

async function drawLocalPreservesLatest() {
  const draws = [];
  const scheduler = new EpochAwareLatestFrameScheduler((request) => {
    const gate = deferred();
    draws.push({ request, gate });
    return gate.promise;
  }, { epoch: 7 });
  const r1 = scheduler.request({ label: 'r1' });
  r1.promise.catch(() => {});
  await settle();
  const r2 = scheduler.request({ label: 'r2' });
  draws[0].gate.reject(Object.assign(new Error('old frame failed'), { failureScope: 'draw-local' }));
  await settle();
  assert.equal(draws.length, 2);
  draws[1].gate.resolve('frame-r2');
  await assert.rejects(r1.promise, /old frame failed/);
  assert.equal(await r2.promise, 'frame-r2');
  assert.deepEqual(scheduler.latestAccepted, { revision: 2, resourceEpoch: 7, value: 'frame-r2' });
  return { pass: true, events: scheduler.events };
}

async function unknownLossMigratesLatestOnce() {
  const draws = [];
  const scheduler = new EpochAwareLatestFrameScheduler((request) => {
    const gate = deferred();
    draws.push({ request, gate });
    return gate.promise;
  }, { epoch: 7, maxEpochMigrations: 1 });
  const r1 = scheduler.request({ label: 'r1' });
  r1.promise.catch(() => {});
  await settle();
  const r2 = scheduler.request({ label: 'r2' });
  draws[0].gate.reject(Object.assign(new Error('device lost'), {
    failureScope: 'device-lost',
    reason: 'unknown',
  }));
  await settle();
  assert.equal(draws.length, 2);
  assert.equal(draws[1].request.revision, 2);
  assert.equal(draws[1].request.resourceEpoch, 8);
  draws[1].gate.resolve('frame-r2-epoch8');
  await assert.rejects(r1.promise, /device lost/);
  assert.equal(await r2.promise, 'frame-r2-epoch8');
  assert.deepEqual(scheduler.retryRequired, [{ revision: 2, resourceEpoch: 7, status: 'RETRY_REQUIRED' }]);
  return { pass: true, events: scheduler.events };
}

async function destroyedIsTerminal() {
  const draws = [];
  const scheduler = new EpochAwareLatestFrameScheduler((request) => {
    const gate = deferred();
    draws.push({ request, gate });
    return gate.promise;
  }, { epoch: 7 });
  const r1 = scheduler.request({ label: 'r1' });
  r1.promise.catch(() => {});
  await settle();
  const r2 = scheduler.request({ label: 'r2' });
  r2.promise.catch(() => {});
  draws[0].gate.reject(Object.assign(new Error('device destroyed'), {
    failureScope: 'device-lost',
    reason: 'destroyed',
  }));
  await assert.rejects(r1.promise, /device destroyed/);
  await assert.rejects(r2.promise, /device destroyed/);
  await settle();
  assert.equal(draws.length, 1);
  return { pass: true, events: scheduler.events };
}

async function repeatedLossStopsAtBudget() {
  const draws = [];
  const scheduler = new EpochAwareLatestFrameScheduler((request) => {
    const gate = deferred();
    draws.push({ request, gate });
    return gate.promise;
  }, { epoch: 7, maxEpochMigrations: 1 });
  const r1 = scheduler.request({ label: 'r1' });
  r1.promise.catch(() => {});
  await settle();
  const r2 = scheduler.request({ label: 'r2' });
  r2.promise.catch(() => {});
  draws[0].gate.reject(Object.assign(new Error('loss-1'), { failureScope: 'device-lost', reason: 'unknown' }));
  await assert.rejects(r1.promise, /loss-1/);
  await settle();
  assert.equal(draws.length, 2);
  const r3 = scheduler.request({ label: 'r3', epochMigrations: 1 });
  r3.promise.catch(() => {});
  draws[1].gate.reject(Object.assign(new Error('loss-2'), { failureScope: 'device-lost', reason: 'unknown' }));
  await assert.rejects(r2.promise, /loss-2/);
  await assert.rejects(r3.promise, (error) => error.code === 'RETRY_EXHAUSTED');
  await settle();
  assert.equal(draws.length, 2);
  return { pass: true, events: scheduler.events };
}

async function staleOldEpochCannotOverwrite() {
  const draws = [];
  const scheduler = new EpochAwareLatestFrameScheduler((request) => {
    const gate = deferred();
    draws.push({ request, gate });
    return gate.promise;
  }, { epoch: 7 });
  const r1 = scheduler.request({ label: 'r1' });
  await settle();
  scheduler.epoch = 8;
  draws[0].gate.resolve('late-frame-epoch7');
  await settle();
  assert.equal(scheduler.latestAccepted, null);
  assert.equal(scheduler.completed, 0);
  assert.ok(scheduler.events.some((event) => event[0] === 'stale-epoch-completion'));
  // The stale result intentionally does not settle the waiter; an explicit dispatcher action is required.
  assert.equal(scheduler.waiters.length, 1);
  void r1;
  return { pass: true, events: scheduler.events };
}

const cases = {
  draw_local_preserves_latest: await drawLocalPreservesLatest(),
  unknown_loss_migrates_latest_once: await unknownLossMigratesLatestOnce(),
  destroyed_is_terminal: await destroyedIsTerminal(),
  repeated_loss_stops_at_budget: await repeatedLossStopsAtBudget(),
  stale_old_epoch_cannot_overwrite: await staleOldEpochCannotOverwrite(),
};

const result = {
  probe: 'webgpu_device_loss_epoch_probe_n249',
  status: 'PASS',
  cases,
  boundary: {
    teacher_fact: 'Device loss invalidates the device and its resources; destroyed is intentional terminal loss, while unknown may be recoverable only with a new device/resource epoch.',
    kaopu_candidate_not_teacher_fact: 'One epoch migration per intent is a bounded trial policy, not a WebGPU requirement.',
    not_proven: ['browser conformance', 'GPU/device recovery', 'production scheduler integration', 'user acceptance'],
  },
};

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
