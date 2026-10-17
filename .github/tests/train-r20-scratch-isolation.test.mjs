// Targeted correctness regression only. No production source mutation on disk.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from '../../kaopu-minigame-workbench/voxel-train-study/vendor/three.module.js';
import {createMaterialLibrary} from '../../kaopu-minigame-workbench/voxel-train-study/game/r20/street/materials.mjs';
import {createDistrictBatches} from '../../kaopu-minigame-workbench/voxel-train-study/game/r20/street/render-batches.mjs';
function source(id,center,version=0,vertices=12000){
 const score={object:{id,seed:1},appearance:{wetness:.3},motion:{wind:{amplitude:0,frequency:1}},performance:{detail:'far'}};
 const library=createMaterialLibrary(THREE,score),root=new THREE.Group(),g=new THREE.BufferGeometry();
 const positions=new Float32Array(vertices*3),normals=new Float32Array(vertices*3);
 for(let i=0;i<vertices;i++){positions[i*3]=i%3+version;positions[i*3+1]=Math.floor(i/3)%10;positions[i*3+2]=-8;normals[i*3+2]=1;}
 g.setAttribute('position',new THREE.BufferAttribute(positions,3));g.setAttribute('normal',new THREE.BufferAttribute(normals,3));root.add(new THREE.Mesh(g,library.get('plaster')));
 const handle={score,root,cloth:[]};return{handle,score,center,dispose(){g.dispose();library.dispose();}};
}
function drain(b){for(let frame=0;frame<500&&b.proof.pendingCells;frame++)b.update(12,300,.0805);assert.equal(b.proof.pendingCells,0,'Deterministic queue must terminate');assert.equal(b.proof.error,undefined);}
test('Suspended nonuniform normal packing is isolated from another cell synchronous coverage build',async()=>{
 const old=source('parcel-a',5),next=source('parcel-a',5,2),incoming=source('parcel-b',1005,7);
 const a=next.handle.root.children[0],b=incoming.handle.root.children[0];
 a.rotation.set(.31,.57,-.23);a.scale.set(-1.4,.7,2.3);
 b.rotation.set(-.83,.19,.64);b.scale.set(.23,3.1,.65);
 for(let i=0;i<a.geometry.attributes.normal.count;i++)a.geometry.attributes.normal.setXYZ(i,(i%3-1)*.3,.2+(i%5)*.11,.7);
 function interleave(create){
  const actual=create({budgetMs:6,maxStepsPerFrame:4,now:()=>0}),oracle=createDistrictBatches();
  try{
   actual.rebuild([old]);actual.request([next]);actual.update(1,0,0);
   // For this one-material scalar mesh the first four yields are source,
   // palette, allocation and vertex 512. A's normal-matrix array is live here.
   assert.equal(actual.proof.packingSteps,4);assert.equal(actual.proof.pendingCells,1);
   const before=actual.proof.coverageBuilds;actual.request([next,incoming]);
   assert.equal(actual.proof.coverageBuilds,before+1,'B synchronously packs while A is suspended');
   assert.equal(actual.proof.pendingCells,1,'The unchanged A job must resume rather than restart');
   drain(actual);oracle.rebuild([next,incoming]);
   const buffers=renderer=>{const rows=[];renderer.root.traverse(o=>{if(o.isMesh)rows.push([o.name,Object.fromEntries(['position','normal','index'].map(key=>{const array=(key==='index'?o.geometry.index:o.geometry.attributes[key]).array;return[key,Buffer.from(array.buffer,array.byteOffset,array.byteLength)];}))]);});return new Map(rows);};
   const got=buffers(actual),expected=buffers(oracle),mismatchedBytes={position:0,normal:0,index:0};
   assert.equal(got.size,expected.size);
   for(const[name,attributes]of expected){assert(got.has(name));for(const[key,bytes]of Object.entries(attributes)){const other=got.get(name)[key];assert.equal(other.length,bytes.length);for(let i=0;i<bytes.length;i++)if(other[i]!==bytes[i])mismatchedBytes[key]++;}}
   return mismatchedBytes;
  }finally{actual.dispose();oracle.dispose();}
 }
 try{
  assert.deepEqual(interleave(createDistrictBatches),{position:0,normal:0,index:0},'Every resumed position, normal and index byte matches the synchronous oracle');
  // Test sensitivity: deliberately reintroducing module-shared scratch must
  // corrupt the suffix after the yield. This mutation exists only in memory.
  const moduleURL=new URL('../../kaopu-minigame-workbench/voxel-train-study/game/r20/street/render-batches.mjs',import.meta.url),code=readFileSync(moduleURL,'utf8');
  const local=' const m4=new THREE.Matrix4(),n3=new THREE.Matrix3(),instanceBounds=new THREE.Box3();';
  assert(code.includes(local));
  const mutant=code.replace(local,'').replace('const identity=new THREE.Matrix4();','const identity=new THREE.Matrix4(),m4=new THREE.Matrix4(),n3=new THREE.Matrix3(),instanceBounds=new THREE.Box3();').replace(/from '([^']+)'/g,(_,name)=>"from '"+new URL(name,moduleURL).href+"'");
  const {createDistrictBatches:sharedScratch}=await import('data:text/javascript;base64,'+Buffer.from(mutant).toString('base64'));
  const detected=interleave(sharedScratch);assert.equal(detected.position,0);assert.equal(detected.index,0);assert(detected.normal>1000,'Regression must detect genuinely shared normal-matrix scratch');console.log({sharedScratchMutationDetected:detected});
 }finally{old.dispose();next.dispose();incoming.dispose();}
});
