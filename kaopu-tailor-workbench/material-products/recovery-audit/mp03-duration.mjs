import fs from 'node:fs';
import zlib from 'node:zlib';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {LOOKS} from '../r03/looks.mjs';
import {BodySDF,ClothSolver} from '../r03/material-physics.mjs';

const root=new URL('../r03/',import.meta.url);
const read=path=>fs.readFileSync(new URL(path,root));
const json=path=>JSON.parse(read(path));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const lock=json('SOURCE_LOCK.json');
const metaBytes=read('assets/body-sdf-grid.json');
const compressed=read('assets/common-body.sdfd.gz');
assert.equal(sha(metaBytes),lock.person.sdfMetadataSHA256);
assert.equal(sha(compressed),lock.person.sdfFileSHA256);
const raw=zlib.gunzipSync(compressed);
const sdf=new BodySDF(JSON.parse(metaBytes),new Int16Array(raw.buffer,raw.byteOffset,raw.byteLength/2),lock.person.groundShiftM);
const name=process.argv[2]||'K04';
const look=LOOKS.find(l=>l.id===name);
assert(look,'Unknown registered look');
const materials=json('materials.json');
const worker=read('cloth-worker.mjs').toString();
// Match the existing product protocol, not a new hidden warm-up in the test.
assert(worker.includes('for(let n=0;n<8;n++){for(const s of solvers)s.step(1/30);'));
const report={
 look:name,sourceCommit:'fbbef8bc7df2172f492dd60875432f4ffeff2429',
 scope:'existing worker init boundary followed by two seconds of displayed cloth states',
 workerSHA256:sha(read('cloth-worker.mjs')),hiddenInitializationFrames:8,
 visibleSecondsPerGarment:2,hemImpulseAtVisibleSeconds:1,passed:false,rows:[],warnings:[],
 priorRawInitializationGateRun:38337902620,priorRawInitializationFailurePreserved:true,
 physicalFabricCalibrated:false,continuousCollision:false,selfCollisionProven:false,
 deviceFPSMeasured:false,engineeringStretchCeiling:1.25
};
const summary=()=>({frames:0,maxEdgeStretch:0,minVertexBodyMM:Infinity,minInteriorBodyMM:Infinity,maxSeamGapMM:0,maxMoveMM:0,safetyTrips:0,samples:[]});
function record(solver,row,visible){
 const a=solver.audit(true);
 row.frames++;
 row.maxEdgeStretch=Math.max(row.maxEdgeStretch,a.maxEdgeStretch);
 row.minVertexBodyMM=Math.min(row.minVertexBodyMM,a.minBodyVertexDistanceMM);
 row.minInteriorBodyMM=Math.min(row.minInteriorBodyMM,a.minBodyInteriorSampleMM);
 row.maxSeamGapMM=Math.max(row.maxSeamGapMM,a.seamGapMM);
 row.maxMoveMM=Math.max(row.maxMoveMM,a.maxMoveMM);
 row.safetyTrips=a.safetyTrips;
 row.samples.push(a);
 assert(solver.output.every(Number.isFinite),'nonfinite position');
 assert.equal(a.seamGapMM,0,'open physical seam');
 assert(a.minBodyVertexDistanceMM>-.1,'body vertex penetration');
 assert(a.minBodyInteriorSampleMM>-.1,'body interior sample penetration');
 assert.equal(a.safetyTrips,0,'solver safety trip');
 if(visible)assert(a.maxEdgeStretch<=report.engineeringStretchCeiling,'displayed engineering stretch limit '+a.maxEdgeStretch);
 return a;
}
try{
 for(const role of ['top','bottom']){
  const id=look[role],data=read(lock.garments[id].path);
  assert.equal(sha(data),lock.garments[id].sha256);
  const packet=JSON.parse(zlib.gunzipSync(data));
  const material=materials.find(m=>m.id===look[role+'Material']);
  assert(material);
  const positions=Float64Array.from(packet.record.positionsMm.flatMap(v=>[v[0]/1000,v[1]/1000-lock.person.groundShiftM,v[2]/1000]));
  const solver=new ClothSolver(packet,positions,{sdf,family:material.family,role,doubleLayer:true,clearanceMM:4});
  const row={id,role,family:material.family,material:material.id,initialization:summary(),displayed:summary()};
  report.rows.push(row);
  for(let frame=0;frame<8;frame++){solver.step(1/30);record(solver,row.initialization,false);}
  row.initializationWithinDisplayCeiling=row.initialization.maxEdgeStretch<=report.engineeringStretchCeiling;
  if(!row.initializationWithinDisplayCeiling)report.warnings.push({id,code:'INITIALIZATION_TRANSIENT_EXCEEDS_DISPLAY_CEILING',maxEdgeStretch:row.initialization.maxEdgeStretch,notVisibleDuringExistingWorkerInit:true,notClaimedPhysicallyAccurate:true});
  const first=solver.audit(true);
  assert(first.maxEdgeStretch<=report.engineeringStretchCeiling,'first displayed frame strain');
  row.firstDisplayed=first;
  for(let frame=0;frame<60;frame++){
   if(frame===30)solver.tug();
   solver.step(1/30);
   record(solver,row.displayed,true);
  }
  assert(row.displayed.maxMoveMM>0,'no physical movement');
  solver.reset();
  assert.equal(solver.time,0);
  assert(solver.output.every(Number.isFinite));
  row.resetFiniteAndTimeVerified=true;
  console.log(name,id,JSON.stringify({initialPeak:row.initialization.maxEdgeStretch,displayedPeak:row.displayed.maxEdgeStretch,minBody:row.displayed.minInteriorBodyMM,seamGap:row.displayed.maxSeamGapMM}));
 }
 report.passed=true;
}catch(e){report.error=e.stack||String(e);process.exitCode=1;console.error(report.error);}
finally{
 fs.mkdirSync(new URL('./evidence/',import.meta.url),{recursive:true});
 fs.writeFileSync(new URL('./evidence/'+name+'-duration.json',import.meta.url),JSON.stringify(report,null,2));
}
