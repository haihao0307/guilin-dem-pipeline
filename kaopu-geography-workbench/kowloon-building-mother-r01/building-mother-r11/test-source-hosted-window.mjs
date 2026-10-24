import assert from 'node:assert/strict';
import fs from 'node:fs';
import {deriveSourceHostedWindow,SOURCE_HOSTED_WINDOW_DEFAULTS,validateSourceHostedWindowPlacement} from './source-hosted-window.mjs';
import {deriveMeasuredCase} from './kowloon-building-mother-r01/r07/cases.mjs';
import {attachOpeningOwnership,validateOpeningOwnership} from './opening-ownership.mjs';
import {packApertureDescriptors,intersectAperturesRay,apertureGlassInterval} from './kowloon-building-mother-r01/r07/apertures.mjs';

// Runs both in this patch folder (read-only sibling baseline) and after copying
// these two files into the actual workbench. No outputs or baseline writes.
const root=fs.existsSync(new URL('./evidence/lowrise-opening-proposal.json',import.meta.url))?new URL('./',import.meta.url):new URL('../building-mother-r11/',import.meta.url);
const read=p=>JSON.parse(fs.readFileSync(new URL(p,root),'utf8'));
const {controllerFor}=await import(new URL('kowloon-building-mother-r01/whole-building-ground-r01/controller.mjs',root));
const {lowriseLevelRevision}=await import(new URL('lowrise-level-revision.mjs',root));
const {deriveCaseIntegration}=await import(new URL('kowloon-building-mother-r01/whole-building-facade-r01/host-integration.mjs',root));
const {deriveFloorMother,validateCompleteFloorSystem}=await import(new URL('complete-floor-system.mjs',root));
const {growBuilding}=await import(new URL('building-mother.mjs',root));
let checks=0;const ok=(v,msg)=>{assert(v,msg);checks++;},eq=(a,b,msg)=>{assert.deepEqual(a,b,msg);checks++;},reject=(fn,re)=>{assert.throws(fn,re);checks++;};
const source=deriveMeasuredCase(read('hk-three-buildings-r01/geometry/B367642137201063C0.score.json'));
const official=read('kowloon-building-mother-r01/r07/sources/official-footprints.json'),bundle=read('evidence/lowrise-opening-proposal.json');
// Evidence allowlist belongs to this case adapter, NEVER the generic geometry.
eq(bundle.fields.map(f=>f.id),['N-U01','N-U02','N-U03'],'Only the three reviewed actual observations');
const controller=controllerFor('lowrise'),whole=controller.derive(source,official,lowriseLevelRevision(source,official,bundle).parameters);
const model=deriveCaseIntegration('lowrise',whole,source,official,{doorOpenT:1}).model,mother=deriveFloorMother(model),rootId=model.graph.nodes[0].id;
const north=mother.walls.filter(w=>w.exterior&&w.a[1]<-8&&w.b[1]<-8),level=model.levels.at(-1),floor={...level,clearHeight:model.sourceBinding.mainRoofLocal-.18-level.elevation};
const sourcePatch={...source.patches.find(p=>p.sourcePatchId==='p120'),sourceModelId:source.sourceModelId};
const frozen={source:JSON.stringify(source),levels:JSON.stringify(model.levels),bundle:JSON.stringify(bundle),mother:JSON.stringify(mother)};
const input=(i=0,thickness=.14,placement=undefined)=>({observation:bundle.fields[i],sourcePatch,designFloor:floor,hostBoundary:{...north[0],segments:north,id:rootId+':source-envelope:p120',modelRootId:rootId,sourceModelId:source.sourceModelId,instanceId:460+i,placement},dimensions:{...SOURCE_HOSTED_WINDOW_DEFAULTS,wallThickness:thickness}});
const all=bundle.fields.map((_,i)=>deriveSourceHostedWindow(input(i)));
eq(new Set(all.map(x=>x.ownershipSpec.infillId)).size,3,'same-wall windows have independent semantic IDs');
eq(new Set(all.flatMap(x=>x.aperture.primitives.map(p=>p.objectId))).size,9,'frame/leaf/glass IDs are unique');
eq(packApertureDescriptors(all.map(x=>x.aperture)).primitiveCount,9,'real R07 descriptor emitter consumes all three');
const graph={nodes:[{id:rootId,type:'building'},{id:rootId+':source-envelope:p120',type:'source-envelope',ownerBuildingId:source.sourceModelId}],edges:[]};
const chains=all.map(x=>attachOpeningOwnership(graph,x.ownershipSpec));ok(validateOpeningOwnership(graph,chains).passed,'all physical component ownership chains validated');
for(const x of all){
 ok(validateSourceHostedWindowPlacement(x).passed,'actual emitted geometry matches host placement');
 eq(x.aperture.primitives.map(p=>p.part),['frame','leaf','glass'],'uses real original parser/emitter parts');
 eq(x.evidence.actualMechanism,null);eq(x.evidence.realFloorAssignment,null);eq(x.evidence.actualIndoorFFLVerified,false);eq(x.evidence.actualDimensions,null);
 eq(x.aperture.counts.modelTriangles,0);eq(x.aperture.counts.modelVertexBuffers,0);
 const ids=x.ownershipSpec,glass=ids.parts.find(p=>p.type==='glass');eq(glass.parentId,ids.infillId+':part:leaf','glass is owned by its emitted leaf');
 ok(graph.edges.some(e=>e.from===ids.openingId&&e.to===ids.wallId&&e.type==='voids'),'opening voids correct source wall');
 ok(graph.edges.some(e=>e.from===ids.infillId&&e.to===ids.openingId&&e.type==='fills'),'infill fills only its own opening');
 const pane=x.aperture.primitives.find(p=>p.part==='glass'),origin=pane.origin.map((v,i)=>v-pane.w[i]);
 const hit=intersectAperturesRay(x.aperture,origin,pane.w,{maxDistance:2});ok(hit.hit&&hit.part==='glass','analytic ray reaches physical pane, not a mesh');
 const interval=apertureGlassInterval(x.aperture,pane.objectId,origin,pane.w);ok(Math.abs(interval.pathLength-x.dimensions.windowGlassThickness)<1e-8,'actual glass interval consumes explicit thickness');
}
const thin=deriveSourceHostedWindow(input(1,.12)),thick=deriveSourceHostedWindow(input(1,.18)),back=deriveSourceHostedWindow(input(1,.12));
eq(thin,back,'0.12 -> 0.18 -> 0.12 exact recipe/geometry rollback');
eq(thin.openingRule.wallThickness,.12);eq(thick.openingRule.wallThickness,.18);eq(thick.aperture.config.wallThickness,.18);
ok(Math.abs(thick.revealSpec.depthM-thin.revealSpec.depthM-.03)<1e-8,'reveal follows same Mother wall thickness');
ok(JSON.stringify(thin.aperture.primitives)!==JSON.stringify(thick.aperture.primitives),'wall change moves actual leaf/glass front plane');
const changed=input(0,.18);changed.dimensions.windowFrameDepth=.2;changed.dimensions.windowGlassThickness=.009;const custom=deriveSourceHostedWindow(changed);
eq(custom.aperture.primitives.find(p=>p.part==='frame').halfDepth,.1,'frame emitter consumes explicit depth');eq(custom.aperture.primitives.find(p=>p.part==='glass').halfDepth,.0045,'glass emitter consumes explicit depth');

