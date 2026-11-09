// Node-only reconstruction. It imports no browser automation package and does
// not call GPUCloth.create/step. This is input preparation evidence, not GPU proof.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import {pathToFileURL} from 'node:url';
const args=process.argv.slice(2);
let site,out;
for(let i=0;i<args.length;i++){
  if(args[i]==='--site')site=path.resolve(args[++i]);
  else if(args[i]==='--out')out=path.resolve(args[++i]);
  else throw Error('Unknown argument '+args[i]);
}
if(!site||!out)throw Error('Use --site <prepared directory> --out <report.json>');
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'independent-d48-cpu-'));
const began=performance.now();
const report={schema:'independent-gpucloth-initial-reconstruction/1',status:'RUNNING',browserStarted:false,gpuCalled:false,productionChanged:false};
try{
  fs.cpSync(site,temporary,{recursive:true});
  report.sourceSHA256=Object.fromEntries(['audit.mjs','fixture/SourceFitActorBridge.mjs','fixture/D-inputs.json.gz','fixture/D-initial-hashes.json','original/coupled-cloth.mjs','original/waist-attachments.mjs','SOURCE_LOCK.json'].map(name=>[name,crypto.createHash('sha256').update(fs.readFileSync(path.join(site,name))).digest('hex')]));
  // Node has no document import map. Materialize exactly the same explicit
  // neutral actor alias in this disposable CPU-only copy, leaving site intact.
  fs.copyFileSync(path.join(temporary,'fixture/native-motion.mjs'),path.join(temporary,'original/native-motion.mjs'));
  const url=rel=>pathToFileURL(path.join(temporary,rel)).href;
  const [{CoupledCloth},{BodySDF},{WaistAttachments},{sourceFitArguments},{initialState,differences}]=await Promise.all([
    import(url('original/coupled-cloth.mjs')),import(url('original/material-physics.mjs')),
    import(url('original/waist-attachments.mjs')),import(url('fixture/SourceFitActorBridge.mjs')),
    import(url('audit.mjs')),
  ]);
  const input=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(temporary,'fixture/D-inputs.json.gz'))));
  const meta=JSON.parse(fs.readFileSync(path.join(temporary,'original/assets/body-sdf-grid.json')));
  const raw=zlib.gunzipSync(fs.readFileSync(path.join(temporary,'original/assets/common-body.sdfd.gz')));
  const delta=new Int16Array(raw.buffer,raw.byteOffset,raw.byteLength/2);
  const sdf=new BodySDF(meta,delta,input.sdf.groundShiftM);
  const constructed=sourceFitArguments(input,sdf);
  const world=new CoupledCloth(constructed.rows,constructed.options);
  const waist=new WaistAttachments(world);
  const actual=await initialState(world,waist,constructed.origin,constructed.target);
  const expected=JSON.parse(fs.readFileSync(path.join(temporary,'fixture/D-initial-hashes.json')));
  report.mismatches=differences(actual,expected);
  report.matched=report.mismatches.length===0;
  report.actual=actual;
  report.decodedSDFSHA256=crypto.createHash('sha256').update(Buffer.from(sdf.data.buffer)).digest('hex');
  if(report.decodedSDFSHA256!==input.sdf.decodedGridSHA256)throw Error('Decoded source SDF mismatch');
  if(!report.matched)throw Error('CPU initial state differs from frozen reference');
  report.status='CPU_INITIAL_AND_48_TARGET_HASHES_MATCH_NOT_GPU_PROOF';
}catch(error){
  report.status='CPU_INITIAL_RECONSTRUCTION_FAILED';
  report.error={message:error.message,stack:error.stack};
  process.exitCode=1;
}finally{
  report.elapsedMS=performance.now()-began;
  report.node=process.version;
  fs.mkdirSync(path.dirname(out),{recursive:true});
  fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');
  fs.rmSync(temporary,{recursive:true,force:true});
}
console.log(JSON.stringify({status:report.status,matched:report.matched,mismatches:report.mismatches?.length,out,gpuCalled:false}));
