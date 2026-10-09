import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from '../source/registration-vendor/three.module.js';
import {createGlovePair,createGloveGeometry,gloveDiagnostics,GLOVE_SPEC} from './Gloves.mjs';
const [left,right]=createGlovePair();
assert.equal(left.geometry.userData.triangles,792);assert(left.geometry.userData.triangles<800);
assert.equal(left.material,right.material);assert.equal(createGlovePair()[0].baseGeometry,left.baseGeometry);assert.notEqual(createGlovePair()[0].geometry,left.geometry);
const a=left.geometry.attributes.position,b=right.geometry.attributes.position;
for(let i=0;i<a.count;i++){assert.equal(a.getX(i),-b.getX(i));assert.equal(a.getY(i),b.getY(i));assert.equal(a.getZ(i),b.getZ(i));}
for(const g of [left.geometry,right.geometry]){assert([...g.attributes.position.array,...g.attributes.normal.array,...g.attributes.color.array].every(Number.isFinite));const ind=g.index.array,p=g.attributes.position;let min=Infinity;for(let i=0;i<ind.length;i+=3){const aa=new THREE.Vector3().fromBufferAttribute(p,ind[i]),bb=new THREE.Vector3().fromBufferAttribute(p,ind[i+1]),cc=new THREE.Vector3().fromBufferAttribute(p,ind[i+2]);const area=bb.sub(aa).cross(cc.sub(aa)).length()/2;min=Math.min(min,area);}assert(min>1e-10,'Nondegenerate triangles');}
const w=new THREE.Vector3(0,0,0),k=new THREE.Vector3(0,.1,0),r=new THREE.Vector3(.03,.1,0),u=new THREE.Vector3(-.03,.1,0);
left.update({wrist:w,knuckle:k,radial:r,ulnar:u,height:1.75});right.update({wrist:w,knuckle:k,radial:u,ulnar:r,height:1.75});assert(left.position.distanceTo(new THREE.Vector3(0,.075,0))<1e-8);assert(left.quaternion.angleTo(new THREE.Quaternion())<1e-8);assert(right.quaternion.angleTo(left.quaternion)<1e-8);
console.log(JSON.stringify({passed:true,geometry:gloveDiagnostics()},null,2));
