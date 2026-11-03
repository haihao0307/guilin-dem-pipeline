#!/usr/bin/env node
'use strict';

// Independent verifier-contract evidence. This file never imports production
// actors, starts a browser, changes a scene, or turns runtime acceptance true.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const cp = require('node:child_process');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const clone = value => structuredClone(value);
const verifier = read('verify-browser.cjs');
const captured = new Map();
const segment = (start, end) => {
  const from = verifier.indexOf(start), to = verifier.indexOf(end, from);
  assert(from >= 0 && to > from, 'Unambiguous isolated verifier function range');
  return verifier.slice(from, to);
};
const sandbox = {
  assert,
  put: (name, value) => captured.set(name, value)
};
const functions = vm.runInNewContext([
  segment('const CONTACT_STAGES=', 'function checkWindowObject('),
  segment('function auditWindowPoses(', 'function checkWindowReceipt('),
  '({otherSolidViolations,checkAuditGeometry,auditWindowPoses,WINDOW_TOLERANCES})'
].join('\n'), sandbox, {timeout: 1000, filename: 'isolated-verifier-contract.js'});

const tests = [];
function test(name, run) {
  try {
    const detail = run();
    tests.push({name, passed: true, detail: detail ?? null});
  } catch (error) {
    tests.push({name, passed: false, error: String(error.stack || error)});
  }
}
const shapeReport = (shape, sampleCount = 200, penetration = 0) => ({
  sampleCount,
  minimumSignedDistanceM: penetration ? -penetration : .02,
  maxPenetrationM: penetration,
  geometry: {kind: 'finite-local-Y-cylinder', ...clone(shape)}
});
function geometry(operated = 'bottle-01', required = 'window-handle-01') {
  const shape = {
    id: required, position: [.19, 1.2, .44], quaternion: [0, 0, 0, 1],
    radius: .032, height: .14
  };
  return {
    operatedObjectId: operated,
    solidSampleCount: 200,
    solidMaxPenetrationM: 0,
    solidParts: {hand: {sampleCount: 150}, forearm: {sampleCount: 50}},
    solidByBox: {'frame-test-fixture': {sampleCount: 200, maxPenetrationM: 0}},
    solidByCylinder: {[required]: shapeReport(shape)},
    solidCylinders: [shape]
  };
}
const bottleOptions = {
  operatedObjectId: 'bottle-01', requiredCylinderId: 'window-handle-01', poseMetadata: true
};
function rejectsGeometry(name, mutate, expectedReason) {
  test(name, () => {
    const g = geometry(); mutate(g);
    const violations = functions.otherSolidViolations(g, bottleOptions);
    assert(violations.some(reason => reason.includes(expectedReason)), expectedReason);
    return {rejected: true, violations: Array.from(violations)};
  });
}

test('complete other-solid descriptor and hand plus forearm samples accepted', () => {
  assert.equal(functions.otherSolidViolations(geometry(), bottleOptions).length, 0);
});
test('existing 3 mm other-solid boundary retained', () => {
  const g = geometry();
  g.solidMaxPenetrationM = .003;
  g.solidByCylinder['window-handle-01'].maxPenetrationM = .003;
  assert.equal(functions.otherSolidViolations(g, bottleOptions).length, 0);
});
rejectsGeometry('missing neighbouring cylinder rejected', g => {
  g.solidByCylinder = {}; g.solidCylinders = [];
}, 'Expected non-operated cylinder lacks');
rejectsGeometry('hand-only diagnostics rejected', g => {
  g.solidParts.forearm.sampleCount = 0;
}, 'both hand and forearm');
rejectsGeometry('partial cylinder sample count cannot masquerade as full arm', g => {
  g.solidByCylinder['window-handle-01'].sampleCount = 150;
}, 'same complete hand and forearm');
rejectsGeometry('other-cylinder pose and actual report must agree', g => {
  g.solidCylinders[0].position[0] += .2;
}, 'world position disagree');
rejectsGeometry('operated cylinder cannot silently move to 3 mm class', g => {
  g.solidByCylinder['bottle-01'] = clone(g.solidByCylinder['window-handle-01']);
}, 'operated cylinder must not');
rejectsGeometry('zero aggregate does not hide nonzero individual penetration', g => {
  g.solidByCylinder['window-handle-01'].maxPenetrationM = .012;
}, 'other cylinder by more than 3 mm');
rejectsGeometry('missing source cylinder descriptor rejected', g => {
  delete g.solidCylinders;
}, 'retain its actual pose and dimensions');
rejectsGeometry('null cylinder descriptor rejected without uncaught access error', g => {
  g.solidCylinders.push(null);
}, 'descriptor is missing');

