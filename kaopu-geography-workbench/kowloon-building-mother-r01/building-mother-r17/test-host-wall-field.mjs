import fs from 'node:fs';import assert from 'node:assert/strict';
import {deriveMeasuredCase} from './kowloon-building-mother-r01/r07/cases.mjs';import {controllerFor}from'./kowloon-building-mother-r01/whole-building-ground-r01/controller.mjs';import{deriveKccFacadeRegistration}from'./kcc-facade-registration.mjs';import{attachKccMainFacade}from'./kcc-main-facade.mjs';import{deriveHostWallField,hostWorld,hostLocal,hostWallInside,traceHostWallSolid,traceHostWall}from'./host-wall-field.mjs';import{intersectAperturesRay}from'./kowloon-building-mother-r01/r07/apertures.mjs';
const read=p=>JSON.parse(fs.readFileSync(new URL(p,import.meta.url))),s=deriveMeasuredCase(read('./hk-three-buildings-r01/geometry/B359971994401063C0.score.json')),o=read('./kowloon-building-mother-r01/r07/sources/official-footprints.json'),base=controllerFor('kcc').derive(s,o),m=attachKccMainFacade(base,s,deriveKccFacadeRegistration(s)),before=JSON.stringify(m),patch=s.patches.find(p=>p.sourcePatchId==='p013');
const h=deriveHostWallField({patch,apertures:m.hostedComponents.apertures,masks:m.hostedComponents.sourceMasks}),mul=(a,t)=>a.map(v=>v*t),near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);assert.equal(h.windows.length,22);assert.equal(JSON.stringify(m),before);let checks=0;
for(const w of h.windows){const x=(w.hole[0]+w.hole[2])/2,y=(w.hole[1]+w.hole[3])/2;
 assert.equal(hostWallInside(h,hostWorld(h,[x,y,-.13])),false);checks++;
 const rayOrigin=hostWorld(h,[x,y,2]),dir=mul(h.n,-1),q=traceHostWall(h,rayOrigin,dir),old=intersectAperturesRay(w.original,rayOrigin,dir);assert.ok(q.hit&&old.hit);assert.equal(q.objectId,old.objectId);near(q.t,old.t);checks++;
 const sideOrigin=hostWorld(h,[x,y,-.13]),side=traceHostWallSolid(h,sideOrigin,h.u);assert.ok(side.hit);near(side.t,w.hole[2]-x);assert.equal(side.objectId,w.revealObjectId);checks++;
 for(const z of[-.259,-.13,-.001]){assert.ok(hostWallInside(h,hostWorld(h,[h.rect[0]+.01,y,z])));checks++;}
 const back=traceHostWallSolid(h,hostWorld(h,[h.rect[0]+.01,y,-1]),h.n);assert.ok(back.hit);near(back.t,.74);checks++;
}
// No phantom matter in a clear opening and no passage through a solid wall.
for(let k=0;k<100;k++){const y=h.rect[1]+(h.rect[3]-h.rect[1])*(k+.5)/100,x=h.rect[0]+.01,front=traceHostWallSolid(h,hostWorld(h,[x,y,1]),mul(h.n,-1));near(front.t,1);assert.equal(front.objectId,h.objectId);checks++;}
assert.equal(m.hostedComponents.apertures.length,176);assert.equal(m.levels.length,base.levels.length);
console.log(JSON.stringify({passed:true,checks,host:patch.sourcePatchId,windows:h.windows.length,wholeWallThickness:.26,sourceAndLevelsUnchanged:true,exteriorWindowCenterHitsPreserved:true,newInsideWallSurfaces:true,thicknessEvidence:h.thicknessEvidence,browserQA:'not_run'}));
