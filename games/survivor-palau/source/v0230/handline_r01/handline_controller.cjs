(function(root,factory){
  if(typeof module==='object'&&module.exports) module.exports=factory(require('../fishing_core.cjs'));
  else root.SMIHandlineR01=factory(root.SMIExistingFishingCore);
})(typeof globalThis!=='undefined'?globalThis:this,function(core){
'use strict';
if(!core||typeof core.createFishingSession!=='function'||typeof core.stepFishingSession!=='function') throw new Error('SMI existing fishing core required');
const VERSION='smi-handline-r01/0.1';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const finiteVec=v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite);
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
function clone(v){return JSON.parse(JSON.stringify(v));}
function normalizePose(p){
  if(!p||!finiteVec(p.position)||!Number.isFinite(p.yaw)||!Number.isFinite(p.handHeight)) throw new TypeError('finite player pose required');
  return {position:[...p.position],yaw:p.yaw,handHeight:p.handHeight,crouched:!!p.crouched};
}
function handAnchor(pose,angleOffsetRad){
  const p=normalizePose(pose),yaw=p.yaw+angleOffsetRad,reach=p.crouched?0.28:0.36;
  return [p.position[0]+Math.sin(yaw)*reach,p.position[1]+p.handHeight,p.position[2]-Math.cos(yaw)*reach];
}
function inputState(){return {reel:0,give:0,lift:0,angleLeft:0,angleRight:0,forceBreach:0};}
function createController(options={}){
  const fish=options.fish;
  if(!fish||typeof fish.fishId!=='string'||!fish.fishId||!finiteVec(fish.position)) throw new TypeError('existing fish snapshot required');
  const pose=normalizePose(options.playerPose||{position:[0,0,0],yaw:0,handHeight:1.25});
  const anchor=handAnchor(pose,0);
  const coreOptions={
    fishId:fish.fishId,
    fishPosition:[...fish.position],
    fishVelocity:finiteVec(fish.velocity)?[...fish.velocity]:[0.2,0,0.1],
    anchor,
    seed:options.seed==null?0x534d4901:options.seed,
    stamina:options.stamina==null?0.86:options.stamina,
    massKg:options.massKg==null?1.4:options.massKg,
    lineStrength:options.lineStrength==null?19:options.lineStrength,
    restLength:options.restLength,
    breachAllowed:options.breachAllowed!==false
  };
  const session=core.createFishingSession(coreOptions);
  const state={version:VERSION,fishId:fish.fishId,playerPose:pose,angleOffsetRad:0,paused:false,controls:inputState(),session,
    telemetry:{ticks:0,crossings:0,maxFrameTravelAtCrossing:0,maxAdapterTeleportAtCrossing:0,restarts:0}};
  const initial={coreOptions:clone(coreOptions),playerPose:clone(pose)};
  function setControl(name,value){if(!(name in state.controls))throw new TypeError('unknown control '+name);if(!Number.isFinite(value))throw new TypeError('finite control required');state.controls[name]=clamp(value,0,1);return api;}
  function setPlayerPose(next){state.playerPose=normalizePose(next);return api;}
  function setPaused(v){state.paused=!!v;return api;}
  function tick(dt,env){
    if(!Number.isFinite(dt)||dt<=0||dt>.05) throw new RangeError('dt must be in (0, 0.05]');
    if(state.paused||state.session.outcome)return state;
    const c=state.controls;
    state.angleOffsetRad=clamp(state.angleOffsetRad+(c.angleRight-c.angleLeft)*1.05*dt,-0.78,0.78);
    state.session.line.anchor=handAnchor(state.playerPose,state.angleOffsetRad);
    const beforePos=[...state.session.fish.position],beforeMedium=state.session.fish.medium;
    core.stepFishingSession(state.session,{reel:c.reel,give:c.give,lift:c.lift,forceBreach:!!c.forceBreach},env,dt);
    const frameTravel=dist(beforePos,state.session.fish.position);
    if(beforeMedium!==state.session.fish.medium){
      state.telemetry.crossings++;
      state.telemetry.maxFrameTravelAtCrossing=Math.max(state.telemetry.maxFrameTravelAtCrossing,frameTravel);
      state.telemetry.maxAdapterTeleportAtCrossing=Math.max(state.telemetry.maxAdapterTeleportAtCrossing,0);
    }
    state.telemetry.ticks++;
    return state;
  }
  function snapshot(){return clone(state);}
  function restore(saved){
    if(!saved||saved.version!==VERSION||saved.fishId!==state.fishId)throw new TypeError('incompatible handline snapshot');
    const next=clone(saved);Object.assign(state,next);state.playerPose=normalizePose(next.playerPose);return api;
  }
  function restart(){
    const keep=state.telemetry.restarts+1;
    state.playerPose=clone(initial.playerPose);state.angleOffsetRad=0;state.paused=false;state.controls=inputState();state.session=core.createFishingSession(clone(initial.coreOptions));
    state.telemetry={ticks:0,crossings:0,maxFrameTravelAtCrossing:0,maxAdapterTeleportAtCrossing:0,restarts:keep};return api;
  }
  function status(){const s=state.session;return {version:VERSION,fishId:state.fishId,phase:s.phase,outcome:s.outcome,medium:s.fish.medium,stamina:s.fish.stamina,tension:s.line.tension,restLength:s.line.restLength,anchor:[...s.line.anchor],fishPosition:[...s.fish.position],angleOffsetRad:state.angleOffsetRad,paused:state.paused,telemetry:clone(state.telemetry)};}
  const api={VERSION,state,setControl,setPlayerPose,setPaused,tick,snapshot,restore,restart,status,handAnchor:(a=state.angleOffsetRad)=>handAnchor(state.playerPose,a)};
  return api;
}
return Object.freeze({VERSION,createController,handAnchor});
});
