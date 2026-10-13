'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const source = fs.readFileSync(path.join(__dirname, 'StartupLedger.js'), 'utf8');

function fixture(storageOverride) {
  const values = new Map();
  const storage = storageOverride || { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value) };
  let time = 1000;
  let sequence = 0;
  // A fresh VM represents a new document; session storage is shared.
  const open = (options = {}) => {
    const window = {};
    vm.runInNewContext(source, { window, Date, Math, JSON, Object, Array, Number, String, isFinite });
    const input = { storage, key: 'r54-test', version: 'r05', now: () => ++time, token: 'boot-' + (++sequence), ...options };
    return { ledger: window.R54StartupLedger.create(input), window, input };
  };
  return { open, values, storage };
}

test('classic script exposes its API and repeated create in one document is idempotent', () => {
  const { ledger, window, input } = fixture().open();
  assert.equal(ledger.active(), true);
  assert.equal(window.R54StartupLedger.create(input), ledger);
  assert.equal(ledger.report().phase, 'boot');
});

for (const phase of ['boot', 'loading', 'displaying']) {
  test(`a reload after ${phase} blocks before a second startup; repeated reload remains blocked`, () => {
    const f = fixture(); const first = f.open().ledger;
    if (phase !== 'boot') first.progress('5/5 编译眼表');
    first.record('before-render', { pass: 'eye', bytes: 123 });
    if (phase === 'displaying') { first.registerChild(first.report().bootToken, 'child-a'); first.ready(); }
    const second = f.open().ledger;
    assert.equal(second.active(), false);
    assert.equal(second.report().phase, 'blocked');
    assert.equal(second.report().previous.phase, phase);
    assert.equal(second.report().interruption.lastCheckpoint.kind, 'before-render');
    assert.doesNotMatch(second.report().reason, /OOM|内存/);
    assert.equal(second.ready().ok, false);
    const third = f.open().ledger;
    assert.equal(third.report().blocked, true);
    assert.equal(third.report().interruption.bootToken, first.report().bootToken);
  });
}

test('manual retry grants one new startup, consumes permission, and preserves prior attempts', () => {
  const f = fixture(); const first = f.open().ledger;
  first.progress('4/5 生成发束');
  const blocked = f.open().ledger;
  assert.equal(blocked.prepareRetry().ok, true);
  assert.equal(blocked.active(), false);
  assert.equal(blocked.ready().ok, false);
  const next = f.open().ledger;
  assert.equal(next.active(), true);
  assert.equal(next.report().retryPrepared, false);
  assert.equal(next.report().previous.phase, 'retry');
  assert.equal(next.report().attempts[0].stageNumber, 4);
  assert.equal(f.open().ledger.report().blocked, true);
});

test('first image is displaying; only explicit stable records completion and permits normal refresh', () => {
  const f = fixture(); const ledger = f.open().ledger;
  assert.equal(ledger.stable().ok, false);
  ledger.registerChild(ledger.report().bootToken, 'child-a');
  ledger.progress('5/5 检查画面'); ledger.ready();
  assert.equal(ledger.report().phase, 'displaying');
  assert.equal(ledger.active(), true);
  ledger.stable();
  assert.equal(ledger.report().phase, 'ready');
  assert.equal(ledger.active(), false);
  assert.equal(ledger.progress('1/5 迟到').ok, false);
  assert.equal(f.open().ledger.active(), true);
});

test('old parent tokens are rejected without failing the current startup', () => {
  const ledger = fixture().open().ledger;
  assert.equal(ledger.registerChild('old-parent', 'child-a').code, 'stale-boot-token');
  assert.equal(ledger.active(), true);
  assert.equal(ledger.report().documentToken, null);
  assert.equal(ledger.registerChild(ledger.report().bootToken, 'child-a').ok, true);
});

