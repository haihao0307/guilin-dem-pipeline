'use strict';
const assert=require('node:assert/strict');
const core=require('../fishing_core.cjs');
const H=require('./handline_controller.cjs');
const env=core.defaultEnvironment();
const fish={fishId:'game-fish-0',position:[4.0,-.9,-1.2],velocity:[.2,0,.1]};
const pose={position:[0,0,0],yaw:0,handHeight:1.25,crouched:false};
function make(extra={}){return H.createController({fish,playerPose:pose,lineStrength:80,restLength:4.65,seed:123,...extra});}
function run(c,seconds,controls={},dt=1/120){for(const [k,v] of Object.entries(controls))c.setControl(k,v);for(let t=0;t<seconds&&!c.state.session.outcome;t+=dt)c.tick(dt,env);return c;}
const tests=[];function check(name,fn){fn();tests.push(name);}
check('stable existing fish id',()=>{const c=make();run(c,.5,{reel:.3});assert.equal(c.status().fishId,'game-fish-0');assert.equal(c.state.session.fish.fishId,'game-fish-0');});
check('reel shortens actual core rest length and changes fish state',()=>{const a=make(),b=make();run(a,.8,{reel:.85});run(b,.8,{});assert.ok(a.status().restLength<b.status().restLength-.5);assert.notDeepEqual(a.status().fishPosition,b.status().fishPosition);});
check('give line lengthens actual core rest length',()=>{const a=make();const x=a.status().restLength;run(a,.8,{give:.8});assert.ok(a.status().restLength>x+.8);});
check('change-angle moves the logical hand anchor and changes fish trajectory',()=>{const a=make(),b=make();run(a,.9,{angleLeft:1,reel:.35});run(b,.9,{angleRight:1,reel:.35});assert.ok(a.status().anchor[0]<-.20);assert.ok(b.status().anchor[0]>.20);assert.notDeepEqual(a.status().fishPosition,b.status().fishPosition);});
check('pause freezes handline simulation exactly',()=>{const c=make();run(c,.3,{reel:.4});c.setPaused(true);const before=c.snapshot();for(let i=0;i<60;i++)c.tick(1/120,env);assert.deepEqual(c.snapshot(),before);});
check('snapshot restore continues deterministically',()=>{const a=make();run(a,.55,{reel:.28,angleRight:.4});const snap=a.snapshot();const b=make();b.restore(snap);run(a,.65,{give:.15,lift:.2,angleRight:0,reel:0});run(b,.65,{give:.15,lift:.2,angleRight:0,reel:0});assert.deepEqual(a.snapshot(),b.snapshot());});
check('restart preserves fish identity and initial line state',()=>{const c=make();const initial=c.status();run(c,.7,{reel:.9,angleLeft:1});c.restart();const r=c.status();assert.equal(r.fishId,initial.fishId);assert.deepEqual(r.fishPosition,initial.fishPosition);assert.equal(r.restLength,initial.restLength);assert.equal(r.telemetry.restarts,1);});
check('weak line can still fail causally via core tension',()=>{const c=make({lineStrength:2.5,restLength:1.2});run(c,.3,{reel:1});assert.equal(c.status().outcome,'line_broken');assert.ok(c.state.session.events.some(e=>e.type==='line_broken'));});
check('adapter does not add a teleport at medium switch; raw frame travel is recorded separately',()=>{const c=H.createController({fish:{fishId:'crossing-fish',position:[3,-.12,0],velocity:[.2,.1,0]},playerPose:pose,lineStrength:200,restLength:4.5,stamina:.9,seed:9});c.setControl('give',1).setControl('forceBreach',1);for(let i=0;i<80;i++)c.tick(1/120,env);c.setControl('forceBreach',0);for(let i=0;i<360;i++)c.tick(1/120,env);assert.ok(c.state.telemetry.crossings>=2);assert.equal(c.state.telemetry.maxAdapterTeleportAtCrossing,0);assert.ok(c.state.telemetry.maxFrameTravelAtCrossing>0);});
console.log(JSON.stringify({suite:'SMI handline R01 controller',passed:tests.length,failed:0,tests,gateNote:'The inherited fishing_core crossingJumpMax is raw per-step travel, not an adapter teleport metric. This test proves only that R01 adds zero explicit reposition at medium switches; the formal <=0.15 m gate still requires the shared QA definition and 30/60/120 fps integration.'},null,2));
