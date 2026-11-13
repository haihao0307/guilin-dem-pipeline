'use strict';

// Pure regression checks for the export comparator. This does not start a
// browser, change production data, or reclassify an earlier failed CI run.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const verifierPath = path.resolve(__dirname, '../verify-browser.cjs');
const verifierBytes = fs.readFileSync(verifierPath);
const verifier = verifierBytes.toString('utf8');
const helperStart = verifier.indexOf('function normalizeExportNegativeZero(');
const helperEnd = verifier.indexOf('async function windowExportUI(', helperStart);
assert.ok(helperStart >= 0 && helperEnd > helperStart, 'Production comparison helper must exist');
const helperSource = verifier.slice(helperStart, helperEnd);
const normalize = new Function(`${helperSource}\nreturn normalizeExportNegativeZero;`)();
const checks = [];

function check(name, run) {
  try {
    run();
    checks.push({ name, passed: true });
  } catch (error) {
    checks.push({ name, passed: false, error: String(error.stack || error) });
  }
}

const expected = {
  angleDeg: -0,
  targetRevision: 4,
  target: [0.12, 1.0908, -0],
  task: { taskToken: 'A:window:7', result: 'completed', angleDeg: -0 },
  events: [{ sequence: 1, type: 'reserved' }, { sequence: 2, type: 'completed' }],
  nested: { values: [null, false, true, 'zero', -0, 0, 0.001, -35] }
};

// JSON serialization here constructs the synthetic download fixture only. The
// production expected value is compared through the explicit zero-only helper.
const syntheticDownload = JSON.parse(JSON.stringify(expected));
const cloneDownload = () => structuredClone(syntheticDownload);

check('Numeric negative zero at every nested position matches its JSON value', () => {
  assert.deepStrictEqual(syntheticDownload, normalize(expected));
});

check('Comparison leaves the authoritative source object untouched', () => {
  normalize(expected);
  assert.ok(Object.is(expected.angleDeg, -0));
  assert.ok(Object.is(expected.task.angleDeg, -0));
  assert.ok(Object.is(expected.target[2], -0));
  assert.ok(Object.is(expected.nested.values[4], -0));
});

check('Ordinary values, all keys, and array ordering remain exact', () => {
  const unchanged = { numbers: [0, -35, 0.001, Number.MAX_SAFE_INTEGER], text: '', bool: false, nil: null };
  assert.deepStrictEqual(normalize(unchanged), unchanged);
  assert.deepStrictEqual(Reflect.ownKeys(normalize(expected)), Reflect.ownKeys(expected));
});

function difference(name, mutate) {
  check(name, () => {
    const actual = cloneDownload();
    mutate(actual);
    assert.throws(() => assert.deepStrictEqual(actual, normalize(expected)), assert.AssertionError);
  });
}

difference('A genuine angle difference is rejected', actual => { actual.task.angleDeg = 0.001; });
difference('A changed target revision is rejected', actual => { actual.targetRevision += 1; });
difference('A changed task token is rejected', actual => { actual.task.taskToken = 'A:window:8'; });
difference('A missing key is rejected', actual => { delete actual.task.result; });
difference('An unexpected key is rejected', actual => { actual.task.extra = true; });
difference('Changed event ordering is rejected', actual => { actual.events.reverse(); });
difference('Changed array ordering is rejected', actual => { actual.target.reverse(); });

check('Undefined object keys are preserved and cannot be silently dropped', () => {
  const raw = { present: undefined };
  const normalized = normalize(raw);
  assert.ok(Object.hasOwn(normalized, 'present'));
  assert.equal(normalized.present, undefined);
  assert.throws(() => assert.deepStrictEqual({}, normalized), assert.AssertionError);
});

check('Undefined array entries cannot silently become JSON null', () => {
  assert.throws(() => assert.deepStrictEqual([null], normalize([undefined])), assert.AssertionError);
});

check('NaN and both infinities are retained and rejected against JSON null', () => {
  for (const value of [NaN, Infinity, -Infinity]) {
    assert.ok(Object.is(normalize(value), value));
    assert.throws(() => assert.deepStrictEqual({ value: null }, normalize({ value })), assert.AssertionError);
  }
});

check('Sparse array holes are preserved and differ from JSON null entries', () => {
  const raw = new Array(2);
  raw[1] = -0;
  const normalized = normalize(raw);
  assert.equal(normalized.length, 2);
  assert.equal(0 in normalized, false);
  assert.ok(Object.is(normalized[1], 0));
  assert.throws(() => assert.deepStrictEqual([null, 0], normalized), assert.AssertionError);
});

check('Object descriptors and symbol keys survive the zero-only comparison copy', () => {
  const symbol = Symbol('retained');
  const raw = { [symbol]: -0 };
  Object.defineProperty(raw, 'hidden', { value: -0, enumerable: false, writable: false });
  const normalized = normalize(raw);
  assert.deepStrictEqual(Reflect.ownKeys(normalized), Reflect.ownKeys(raw));
  assert.ok(Object.is(normalized[symbol], 0));
  assert.deepStrictEqual(Object.getOwnPropertyDescriptor(normalized, 'hidden'), {
    value: 0, writable: false, enumerable: false, configurable: false
  });
});

check('Both real UI export comparison sites use the same zero-only helper', () => {
  const applications = verifier.match(/const current=normalizeExportNegativeZero\(await evaluate\(/g) || [];
  assert.equal(applications.length, 2);
  assert.ok(!helperSource.includes('JSON.parse') && !helperSource.includes('JSON.stringify'));
  for (const context of ['read actual paused window data before UI export', 'read paused authoritative world for export']) {
    assert.ok(verifier.includes(`normalizeExportNegativeZero(await evaluate('${context}'`));
  }
});

const report = {
  schema: 'R02-json-export-negative-zero-contract@1',
  createdAt: new Date().toISOString(),
  scope: 'Pure tests of the exact helper extracted from verify-browser.cjs; no browser or product behavior executed',
  failedRunRetained: {
    sourceHead: '1bac098583b04a415ecdd6e94db6a80b29e337de',
    runId: 39391126228,
    status: 'FAILED',
    originalVerifierSHA256: '95a31e78656d4a05d70c0b38767395175247f485fe34f49359d043e65323e628'
  },
  change: 'Only numeric negative zero becomes positive zero in expected export data; keys, array order, undefined and nonfinite values stay available for strict comparison',
  verifierSHA256: crypto.createHash('sha256').update(verifierBytes).digest('hex'),
  testSourceSHA256: crypto.createHash('sha256').update(fs.readFileSync(__filename)).digest('hex'),
  checks,
  passed: checks.every(item => item.passed),
  publicURLVerified: false,
  browserAcceptance: 'Not assessed by this pure regression test; a fresh unchanged-gate full browser suite is still required'
};
const reportPath = path.join(__dirname, 'audit-json-export-semantics-contract.json');
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ passed: report.passed, checks: checks.length, verifierSHA256: report.verifierSHA256, reportPath })}\n`);
if (!report.passed) process.exitCode = 1;