test('same child is idempotent; a second child stops startup without resetting the accepted identity', () => {
  const ledger = fixture().open().ledger; const token = ledger.report().bootToken;
  ledger.registerChild(token, 'child-a');
  assert.equal(ledger.registerChild(token, 'child-a').code, 'already-registered');
  ledger.progress('5/5 检查画面');
  assert.equal(ledger.registerChild(token, 'child-b').code, 'child-restarted');
  assert.equal(ledger.report().documentToken, 'child-a');
  assert.equal(ledger.report().phase, 'error');
  assert.equal(ledger.ready().ok, false);
  assert.equal(ledger.stable().ok, false);
});

test('numeric stage cannot regress; percentages at one stage may advance; terminal state remains terminal', () => {
  const ledger = fixture().open().ledger;
  ledger.progress('4/5 正在生成 20%'); ledger.progress('4/5 正在生成 30%');
  ledger.progress('5/5 检查画面');
  assert.equal(ledger.progress('2/5 载入模型').code, 'stage-regression');
  assert.equal(ledger.report().stageNumber, 5);
  assert.equal(ledger.report().stage, '5/5 检查画面');
  assert.equal(ledger.active(), false);
  assert.equal(ledger.ready().ok, false);
  assert.equal(ledger.progress('5/5 迟到').ok, false);
  assert.equal(ledger.report().phase, 'error');
});

test('failure remains latched against late ready/stable, including real failure after stable', () => {
  const f = fixture(); const ledger = f.open().ledger;
  ledger.registerChild(ledger.report().bootToken, 'child-a');
  ledger.progress('5/5 检查画面'); ledger.ready(); ledger.stable();
  ledger.fail('WebGL 绘图上下文丢失');
  const reason = ledger.report().reason;
  ledger.ready(); ledger.stable(); ledger.fail('迟到错误');
  assert.equal(ledger.report().phase, 'error');
  assert.equal(ledger.report().reason, reason);
  assert.equal(f.open().ledger.report().blocked, true);
});

test('disabled storage permits this one startup and explicitly reports missing cross-reload protection', () => {
  const f = fixture({ getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } });
  const ledger = f.open().ledger;
  assert.equal(ledger.active(), true);
  assert.equal(ledger.report().storageAvailable, false);
  assert.match(ledger.report().storageIssue, /不可用/);
  ledger.registerChild(ledger.report().bootToken, 'child-a');
  ledger.progress('5/5 检查画面'); ledger.ready(); ledger.stable();
  assert.equal(ledger.report().phase, 'ready');
});

test('write failure and an inaccessible storage getter are contained', () => {
  const ledger = fixture({ getItem() { return null; }, setItem() { throw new Error('quota'); } }).open().ledger;
  assert.equal(ledger.active(), true);
  assert.equal(ledger.report().storageAvailable, false);
  assert.match(ledger.report().storageIssue, /跨刷新/);
  const f = fixture(); const { window } = f.open();
  const options = { key: 'denied', token: 'denied-1' };
  Object.defineProperty(options, 'storage', { get() { throw new Error('blocked'); } });
  const other = window.R54StartupLedger.create(options);
  assert.equal(other.active(), true);
  assert.equal(other.report().storageAvailable, false);
});

test('corrupt or older records do not crash startup and are not called proof of a crash', () => {
  for (const raw of ['{broken', JSON.stringify({ schema: 'old-version', current: { phase: 'loading' } })]) {
    const f = fixture(); f.values.set('r54-test', raw);
    const ledger = f.open().ledger;
    assert.equal(ledger.active(), true);
    assert.equal(ledger.report().previous, null);
    assert.match(ledger.report().storageIssue, /无法据此判断中断/);
  }
});

test('diagnostic history is bounded and reports cannot mutate the ledger', () => {
  const f = fixture(); let ledger = f.open().ledger;
  for (let i = 0; i < 100; i++) ledger.record('checkpoint', { i, geometry: Array(100).fill(i) });
  assert.equal(ledger.report().history.length, 64);
  assert.equal(ledger.report().lastCheckpoint.payload.geometry.length, 12);
  const copy = ledger.report(); copy.phase = 'ready'; copy.history.length = 0;
  assert.equal(ledger.report().phase, 'boot');
  for (let i = 0; i < 12; i++) { ledger.prepareRetry(); ledger = f.open().ledger; }
  assert.equal(ledger.report().attempts.length, 8);
  assert.ok(f.values.get('r54-test').length < 1000000);
});