// Synthetic placement only. It NEVER moves the actual real-building source.
const angle=Math.PI/3,c=Math.cos(angle),s=Math.sin(angle),placement={origin:[5,2,-3],u:[c,0,-s],v:[0,1,0],w:[s,0,c]};
const transform=p=>[5+c*p[0]+s*p[2],2+p[1],-3-s*p[0]+c*p[2]],near=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]))<1e-7;
const moved=deriveSourceHostedWindow(input(0,.14,placement)),original=all[0];
ok(validateSourceHostedWindowPlacement(moved).passed,'all propagated transformed geometry validates');
ok(near(moved.aperture.host.origin,transform(original.aperture.host.origin)),'wall parent rigid pose moves opening host');
for(const p of original.aperture.primitives){const q=moved.aperture.primitives.find(q=>q.part===p.part);ok(near(q.origin,transform(p.origin)),'parent motion reaches emitted '+p.part);}
ok(near(moved.revealSpec.pose.origin,transform(original.revealSpec.pose.origin)),'parent motion reaches reveal');
ok(near(moved.mask.frame.origin,transform(original.mask.frame.origin)),'parent motion reaches source mask');
for(let i=0;i<4;i++)ok(near(moved.openingRule.corners[i],transform(original.openingRule.corners[i])),'parent motion reaches opening corner');
for(let i=0;i<moved.wallCuts.length;i++)ok(near(moved.wallCuts[i].worldCenter,transform(original.wallCuts[i].worldCenter)),'parent motion reaches projected design-wall cut');
eq(moved.ownershipSpec,original.ownershipSpec,'synthetic motion changes pose, not ownership IDs');
const stale=structuredClone(moved);stale.aperture.primitives=structuredClone(original.aperture.primitives);ok(!validateSourceHostedWindowPlacement(stale).passed,'reject correct owner but stale emitted world pose');
const staleHost=structuredClone(moved);staleHost.aperture.host=structuredClone(original.aperture.host);ok(!validateSourceHostedWindowPlacement(staleHost).passed,'reject correct owner but stale host world pose');

