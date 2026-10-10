import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from '../../../vendor/three.module.js';
import {createDistrictBatches} from '../street/render-batches.mjs';
import {createStreetDistrict,GROUND_Y} from '../street-district.mjs';
import {createRoutePlan,resolveChunk} from '../street/route-plan.mjs';
import * as Instrument from '../street/instrument.mjs';

// Full frozen renderer, not a reconstructed implementation or production import.
const rendererURL=new URL('../street/render-batches.mjs',import.meta.url);
const frozen=fs.readFileSync(new URL('./fixtures/incremental-batches-44d8a769.mjs.txt',import.meta.url),'utf8');
assert.equal(createHash('sha256').update(frozen).digest('hex'),'e66a855a9c172e4094d68765fe000ddf97d933bdafce7a507d62e086575ac009');
const referenceSource=frozen.replace(/from '([^']+)'/g,(_,name)=>"from '"+new URL(name,rendererURL).href+"'");
const {createDistrictBatches:createReference}=await import('data:text/javascript;base64,'+Buffer.from(referenceSource).toString('base64'));
const read=name=>JSON.parse(fs.readFileSync(new URL('../street/'+name,import.meta.url)));
const inputs=()=>({routeScore:read('route.score.json'),anchorScore:read('first-street.score.json')});
const route=[{target:0},{target:700}];
let comparedBytes=0,comparedBatches=0;
function meshMap(renderer){const m=new Map();renderer.root.traverse(o=>{if(o.isMesh)m.set(o.name,o);});return m;}
function sameArray(a,b,label){assert.equal(a.constructor,b.constructor,label);assert.equal(a.byteLength,b.byteLength,label);assert.equal(Buffer.compare(Buffer.from(a.buffer,a.byteOffset,a.byteLength),Buffer.from(b.buffer,b.byteOffset,b.byteLength)),0,label);comparedBytes+=a.byteLength;}
function compare(a,b,label){assert.equal(a.proof.sourceTriangles,b.proof.sourceTriangles,label);assert.equal(a.proof.renderTriangles,b.proof.renderTriangles,label);assert.equal(a.proof.geometryBytes,b.proof.geometryBytes,label);assert.equal(a.proof.instanceBytes,b.proof.instanceBytes,label);const am=meshMap(a),bm=meshMap(b);assert.deepEqual([...am.keys()],[...bm.keys()],label);for(const[key,x]of am){const y=bm.get(key);assert.equal(x.isInstancedMesh,y.isInstancedMesh);assert.equal(x.frustumCulled,y.frustumCulled);assert.deepEqual(x.geometry.drawRange,y.geometry.drawRange);assert.deepEqual(x.userData.streetCulling,y.userData.streetCulling);assert.deepEqual(Object.keys(x.geometry.attributes),Object.keys(y.geometry.attributes));for(const[name,v]of Object.entries(x.geometry.attributes)){sameArray(v.array,y.geometry.attributes[name].array,label+':'+key+':'+name);assert.deepEqual(v.updateRanges,y.geometry.attributes[name].updateRanges);}if(x.geometry.index)sameArray(x.geometry.index.array,y.geometry.index.array,label+':index');if(x.isInstancedMesh){assert.equal(x.count,y.count);sameArray(x.instanceMatrix.array,y.instanceMatrix.array,label+':matrix');sameArray(x.instanceColor.array,y.instanceColor.array,label+':instanceColor');}const xb=x.isInstancedMesh?x.boundingBox:x.geometry.boundingBox,yb=y.isInstancedMesh?y.boundingBox:y.geometry.boundingBox,xs=x.isInstancedMesh?x.boundingSphere:x.geometry.boundingSphere,ys=y.isInstancedMesh?y.boundingSphere:y.geometry.boundingSphere;assert.deepEqual(xb.min.toArray(),yb.min.toArray(),label+':bound min');assert.deepEqual(xb.max.toArray(),yb.max.toArray(),label+':bound max');assert.deepEqual(xs.center.toArray(),ys.center.toArray(),label+':sphere');assert.equal(xs.radius,ys.radius,label+':radius');for(let i=0;i<x.material.userData.tables.length;i++)sameArray(x.material.userData.tables[i].value,y.material.userData.tables[i].value,label+':appearance');comparedBatches++;}}
function check(chunks,label){const a=createReference(),b=createDistrictBatches();try{a.rebuild(chunks);b.rebuild(chunks);a.update(12,350,GROUND_Y);b.update(12,350,GROUND_Y);compare(a,b,label);}finally{a.dispose();b.dispose();}}

