import fs from 'node:fs';
import zlib from 'node:zlib';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {LOOKS} from '../r03/looks.mjs';
import {BodySDF,ClothSolver} from '../r03/material-physics.mjs';
const root=new URL('../r03/',import.meta.url);
const read=p=>fs.readFileSync(new URL(p,root));
const json=p=>JSON.parse(read(p));
const sha=b=>createHash('sha256').update(b).digest('hex');
const lock=json('SOURCE_LOCK.json');
const metaBytes=read('assets/body-sdf-grid.json');
const compressed=read('assets/common-body.sdfd.gz');
assert.equal(sha(metaBytes),lock.person.sdfMetadataSHA256);
assert.equal(sha(compressed),lock.person.sdfFileSHA256);
const raw=zlib.gunzipSync(compressed);
const sdf=new BodySDF(JSON.parse(metaBytes),new Int16Array(raw.buffer,raw.byteOffset,raw.byteLength/2),lock.person.groundShiftM);
const name=process.argv[2]||'K04';
const look=LOOKS.find(l=>l.id===name);assert(look,'Unknown registered look');
const materials=json('materials.json');
const report={look:name,sourceCommit:'fbbef8bc7df2172f492dd60875432f4ffeff2429',secondsPerGarment:2,hemImpulseAtSeconds:1,passed:false,rows:[],physicalFabricCalibrated:false,continuousCollision:false,selfCollisionProven:false,deviceFPSMeasured:false,engineeringStretchCeiling:1.25};
try {
 for(const role of ['top','bottom']){
  const id=look[role],data=read(lock.garments[id].path);assert.equal(sha(data),lock.garments[id].sha256);
  const packet=JSON.parse(zlib.gunzipSync(data));
  const material=materials.find(m=>m.id===look[role+'Material']);assert(material);
  const positions=Float64Array.from(packet.record.positionsMm.flatMap(v=>[v[0]/1000,v[1]/1000-lock.person.groundShiftM,v[2]/1000]));
  const solver=new ClothSolver(packet,positions,{sdf,family:material.family,role,doubleLayer:true,clearanceMM:4});
  const row={id,role,family:material.family,material:material.id,frames:0,maxEdgeStretch:0,minVertexBodyMM:Infinity,minInteriorBodyMM:Infinity,maxSeamGapMM:0,maxMoveMM:0,safetyTrips:0,samples:[]};report.rows.push(row);
  for(let frame=0;frame<60;frame++){
   if(frame===30)solver.tug();
   solver.step(1/30);const a=solver.audit(true);row.frames++;
   row.maxEdgeStretch=Math.max(row.maxEdgeStretch,a.maxEdgeStretch);
   row.minVertexBodyMM=Math.min(row.minVertexBodyMM,a.minBodyVertexDistanceMM);
   row.minInteriorBodyMM=Math.min(row.minInteriorBodyMM,a.minBodyInteriorSampleMM);
   row.maxSeamGapMM=Math.max(row.maxSeamGapMM,a.seamGapMM);
   row.maxMoveMM=Math.max(row.maxMoveMM,a.maxMoveMM);row.safetyTrips=a.safetyTrips;
   assert(solver.output.every(Number.isFinite),'nonfinite position');
   assert.equal(a.seamGapMM,0,'open physical seam');
   assert(a.minBodyVertexDistanceMM>-.1,'body vertex penetration');
   assert(a.minBodyInteriorSampleMM>-.1,'body interior sample penetration');
   assert(a.maxEdgeStretch<=report.engineeringStretchCeiling,'engineering stretch limit '+a.maxEdgeStretch);
   assert.equal(a.safetyTrips,0,'solver safety trip');
   if([7,29,30,59].includes(frame))row.samples.push(a);
  }
  assert(row.maxMoveMM>0,'no physical movement');
  solver.reset();assert.equal(solver.time,0);assert(solver.output.every(Number.isFinite));row.resetVerified=true;
  console.log(name,id,JSON.stringify(row));
 }
 report.passed=true;
} catch(e){report.error=e.stack||String(e);process.exitCode=1;console.error(report.error);}
finally{fs.mkdirSync(new URL('./evidence/',import.meta.url),{recursive:true});fs.writeFileSync(new URL('./evidence/'+name+'-duration.json',import.meta.url),JSON.stringify(report,null,2));}
