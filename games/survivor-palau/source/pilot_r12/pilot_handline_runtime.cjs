(function(root,factory){
  if(typeof module==='object'&&module.exports) module.exports=factory(require('./upstream/v0230/handline_r01/handline_controller.cjs'));
  else root.PalauPilotHandlineR12=factory(root.SMIHandlineR01);
})(typeof globalThis!=='undefined'?globalThis:this,function(handline){
'use strict';

if(!handline||typeof handline.createController!=='function'||typeof handline.handAnchor!=='function'){
  throw new Error('the verified handline controller is required');
}

const VERSION='palau-pilot-handline-r12/0.1';
const EPS=1e-9;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const mul=(a,s)=>[a[0]*s,a[1]*s,a[2]*s];
const len=v=>Math.hypot(v[0],v[1],v[2]);
const norm=v=>{const d=len(v);return d>EPS?mul(v,1/d):[0,0,0];};
const finiteVec=v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite);
const clone=v=>JSON.parse(JSON.stringify(v));
const round6=v=>Number(v.toFixed(6));

const PHASES=Object.freeze({
  READY:'ready',
  PREPARED:'prepared',
  DEPLOYED:'line_deployed',
  NOTICE:'fish_notice',
  APPROACH:'fish_approach',
  INSPECT:'fish_inspect',
  BITE:'bite_window',
  FIGHT:'fight',
  LANDED:'landed',
  FAILED:'attempt_failed',
  ABORTED:'aborted',
  EXHAUSTED:'gear_exhausted'
});

const TERMINAL=new Set([PHASES.LANDED,PHASES.FAILED,PHASES.ABORTED,PHASES.EXHAUSTED]);

function finiteNumber(value,name,min=-Infinity,max=Infinity){
  if(!Number.isFinite(value)||value<min||value>max) throw new TypeError(`${name} must be finite in [${min}, ${max}]`);
  return value;
}
function nonNegativeInteger(value,name){
  if(!Number.isInteger(value)||value<0) throw new TypeError(`${name} must be a non-negative integer`);
  return value;
}
function normalizeInventory(raw){
  if(!raw) throw new TypeError('explicit finite inventory is required; historical issue quantities are not assumed');
  return {
    lineLengthM:finiteNumber(raw.lineLengthM,'inventory.lineLengthM',0,200),
    hooks:nonNegativeInteger(raw.hooks,'inventory.hooks'),
    sinkers:nonNegativeInteger(raw.sinkers,'inventory.sinkers'),
    baitUnits:nonNegativeInteger(raw.baitUnits,'inventory.baitUnits')
  };
}
function normalizeFish(raw){
  if(!raw||typeof raw.fishId!=='string'||!raw.fishId||!finiteVec(raw.position)) throw new TypeError('existing fish candidate with fishId and finite position is required');
  const velocity=finiteVec(raw.velocity)?[...raw.velocity]:[0,0,0];
  return {
    fishId:raw.fishId,
    position:[...raw.position],
    velocity,
    massKg:finiteNumber(raw.massKg==null?1.4:raw.massKg,'fish.massKg',0.05,200),
    stamina:finiteNumber(raw.stamina==null?0.86:raw.stamina,'fish.stamina',0,1),
    appetite:finiteNumber(raw.appetite==null?0.72:raw.appetite,'fish.appetite',0,1),
    caution:finiteNumber(raw.caution==null?0.58:raw.caution,'fish.caution',0,1),
    behaviorState:'free',
    interest:0,
    alarm:0,
    inspectSeconds:0,
    biteWindowRemaining:0,
    distanceToLure:null
  };
}
function normalizePose(raw){
  if(!raw||!finiteVec(raw.position)||!finiteVec(raw.facePosition)||!finiteVec(raw.snorkelTopPosition)||!Number.isFinite(raw.yaw)||!Number.isFinite(raw.handHeight)){
    throw new TypeError('player pose requires finite position, facePosition, snorkelTopPosition, yaw and handHeight');
  }
  return {
    position:[...raw.position],
    facePosition:[...raw.facePosition],
    snorkelTopPosition:[...raw.snorkelTopPosition],
    yaw:raw.yaw,
    handHeight:raw.handHeight,
    crouched:!!raw.crouched
  };
}
function normalizeConfig(raw={}){
  const c={
    minUsableLineM:raw.minUsableLineM==null?3:raw.minUsableLineM,
    minSnorkelClearanceM:raw.minSnorkelClearanceM==null?0.035:raw.minSnorkelClearanceM,
    faceSubmergeMarginM:raw.faceSubmergeMarginM==null?0.01:raw.faceSubmergeMarginM,
    maxStableLensFlooding:raw.maxStableLensFlooding==null?0.68:raw.maxStableLensFlooding,
    coughRecoverySeconds:raw.coughRecoverySeconds==null?1.6:raw.coughRecoverySeconds,
    castDistanceM:raw.castDistanceM==null?1.2:raw.castDistanceM,
    minDepthM:raw.minDepthM==null?0.12:raw.minDepthM,
    maxDepthM:raw.maxDepthM==null?2.4:raw.maxDepthM,
    depthAdjustRateMps:raw.depthAdjustRateMps==null?0.34:raw.depthAdjustRateMps,
    interestGain:raw.interestGain==null?0.48:raw.interestGain,
    interestLoss:raw.interestLoss==null?0.72:raw.interestLoss,
    alarmGain:raw.alarmGain==null?0.92:raw.alarmGain,
    alarmDecay:raw.alarmDecay==null?0.18:raw.alarmDecay,
    noticeInterest:raw.noticeInterest==null?0.16:raw.noticeInterest,
    approachInterest:raw.approachInterest==null?0.36:raw.approachInterest,
    inspectInterest:raw.inspectInterest==null?0.58:raw.inspectInterest,
    biteInterest:raw.biteInterest==null?0.72:raw.biteInterest,
    inspectDistanceM:raw.inspectDistanceM==null?0.72:raw.inspectDistanceM,
    biteDistanceM:raw.biteDistanceM==null?0.24:raw.biteDistanceM,
    inspectDelayMinS:raw.inspectDelayMinS==null?1.1:raw.inspectDelayMinS,
    inspectDelayJitterS:raw.inspectDelayJitterS==null?1.1:raw.inspectDelayJitterS,
    biteWindowS:raw.biteWindowS==null?1.15:raw.biteWindowS,
    rejectAlarm:raw.rejectAlarm==null?0.92:raw.rejectAlarm,
    approachSpeedMps:raw.approachSpeedMps==null?0.42:raw.approachSpeedMps,
    retreatSpeedMps:raw.retreatSpeedMps==null?0.86:raw.retreatSpeedMps,
    lensFloodRate:raw.lensFloodRate==null?0.16:raw.lensFloodRate,
    lensDrainRate:raw.lensDrainRate==null?0.025:raw.lensDrainRate,
    lensWipeRate:raw.lensWipeRate==null?1.05:raw.lensWipeRate,
    minLostLineM:raw.minLostLineM==null?1.2:raw.minLostLineM,
    fightSlackM:raw.fightSlackM==null?0.28:raw.fightSlackM
  };
  for(const [name,value] of Object.entries(c)) finiteNumber(value,`config.${name}`,0,1000);
  if(c.maxDepthM<c.minDepthM) throw new TypeError('config.maxDepthM must be >= config.minDepthM');
  return c;
}
function normalizeTackleProfile(raw={}){
  return {
    lineStrength:finiteNumber(raw.lineStrength==null?19:raw.lineStrength,'tackleProfile.lineStrength',0.1,500),
    baitQuality:finiteNumber(raw.baitQuality==null?0.7:raw.baitQuality,'tackleProfile.baitQuality',0,1),
    historicalStatus:raw.historicalStatus||'candidate-unverified'
  };
}
function surfaceSample(env,p,t){
  if(!env||typeof env.surfaceAt!=='function') throw new TypeError('environment.surfaceAt is required');
  const q=env.surfaceAt(p[0],p[2],t);
  if(!q||!Number.isFinite(q.eta)) throw new TypeError('surfaceAt must return finite eta');
  return {
    eta:q.eta,
    normal:finiteVec(q.normal)?[...q.normal]:[0,1,0],
    surfaceVelocity:finiteVec(q.surfaceVelocity)?[...q.surfaceVelocity]:[0,0,0],
    breaker:clamp(Number.isFinite(q.breaker)?q.breaker:0,0,1),
    clarity:clamp(Number.isFinite(q.clarity)?q.clarity:0.7,0,1)
  };
}
function normalizeControls(raw={}){
  const n=name=>clamp(Number.isFinite(raw[name])?raw[name]:0,0,1);
  return {
    reel:n('reel'),give:n('give'),lift:n('lift'),angleLeft:n('angleLeft'),angleRight:n('angleRight'),
    forceBreach:n('forceBreach'),setHook:n('setHook'),wipeLens:n('wipeLens'),abort:n('abort'),
    bodyMotion:n('bodyMotion'),handMotion:n('handMotion'),oneHandOnLine:raw.oneHandOnLine!==false
  };
}

function createPilotHandlineRuntime(options={}){
  const initialFish=normalizeFish(options.fish);
  const initialPose=normalizePose(options.playerPose);
  const config=normalizeConfig(options.config);
  const tackleProfile=normalizeTackleProfile(options.tackleProfile);
  const inventory=normalizeInventory(options.inventory);
  const seed=(options.seed==null?0x50414c41:options.seed)>>>0;
  const state={
    version:VERSION,
    sessionId:options.sessionId||'palau-pilot-handline-01',
    time:Number(options.time||0),
    phase:PHASES.READY,
    outcome:null,
    attempt:0,
    rngState:seed,
    inventory,
    tackleProfile,
    config:clone(config),
    fishTemplate:clone(initialFish),
    playerPose:initialPose,
    observation:{
      equipment:'aviation-goggles-or-lenses-plus-short-snorkel',
      exactModel:'unverified',
      allowedUse:'surface-or-very-shallow-observation-only',
      faceSubmerged:false,
      snorkelTopClearanceM:null,
      tubeFlooded:false,
      coughRecoveryS:0,
      lensFlooding:clamp(options.lensFlooding||0,0,1),
      stable:false,
      stableSeconds:0,
      visibility:0,
      disturbance:0
    },
    line:null,
    candidate:initialFish,
    fight:null,
    processingPending:false,
    latches:{setHook:0,abort:0},
    events:[]
  };
  let controller=null;

  function pushEvent(type,data={}){
    state.events.push({index:state.events.length,time:round6(state.time),type,fishId:state.candidate.fishId,...data});
  }
  function random01(){
    let x=state.rngState>>>0;x^=x<<13;x^=x>>>17;x^=x<<5;state.rngState=x>>>0;return state.rngState/4294967296;
  }
  function hasUsableGear(){
    return state.inventory.lineLengthM>=config.minUsableLineM&&state.inventory.hooks>0&&state.inventory.sinkers>0&&state.inventory.baitUnits>0;
  }
  function setPlayerPose(next){state.playerPose=normalizePose(next);return api;}
  function prepareTackle(){
    if(state.phase===PHASES.FIGHT) throw new Error('cannot prepare while fighting a fish');
    if(state.processingPending) throw new Error('landed fish must enter an explicit processing transaction first');
    if(!hasUsableGear()){
      state.phase=PHASES.EXHAUSTED;state.outcome='gear_exhausted';pushEvent('gear_exhausted',{inventory:clone(state.inventory)});return api;
    }
    state.phase=PHASES.PREPARED;state.outcome=null;pushEvent('tackle_prepared',{historicalStatus:state.tackleProfile.historicalStatus});return api;
  }
  function deployLine(opts={}){
    if(state.phase!==PHASES.PREPARED) throw new Error('prepareTackle must succeed before deployLine');
    if(!hasUsableGear()) return prepareTackle();
    const depth=clamp(Number.isFinite(opts.depthM)?opts.depthM:0.65,config.minDepthM,Math.min(config.maxDepthM,state.inventory.lineLengthM-0.5));
    const baitQuality=finiteNumber(opts.baitQuality==null?state.tackleProfile.baitQuality:opts.baitQuality,'baitQuality',0,1);
    state.inventory.baitUnits-=1;
    state.attempt+=1;
    state.phase=PHASES.DEPLOYED;
    state.outcome=null;
    state.line={
      lineId:`pilot-line-attempt-${state.attempt}`,
      depthM:depth,
      baitQuality,
      lurePosition:null,
      anchor:null,
      deployed:true,
      baitConsumed:true
    };
    state.candidate={...clone(state.fishTemplate),behaviorState:'free',interest:0,alarm:0,inspectSeconds:0,biteWindowRemaining:0,distanceToLure:null,biteDelayS:config.inspectDelayMinS+config.inspectDelayJitterS*random01()};
    controller=null;state.fight=null;
    pushEvent('lure_water_entry',{depthM:depth,baitQuality,remainingBait:state.inventory.baitUnits});
    return api;
  }
  function failAttempt(reason,eventType=reason,data={}){
    if(TERMINAL.has(state.phase)) return;
    state.phase=PHASES.FAILED;state.outcome=reason;
    state.candidate.behaviorState=reason==='fish_spooked'?'reject':'escaped';
    pushEvent(eventType,data);
  }
  function updateObservation(dt,controls,env){
    const pose=state.playerPose;
    const face=surfaceSample(env,pose.facePosition,state.time);
    const top=surfaceSample(env,pose.snorkelTopPosition,state.time);
    const o=state.observation;
    const previousFlood=o.tubeFlooded;
    o.faceSubmerged=pose.facePosition[1]<=face.eta-config.faceSubmergeMarginM;
    o.snorkelTopClearanceM=pose.snorkelTopPosition[1]-top.eta;
    o.tubeFlooded=o.snorkelTopClearanceM<0;
    if(o.tubeFlooded){
      o.coughRecoveryS=Math.max(o.coughRecoveryS,config.coughRecoverySeconds);
      o.lensFlooding=clamp(o.lensFlooding+(0.18+0.2*top.breaker)*dt,0,1);
      if(!previousFlood) pushEvent('snorkel_flooded',{clearanceM:round6(o.snorkelTopClearanceM)});
    }else{
      o.coughRecoveryS=Math.max(0,o.coughRecoveryS-dt);
      const ambientFlood=o.faceSubmerged?top.breaker*config.lensFloodRate*dt:0;
      o.lensFlooding=clamp(o.lensFlooding+ambientFlood-config.lensDrainRate*dt,0,1);
    }
    if(controls.wipeLens>0){
      o.lensFlooding=clamp(o.lensFlooding-controls.wipeLens*config.lensWipeRate*dt,0,1);
    }
    const coughPulse=o.coughRecoveryS>0?0.85:0;
    o.disturbance=clamp(0.58*controls.bodyMotion+0.72*controls.handMotion+0.32*controls.wipeLens+coughPulse+0.22*top.breaker,0,2);
    o.visibility=clamp(((face.clarity+top.clarity)*0.5)*(1-0.78*o.lensFlooding)*(o.faceSubmerged?1:0.28),0,1);
    o.stable=o.faceSubmerged&&o.snorkelTopClearanceM>=config.minSnorkelClearanceM&&o.coughRecoveryS<=0&&o.lensFlooding<=config.maxStableLensFlooding&&controls.oneHandOnLine;
    o.stableSeconds=o.stable?o.stableSeconds+dt:0;
  }
  function updateLure(dt,controls,env){
    if(!state.line) return;
    state.line.depthM=clamp(state.line.depthM+(controls.give-controls.reel)*config.depthAdjustRateMps*dt,config.minDepthM,Math.min(config.maxDepthM,Math.max(config.minDepthM,state.inventory.lineLengthM-0.5)));
    const p=state.playerPose;
    const base={position:p.position,yaw:p.yaw,handHeight:p.handHeight,crouched:p.crouched};
    const anchor=handline.handAnchor(base,0);
    const forward=[Math.sin(p.yaw),0,-Math.cos(p.yaw)];
    const x=anchor[0]+forward[0]*config.castDistanceM;
    const z=anchor[2]+forward[2]*config.castDistanceM;
    const water=surfaceSample(env,[x,0,z],state.time);
    state.line.anchor=anchor;
    state.line.lurePosition=[x,water.eta-state.line.depthM,z];
  }
  function transitionPhase(phase,behavior,eventType){
    if(state.phase===phase) return;
    state.phase=phase;state.candidate.behaviorState=behavior;pushEvent(eventType,{interest:round6(state.candidate.interest),alarm:round6(state.candidate.alarm),distanceM:round6(state.candidate.distanceToLure||0)});
  }
  function moveCandidate(dt,toward,speed){
    const c=state.candidate;
    const desired=mul(norm(toward),speed);
    const blend=clamp(dt*3.5,0,1);
    c.velocity=add(mul(c.velocity,1-blend),mul(desired,blend));
    const step=mul(c.velocity,dt);
    if(len(step)>len(toward)&&speed>=0) c.position=add(c.position,mul(norm(toward),Math.max(0,len(toward)-0.04)));
    else c.position=add(c.position,step);
  }
  function startFight(){
    const c=state.candidate;
    const p=state.playerPose;
    const playerPose={position:[...p.position],yaw:p.yaw,handHeight:p.handHeight,crouched:p.crouched};
    const anchor=handline.handAnchor(playerPose,0);
    const restLength=clamp(len(sub(c.position,anchor))+config.fightSlackM,0.9,state.inventory.lineLengthM);
    const init={
      fish:{fishId:c.fishId,position:[...c.position],velocity:[...c.velocity]},
      playerPose,
      lineStrength:state.tackleProfile.lineStrength,
      restLength,
      seed:state.rngState,
      stamina:c.stamina,
      massKg:c.massKg,
      breachAllowed:true
    };
    controller=handline.createController(init);
    state.phase=PHASES.FIGHT;state.outcome=null;
    state.candidate.behaviorState='hooked';
    state.fight={controllerInit:clone(init),controllerSnapshot:controller.snapshot(),lossApplied:false,processingPending:false};
    pushEvent('hookset_success',{restLengthM:round6(restLength)});
  }
  function updateCandidate(dt,controls){
    const c=state.candidate,lure=state.line.lurePosition;
    const toLure=sub(lure,c.position),distance=len(toLure);
    c.distanceToLure=distance;
    if(state.phase===PHASES.BITE){
      c.position=add(lure,mul(norm(sub(c.position,lure)),Math.min(config.biteDistanceM*0.7,Math.max(0.04,distance))));
      c.velocity=[0,0,0];
      c.biteWindowRemaining=Math.max(0,c.biteWindowRemaining-dt);
      if(c.biteWindowRemaining<=0) failAttempt('missed_bite','hookset_fail',{reason:'bite_window_expired'});
      return;
    }
    const o=state.observation;
    const attraction=state.line.baitQuality*c.appetite*o.visibility*(o.stable?1:0.34)*clamp(1-c.caution*o.disturbance,0,1);
    c.interest=clamp(c.interest+(attraction*config.interestGain-o.disturbance*config.interestLoss-0.018)*dt,0,1);
    c.alarm=clamp(c.alarm+(o.disturbance*config.alarmGain-config.alarmDecay)*dt,0,1.5);
    if(c.alarm>=config.rejectAlarm){failAttempt('fish_spooked','fish_reject',{reason:'disturbance',alarm:round6(c.alarm)});return;}
    if(c.alarm>0.55){
      const away=sub(c.position,lure);moveCandidate(dt,away,config.retreatSpeedMps*(0.65+c.alarm*0.35));
    }else if(c.interest>=config.noticeInterest){
      const speed=config.approachSpeedMps*(0.45+0.75*c.interest);moveCandidate(dt,toLure,speed);
    }else{
      c.velocity=mul(c.velocity,Math.max(0,1-dt*1.8));c.position=add(c.position,mul(c.velocity,dt));
    }
    c.distanceToLure=len(sub(lure,c.position));
    if(c.interest>=config.inspectInterest&&c.distanceToLure<=config.inspectDistanceM){
      transitionPhase(PHASES.INSPECT,'inspect','fish_inspect');
      c.inspectSeconds+=(o.stable&&o.disturbance<0.42?dt:-dt*0.8);
      c.inspectSeconds=Math.max(0,c.inspectSeconds);
    }else if(c.interest>=config.approachInterest){
      transitionPhase(PHASES.APPROACH,'approach','fish_approach');
    }else if(c.interest>=config.noticeInterest){
      transitionPhase(PHASES.NOTICE,'notice','fish_notice');
    }
    if(state.phase===PHASES.INSPECT&&c.inspectSeconds>=c.biteDelayS&&c.interest>=config.biteInterest&&c.distanceToLure<=config.biteDistanceM&&o.stable&&o.disturbance<0.35){
      state.phase=PHASES.BITE;c.behaviorState='strike';c.biteWindowRemaining=config.biteWindowS;pushEvent('fish_strike',{windowS:config.biteWindowS});
    }
  }
  function applyLineBreakLoss(status){
    if(!state.fight||state.fight.lossApplied) return;
    const lostLine=clamp(Math.max(config.minLostLineM,status.restLength||0),0,state.inventory.lineLengthM);
    state.inventory.lineLengthM=round6(Math.max(0,state.inventory.lineLengthM-lostLine));
    state.inventory.hooks=Math.max(0,state.inventory.hooks-1);
    state.inventory.sinkers=Math.max(0,state.inventory.sinkers-1);
    state.fight.lossApplied=true;
    pushEvent('finite_gear_lost',{lostLineM:round6(lostLine),hooksRemaining:state.inventory.hooks,sinkersRemaining:state.inventory.sinkers});
  }
  function settleFight(){
    const st=controller.status();
    state.fight.controllerSnapshot=controller.snapshot();
    state.candidate.position=[...st.fishPosition];
    state.candidate.behaviorState=st.phase;
    if(st.outcome==='line_broken'){
      applyLineBreakLoss(st);state.phase=PHASES.FAILED;state.outcome='line_broken';pushEvent('line_broken',{tension:round6(st.tension)});
    }else if(st.outcome==='escaped'){
      state.phase=PHASES.FAILED;state.outcome='fish_escaped';pushEvent('fish_escaped',{reason:'prolonged_slack'});
    }else if(st.outcome==='landed'){
      state.phase=PHASES.LANDED;state.outcome='fish_landed_unprocessed';state.processingPending=true;state.fight.processingPending=true;pushEvent('fish_landed',{processingPending:true,automaticReward:false});
    }
  }
  function tick(dt,rawControls={},env){
    finiteNumber(dt,'dt',Number.MIN_VALUE,0.05);
    const controls=normalizeControls(rawControls);
    const setHookPressed=controls.setHook>0.5&&state.latches.setHook<=0.5;
    const abortPressed=controls.abort>0.5&&state.latches.abort<=0.5;
    state.latches.setHook=controls.setHook;state.latches.abort=controls.abort;
    if(TERMINAL.has(state.phase)) return state;
    if(abortPressed&&state.phase!==PHASES.READY&&state.phase!==PHASES.PREPARED){
      state.phase=PHASES.ABORTED;state.outcome='aborted_by_player';pushEvent('attempt_aborted',{automaticCatch:false});return state;
    }
    updateObservation(dt,controls,env);
    if(state.phase===PHASES.FIGHT){
      const p=state.playerPose;
      controller.setPlayerPose({position:[...p.position],yaw:p.yaw,handHeight:p.handHeight,crouched:p.crouched});
      controller.setControl('reel',controls.reel).setControl('give',controls.give).setControl('lift',controls.lift)
        .setControl('angleLeft',controls.angleLeft).setControl('angleRight',controls.angleRight).setControl('forceBreach',controls.forceBreach);
      controller.tick(dt,env);state.time+=dt;settleFight();return state;
    }
    if(state.line&&state.line.deployed){
      updateLure(dt,controls,env);
      if(setHookPressed&&state.phase!==PHASES.BITE){
        failAttempt('premature_hookset','hookset_fail',{reason:'before_strike'});
      }else{
        updateCandidate(dt,controls);
        if(setHookPressed&&state.phase===PHASES.BITE){
          if(state.observation.coughRecoveryS>0||!controls.oneHandOnLine||state.observation.lensFlooding>0.92){
            failAttempt('hookset_lost_control','hookset_fail',{reason:'observation_or_hand_control'});
          }else startFight();
        }
      }
    }
    state.time+=dt;
    return state;
  }
  function resetAttempt(nextFish){
    if(state.phase===PHASES.FIGHT) throw new Error('cannot reset an active fight');
    if(state.processingPending) throw new Error('landed fish must be processed or explicitly released before another attempt');
    if(nextFish){
      const n=normalizeFish(nextFish);state.fishTemplate=clone(n);
    }
    state.candidate=clone(state.fishTemplate);state.line=null;state.fight=null;controller=null;state.outcome=null;state.observation.stableSeconds=0;
    if(hasUsableGear()) state.phase=PHASES.READY;
    else {state.phase=PHASES.EXHAUSTED;state.outcome='gear_exhausted';}
    pushEvent('attempt_reset',{inventory:clone(state.inventory)});return api;
  }
  function snapshot(){
    if(controller&&state.fight) state.fight.controllerSnapshot=controller.snapshot();
    return clone(state);
  }
  function restore(saved){
    if(!saved||saved.version!==VERSION||saved.sessionId!==state.sessionId) throw new TypeError('incompatible pilot handline snapshot');
    if(JSON.stringify(saved.config)!==JSON.stringify(config)) throw new TypeError('snapshot tuning does not match this runtime');
    const next=clone(saved);Object.keys(state).forEach(k=>delete state[k]);Object.assign(state,next);state.playerPose=normalizePose(next.playerPose);
    controller=null;
    if(state.phase===PHASES.FIGHT&&state.fight&&state.fight.controllerInit&&state.fight.controllerSnapshot){
      controller=handline.createController(clone(state.fight.controllerInit));controller.restore(clone(state.fight.controllerSnapshot));
    }
    return api;
  }
  function status(){
    const fightStatus=controller?controller.status():null;
    return {
      version:VERSION,sessionId:state.sessionId,time:state.time,phase:state.phase,outcome:state.outcome,attempt:state.attempt,
      inventory:clone(state.inventory),observation:clone(state.observation),line:clone(state.line),
      candidate:clone(state.candidate),fight:fightStatus,processingPending:state.processingPending,
      exactObservationGearModel:'unverified',automaticCatch:false,visualAcceptance:false,productionReady:false
    };
  }
  const api={VERSION,PHASES,state,prepareTackle,deployLine,setPlayerPose,tick,resetAttempt,snapshot,restore,status};
  return api;
}

return Object.freeze({VERSION,PHASES,createPilotHandlineRuntime});
});
