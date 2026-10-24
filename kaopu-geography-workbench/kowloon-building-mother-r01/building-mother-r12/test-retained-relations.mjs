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
import {auditRetainedRelations} from './retained-relations.mjs';
let checks=0;const ok=(x,msg)=>{assert(x,msg);checks++;};const seeds=[];
for(const caseId of ['lowrise','kcc','warehouse']){const p=profileFor(caseId),source=deriveMeasuredCase(read('./hk-three-buildings-r01/geometry/'+p.modelId+'.score.json')),controller=controllerFor(caseId),whole=controller.derive(source,official,caseId==='lowrise'?lowriseLevelRevision(source,official,openingEvidence).parameters:{}),integration=deriveCaseIntegration(caseId,whole,source,official,{doorOpenT:1}),lift=controller.liftVisuals(whole,controller.createLiftState(whole)),model={...integration.model,archetypes:[...integration.model.archetypes,...lift.archetypes],instances:[...integration.model.instances,...lift.instances]};seeds.push({caseId,source,model,openingEvidence,controller,whole});}

for(const seed of seeds){const original=JSON.stringify(seed.model),model=growBuilding(seed).model,a=auditRetainedRelations(model);ok(a.passed,'retained interfaces valid');ok(JSON.stringify(seed.model)===original,'source immutable');ok(a.stairs.length>0,'existing stair chain covered');const bad=structuredClone(model);bad.interfaces.stairs[0].toFloorId='missing';ok(!auditRetainedRelations(bad).passed,'missing stair floor rejected');if(model.interfaces.lifts.length){const stale=structuredClone(model);stale.interfaces.lifts[0].stops[0].elevation+=.1;ok(!auditRetainedRelations(stale).passed,'wrong stop elevation rejected');const orphan=structuredClone(model);orphan.interfaces.lifts[0].ownerId='missing-core';ok(!auditRetainedRelations(orphan).passed,'missing lift core rejected');}console.log(seed.caseId,JSON.stringify({floors:a.retainedDesignFloorCount,stairs:a.stairs.length,lifts:a.lifts.length,counts:a.counts}));}
console.log({passed:true,checks,scope:'retained generated interface checks, not as-built or clearance certification'});
