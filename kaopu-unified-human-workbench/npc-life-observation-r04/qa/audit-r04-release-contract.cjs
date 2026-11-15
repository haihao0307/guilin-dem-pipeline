'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {VERSION, releaseTarget, validateBuildReceipt} = require('../ReleaseContract.cjs');

const HEAD = '0123456789abcdef0123456789abcdef01234567';
const OTHER_HEAD = 'fedcba9876543210fedcba9876543210fedcba98';
const HASH = 'a'.repeat(64);
const tests = [];
const receipt = () => ({...releaseTarget(HEAD), standalone: true, previewSHA256: HASH, previewBytes: 66603783});
function test(name, run) {
  try { run(); tests.push({name, passed: true}); }
  catch (error) { tests.push({name, passed: false, error: error.stack}); }
}
function rejectReceipt(name, change, field) {
  test(name, () => {
    const build = receipt(); change(build);
    assert.throws(() => validateBuildReceipt(build), error =>
      error.code === 'RELEASE_CONTRACT_INVALID' && (!field || error.field === field));
  });
}

test('one exact immutable R04 target is derived from the source head', () => {
  assert.equal(VERSION, 'NPC-LIFE-OBSERVATION-R04');
  const publicPath = 'npc-life-observation/r04-20261021/' + HEAD + '/';
  assert.deepEqual(releaseTarget(HEAD), {version: VERSION, sourceHead: HEAD, publicPath,
    publicURL: 'https://haihao0307.github.io/guilin-dem-pipeline/' + publicPath});
});
test('valid standalone receipt succeeds and additional build evidence is preserved', () => {
  const build = {...receipt(), sourceFiles: {'Workbench.mjs': HASH}, externalCoreRequests: 0};
  const before = JSON.stringify(build);
  assert.equal(validateBuildReceipt(build), true);
  assert.equal(JSON.stringify(build), before, 'Validation must not mutate build evidence');
});
test('derived targets are independent values and cannot mutate the release identity', () => {
  const target = releaseTarget(HEAD); target.publicPath = 'wrong/'; target.version = 'R03';
  assert.equal(validateBuildReceipt(receipt()), true);
});
rejectReceipt('reject old R03 path even when its URL agrees with that old path', build => {
  build.publicPath = 'npc-life-observation/r03-20261020/' + HEAD + '/';
  build.publicURL = 'https://haihao0307.github.io/guilin-dem-pipeline/' + build.publicPath;
}, 'publicPath');
rejectReceipt('reject a different source head with an unchanged target path', build => { build.sourceHead = OTHER_HEAD; }, 'publicPath');
rejectReceipt('reject a different head embedded only in the path', build => {
  build.publicPath = releaseTarget(OTHER_HEAD).publicPath;
}, 'publicPath');
rejectReceipt('reject old runtime version', build => { build.version = 'NPC-LIFE-OBSERVATION-R03'; }, 'version');
rejectReceipt('reject missing path trailing slash', build => { build.publicPath = build.publicPath.slice(0, -1); }, 'publicPath');
rejectReceipt('reject missing URL trailing slash', build => { build.publicURL = build.publicURL.slice(0, -1); }, 'publicURL');
rejectReceipt('reject path and URL pointing at different heads', build => { build.publicURL = releaseTarget(OTHER_HEAD).publicURL; }, 'publicURL');
rejectReceipt('reject another public origin', build => { build.publicURL = build.publicURL.replace('haihao0307.github.io', 'example.invalid'); }, 'publicURL');
rejectReceipt('reject query parameters on the immutable public URL', build => { build.publicURL += '?candidate=1'; }, 'publicURL');
rejectReceipt('reject fragment identifiers on the immutable public URL', build => { build.publicURL += '#r04'; }, 'publicURL');
test('reject malformed source heads before deriving a target', () => {
  for (const head of [undefined, null, 123, '', HEAD.slice(1), HEAD + '0', HEAD.toUpperCase(), 'g'.repeat(40), '../' + HEAD])
    assert.throws(() => releaseTarget(head), error => error.code === 'RELEASE_CONTRACT_INVALID' && error.field === 'sourceHead');
});
test('receipt validation rejects malformed source-head metadata', () => {
  for (const sourceHead of [undefined, null, HEAD.slice(1), 'g'.repeat(40)])
    assert.throws(() => validateBuildReceipt({...receipt(), sourceHead}), error => error.field === 'sourceHead');
});
test('reject missing required release fields', () => {
  for (const field of ['sourceHead', 'version', 'publicPath', 'publicURL']) {
    const build = receipt(); delete build[field];
    assert.throws(() => validateBuildReceipt(build), error => error.code === 'RELEASE_CONTRACT_INVALID' && error.field === field);
  }
});
test('standalone is required as a true boolean', () => {
  for (const standalone of [undefined, null, false, 'true', 1])
    assert.throws(() => validateBuildReceipt({...receipt(), standalone}), error => error.field === 'standalone');
});
test('preview SHA256 must contain exactly 64 canonical hex characters', () => {
  for (const previewSHA256 of [undefined, null, 123, '', 'a'.repeat(63), 'a'.repeat(65), 'g'.repeat(64), 'A'.repeat(64)])
    assert.throws(() => validateBuildReceipt({...receipt(), previewSHA256}), error => error.field === 'previewSHA256');
});
test('preview byte count must be a positive safe integer', () => {
  for (const previewBytes of [undefined, null, true, 0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '66603783'])
    assert.throws(() => validateBuildReceipt({...receipt(), previewBytes}), error => error.field === 'previewBytes');
});
test('reject non-object build receipts', () => {
  for (const build of [undefined, null, [], 'BUILD.json', 1])
    assert.throws(() => validateBuildReceipt(build), error => error.field === 'build');
});

const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const report = {
  schema: 'kaopu/r04-release-contract-qa@1', createdAt: new Date().toISOString(), version: VERSION,
  scope: 'Pure Node release-target and metadata contract; does not prove HTTP availability, bytes, rendering or public delivery',
  sourceSHA256: hash(path.join(__dirname, '..', 'ReleaseContract.cjs')), testSourceSHA256: hash(__filename),
  expectedTarget: releaseTarget(HEAD), passed: tests.every(item => item.passed),
  counts: {passed: tests.filter(item => item.passed).length, total: tests.length}, tests
};
fs.writeFileSync(path.join(__dirname, 'audit-r04-release-contract.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({schema: report.schema, passed: report.passed, counts: report.counts,
  sourceSHA256: report.sourceSHA256, failures: tests.filter(item => !item.passed)}, null, 2));
if (!report.passed) process.exitCode = 1;
