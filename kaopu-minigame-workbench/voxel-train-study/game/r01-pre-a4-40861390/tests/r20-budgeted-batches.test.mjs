import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from '../../../vendor/three.module.js';
import {createMaterialLibrary} from '../street/materials.mjs';
import {createDistrictBatches} from '../street/render-batches.mjs';
import {createStreetDistrict} from '../street-district.mjs';
import {createRoutePlan} from '../street/route-plan.mjs';
import * as Instrument from '../street/instrument.mjs';

function source(id,center,version=0,vertices=12000){
 const score={object:{id,seed:1},appearance:{wetness:.3},motion:{wind:{amplitude:0,frequency:1}},performance:{detail:'far'}};
 const library=createMaterialLibrary(THREE,score),root=new THREE.Group(),g=new THREE.BufferGeometry();
 const positions=new Float32Array(vertices*3),normals=new Float32Array(vertices*3);
 for(let i=0;i<vertices;i++){positions[i*3]=i%3+version;positions[i*3+1]=Math.floor(i/3)%10;positions[i*3+2]=-8;normals[i*3+2]=1;}
 g.setAttribute('position',new THREE.BufferAttribute(positions,3));g.setAttribute('normal',new THREE.BufferAttribute(normals,3));root.add(new THREE.Mesh(g,library.get('plaster')));
 const handle={score,root,cloth:[]};return{handle,score,center,dispose(){g.dispose();library.dispose();}};
}
function fixture(){let ticks=0;const refs=new Map();const b=createDistrictBatches({budgetMs:6,now:()=>ticks+=.1,retainSource:h=>refs.set(h,(refs.get(h)||0)+1),releaseSource:h=>{const n=refs.get(h);assert(n>0,'Reference release must be balanced');if(n===1)refs.delete(h);else refs.set(h,n-1);}});return{b,refs};}
function drain(b){for(let frame=0;frame<500&&b.proof.pendingCells;frame++)b.update(12,300,.0805);assert.equal(b.proof.pendingCells,0,'Deterministic queue must terminate');assert.equal(b.proof.error,undefined);}
function signature(b){const result=[];b.root.traverse(o=>{if(!o.isMesh)return;result.push({name:o.name,position:Array.from(o.geometry.attributes.position.array),index:Array.from(o.geometry.index.array),normal:Array.from(o.geometry.attributes.normal.array),bounds:o.geometry.boundingBox.toArray?.()||[o.geometry.boundingBox.min.toArray(),o.geometry.boundingBox.max.toArray()],drawRange:o.geometry.drawRange});});return result;}

test('Detached cooperative replacement preserves visible cell until a byte-identical atomic commit',()=>{
 const a=source('parcel-a',5),next=source('parcel-a',5,2),{b,refs}=fixture(),oracle=createDistrictBatches();
 try{b.rebuild([a]);const oldRoot=b.root.children[0],before=signature(b),oldBytes=b.proof.geometryBytes;b.request([next]);assert.equal(b.proof.pendingCells,1);assert.equal(refs.get(a.handle),1);assert.equal(refs.get(next.handle),1);
  b.update(1,30,.0805);assert.equal(b.proof.pendingCells,1);assert.equal(b.root.children[0],oldRoot);assert.deepEqual(signature(b),before);assert(b.proof.stagingGeometryBytes>0);assert(b.proof.lastPackingMs<=6.5,'Clock cost is bounded by one cooperative slice/check');
  drain(b);assert.notEqual(b.root.children[0],oldRoot);assert.equal(oldRoot.parent,null);assert(!refs.has(a.handle));assert.equal(refs.get(next.handle),1);assert.equal(b.proof.stagingGeometryBytes,0);assert.equal(b.proof.staleCommits,0);assert(b.proof.peakAllocatedGeometryBytes>=oldBytes+b.proof.geometryBytes,'Peak captures old plus fully built stage before atomic release');
  oracle.rebuild([next]);assert.deepEqual(signature(b),signature(oracle));assert.deepEqual(b.proof.renderedParcelIds,['parcel-a']);assert(b.proof.packingSteps>30);assert(b.proof.maxPackingMs<=6.5);
 }finally{b.dispose();oracle.dispose();a.dispose();next.dispose();}assert.equal(refs.size,0);
});

