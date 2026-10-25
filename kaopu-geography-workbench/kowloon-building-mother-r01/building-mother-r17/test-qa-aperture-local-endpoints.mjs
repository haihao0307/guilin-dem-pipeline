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
import {runApertureLocalEndpointQa,apertureQaPixelRay} from './qa-aperture-local-endpoints.mjs';
const scene=composeBuildingScene(prepareBuildingLifts(entries).entries),before=JSON.stringify(scene),hosted=scene.model.hostedComponents,excluded=new Set(hosted.apertures.filter(a=>a.caseId==='kcc'&&a.rederiveFunction==='deriveKccRecessedWindow').map(a=>a.instanceId)),size={native:true,width:1002,height:527,dpr:1};
function fixture({failAt=0,wrongHit=false,stoppedAt=0}={}){
 const original={options:{eye:[1,2,3],target:[0,0,0],fov:1,cut:false,sliceY:null,onlyHostField:false},archetypes:[{id:'original-floor'}],railGroups:[{id:'original-rail'}],integratedHosts:[{id:'original-host'}],allHostedComponents:hosted};let frames=0;
 const r={...original,busy:false,stats:{frames:1,last:{visibleFloorIds:null}},requestRevision:0,hostedVisibilityKey:'null',error:null,
  updateHostedVisibility(){this.apertures=this.allHostedComponents.apertures.filter(a=>!excluded.has(a.instanceId));this.study={...this.allHostedComponents,apertures:this.apertures};this.hostedVisibilityKey='null';},
  async render(args){frames++;assert.equal(args.width,1002);assert.equal(args.height,527);assert.equal(args.presentWidth,args.width);assert.equal(args.presentHeight,args.height);assert.equal(args.source,false);assert.equal(args.design,true);assert.equal(args.gpuBatchTiles,8);assert.equal(this.archetypes.length,0);assert.equal(this.railGroups.length,0);assert.equal(this.integratedHosts.length,0);this.updateHostedVisibility();assert.equal(this.apertures.reduce((n,a)=>n+a.primitives.length,0),364);if(frames===stoppedAt)this.error={reason:'initialization-timeout'};if(frames===failAt||frames===stoppedAt)throw Error('simulated GPU failure');this.stats.frames++;return{passCounts:{source:0,assembly:0,rail:0,host:0,aperture:66,shade:66,dynamic:0},width:1002,height:527,cancelled:false};},
  readHit(x,y){const rd=apertureQaPixelRay(this.options,size,x,y),cpu=intersectAperturesRay(this.apertures,this.options.eye,rd);return cpu.hit?{status:1,t:cpu.t,objectId:cpu.objectId+(wrongHit?1:0),materialRole:cpu.materialRole,normal:cpu.normal,local:cpu.local}:{status:0,t:1e20,objectId:0,materialRole:0,normal:[0,1,0],local:[0,0,0]};}
 };
 r.updateHostedVisibility();
 const inspection={renderer:r,presentedDisplay:size,busy:false,lastStats:{visibleFloorIds:null},async render(){assert.equal(r.options,original.options);assert.equal(r.archetypes,original.archetypes);assert.equal(r.railGroups,original.railGroups);assert.equal(r.integratedHosts,original.integratedHosts);assert.equal(r.allHostedComponents,original.allHostedComponents);r.stats.frames++;this.lastStats={cancelled:false,passCounts:{source:66,assembly:120,rail:12,host:14,aperture:12,shade:66}};r.stats.last=this.lastStats;}};
 return{inspection,r,original};
}
let checks=0;
{
 const {inspection,r,original}=fixture(),progress=[],report=await runApertureLocalEndpointQa(inspection,{onProgress:q=>progress.push(q)});
 assert.equal(report.passed,true,JSON.stringify(report.views.map(v=>({name:v.name,targetHits:v.targetHits,error:report.error}))));assert.equal(report.views.length,4);assert.equal(report.views.reduce((n,v)=>n+v.samples,0),484);assert(report.views.every(v=>v.primitiveCount===364));assert(report.restoration.stateRestored&&report.restoration.fullSceneRendered);assert.equal(r.options,original.options);assert.equal(progress.length,5);checks++;
}
{
 const {inspection,r,original}=fixture({failAt:2}),report=await runApertureLocalEndpointQa(inspection);
 assert.equal(report.passed,false);assert(report.error.includes('simulated GPU failure'));assert(report.restoration.stateRestored&&report.restoration.fullSceneRendered);assert.equal(r.options,original.options);checks++;
}
{
 const {inspection,r,original}=fixture({stoppedAt:1}),report=await runApertureLocalEndpointQa(inspection);
 assert.equal(report.passed,false);assert(report.restoration.stateRestored);assert.equal(report.restoration.fullSceneRendered,false);assert(report.restoration.error.includes('GPU stopped'));assert.equal(r.allHostedComponents,original.allHostedComponents);checks++;
}
{
 const {inspection,r,original}=fixture({wrongHit:true}),report=await runApertureLocalEndpointQa(inspection);
 assert.equal(report.passed,false);assert(report.views[0].mismatchCount>0);assert(report.restoration.stateRestored&&report.restoration.fullSceneRendered);assert.equal(r.options,original.options);checks++;
}
{
 const {inspection}=fixture();inspection.presentedDisplay={...size,native:false};await assert.rejects(runApertureLocalEndpointQa(inspection),/native/);checks++;
}
{
 const {inspection,r,original}=fixture();const report=await runApertureLocalEndpointQa(inspection,{onProgress(){throw Error('persist callback failed');}}).catch(e=>({caught:e.message}));assert.equal(report.caught,'persist callback failed');assert.equal(r.options,original.options);assert.equal(r.allHostedComponents,original.allHostedComponents);assert(inspection.lastStats.passCounts.source>0);checks++;
}
assert.equal(JSON.stringify(scene),before,'Real authoritative scene not mutated by any QA path');
console.log({passed:true,checks,scope:'Mock renderer + real 364-part CPU union; 484 planned native pixel rays, success/failure/stopped/observer-error state restoration, no actual GPU execution.'});
