import {createSketchRoute,displayPlan,stepDriveOnProfile,railPoseEuler} from './route-runtime.mjs';
export async function installRailVerticalProfile({planURL=new URL('./route-plan.json',import.meta.url),target=globalThis}={}){
 if(target.HKRailVertical?.schema==='kaopu.authored.rail-sketch-runtime/1')return target.HKRailVertical;
 const response=await fetch(planURL);if(!response.ok)throw Error('Authored route spectrum unavailable: '+response.status);const plan=await response.json(),display=displayPlan(plan);
 const api={schema:'kaopu.authored.rail-sketch-runtime/1',status:'plan_loaded_waiting_host',plan,constraints:plan.verticalConstraints,conflicts:plan.conflictClusters||[],...display,create(original,terrainHeight){const route=createSketchRoute(plan,original,terrainHeight);api.route=route;api.validation=route.verticalValidation;api.originalRoute=original;api.yardAnchor=route.yardAnchor;api.status='profile_validated';api.designLabel=plan.verticalConstraints.maxGradePermille+'‰ editable GAME ceiling; provisional registered sketch, not railway certification';api.candidateAt=d=>route.terrainCandidateAt(d);return route;},stepDrive:stepDriveOnProfile,railPoseEuler};target.HKRailVertical=api;return api;
}
export const installSketchRouteProfile=installRailVerticalProfile;