test('Reversal cancels partial geometry and stale source ownership; latest version alone can commit',()=>{
 const a=source('parcel-a',5),obsolete=source('parcel-a',5,4),latest=source('parcel-a',5,7),{b,refs}=fixture();
 try{b.rebuild([a]);const original=b.root.children[0];b.request([obsolete]);b.update(1,30,0);assert(b.proof.stagingGeometryBytes>0);b.request([a]);assert.equal(b.proof.pendingCells,0);assert.equal(b.root.children[0],original);assert.equal(b.proof.stagingGeometryBytes,0);assert(!refs.has(obsolete.handle));
  b.request([obsolete]);b.update(2,36,0);b.request([latest]);assert(!refs.has(obsolete.handle));drain(b);assert.deepEqual(b.renderedSources().map(c=>c.handle),[latest.handle]);assert.equal(b.proof.cancelledJobs,2);assert.equal(b.proof.staleCommits,0);assert(!refs.has(a.handle));assert.equal(refs.get(latest.handle),1);
 }finally{b.dispose();a.dispose();obsolete.dispose();latest.dispose();}assert.equal(refs.size,0);
});

test('Coverage acquisition uses real same-shader geometry while queue waits; jumps and teardown release everything',()=>{
 const a=source('parcel-a',5),incoming=source('parcel-b',27),jump=source('parcel-z',1005),replacement=source('parcel-z',1005,5),{b,refs}=fixture();
 try{b.request([a]);assert.equal(b.proof.pendingCells,0);assert.equal(b.proof.coverageBuilds,1);b.request([a,incoming]);assert.deepEqual(b.proof.renderedParcelIds,['parcel-a','parcel-b']);assert.equal(b.proof.renderTriangles,8000);assert(b.proof.coverageBatches>0);assert.equal(b.proof.coverageTriangles,4000);assert.equal(b.root.children.length,2);assert(b.proof.lastCoverageMs>0);
  b.update(1,36,0);assert(b.proof.pendingCells>0);for(const c of b.root.children)c.traverse(o=>{if(o.isMesh){assert(o.material.userData.streetBatch,'Coverage must use existing batch shaders');assert(o.frustumCulled);assert(o.castShadow&&o.receiveShadow);}});
  b.request([jump]);assert.deepEqual(b.proof.renderedParcelIds,['parcel-z']);assert.equal(b.proof.pendingCells,0);assert.equal(b.proof.coverageTriangles,0);assert(!refs.has(a.handle)&&!refs.has(incoming.handle));assert.equal(refs.get(jump.handle),1);
  b.request([replacement]);b.update(2,1036,0);assert(b.proof.pendingCells>0);b.dispose();assert.equal(refs.size,0);assert.equal(b.root.children.length,0);assert.equal(b.proof.pendingCells,0);assert.equal(b.proof.stagingGeometryBytes,0);assert.equal(b.proof.geometryBytes,0);b.dispose();
 }finally{b.dispose();a.dispose();incoming.dispose();jump.dispose();replacement.dispose();}
});

