/** Ground/basement adapter. The frozen above-ground controllers remain untouched. */
import {controllerFor as originalControllerFor} from '../whole-building-r02/mother-system.mjs';
import {deriveGroundSystem,routeGroundSystem,validateGroundSystem,queryGroundSystem,intersectGroundSystemRay,selectedGroundInstances,setGroundVisibility} from './ground-system.mjs';
const systems=new WeakMap(),controllers=new Map();
export function groundFor(model){const s=systems.get(model);if(!s)throw Error('Matching ground-system model required');return s;}
export function setGroundDisplay(model,visible){const next=setGroundVisibility(groundFor(model),visible);systems.set(model,next);return next;}
export function controllerFor(caseId){
 if(controllers.has(caseId))return controllers.get(caseId);
 const base=originalControllerFor(caseId),c={...base,
  derive(measured,official,parameters={}){const {groundOptions={},...original}=parameters;const baseModel=base.derive(measured,official,original),s=deriveGroundSystem(baseModel,official,groundOptions);systems.set(s.model,s);return s.model;},
  route(model,floorId,options={}){const s=groundFor(model);if(s.baseModel.levels.some(l=>l.id===floorId))return base.route(s.baseModel,floorId,options);if(options.mode&&options.mode!=='stairs')throw Error('Basement lift service is unknown and is not generated');return routeGroundSystem(s,floorId,options);},
  query(model,p,options){return queryGroundSystem(groundFor(model),p,options);},
  ray(model,origin,direction,options){return intersectGroundSystemRay(groundFor(model),origin,direction,options);},
  selectedInstances(model,options){return selectedGroundInstances(groundFor(model),options);},
  validate(model){const s=groundFor(model);base.validate(s.baseModel);return validateGroundSystem(s);}
 };
 for(const op of ['createLiftState','targetLift','advanceLift','liftVisuals','liftDoorLinks','loadingRoute'])c[op]=(model,...args)=>base[op](groundFor(model).baseModel,...args);
 controllers.set(caseId,Object.freeze(c));return controllers.get(caseId);
}
