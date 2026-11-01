import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const root = path.resolve(process.argv[2]);
const read = (relative) => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
const canonical = await import(pathToFileURL(path.join(root, 'canonical/canonical-tlo.js')));
const current = await import(pathToFileURL(path.join(root, 'current/src/current-tlo.mjs')));
const adapter = await import(pathToFileURL(path.join(root, 'mother-rebuild-r01/native-time-adapter-r01/frame-authority.mjs')));

const subjectID = 'train88/A6/A4/drive_wheel_rear';
const wrongButKnownAxleToken = 'tender.tender.1';
const mutation = (saved) => {
  const copy = structuredClone(saved);
  const subject = copy.instances.find((item) => item.instanceID === subjectID);
  assert.ok(subject, 'subject wheel must exist');
  assert.equal(subject.Time.axleID, 'locomotive.driver.1');
  assert.ok(copy.instances.some((item) => item.Time?.axleID === wrongButKnownAxleToken),
    'wrong-assembly axle token must already be known in the exact subject');
  subject.Time.axleID = wrongButKnownAxleToken;
  return copy;
};

const compareEvaluations = (before, after) => {
  assert.deepEqual(after.profile, before.profile);
  assert.equal(after.instances.length, before.instances.length);
  let matrixComparisons = 0;
  let changedMatrixScalars = 0;
  for (let index = 0; index < before.instances.length; index++) {
    assert.equal(after.instances[index].instanceID, before.instances[index].instanceID);
    const a = before.instances[index].worldTransform;
    const b = after.instances[index].worldTransform;
    assert.equal(a === null, b === null);
    if (a === null) continue;
    for (let scalar = 0; scalar < 16; scalar++) {
      matrixComparisons++;
      if (a[scalar] !== b[scalar]) changedMatrixScalars++;
    }
  }
  return {matrixComparisons, changedMatrixScalars};
};

const currentContracts = read('current/canonical/contracts.json');
const currentSaved = read('current/canonical/train.A6-current.KaoPu.json');
const currentBaseline = canonical.createCanonicalRegistry(currentContracts).importJSON(JSON.stringify(currentSaved));
const currentMutant = canonical.createCanonicalRegistry(currentContracts).importJSON(JSON.stringify(mutation(currentSaved)));
assert.equal(currentMutant.getInstance(subjectID).Time.axleID, wrongButKnownAxleToken);

let currentMatrixComparisons = 0;
let currentChangedMatrixScalars = 0;
for (const Time of [0, 0.53, 2.4]) {
  const result = compareEvaluations(
    current.evaluateCurrent({registry: currentBaseline, Time}),
    current.evaluateCurrent({registry: currentMutant, Time})
  );
  currentMatrixComparisons += result.matrixComparisons;
  currentChangedMatrixScalars += result.changedMatrixScalars;
}
assert.equal(currentChangedMatrixScalars, 0);

const adapterBase = 'mother-rebuild-r01/lower-event-rebind-r01';
const adapterContracts = read(adapterBase + '/contracts.json');
const adapterSaved = read(adapterBase + '/train.A6-lower-event-rebind-r01.KaoPu.json');
const adapterBaselineRegistry = canonical.createCanonicalRegistry(adapterContracts).importJSON(JSON.stringify(adapterSaved));
const adapterMutantRegistry = canonical.createCanonicalRegistry(adapterContracts).importJSON(JSON.stringify(mutation(adapterSaved)));
const adapterBaseline = adapter.createFrameAuthority({registry: adapterBaselineRegistry, providerID: adapter.NATIVE_PROVIDER});
const adapterMutant = adapter.createFrameAuthority({registry: adapterMutantRegistry, providerID: adapter.NATIVE_PROVIDER});

let adapterMatrixComparisons = 0;
let adapterChangedMatrixScalars = 0;
let adapterFrameComparisons = 0;
for (const seconds of [0, 0.53, 1.4]) {
  const clock = {
    kind: adapter.NATIVE_CLOCK_KIND,
    reference: current.TIME,
    seconds,
    placementTime: current.EPOCH
  };
  for (const instance of adapterSaved.instances) {
    const before = adapterBaseline.resolve({instanceID: instance.instanceID, clock});
    const after = adapterMutant.resolve({instanceID: instance.instanceID, clock});
    assert.equal(before.status, after.status);
    assert.equal(before.worldTransform === null, after.worldTransform === null);
    adapterFrameComparisons++;
    if (before.worldTransform === null) continue;
    for (let scalar = 0; scalar < 16; scalar++) {
      adapterMatrixComparisons++;
      if (before.worldTransform[scalar] !== after.worldTransform[scalar]) adapterChangedMatrixScalars++;
    }
  }
}
assert.equal(adapterChangedMatrixScalars, 0);

console.log(JSON.stringify({
  schema: 'kaopu.candidate.a6-wheel-axle-relation-adapter-mutation-result/1',
  exactSubject: {
    libraryFileID: 'libfile_2cabe4dab46c8191b45f04e641c12ca2',
    observedVersion: 27,
    archiveSHA256: '4e6a823a900cc113c683a6d5c0aa769084d5cea0ed512a220a359b7e92b228a0'
  },
  mutation: {
    instanceID: subjectID,
    field: 'Time.axleID',
    from: 'locomotive.driver.1',
    to: wrongButKnownAxleToken,
    wrongAssembly: true
  },
  currentEvaluator: {
    importAccepted: true,
    evaluationAccepted: true,
    sharedTimesChecked: 3,
    matrixComparisons: currentMatrixComparisons,
    changedMatrixScalars: currentChangedMatrixScalars
  },
  newNativeFrameAuthorityAdapter: {
    module: 'mother-rebuild-r01/native-time-adapter-r01/frame-authority.mjs',
    importAccepted: true,
    frameQueriesAccepted: true,
    sharedTimesChecked: 3,
    frameComparisons: adapterFrameComparisons,
    matrixComparisons: adapterMatrixComparisons,
    changedMatrixScalars: adapterChangedMatrixScalars
  },
  decision: 'HOLD_AXLE_RELATION_METADATA_NOT_RUNTIME_OR_VERIFIER_BOUND',
  limitation: 'This proves that neither the current evaluator nor the new v27 native frame-authority adapter consumes Time.axleID as a fail-closed axle/driver relationship. It does not reject their geometry, time equations, or exclusive frame-authority work.'
}, null, 2));
