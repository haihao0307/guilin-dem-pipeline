// One read-only presentation bridge over the preserved 120 Hz new88 state.
// It does not integrate pressure, forces, fuel or water and never writes them.
// Six geometry-derived cycle marks are provisional, NOT measured valve release.
export const STEAM_PRESENTATION_CONTRACT=Object.freeze({wheelRadiusM:1.016,initialMechanicalThetaRad:.25,cylinderPhases:[['right',0],['inside',4*Math.PI/3],['left',2*Math.PI/3]],eventKind:'KINEMATIC_CYCLE_MARKER',measuredValveExhaustTiming:false,sharedConsumers:['smoke','sound'],perCylinderPressure:null,physicalDrains:null,boilerSteamWaterPhase:null,solvedPlumeFlow:null});
const finite=(x,n)=>{if(!Number.isFinite(x))throw Error('STEAM_PRESENTATION_FINITE_'+n);return x};
export function createSteamPresentationBridge({maxEventsPerRead=512}={}){
 let previous=null,serial=0;const listeners=new Set();
 function read({sessionEpoch,physics:s,paused=false}={}){
  if(typeof sessionEpoch!=='string'||!sessionEpoch)throw Error('EXPLICIT_SESSION_EPOCH_REQUIRED');
  for(const key of['tick','timeS','positionM','rollingOriginPositionM','wheelAngleRad','wheelAngularSpeedRadS','wheelRadiusM','initialMechanicalThetaRad','speedMps','waterKg','coalKg','boilerPressurePa','steamChestPressurePa'])finite(s?.[key],key);
  const flow=finite(s.diagnostics?.steamFlowKgS,'steamFlowKgS'),throttle=finite(s.controls?.throttle,'physicalThrottle');
  if(Math.abs(s.wheelRadiusM-1.016)>1e-12||Math.abs(s.positionM-s.rollingOriginPositionM-s.wheelRadiusM*s.wheelAngleRad)>1e-7||Math.abs(s.speedMps-s.wheelRadiusM*s.wheelAngularSpeedRadS)>1e-7)throw Error('PRESERVED_IDEAL_ROLLING_CONTRACT_MISMATCH');
  const now={epoch:sessionEpoch,tick:s.tick,time:s.timeS,angle:s.wheelAngleRad,origin:s.rollingOriginPositionM,initial:s.initialMechanicalThetaRad},events=[],warnings=[];
  const reset=!previous||previous.epoch!==sessionEpoch||now.time<previous.time||now.tick<previous.tick||now.origin!==previous.origin||now.initial!==previous.initial;
  const repeated=previous&&now.tick===previous.tick&&now.time===previous.time&&now.angle===previous.angle;
  if(paused&&previous&&(now.tick!==previous.tick||now.angle!==previous.angle))warnings.push('Physical state changed while presentation marked paused; presentation rebased without backlog.');
  const permitted=flow>0&&s.waterKg>0&&s.steamChestPressurePa>0;
  if(flow>0&&(s.waterKg<=0||s.steamChestPressurePa<=0))warnings.push('Positive cycle-average flow conflicts with supply state; powered presentation suppressed.');
  if(!reset&&!repeated&&!paused&&now.angle!==previous.angle){
   const lo=Math.min(previous.angle,now.angle),hi=Math.max(previous.angle,now.angle),forward=now.angle>previous.angle,crossings=[];
   for(const[id,phi]of STEAM_PRESENTATION_CONTRACT.cylinderPhases){const base=now.initial+phi,k0=Math.ceil((base-hi)/Math.PI-1e-12),k1=Math.floor((base-lo)/Math.PI+1e-12);if(k1-k0>maxEventsPerRead)throw Error('PRESENTATION_DISCONTINUITY_REQUIRES_REBASE');for(let k=k0;k<=k1;k++){const angle=base-k*Math.PI,inside=forward?angle>previous.angle+1e-11&&angle<=now.angle+1e-11:angle<previous.angle-1e-11&&angle>=now.angle-1e-11;if(inside)crossings.push({cylinderId:id,k,angle})}}
   crossings.sort((a,b)=>forward?a.angle-b.angle:b.angle-a.angle);if(crossings.length>maxEventsPerRead)throw Error('PRESENTATION_DISCONTINUITY_REQUIRES_REBASE');
   for(const c of crossings){const t=(c.angle-previous.angle)/(now.angle-previous.angle);events.push(Object.freeze({eventId:sessionEpoch+':cycle:'+serial++,sessionEpoch,timingKind:'KINEMATIC_CYCLE_MARKER',measuredValveExhaustTiming:false,cylinderId:c.cylinderId,crankMarker:c.k%2===0?'crank-0':'crank-pi',direction:forward?'forward':'reverse',crossingWheelAngleRad:c.angle,crossingTimeEstimateS:previous.time+t*(now.time-previous.time),physicsTickInterval:[previous.tick,now.tick],interpolationMethod:'linear bracket estimate from supplied fixed-step states',poweredPresentationPermitted:permitted,cycleAverageFlowKgS:flow,perCylinderExhaustFlowKgS:null,physicalDrainState:null}))}
  }
  previous=now;const packet=Object.freeze({eventKind:STEAM_PRESENTATION_CONTRACT.eventKind,events:Object.freeze(events),reset,repeated:!!repeated,paused,poweredSteamAvailable:permitted,cycleAverageSteamFlowKgS:flow,physicalThrottle:throttle,boilerPressurePa:s.boilerPressurePa,steamChestPressurePa:s.steamChestPressurePa,stock:{coalKg:s.coalKg,waterKg:s.waterKg},unavailable:{valveGear:null,cylinderChambers:null,perCylinderExhaustFlow:null,physicalDrains:null,boilerTwoPhaseState:null,solvedPlumeField:null},warnings,consumersMustShareEventIds:true,physicalIntegratorModified:false});for(const fn of listeners)fn(packet);return packet;
 }
 return{read,subscribe(fn){if(typeof fn!=='function')throw Error('FUNCTION_LISTENER_REQUIRED');listeners.add(fn);return()=>listeners.delete(fn)},reset(){previous=null},contract:STEAM_PRESENTATION_CONTRACT};
}
