import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from '../../../vendor/three.module.js';
import {createStreetDistrict} from '../street-district.mjs';
import {createRoutePlan,desiredChunks} from '../street/route-plan.mjs';
import {getCameraPreset,CAMERA_PRESET_IDS,boundCameraPose} from '../camera-presets.mjs';
import {COACH_LAYOUT} from '../metre-scale.mjs';
import {photoTargets,streetVisibilityProbe} from './camera-visibility.mjs';
const read=n=>JSON.parse(fs.readFileSync(new URL('../street/'+n,import.meta.url)));
const route=[{target:0},{target:700}],layouts=['landscape','portrait'];
const originalIds=['overview','front','rear','detail','city','platform'];
const photographyIds=['tailBrand'],openTrackIds=['leftSide','rightSide'];
const distances=Array.from({length:71},(_,i)=>i*10);
const corridorTargets=[[-45,2,0],[-28,2,0],[-10,2,0],[4,2,0],...COACH_LAYOUT.flatMap(c=>[[c.frontDoor,2,1.55],[c.rearDoor,2,1.55]])];

test('Every route sample keeps original camera corridors and station-tail photography unobstructed',async()=>{
 assert.deepEqual([...CAMERA_PRESET_IDS].sort(),[...originalIds,...photographyIds,...openTrackIds].sort(),'New presets must select an explicit visibility contract');
 const score=read('route.score.json'),anchor=read('first-street.score.json'),plan=createRoutePlan(score,route),rows=[];
 let maxBytes=0,maxBatches=0,corridorChecks=0,triangleRays=0;
 const poses=layouts.flatMap(layout=>[...originalIds,...photographyIds].map(name=>{
  const p=getCameraPreset(name,layout);return{layout,name,...p,...boundCameraPose(p.position,p.target)};
 }));
 const distinct=[...new Set(poses.map(p=>p.target[0]))];
 for(const targetX of distinct){
  const d=createStreetDistrict({routeScore:score,anchorScore:anchor});await d.ready;
  try{for(const distance of distances){
   for(let i=0;i<25;i++){d.update({distance,elapsed:10},route,{cameraTarget:[targetX,0,0]});assert.equal(d.proof.error,undefined);if(!d.proof.pending)break;}
   assert.equal(d.proof.pending,0);
   const live=new Map(d.proof.activeChunks.map(c=>[c.id,c]));
   assert.deepEqual([...live.keys()].sort(),desiredChunks(plan,distance+targetX,live).map(c=>c.id).sort());
   assert.deepEqual(d.proof.coverage.missing,[]);
   assert.equal(d.proof.renderBatch.renderTriangles,d.proof.metrics.expandedTriangles);
   assert(d.proof.renderBatch.batches<=144);assert(d.proof.renderBatch.materials<=112);
   assert(d.proof.renderBatch.allocatedMaterials<=128);assert(d.proof.renderBatch.instanceBytes<3e6);
   assert(d.proof.renderBatch.geometryBytes<24e6,JSON.stringify({distance,targetX,batch:d.proof.renderBatch}));
   assert(d.proof.activeChunks.some(c=>c.detail==='near'));
   // Keep the original global rail/door corridor bound, including every used
   // vertex and instance. No relaxation for the six original camera presets.
   let closestZ=-Infinity;
   d.renderBatches.root.traverse(o=>{if(!o.isMesh)return;const p=o.geometry.attributes.position;
    if(o.isInstancedMesh){o.geometry.computeBoundingBox();for(let i=0;i<o.count;i++){const m=new THREE.Matrix4();o.getMatrixAt(i,m);const b=o.geometry.boundingBox.clone().applyMatrix4(m);closestZ=Math.max(closestZ,b.max.z);}}
    else{const ids=o.geometry.index;for(let k=0;k<o.geometry.drawRange.count;k++)closestZ=Math.max(closestZ,p.getZ(ids.getX(k)));}
   });
   assert(closestZ< -1.6);
   const matching=poses.filter(p=>p.target[0]===targetX),probe=matching.some(p=>photographyIds.includes(p.name))?streetVisibilityProbe(d.renderBatches.root):null;
   try{for(const pose of matching){
    let checks=0,method;
    if(originalIds.includes(pose.name)){
     method='original-global-corridor';
     for(const target of corridorTargets){assert(Math.min(target[2],pose.position[2])>closestZ,JSON.stringify({distance,camera:pose.name,layout:pose.layout,closestZ}));checks++;corridorChecks++;}
    }else{
     method='actual-batch-triangle-rays-and-shader-cloth';
     assert(probe.count>0,'Visibility must use the real populated street');
     for(const target of photoTargets(pose)){
      const blocked=probe.firstHit(pose.position,target);
      assert.equal(blocked,null,JSON.stringify({distance,camera:pose.name,layout:pose.layout,target,blocked}));checks++;triangleRays++;
     }
    }
    rows.push({distance,camera:pose.name,layout:pose.layout,method,checks,closestZ,batches:d.proof.renderBatch.batches,triangles:d.proof.renderBatch.renderTriangles});
   }}finally{probe?.dispose();}
   maxBytes=Math.max(maxBytes,d.proof.renderBatch.geometryBytes);maxBatches=Math.max(maxBatches,d.proof.renderBatch.batches);
  }}finally{d.dispose();assert.equal(d.proof.metrics.geometryBytes,0);}
 }
 const expectedRows=distances.length*poses.length;
 const expectedCorridors=distances.length*layouts.length*originalIds.length*corridorTargets.length;
 const expectedRays=distances.length*poses.filter(p=>photographyIds.includes(p.name)).reduce((sum,p)=>sum+photoTargets(p).length,0);
 assert.equal(rows.length,expectedRows);assert.equal(corridorChecks,expectedCorridors);assert.equal(triangleRays,expectedRays);
 assert.equal(rows.filter(r=>r.method==='original-global-corridor').length,distances.length*layouts.length*originalIds.length);
 const report={scope:'Actual CPU submitted geometry; original global corridors plus sampled triangle sightlines including shader-deformed cloth at elapsed=10s, not raster visibility',rows,corridorChecks,triangleRays,checks:corridorChecks+triangleRays,maxBytes,maxBatches};
 if(process.env.R20_QA_OUT){fs.mkdirSync(process.env.R20_QA_OUT,{recursive:true});fs.writeFileSync(path.join(process.env.R20_QA_OUT,'camera-sweep.json'),JSON.stringify(report,null,2));}
 console.log({rows:rows.length,corridorChecks,triangleRays,maxBytes,maxBatches});
});

// Conventional side lenses intentionally need open track. At stations, actual
// street buildings may obscure the opposite side; the production scene is never
// hidden or moved for a photograph. Browser QA drives to this region normally.
test('Conventional left and right side views clear the actual district after the bounded street',async()=>{
 const score=read('route.score.json'),anchor=read('first-street.score.json'),d=createStreetDistrict({routeScore:score,anchorScore:anchor});await d.ready;
 let rays=0;
 try{for(const distance of[786,790,794]){
  for(let i=0;i<25;i++){d.update({distance,elapsed:10},route,{cameraTarget:[-5.8,2.2,0]});if(!d.proof.pending)break;}
  assert.equal(d.proof.error,undefined);assert.equal(d.proof.pending,0);assert.deepEqual(d.proof.coverage.missing,[]);
  const probe=streetVisibilityProbe(d.renderBatches.root);
  try{for(const id of openTrackIds)for(const layout of layouts){const p=getCameraPreset(id,layout),safe=boundCameraPose(p.position,p.target);for(const target of photoTargets(p)){assert.equal(probe.firstHit(safe.position,target),null,JSON.stringify({id,layout,distance,target}));rays++;}}}finally{probe.dispose();}
 }}finally{d.dispose();}assert.equal(rays,360);
});
