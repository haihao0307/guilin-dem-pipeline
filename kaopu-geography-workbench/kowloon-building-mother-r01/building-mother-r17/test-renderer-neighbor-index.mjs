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
import {WholeRenderer} from './kowloon-building-mother-r01/whole-building-facade-r01/semantic-renderer.mjs';
import {packApertureDescriptors,buildAperturesGLSL} from './kowloon-building-mother-r01/r07/apertures.mjs';
import {packApertureNeighbors,readApertureNeighbors,withApertureNeighborIndex} from './kowloon-building-mother-r01/whole-building-floor-study-r01/aperture-neighbor-index.mjs';
import {buildPrimaryTileAperturesGLSL} from './kowloon-building-mother-r01/whole-building-floor-study-r01/primary-aperture-index.mjs';
import {withBoundedGlassEndpointVerification,GLASS_ENDPOINT_GLSL} from './kowloon-building-mother-r01/whole-building-facade-r01/glass-endpoint-roundoff.mjs';
import {createRoomDoorRuntime} from './room-door-runtime.mjs';
const read=p=>JSON.parse(fs.readFileSync(new URL(p,import.meta.url))),official=read('./kowloon-building-mother-r01/r07/sources/official-footprints.json'),openingEvidence=read('./evidence/lowrise-opening-proposal.json');
const entries=['lowrise','kcc','warehouse'].map(caseId=>{
 const source=deriveMeasuredCase(read('./hk-three-buildings-r01/geometry/'+profileFor(caseId).modelId+'.score.json')),controller=controllerFor(caseId),whole=controller.derive(source,official,caseId==='lowrise'?lowriseLevelRevision(source,official,openingEvidence).parameters:{}),integration=deriveCaseIntegration(caseId,whole,source,official,{doorOpenT:1}),lift=controller.liftVisuals(whole,controller.createLiftState(whole));
 const model=growBuilding({caseId,source,model:{...integration.model,archetypes:[...integration.model.archetypes,...lift.archetypes],instances:[...integration.model.instances,...lift.instances]},openingEvidence}).model;
 return {caseId,source,controller,whole,model};
});
const reservedInstanceIds=entries.flatMap(e=>(e.model.hostedComponents?.apertures??[]).map(a=>a.instanceId)),ke=entries.find(e=>e.caseId==='kcc');ke.model=attachKccUnitDoors(ke.model,{reservedInstanceIds});
const scene=composeBuildingScene(prepareBuildingLifts(entries).entries),before=JSON.stringify(scene),deleted=[],compiled=new Map();
// Exercise actual renderer descriptor lifecycle without pretending this is GPU QA.
const renderer=Object.assign(Object.create(WholeRenderer.prototype),{gl:{deleteTexture:t=>deleted.push(t)},textures:[],revision:0,busy:false,staticPrimaryCache:{release(){},identity(){return 1}},texture(packed){const texture={packed};this.textures.push(texture);return texture},compile(name,source){compiled.set(name,source);return {name}}});
renderer.setModel(scene.model,scene.source);
assert.equal(JSON.stringify(scene),before,'Renderer preserves all geometry/identity/ownership');
const first=renderer.apertureNeighborIndex,count=first.primitiveCount,EPS=Math.fround(.000002);let pairChecks=0,pointChecks=0;
assert(first&&first.neighborPairs<first.fullNeighborPairs/20);
assert(scene.model.hostedComponents.apertures.length<=512);assert(count<=4096);
const disjoint=(a,b)=>a.min.some((v,k)=>v>b.max[k]||b.min[k]>a.max[k]);
for(let own=0;own<count;own++){
 const domain=first.domains[own],list=first.lists[own],members=new Set(list);
 for(let k=0;k<count;k++)if(k!==own){
  // A universal exclusion check, not only sampled rays: every omitted guard box
  // must be disjoint from the entire shader-checked own query domain.
  if(!members.has(k))assert(disjoint(domain,first.guards[k]),`unsafe omitted pair ${own}/${k}`);
  pairChecks++;
 }
 const points=[domain.min,domain.max,domain.min.map((v,k)=>Math.fround((v+domain.max[k])/2))];
 for(const point of points){
  const candidates=readApertureNeighbors(first,own,point,count);assert(candidates);
  for(let k=0;k<count;k++){if(k===own)continue;const b=4*(1+9*k),d=renderer.apertureTexture.packed.data;
   const inside=point.every((v,a)=>v>=Math.fround(d[b+28+a]-EPS)&&v<=Math.fround(d[b+32+a]+EPS));
   if(inside)assert(candidates.includes(k));pointChecks++;
  }
 }
 assert.equal(readApertureNeighbors(first,own,[1e9,1e9,1e9],count),null);
 assert.equal(readApertureNeighbors(first,own,[NaN,0,0],count),null);
}
const own=first.lists.findIndex(list=>list.length>1),point=first.domains[own].min,row=4*(1+3*own),start=first.data[row];
for(const mutate of [d=>d[0]=0,d=>d[1]++,d=>d[2]++,d=>d[row]=-1,d=>d[row+1]=count,d=>d[row+2]=-1,d=>d[row+3]++,d=>d[row+4]=NaN,d=>d[4*start]=own+1,d=>d[4*(start+1)]=d[4*start]]){
 const bad={...first,data:first.data.slice()};mutate(bad.data);assert.equal(readApertureNeighbors(bad,own,point,count),null,'Malformed metadata falls back');
}
assert.equal(readApertureNeighbors(first,own,point,count,{enabled:false}),null);
assert.equal(readApertureNeighbors(first,own,point,count,{token:first.token+1}),null);
for(const source of [buildAperturesGLSL(renderer.apertures),buildPrimaryTileAperturesGLSL(renderer.apertures)]){
 const wrapped=withBoundedGlassEndpointVerification(withApertureNeighborIndex(source));
 assert(wrapped.includes(GLASS_ENDPOINT_GLSL),'Glass endpoint recovery remains byte-for-byte unchanged');
 assert(wrapped.includes('apertureNeighborRange(own,point,count)'));
 assert.throws(()=>withApertureNeighborIndex(wrapped),/contract changed/,'Double wrapping rejected');
}
assert(compiled.get('hosted-aperture').includes('uApertureNeighbors'));
assert(compiled.get('hosted-aperture').includes('precision highp float;'));
const initialToken=renderer.apertureNeighborToken,initialTexture=renderer.apertureNeighborTexture;
renderer.updateHostedVisibility(['lowrise::'+scene.buildings[0].localModel.levels[0].id]);
assert(renderer.apertureNeighborToken>initialToken);assert(deleted.includes(initialTexture));assert.notEqual(renderer.apertureNeighborTexture,initialTexture);
const filteredCount=renderer.apertureNeighborIndex.primitiveCount;assert(filteredCount<count);
renderer.updateHostedVisibility(null);assert.equal(renderer.apertureNeighborIndex.primitiveCount,count);
assert.equal(JSON.stringify(scene),before,'Filtering is not destructive');
const selected=scene.buildings[0],runtime=createRoomDoorRuntime({scene,renderer,getSelectedBuilding:()=>selected});runtime.selectBuilding(selected);
const door=runtime.snapshot().doors.find(d=>d.openT!==0);
if(door&&selected.localModel.doorSystem?.status!=='deferred'){
 const room=selected.localModel.completeFloorSystem.levels.find(f=>f.id===door.floorId).rooms.find(r=>r.doorId===door.id),token=renderer.apertureNeighborToken,texture=renderer.apertureNeighborTexture;
 runtime.set({caseId:'lowrise',buildingId:selected.buildingId,floorId:door.floorId,roomKey:room.key,openT:0});runtime.beforeFrame();renderer.updateHostedVisibility(null);
 assert(renderer.apertureNeighborToken>token);assert(deleted.includes(texture));assert.notEqual(renderer.apertureNeighborTexture,texture);
 assert.equal(renderer.apertureNeighborIndex.primitiveCount,count,'Door motion retains identity count');
}
const kcc=scene.buildings.find(b=>b.caseId==='kcc'),kccRuntime=createRoomDoorRuntime({scene,renderer,boundCase:'kcc',getSelectedBuilding:()=>kcc});kccRuntime.selectBuilding(kcc);
let kccDoorMutations=0;
for(const floor of [kcc.localModel.kccUnitAccess.levels[0],kcc.localModel.kccUnitAccess.levels.at(-1)]){
 const token=renderer.apertureNeighborToken,texture=renderer.apertureNeighborTexture;
 const result=kccRuntime.set({caseId:'kcc',buildingId:kcc.buildingId,floorId:floor.id,roomKey:'A',openT:1});assert.equal(result.queued,true);
 kccRuntime.beforeFrame();renderer.updateHostedVisibility(null);
 assert(renderer.apertureNeighborToken>token);assert(deleted.includes(texture));assert.notEqual(renderer.apertureNeighborTexture,texture);assert.equal(renderer.apertureNeighborIndex.primitiveCount,count);kccDoorMutations++;
}
// Geometry replacement must rebuild both descriptors even while a floor filter
// is unchanged. Use a detached test copy; do not animate the deferred door system.
const originalHosted=renderer.allHostedComponents,changed=structuredClone(originalHosted),oldToken=renderer.apertureNeighborToken,oldTexture=renderer.apertureNeighborTexture;
for(const p of changed.apertures[0].primitives){p.origin[0]+=.25;p.bounds.min[0]+=.25;p.bounds.max[0]+=.25;}
renderer.allHostedComponents=changed;renderer.hostedVisibilityKey=null;renderer.updateHostedVisibility(null);
assert(renderer.apertureNeighborToken>oldToken);assert(deleted.includes(oldTexture));assert.notEqual(renderer.apertureNeighborTexture,oldTexture);
assert.notDeepEqual(renderer.apertureTexture.packed.data,packApertureDescriptors(originalHosted.apertures).data);
renderer.allHostedComponents=originalHosted;renderer.hostedVisibilityKey=null;renderer.updateHostedVisibility(null);
renderer.busy=true;assert.throws(()=>renderer.replaceApertureDescriptors(),/completed GPU frame/);renderer.busy=false;
renderer.updateHostedVisibility([]);assert.equal(renderer.apertureNeighborTexture,null);assert.equal(renderer.apertureNeighborIndex,null);
renderer.updateHostedVisibility(null);assert.equal(renderer.apertureNeighborIndex.primitiveCount,count);
const report={passed:true,scope:'CPU conservative exclusion, unchanged shader functions and renderer descriptor lifecycle; not GPU equivalence/performance',apertureInstances:scene.model.hostedComponents.apertures.length,primitiveCount:count,fullNeighborPairs:first.fullNeighborPairs,indexedNeighborPairs:first.neighborPairs,pairChecks,pointChecks,filteredPrimitiveCount:filteredCount,doorMutationChecked:!!door&&selected.localModel.doorSystem?.status!=='deferred',kccDoorMutations,geometryReplacementChecked:true,compileSourceGenerated:true,browserQA:'requires real WebGL runner'};
fs.writeFileSync(new URL('./r17-neighbor-index-test.json',import.meta.url),JSON.stringify(report,null,2));console.log(report);