function bottleRows(id = 'A', started = 1) {
  const stages = [
    ['approach', .1], ['close', 1], ['lift', 2], ['transfer', 3],
    ['lower', 4], ['lower-end', 5], ['withdraw-start', 5], ['verify', 5.01],
    ...Array.from({length: 8}, (_, i) => ['withdraw', 5 + (i + 1) / 10]),
    ['withdraw-end', 5.9], ['rest-start', 5.9],
    ...Array.from({length: 6}, (_, i) => ['rest', 5.9 + (i + 1) / 10]),
    ['rest-end', 6.55]
  ];
  return stages.map(([stage, time]) => ({
    ...geometry(), id, taskStartedTime: started, phase: stage,
    stage, time: started + time, finite: true,
    boneLengthErrorM: 0, footSurfaceErrorM: 0, footWorldYM: {L: 0, R: 0},
    supportEnabled: true, handTableSampleCount: 20, handTableClearanceM: .02,
    bottleMaxPenetrationM: .0045, restPoseErrorRad: stage === 'rest-end' ? 0 : .2
  }));
}
const bottleAuditOptions = {
  requiredActors: ['A'], requireRecovery: true, expectedTaskCounts: {A: 1}
};
function expectBottleFailure(name, rows, options, expectedReason) {
  test(name, () => {
    const label = name.replace(/[^a-z0-9]+/gi, '-');
    let failure = null;
    try { functions.checkAuditGeometry({audit: {poses: rows}}, label, options); }
    catch (error) { failure = error; }
    const receipt = captured.get('phase-geometry-' + label + '.json');
    assert(failure, 'Invalid contract must fail the verifier');
    assert(receipt, 'Failure measurements must be retained before assertion');
    assert(receipt.violations.some(row => row.reason.includes(expectedReason)), expectedReason);
    return {rejected: true, retainedMeasurements: true, violations: clone(receipt.violations)};
  });
}
test('complete bottle task and recovery preserve operated 4.5 mm assisted contact', () => {
  const receipt = functions.checkAuditGeometry({audit: {poses: bottleRows()}},
    'positive-bottle', bottleAuditOptions);
  assert.equal(receipt.accepted, true);
  assert.equal(receipt.taskCounts.A, 1);
  return clone(receipt);
});
expectBottleFailure('missing withdrawal intermediate samples rejected',
  bottleRows().filter(row => row.stage !== 'withdraw'), bottleAuditOptions,
  'actual bottle exit lacks intermediate');
expectBottleFailure('missing real recovery interval rejected',
  bottleRows().filter(row => !(row.stage === 'rest' && row.time > 7.1 && row.time < 7.4)),
  bottleAuditOptions, 'at most 0.15 second gaps');
const wrongTask = bottleRows();
for (const row of wrongTask.filter(row => ['rest-start', 'rest', 'rest-end'].includes(row.stage))) {
  row.taskStartedTime = 2;
}
expectBottleFailure('another task cannot supply missing rest samples', wrongTask,
  bottleAuditOptions, 'required actual bottle exit sample is missing');
const badRest = bottleRows(); badRest.at(-1).restPoseErrorRad = .02;
expectBottleFailure('final rest deviation rejected while intermediate rotation is permitted',
  badRest, bottleAuditOptions, 'did not reach the original rest pose');
const unordered = bottleRows();
[unordered[8], unordered[9]] = [unordered[9], unordered[8]];
expectBottleFailure('out-of-order task samples rejected', unordered,
  bottleAuditOptions, 'not in chronological order');
const invalidTime = bottleRows(); invalidTime[8].time = NaN;
expectBottleFailure('nonfinite timestamp cannot disappear through the audit cursor', invalidTime,
  bottleAuditOptions, 'no finite time');

const expectedSuiteTasks = {A: 4, B: 2, C: 1};
const suiteRows = [];
let started = 1;
for (const [id, count] of Object.entries(expectedSuiteTasks)) {
  for (let index = 0; index < count; index++, started += 10) suiteRows.push(...bottleRows(id, started));
}
test('all seven driven tasks from the six unchanged bottle cases remain independently covered', () => {
  const receipt = functions.checkAuditGeometry({audit: {poses: suiteRows}}, 'seven-tasks', {
    requiredActors: ['A', 'B', 'C'], requireRecovery: true, expectedTaskCounts: expectedSuiteTasks
  });
  assert.deepEqual(clone(receipt.taskCounts), expectedSuiteTasks);
  assert(suiteRows.length < 512, 'Normal evidence fits the actual producer ring capacity');
  return {fixtureSampleCount: suiteRows.length, taskCounts: clone(receipt.taskCounts)};
});
expectBottleFailure('one whole missing A task cannot be replaced by other A tasks',
  suiteRows.filter(row => !(row.id === 'A' && row.taskStartedTime === 1)),
  {requiredActors: ['A', 'B', 'C'], requireRecovery: true, expectedTaskCounts: expectedSuiteTasks},
  'entire expected bottle task is missing');

