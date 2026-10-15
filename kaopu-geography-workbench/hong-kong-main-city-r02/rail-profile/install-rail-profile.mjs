import {createConstrainedRoute,stepDriveOnProfile,railPoseEuler} from './vertical-profile.mjs';
export async function installRailVerticalProfile({constraintsURL=new URL('./game-design-constraints.json',import.meta.url),target=globalThis}={}){
 const response=await fetch(constraintsURL);if(!response.ok)throw Error('Rail profile constraints unavailable: '+response.status);const constraints=await response.json();
 const api={schema:'kaopu.game.rail-vertical-profile/1',constraints,status:'awaiting_route_validation',create(original,terrainHeight){const route=createConstrainedRoute(original,constraints,{terrainHeight});api.status='profile_validated';api.route=route;api.validation=route.verticalValidation;api.originalRoute=original;api.designLabel='15‰ is the editable GAME ceiling, not a universal railway standard';api.candidateAt=d=>route.terrainCandidateAt(d);return route;},stepDrive:stepDriveOnProfile,railPoseEuler};
 target.HKRailVertical=api;return api;
}
