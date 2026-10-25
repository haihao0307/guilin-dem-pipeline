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
import {conservativeApertureCandidateLimit,withAperturePrimaryCandidateLimit,APERTURE_PRIMARY_LIMIT_GLSL,APERTURE_PRIMARY_LIMIT_REJECT} from './aperture-primary-candidate-limit.mjs';
import {buildPrimaryTileAperturesGLSL} from './kowloon-building-mother-r01/whole-building-floor-study-r01/primary-aperture-index.mjs';
import {withApertureNeighborIndex} from './kowloon-building-mother-r01/whole-building-floor-study-r01/aperture-neighbor-index.mjs';
import {withBoundedGlassEndpointVerification} from './kowloon-building-mother-r01/whole-building-facade-r01/glass-endpoint-roundoff.mjs';
import {apertureLocalEndpointContract,withApertureLocalEndpointTrace} from './aperture-local-endpoint-trace.mjs';
import {apertureQaPixelRay} from './qa-aperture-local-endpoints.mjs';
const F=Math.fround,EPS=F(.000002),fb=new Float32Array(1),ub=new Uint32Array(fb.buffer),up=x=>{fb[0]=x;ub[0]++;return fb[0];};
function scan(events,{lo,hi,limit=F(1e20),enabled=false}){let t=F(1e20),found=false,h=null;for(const e of events){const candidate=e.t;if(candidate<0||candidate>t||candidate>F(1e19))continue;if(enabled&&candidate>limit)continue;if(!e.valid)continue;if(found&&Math.abs(F(candidate-t))<EPS&&e.id>h.id)continue;t=candidate;h=e;found=true;}return found&&F(t+lo)<=hi?h:null;}
let checks=0,exhaustive=0,randomChecks=0,failOpenChecks=0;
// One-EPS upper bound is wrong because it changes the history of ID ties.
{
 const lo=0,hi=F(1),events=[{t:F(1+2.5e-6),id:1,valid:true},{t:F(1+1.5e-6),id:2,valid:true},{t:F(1),id:3,valid:true}],old=scan(events,{lo,hi}),bad=scan(events,{lo,hi,limit:F(hi+EPS),enabled:true}),bound=conservativeApertureCandidateLimit({lo,hi,primitiveCount:1});
 assert.equal(old.id,3);assert.equal(bad,null);assert.deepEqual(scan(events,{lo,hi,limit:bound.limit,enabled:true}),old);checks++;
}
// The old final rounded addition may accept a candidate ABOVE fl(hi-lo).
{
 const lo=F(1000),hi=F(1000.1),raw=F(hi-lo),candidate=F(raw+(up(hi)-hi)*.25),events=[{t:candidate,id:1,valid:true}],bound=conservativeApertureCandidateLimit({lo,hi,primitiveCount:1});
 assert(candidate>raw);assert(F(candidate+lo)<=hi);assert.equal(scan(events,{lo,hi,limit:raw,enabled:true}),null);assert(scan(events,{lo,hi,limit:bound.limit,enabled:true}));checks++;
}
const times=[-2,-.5,0,.5,1.5,2.5,3.5].map(x=>F(1+x*EPS)),permutations=[[1,2,3],[1,3,2],[2,1,3],[2,3,1],[3,1,2],[3,2,1]],smallBound=conservativeApertureCandidateLimit({lo:0,hi:1,primitiveCount:1});
for(const a of times)for(const b of times)for(const c of times)for(const ids of permutations)for(let flags=0;flags<8;flags++){const events=[a,b,c].map((t,i)=>({t,id:ids[i],valid:!!(flags&(1<<i))}));assert.deepEqual(scan(events,{lo:0,hi:1,limit:smallBound.limit,enabled:true}),scan(events,{lo:0,hi:1}));exhaustive++;}
let seed=41863;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
for(let trial=0;trial<30000;trial++){
 const count=1+Math.floor(random()*24),hi=F(2**(-20+Math.floor(random()*80))*(1+random())),lo=random()<.4?0:F(hi*random()),bound=conservativeApertureCandidateLimit({lo,hi,primitiveCount:count}),base=F(hi-lo),step=Math.max(EPS,Math.abs(base)*2**-23),events=Array.from({length:count*4},(_,i)=>({t:F(base+(random()-.5)*(8*count)*step),id:Math.floor(random()*1000)+1,valid:random()>.2,normal:[i,1,2],local:[i,3,4]}));
 assert(bound.enabled);assert.deepEqual(scan(events,{lo,hi,limit:bound.limit,enabled:true}),scan(events,{lo,hi}));assert.deepEqual(scan(events,{lo,hi,limit:0,enabled:false}),scan(events,{lo,hi}));randomChecks++;
}
for(const args of[{lo:-1,hi:1,primitiveCount:2},{lo:2,hi:1,primitiveCount:2},{lo:0,hi:Infinity,primitiveCount:2},{lo:NaN,hi:1,primitiveCount:2},{lo:0,hi:1e20,primitiveCount:2},{lo:0,hi:1e-40,primitiveCount:2},{lo:1e-40,hi:1,primitiveCount:2},{lo:0,hi:1,primitiveCount:0},{lo:0,hi:1,primitiveCount:4097},{lo:0,hi:1,primitiveCount:2.5},{lo:0,hi:1,primitiveCount:2,enabled:false},{lo:0,hi:1,primitiveCount:2,primaryRay:false}]){const b=conservativeApertureCandidateLimit(args);assert.equal(b.enabled,false);assert.equal(b.limit,F(1e20));failOpenChecks++;}
// Native-sized actual-scene CPU images. The forward bound only removes events
// whose result cannot survive the existing final previous-hit comparison.
const scene=composeBuildingScene(prepareBuildingLifts(entries).entries),apertures=scene.model.hostedComponents.apertures.filter(a=>!(a.caseId==='kcc'&&a.rederiveFunction==='deriveKccRecessedWindow')),parts=apertures.flatMap(a=>a.primitives),contract=apertureLocalEndpointContract(apertures),size={width:1002,height:527},targets=[...contract.mappings.filter((m,i,a)=>a.findIndex(q=>q.sashRole===m.sashRole)===i).map(m=>parts[m.glassIndex]),parts.find(p=>p.part==='leaf'&&p.materialRole===5&&!p.inner)];
let cpuImageComparisons=0,cpuVisible=0,cpuHidden=0;
for(const p of targets){const distance=Math.max(.8,2.8*Math.max(...p.outer.half)),camera={eye:p.origin.map((v,k)=>v+p.w[k]*distance),target:p.origin,fov:Math.PI/4};for(let y=-5;y<=5;y++)for(let x=-5;x<=5;x++){
 const rd=apertureQaPixelRay(camera,size,Math.floor(size.width/2)+x*14,Math.floor(size.height/2)+y*14),old=intersectAperturesRay(apertures,camera.eye,rd),depth=old.hit?old.t:distance*2;
 for(const factor of[.5,.999999,1,1.000001,1.5]){const hi=F(depth*factor),bound=conservativeApertureCandidateLimit({lo:0,hi,primitiveCount:parts.length}),limited=intersectAperturesRay(apertures,camera.eye,rd,{maxDistance:bound.limit}),visible=q=>q.hit&&F(q.t)<=hi?{id:q.objectId,t:q.t,normal:q.normal,local:q.local}:null;assert.deepEqual(visible(limited),visible(old));if(visible(old))cpuVisible++;else cpuHidden++;cpuImageComparisons++;}
}}
const generic=withBoundedGlassEndpointVerification(withApertureNeighborIndex(buildPrimaryTileAperturesGLSL(apertures))),local=withApertureLocalEndpointTrace(generic,contract);
for(const source of[generic,local]){const changed=withAperturePrimaryCandidateLimit(source);assert.equal(changed.replace(APERTURE_PRIMARY_LIMIT_GLSL+'\n','').replace(APERTURE_PRIMARY_LIMIT_REJECT,''),source,'Apart from an optional rejection, original source stays exact');assert(changed.includes('t=1e20;visits=0;bool found=false;'));assert.throws(()=>withAperturePrimaryCandidateLimit(changed),/Unwrapped/);}
assert(cpuVisible>0&&cpuHidden>0);const sample=conservativeApertureCandidateLimit({lo:0,hi:100,primitiveCount:364}),report={passed:true,scope:'Float32 candidate history equivalence, adversarial tie/addition tests and actual-scene CPU image comparisons; no GPU speed or pixel equivalence claim.',checks,exhaustive,randomChecks,failOpenChecks,sceneInstances:apertures.length,sceneParts:parts.length,cpuImageComparisons,cpuVisible,cpuHidden,nominalNativeSize:size,tieBandMetresFor364:sample.tieBand,endpointBudgetFor364:sample.endpointBudget,sourcePreservedExceptOptionalReject:true,initialTAndFoundUnchanged:true,fullUnionUnchanged:true,uniform:'uAperturePrimaryLimitEnabled',gpuValidated:false};fs.writeFileSync(new URL('./r17-aperture-primary-limit-test.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
