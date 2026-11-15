#!/usr/bin/env node
'use strict';

// Pure tests of the added verifier gate. No native scene or browser is run.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const cp = require('node:child_process');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const source = fs.readFileSync(path.join(root, 'verify-browser.cjs'), 'utf8');
const previousFile = path.join(__dirname, 'audit-cross-object-contract.json');
const previousBytes = fs.readFileSync(previousFile);
assert.equal(hash(previousBytes), '7a001183cc177989e7ca9cecfc4be83cebcd6f278bc303a5cd69f2b65bef660e');
const previous = JSON.parse(previousBytes);
const segment = (start, end) => {
  const from = source.indexOf(start), to = source.indexOf(end, from);
  assert(from >= 0 && to > from);
  return source.slice(from, to);
};
const captures = new Map();
const {auditWindowPoses} = vm.runInNewContext([
  segment('const CONTACT_STAGES=', 'function checkWindowObject('),
  segment('const WINDOW_APPROACH_STAGES=', 'function checkWindowReceipt('),
  '({auditWindowPoses})'
].join('\n'), {assert, put: (name, value) => captures.set(name, value)},
{timeout: 1000, filename: 'precontact-verifier-isolation.js'});
const token = 'A:window:synthetic-contract-only';
function makeRows() {
  const shape = {id: 'bottle-01', position: [0, 1.09, .37], quaternion: [0, 0, 0, 1], radius: .032, height: .14};
  const stages = [
    ['approach-start', 1, 0],
    ...Array.from({length: 17}, (_, i) => ['approach-transition', 1 + (i + 1) / 10, 0]),
    ['approach-end', 2.8, 0], ['contact', 3.5, 0],
    ...Array.from({length: 6}, (_, i) => ['swing', 3.6 + i / 10, -(i + 1) * 5]),
    ['release', 4.2, -35], ['withdraw-start', 4.2, -35],
    ...Array.from({length: 8}, (_, i) => ['withdraw-transition', 4.3 + i / 10, -35]),
    ['withdraw-end', 5.1, -35], ['rest-start', 5.1, -35],
    ...Array.from({length: 6}, (_, i) => ['rest-transition', 5.2 + i / 10, -35]),
    ['rest', 5.75, -35]
  ];
  return stages.map(([stage, time, angleDeg]) => {
    const isApproach = stage.startsWith('approach-');
    const held = ['contact', 'swing'].includes(stage);
    return {
      id: 'A', taskToken: token, operatedObjectId: 'window-handle-01',
      stage, phase: isApproach ? 'approach' : stage, time, angleDeg,
      nativeGeometryMeasured: true, finite: true,
      boneLengthErrorM: 0, footSurfaceErrorM: 0, footWorldYM: {L: 0, R: 0},
      hingeConstraintCount: 1, gripConstraintCount: held ? 1 : 0, heldBy: held ? 'A' : null,
      reachClamped: false, contactErrorM: isApproach ? .3 : .001,
      handErrorM: stage === 'approach-start' ? null : 1e-8,
      maxHandlePenetrationM: .0045, restPoseErrorRad: stage === 'rest' ? 0 : .2,
      solidSampleCount: 200, solidMaxPenetrationM: 0,
      solidParts: {hand: {sampleCount: 150}, forearm: {sampleCount: 50}},
      solidByBox: {'frame-test-fixture': {sampleCount: 200, maxPenetrationM: 0}},
      solidCylinders: [structuredClone(shape)],
      solidByCylinder: {'bottle-01': {
        sampleCount: 200, maxPenetrationM: 0,
        geometry: {kind: 'finite-local-Y-cylinder', ...structuredClone(shape)}
      }},
      approach: isApproach ? {
        elapsed: time - 1, segment: time - 1 < 1.15 ? 'pre-position' : 'normal-entry',
        prePositionSeconds: 1.15, normalEntrySeconds: .65, normalDistanceM: .14,
        preTarget: [.2, 1.2, .3], requestedPalm: stage === 'approach-start' ? null : [.2, 1.2, .4]
      } : null
    };
  });
}
const tests = [];
function test(name, fn) {
  try { tests.push({name, passed: true, detail: fn() ?? null}); }
  catch (error) { tests.push({name, passed: false, error: String(error.stack || error)}); }
}
function reject(name, mutate, reason) {
  test(name, () => {
    const rows = makeRows(); mutate(rows);
    assert.throws(() => auditWindowPoses({audit: {poses: rows}}, token, name, {fullSwing: true}));
    const receipt = captures.get('window-poses-' + token.replace(/[^a-zA-Z0-9_-]/g, '-') + '.json');
    assert(receipt.violations.some(row => row.reason.includes(reason)), reason);
    return {rejected: true, evidencePreservedBeforeAssertion: true, violations: structuredClone(receipt.violations)};
  });
}
test('full recorded approach accepts 4.5 mm own-handle contact without applying held palm-distance gate', () => {
  const receipt = auditWindowPoses({audit: {poses: makeRows()}}, token, 'positive-precontact', {fullSwing: true});
  assert.equal(receipt.accepted, true);
  assert.equal(receipt.approachTransitionCount, 17);
  assert(receipt.maxApproachSampleGapSeconds < .101);
  return structuredClone(receipt);
});
test('unchanged exact 5 mm operated-handle boundary passes during approach', () => {
  const rows = makeRows();
  for (const row of rows.filter(row => row.phase === 'approach')) row.maxHandlePenetrationM = .005;
  assert.equal(auditWindowPoses({audit: {poses: rows}}, token, 'boundary-precontact', {fullSwing: true}).accepted, true);
});
reject('approach hand penetration fails before temporary grip exists', rows => {
  rows.find(row => row.stage === 'approach-transition').maxHandlePenetrationM = .005001;
}, 'handle cylinder by more than 5 mm');
reject('approach neighbouring bottle remains under the 3 mm other-solid gate', rows => {
  rows.find(row => row.stage === 'approach-transition').solidByCylinder['bottle-01'].maxPenetrationM = .003001;
}, 'other cylinder by more than 3 mm');
reject('missing entire approach cannot be replaced by held contact evidence', rows => {
  rows.splice(0, 19);
}, 'approach before contact lacks');
test('native joint interpolation needs no invented IK request or fixed candidate segment names', () => {
  const rows = makeRows();
  for (const row of rows.filter(row => row.stage === 'approach-transition')) {
    row.approach = {elapsed: row.time - 1, segment: 'actual-native-joint-transition', requestedPalm: null};
  }
  assert.equal(auditWindowPoses({audit: {poses: rows}}, token, 'native-joint-precontact', {fullSwing: true}).accepted, true);
});
reject('a 300 ms gap in approach surface evidence fails', rows => {
  const missing = rows.filter(row => row.stage === 'approach-transition' && row.time >= 1.5 && row.time <= 1.7);
  for (const row of missing) rows.splice(rows.indexOf(row), 1);
}, 'at most 0.15 second gaps');
reject('end from another task cannot fill this task approach', rows => {
  rows.find(row => row.stage === 'approach-end').taskToken = 'B:window:different-task';
}, 'approach before contact lacks');
reject('approach world time and elapsed time must describe the same motion', rows => {
  rows.find(row => row.stage === 'approach-transition').approach.elapsed += .2;
}, 'elapsed time disagrees');
reject('start must record the initial pose before elapsed approach time', rows => {
  rows[0].approach.elapsed = .2;
}, 'at zero elapsed time');
reject('approach-end must precede physical attachment', rows => {
  const end = rows.find(row => row.stage === 'approach-end');
  rows.splice(rows.indexOf(end), 1);
  rows.splice(rows.findIndex(row => row.stage === 'contact') + 1, 0, end);
}, 'not in causal order');