test('Scalar packing is byte-identical to frozen Three-vector packing for representative parcels at every LOD',()=>{
 const {routeScore,anchorScore}=inputs(),plan=createRoutePlan(routeScore,route),shared=Instrument.createSharedResources();
 try{for(const detail of ['near','mid','far']){const handles=[];try{const chunks=[0,4,17,18,19,21,36].map(index=>{const c=plan.chunks[index],score=resolveChunk(plan,c,anchorScore,detail),handle=Instrument.build(score,{shared,analyticWind:true});handles.push(handle);return{handle,score,center:c.center};});check(chunks,detail);}finally{for(const h of handles)Instrument.dispose(h);}}}finally{shared.dispose();}
 assert(comparedBytes>10000000);console.log({comparedBatches,comparedBytes});
});

test('Packing preserves normalized/interleaved/half-float attributes, nonuniform transforms and zero normals',()=>{
 const {routeScore,anchorScore}=inputs(),plan=createRoutePlan(routeScore,route),score=resolveChunk(plan,plan.chunks[4],anchorScore,'near'),owner=Instrument.build(score,{analyticWind:true}),root=new THREE.Group(),geometries=[];
 try{const material=owner._library.materials[0];for(let kind=0;kind<4;kind++){const g=new THREE.BufferGeometry();geometries.push(g);if(kind===0){g.setAttribute('position',new THREE.BufferAttribute(new Uint16Array([0,12345,65535,32767,11,2222,65535,32768,0]),3,true));g.setAttribute('normal',new THREE.BufferAttribute(new Int16Array([0,0,0,-32767,1,2000,32767,-999,1]),3,true));}else if(kind===1){const data=new THREE.InterleavedBuffer(new Float32Array([9,1,-2,3,0,0,0,9,-4,5,-6,1,2,3,9,7,-8,9,-3,2,-1]),7);g.setAttribute('position',new THREE.InterleavedBufferAttribute(data,3,1));g.setAttribute('normal',new THREE.InterleavedBufferAttribute(data,3,4));}else if(kind===3){g.setAttribute('position',new THREE.Float16BufferAttribute([.125,-.5,2,-4,8,.03125,16,-32,64].map(THREE.DataUtils.toHalfFloat),3));g.setAttribute('normal',new THREE.Float16BufferAttribute([0,0,0,-1,.25,.5,.5,-.125,1].map(THREE.DataUtils.toHalfFloat),3));}else{g.setAttribute('position',new THREE.BufferAttribute(new Float32Array([-0,1e-7,-2,3.125,-4.25,5.5,-6.25,7.75,-8.5]),3));g.setAttribute('normal',new THREE.BufferAttribute(new Float32Array([-0,0,-0,.001,1,-.001,-1,.25,2]),3));}const m=new THREE.Mesh(g,material);m.position.set(123.456,-7.891,.123);m.rotation.set(.234,-.567,.891);m.scale.set(-1.25,.8,2.3);root.add(m);}const handle={root,score,cloth:[]};check([{handle,score,center:440.123456789}],'attribute edge cases');}finally{for(const g of geometries)g.dispose();Instrument.dispose(owner);}
});

test('Streaming 350–440m preserves every packed byte and bound through cell replacement and pool reuse',async()=>{
 const d=createStreetDistrict(inputs()),reference=createReference();await d.ready;
 const syncReference=distance=>{const chunks=d.handles.map(handle=>({handle,score:handle.score,center:d.proof.activeChunks.find(c=>c.id===handle.score.object.id).center}));reference.rebuild(chunks);reference.update(12,distance,GROUND_Y);};
 const settle=distance=>{for(let n=0;n<30;n++){d.update({distance,elapsed:12},route,{cameraTarget:[-17,2.3,1.2]});syncReference(distance);assert.equal(d.proof.error,undefined);if(!d.proof.pending)return;}throw Error('Unable to settle fixture');};
 try{settle(0);settle(350);for(let distance=350;distance<=440;distance+=5){d.update({distance,elapsed:12},route,{cameraTarget:[-17,2.3,1.2]});syncReference(distance);compare(reference,d.renderBatches,'distance '+distance);assert.deepEqual(d.proof.coverage.missing,[]);}}finally{reference.dispose();d.dispose();}
 console.log({totalComparedBatches:comparedBatches,totalComparedBytes:comparedBytes});
});