function windowRows() {
  const rows = [
    ['contact', 1, 0],
    ...Array.from({length: 6}, (_, i) => ['swing', 1.1 + i / 10, -(i + 1) * 5]),
    ['release', 1.7, -35], ['withdraw-start', 1.7, -35],
    ...Array.from({length: 8}, (_, i) => ['withdraw-transition', 1.8 + i / 10, -35]),
    ['withdraw-end', 2.6, -35], ['rest-start', 2.6, -35],
    ...Array.from({length: 6}, (_, i) => ['rest-transition', 2.7 + i / 10, -35]),
    ['rest', 3.25, -35]
  ];
  return rows.map(([stage, time, angleDeg]) => ({
    ...geometry('window-handle-01', 'bottle-01'),
    id: 'A', taskToken: 'synthetic-contract-only-window', stage, time, angleDeg,
    nativeGeometryMeasured: true, finite: true,
    boneLengthErrorM: 0, footSurfaceErrorM: 0, footWorldYM: {L: 0, R: 0},
    hingeConstraintCount: 1,
    gripConstraintCount: ['contact', 'swing'].includes(stage) ? 1 : 0,
    heldBy: ['contact', 'swing'].includes(stage) ? 'A' : null,
    reachClamped: false, contactErrorM: .001, maxHandlePenetrationM: .0045,
    restPoseErrorRad: stage === 'rest' ? 0 : .2
  }));
}
test('window arc and differently named recovery retain operated 4.5 mm contact', () => {
  const result = functions.auditWindowPoses({audit: {poses: windowRows()}},
    'synthetic-contract-only-window', 'positive-window', {fullSwing: true});
  assert.equal(result.accepted, true);
  return clone(result);
});
test('window rest-transition detects non-operated bottle collision', () => {
  const rows = windowRows(), witness = rows.find(row => row.stage === 'rest-transition');
  witness.solidMaxPenetrationM = .006;
  witness.solidByCylinder['bottle-01'].maxPenetrationM = .006;
  assert.throws(() => functions.auditWindowPoses({audit: {poses: rows}},
    'synthetic-contract-only-window', 'negative-window', {fullSwing: true}));
  const receipt = captured.get('window-poses-synthetic-contract-only-window.json');
  assert(receipt.violations.some(row => row.stage === 'rest-transition' && row.reason.includes('more than 3 mm')));
  return {rejected: true, violations: clone(receipt.violations)};
});

