import fs from 'node:fs';
import vm from 'node:vm';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import * as THREE from '../vendor/three.module.js';
import * as Ocular from '../src/ocular-r04.js';
import * as Oral from '../src/oral-r04.js';
import {createOcularBatch,deformInto,VERSION} from '../src/ocular-batch-r07.js';
const B=createRequire(import.meta.url)('../src/behavior.js'),anchor=JSON.parse(fs.readFileSync(new URL('../TASK_ANCHOR_R07.json',import.meta.url)));
const base=execFileSync('git',['-c','core.fsmonitor=false','show',anchor.baseSha+':fish-five-r01/src/app.js'],{encoding:'utf8'}),candidate=fs.readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
const oralMetadata=JSON.parse(fs.readFileSync(new URL('../data/oral-runtime-r04.json',import.meta.url))),ids=Object.keys(B.profiles),tests=[],failures=[];
const palette={herring:0x799193,'tuna-yellow-label':0xa5a373,'tuna-blue-label':0x859396,colorful:0x9d954e,picasso:0xb59d67};
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const span=(s,start,end)=>{const a=s.indexOf(start),b=s.indexOf(end,a);assert.ok(a>=0&&b>a,start);return s.slice(a,b);};
const difference=(a,b)=>{assert.equal(a.length,b.length);let max=0;for(let i=0;i<a.length;i++)max=Math.max(max,Math.abs(a[i]-b[i]));return max;};
const check=async(label,fn)=>{try{tests.push({label,pass:true,...await fn()});console.log('PASS '+label);}catch(e){tests.push({label,pass:false,error:e.message});failures.push({label,error:e.message});console.log('FAIL '+label+' '+e.message);}};
const makeContext=(text,data,count,optimized)=>{
  const allocations={Vector3:0,Matrix4:0,Quaternion:0};const T={...THREE};for(const key of Object.keys(allocations))T[key]=class extends THREE[key]{constructor(...a){super(...a);allocations[key]++;}clone(){if(key==='Matrix4')allocations[key]++;return super.clone();}};
  const behavior=B.create(data.id,count,2601002),ctx={THREE:T,Behavior:B,Ocular,Oral,oralMetadata,PALETTE:palette,createOcularBatch,deformInto,score:data,behavior,specimens:new THREE.Group(),eyes:[],ocularBatch:null,finBindings:[],posesDirty:true,posesBones:null,posesReference:null,state:{selected:data.id,group:count===30,bones:false,reference:false,orbit:{yaw:.31,pitch:.2,distance:count===30?10:2.15}},target:new THREE.Vector3(),camera:new THREE.PerspectiveCamera(36,1.2,.01,80),bodyMeshes:[],sourceMeshes:[],boneLines:null,poseTex:new THREE.DataTexture(new Float32Array(65*2*count*4),65,2*count),finTex:new THREE.DataTexture(new Float32Array(16*count*4),16,count),clamp:(v,a,b)=>Math.max(a,Math.min(b,v))};
  const context=vm.createContext(ctx);
  vm.runInContext(span(text,'function canonicalFinKind(', 'async function unpack(')+span(text,'function makeEyes(', 'function makeBones('),context);context.makeEyes(data);
  for(const p of data.primitives){const mesh=new THREE.InstancedMesh(new THREE.BufferGeometry(),new THREE.MeshBasicMaterial(),count);mesh.userData.primitive=p;ctx.bodyMeshes.push(mesh);}
  ctx.boneLines=new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position',new THREE.BufferAttribute(new Float32Array(4092),3)),new THREE.LineBasicMaterial());
  vm.runInContext(span(text,'const matrix=new THREE.Matrix4()', 'function updateUI(')+span(text,'function updateCamera(', 'function updateReadout('),context);
  if(optimized)vm.runInContext(`finBindings=score.rig.fins.map(f=>({f,kind:canonicalFinKind(f),median:score.id==='picasso'&&['dorsal','anal'].includes(canonicalFinKind(f))}));headLocal.set(0,0,0);for(const eye of score.eyes){headLocal.x+=eye.center[0];headLocal.y+=eye.center[1];headLocal.z+=eye.center[2];}headLocal.multiplyScalar(1/score.eyes.length);headLocal.x=(headLocal.x-.5)*.5;headPoint[0]=headLocal.x;headPoint[1]=headLocal.y;headPoint[2]=headLocal.z;`,context);
  const measured=ctx.eyes[0].objects.map(item=>{const axes=[new THREE.Vector3(1,0,0),new THREE.Vector3(0,1,0),new THREE.Vector3(0,0,1)].map(v=>v.applyQuaternion(item.baseQ).toArray()),optic=item.opticAxis.clone().multiply(new THREE.Vector3().fromArray(item.localRadii)).normalize();return {...item.eye,sourceFrame:{x:axes[0],y:axes[1],normal:axes[2]},opticAxis:optic.toArray()};});
  const rec=oralMetadata.specimens.find(s=>s.id===data.id)?.productionRecommendation;
  for(const actor of behavior.actors){actor.ocularR04=Ocular.create(data.id,2601002,actor.index,measured);actor.oralR04=Oral.create(data.id,2601002,actor.index,rec?.signedMaxAngleRad||0);}
  return {ctx,context,allocations};
};
await check('Protected source-position reconstruction and deformation shader are byte unchanged',()=>{
  for(const [start,end] of [['function sourcePositions(','function makeBody('],['const DEFORM_GLSL=','function canonicalFinKind(']])assert.equal(span(candidate,start,end),span(base,start,end));
  return {sourcePositionsSha256:sha(span(candidate,'function sourcePositions(','function makeBody(')),bodyShaderSha256:sha(span(candidate,'const DEFORM_GLSL=','function canonicalFinKind('))};
});
for(const id of ids){
 const data=JSON.parse(zlib.gunzipSync(fs.readFileSync(new URL('../data/'+id+'.score.json.gz',import.meta.url))));
 await check(id+' exact body GPU attributes and zero-copy typed source buffers',()=>{
  const typed={...data,primitives:data.primitives.map(p=>({...p,normals:Float32Array.from(p.normals),uvs:Float32Array.from(p.uvs),finGradient:Float32Array.from(p.finGradient),indices:Uint32Array.from(p.indices)}))};
  const make=text=>{const ctx={THREE,Float32Array,Uint32Array,oralMetadata,behavior:{actors:Array(30).fill(null)},specimens:new THREE.Group(),bodyMeshes:[],sourceMeshes:[],materialFor:()=>new THREE.MeshBasicMaterial()};vm.createContext(ctx);vm.runInContext(span(text,'function sourcePositions(', 'function makeEyes('),ctx);ctx.makeBody(typed,[]);return ctx;};
  const old=make(base),fresh=make(candidate);let avoidedCpuCopyBytes=0;
  for(let i=0;i<typed.primitives.length;i++){
    const p=typed.primitives[i],a=old.bodyMeshes[i].geometry,b=fresh.bodyMeshes[i].geometry;
    for(const key of Object.keys(a.attributes))assert.deepEqual(b.attributes[key].array,a.attributes[key].array,'exact GPU '+key);assert.deepEqual(b.index.array,a.index.array);
    for(const [key,source] of [['normal',p.normals],['uv',p.uvs],['finGradient',p.finGradient]]){assert.equal(b.attributes[key].array,source);assert.notEqual(a.attributes[key].array,source);avoidedCpuCopyBytes+=source.byteLength;}
    assert.equal(b.index.array,p.indices);assert.notEqual(a.index.array,p.indices);avoidedCpuCopyBytes+=p.indices.byteLength;assert.equal(fresh.sourceMeshes[i].geometry,b);
  }
  return {primitives:typed.primitives.length,avoidedCpuCopyBytes,positionsStillSourceParameterized:true,allGpuAttributesBitExact:true,referenceSharesGeometry:true};
 });
 await check(id+' original full eye geometry, uniforms and physical fragment material retained',()=>{
  const old=makeContext(base,data,30,false),fresh=makeContext(candidate,data,30,true),a=old.ctx.eyes[0].objects,b=fresh.ctx.eyes[0].objects;
  for(let k=0;k<a.length;k++){
   for(const attr of ['position','normal','uv'])assert.deepEqual(b[k].pupil.geometry.attributes[attr].array,a[k].pupil.geometry.attributes[attr].array);assert.deepEqual(b[k].pupil.geometry.index.array,a[k].pupil.geometry.index.array);
   for(const key of ['roughness','metalness','clearcoat','clearcoatRoughness','side','transparent','depthTest','depthWrite','opacity','transmission','ior','envMapIntensity'])assert.equal(b[k].pupil.material[key],a[k].pupil.material[key],key);
   for(const key of ['center','localRadii'])assert.deepEqual(b[k].eye[key],a[k].eye[key]);assert.deepEqual(b[k].displayCenter,a[k].displayCenter);assert.deepEqual(b[k].baseQ.toArray(),a[k].baseQ.toArray());assert.deepEqual(b[k].opticAxis.toArray(),a[k].opticAxis.toArray());
   const shader=()=>({uniforms:{},vertexShader:'#include <begin_vertex>\n#include <defaultnormal_vertex>',fragmentShader:'#include <color_fragment>'}),os=shader(),ns=shader();a[k].pupil.material.onBeforeCompile(os);b[k].pupil.material.onBeforeCompile(ns);
   assert.equal(ns.fragmentShader,os.fragmentShader);assert.deepEqual(ns.uniforms.eyeOptic.value.toArray(),os.uniforms.eyeOptic.value.toArray());assert.deepEqual(ns.uniforms.eyeIris.value.toArray(),os.uniforms.eyeIris.value.toArray());assert.ok(ns.vertexShader.includes('mat3(instanceNormalX,instanceNormalY,instanceNormalZ) * transformedNormal'));assert.ok(!ns.vertexShader.includes('transformedNormal /= vec3( dot( im'));
  }
  assert.equal(fresh.ctx.ocularBatch.batches.length,a.length);assert.equal(new Set(fresh.ctx.eyes.flatMap(e=>e.objects.map(i=>i.pupil.geometry))).size,a.length);assert.equal(new Set(fresh.ctx.eyes.flatMap(e=>e.objects.map(i=>i.pupil.material))).size,a.length);
  return {eyesPerFish:a.length,count:30,eyeDrawsBefore:a.length*30,eyeDrawsAfter:a.length,eyeSphereTriangles:a[0].pupil.geometry.index.count/3,fragmentShaderByteExact:true,sourceAttributesBitExact:true,normalRoute:'CPU exact inverse-transpose; float32 instance columns'};
 });
 await check(id+' R06 original pose/camera numerical equivalence across single/group, states, extreme gazes and skeleton',()=>{
  let maxWorldMatrixError=0,maxFloat32WorldMatrixError=0,maxNormalDirectionError=0,maxCameraError=0,maxDeformError=0,frames=0;const allocationRows=[];
  for(const count of [1,30]){
   const old=makeContext(base,data,count,false),fresh=makeContext(candidate,data,count,true);
   for(const mode of ['cruise','hover','burst','turn','rest'])for(let frame=0;frame<64;frame++){
    const dt=[1/60,1/30,1/90,1/48][frame%4];for(const run of [old,fresh]){const {ctx}=run;B.update(ctx.behavior,dt,{mode,centered:count===1});for(const actor of ctx.behavior.actors){Ocular.update(actor.ocularR04,dt,{mode,turnRate:actor.turnRate});Oral.update(actor.oralR04,dt,{mode,effort:actor.threat});}if(frame===63)for(const actor of ctx.behavior.actors)for(const e of actor.ocularR04.eyes){e.yaw=e.side*.18;e.pitch=.075;}ctx.state.bones=frame%8===0;ctx.state.orbit.detail=count===1&&frame%2===0;}
    old.ctx.updatePoses();fresh.ctx.updatePoses();old.ctx.specimens.updateMatrixWorld(true);fresh.ctx.specimens.updateMatrixWorld(true);
    assert.deepEqual(fresh.ctx.poseTex.image.data,old.ctx.poseTex.image.data);assert.deepEqual(fresh.ctx.finTex.image.data,old.ctx.finTex.image.data);
    assert.deepEqual(fresh.ctx.boneLines.geometry.attributes.position.array,old.ctx.boneLines.geometry.attributes.position.array);
    for(let k=0;k<old.ctx.bodyMeshes.length;k++)assert.deepEqual(fresh.ctx.bodyMeshes[k].instanceMatrix.array,old.ctx.bodyMeshes[k].instanceMatrix.array);
    for(let i=0;i<count;i++)for(let k=0;k<old.ctx.eyes[i].objects.length;k++){
     const a=old.ctx.eyes[i].objects[k],b=fresh.ctx.eyes[i].objects[k],exact=a.pupil.matrixWorld.elements,batched=b.batch.instanceMatrix.array.subarray(i*16,i*16+16);
     maxWorldMatrixError=Math.max(maxWorldMatrixError,difference(exact,b.pupil.matrixWorld.elements));maxFloat32WorldMatrixError=Math.max(maxFloat32WorldMatrixError,difference(exact,batched));
     const normal=new THREE.Matrix3().getNormalMatrix(a.pupil.matrixWorld),n32=new THREE.Matrix3(),elements=[];for(const array of b.normalArrays)elements.push(...array.subarray(i*3,i*3+3));n32.fromArray(elements);
     for(const v of [[1,0,0],[0,1,0],[0,0,1],[.3,.5,.7]]){const n=new THREE.Vector3().fromArray(v).applyMatrix3(normal).normalize(),q=new THREE.Vector3().fromArray(v).applyMatrix3(n32).normalize();maxNormalDirectionError=Math.max(maxNormalDirectionError,n.distanceTo(q));}
    }
    old.ctx.updateCamera(dt);fresh.ctx.updateCamera(dt);maxCameraError=Math.max(maxCameraError,old.ctx.camera.position.distanceTo(fresh.ctx.camera.position),difference(old.ctx.camera.quaternion.toArray(),fresh.ctx.camera.quaternion.toArray()));frames++;
   }
   for(const allocations of [old.allocations,fresh.allocations])for(const key in allocations)allocations[key]=0;
   for(let i=0;i<30;i++){old.ctx.updatePoses();fresh.ctx.updatePoses();old.ctx.updateCamera(1/60);fresh.ctx.updateCamera(1/60);}allocationRows.push({count,frames:30,before:{...old.allocations},after:{...fresh.allocations}});
   for(const key in fresh.allocations)assert.equal(fresh.allocations[key],0,'no per-pose/camera '+key+' allocation');
   for(const actor of fresh.ctx.behavior.actors){const spine=B.sampleSpine(actor,id);for(const p of [[-.6,.1,.2],[-.5,-.02,.04],[-.22,.03,-.05],[.49,.1,.2],[.6,.02,.03]]){const original=B.deform(p,actor,id,spine),into=deformInto(new THREE.Vector3(),p,spine).toArray();maxDeformError=Math.max(maxDeformError,difference(original,into));}}
   const pv=fresh.ctx.poseTex.version,fv=fresh.ctx.finTex.version,iv=fresh.ctx.ocularBatch.batches.map(b=>b.instanceMatrix.version);fresh.ctx.updatePoses(false);fresh.ctx.updatePoses(false);assert.equal(fresh.ctx.poseTex.version,pv);assert.equal(fresh.ctx.finTex.version,fv);assert.deepEqual(fresh.ctx.ocularBatch.batches.map(b=>b.instanceMatrix.version),iv);
  }
  assert.ok(maxWorldMatrixError<1e-12);assert.ok(maxFloat32WorldMatrixError<5e-7);assert.ok(maxNormalDirectionError<1e-6);assert.ok(maxCameraError<1e-12);assert.ok(maxDeformError<1e-15);
  return {frames,maxWorldMatrixError,maxFloat32WorldMatrixError,maxNormalDirectionError,maxCameraError,maxDeformError,poseAndFinTexturesBitExact:true,bodyInstanceMatricesBitExact:true,skeletonFloat32BitExact:true,pausedUploadsZero:true,allocationRows};
 });
}
await check('Shared geometry, materials, textures and instance storage are disposed exactly once',()=>{
 const data=JSON.parse(zlib.gunzipSync(fs.readFileSync(new URL('../data/herring.score.json.gz',import.meta.url)))),ocularBatch=createOcularBatch({THREE,data,count:30,palette}),specimens=new THREE.Group(),counts={eyeGeometry:0,eyeMaterial:0,eyeInstances:0,bodyGeometry:0,bodyMaterial:0,bodyTexture:0,bodyInstances:0,pose:0,fin:0};
 for(const batch of ocularBatch.batches){specimens.add(batch);batch.geometry.addEventListener('dispose',()=>counts.eyeGeometry++);batch.material.addEventListener('dispose',()=>counts.eyeMaterial++);batch.addEventListener('dispose',()=>counts.eyeInstances++);}
 const geometry=new THREE.BufferGeometry(),texture=new THREE.Texture(),material=new THREE.MeshStandardMaterial({map:texture,roughnessMap:texture,metalnessMap:texture}),body=new THREE.InstancedMesh(geometry,material,30),reference=new THREE.Mesh(geometry,material),poseTex=new THREE.DataTexture(),finTex=new THREE.DataTexture();specimens.add(body,reference);
 for(const [object,key] of [[geometry,'bodyGeometry'],[material,'bodyMaterial'],[texture,'bodyTexture'],[body,'bodyInstances'],[poseTex,'pose'],[finTex,'fin']])object.addEventListener('dispose',()=>counts[key]++);
 const ctx={specimens,ocularBatch,bodyMeshes:[body],sourceMeshes:[reference],eyes:ocularBatch.eyes,boneLines:null,finBindings:[],poseTex,finTex,posesDirty:false};vm.createContext(ctx);vm.runInContext(span(candidate,'function disposeSpecimen(', 'function makePoseTextures('),ctx);ctx.disposeSpecimen();
 assert.deepEqual(counts,{eyeGeometry:2,eyeMaterial:2,eyeInstances:2,bodyGeometry:1,bodyMaterial:1,bodyTexture:1,bodyInstances:1,pose:1,fin:1});assert.equal(specimens.children.length,0);assert.equal(ctx.poseTex,null);assert.equal(ctx.finTex,null);assert.equal(ctx.ocularBatch,null);return {counts,sharedResourcesReleasedOnce:true};
});
await check('Bounded texture ownership, late completion disposal and exact descriptor sharing',async()=>{
 let disposed=0,urlsCreated=0,urlsRevoked=0;const queue=[];
 class Image {set src(value){this.value=value;queue.push(this);}}
 class Texture extends THREE.Texture {dispose(){disposed++;super.dispose();}}
 const T={...THREE,Texture},textureCache=new Map(),ctx={THREE:T,textureCache,Image,Blob,Uint8Array,URL:{createObjectURL(){urlsCreated++;return 'blob:fixture-'+urlsCreated;},revokeObjectURL(){urlsRevoked++;}},renderer:{capabilities:{getMaxAnisotropy:()=>8}},poseTex:null,finTex:null,behavior:{actors:[{}]},DEFORM_GLSL:''};
 vm.createContext(ctx);vm.runInContext(span(candidate,'function imageURI(', 'function disposeSpecimen('),ctx);
 const source={id:'same',images:[{uri:'data:image/png;base64,EXACT'},{encodedBytes:new Uint8Array([1,2,3]),mimeType:'image/png'}]};
 const a=ctx.createTextures(source,1),b=ctx.createTextures(source,2);assert.equal(queue.length,2);assert.equal(textureCache.size,1);assert.equal(textureCache.get('same').owners.size,2);for(const image of queue.splice(0))image.onload();const [ta,tb]=await Promise.all([a,b]);assert.equal(ta,tb);assert.equal(textureCache.get('same').owners.size,0);assert.equal(urlsCreated,1);assert.equal(urlsRevoked,1);
 const data={materials:[{pbrMetallicRoughness:{baseColorTexture:{index:0},metallicRoughnessTexture:{index:0}},normalTexture:{index:0}}]},uniforms={};
 const m1=ctx.materialFor(data,0,ta,uniforms,false),m2=ctx.materialFor(data,0,ta,uniforms,false);assert.equal(m1.map,m2.map);assert.equal(m1.normalMap,m2.normalMap);assert.equal(m1.normalMap,m1.roughnessMap);assert.notEqual(m1.map,m1.normalMap);
 const changed={materials:[{pbrMetallicRoughness:{baseColorTexture:{index:0,texCoord:1,extensions:{KHR_texture_transform:{offset:[.2,.3],scale:[2,3],rotation:.4}}}}}]};const m3=ctx.materialFor(changed,0,ta,uniforms,false);assert.notEqual(m3.map,m1.map);assert.deepEqual(m3.map.offset.toArray(),[.2,.3]);assert.deepEqual(m3.map.repeat.toArray(),[2,3]);assert.equal(m3.map.rotation,.4);assert.equal(m3.map.channel,1);
 const late=ctx.createTextures({id:'old',images:[{uri:'data:image/png;base64,EXACT'}]},3);ctx.releaseTexturesExcept('same');queue.shift().onload();await assert.rejects(late);assert.ok(!textureCache.has('old'));assert.equal(textureCache.size,1);
 const bad=ctx.createTextures({id:'bad',images:[{uri:'data:image/png;base64,EXACT'},{uri:'data:image/png;base64,EXACT'}]},4);queue.shift().onload();queue.shift().onerror();await assert.rejects(bad);assert.ok(!textureCache.has('bad'));
 const before=disposed;ctx.releaseTexturesExcept(null);assert.equal(disposed-before,2);assert.equal(textureCache.size,0);
 return {sameSourcePromiseDecodedOnce:true,sameDescriptorTextureShared:true,differentColorSpaceAndTransformSeparated:true,staleResultDisposed:true,partialDecodeFailureReleased:true,encodedBytesViaBlobURL:true,urlsCreated,urlsRevoked};
});
const report={schema:'fish.instance-lane-r07/1',taskId:anchor.taskId,baseSha:anchor.baseSha,dispatchTime:anchor.dispatchTime,verifiedAt:new Date().toISOString(),version:VERSION,sourceHashes:{app:sha(fs.readFileSync(new URL('../src/app.js',import.meta.url))),ocularBatch:sha(fs.readFileSync(new URL('../src/ocular-batch-r07.js',import.meta.url)))},pass:!failures.length,tests,failures,scope:'R06 source/CPU mathematics, exact sphere attributes, material fragment/uniform equivalence, full inverse-transpose normal matrices and simulated texture ownership. GPU floating point/rasterization, source-loader worker lifecycle and published HTML require independent actual-browser evidence.',visualAcceptance:false,productionReady:false};
fs.mkdirSync(new URL('../evidence/',import.meta.url),{recursive:true});fs.writeFileSync(new URL('../evidence/R07_INSTANCE_LANE.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify({pass:report.pass,tests:tests.length,failures},null,2));if(failures.length)process.exitCode=1;
