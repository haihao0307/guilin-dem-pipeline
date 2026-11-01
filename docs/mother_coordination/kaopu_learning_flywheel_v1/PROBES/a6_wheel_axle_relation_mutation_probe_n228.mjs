import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const root = path.resolve(process.argv[2]);
const read = (relative) => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
const canonical = await import(pathToFileURL(path.join(root, 'canonical/canonical-tlo.js')));
const current = await import(pathToFileURL(path.join(root, 'current/src/current-tlo.mjs')));

const contracts = read('current/canonical/contracts.json');
const saved = read('current/canonical/train.A6-current.KaoPu.json');
const subjectID = 'train88/A6/A4/drive_wheel_rear';
const wrongButKnownAxleToken = 'tender.tender.1';

const baseline = canonical.createCanonicalRegistry(contracts).importJSON(JSON.stringify(saved));
const mutantJSON = structuredClone(saved);
const mutantInstance = mutantJSON.instances.find((item) => item.instanceID === subjectID);
assert.ok(mutantInstance, 'subject wheel must exist');
const originalAxleID = mutantInstance.Time.axleID;
assert.equal(originalAxleID, 'locomotive.driver.1');
mutantInstance.Time.axleID = wrongButKnownAxleToken;

const mutant = canonical.createCanonicalRegistry(contracts).importJSON(JSON.stringify(mutantJSON));
assert.equal(mutant.getInstance(subjectID).Time.axleID, wrongButKnownAxleToken);

let matrixComparisons = 0;
let changedMatrixScalars = 0;
for (const Time of [0, 0.53, 2.4]) {
  const before = current.evaluateCurrent({registry: baseline, Time});
  const after = current.evaluateCurrent({registry: mutant, Time});
  assert.deepEqual(after.profile, before.profile);
  assert.equal(after.instances.length, before.instances.length);
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
}

assert.equal(changedMatrixScalars, 0);
console.log(JSON.stringify({
  schema: 'kaopu.candidate.a6-wheel-axle-relation-mutation-result/1',
  exactSubject: {
    libraryFileID: 'libfile_2cabe4dab46c8191b45f04e641c12ca2',
    observedVersion: 20,
    archiveSHA256: '8fb6cedbdf48416902b60b9cb8633911654043435e16b085177cb12fcead658e'
  },
  mutation: {
    instanceID: subjectID,
    field: 'Time.axleID',
    from: originalAxleID,
    to: wrongButKnownAxleToken,
    wrongAssembly: true
  },
  importAccepted: true,
  evaluationAccepted: true,
  sharedTimesChecked: 3,
  matrixComparisons,
  changedMatrixScalars,
  decision: 'HOLD_AXLE_RELATION_METADATA_NOT_RUNTIME_OR_VERIFIER_BOUND',
  limitation: 'This proves the current canonical import/evaluator does not use Time.axleID to validate or drive frames. It does not claim the geometry/time equations are wrong or that a physical axle model exists.'
}, null, 2));