function signedDistance(point, shape) {
  const norm = Math.hypot(...shape.quaternion);
  const [qx, qy, qz, qw] = shape.quaternion.map((v, i) => v / norm * (i < 3 ? -1 : 1));
  const [x, y, z] = point.map((v, i) => v - shape.position[i]);
  const tx = 2 * (qy * z - qz * y), ty = 2 * (qz * x - qx * z), tz = 2 * (qx * y - qy * x);
  const local = [x + qw * tx + qy * tz - qz * ty,
    y + qw * ty + qz * tx - qx * tz, z + qw * tz + qx * ty - qy * tx];
  const radial = Math.hypot(local[0], local[2]) - shape.radius;
  const axial = Math.abs(local[1]) - shape.height / 2;
  return Math.hypot(Math.max(radial, 0), Math.max(axial, 0)) + Math.min(Math.max(radial, axial), 0);
}
const failurePath = path.join(__dirname, 'native-window-approach-handle-first-failure.json');
const failureBytes = fs.readFileSync(failurePath), failure = JSON.parse(failureBytes);
const realWitnesses = [];
for (const result of failure.results.filter(row => row.operation === 'close')) {
  test('real native ' + result.actor + ' precontact deepest vertex is rejected', () => {
    const witness = result.worstOperated;
    assert.equal(witness.stage, 'approach');
    assert.equal(witness.heldBy, null);
    const sdf = signedDistance(witness.pointWorld, witness.operatedCylinder);
    assert(Math.abs(-sdf - witness.penetrationM) < 1e-10);
    assert(sdf < -.005);
    const rows = makeRows(), transition = rows.find(row => row.stage === 'approach-transition');
    transition.maxHandlePenetrationM = -sdf;
    assert.throws(() => auditWindowPoses({audit: {poses: rows}}, token,
      'native-precontact-' + result.actor, {fullSwing: true}));
    const receipt = captures.get('window-poses-' + token.replace(/[^a-zA-Z0-9_-]/g, '-') + '.json');
    assert(receipt.violations.some(row => row.reason.includes('handle cylinder by more than 5 mm')));
    const measured = {
      actor: result.actor, vertex: witness.vertex, sourceTime: witness.time,
      stage: witness.stage, heldBy: witness.heldBy, exactSignedDistanceM: sdf,
      penetrationM: -sdf, rejectedBeforeContact: true,
      evidenceType: 'existing production-native CPU weighted vertex and actual Cannon cylinder; not new browser evidence'
    };
    realWitnesses.push(measured); return measured;
  });
}

