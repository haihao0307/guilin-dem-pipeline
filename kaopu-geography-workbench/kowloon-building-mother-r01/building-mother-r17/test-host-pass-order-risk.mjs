import assert from 'node:assert/strict';
import fs from 'node:fs';
import {deriveMeasuredCase} from './kowloon-building-mother-r01/r07/cases.mjs';
import {profileFor} from './kowloon-building-mother-r01/r07/profiles.mjs';
import {controllerFor} from './kowloon-building-mother-r01/whole-building-ground-r01/controller.mjs';
import {deriveCaseIntegration} from './kowloon-building-mother-r01/whole-building-facade-r01/host-integration.mjs';
import {growBuilding} from './building-mother.mjs';
import {attachKccUnitDoors} from './kcc-unit-doors.mjs';
import {lowriseLevelRevision} from './lowrise-level-revision.mjs';
import {prepareBuildingLifts} from './lift-runtime.mjs';
import {composeBuildingScene} from './unified-scene.mjs';
import {intersectAperturesRay} from './kowloon-building-mother-r01/r07/apertures.mjs';
import {buildHostApertureIndex,hostWallBounds,hostRayInterval,queryHostRay} from './host-aperture-index.mjs';
const read=p=>JSON.parse(fs.readFileSync(new URL(p,import.meta.url))),official=read('./kowloon-building-mother-r01/r07/sources/official-footprints.json'),openingEvidence=read('./evidence/lowrise-opening-proposal.json');
const entries=['lowrise','kcc','warehouse'].map(caseId=>{
 const source=deriveMeasuredCase(read('./hk-three-buildings-r01/geometry/'+profileFor(caseId).modelId+'.score.json')),controller=controllerFor(caseId),whole=controller.derive(source,official,caseId==='lowrise'?lowriseLevelRevision(source,official,openingEvidence).parameters:{}),integration=deriveCaseIntegration(caseId,whole,source,official,{doorOpenT:1}),lift=controller.liftVisuals(whole,controller.createLiftState(whole));
 const model=growBuilding({caseId,source,model:{...integration.model,archetypes:[...integration.model.archetypes,...lift.archetypes],instances:[...integration.model.instances,...lift.instances]},openingEvidence},caseId==='lowrise'?{dimensions:{ordinaryDoorSystem:'shared-function'}}:{}).model;
 return {caseId,source,controller,whole,model};
});
const reservedInstanceIds=entries.flatMap(e=>(e.model.hostedComponents?.apertures??[]).map(a=>a.instanceId)),ke=entries.find(e=>e.caseId==='kcc');ke.model=attachKccUnitDoors(ke.model,{reservedInstanceIds});
import {assemblySectionInterval} from './kowloon-building-mother-r01/whole-building-facade-r01/assembly-section-cap.mjs';
const F=Math.fround,accept=(a,b)=>b&&(b.t<a.t||b.t===a.t&&b.id<a.id)?b:a,empty=()=>({t:F(1e20),id:0,normal:[0,1,0],local:[0,0,0]});
// Actual section-interval helper, followed by the production cap gate. A cut
// inside the solid and a host at that exact entry depth exhibit order sensitivity.
function assemblyPass(previous,{clip=true}={}){
 const ro=[-1,0,0],rd=[1,0,0],domain=assemblySectionInterval({ro,rd,nearest:previous.t,clip:clip?{normal:[1,0,0],offset:1}:null});if(!domain)return previous;
 let hit=previous;
 if(domain.hi>domain.lo&&domain.loNormal&&domain.lo>=1&&domain.lo<=5)hit=accept(hit,{t:domain.lo,id:7,normal:domain.loNormal,local:[1,0,0]});
 // The exact original prism front/back are at t=1 and t=5, not at the cut.
 for(const t of[1,5])if(t>=domain.lo&&t<=domain.hi)hit=accept(hit,{t,id:7,normal:[t===1?-1:1,0,0],local:[t-1,0,0]});
 return hit;
}
const host={t:2,id:9,normal:[-1,0,0],local:[1,0,0]},old=accept(assemblyPass(empty()),host),early=assemblyPass(accept(empty(),host));
assert.equal(old.id,7);assert.equal(early.id,9);assert.equal(old.t,early.t);
let uncutReductionChecks=0;
for(const t of[0,F(.1),1,F(1.000001),100,F(1e8)])for(const step of[-2,-1,0,1,2])for(const [hostId,assemblyId]of[[9,7],[7,9],[2000013,2502000]]){
 const otherT=F(Math.max(0,t+step*Math.max(2**-23,t*2**-23))),a={t,id:hostId,normal:[1,0,0],local:[1,2,3]},b={t:otherT,id:assemblyId,normal:[0,1,0],local:[4,5,6]};assert.deepEqual(accept(accept(empty(),a),b),accept(accept(empty(),b),a));uncutReductionChecks++;
}
const scene=composeBuildingScene(prepareBuildingLifts(entries).entries),windows=scene.model.hostedComponents.apertures.filter(a=>a.caseId==='kcc'&&a.rederiveFunction==='deriveKccRecessedWindow'),sourceIds=new Set(windows.map(a=>a.host.sourcePatchId)),hostIds=new Set([...scene.source.patches.filter(p=>sourceIds.has(p.sourcePatchId)).map(p=>p.objectId),...windows.flatMap(a=>a.primitives.map(p=>p.objectId))]),assemblyIds=new Set();
for(const [i,instance]of scene.model.instances.entries()){const a=scene.model.archetypes.find(a=>a.id===instance.archetypeId);for(const p of (a.spec??a).primitives)assemblyIds.add(p.objectId+(instance.objectIdOffset??10000*(i+1)));}
const collisions=[...hostIds].filter(id=>assemblyIds.has(id));assert.deepEqual(collisions,[],'Host/assembly equal-t reduction requires globally distinct cross-pass identities');
// A second risk exists without clipping. Mirror the production entry guard and
// shifted-origin plane calculation with individually rounded Float32 ops. This
// is an arithmetic countermodel, not a claim about this GPU's contraction mode.
const fb=new Float32Array(1),ub=new Uint32Array(fb.buffer),up=value=>{fb[0]=value;ub[0]++;return fb[0];};
const low=F(44.694210052490234),ro=F(43.6173210144043),rd=F(.14002548158168793),boundsLo=F(F(low-ro)/rd);
const magnitude=F(F(1+Math.abs(boundsLo))+F(F(Math.abs(ro)+Math.abs(ro))/Math.abs(rd))),pad=F(F(8*F(2**-23))*magnitude),start=F(Math.max(0,F(boundsLo-pad)));
const shifted=F(ro+F(rd*start)),localT=F(F(low-shifted)/rd),reconstructedT=F(localT+start),hostT=up(up(up(reconstructedT)));
assert(reconstructedT<hostT&&hostT<boundsLo);
assert(up(up(hostT))<boundsLo,'Even two nextUp steps on hi do not cover this whole transform/start chain');
const originalBoundary={t:reconstructedT,id:900,normal:[-1,0,0],local:[low,0,0]},hostBoundary={t:hostT,id:9,normal:[-1,0,0],local:[low,0,0]};
const oldUncut=accept(accept(empty(),originalBoundary),hostBoundary),earlyUncut=boundsLo>hostT?hostBoundary:accept(hostBoundary,originalBoundary);
assert.equal(oldUncut.id,900);assert.equal(earlyUncut.id,9,'Strictly nearer assembly is lost before entry guard runs; identity order cannot rescue it');
const report={passed:true,scope:'Pass-order reduction, exact clipping counterexample, and Float32 arithmetic countermodel; not full GPU equivalence',uncutReductionChecks,clipCounterexample:{oldOrder:old,hostFirst:early,reason:'Previous host hit collapses clipHi to clipLo and suppresses a smaller-ID real section cap'},broadPhaseCounterexample:{low,ro,rd,boundsLo,pad,start,shifted,localT,reconstructedT,hostT,oldOrder:oldUncut,hostFirst:earlyUncut,reason:'Outer previous-hit AABB rejects before guarded shifted-origin intersection reconstructs a smaller t; non-contracted F32 model'},hostIdentityCount:hostIds.size,assemblyIdentityCount:assemblyIds.size,crossPassIdentityCollisions:collisions,remainingRisk:'A uniform previous-hit epsilon is not yet certified for packed field support, instance/local transforms, near-parallel planes and entry-start reconstruction; keep host-first opt-in unless that contract is established.'};
fs.writeFileSync(new URL('./r17-host-pass-order-risk-test.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
