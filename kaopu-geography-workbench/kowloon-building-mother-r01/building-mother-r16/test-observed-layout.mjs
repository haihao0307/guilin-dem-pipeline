import assert from'node:assert/strict';
import fs from'node:fs';
import{observedFloor,attachObservedLayouts,selectObserved,KCC_ID}from'./kcc-observed-layout.mjs';
import{deriveMeasuredCase}from'./kowloon-building-mother-r01/r07/cases.mjs';
import{profileFor}from'./kowloon-building-mother-r01/r07/profiles.mjs';
import{controllerFor}from'./kowloon-building-mother-r01/whole-building-ground-r01/controller.mjs';
import{deriveCaseIntegration}from'./kowloon-building-mother-r01/whole-building-facade-r01/host-integration.mjs';
import{integrateCompleteFloorSystem}from'./complete-floor-system.mjs';
import{prepareBuildingLifts}from'./lift-runtime.mjs';
import{composeBuildingScene}from'./unified-scene.mjs';
const read=p=>JSON.parse(fs.readFileSync(new URL(p,import.meta.url)));
let checks=0;const ok=(x,m)=>{assert(x,m);checks++;};
for(let f=5;f<=26;f++){
 const p=observedFloor(f);ok(p.supported,'supported floor');ok(p.nodes.filter(n=>n.type==='lift_interface').length===3,'three lifts');ok(p.nodes.filter(n=>n.type==='stair_route_entry').length===2,'two stair entries');ok(p.nodes.filter(n=>n.type==='dwelling').length===6,'six units');ok(p.nodes.filter(n=>n.type==='sixth_floor_platform').length===(f===6?2:0),'sixth-only platform');ok(new Set(p.nodes.map(n=>n.id)).size===p.nodes.length,'unique identities');ok(p.edges.every(e=>p.nodes.some(n=>n.id===e.from)&&p.nodes.some(n=>n.id===e.to)),'closed relations');ok(p.registration.matrix===null&&!p.worldGeometryEnabled,'no fake registration');
 for(const n of p.nodes.filter(n=>n.type==='entry_door'))ok(p.edges.some(e=>e.from===n.id&&e.type==='fills'),'actual opening link');
}
for(const f of[0,1,2,3,4,27])ok(!observedFloor(f).supported,'no invented unsupported floor');
const official=read('./kowloon-building-mother-r01/r07/sources/official-footprints.json'),openingEvidence=read('./evidence/lowrise-opening-proposal.json');
const entries=[];
for(const caseId of['lowrise','kcc','warehouse']){const profile=profileFor(caseId),source=deriveMeasuredCase(read('./hk-three-buildings-r01/geometry/'+profile.modelId+'.score.json')),controller=controllerFor(caseId),whole=controller.derive(source,official,{}),integration=deriveCaseIntegration(caseId,whole,source,official,{doorOpenT:1}),lift=controller.liftVisuals(whole,controller.createLiftState(whole));const original=integrateCompleteFloorSystem({...integration.model,archetypes:[...integration.model.archetypes,...lift.archetypes],instances:[...integration.model.instances,...lift.instances]},source,{openingEvidence});const model=attachObservedLayouts(original);ok(JSON.stringify(original.levels)===JSON.stringify(model.levels),'unchanged original levels');ok(original.instances===model.instances&&original.archetypes===model.archetypes,'unchanged geometry');if(caseId==='kcc')ok(model.observedLayouts?.floors.length===22,'actually attached KCC');else ok(model===original,'other buildings untouched');entries.push({caseId,source,model,controller,whole});}
const prepared=prepareBuildingLifts(entries);const scene=composeBuildingScene(prepared.entries),b=scene.buildings.find(b=>b.caseId==='kcc');ok(selectObserved(b,6)?.nodes.some(n=>n.type==='sixth_floor_platform'),'survives full actual scene pipeline');ok(selectObserved(scene.buildings[0],6)===null,'ownership guard');ok(scene.source.patches.length===225,'source shapes preserved');
fs.writeFileSync(new URL('./observed-layout-test-results.json',import.meta.url),JSON.stringify({passed:true,checks,sourcePatchCount:scene.source.patches.length,actualBuildingGeometryChanged:false,registration:'unresolved',visualBrowserTest:'not_run',published:false},null,2));console.log({passed:true,checks});
