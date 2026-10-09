import assert from 'node:assert/strict';
import {sweepSphereTriangle,closestTriangle,SURFACE_TOLERANCE,bodyRegionForBone} from '../SurfaceNarrowPhase.mjs';
const tri=[[-2,-2,0],[2,-2,0],[0,2,0]],cases=[];
for(const [name,from,to,r,old,now,expect] of [
 ['front-fast',[0,0,2],[0,0,-2],.1,tri,tri,true],
 ['near-miss',[0,0,.1002],[.4,0,.1002],.1,tri,tri,false],
 ['grazing-edge',[0,2.099,1],[0,2.099,-1],.1,tri,tri,true],
 ['adjacent-not-in-path',[3,0,1],[3,0,-1],.1,tri,tri,false],
 ['moving-surface',[0,0,1],[0,0,1],.1,tri,tri.map(p=>[p[0],p[1],2]),true],
 ['initial-penetration',[0,0,.05],[0,0,-1],.1,tri,tri,true],
 ['tangent',[0,2.1,1],[0,2.1,-1],.1,tri,tri,true],
 ]){const hit=sweepSphereTriangle(from,to,r,old,now);assert.equal(!!hit,expect,name);assert.ok(!hit?.unresolved,name+' unresolved');if(hit){assert.ok(hit.surfaceSeparation<=SURFACE_TOLERANCE);const p=old.map((v,i)=>v.map((x,k)=>x+(now[i][k]-x)*hit.toi));assert.ok(closestTriangle(hit.contactPoint,...p).distance<1e-12);}cases.push({name,hit});}
assert.ok(Math.abs(cases[0].hit.toi-.475)<SURFACE_TOLERANCE/4);
console.log(JSON.stringify({passed:true,toleranceM:SURFACE_TOLERANCE,cases},null,2));

for(const name of ["wrist.L","metacarpal1.L","metacarpal4.L","finger3-1.L"])assert.equal(bodyRegionForBone(name),"hand.L");
assert.equal(bodyRegionForBone("lowerarm01.R"),"arm.R");