reject(()=>deriveSourceHostedWindow({...input(),observation:null}),/observation/);
reject(()=>deriveSourceHostedWindow({...input(),sourcePatch:null}),/observation/);
reject(()=>deriveSourceHostedWindow({...input(),sourcePatch:{...sourcePatch,sourceModelId:'another-building'}}),/identity mismatch/);
reject(()=>deriveSourceHostedWindow({...input(),observation:{...bundle.fields[0],sourcePatchId:'p121'}}),/identity mismatch/);
const noDimensions=input();delete noDimensions.dimensions.windowGlassThickness;reject(()=>deriveSourceHostedWindow(noDimensions),/windowGlassThickness/);
const noWall=input();delete noWall.dimensions.wallThickness;reject(()=>deriveSourceHostedWindow(noWall),/wallThickness/);
const missingFrame=input();missingFrame.observation={...bundle.fields[0],sourceFrame:null};reject(()=>deriveSourceHostedWindow(missingFrame),/frame/);
const unsupported=input();unsupported.observation={...bundle.fields[0],localRing:[[0,100],[2,100],[2,99],[0,99]]};reject(()=>deriveSourceHostedWindow(unsupported),/finite original source face/);
const badLevel=input();badLevel.designFloor={...floor,elevation:20};reject(()=>deriveSourceHostedWindow(badLevel),/floor/);
const shear=input();shear.hostBoundary.placement={...placement,u:[2,0,0]};reject(()=>deriveSourceHostedWindow(shear),/rigid/);
const invalidSize=input();invalidSize.dimensions.windowGlassThickness=.2;reject(()=>deriveSourceHostedWindow(invalidSize),/design domain/);
const designSwing=input();designSwing.dimensions.windowMechanism='hinge-left';designSwing.dimensions.windowOpenT=.5;const swung=deriveSourceHostedWindow(designSwing);eq(swung.evidence.actualMechanism,null,'design operation is never asserted as actual equipment');