// Recompute the existing real browser surface-point witnesses with the exact
// inverse quaternion. This is evidence arithmetic, not a rerun of the scene.
function finiteCylinderSDF(point, shape) {
  const q = shape.quaternion, norm = Math.hypot(...q);
  const [qx, qy, qz, qw] = [-q[0] / norm, -q[1] / norm, -q[2] / norm, q[3] / norm];
  const [x, y, z] = point.map((value, i) => value - shape.position[i]);
  const tx = 2 * (qy * z - qz * y), ty = 2 * (qz * x - qx * z), tz = 2 * (qx * y - qy * x);
  const local = [x + qw * tx + qy * tz - qz * ty,
    y + qw * ty + qz * tx - qx * tz, z + qw * tz + qx * ty - qy * tx];
  const radial = Math.hypot(local[0], local[2]) - shape.radius;
  const axial = Math.abs(local[1]) - shape.height / 2;
  return Math.hypot(Math.max(radial, 0), Math.max(axial, 0)) + Math.min(Math.max(radial, axial), 0);
}
const failureFile = path.join(__dirname, 'bottle-window-handle-first-failure.json');
const failureBytes = fs.readFileSync(failureFile), failure = JSON.parse(failureBytes);
const realWitnesses = [];
for (const witness of failure.witnesses) {
  test('old Chromium ' + witness.actor + ' real surface anchor still fails the unchanged other-solid gate', () => {
    const poseBytes = fs.readFileSync(witness.poseFile), frameBytes = fs.readFileSync(witness.handleFrameFile);
    assert.equal(hash(poseBytes), witness.poseFileSHA256);
    assert.equal(hash(frameBytes), witness.handleFrameFileSHA256);
    const raw = JSON.parse(poseBytes).rows.find(row => row.id === witness.actor &&
      row.stage === witness.stage && row.time === witness.time);
    const frame = JSON.parse(frameBytes);
    assert.deepEqual(raw.fingerAnchors[witness.surfaceAnchorIndex], witness.pointWorld);
    assert.deepEqual(frame.windowRender.handleWorldPosition, witness.cylinder.position);
    assert.deepEqual(frame.windowRender.handleWorldQuaternion, witness.cylinder.quaternion);
    const exactSDFM = finiteCylinderSDF(witness.pointWorld, witness.cylinder);
    assert(exactSDFM < -.003);
    assert(Math.abs(exactSDFM - witness.signedDistanceM) < 1e-8,
      'Tiny rotation correction agrees with the recorded upright first witness');
    const g = geometry();
    g.solidByCylinder['window-handle-01'].maxPenetrationM = -exactSDFM;
    const violations = functions.otherSolidViolations(g, bottleOptions);
    assert(violations.some(reason => reason.includes('other cylinder by more than 3 mm')));
    const result = {
      actor: witness.actor, exactSDFM, penetrationM: -exactSDFM,
      anchorOnly: true, wholeSurfaceMaximumClaimed: false,
      sourceHead: failure.sourceHead, sourceArtifactsHashVerified: true,
      differenceFromUprightWitnessM: exactSDFM - witness.signedDistanceM,
      rejectedByStrengthenedVerifier: true
    };
    realWitnesses.push(result);
    return result;
  });
}

const world = read('LifeWorld.mjs'), windowSource = read('WindowInteraction.mjs');
const actor = read('ActorAdapter.mjs'), workbench = read('Workbench.mjs');
const staticFindings = [];
function sourceFinding(name, sourceName, source, strings, conclusion) {
  test(name, () => {
    const lines = strings.map(text => {
      const at = source.indexOf(text);
      assert(at >= 0, sourceName + ' required production link missing: ' + text);
      return {line: source.slice(0, at).split('\n').length, text};
    });
    staticFindings.push({name, source: sourceName, lines, conclusion});
    return {source: sourceName, lines};
  });
}
sourceFinding('bottle task provenance and bounded ring retain complete new diagnostics',
  'LifeWorld.mjs', world, [
    "a.started=this.time", "const solidCylinders=[this.window.handleCylinder()]",
    "operatedObjectId:'bottle-01',taskStartedTime:a.started,phase:a.phase,stage,time:this.time",
    "'solidByCylinder'", 'if(this.audit.poses.length>512)'
  ], 'Actual request time persists through result and recovery; no pose ring reset at station reset.');
sourceFinding('bottle actual exit records occur after drive or native update with short stage names',
  'LifeWorld.mjs', world, [
    "this.drive(a,mix(r.from,r.to,r.time/.9),0)", "r.time>=.9?'withdraw-end':'withdraw'",
    'const complete=a.actor.updateRecovery?.(dt)', "complete?'rest-end':'rest'",
    "this.samplePose(a,'withdraw-start')", "this.samplePose(a,'rest-start')",
    "this.samplePose(a,'withdraw');a.withdrawNextPoseAt=t+.1"
  ], 'Actual samples cover normal release, cancellation, failure and native rest; waiting-only tasks do not move or synthesize recovery.');
sourceFinding('window other cylinder reads actual bottle body and collider pose',
  'WindowInteraction.mjs', windowSource, [
    'body.pointToWorldFrame(body.shapeOffsets[i])',
    'body.quaternion.mult(body.shapeOrientations[i]).toArray()',
    'radius:s.radiusTop,height:s.height',
    'const operated=this.handleCylinder(),solidCylinders=this.otherCylinders()',
    'operatedObjectId:operated.id,solidCylinders', 'solidByCylinder:d.solidByCylinder'
  ], 'The operated handle remains the separate assisted-contact cylinder; the real bottle is the other cylinder.');
sourceFinding('native diagnostics sample the same weighted hand plus forearm against every box and cylinder',
  'ActorAdapter.mjs', actor, [
    'if(solidCount)for(const id of armSurfaceVertices[active.side])',
    'display(binding.sampleVertex(id,true)).applyMatrix4(root.matrixWorld)',
    'const d=cylinderDistance(p,shape).distance',
    'solidByCylinder[shape.id].sampleCount++',
    "geometry:{kind:'finite-local-Y-cylinder'", 'solidSampleCount:solid.sampleCount'
  ], 'Finite-cylinder SDF including caps is shared with existing operated-cylinder diagnostics; source descriptor and per-object report come from the same read.');
