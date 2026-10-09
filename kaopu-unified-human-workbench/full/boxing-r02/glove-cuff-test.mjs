import assert from 'node:assert/strict';import fs from 'node:fs';
import * as THREE from '../source/registration-vendor/three.module.js';
import {createGlovePair} from './Gloves.mjs';
const names=['L','R'].flatMap(s=>['wrist','finger3-1','finger2-1','finger5-1','lowerarm01'].map(x=>x+'.'+s));
const mat=(x,y,z)=>[1,0,0,x,0,1,0,-z,0,0,1,y,0,0,0,1];
const poses=['L','R'].flatMap(s=>[mat(0,0,0),mat(0,.1,0),mat(s==='L'?.03:-.03,.1,0),mat(s==='L'?-.03:.03,.1,0),mat(.04,-.25,.10)]);
const gloves=Array.from({length:36},(_,i)=>createGlovePair({names,color:i%2?0xc56e43:0x2f90b6})).flat();
assert.equal(gloves[0].baseGeometry,gloves[4].baseGeometry);assert.notEqual(gloves[0].geometry.attributes.position.array,gloves[4].geometry.attributes.position.array);assert.notEqual(gloves[0].geometry.attributes.normal.array,gloves[4].geometry.attributes.normal.array);
const untouched=Array.from(gloves[4].geometry.attributes.position.array);gloves[0].updateFromPose(poses);assert(untouched.every((v,i)=>v===gloves[4].geometry.attributes.position.array[i]));
const src=gloves[0].baseGeometry.attributes.position,dst=gloves[0].geometry.attributes.position;for(let i=0;i<src.count;i++)if(src.getY(i)>=-.068){assert.equal(dst.getX(i),src.getX(i));assert.equal(dst.getY(i),src.getY(i));assert.equal(dst.getZ(i),src.getZ(i));}
const samples=[];for(let f=0;f<300;f++){const start=performance.now();for(const g of gloves)g.updateFromPose(poses);if(f>=60)samples.push(performance.now()-start);}samples.sort((a,b)=>a-b);
const result={passed:true,runtime:'Node '+process.version+'; CPU-only microbenchmark, not browser FPS',gloves:72,frames:240,meanMS:samples.reduce((a,b)=>a+b)/samples.length,medianMS:samples[Math.floor(samples.length*.5)],p95MS:samples[Math.floor(samples.length*.95)],trianglesPerGlove:gloves[0].geometry.userData.triangles,verticesPerGlove:src.count,cuffVerticesUpdatedPerGlove:gloves[0]._cuffVertices.length,sharedBaseGeometry:true,independentMutableBuffers:true,noCrossActorWrites:true,fixedFistUnchanged:true,perFrameFullNormalRecomputation:false,drawCallsPerGlove:1};
fs.writeFileSync(new URL('glove-cuff-qa.json',import.meta.url),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