test('invalid stages and child identifiers cannot accidentally create a valid handshake', () => {
  const ledger = fixture().open().ledger;
  assert.equal(ledger.progress('6/5 错误阶段').code, 'invalid-stage');
  assert.equal(ledger.registerChild(ledger.report().bootToken, '').code, 'invalid-document-token');
  assert.equal(ledger.report().stageNumber, 0);
  assert.equal(ledger.report().documentToken, null);
});

test('imported snapshots discard recursive report fields and large payloads stay bounded', () => {
  const f = fixture();
  const original = f.open().ledger;
  const payload = {};
  for (let i = 0; i < 12; i++) payload['field' + i] = Array(12).fill('x'.repeat(500));
  original.record('large-input', payload);
  original.record('typed-array', { positions: new Float32Array(10000) });
  assert.ok(JSON.stringify(original.report().history).length < 8000);
  const saved = JSON.parse(f.values.get('r54-test'));
  saved.current.previous = { huge: 'must not survive' };
  saved.current.attempts = [{ nested: 'must not survive' }];
  f.values.set('r54-test', JSON.stringify(saved));
  const reloaded = f.open().ledger.report();
  assert.equal(reloaded.previous.previous, undefined);
  assert.equal(reloaded.previous.attempts, undefined);
  assert.equal(reloaded.attempts[0].previous, undefined);
});

test('maximum event and attempt histories remain below the reader size limit', () => {
  const f = fixture(); let ledger = f.open().ledger;
  const payload = { text: 'x'.repeat(1000), other: 'y'.repeat(1000), extra: Array(12).fill('z'.repeat(500)) };
  for (let attempt = 0; attempt < 10; attempt++) {
    for (let event = 0; event < 70; event++) ledger.record('resource-checkpoint', payload);
    ledger.prepareRetry();
    ledger = f.open().ledger;
    assert.equal(ledger.active(), true);
    assert.ok(f.values.get('r54-test').length < 1000000);
  }
  assert.ok(ledger.report().previous.history.length <= 12);
});

test('ready requires an accepted child document and stage five', () => {
  const ledger = fixture().open().ledger;
  assert.equal(ledger.ready().code, 'premature-ready');
  ledger.progress('4/5 生成发束');
  ledger.registerChild(ledger.report().bootToken, 'child-a');
  assert.equal(ledger.ready().code, 'premature-ready');
  ledger.progress('5/5 检查画面');
  assert.equal(ledger.ready().ok, true);
  const unregistered = fixture().open().ledger;
  unregistered.progress('5/5 检查画面');
  assert.equal(unregistered.ready().code, 'premature-ready');
});

test('lifecycle events preserve the last render and resources, including nested shadow data after reload', () => {
  const f = fixture(); const ledger = f.open().ledger;
  ledger.progress('5/5 检查画面');
  ledger.record('render-submit-before', { resources: { geometryBytes: 113000000, shadows: [{ name: 'key', mapSize: { width: 4096, height: 4096 } }] } });
  ledger.record('parent-pagehide', { persisted: false });
  const report = ledger.report();
  assert.equal(report.lastCheckpoint.kind, 'parent-pagehide');
  assert.equal(report.lastRenderCheckpoint.kind, 'render-submit-before');
  assert.equal(report.lastResources.resources.shadows[0].mapSize.width, 4096);
  const resumed = f.open().ledger.report();
  assert.equal(resumed.previous.lastResources.resources.shadows[0].mapSize.height, 4096);
  assert.equal(resumed.interruption.lastRenderCheckpoint.kind, 'render-submit-before');
});

test('resource measurement caveat survives after twelve preceding fields', () => {
  const ledger = fixture().open().ledger;
  const resources = {};
  for (let i = 0; i < 12; i++) resources['field' + i] = i;
  resources.limits = 'Not total process/GPU memory; render return does not prove GPU completion.';
  ledger.record('render-submit-before', { resources });
  assert.equal(ledger.report().lastResources.resources.limits, resources.limits);
});
