import assert from 'node:assert/strict';
import fs from 'node:fs';
import {getBuildingUseContract,attachUsageRelations,BUILDING_USE_SCHEMA} from './building-use-contract.mjs';
import {deriveMeasuredCase} from './kowloon-building-mother-r01/r07/cases.mjs';
import {profileFor} from './kowloon-building-mother-r01/r07/profiles.mjs';
import {controllerFor} from './kowloon-building-mother-r01/whole-building-ground-r01/controller.mjs';
let checks=0;const check=(v,msg)=>{assert.ok(v,msg);checks++;};
const read=p=>JSON.parse(fs.readFileSync(new URL(p,import.meta.url)));
const official=read('./kowloon-building-mother-r01/r07/sources/official-footprints.json');
for(const caseId of ['lowrise','kcc','warehouse']){
 const c=getBuildingUseContract(caseId);check(c.schema===BUILDING_USE_SCHEMA,'explicit contract schema');
 check(!c.geometryChanged&&!c.actualEntranceSurveyComplete&&!c.actualRoomSurveyComplete,'no survey/geometry claims');
 check(!c.clearancePolicy.inferFromBuildingUse&&!c.clearancePolicy.truckAccessVerified,'use cannot imply clearance');
 check(c.clearancePolicy.actualClearWidthM===null&&c.clearancePolicy.actualTurningOrSweptPath===null,'unknown metric/access evidence retained');
 const p=profileFor(caseId),source=deriveMeasuredCase(read('./hk-three-buildings-r01/geometry/'+p.modelId+'.score.json')),model=controllerFor(caseId).derive(source,official),before=JSON.stringify(model),a=attachUsageRelations(model);
 check(JSON.stringify(model)===before,'input immutable');
 check(a!==model&&a.graph===model.graph&&a.archetypes===model.archetypes&&a.instances===model.instances&&a.levels===model.levels,'no geometry or graph replacement');
 const {usageRelations,...rest}=a;check(JSON.stringify(rest)===before,'only usageRelations added');
 check(a.usageRelations.caseId===caseId&&a.usageRelations.buildingId===model.sourceModelId,'identity preserved');
 for(const r of a.usageRelations.entranceRoles){
  check(r.actual.clearWidthM===null&&r.actual.clearHeightM===null&&r.actual.trafficPermission===null,'actual door metrics/access not inferred');
  if(r.designReference)check(!r.designReference.dimensionsAreActualClearance&&!r.designReference.actualRouteVerified&&r.designReference.actualServedFloors===null,'authored dimensional values separated');
 }
 const again=attachUsageRelations(a);check(JSON.stringify(again.usageRelations)===JSON.stringify(a.usageRelations),'idempotent attachment');
}
const l=getBuildingUseContract('lowrise');check(l.roomPolicy.roomNamesAreDesignAssumptions&&!l.roomPolicy.actualRoomLayoutVerified,'room names not observed');
check(l.facts[0].documentedUnitCount===2,'two residential units not seven observed rooms');
check(l.entranceRoles.find(r=>r.key==='house').actualRoleEvidence==='unknown','building door not photo gate');
const k=getBuildingUseContract('kcc');check(k.buildingUse==='mixed_use','mixed use');
check(k.floorUseEvidence.find(f=>f.use==='kindergarten').actualFloorLabels.join('|')==='G/F (part)|1/F','kindergarten bounded floor scope');
check(k.floorUseEvidence.find(f=>f.use==='chamber_office').actualFloorLabels[0]==='3/F','chamber scope');
check(k.roomPolicy.authoredPAndTFloorIdsAreNotActualFloorLabels,'no actual-to-design floor map invented');
const w=getBuildingUseContract('warehouse');check(!w.roomPolicy.residentialRoomTemplateApplicable,'warehouse not residential layout');
check(['personnel','vehicle','goods','service'].every(role=>w.entranceRoles.some(e=>e.role===role)),'four role categories distinct');
check(w.entranceRoles.find(e=>e.role==='service').existingModelSlot===null,'unknown service door not generated');
assert.throws(()=>getBuildingUseContract('unknown'),/Known building/);checks++;
assert.throws(()=>attachUsageRelations({caseId:'lowrise',sourceModelId:'wrong'}),/Matching known/);checks++;
const mutable=getBuildingUseContract('lowrise');mutable.sources.lowrise.url='changed';check(getBuildingUseContract('lowrise').sources.lowrise.url!=='changed','contract consumers cannot mutate source registry');
console.log(JSON.stringify({passed:true,checks,geometryChanged:false,actualEntranceSurveyComplete:false},null,2));
