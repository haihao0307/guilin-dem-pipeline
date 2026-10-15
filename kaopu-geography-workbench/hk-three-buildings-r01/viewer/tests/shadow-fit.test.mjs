import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from '../vendor/three.module.js';import {fitDirectionalShadow} from '../shadow-fit.mjs';
test('shadow camera encloses metre bounds, tightens on selection and is camera-independent',()=>{
 const light=new THREE.DirectionalLight();light.position.set(90,150,80);light.shadow.mapSize.set(2048,2048);
 const boxes=[new THREE.Box3(new THREE.Vector3(-55,0,-34),new THREE.Vector3(55,71,34)),new THREE.Box3(new THREE.Vector3(-8,0,-10),new THREE.Vector3(8,11,10))];
 const all=fitDirectionalShadow(light,boxes[0],THREE),one=fitDirectionalShadow(light,boxes[1],THREE);assert.ok(one.worldTexelM<all.worldTexelM);assert.ok(one.normalBiasM>0&&one.normalBiasM<.05);assert.ok(all.normalBiasM<.15);assert.ok(one.depthBias<0);assert.deepEqual(fitDirectionalShadow(light,boxes[1],THREE),one);
 light.shadow.updateMatrices(light);const b=boxes[1].clone().expandByScalar(6);for(const x of[b.min.x,b.max.x])for(const y of[b.min.y,b.max.y])for(const z of[b.min.z,b.max.z]){const p=new THREE.Vector3(x,y,z).project(light.shadow.camera);assert.ok(Math.abs(p.x)<=1&&Math.abs(p.y)<=1&&Math.abs(p.z)<=1);}
});
