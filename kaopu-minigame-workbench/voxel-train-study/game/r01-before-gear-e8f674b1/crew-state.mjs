// Small procedural crew gestures, driven only by the authoritative game view.
// These are readable game cues, not a reconstruction of a historical ritual.
export const CREW_SPEC=Object.freeze({
  driverHead:Object.freeze([-1.74,2.82,.78]),
  attendantFeet:Object.freeze([-1.6,.82,2.65]),
  attendantWhistle:Object.freeze([-1.6,1.69,2.48]),
  closingSeconds:1.1,
  movingThreshold:.001,
  platformRange:7
});
const clamp=x=>Math.max(0,Math.min(1,x));
const smooth=x=>{const t=clamp(x);return t*t*(3-2*t);};
const servicePhases=new Set(['doors-opening','unloading','boarding','ready-depart','doors-closing']);

export function driverCrewPose(view={}){
  const speed=Math.abs(Number(view.velocity)||0),station=view.station;
  const remaining=Number.isFinite(station?.remaining)?station.remaining:
    Number.isFinite(station?.target)&&Number.isFinite(view.distance)?station.target-view.distance:Infinity;
  const atPlatform=Math.abs(remaining)<=CREW_SPEC.platformRange||servicePhases.has(view.phase);
  const towardPlatform=speed<CREW_SPEC.movingThreshold&&atPlatform;
  let turn=towardPlatform?0:1;
  // Look ahead again before the doors finish closing; a halted arrival turns
  // toward the platform during opening. Both use the saved simulation door
  // progress, so repeated frames and paused/restored states are identical.
  if(towardPlatform&&view.phase==='doors-closing')turn=smooth(((1-(Number(view.door)||0))-.65)/.35);
  else if(towardPlatform&&view.phase==='doors-opening'&&Number(view.station?.index)>0)turn=1-smooth((Number(view.door)||0)/.6);
  const yaw=turn*Math.PI/2;
  return{yaw,facing:turn===0?'platform':turn===1?'forward':'turning',forward:[Math.sin(yaw),0,Math.cos(yaw)]};
}

export function attendantCrewPose(view={},isCurrentStation=false){
  // Door progress already comes from Session's fixed simulation clock, so it
  // survives restoration and remains exactly frozen during pause. No repeated
  // sinusoid, render-delta integration, wall clock, or remembered event latch.
  const active=isCurrentStation&&view.phase==='doors-closing';
  const progress=active?clamp(1-(Number.isFinite(view.door)?view.door:1)):0;
  const raise=active?smooth(progress/.28)*(1-smooth((progress-.63)/.34)):0;
  return{gesture:raise>0?'hand-to-whistle':'rest',raise,progress,active};
}
