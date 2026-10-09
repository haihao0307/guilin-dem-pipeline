/** Local integration candidate: pre-held light box, captured walk then stop.
 * Existing human/scene ownership stays with the host. No pickup, weight,
 * autonomous navigation, rigid release or force-closure claim. */
import {createCapturedActivityController} from '../activity-r01/CapturedActivityController.mjs';
import {HandBodyCoordinator} from '../hand-body-r01/HandBodyCoordinator.mjs';
import {CarryUpperBodyAdapter} from './CarryUpperBodyAdapter.mjs';
import {planCarryClearance} from './PlanCarryClearance.mjs';
import {calibrateCarryGrip,measureCarryHands} from './CalibrateCarryGrip.mjs';
export function createCarryWalkController({human,source}){
 if(!human?.rig||typeof human.animate!=='function')throw Error('Existing complete native human required');
 const options={names:human.names,parents:human.rig.parents,restMatrices:human.rig.restMatrices,stature:human.height,floorOffset:human.floorOffset},base=createCapturedActivityController(human,source),adapter=new CarryUpperBodyAdapter(options),hand=new HandBodyCoordinator(options),ref=hand.evaluate(3,{task:'carry'}),handReference={...options,skinMatrices:ref.skinMatrices.map(m=>Array.from(m))},bodyPlan=planCarryClearance(human,base,adapter),fit=calibrateCarryGrip(human,adapter,base.evaluate(0),handReference,{objectForwardOffset:bodyPlan.objectForwardOffset});let disposed=false,latest=null,time=0;
 const check=()=>{if(disposed)throw Error('Carry controller disposed');};
 const api={human,base,adapter,duration:base.duration,fit,bodyPlan,
  update(seconds){check();if(!Number.isFinite(seconds)||seconds<0)throw Error('Finite nonnegative time required');time=Math.min(seconds,base.duration);latest=adapter.evaluate(base.evaluate(time),{handReference,gripClearance:fit.gripClearance,objectForwardOffset:bodyPlan.objectForwardOffset});human.animate(latest.skinMatrices);return latest;},
  evaluate(seconds){return api.update(seconds);},
  reset(){check();base.reset();return api.update(0);},
  measureSurface(){check();if(!latest)api.update(0);return measureCarryHands(human,latest,fit.regions);},
  diagnostics(){return{schema:'preheld-box-captured-walk/1',time,duration:base.duration,fullVertices:human.N,bones:human.names.length,source:source.clip||'16_33',phase:time===base.duration?'completed-hold':'carrying-walk',lowerBodyExact:latest?.metrics.protectedDifference===0,kinematicObject:true,weightFeedback:false,pickupValidated:false,releaseValidated:false,graspForceClosure:false,visualValidated:false,fitMarginM:fit.margin,gripClearance:fit.gripClearance};},
  dispose(){disposed=true;latest=null;/* Host retains human and scene objects. */}};
 api.reset();return api;
}
