'use strict';
// Copy this entry's contents only to the existing QA-branch path:
// lost-property-bureau-r03f/qa/startup-recovery-webgpu.cjs.
// The existing workflow, production entry and old candidates stay unchanged.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const parent=path.resolve(__dirname,'..');
const base=path.basename(parent)==='architecture-study-r03'?path.dirname(parent):parent;
const qa=path.join(base,'architecture-study-r03/qa');
const baselinePath=path.join(base,'geometry-orbit-r01/qa/sdf-source-baseline.json');
const baselineBytes=fs.readFileSync(baselinePath);
const blobHash=bytes=>crypto.createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex');
const expectedBaselineBlob='9e26a4f0e32608550a40f24f60a52db32f25d41b';
if(blobHash(baselineBytes)!==expectedBaselineBlob)throw Error('The preserved SDF baseline manifest itself changed');
const baseline=JSON.parse(baselineBytes.toString('utf8'));
if(baseline.baseline!=='8675b08a00a35a77b86984273974c5dcb286bedb'||baseline.oldSourceFiles.length!==57)throw Error('Unexpected SDF baseline identity/count');
for(const file of baseline.oldSourceFiles){
  const filename=path.resolve(base,file.path);
  if(!filename.startsWith(base+path.sep))throw Error('Baseline path escaped the Bureau directory: '+file.path);
  const actual=blobHash(fs.readFileSync(filename));
  if(actual!==file.gitBlob)throw Error('Original SDF source changed: '+file.path+' expected '+file.gitBlob+' actual '+actual);
}
console.log('UNCHANGED_SDF_BASELINE',baseline.baseline,baseline.oldSourceFiles.length,'files');
execFileSync(process.execPath,[path.join(qa,'core.test.mjs')],{stdio:'inherit'});
execFileSync(process.execPath,[path.join(qa,'geometry.test.mjs')],{stdio:'inherit'});
module.exports=require(path.join(qa,'single-frame-diagnostic.cjs'));
