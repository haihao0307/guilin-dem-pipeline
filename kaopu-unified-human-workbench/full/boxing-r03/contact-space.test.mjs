import assert from 'node:assert/strict';
import * as THREE from '../source/registration-vendor/three.module.js';
import {nativeVectorToWorld,worldVectorToNative,requireRigidActorTransform,contactOverlay,updateGloveCentersOnly} from './ContactSpace.mjs';
import {createGlovePair} from '../boxing-r02/Gloves.mjs';
const v=[.022,-.046,.031];let worst=0;
for(let i=0;i<120;i++){
  const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(i*.037,i*.11,i*.07)),m=new THREE.Matrix4().compose(new THREE.Vector3(i,1,-i),q,new THREE.Vector3(1,1,1));requireRigidActorTransform(m.elements);
  const n=worldVectorToNative(m.elements,nativeVectorToWorld(m.elements,v));worst=Math.max(worst,Math.hypot(...n.map((x,k)=>x-v[k])));
  const x=contactOverlay({group:{matrixWorld:m}},{offset:v,head:[.1,0,0],lastContact:{source:'JoltPhysics.js/test',contactPoint:[0,0,0],pairId:0,attackerId:0,defenderId:1,hand:'L',time:.5}});assert.equal(x.space,'native-local-z-up');
}
assert(worst<1e-12);assert.throws(()=>requireRigidActorTransform(new THREE.Matrix4().makeScale(-1,1,1).elements));assert.throws(()=>requireRigidActorTransform(new THREE.Matrix4().makeScale(1,2,1).elements));
const names=['wrist.L','finger3-1.L','finger2-1.L','finger5-1.L','finger1-1.L','lowerarm01.L','wrist.R','finger3-1.R','finger2-1.R','finger5-1.R','finger1-1.R','lowerarm01.R'];
const matrices=names.map((_,i)=>[1,0,0,i*.01,0,1,0,-i*.013,0,0,1,1+i*.012,0,0,0,1]),gloves=createGlovePair({names});const actor={gloves,latest:{posedMatrices:matrices}};
updateGloveCentersOnly(actor);const prior=gloves.map(g=>g.position.clone());for(const g of gloves)g.updateFromPose(matrices);const centerError=Math.max(...gloves.map((g,i)=>g.position.distanceTo(prior[i])));assert(centerError<1e-12);
console.log(JSON.stringify({passed:true,roundTrips:120,worstVectorError:worst,gloveCenterError:centerError,translationExcluded:true,nonRigidTransformsRejected:true}));
