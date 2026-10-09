import test from 'node:test';
import assert from 'node:assert/strict';
import { createRailAudio } from './audio.mjs';
class Param { constructor(value=0){this.value=value;} setTargetAtTime(v){this.value=v;} setValueAtTime(v){this.value=v;} linearRampToValueAtTime(v){this.value=v;} exponentialRampToValueAtTime(v){this.value=v;} }
class Node { constructor(){for(const k of ['gain','frequency','threshold','knee','ratio','attack','release'])this[k]=new Param();this.playbackRate=new Param(1);} connect(){} disconnect(){} start(){} stop(){this.onended?.();} }
class Context { constructor(){this.state='suspended';this.currentTime=0;this.sampleRate=44100;this.destination=new Node();} createGain(){return new Node();} createDynamicsCompressor(){return new Node();} createBiquadFilter(){return new Node();} createOscillator(){return new Node();} createBufferSource(){return new Node();} createBuffer(a,n){return {getChannelData:()=>new Float32Array(n)};} async decodeAudioData(){return {duration:3};} async resume(){this.state='running';} close(){this.state='closed';} }
test('quarter-wheel chuff sync, pause, volume, throttle guard and graceful fallback',async()=>{
 const priorContext=globalThis.AudioContext,priorFetch=globalThis.fetch;
 try {
  globalThis.AudioContext=Context;globalThis.fetch=async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(32)});
  const a=createRailAudio({wheelRadius:.72});assert.equal(a.getState().state,'locked');await a.unlock();await a.unlock();assert.equal(a.getState().samples.length,5);
  const v={started:true,phase:'running',distance:0,elapsed:0,velocity:5,throttle:1,brake:false,station:{remaining:0},events:[]};a.update(v);
  a.update({...v,distance:2*Math.PI*.72,elapsed:1});assert.equal(a.getState().chuffs,4);
  a.update({...v,distance:2*Math.PI*.72,elapsed:1});assert.equal(a.getState().chuffs,4);
  a.update({...v,distance:9,elapsed:2,paused:true});assert.equal(a.getState().chuffs,4);
  a.update({...v,distance:10,elapsed:2.1});assert.equal(a.getState().chuffs,4);
  a.update({...v,distance:11.5,elapsed:2.4});assert.ok(a.getState().chuffs>4);
  a.setMuted(true);assert.equal(a.getState().muted,true);a.setVolume(8);assert.equal(a.getState().volume,1);a.setMuted(false);
  assert.equal(a.whistle(),true);assert.equal(a.whistle(),false);a.dispose();assert.equal(a.getState().state,'closed');
  globalThis.fetch=async()=>{throw new Error('test network failure');};const b=createRailAudio();await b.unlock();assert.equal(Object.keys(b.getState().errors).length,5);assert.equal(b.whistle(),true);b.dispose();
  delete globalThis.AudioContext;const c=createRailAudio();await c.unlock();assert.match(c.getState().errors.context,/unavailable/);
 }finally{if(priorContext)globalThis.AudioContext=priorContext;else delete globalThis.AudioContext;globalThis.fetch=priorFetch;}
});
test('spatial brake friction follows actual light and hard brake demand and stops without new emitters',async()=>{
 const previousContext=globalThis.AudioContext,previousFetch=globalThis.fetch;
 try{
  globalThis.AudioContext=Context;globalThis.fetch=async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(32)});
  const audio=createRailAudio();await audio.unlock();
  const view={started:true,phase:'running',distance:10,elapsed:1,velocity:8,throttle:-1,brake:false,station:{wet:false,remaining:300},events:[]};
  audio.update(view);const light=audio.getState().brakeFriction.gain;
  audio.update({...view,throttle:-2,elapsed:2});const medium=audio.getState().brakeFriction.gain;
  audio.update({...view,throttle:0,brake:true,elapsed:3});const hard=audio.getState().brakeFriction.gain;
  assert(light>0&&medium>light&&hard>medium);assert.deepEqual(audio.getState().brakeFriction.roles,['wheelFront','wheelRear']);
  audio.update({...view,throttle:0,brake:true,station:{wet:true},elapsed:4});assert(audio.getState().brakeFriction.gain<hard);
  for(const state of [{throttle:0,brake:false},{velocity:0,brake:true},{paused:true,brake:true}]){audio.update({...view,...state,elapsed:5});assert.equal(audio.getState().brakeFriction.gain,0);}
  for(let i=0;i<40;i++)audio.update({...view,brake:i%2===0,elapsed:6+i/30});assert(audio.getState().loopCount<=4);audio.dispose();
 }finally{if(previousContext)globalThis.AudioContext=previousContext;else delete globalThis.AudioContext;globalThis.fetch=previousFetch;}
});
