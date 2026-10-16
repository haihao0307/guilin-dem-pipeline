import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import *as T from 'three';
import {buildTrain} from '../src/model.mjs';
import {createCoach} from './coach.mjs';
import {createTransition} from './transition.mjs';
import {sectionAt} from '../src/design/continuous-shell.mjs';
import {retainedInventory} from '../tests/coach-inventory.mjs';

const train=buildTrain(T),coach=createCoach(T);coach.root.position.x=40.71;train.root.add(coach.root);
const retainedBefore=retainedInventory(coach.root);
const wheels=[...train.wheels.map(w=>w.object),...coach.details.wheels];
const hashWheels=()=>wheels.map(w=>{const h=createHash('sha256');w.traverse(o=>{if(!o.isMesh)return;for(const a of Object.values(o.geometry.attributes))h.update(new Uint8Array(a.array.buffer,a.array.byteOffset,a.array.byteLength));});return h.digest('hex');});
const wheelHashes=hashWheels();
const buffers=[];coach.root.traverse(o=>{if(o.isMesh&&/Buffer ram|Round buffer face|Centre drawbar|Coupler forged eye|Flexible end brake hose|Hose coupling head/.test(o.name))buffers.push(o);});
const transition=createTransition(T,train.M,{coachRoot:coach.root});train.root.add(transition.root);
assert.equal(transition.root.userData.outerLeaves,7);assert.equal(transition.root.userData.bellowsFolds,12);
assert(transition.details.outerPanels.every(p=>p.material===train.M.paint),'Retain parent original paint mother');
assert.equal(coach.details.wheels.length,8);assert.equal(coach.details.commuter.seats.length,24);
assert.equal(coach.details.commuter.loops.length,52);assert.equal(coach.details.windows.length,12);
const skins=[...transition.details.outerPanels,transition.details.bellows,...transition.details.clamps];
let checkedPoses=0,lowestVolume=Infinity,minLeafOverlap=Infinity;
const states=[{}, {yawDeg:2}, {yawDeg:-2}, {pitchDeg:1}, {pitchDeg:-1}, {strokeM:.045}, {strokeM:-.045}];
for(let mask=0;mask<32;mask++){const s={};['yawDeg','pitchDeg','strokeM','lateralM','verticalM'].forEach((k,i)=>s[k]=transition.details.limits[k]*(mask&(1<<i)?1:-1));states.push(s);}
for(const state of states){
 transition.setArticulation(state);train.root.updateMatrixWorld(true);checkedPoses++;
 transition.root.traverse(o=>{if(!o.isMesh)return;for(const a of Object.values(o.geometry.attributes))assert(Array.from(a.array).every(Number.isFinite),o.name+' finite attributes');assert(o.matrixWorld.elements.every(Number.isFinite),o.name+' finite world matrix');});
 for(const mesh of skins){
  const g=mesh.geometry,edges=new Map(),idx=g.index.array,p=g.attributes.position;let volume=0;
  const a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3();
  for(let i=0;i<idx.length;i+=3){a.fromBufferAttribute(p,idx[i]);b.fromBufferAttribute(p,idx[i+1]);c.fromBufferAttribute(p,idx[i+2]);volume+=a.dot(b.cross(c))/6;for(let j=0;j<3;j++){const key=[idx[i+j],idx[i+(j+1)%3]].sort((a,b)=>a-b).join(',');edges.set(key,(edges.get(key)||0)+1);}}
  assert([...edges.values()].every(n=>n===2),mesh.name+' closed edge incidence');assert(volume>0,mesh.name+' positive finite volume');lowestVolume=Math.min(lowestVolume,volume);
 }
 for(let i=0;i<transition.details.outerPanels.length-1;i++){
  const a=transition.details.outerPanels[i].geometry.attributes.position,b=transition.details.outerPanels[i+1].geometry.attributes.position;
  const stride=129,row=stride*2,last=5*row;
  for(let j=0;j<stride;j++){const overlap=a.getX(last+j)-b.getX(j);assert(overlap>0,'Adjacent shroud leaves stay overlapped');minLeafOverlap=Math.min(minLeafOverlap,overlap);}
 }
 const clearance=transition.checkClearances({wheels,buffers,wheelAllowanceM:.04,bufferAllowanceM:.025});
 assert(clearance.allClear,JSON.stringify({state,failures:clearance.results.filter(r=>!r.clear)}));
}
transition.setArticulation({});assert.deepEqual(coach.root.position.toArray(),[40.71,0,0]);
assert.deepEqual(retainedInventory(coach.root),retainedBefore,'Every retained chassis/end mesh unchanged');
assert.deepEqual(hashWheels(),wheelHashes,'All original wheel buffers unchanged');
for(const bad of[{yawDeg:NaN},{pitchDeg:Infinity},{yawDeg:3.01},{strokeM:.046}])assert.throws(()=>transition.setArticulation(bad));
transition.setExteriorVisible(false);assert(!transition.details.exterior.visible&&transition.details.mechanical.visible&&coach.details.chassis.visible);transition.setExteriorVisible(true);
const hems=coach.details.fairings.map(m=>m.geometry.boundingBox.min.z);assert(hems.every(z=>Math.abs(z-1.11)<1e-6));
console.log(JSON.stringify({status:'PASS',test:'R04 coach/transition.mjs',sampledPoses:checkedPoses,sourceEndSection:sectionAt(28.30),gapM:transition.root.userData.gapM,outerLeaves:7,nominalLeafOverlapM:.034,minimumSampledLeafOverlapXM:minLeafOverlap,finiteClosedVolumes:skins.length,smallestSampledVolumeM3:lowestVolume,independentClearanceChecks:{wheels:wheels.length,wheelAllowanceM:.04,coachBuffersDrawbarsAndHoses:buffers.length,bufferAllowanceM:.025,method:'Conservative per-triangle skin AABB vs individual protected-object expanded AABB at 39 poses; all clear'},retainedChassisEndMeshes:retainedBefore.length,retainedWheelBufferHashes:true,raisedCoachHemM:hems,sourceUnderframeUnchanged:true,originalMaterialsRetained:true,nonfiniteAndOutOfBoundsRejected:true,engineeringCertification:false,limitations:'39 sampled poses and overlap tests are geometric evidence only. No continuous envelope proof, suspension dynamics, buffer force, brake pressure/topology, aerodynamic performance or 250 km/h certification.'},null,2));
