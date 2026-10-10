import test from'node:test';import assert from'node:assert/strict';import fs from'node:fs';import path from'node:path';
import * as THREE from '../../../vendor/three.module.js';
import {createStreetDistrict} from'../street-district.mjs';
import {createRoutePlan,desiredChunks}from'../street/route-plan.mjs';
import {getCameraPreset,CAMERA_PRESET_IDS}from'../../r17/camera-presets.mjs';
import{COACH_LAYOUT}from'../../r17/metre-scale.mjs';
const read=n=>JSON.parse(fs.readFileSync(new URL('../street/'+n,import.meta.url))),route=[{target:0},{target:700}];
test('All71 ten-metre positions and12 original camera profiles retain every expected street chunk and train/door sightline',async()=>{
 const score=read('route.score.json'),anchor=read('first-street.score.json'),plan=createRoutePlan(score,route),rows=[];
 const targets=[[-45,2,0],[-28,2,0],[-10,2,0],[4,2,0],...COACH_LAYOUT.flatMap(c=>[[c.frontDoor,2,1.55],[c.rearDoor,2,1.55]])];
 let sightlineCertificates=0,maxPending=0,peak={chunks:0,triangles:0,geometryBytes:0};
 for(const layout of['landscape','portrait'])for(const name of CAMERA_PRESET_IDS){
  const pose=getCameraPreset(name,layout),d=createStreetDistrict({routeScore:score,anchorScore:anchor});await d.ready;
  try{for(let distance=0;distance<=700;distance+=10){
   let settled=false;for(let frame=0;frame<20;frame++){d.update({distance,elapsed:100},route,{cameraTarget:pose.target,cameraPosition:pose.position});assert.equal(d.proof.status==='error',false,d.proof.error);assert(d.proof.lastUpdateAttempts<=2);maxPending=Math.max(maxPending,d.proof.pending);if(!d.proof.pending){settled=true;break;}}
   assert(settled,'All expected chunks must finish bounded generation');
   const live=new Map(d.proof.activeChunks.map(c=>[c.id,c])),expected=desiredChunks(plan,distance+pose.target[0],live);
   assert.deepEqual([...live.keys()].sort(),expected.map(c=>c.id).sort(),'No missing whole street parcel at any10m/camera sample');
   assert(d.proof.activeChunks.some(c=>c.detail==='near'));assert(d.proof.activeChunks.length>=5);assert(d.proof.metrics.expandedTriangles<=520000);
   // Each handle's bounds come from its actual evaluated meshes. The original
   // train/door sightline segments remain strictly positive of these AABBs;
   // this is a conservative geometric certificate, not a raster visibility test.
   let nearestZ=-Infinity;for(const h of d.handles){const b=new THREE.Box3().setFromObject(h.root);assert(b.max.z<-1.6);nearestZ=Math.max(nearestZ,b.max.z);}
   for(const target of targets){assert(Math.min(target[2],pose.position[2])>nearestZ);sightlineCertificates++;}
   peak.chunks=Math.max(peak.chunks,d.proof.peak.chunks);peak.triangles=Math.max(peak.triangles,d.proof.peak.triangles);peak.geometryBytes=Math.max(peak.geometryBytes,d.proof.peak.geometryBytes);
   rows.push({distance,camera:name,layout,position:pose.position,target:pose.target,ids:[...live.keys()],near:d.proof.activeChunks.find(c=>c.detail==='near').id,triangles:d.proof.metrics.expandedTriangles,nearestBuildingZ:nearestZ});
  }}finally{d.dispose();assert.equal(d.proof.shared.referenceTotal,0);assert.equal(d.proof.metrics.geometryBytes,0);}
 }
 assert.equal(rows.length,71*12);assert.equal(sightlineCertificates,rows.length*targets.length);
 const report={scope:'Deterministic CPU streaming/evaluated-architecture AABB coverage; no WebGL pixels or claimed native travel',sceneMetres:700,timetableKm:4.4,positions:71,profiles:12,states:rows.length,sightlineCertificates,maxPending,peak,rows};
 if(process.env.R18_QA_OUT){fs.mkdirSync(process.env.R18_QA_OUT,{recursive:true});fs.writeFileSync(path.join(process.env.R18_QA_OUT,'camera-coverage.json'),JSON.stringify(report,null,2));}
 console.log(JSON.stringify({...report,rows:undefined}));
});
