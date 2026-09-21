'use strict';
const assert=require('node:assert/strict');
const {createPilotHandlineRuntime,PHASES}=require('./pilot_handline_runtime.cjs');

const env={
 surfaceAt(){return{eta:0,normal:[0,1,0],surfaceVelocity:[0,0,0],breaker:0,clarity:1};},
 currentAt(){return[0,0,0];},
 snagAt(){return{contact:false,abrasionRate:0};}
};
const pose={position:[0,0,0],facePosition:[0,-.08,0],snorkelTopPosition:[0,.14,0],yaw:0,handHeight:1.22,crouched:false};
const fish={fishId:'existing-fish-a',position:[0,-.55,-1.55],velocity:[0,0,0],massKg:1.1,stamina:.8,appetite:1,caution:.12};
const fast={interestGain:2.8,interestLoss:.9,alarmGain:1.2,alarmDecay:.35,noticeInterest:.08,approachInterest:.18,inspectInterest:.28,biteInterest:.42,inspectDistanceM:.8,biteDistanceM:.26,inspectDelayMinS:.12,inspectDelayJitterS:0,biteWindowS:.35,approachSpeedMps:1.25,rejectAlarm:.72};
function make(extra={}){return createPilotHandlineRuntime({fish,playerPose:pose,inventory:{lineLengthM:12,hooks:2,sinkers:2,baitUnits:3},tackleProfile:{lineStrength:40,baitQuality:1,historicalStatus:'candidate-unverified'},config:fast,seed:9,...extra});}
function begin(r){r.prepareTackle().deployLine({depthM:.55,baitQuality:1});return r;}
function run(r,seconds,controls={},step=1/120,environment=env){for(let t=0;t<seconds&&!['attempt_failed','aborted','gear_exhausted','landed'].includes(r.state.phase);t+=step)r.tick(step,controls,environment);return r;}
function waitFor(r,phase,max=5,controls={}){for(let t=0;t<max&&r.state.phase!==phase&&!['attempt_failed','aborted','gear_exhausted','landed'].includes(r.state.phase);t+=1/120)r.tick(1/120,controls,env);return r;}
const tests=[];const test=(name,fn)=>{fn();tests.push(name);};

test('explicit finite inventory and bait consumption',()=>{const r=begin(make());assert.equal(r.state.inventory.baitUnits,2);assert.equal(r.state.line.baitConsumed,true);assert.equal(r.state.tackleProfile.historicalStatus,'candidate-unverified');});
test('stable surface observation produces a bite but never automatic catch',()=>{const r=begin(make());waitFor(r,PHASES.BITE);assert.equal(r.state.phase,PHASES.BITE);assert.equal(r.state.fight,null);run(r,1);assert.equal(r.state.outcome,'missed_bite');assert.equal(r.state.fight,null);assert.ok(r.state.events.some(e=>e.type==='fish_strike'));assert.ok(r.state.events.some(e=>e.type==='hookset_fail'));});
test('manual hookset preserves the pre-existing fish identity',()=>{const r=begin(make());waitFor(r,PHASES.BITE);r.tick(1/120,{setHook:1},env);assert.equal(r.state.phase,PHASES.FIGHT);assert.equal(r.state.fight.controllerInit.fish.fishId,'existing-fish-a');assert.equal(r.status().automaticCatch,false);});
test('premature hookset fails causally and does not consume a hook',()=>{const r=begin(make());r.tick(1/120,{setHook:1},env);assert.equal(r.state.outcome,'premature_hookset');assert.equal(r.state.inventory.hooks,2);assert.equal(r.state.inventory.baitUnits,2);});
test('large body and hand disturbance spooks the fish',()=>{const r=begin(make());run(r,2,{bodyMotion:1,handMotion:1});assert.equal(r.state.outcome,'fish_spooked');assert.ok(r.state.events.some(e=>e.type==='fish_reject'));});
test('submerged snorkel top causes cough and blocks approach',()=>{const r=begin(make());r.setPlayerPose({...pose,snorkelTopPosition:[0,-.04,0]});run(r,1,{bodyMotion:0,handMotion:0});assert.ok(r.state.observation.coughRecoveryS>0);assert.equal(r.state.observation.stable,false);assert.ok(r.state.events.some(e=>e.type==='snorkel_flooded'));assert.notEqual(r.state.phase,PHASES.BITE);});
test('lens wipe is explicit and cannot be a free invisible action',()=>{const r=make({lensFlooding:.9});begin(r);const before=r.state.observation.lensFlooding;r.tick(.05,{wipeLens:1},env);assert.ok(r.state.observation.lensFlooding<before);assert.ok(r.state.observation.disturbance>.2);});
test('weak line break removes finite line hook and sinker once',()=>{const r=begin(make({tackleProfile:{lineStrength:.5,baitQuality:1,historicalStatus:'candidate-unverified'}}));waitFor(r,PHASES.BITE);r.tick(1/120,{setHook:1},env);const before={...r.state.inventory};run(r,.5,{reel:1});assert.equal(r.state.outcome,'line_broken');assert.equal(r.state.inventory.hooks,before.hooks-1);assert.equal(r.state.inventory.sinkers,before.sinkers-1);assert.ok(r.state.inventory.lineLengthM<before.lineLengthM);const losses=r.state.events.filter(e=>e.type==='finite_gear_lost');assert.equal(losses.length,1);});
test('pre-hook snapshot and restore replay deterministically',()=>{const a=begin(make());run(a,.25);const snap=a.snapshot();const b=make();b.restore(snap);run(a,.4);run(b,.4);assert.deepEqual(a.snapshot(),b.snapshot());});
test('fight snapshot and restore replay deterministically',()=>{const a=begin(make());waitFor(a,PHASES.BITE);a.tick(1/120,{setHook:1},env);run(a,.1,{reel:.2});const snap=a.snapshot();const b=make();b.restore(snap);run(a,.2,{give:.15});run(b,.2,{give:.15});assert.deepEqual(a.snapshot(),b.snapshot());});
test('landed fish is processing-pending and never an automatic food reward',()=>{const low={...fish,stamina:.1,position:[0,-.55,-.65]};const r=begin(make({fish:low,config:{...fast,castDistanceM:.25}}));waitFor(r,PHASES.BITE);r.tick(1/120,{setHook:1},env);run(r,.3,{lift:1});assert.equal(r.state.phase,PHASES.LANDED);assert.equal(r.state.outcome,'fish_landed_unprocessed');assert.equal(r.state.processingPending,true);assert.ok(r.state.events.some(e=>e.type==='fish_landed'&&e.automaticReward===false));});
test('exhausted gear is an explicit terminal state',()=>{const r=createPilotHandlineRuntime({fish,playerPose:pose,inventory:{lineLengthM:2,hooks:0,sinkers:0,baitUnits:0},tackleProfile:{lineStrength:10,baitQuality:.5}});r.prepareTackle();assert.equal(r.state.phase,PHASES.EXHAUSTED);assert.equal(r.state.outcome,'gear_exhausted');});

console.log(JSON.stringify({suite:'Palau pilot handline R12',passed:tests.length,failed:0,tests},null,2));
