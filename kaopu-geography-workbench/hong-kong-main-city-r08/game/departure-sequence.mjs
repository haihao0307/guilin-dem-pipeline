// Authored operating sequence over retained DrivingPhysics. No position integration.
export const DEPARTURE_DEFAULTS=Object.freeze({purgeDurationS:3,launchDurationS:6,targetThrottle:.82,cutoff:.68});
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function createDepartureSequence(settings={}){
 const config={...DEPARTURE_DEFAULTS,...settings};for(const k of ['purgeDurationS','launchDurationS'])if(!Number.isFinite(config[k])||config[k]<.1||config[k]>30)throw Error('Departure duration outside .1–30 seconds');
 let active=false,startedAt=0,phase='ready',resetId=0,lastCancel=null;
 function begin(s){if(active)return false;active=true;startedAt=s.timeS;phase='purge';lastCancel=null;return true;}
 function cancel(reason='manual'){active=false;lastCancel=reason;}
 function reset(){active=false;phase='ready';startedAt=0;resetId++;lastCancel='review-reset';}
 function sample(s){const elapsed=Math.max(0,s.timeS-startedAt);let controls=null,phaseElapsedS=0,progress=0;
  if(active&&elapsed<config.purgeDurationS){phase='purge';phaseElapsedS=elapsed;progress=clamp(elapsed/config.purgeDurationS,0,1);controls={throttle:0,brake:1,reverser:1,cutoff:config.cutoff};}
  else if(active&&elapsed<config.purgeDurationS+config.launchDurationS){phase='launch';phaseElapsedS=elapsed-config.purgeDurationS;progress=clamp(phaseElapsedS/config.launchDurationS,0,1);const smooth=progress*progress*(3-2*progress);controls={throttle:config.targetThrottle*smooth,brake:1-smooth,reverser:1,cutoff:config.cutoff};}
  else if(active){phase='running';controls={throttle:config.targetThrottle,brake:0,reverser:1,cutoff:config.cutoff};}
  else{phase=s.controls.brake>.02&&Math.abs(s.speedMps)>.02?'stopping':s.tick>0?'running':'ready';}
  return {controls,active,exhaust:{phase,phaseElapsedS,purgeDurationS:config.purgeDurationS,launchDurationS:config.launchDurationS,resetId},progress,lastCancel,config:{...config},timeSource:'retained DrivingPhysics.timeS',designParameters:true};
 }
 return{begin,cancel,reset,sample,completeIfDue(s){if(active&&s.timeS-startedAt>=config.purgeDurationS+config.launchDurationS)active=false;},get active(){return active;},config};
}
