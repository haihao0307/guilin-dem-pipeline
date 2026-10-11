// R13 visual micro-motion only. The reference clips do not measure suspension travel.
// Train-local axes are X longitudinal, Y up, Z lateral; angles below are radians.
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const finite=(x,fallback=0)=>Number.isFinite(x)?x:fallback;
const radians=degrees=>degrees*Math.PI/180;
const smooth=(value,target,dt,tau)=>value+(target-value)*(-Math.expm1(-dt/tau));
const smoothstep=x=>{const t=clamp(x,0,1);return t*t*(3-2*t);};
const axes=['heave','lateral','roll','pitch'];

export const BODY_MOTION_SPEC=Object.freeze({
  defaults:Object.freeze({heave:.003,lateral:.0005,rollDegrees:.05,pitchDegrees:.025}),
  limits:Object.freeze({heave:.006,lateral:.001,rollDegrees:.10,pitchDegrees:.05}),
  pivot:Object.freeze([.55,1.55,0]),
  wavelengths:Object.freeze({heave:12.6,heaveDetail:7.8,roll:17.3,pitch:14.9,lateral:21.7}),
  filters:Object.freeze({envelope:.65,load:.85,acceleration:.45,pose:.10,settle:.32}),
  fullAmplitudeSpeed:5,stopSpeed:.0001,accelerationLimit:3.1,maxStep:.25,
  heaveMix:Object.freeze([.78,.22]),phaseOffsets:Object.freeze({heaveDetail:.7,roll:.4,pitch:1.1,lateral:1.6}),
  driveWeights:Object.freeze({base:.72,load:.18,acceleration:.10}),
  loadWeights:Object.freeze({regulator:.70,passengers:.30}),
  throttleMaximum:3,passengerCapacity:16,pitchAccelerationShare:.16,settleEpsilon:1e-9,simulationHz:30,
});

export function createBodyMotion(options={}){
  const spec=BODY_MOTION_SPEC,defaults=spec.defaults,limits=spec.limits;
  const amplitude={heave:clamp(finite(options.heave,defaults.heave),0,limits.heave),lateral:clamp(finite(options.lateral,defaults.lateral),0,limits.lateral),roll:radians(clamp(finite(options.rollDegrees,defaults.rollDegrees),0,limits.rollDegrees)),pitch:radians(clamp(finite(options.pitchDegrees,defaults.pitchDegrees),0,limits.pitchDegrees))};
  const distanceOffset=finite(options.distanceOffset);
  let enabled=options.enabled!==false,lastTime=null,lastVelocity=0;
  const state={heave:0,lateral:0,roll:0,pitch:0,envelope:0,load:0,acceleration:0,phaseDistance:0,active:false};
  const timeOf=view=>Number.isFinite(view.elapsed)?view.elapsed:Number.isFinite(view.tick)?view.tick/spec.simulationHz:null;
  function reset(view={}){
    for(const key of axes)state[key]=0;
    Object.assign(state,{envelope:0,load:0,acceleration:0,phaseDistance:finite(view.distance)+distanceOffset,active:false});
    lastTime=timeOf(view);lastVelocity=finite(view.velocity);return state;
  }
  function boundPose(){
    // A shared budget prevents the independent axes from all reaching their caps together.
    let budget=0;for(const key of axes){state[key]=clamp(finite(state[key]),-amplitude[key],amplitude[key]);if(amplitude[key])budget+=(state[key]/amplitude[key])**2;}
    if(budget>1){const scale=1/Math.sqrt(budget);for(const key of axes)state[key]*=scale;}
  }
  function update(view={},fallbackDt=0){
    const time=timeOf(view);
    if(time!==null&&lastTime!==null&&time<lastTime-1e-9)return reset(view);
    if(view.started===false)return reset(view);
    if(view.paused)return state;
    if(time!==null&&lastTime===null)return reset(view);
    // Render-only calls at the same simulation time cannot advance or re-excite the pose.
    const dt=clamp(time!==null?(lastTime===null?0:time-lastTime):finite(fallbackDt),0,spec.maxStep);
    if(time!==null)lastTime=time;
    if(!dt)return state;
    const velocity=finite(view.velocity),speed=Math.abs(velocity),moving=enabled&&speed>spec.stopSpeed;
    const acceleration=clamp((velocity-lastVelocity)/dt,-spec.accelerationLimit,spec.accelerationLimit);lastVelocity=velocity;
    const load=Number.isFinite(view.load)?clamp(view.load,0,1):spec.loadWeights.regulator*clamp(Math.max(0,finite(view.throttle))/spec.throttleMaximum,0,1)+spec.loadWeights.passengers*clamp(finite(view.onboard)/spec.passengerCapacity,0,1);
    state.load=smooth(state.load,load,dt,spec.filters.load);
    state.acceleration=smooth(state.acceleration,acceleration,dt,spec.filters.acceleration);
    if(!moving){
      // No idle clock or random excitation: the last pose returns monotonically to neutral.
      const decay=Math.exp(-dt/spec.filters.settle);
      state.envelope*=decay;for(const key of axes){state[key]*=decay;if(Math.abs(state[key])<spec.settleEpsilon)state[key]=0;}
      if(state.envelope<spec.settleEpsilon)state.envelope=0;
    }else{
      state.phaseDistance=finite(view.distance,state.phaseDistance-distanceOffset)+distanceOffset;
      const drive=spec.driveWeights.base+spec.driveWeights.load*state.load+spec.driveWeights.acceleration*Math.abs(state.acceleration)/spec.accelerationLimit;
      state.envelope=smooth(state.envelope,smoothstep(speed/spec.fullAmplitudeSpeed)*drive,dt,spec.filters.envelope);
      const wave=(wavelength,offset=0)=>Math.sin(state.phaseDistance*Math.PI*2/wavelength+offset),w=spec.wavelengths,p=spec.phaseOffsets;
      const target={heave:amplitude.heave*state.envelope*(spec.heaveMix[0]*wave(w.heave)+spec.heaveMix[1]*wave(w.heaveDetail,p.heaveDetail)),lateral:amplitude.lateral*state.envelope*wave(w.lateral,p.lateral),roll:amplitude.roll*state.envelope*wave(w.roll,p.roll),pitch:amplitude.pitch*state.envelope*((1-spec.pitchAccelerationShare)*wave(w.pitch,p.pitch)-spec.pitchAccelerationShare*state.acceleration/spec.accelerationLimit)};
      for(const key of axes)state[key]=smooth(state[key],target[key],dt,spec.filters.pose);
      boundPose();
    }
    state.active=axes.some(key=>state[key]!==0);return state;
  }
  const proof={version:'r13',kind:'Bounded artistic upper-body micro-motion; not measured suspension physics',enabled,coordinateSystem:'Train-local X forward, Y up, Z lateral; roll about X and pitch about Z',parameters:spec,amplitude,distanceOffset,combinedNormalizedBudget:1,clock:'Simulation elapsed seconds or tick/30; optional explicit dt only without a simulation clock',phase:'Continuous signed distance; no independent idle oscillation or random noise',pause:'Frozen at the last simulation pose',stop:'Monotonic exponential decay to exact zero',state};
  return{state,proof,update,reset,setEnabled(value){enabled=!!value;proof.enabled=enabled;return enabled;}};
}