// Actual existing building pipeline, not only an isolated function/ownership test.
const seed={caseId:'lowrise',source,model,openingEvidence:bundle},seedBefore=JSON.stringify(seed);
const generatedA=growBuilding(seed,{dimensions:{wallThickness:.12}}),generatedB=growBuilding(seed,{dimensions:{wallThickness:.18}}),generatedA2=growBuilding(seed,{dimensions:{wallThickness:.12}});
eq(generatedA,generatedA2,'actual growBuilding 0.12 -> 0.18 -> 0.12 full deterministic rollback');
ok(generatedA.validation.passed&&generatedB.validation.passed,'actual Mother graph validates with new window path');
eq(JSON.stringify(seed),seedBefore,'actual growBuilding leaves retained seed immutable');
eq(generatedA.model.levels,model.levels,'integration preserves floor count/elevations');
eq(generatedB.model.levels,model.levels,'thickness change does not touch real level records');
eq(generatedA.model.instances.length,generatedB.model.instances.length,'regeneration does not accumulate instances');
eq(generatedA.model.graph.nodes.length,generatedB.model.graph.nodes.length,'regeneration does not accumulate graph nodes');
for(const result of[generatedA,generatedB]){
 const s=result.model.completeFloorSystem,windows=s.sourceHostedWindows;
 eq(windows.length,3,'actual integrated complete floor exposes exactly three evidence-derived windows');
 ok(result.model.openingOwnership.validation.passed,'actual integrated frame/glass ownership validated');
 eq(s.observedOpeningFields.map(f=>f.id),['N-U01','N-U02','N-U03'],'integration preserves reviewed window identities');
 for(const x of windows){
  const actual=result.model.hostedComponents.apertures.find(a=>a.observationId===x.observationId);eq(actual,x.aperture,'actual rendering aperture is the shared Mother emission');
  const mask=result.model.hostedComponents.sourceMasks.find(m=>m.instanceId===x.aperture.instanceId);eq(mask,x.mask,'actual source mask is the shared Mother emission');
  const ar=result.model.archetypes.find(a=>a.id==='complete-window-reveals'),reveal=ar.primitives.find(p=>p.nodeId===x.revealSpec.nodeId);
  eq(reveal.origin,x.revealSpec.pose.origin,'actual reveal uses shared host origin');eq(reveal.range,x.revealSpec.range,'actual reveal uses shared depth');
  const record=result.model.hostedComponents.records.find(r=>r.instanceId===x.aperture.instanceId);eq(record.dimensions.wallThickness,x.dimensions.wallThickness);eq(record.dimensions.frameDepth,x.dimensions.windowFrameDepth);eq(record.dimensions.glassThickness,x.dimensions.windowGlassThickness);
  eq(record.actualMechanism,null);eq(x.evidence.realFloorAssignment,null);
 }
 ok(validateCompleteFloorSystem(result.model,{physical:false}).passed,'existing relation/door-ray validator passes with integration');
}
const integratedCustom=growBuilding(seed,{dimensions:{wallThickness:.18,windowFrameDepth:.2,windowGlassThickness:.009}});
for(const a of integratedCustom.model.hostedComponents.apertures.filter(a=>a.observationId)){eq(a.primitives.find(p=>p.part==='frame').halfDepth,.1,'actual frame geometry follows UI-ready Mother parameter');eq(a.primitives.find(p=>p.part==='glass').halfDepth,.0045,'actual glass geometry follows UI-ready Mother parameter');}
reject(()=>growBuilding(seed,{dimensions:{windowGlassThickness:.2}}),/design domain/);
eq(JSON.stringify(source),frozen.source,'all original source planes/shape/georeference unchanged');eq(JSON.stringify(model.levels),frozen.levels,'actual retained level count/elevations unchanged');eq(model.levels.length,2,'no extra storeys');eq(JSON.stringify(bundle),frozen.bundle,'no extra real window observations or upgraded evidence');eq(JSON.stringify(mother),frozen.mother,'existing Mother remains immutable');
console.log(JSON.stringify({passed:true,checks,observedWindows:3,emittedParts:9,geometry:'existing R07 analytic aperture emitter',transformTest:'synthetic rigid parent movement only',realFloorAssignment:null,actualMechanism:null,sourceShapeChanged:false,realStoreysChanged:false,browserQA:'not_run_by_this_module_test'},null,2));