const json=name=>JSON.parse(readFileSync(new URL('../street/'+name,import.meta.url),'utf8'));
const route=[{target:0},{target:700}],cameraTarget=[-17,2.3,1.2];
async function verifyJourney(step,realClock=false){
 const routeScore=json('route.score.json'),anchorScore=json('first-street.score.json'),plan=createRoutePlan(routeScore,route),created=[];
 let ticks=0;
 const instrument={...Instrument,build(...args){const h=Instrument.build(...args);created.push(h);return h;}};
 // A stable synthetic clock makes queuing/cancellation deterministic without
 // pretending the synthetic milliseconds are a browser performance result.
 const d=createStreetDistrict({routeScore,anchorScore,instrument,renderBudgetMs:6,...(realClock?{}:{packingNow:()=>ticks+=.002})});await d.ready;
 const update=distance=>{d.update({distance,elapsed:distance/18},route,{cameraTarget});assert.equal(d.proof.error,undefined);const visible=d.renderBatches.renderedSources();assert.deepEqual(d.proof.activeChunks.map(c=>c.id).sort(),visible.map(c=>c.id).sort());assert.deepEqual(d.proof.renderBatch.renderedParcelIds,visible.map(c=>c.id).sort());assert.equal(d.proof.renderBatch.renderTriangles,d.proof.metrics.expandedTriangles);assert(d.proof.pending>=d.proof.renderBatch.pendingCells);assert(d.handles.every(h=>!h.disposed&&h.root.parent===null));};
 try{
  for(let frame=0;frame<160;frame++){update(0);if(!d.proof.pending)break;}assert.equal(d.proof.pending,0);
  for(let distance=step;distance<=720;distance+=step){update(distance);const required=plan.chunks.filter(c=>Math.abs(c.center-8-(distance-17))<=70);assert.deepEqual(required.filter(c=>!d.proof.renderBatch.renderedParcelIds.includes(c.id)).map(c=>c.id),[],`Actual rendered +/-70m coverage at ${distance}m`);assert.deepEqual(d.proof.coverage.missing,[]);assert(d.proof.lastUpdateAttempts<=2);}
  // Reverse and then jump completely out while work remains. No disposed source
  // can be read by a suspended iterator, even when its job never reached commit.
  for(const distance of [684,648,612,576,350,0,1100])update(distance);
  assert.equal(d.proof.pending,0);assert.equal(d.proof.renderBatch.batches,0);assert.equal(d.proof.shared.referenceTotal,0);
 }finally{d.dispose();}
 assert.equal(d.proof.shared.referenceTotal,0);assert.equal(d.proof.shared.cpuBytes,0);assert(created.every(h=>h.disposed));
}
for(const step of [24,36])test(`Production cooperative path preserves actual rendered +/-70m at ${step}m per frame, reverse, jump and dispose`,()=>verifyJourney(step));

test('Default real-clock 6ms production queue retains actual silhouettes with one update per 36m',()=>verifyJourney(36,true));


test('Frozen clocks hit the step safety cap without losing queued work; packing exceptions retain the old cell',()=>{
 const a=source('parcel-a',5),next=source('parcel-a',5,1),broken=source('parcel-a',5,2),refs=new Map();
 const b=createDistrictBatches({budgetMs:6,maxStepsPerFrame:4,now:()=>0,retainSource:h=>refs.set(h,(refs.get(h)||0)+1),releaseSource:h=>{const n=refs.get(h);assert(n>0);if(n===1)refs.delete(h);else refs.set(h,n-1);}});
 try{b.rebuild([a]);const original=b.root.children[0];b.request([next]);b.update(0,0,0);assert.equal(b.proof.packingSteps,4);assert.equal(b.proof.stepCapFrames,1);assert.equal(b.proof.pendingCells,1);assert.equal(b.root.children[0],original);drain(b);assert.deepEqual(b.renderedSources().map(c=>c.handle),[next.handle]);
  broken.handle.root.children[0].material.userData.street=null;b.request([broken]);b.update(1,1,0);assert.match(b.proof.error,/native street material/);assert.equal(b.proof.pendingCells,0);assert.equal(b.proof.stagingGeometryBytes,0);assert(!refs.has(broken.handle));assert.deepEqual(b.renderedSources().map(c=>c.handle),[next.handle]);b.request([next]);assert.equal(b.proof.error,undefined);
 }finally{b.dispose();a.dispose();next.dispose();broken.dispose();}assert.equal(refs.size,0);
});
