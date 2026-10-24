import fs from 'node:fs';
import assert from 'node:assert/strict';
import {deriveMeasuredCase,patchDistance} from './kowloon-building-mother-r01/r07/cases.mjs';
import {controllerFor} from './kowloon-building-mother-r01/whole-building-ground-r01/controller.mjs';
import {deriveKccFacadeRegistration} from './kcc-facade-registration.mjs';
import {attachKccMainFacade} from './kcc-main-facade.mjs';
import {deriveKccRecessedWindow} from './kcc-recessed-window.mjs';
import {packApertureDescriptors,intersectAperturesRay,apertureGlassInterval} from './kowloon-building-mother-r01/r07/apertures.mjs';
import {packSourceMaskIndex} from './source-mask-index.mjs';
import {buildRegistry} from './kowloon-building-mother-r01/whole-building-facade-r01/semantic-registry.mjs';
const r=new URL('./',import.meta.url),read=p=>JSON.parse(fs.readFileSync(new URL(p,r)));
const s=deriveMeasuredCase(read('hk-three-buildings-r01/geometry/B359971994401063C0.score.json')),o=read('kowloon-building-mother-r01/r07/sources/official-footprints.json');
const base=controllerFor('kcc').derive(s,o),reg=deriveKccFacadeRegistration(s),before=JSON.stringify(s),levels=JSON.stringify(base.levels),baseBefore=JSON.stringify(base);
const expectedHosts={R0:{A:'p003',B:'p005',C:'p018',D:'p016',E:'p010',F:'p013'},R180:{A:'p016',B:'p010',C:'p013',D:'p003',E:'p005',F:'p018'}};
const add=(a,b)=>a.map((v,i)=>v+b[i]),mul=(a,t)=>a.map(v=>v*t),dot=(a,b)=>a.reduce((sum,v,i)=>sum+v*b[i],0),sub=(a,b)=>a.map((v,i)=>v-b[i]);
const corners=p=>{const out=[];for(const x of[-1,1])for(const y of[-1,1])for(const z of[-1,1])out.push(add(p.origin,add(mul(p.u,p.outer.center[0]+x*p.outer.half[0]),add(mul(p.v,p.outer.center[1]+y*p.outer.half[1]),mul(p.w,z*p.halfDepth)))));return out;};
let sourceCorners=0,recessCorners=0,clearRays=0,glassRays=0,sillChecks=0;
const summaries=[];
for(const candidateId of ['R0','R180']){
 const m=attachKccMainFacade(base,s,reg,{candidateId}),candidate=reg.candidates.find(c=>c.id===candidateId),parts=m.hostedComponents.apertures.flatMap(a=>a.primitives);
 assert.equal(m.hostedComponents.apertures.length,176);assert.equal(m.hostedComponents.sourceMasks.length,176);assert.equal(JSON.stringify(m.levels),levels);
 assert.equal(m.facadeRegistration.sourceFaceCount,6);assert.equal(new Set(parts.map(p=>p.objectId)).size,880);
 assert.equal(m.facadeRegistration.actualWindowDimensions,null);assert.equal(m.facadeRegistration.actualFFL,null);
 for(const family of ['lower','upper']){
  assert.equal(candidate.windowsByFamily[family].length,8);
  for(const w of candidate.windowsByFamily[family])assert.equal(w.sourcePatchId,expectedHosts[candidateId][w.unit],'Each family keeps its independently registered source face');
 }
 for(const a of m.hostedComponents.apertures){
  const mask=m.hostedComponents.sourceMasks.find(x=>x.instanceId===a.instanceId),p=s.patches.find(x=>x.sourcePatchId===mask.sourcePatchId),c=a.recessedConstruction,frame=a.sourceFrame;
  const family=a.actualFloorLabel<=17?'lower':'upper',observation=candidate.windowsByFamily[family].find(w=>w.observationId===a.observationId);
  assert(p&&observation);assert.equal(mask.sourceObjectId,p.objectId);assert.equal(mask.sourcePatchId,expectedHosts[candidateId][observation.unit]);assert.deepEqual(mask.frame.origin,frame.origin);assert.deepEqual(mask.frame.w,p.n);
  assert.deepEqual(a.focusNormal,p.n);assert.equal(a.host.sourcePatchId,p.sourcePatchId);assert.equal(a.counts.modelTriangles,0);assert.equal(a.counts.modelVertexBuffers,0);assert.equal(a.primitives.length,5);
  assert.equal(c.actualWallThicknessM,null);assert.equal(c.actualRecessM,null);assert.equal(c.actualMechanism,null);assert.equal(a.actualDimensions,null);
  assert(mask.frame.origin[1]>s.bounds.min[1]&&mask.frame.origin[1]<s.bounds.max[1]);
  for(const x of [-1,1])for(const y of[-1,1]){
   const q=mask.frame.origin.map((v,k)=>v+x*mask.width/2*p.u[k]+y*mask.height/2*p.v[k]);assert(patchDistance(p,q)<1e-6,'All mask corners stay in their finite actual source face');sourceCorners++;
  }
  for(const part of a.primitives){
   // All parts stay within the observed horizontal interval, even at clipped
   // source edges. Only the bottom sill intentionally projects outside in depth.
   for(const q of corners(part)){
    const u=dot(sub(q,frame.origin),frame.u),z=dot(sub(q,frame.origin),frame.w);
    assert(Math.abs(u)<=a.config.width/2+1e-7,'No lateral extension onto an unobserved neighboring façade');
    if(['frame','leaf','glass'].includes(part.part)){assert(z<0,'Frame, sash and glass must be inside, not +0.012 outside');assert(z>=-c.parameters.wallThickness-1e-7,'Joinery stays inside candidate depth');recessCorners++;}
   }
  }
  const reveal=a.primitives.find(p=>p.partRole==='window_opening_reveal'),sill=a.primitives.find(p=>p.partRole==='window_sill'),pane=a.primitives.find(p=>p.part==='glass');
  assert(reveal.inner,'Reveal must be an open ring, never a solid plate');assert(!sill.inner,'Sill must be a real finite solid');
  const bottom=frame.origin[1]-a.config.height/2;assert(Math.abs(sill.bounds.max[1]-bottom)<1e-7);assert(Math.abs(sill.bounds.min[1]-(bottom-c.parameters.sillThickness))<1e-7);sillChecks++;
  // Center and four pane-interior rays reach the glass. Ignoring glass must
  // leave an open line through the assembly, proving reveal/sill do not seal it.
  for(const [ux,vy] of [[0,0],[-.6,-.6],[.6,-.6],[-.6,.6],[.6,.6]]){
   const q=add(frame.origin,add(mul(frame.u,ux*pane.outer.half[0]),mul(frame.v,vy*pane.outer.half[1]))),ro=add(q,frame.w),rd=mul(frame.w,-1);
   const hit=intersectAperturesRay(a,ro,rd,{maxDistance:2});assert(hit.hit&&hit.part==='glass','Pane visible through the actual finite opening');glassRays++;
   assert.equal(intersectAperturesRay(a,ro,rd,{maxDistance:2,skipGlass:true}).hit,false,'No opaque fill across the opening');clearRays++;
   const d=sub(q,mask.frame.origin);assert(Math.abs(dot(d,mask.frame.u))<mask.width/2&&Math.abs(dot(d,mask.frame.v))<mask.height/2,'Visible pane rays pass through the source-plane cut');
  }
  const interval=apertureGlassInterval(a,pane.objectId,add(frame.origin,frame.w),mul(frame.w,-1));assert(Math.abs(interval.pathLength-c.parameters.glassThickness)<1e-7);
  const sideRo=add(add(frame.origin,mul(frame.u,a.config.width/2-c.parameters.revealRimWidth/2)),frame.w);
  assert.equal(intersectAperturesRay(a,sideRo,mul(frame.w,-1),{maxDistance:2,skipGlass:true}).objectId,reveal.objectId,'Jamb wall thickness is physically present beside, not across, the opening');
  const rec=m.hostedComponents.records.find(x=>x.instanceId===a.instanceId);
  for(const [from,to,type]of [[rec.openingId,rec.wallId,'voids'],[rec.hostId,rec.openingId,'fills'],[rec.hostId,rec.wallId,'hostedBy'],[rec.sillId,rec.wallId,'supportedBy'],[rec.hostId,rec.sillId,'supportedBy'],[rec.revealId,rec.wallId,'ownedBy']])assert(m.graph.edges.some(e=>e.from===from&&e.to===to&&e.type===type),'Explicit opening/host/support relation');
  assert.deepEqual(deriveKccRecessedWindow(a.adapterRecipe).primitives,a.primitives,'The shared analytic recipe regenerates all five render parts');
 }
 assert.equal(packSourceMaskIndex(m.hostedComponents.sourceMasks,s).count,176);assert.equal(packApertureDescriptors(m.hostedComponents.apertures).primitiveCount,880);buildRegistry(m,s);
 summaries.push({candidateId,sourceFaceCounts:m.facadeRegistration.sourceFaceWindowCounts,lowerWindows:104,upperWindows:72});
}
const normal=attachKccMainFacade(base,s,reg),thick=attachKccMainFacade(base,s,reg,{windowConstruction:{wallThickness:.34,frameCenterRecess:.1,sillProjection:.12,sillThickness:.08}}),restored=attachKccMainFacade(base,s,reg);
assert.deepEqual(restored,normal,'Repeat regeneration is deterministic and accumulates no parts');assert.equal(JSON.stringify(thick.levels),levels);assert.equal(thick.hostedComponents.apertures[0].recessedConstruction.parameters.wallThickness,.34);
assert.notDeepEqual(thick.hostedComponents.apertures[0].primitives,normal.hostedComponents.apertures[0].primitives,'Explicit recess parameters change actual geometry');
assert.throws(()=>attachKccMainFacade(base,s,reg,{windowConstruction:{frameCenterRecess:.01}}),/wholly recessed/);
assert.throws(()=>attachKccMainFacade(base,s,reg,{windowConstruction:{wallThickness:.18}}),/fit within/);
assert.throws(()=>attachKccMainFacade(base,s,reg,{windowConstruction:{revealRimWidth:.09}}),/may not narrow/);
assert.throws(()=>attachKccMainFacade(base,s,reg,{windowHeight:8}),/retained design storey/);
assert.equal(JSON.stringify(s),before);assert.equal(JSON.stringify(base),baseBefore);assert.equal(attachKccMainFacade(base,s,reg,{enabled:false}).facadeRegistration.windowCount,0);
console.log(JSON.stringify({passed:true,candidates:2,windowsPerCandidate:176,sourceFacesPerCandidate:6,partsPerWindow:5,finiteSourceCornerChecks:sourceCorners,recessedPartCornerChecks:recessCorners,transparentClearRays:clearRays,glassRays,sillChecks,sourceAndLevelGeometryUnchanged:true,geometry:'r07 analytic apertures only; no mesh',depthEvidence:'explicit design candidates, not measured construction',summaries},null,2));
