'use strict';
const assert=require('node:assert/strict');
const crypto=require('node:crypto');

// Pure driver-side projection. The caller supplies bytes read from the existing
// evidence files; this module never writes, truncates, or replaces those files.
const FILES=new Set(['suite.json','full-evidence-export.json','continuous-ui.json']);
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const clone=value=>JSON.parse(JSON.stringify(value));
function evidenceReference(file,bytes){
  assert(FILES.has(file),'A known standalone evidence filename is required');
  assert(Buffer.isBuffer(bytes)&&bytes.length>0,file+': actual nonempty file bytes are required');
  return {file,bytes:bytes.length,sha256:sha(bytes)};
}
function validateEvidenceReference(reference,bytes,expectedFile){
  const actual=evidenceReference(expectedFile,bytes);
  assert(reference&&typeof reference==='object'&&!Array.isArray(reference),expectedFile+': evidence reference is required');
  for(const key of ['file','bytes','sha256'])
    assert.equal(reference[key],actual[key],expectedFile+': evidence reference '+key+' mismatch');
  return true;
}
function readArtifact(file,bytes,reference=evidenceReference(file,bytes)){
  validateEvidenceReference(reference,bytes,file);
  let value;
  try {value=JSON.parse(bytes.toString('utf8'));}
  catch(error){throw new Error(file+': evidence must be valid JSON',{cause:error});}
  return {value,reference:{file:reference.file,bytes:reference.bytes,sha256:reference.sha256}};
}
function sameJSON(actual,expected,label){
  // Compare the complete stored JSON value, including every large measurement
  // array. JSON's -0/undefined transport rules match the existing file writer.
  // Digest comparison keeps a mismatch from dumping megabytes into CI logs.
  assert.equal(sha(JSON.stringify(actual)),sha(JSON.stringify(expected)),label);
}
function summarizeSuite({verification,summary,suiteBytes,fullBytes,suiteReference,fullReference}){
  const suite=readArtifact('suite.json',suiteBytes,suiteReference);
  const full=readArtifact('full-evidence-export.json',fullBytes,fullReference);
  sameJSON(suite.value,verification,'suite.json must retain the complete checked verification');
  sameJSON(full.value.verification,verification,'Full export must retain the same complete verification');
  assert.equal(verification.completed,true,'Only a completed suite can receive a success summary');
  assert.equal(verification.passed,true,'Only a passing suite can receive a success summary');
  assert(Array.isArray(verification.tests)&&verification.tests.length>0,'Suite cases are required');
  const tests=verification.tests.map(({name,kind,pass})=>({name,kind,pass}));
  assert(tests.every(test=>test.pass===true),'A suite summary cannot hide a failed case');
  for(const key of ['runId','completed','passed','sceneEpochAtStart','startedAt','finishedAt'])
    assert.equal(summary[key],verification[key],'Suite summary '+key+' must match the retained run');
  sameJSON(summary.tests,tests,'Suite summary must preserve every case name, kind, result and order');
  assert.equal(summary.finished,tests.length,'Suite summary finished count must match its cases');
  assert.equal(summary.passedCount,tests.length,'Suite summary passed count must match its cases');
  assert.equal(summary.total,tests.length,'A completed suite must retain all planned cases');
  return clone({schema:'kaopu/r04-suite-evidence-summary@1',
    runId:verification.runId,sceneEpochAtStart:verification.sceneEpochAtStart,
    startedAt:verification.startedAt,finishedAt:verification.finishedAt,
    completed:verification.completed,passed:verification.passed,
    testCount:tests.length,passedCount:tests.filter(test=>test.pass).length,tests,
    evidence:{suite:suite.reference,fullExport:full.reference},
    scope:'Complete per-case measurements remain in both referenced evidence files; all original assertions run before this projection'});
}
function summarizeContinuous({continuous,bytes,reference}){
  const artifact=readArtifact('continuous-ui.json',bytes,reference);
  sameJSON(artifact.value,continuous,'continuous-ui.json must retain every checked operation, snapshot and frame');
  assert.equal(continuous.completed,true,'Only completed continuous actions can receive a success summary');
  assert(Array.isArray(continuous.operations)&&continuous.operations.length>0,'Continuous operations are required');
  assert(continuous.operations.every(entry=>entry.accepted===true&&entry.contract?.accepted===true),
    'A continuous summary cannot hide an unaccepted operation');
  const {operations,...metadata}=continuous;
  return clone({...metadata,evidence:artifact.reference,
    operations:operations.map(({before,after,...operation},index)=>({...operation,
      evidencePointer:'/operations/'+index})),
    evidenceScope:'Complete before/after snapshots and completed-frame traces remain in the referenced file; operation contracts, UI receipts and native geometry summaries are retained here'});
}

module.exports={evidenceReference,validateEvidenceReference,summarizeSuite,summarizeContinuous};
