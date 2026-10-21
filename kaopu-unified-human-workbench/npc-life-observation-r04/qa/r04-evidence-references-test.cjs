'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const crypto=require('node:crypto');
const {evidenceReference,validateEvidenceReference,summarizeSuite,summarizeContinuous}=require('./r04-evidence-references.cjs');
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const clone=value=>JSON.parse(JSON.stringify(value));
const encode=value=>Buffer.from(JSON.stringify(value,null,2)+'\n');
const measurements=Array.from({length:2048},(_,i)=>({serial:i,position:[i/120,1,.5],phase:'measured'}));
const verification={runId:'fixture-verification-2',sceneEpochAtStart:11,
  startedAt:'2026-10-21T00:00:00.000Z',finishedAt:'2026-10-21T00:01:00.000Z',completed:true,passed:true,
  tests:Array.from({length:12},(_,i)=>({name:'fixture case '+i,kind:i<6?'bottle':'window',pass:true,
    detail:{measurements,actor:{nativeGeometry:measurements}}})),errors:[],performance:{samples:2048,raw:measurements}};
const summary={runId:verification.runId,sceneEpochAtStart:verification.sceneEpochAtStart,
  startedAt:verification.startedAt,finishedAt:verification.finishedAt,completed:true,passed:true,
  total:12,finished:12,passedCount:12,tests:verification.tests.map(({name,kind,pass})=>({name,kind,pass}))};
const fullEvidence={schema:'kaopu/npc-full-evidence@1',version:'NPC-LIFE-OBSERVATION-R04',
  verification,observation:{completedFrameTrace:measurements},audit:{poses:measurements}};
const continuous={schema:'kaopu/r03-continuous-ui@1',actualUI:true,usedPause:false,usedExternalTick:false,
  startedAt:'2026-10-21T00:00:00.000Z',maxWallMS:600000,completed:true,elapsedMS:120000,
  operations:['bottle','open','close'].map((action,i)=>({kind:i===0?'bottle':'window',operation:i===0?null:action,
    actorId:'A',label:'fixture-'+action,buttonId:i===0?'npc-pick':'npc-window-'+action,
    before:{snapshot:{poses:measurements,negativeZero:-0},observation:{completedFrameTrace:measurements}},
    after:{snapshot:{poses:measurements},observation:{completedFrameTrace:measurements}},
    ui:{buttonId:i===0?'npc-pick':'npc-window-'+action,usedPause:false,usedExternalTick:false},
    contract:{accepted:true,taskToken:i===0?'A:bottle:3':'A:window:'+i,firstSerial:100+i*100,
      lastSerial:175+i*100,taskFrames:75,phaseSequence:['waiting','approach','done:restored']},
    nativeGeometry:{feet:[{id:'A',grounded:true}],geometry:{accepted:true,poseCount:26}},accepted:true}))};
const suiteBytes=encode(verification),fullBytes=encode(fullEvidence),continuousBytes=encode(continuous);
const suiteInput=()=>({verification,summary,suiteBytes,fullBytes});
const continuousInput=()=>({continuous,bytes:continuousBytes});
const tests=[];
function test(name,run){try{run();tests.push({name,passed:true});}catch(error){tests.push({name,passed:false,error:error.stack});}}
function largestArray(value){
  if(Array.isArray(value))return Math.max(value.length,...value.map(largestArray));
  if(value&&typeof value==='object')return Math.max(0,...Object.values(value).map(largestArray));
  return 0;
}