const producerPath = path.join(root, 'WindowInteraction.mjs');
const producer = fs.readFileSync(producerPath, 'utf8');
const producerContract = [];
test('current producer contains the locked approach stages and actual elapsed metadata', () => {
  for (const marker of ["'approach-start'", "'approach-transition'", "'approach-end'",
    'approach:', 'elapsed:']) {
    const at = producer.indexOf(marker);
    assert(at >= 0, 'Required actual producer marker: ' + marker);
    producerContract.push({marker, line: producer.slice(0, at).split('\n').length});
  }
});
const syntax = cp.spawnSync(process.execPath, ['--check', path.join(root, 'verify-browser.cjs')], {encoding: 'utf8'});
const report = {
  schema: 'kaopu/npc-r02-window-precontact-verifier-contract@1', createdAt: new Date().toISOString(),
  scope: 'Only the necessary new window precontact gate; previous cross-object checks remain historical evidence. Synthetic fixtures are TEST_FIXTURE_ONLY and cannot certify a runtime.',
  verifierSHA256: hash(Buffer.from(source)), previousVerifierSHA256: previous.verifierSHA256,
  previousAudit: {path: previousFile, sha256: hash(previousBytes), originalCheckCount: previous.testCount},
  scriptSHA256: hash(fs.readFileSync(__filename)),
  producer: {path: producerPath, sha256: hash(Buffer.from(producer)), contractMarkers: producerContract},
  windowEvidenceRetention: {
    capacity: 256,
    reviewed: 'Workbench deep-copies each completed open, close and other window case; the verifier selects the case copy by taskToken, with no window-array-length cursor.',
    baselineActualMaximumRowsPerTask: 26,
    additionalApproachRows: 'At about 1.8 seconds, around 20 approach rows including its segment boundary plus the prior maximum of 26 gives about 46 rows per task, well below 256; this is a source-based estimate, not a new browser measurement.',
    boundary: 'The final rolling world snapshot can omit older tasks; their completed case copies remain in verification. Missing required stages still fail.'
  },
  originalFailure: {path: failurePath, sha256: hash(failureBytes), sourceHashes: failure.sourceHashes,
    geometrySourceHashes: failure.geometrySourceHashes, measuredAt: failure.completedAt},
  thresholdsUnchanged: {operatedHandleM: .005, otherSolidM: .003, maxApproachSampleGapSeconds: .15},
  realWitnesses, syntaxCheck: {exitCode: syntax.status, stderr: syntax.stderr},
  testCount: tests.length, passedCount: tests.filter(row => row.passed).length, tests,
  passed: syntax.status === 0 && tests.every(row => row.passed),
  dynamicNativeExecuted: false, dynamicBrowserExecuted: false, productionSourceChanged: false,
  visualAcceptance: false, publicURLVerified: false,
  limits: [
    'The browser verifier validates complete approaches only for tasks that reached contact; early cancellation does not invent approach-end or contact.',
    'This checks actual recorded vertex SDF and bounded sampling gaps, not continuous triangle collision.',
    'New corrected full native R07 browser and public-page acceptance remain required.'
  ]
};
const destination = path.join(__dirname, 'audit-window-precontact-contract.json');
fs.writeFileSync(destination, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({path: destination, passed: report.passed, tests: report.testCount,
  passedCount: report.passedCount, verifierSHA256: report.verifierSHA256,
  producerSHA256: report.producer.sha256, failures: tests.filter(row => !row.passed)}, null, 2));
if (!report.passed) process.exitCode = 1;
