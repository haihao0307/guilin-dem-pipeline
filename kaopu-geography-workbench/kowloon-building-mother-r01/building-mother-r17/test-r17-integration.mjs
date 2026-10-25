import assert from 'node:assert/strict';
import fs from 'node:fs';
import {growBuilding,routeInMother,frameCell,GROWTH_ORDER} from './building-mother.mjs';
import {mergeBays,compileSupportProgram,validateSupportProgram} from './frame-growth.mjs';
import {validateBuildingMother} from './building-mother.mjs';
import {INSPECTION_ASSUMPTIONS} from './kcc-candidate-structure.mjs';
import {deriveMeasuredCase} from './kowloon-building-mother-r01/r07/cases.mjs';
import {profileFor} from './kowloon-building-mother-r01/r07/profiles.mjs';
import {controllerFor} from './kowloon-building-mother-r01/whole-building-ground-r01/controller.mjs';
import {deriveCaseIntegration} from './kowloon-building-mother-r01/whole-building-facade-r01/host-integration.mjs';
import {lowriseLevelRevision} from './lowrise-level-revision.mjs';
import {prepareBuildingLifts} from './lift-runtime.mjs';
import {composeBuildingScene} from './unified-scene.mjs';
const read=p=>JSON.parse(fs.readFileSync(new URL(p,import.meta.url))),official=read('./kowloon-building-mother-r01/r07/sources/official-footprints.json'),openingEvidence=read('./evidence/lowrise-opening-proposal.json');
let checks=0;const ok=(x,msg)=>{assert(x,msg);checks++;};const seeds=[];
for(const caseId of ['lowrise','kcc','warehouse']){const p=profileFor(caseId),source=deriveMeasuredCase(read('./hk-three-buildings-r01/geometry/'+p.modelId+'.score.json')),controller=controllerFor(caseId),whole=controller.derive(source,official,caseId==='lowrise'?lowriseLevelRevision(source,official,openingEvidence).parameters:{}),integration=deriveCaseIntegration(caseId,whole,source,official,{doorOpenT:1}),lift=controller.liftVisuals(whole,controller.createLiftState(whole)),model={...integration.model,archetypes:[...integration.model.archetypes,...lift.archetypes],instances:[...integration.model.instances,...lift.instances]};seeds.push({caseId,source,model,openingEvidence,controller,whole});}

import {attachKccUnitDoors} from './kcc-unit-doors.mjs';
import {createRoomDoorRuntime} from './room-door-runtime.mjs';
import {packApertureDescriptors} from './kowloon-building-mother-r01/r07/apertures.mjs';
const generated=seeds.map(s=>({...s,model:growBuilding(s,s.caseId==='kcc'?{facade:{candidateId:'R0'}}:s.caseId==='lowrise'?{dimensions:{ordinaryDoorSystem:'shared-function'}}:{}).model}));
const reservedInstanceIds=generated.flatMap(e=>(e.model.hostedComponents?.apertures??[]).map(a=>a.instanceId));generated[1].model=attachKccUnitDoors(generated[1].model,{reservedInstanceIds});
const scene=composeBuildingScene(prepareBuildingLifts(generated).entries),b=scene.buildings.find(b=>b.caseId==='kcc'),ids=scene.registry.map(r=>r.objectId);
assert.equal(new Set(ids).size,ids.length);assert(scene.model.hostedComponents.apertures.length<=512);packApertureDescriptors(scene.model.hostedComponents.apertures);
const renderer={busy:false,staticPrimaryCache:{release(){}},hostedVisibilityKey:'x'},runtime=createRoomDoorRuntime({scene,renderer,boundCase:'kcc',getSelectedBuilding:()=>b});runtime.selectBuilding(b);
for(const floorId of ['T01','T24'])for(const roomKey of 'ABCDEF'){runtime.set({caseId:'kcc',buildingId:b.buildingId,floorId,roomKey,openT:1});const r=runtime.beforeFrame();runtime.afterFrame(r);assert(b.localModel.hostedComponents.apertures.some(a=>a.floorId===floorId&&a.roomKey===roomKey&&a.config.openT===1));}
assert.deepEqual(scene.registry.map(r=>r.objectId),ids);assert.equal(runtime.set({caseId:'warehouse',buildingId:b.buildingId,floorId:'T01',roomKey:'A',openT:1}).blocked,true);console.log(JSON.stringify({passed:true,apertures:scene.model.hostedComponents.apertures.length,geometryIDsPreserved:true,doorUpdates:12,kccFloors:b.localModel.levels.length}));