test('a reference identifies the actual stored filename, byte count and SHA256',()=>{
  const reference=evidenceReference('suite.json',suiteBytes);
  assert.deepEqual(reference,{file:'suite.json',bytes:suiteBytes.length,sha256:sha(suiteBytes)});
  assert.equal(validateEvidenceReference(reference,suiteBytes,'suite.json'),true);
});
test('reject a wrong artifact filename',()=>{
  assert.throws(()=>validateEvidenceReference({...evidenceReference('suite.json',suiteBytes),file:'continuous-ui.json'},suiteBytes,'suite.json'),/file mismatch/);
  assert.throws(()=>evidenceReference('../suite.json',suiteBytes),/known standalone evidence filename/);
});
test('reject a wrong byte count',()=>{
  assert.throws(()=>validateEvidenceReference({...evidenceReference('suite.json',suiteBytes),bytes:suiteBytes.length-1},suiteBytes,'suite.json'),/bytes mismatch/);
});
test('reject a wrong digest or changed stored bytes',()=>{
  const reference=evidenceReference('suite.json',suiteBytes);
  assert.throws(()=>validateEvidenceReference({...reference,sha256:'0'.repeat(64)},suiteBytes,'suite.json'),/sha256 mismatch/);
  const changed=Buffer.from(suiteBytes);changed[0]=32;
  assert.throws(()=>validateEvidenceReference(reference,changed,'suite.json'),/sha256 mismatch/);
});
test('reject missing bytes and malformed stored JSON',()=>{
  assert.throws(()=>evidenceReference('suite.json',null),/actual nonempty file bytes/);
  assert.throws(()=>evidenceReference('suite.json',Buffer.alloc(0)),/actual nonempty file bytes/);
  assert.throws(()=>summarizeSuite({...suiteInput(),suiteBytes:Buffer.from('{')}),/valid JSON/);
});
test('suite summary preserves the exact run identity and all twelve case results',()=>{
  const projected=summarizeSuite(suiteInput());
  assert.equal(projected.runId,verification.runId);
  assert.equal(projected.sceneEpochAtStart,verification.sceneEpochAtStart);
  assert.equal(projected.completed,true);assert.equal(projected.passed,true);
  assert.equal(projected.testCount,12);assert.equal(projected.passedCount,12);
  assert.deepEqual(projected.tests,summary.tests);
  assert.equal(largestArray(projected),12);
  assert(projected.tests.every(item=>!Object.hasOwn(item,'detail')));
  assert(encode(projected).length<6000,'The compact suite result must not re-embed raw measurements');
  assert.equal(validateEvidenceReference(projected.evidence.suite,suiteBytes,'suite.json'),true);
  assert.equal(validateEvidenceReference(projected.evidence.fullExport,fullBytes,'full-evidence-export.json'),true);
});
test('suite projection rejects a mismatched supplied artifact reference',()=>{
  assert.throws(()=>summarizeSuite({...suiteInput(),suiteReference:{...evidenceReference('suite.json',suiteBytes),bytes:1}}),/bytes mismatch/);
  assert.throws(()=>summarizeSuite({...suiteInput(),fullReference:{...evidenceReference('full-evidence-export.json',fullBytes),sha256:'0'.repeat(64)}}),/sha256 mismatch/);
});
test('suite projection rejects a different run in either retained full file',()=>{
  assert.throws(()=>summarizeSuite({...suiteInput(),suiteBytes:encode({...verification,runId:'other-run'})}),/retain the complete checked verification/);
  assert.throws(()=>summarizeSuite({...suiteInput(),fullBytes:encode({...fullEvidence,verification:{...verification,runId:'other-run'}})}),/same complete verification/);
});
test('suite projection verifies raw measurements as well as compact identities',()=>{
  const changed=clone(verification);changed.tests[0].detail.measurements[100].position[0]+=1;
  assert.throws(()=>summarizeSuite({...suiteInput(),suiteBytes:encode(changed)}),/retain the complete checked verification/);
});
test('suite projection rejects wrong run, reordered cases, changed results or counts in its summary',()=>{
  assert.throws(()=>summarizeSuite({...suiteInput(),summary:{...summary,runId:'other-run'}}),/runId must match/);
  assert.throws(()=>summarizeSuite({...suiteInput(),summary:{...summary,tests:[...summary.tests].reverse()}}),/every case name, kind, result and order/);
  assert.throws(()=>summarizeSuite({...suiteInput(),summary:{...summary,tests:summary.tests.map((t,i)=>i===0?{...t,pass:false}:t)}}),/every case name, kind, result and order/);
  for(const key of ['finished','passedCount','total'])
    assert.throws(()=>summarizeSuite({...suiteInput(),summary:{...summary,[key]:11}}),/count must match|all planned cases/);
});
test('incomplete and failed numerical reports cannot receive a success summary',()=>{
  for(const change of [{completed:false},{passed:false},{tests:verification.tests.map((t,i)=>i===0?{...t,pass:false}:t)}]){
    const v={...verification,...change};
    assert.throws(()=>summarizeSuite({verification:v,summary,suiteBytes:encode(v),fullBytes:encode({...fullEvidence,verification:v})}),/completed suite|passing suite|failed case/);
  }
});
test('continuous summary retains complete operation contracts, UI and native geometry with file pointers',()=>{
  const projected=summarizeContinuous(continuousInput());
  assert.equal(projected.completed,continuous.completed);assert.equal(projected.elapsedMS,continuous.elapsedMS);
  assert.equal(projected.actualUI,true);assert.equal(projected.usedPause,false);assert.equal(projected.usedExternalTick,false);
  assert.equal(projected.operations.length,3);
  for(let i=0;i<3;i++){
    const {before,after,...expected}=continuous.operations[i];
    const {evidencePointer,...actual}=projected.operations[i];
    assert.deepEqual(actual,expected);assert.equal(evidencePointer,'/operations/'+i);
    assert(!Object.hasOwn(actual,'before'));assert(!Object.hasOwn(actual,'after'));
  }
  assert.equal(largestArray(projected),3);
  assert(encode(projected).length<6000,'The compact continuous result must not re-embed raw snapshots or frames');
  assert.equal(validateEvidenceReference(projected.evidence,continuousBytes,'continuous-ui.json'),true);
});
test('continuous projection rejects an incorrect reference and mismatched operation evidence',()=>{
  assert.throws(()=>summarizeContinuous({...continuousInput(),reference:{...evidenceReference('continuous-ui.json',continuousBytes),file:'suite.json'}}),/file mismatch/);
  const changed=clone(continuous);changed.operations[0].contract.taskToken='A:bottle:99';
  assert.throws(()=>summarizeContinuous({...continuousInput(),bytes:encode(changed)}),/every checked operation, snapshot and frame/);
});
test('continuous projection also detects a changed raw completed frame',()=>{
  const changed=clone(continuous);changed.operations[0].after.observation.completedFrameTrace[100].serial=-1;
  assert.throws(()=>summarizeContinuous({...continuousInput(),bytes:encode(changed)}),/every checked operation, snapshot and frame/);
});
test('incomplete and unaccepted continuous reports cannot receive a success summary',()=>{
  for(const change of [{completed:false},{operations:continuous.operations.map((e,i)=>i===0?{...e,accepted:false}:e)},
    {operations:continuous.operations.map((e,i)=>i===0?{...e,contract:{...e.contract,accepted:false}}:e)}]){
    const value={...continuous,...change};
    assert.throws(()=>summarizeContinuous({continuous:value,bytes:encode(value)}),/completed continuous actions|unaccepted operation/);
  }
});
test('projected DTOs are detached from both source reports',()=>{
  const suite=summarizeSuite(suiteInput()),actions=summarizeContinuous(continuousInput());
  suite.tests[0].pass=false;actions.operations[0].contract.taskToken='changed';actions.operations[0].nativeGeometry.feet[0].grounded=false;
  assert.equal(verification.tests[0].pass,true);assert.equal(summary.tests[0].pass,true);
  assert.equal(continuous.operations[0].contract.taskToken,'A:bottle:3');
  assert.equal(continuous.operations[0].nativeGeometry.feet[0].grounded,true);
});
test('all complete artifact files and source reports remain byte-for-byte unchanged after projection',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'npc-r04-evidence-'));
  const artifacts={'suite.json':suiteBytes,'full-evidence-export.json':fullBytes,'continuous-ui.json':continuousBytes};
  try{
    for(const [file,bytes] of Object.entries(artifacts))fs.writeFileSync(path.join(dir,file),bytes);
    const vBefore=sha(encode(verification)),cBefore=sha(encode(continuous));
    summarizeSuite({...suiteInput(),suiteBytes:fs.readFileSync(path.join(dir,'suite.json')),fullBytes:fs.readFileSync(path.join(dir,'full-evidence-export.json'))});
    summarizeContinuous({continuous,bytes:fs.readFileSync(path.join(dir,'continuous-ui.json'))});
    for(const [file,bytes] of Object.entries(artifacts))assert(fs.readFileSync(path.join(dir,file)).equals(bytes),file+' must be unchanged');
    assert.equal(sha(encode(verification)),vBefore);assert.equal(sha(encode(continuous)),cBefore);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

const compactSuite=summarizeSuite(suiteInput()),compactContinuous=summarizeContinuous(continuousInput());
const report={schema:'kaopu/r04-evidence-references-test@1',createdAt:new Date().toISOString(),
  scope:'Pure Node evidence-storage projection with artificial fixtures; no browser, physical, rendering or CI-duration claim',
  sourceSHA256:sha(fs.readFileSync(path.join(__dirname,'r04-evidence-references.cjs'))),testSourceSHA256:sha(fs.readFileSync(__filename)),
  fixtureSizes:{suiteFullBytes:suiteBytes.length,suiteSummaryBytes:encode(compactSuite).length,
    continuousFullBytes:continuousBytes.length,continuousSummaryBytes:encode(compactContinuous).length,fullExportBytes:fullBytes.length},
  passed:tests.every(item=>item.passed),counts:{passed:tests.filter(item=>item.passed).length,total:tests.length},tests};
fs.writeFileSync(path.join(__dirname,'r04-evidence-references-test.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({schema:report.schema,passed:report.passed,counts:report.counts,fixtureSizes:report.fixtureSizes,
  sourceSHA256:report.sourceSHA256,failures:tests.filter(item=>!item.passed)},null,2));
if(!report.passed)process.exitCode=1;
