/**
 * Real-native prepared-seed redress and failed-add transaction regression.
 *
 * node tests/native-redress-regression.mjs --source <project> \
 *   --input <fresh-native-world-input.json> --output <new-evidence-directory> \
 *   --expected-source <commit-or-candidate-label>
 *
 * Original captured typed bytes are required. No numeric reconstruction,
 * fixture body, reduced garment, relaxed gate, or changed physical setting.
 * Three short real-step/remove/real-step/add cycles test the explicit global
 * restart boundary. The separate recorded long reentry replay remains needed.
 *
 * TEST_ONLY fault injection lives on one test instance: the actual initializing
 * settle must finish and converge before the wrapper throws. No source text is
 * rewritten and no production failure switch or public API is installed.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {gzipSync, gunzipSync} from 'node:zlib';
import {fileURLToPath, pathToFileURL} from 'node:url';

const scriptPath = fileURLToPath(import.meta.url), scriptDir = path.dirname(scriptPath);
const args = {source: path.resolve(scriptDir, '..'), input: null, output: null, expectedSource: null};
const help = `Real-native redress regression (Node 22+, no browser required)\n\n` +
  `--source <project>  project with src/ and reference/mp05-studio-r10/\n` +
  `--input <file>      complete fresh original typed capture (.json or .json.gz)\n` +
  `--output <dir>      new evidence directory (existing summary is not overwritten)\n` +
  `--expected-source <commit-or-label>  caller provenance claim; actual source bytes are hashed\n` +
  `--help             show this text\n`;
for (let i = 2; i < process.argv.length; i++) {
  const key = process.argv[i];
  if (key === '--help') {process.stdout.write(help); process.exit(0);}
  if (!['--source', '--input', '--output', '--expected-source'].includes(key) || !process.argv[i+1]) throw Error('Unknown or incomplete argument: ' + key);
  args[key === '--expected-source' ? 'expectedSource' : key.slice(2)] = process.argv[++i];
}
assert.ok(args.input && args.output, '--input and --output are required; use --help');
for (const key of ['source', 'input', 'output']) args[key] = path.resolve(args[key]);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const rawBytes = view => Buffer.from(view.buffer, view.byteOffset, view.byteLength);
const types = {Float32Array, Float64Array, Int32Array, Uint32Array, Int16Array, Uint16Array, Int8Array, Uint8Array, Uint8ClampedArray};
const artifactBytes = await fs.readFile(args.input);
const inputBytes = artifactBytes[0] === 0x1f && artifactBytes[1] === 0x8b ? gunzipSync(artifactBytes) : artifactBytes;

function restoreInput() {
  const input = JSON.parse(inputBytes);
  assert.equal(input.type, 'init');
  assert.ok(Array.isArray(input.typedArrays) && input.typedArrays.length, 'Original typed capture required; numeric reconstruction is not accepted');
  assert.equal(input.observer?.originalMethodInvoked, true);
  assert.equal(input.observer?.originalMethodThrew, false);
  assert.equal(input.observer?.inputMutated, false);
  assert.equal(input.identity?.workerBodyMatchesCurrentNativeModel, true);
  assert.equal(input.identity?.workerFacesMatchCurrentNativeModel, true);
  assert.equal(input.identity?.frozenFixtureUsedAsCurrentBody, false);
  assert.equal(input.nativeProbe?.sameNativeCanvasInStage, true);
  const restored = new Set();
  for (const entry of input.typedArrays) {
    const T = types[entry.type], bytes = Buffer.from(entry.base64 || '', 'base64');
    assert.ok(T && bytes.length === entry.byteLength && bytes.length === entry.length*T.BYTES_PER_ELEMENT, 'Invalid typed capture: ' + entry.path);
    const keys = entry.path.split('/').slice(1).map(key => key.replace(/~1/g, '/').replace(/~0/g, '~'));
    assert.ok(entry.path.startsWith('/') && keys.length >= 2 && !keys.some(key => ['__proto__', 'prototype', 'constructor'].includes(key)), 'Unsafe typed path');
    assert.ok(!restored.has(entry.path), 'Duplicate typed path');
    let parent = input;
    for (const key of keys.slice(0, -1)) {assert.ok(parent && Object.hasOwn(parent, key), 'Missing typed path'); parent = parent[key];}
    assert.ok(Object.hasOwn(parent, keys.at(-1)), 'Missing typed target');
    parent[keys.at(-1)] = new T(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
    restored.add(entry.path);
  }
  assert.deepEqual(input.rows?.map(row => row.id), ['pants', 'inner', 'outer']);
  for (const required of ['/body/positions', '/body/faces', '/nativeProbe/positions', '/nativeProbe/faces', ...input.rows.map((_, i) => '/rows/'+i+'/positions')]) assert.ok(restored.has(required), 'Original bytes missing for ' + required);
  assert.ok(input.body.positions instanceof Float32Array && input.body.faces instanceof Uint32Array);
  assert.ok(input.body.positions.length > 3000 && input.body.faces.length > 3000, 'Full current-native body required');
  assert.equal(sha(rawBytes(input.body.positions)), input.identity.bodyYUpSHA256);
  const native = input.nativeProbe.positions, expected = new Float32Array(native.length);
  for (let i = 0; i < native.length; i += 3) {expected[i] = native[i]; expected[i+1] = native[i+2]; expected[i+2] = -native[i+1];}
  assert.ok(rawBytes(expected).equals(rawBytes(input.body.positions)), 'Native Y-up body byte identity');
  assert.ok(rawBytes(input.body.faces).equals(rawBytes(input.nativeProbe.faces)), 'Native body topology byte identity');
  assert.ok(input.body.positions.every(Number.isFinite));
  for (const row of input.rows) {
    assert.ok(ArrayBuffer.isView(row.positions) && row.positions.every(Number.isFinite));
    assert.equal(row.positions.length, row.packet.spec.panels.reduce((sum, panel) => sum+panel.uvMm.length*3, 0));
    assert.ok(Number.isFinite(row.thickness) && row.thickness > 0);
  }
  assert.equal(input.options.contactEnabled, true, 'Original full cloth contact gate must remain enabled');
  return input;
}

// Exact typed bytes and scalar -0 are retained in detached test records.
function canonical(value, omit = new Set()) {
  if (value === undefined) return {$undefined: true};
  if (typeof value === 'number' && (!Number.isFinite(value) || Object.is(value, -0))) return {$number: Object.is(value, -0) ? '-0' : String(value)};
  if (ArrayBuffer.isView(value)) return {$typed: value.constructor.name, length: value.length, base64: rawBytes(value).toString('base64')};
  if (value instanceof Map) return {$map: [...value].map(([k,v]) => [canonical(k, omit), canonical(v, omit)])};
  if (value instanceof Set) return {$set: [...value].map(v => canonical(v, omit))};
  if (Array.isArray(value)) return value.map(v => canonical(v, omit));
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).filter(k => !omit.has(k)).sort().map(k => [k, canonical(value[k], omit)]));
  assert.notEqual(typeof value, 'function', 'Unexpected function in physical state');
  return value;
}
const digest = value => sha(JSON.stringify(value));
function equalRecord(actual, expected, label) {
  const actualHash = digest(actual), expectedHash = digest(expected);
  assert.equal(actualHash, expectedHash, label + ' exact record hash');
  // Hash equality alone is not the comparison: compare exact detached values.
  assert.deepStrictEqual(actual, expected, label + ' exact detached values');
  return actualHash;
}

const memoryFields = new Set(['wasmReservedBytes', 'wasmReusedBytes', 'wasmFreeBlockBytes']);
const freshOmissions = new Set([...memoryFields, 'timings', 'solverMS', 'stageTimingsMS', 'settlingMS', 'measurementMS', 'elapsedMS', 'creationMS', 'initializationMS', 'work']);
const reportKeys = ['lastDT', 'lastContact', 'lastSettling', 'lastBodyEnvelope', 'initializationReport', 'lastWork', 'totalCorrections', 'solveMS', 'timings', 'drag'];

function invariants(row) {
  return canonical({id: row.id, thickness: row.thickness, physicalMassKG: row.physicalMassKG,
    family: row.s.family, role: row.s.role, w: row.s.w, mass: row.s.mass, faces: row.s.faces,
    map: row.s.map, pins: row.s.pins, settings: row.s.settings,
    preparedSeed: row.preparedSeed,
    paperEdges: row.s.edges.map(({lambda, ...rest}) => rest),
    paperBends: row.s.bends.map(({lambda, ...rest}) => rest),
    renderTopology: row.outputIndices, sourcePacket: row.source.packet});
}
function physicalRow(row) {
  return {id: row.id, enabled: row.enabled, thickness: row.thickness, physicalMassKG: row.physicalMassKG,
    p: row.s.p, v: row.s.v, old: row.s.old, saved: row.saved, initial: row.s.initial,
    w: row.s.w, mass: row.s.mass, faces: row.s.faces, map: row.s.map, pins: row.s.pins,
    edgeState: row.edges.view, bendState: row.bends.view,
    solverTime: row.s.time, solverSteps: row.s.steps, settings: row.s.settings,
    output: row.s.output, normals: row.s.normals, outputIndices: row.outputIndices};
}
function contactHistory(world) {
  const checkpoint = world.contacts.checkpoint();
  assert.equal(checkpoint.owner, world.contacts);
  const participant = g => ({id: g.id, count: g.count, thickness: g.thickness,
    positions: g.positions, previous: g.previous, triangles: g.triangles, inverseMass: g.inverseMass});
  return canonical({history: checkpoint.history, sides: checkpoint.sides, frameSides: checkpoint.frameSides,
    edgeReferences: checkpoint.edgeReferences,
    pending: [...checkpoint.pending].map(([key, {a,b,...entry}]) => [key, {...entry, a: participant(a), b: participant(b)}])});
}
function physicalState(world, fresh = false) {
  const omit = fresh ? freshOmissions : memoryFields;
  return canonical({rows: world.rows.map(physicalRow), time: world.time, steps: world.steps,
    options: world.options, execution: world.execution,
    reports: Object.fromEntries(reportKeys.map(key => [key, world[key]])),
    renderSnapshot: world.snapshot()}, omit);
}
function allocation(world) {
  const audit = world.audit();
  return Object.fromEntries([...memoryFields].map(key => [key, audit[key]]));
}

await fs.mkdir(args.output, {recursive: true});
const summaryPath = path.join(args.output, 'summary.json');
try {await fs.access(summaryPath); throw Error('Refusing to overwrite existing summary: ' + summaryPath);} catch (error) {if (error.code !== 'ENOENT') throw error;}
const input = restoreInput();
const summary = {schema: 'kaopu-native-redress-regression@1', passed: false,
  sourceDirectory: args.source, expectedSource: args.expectedSource,
  expectedSourceMeaning: 'Caller-supplied provenance claim; the executed detached source bytes are independently bound by sourceSHA256. A scratch candidate is not asserted to equal a Git commit.',
  sourceSHA256: {}, testSHA256: {}, inputPath: args.input,
  inputArtifactSHA256: sha(artifactBytes), inputJSONSHA256: sha(inputBytes),
  inputMode: 'original-typed-array-byte-capture', inputIdentity: input.identity,
  capturedSourceCommit: input.source?.checkoutCommit,
  options: input.options, execution: input.execution ?? {contactDemand: true},
  reentrySemantics: 'GLOBAL_REDRESS_RESTART', requestedCycles: 3, completedCycles: 0,
  realSteps: 0, cycles: [], audits: [], failureInjection: null,
  criteria: {maxEdgeStretch: 1.45, seamGapMM: .01, clothResidualM: .0005,
    bodyInsideVertices: 0, bodyHalfThicknessOverlapMM: .001, bodyEnvelopeHalfThicknessOverlapM: .000001,
    independentBodyHalfThicknessOverlapMM: .001, allInputTrianglesCovered: true,
    reportedIntersections: 0, degenerateTriangles: 0},
  comparisonPolicy: {freshInitialExcludedFields: [...freshOmissions], rollbackExcludedFields: [...memoryFields],
    physicalArraysAndConstraintLambdas: 'exact original bytes',
    rollbackReports: 'all values including previously recorded timing; only WASM memory accounting omitted from snapshot comparison',
    memoryAllocation: 'Actual allocation/free/reuse counters are recorded before and after; no resource-no-allocation claim.'},
  scope: 'Real native physical World regression. Three short removal/re-add cycles; not the long recorded failed action sequence, browser rendering, dynamic-body, self-collision, continuous-collision or individual-yarn certification.'};
const save = () => fs.writeFile(summaryPath, JSON.stringify(summary, null, 2)+'\n');
const log = async value => {await fs.appendFile(path.join(args.output, 'events.ndjson'), JSON.stringify(value)+'\n'); console.log(JSON.stringify(value)); await save();};
const saveState = async (name, value) => {const bytes = gzipSync(JSON.stringify(value)); const file = path.join(args.output, name+'.json.gz'); await fs.writeFile(file, bytes); return {file, bytes: bytes.length, sha256: sha(bytes)};};
const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'native-redress-regression-'));
let world, fresh, lastPhase = 'prepare-source';
try {
  const candidates = [scriptDir, path.join(args.source, 'tests'), path.resolve(scriptDir, '../repo/experiments/tailor-layering-r03/tests')];
  let auditDir;
  for (const candidate of candidates) {try {await fs.access(path.join(candidate, 'mesh-intersections.mjs')); await fs.access(path.join(candidate, 'body-envelope-audit.mjs')); auditDir = candidate; break;} catch {}}
  assert.ok(auditDir, 'Independent existing mesh/body-envelope audit modules are required');
  const {auditMeshIntersections} = await import(pathToFileURL(path.join(auditDir, 'mesh-intersections.mjs')));
  const {createBodyEnvelopeAudit} = await import(pathToFileURL(path.join(auditDir, 'body-envelope-audit.mjs')));
  for (const file of ['mesh-intersections.mjs', 'body-envelope-audit.mjs']) summary.testSHA256[file] = sha(await fs.readFile(path.join(auditDir, file)));
  summary.testSHA256['native-redress-regression.mjs'] = sha(await fs.readFile(scriptPath));
  for (const file of (await fs.readdir(path.join(args.source, 'src'))).filter(name => name.endsWith('.mjs')).sort()) {
    const bytes = await fs.readFile(path.join(args.source, 'src', file));
    summary.sourceSHA256['src/'+file] = sha(bytes); await fs.writeFile(path.join(temp, file), bytes);
  }
  const upstream = path.join(args.source, 'reference/mp05-studio-r10');
  await fs.symlink(upstream, path.join(temp, 'upstream'), 'dir');
  const kernel = await fs.readFile(path.join(upstream, 'cloth-kernel.wasm'));
  for (const file of ['cloth-kernel.wasm', 'material-physics.mjs', 'mesh-contact.mjs']) summary.sourceSHA256['reference/mp05-studio-r10/'+file] = sha(await fs.readFile(path.join(upstream, file)));
  const {LayerWorld} = await import(pathToFileURL(path.join(temp, 'layer-world.mjs')));
  const bodyAuditor = createBodyEnvelopeAudit(input.body);
  const makeWorld = async () => {const original = restoreInput(); return LayerWorld.create(original.body, original.rows, kernel, original.options, original.execution);};
  lastPhase = 'create-live-and-independent-fresh-world';
  world = await makeWorld(); fresh = await makeWorld();
  const originalOptions = canonical(world.options), originalExecution = canonical(world.execution);
  const immutable = new Map(fresh.rows.map(row => [row.id, invariants(row)]));
  const freshState = physicalState(fresh, true), freshHistory = contactHistory(fresh);
  summary.freshInitialState = await saveState('fresh-full-world-initial', freshState);
  summary.freshInitialState.digest = digest(freshState);
  equalRecord(physicalState(world, true), freshState, 'Two independently created fresh worlds');
  const checkInvariants = label => {
    equalRecord(canonical(world.options), originalOptions, label+'/options');
    equalRecord(canonical(world.execution), originalExecution, label+'/execution');
    for (const row of world.rows) equalRecord(invariants(row), immutable.get(row.id), label+'/'+row.id+'/original-material-mass-paper-topology-thickness');
  };
  const inspect = async label => {
    const audit = world.audit({bodySamples: true}), surfaces = world.surfaces();
    const contact = world.measureContacts(surfaces), bodyEnvelope = world.measureBodyEnvelope();
    const geometry = auditMeshIntersections([...world.rows.map(a => ({id: a.id, positions: a.s.p, indices: a.s.faces})),
      {id: '__actual_native_body__', positions: input.body.positions, indices: input.body.faces}], {sampleLimit: 8});
    const independentBodyEnvelope = bodyAuditor.measure(surfaces, {sampleLimit: 8});
    const record = {label, step: world.steps, seconds: world.time, garmentIDs: world.rows.map(a => a.id),
      maxEdgeStretch: audit.maxEdgeStretch, seamGapMM: audit.seamGapMM, contactResidualM: contact.residualMaxPenetration,
      bodySampledVertices: audit.bodySampledVertices, bodyInsideVertices: audit.bodyInsideVertices,
      bodyHalfThicknessOverlapMM: audit.bodyThicknessOverlapMM,
      bodyEnvelopeHalfThicknessOverlapM: bodyEnvelope.maxHalfThicknessOverlapM,
      independentBodyHalfThicknessOverlapMM: independentBodyEnvelope.maxHalfThicknessOverlapMM,
      reportedIntersections: geometry.hasReportedIntersections, degenerateTriangles: geometry.degenerateTriangles,
      allInputTrianglesCovered: geometry.scope.allNondegenerateInputTrianglePairsCovered};
    const evidence = {audit, contact, bodyEnvelope, geometry, independentBodyEnvelope};
    record.evidence = await saveState(label+'-audit', canonical(evidence));
    summary.audits.push(record); await save();
    for (const row of world.rows) for (const key of ['p','v','old','initial']) assert.ok(row.s[key].every(Number.isFinite), label+'/'+row.id+'/'+key+' finite');
    assert.ok(Number.isFinite(audit.maxEdgeStretch) && audit.maxEdgeStretch <= 1.45, label+'/stretch');
    assert.ok(Number.isFinite(audit.seamGapMM) && audit.seamGapMM <= .01, label+'/seam');
    assert.ok(Number.isFinite(contact.residualMaxPenetration) && contact.residualMaxPenetration <= .0005, label+'/cloth residual');
    assert.equal(audit.bodySampledVertices, world.rows.reduce((sum, row) => sum+row.s.count, 0), label+'/full body vertex count');
    assert.equal(audit.bodyInsideVertices, 0, label+'/inside body');
    assert.ok(Number.isFinite(audit.bodyThicknessOverlapMM) && audit.bodyThicknessOverlapMM <= .001, label+'/body vertex half thickness');
    assert.ok(Number.isFinite(bodyEnvelope.maxHalfThicknessOverlapM) && bodyEnvelope.maxHalfThicknessOverlapM <= .000001, label+'/production body triangle envelope');
    assert.ok(Number.isFinite(independentBodyEnvelope.maxHalfThicknessOverlapMM) && independentBodyEnvelope.maxHalfThicknessOverlapMM <= .001, label+'/independent full body triangle half thickness');
    assert.equal(independentBodyEnvelope.degenerateTriangles, 0);
    assert.equal(independentBodyEnvelope.scope.completeForInputTriangles, true);
    assert.equal(geometry.hasReportedIntersections, false);
    assert.equal(geometry.degenerateTriangles, 0);
    assert.equal(geometry.scope.allNondegenerateInputTrianglePairsCovered, true);
    assert.equal(geometry.scope.completeForInputTriangles, true);
    assert.equal(audit.reentrySemantics, 'GLOBAL_REDRESS_RESTART');
    checkInvariants(label);
    return record;
  };
  const advance = async (count, label) => {
    const movement = [];
    for (let step = 1; step <= count; step++) {
      const before = new Map(world.rows.map(row => [row.id, row.s.p.slice()])), oldStep = world.steps, oldTime = world.time;
      world.step(1/120); summary.realSteps++;
      assert.equal(world.steps, oldStep+1); assert.ok(Math.abs(world.time-oldTime-1/120) < 1e-12);
      for (const row of world.rows) {
        assert.ok(!rawBytes(row.s.p).equals(rawBytes(before.get(row.id))), label+'/'+row.id+' must actually deform');
        movement.push({step: world.steps, id: row.id, beforeSHA256: sha(rawBytes(before.get(row.id))), afterSHA256: sha(rawBytes(row.s.p))});
      }
      await inspect(label+'-step-'+step);
    }
    return movement;
  };
  await inspect('initial'); await log({phase: 'initial-ready', freshInitialDigest: digest(freshState), sourceWorldSHA256: summary.sourceSHA256['src/layer-world.mjs']});
  for (let cycle = 1; cycle <= 3; cycle++) {
    lastPhase = 'cycle-'+cycle;
    const beforeRemovalSteps = cycle === 2 ? 2 : 1, removedSteps = cycle === 2 ? 1 : 2;
    const progressBefore = await advance(beforeRemovalSteps, 'cycle-'+cycle+'-full-deformation');
    const beforeRemove = {time: world.time, steps: world.steps};
    world.remove('outer'); assert.deepEqual(world.rows.map(row => row.id), ['pants','inner']);
    assert.equal(world.time, beforeRemove.time); assert.equal(world.steps, beforeRemove.steps);
    const progressRemoved = await advance(removedSteps, 'cycle-'+cycle+'-removed');
    const allocationBefore = allocation(world);
    world.add(restoreInput().rows.find(row => row.id === 'outer'));
    assert.deepEqual(world.rows.map(row => row.id), ['pants','inner','outer']);
    assert.equal(world.time, 0); assert.equal(world.steps, 0);
    const afterRedress = physicalState(world, true);
    const stateDigest = equalRecord(afterRedress, freshState, 'cycle-'+cycle+'/global redress equals fresh full-world initial');
    const historyDigest = equalRecord(contactHistory(world), freshHistory, 'cycle-'+cycle+'/fresh contact history');
    checkInvariants('cycle-'+cycle+'/redress');
    const redressAudit = await inspect('cycle-'+cycle+'-redressed');
    const postRedressMovement = await advance(1, 'cycle-'+cycle+'-post-redress');
    const result = {cycle, beforeRemovalSteps, removedSteps, progressBefore, progressRemoved,
      freshInitialExactStateDigest: stateDigest, freshContactHistoryDigest: historyDigest,
      exactPhysicalArraysAndLambdas: true, exactRenderPositionsNormalsTopology: true,
      originalRestMassInverseMassTopologyMaterialThicknessUnchanged: true,
      redressAudit: redressAudit.label, postRedressMovement,
      allocationBefore, allocationAfter: allocation(world)};
    summary.cycles.push(result); summary.completedCycles = cycle;
    await log({phase: 'cycle-passed', cycle, realSteps: summary.realSteps, freshInitialExactStateDigest: stateDigest});
  }
  lastPhase = 'test-only-failed-add-transaction';
  world.remove('outer');
  await advance(1, 'failure-survivor-deformation');
  assert.ok(world.contacts.checkpoint().history.size > 0, 'Failure test needs actual populated physical contact history');
  const beforeFailure = physicalState(world), historyBefore = contactHistory(world), optionsBefore = canonical(world.options);
  const survivorObjects = [...world.rows], allocationBefore = allocation(world);
  const beforeEvidence = await saveState('test-only-failed-add-before', {state: beforeFailure, history: historyBefore});
  let injected = false, reachedConvergedRealSettle = false, injectedResult = null, failure;
  const ownSettle = Object.getOwnPropertyDescriptor(world, 'settle'), actualSettle = world.settle;
  world.settle = function (...settings) {
    const result = actualSettle.apply(this, settings);
    if (settings[0]?.initializing === true) {
      assert.equal(result.converged, true, 'TEST_ONLY injection must happen after genuinely converged initialization');
      reachedConvergedRealSettle = true; injected = true; injectedResult = canonical(result);
      throw Error('TEST_ONLY_AFTER_REAL_CONVERGED_INITIALIZING_SETTLE');
    }
    return result;
  };
  try {world.add(restoreInput().rows.find(row => row.id === 'outer'));} catch (error) {failure = error;}
  finally {if (ownSettle) Object.defineProperty(world, 'settle', ownSettle); else delete world.settle;}
  assert.ok(injected && reachedConvergedRealSettle && failure, 'Expected TEST_ONLY post-settle failure was not observed');
  assert.match(failure.message, /TEST_ONLY_AFTER_REAL_CONVERGED_INITIALIZING_SETTLE/);
  assert.equal(world.rows.length, survivorObjects.length, 'Failed add must not retain provisional garment');
  world.rows.forEach((row, i) => assert.equal(row, survivorObjects[i], 'Survivor identity retained'));
  const stateAfterFailure = physicalState(world), historyAfterFailure = contactHistory(world);
  equalRecord(stateAfterFailure, beforeFailure, 'Failed add restores physical arrays, lambdas, full reports and clocks');
  equalRecord(historyAfterFailure, historyBefore, 'Failed add restores full contact history');
  equalRecord(canonical(world.options), optionsBefore, 'Failed add preserves options');
  checkInvariants('failed-add-rollback');
  // Actual app.add() cleanup sends remove after Worker.add() already rolled back.
  world.remove('outer');
  const afterCleanup = physicalState(world), historyAfterCleanup = contactHistory(world);
  equalRecord(afterCleanup, beforeFailure, 'Absent-ID UI cleanup preserves full physical state');
  equalRecord(historyAfterCleanup, historyBefore, 'Absent-ID UI cleanup preserves contact history');
  const afterEvidence = await saveState('test-only-failed-add-after-ui-cleanup', {state: afterCleanup, history: historyAfterCleanup});
  summary.failureInjection = {testOnly: true, productionCodeChanged: false, reachedConvergedRealSettle,
    message: failure.message, survivorIDs: world.rows.map(row => row.id),
    restoredPhysicalStateDigest: digest(afterCleanup), restoredContactHistoryDigest: digest(historyAfterCleanup),
    reportsComparedWithOriginalTimings: true, constraintLambdasCompared: true,
    failedGarmentAbsent: true, uiAbsentRemoveNoOpVerified: true,
    beforeEvidence, afterEvidence, convergedPrethrowEvidence: await saveState('test-only-converged-prethrow', injectedResult),
    allocationBefore, allocationAfter: allocation(world)};
  await inspect('failed-add-restored');
  await advance(1, 'failed-add-next-real-step');
  await log({phase: 'failure-transaction-and-ui-cleanup-passed', realSteps: summary.realSteps,
    restoredPhysicalStateDigest: digest(afterCleanup), restoredContactHistoryDigest: digest(historyAfterCleanup)});
  for (const [file, expected] of Object.entries(summary.sourceSHA256)) assert.equal(sha(await fs.readFile(path.join(args.source, file))), expected, 'Source changed while detached test ran: '+file);
  summary.sourceBytesStillMatchAtEnd = true;
  summary.passed = summary.completedCycles === 3 && summary.failureInjection.uiAbsentRemoveNoOpVerified;
  lastPhase = 'complete'; await save();
  console.log(JSON.stringify({passed: summary.passed, completedCycles: summary.completedCycles, realSteps: summary.realSteps,
    summary: summaryPath, summarySHA256: sha(await fs.readFile(summaryPath))}));
} catch (error) {
  summary.error = {phase: lastPhase, message: error.message, stack: error.stack};
  if (world) {try {summary.failureState = await saveState('failure-state', {state: physicalState(world), history: contactHistory(world)});} catch (captureError) {summary.failureCaptureError = captureError.message;}}
  await save(); console.error(JSON.stringify({passed: false, phase: lastPhase, error: error.message, summary: summaryPath})); process.exitCode = 1;
} finally {await fs.rm(temp, {recursive: true, force: true});}