sourceFinding('both public diagnostic views pass actual non-operated cylinders',
  'Workbench.mjs', workbench, [
    'solidCylinders:[world.window.handleCylinder()]',
    'solidCylinders:world.window.otherCylinders()',
    "if(test.kind==='pick'&&['done','failed'].includes(a.phase)&&!a.retraction)",
    "if(test.kind==='contention'&&['done','failed'].includes(a.phase)&&['done','failed'].includes(b.phase)&&!a.retraction&&!b.retraction)",
    "if(test.kind==='cancel'&&this.action&&['done','failed'].includes(b.phase)&&!a.retraction&&!b.retraction)",
    "if(test.kind==='support'&&a.phase==='failed'&&!a.retraction)"
  ], 'The unchanged six bottle cases wait for completed withdrawal/rest before advancing, so the verifier can demand all seven distinct driven tasks.');

const files = ['verify-browser.cjs', 'ActorAdapter.mjs', 'NativeBinding.mjs', 'NativeRig.mjs',
  'LifeWorld.mjs', 'WindowInteraction.mjs', 'Workbench.mjs'];
const sourceHashes = Object.fromEntries(files.map(file => [file, hash(fs.readFileSync(path.join(root, file)))]));
const syntax = cp.spawnSync(process.execPath, ['--check', path.join(root, 'verify-browser.cjs')], {encoding: 'utf8'});
const historicalAuditHash = hash(fs.readFileSync(path.join(__dirname, 'audit-r02-suite-review.json')));
assert.equal(historicalAuditHash, '41e36591a2f1bcd3e8e1baec3f8a8f7a1dd4d7460a06d07e86766ec50acf9cb0');
const report = {
  schema: 'kaopu/npc-r02-cross-object-verifier-contract@1',
  createdAt: new Date().toISOString(),
  scope: 'Isolated pure verifier functions, static current-producer contract review and arithmetic on existing real Chromium anchors; synthetic fixtures are TEST_FIXTURE_ONLY, never scene acceptance.',
  previousVerifierSHA256: '706e97eadb868481245ade071aa51a4a4830c6f4c0c98aa477fcc214111a7b2b',
  verifierSHA256: sourceHashes['verify-browser.cjs'], sourceHashes,
  scriptSHA256: hash(fs.readFileSync(__filename)),
  originalFailure: {path: failureFile, sha256: hash(failureBytes), sourceHead: failure.sourceHead},
  preservedHistoricalAuditSHA256: historicalAuditHash,
  thresholds: {operatedCylinderM: .005, otherSolidM: .003, recoveryMaxSampleGapSeconds: .15},
  stageNames: {
    bottle: ['withdraw-start', 'withdraw', 'withdraw-end', 'rest-start', 'rest', 'rest-end'],
    window: ['withdraw-start', 'withdraw-transition', 'withdraw-end', 'rest-start', 'rest-transition', 'rest']
  },
  expectedBottleTaskCountsInUnchangedSixCases: expectedSuiteTasks,
  syntaxCheck: {exitCode: syntax.status, stderr: syntax.stderr},
  staticFindings, realWitnesses,
  testCount: tests.length, passedCount: tests.filter(row => row.passed).length, tests,
  passed: syntax.status === 0 && tests.every(row => row.passed),
  dynamicBrowserExecuted: false, productionSourceChangedByThisAudit: false,
  browserAcceptance: false, publicURLVerified: false, visualAcceptance: false,
  limits: [
    'This proves the verifier recognizes missing or intersecting other-cylinder evidence; it does not certify the corrected candidate runtime.',
    'Existing real witnesses are skin anchors, not the full hand maximum.',
    'Along-path geometry remains measured vertex SDF at actual recorded phases and roughly 0.1-second recovery intervals, not continuous triangle collision.',
    'Corrected complete native R07 rendering, screenshots, all twelve cases and final public URL still require actual browser evidence.'
  ]
};
const destination = path.join(__dirname, 'audit-cross-object-contract.json');
fs.writeFileSync(destination, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({path: destination, passed: report.passed, tests: report.testCount,
  passedCount: report.passedCount, verifierSHA256: report.verifierSHA256,
  failures: tests.filter(row => !row.passed)}, null, 2));
if (!report.passed) process.exitCode = 1;
