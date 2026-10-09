import test from 'node:test';
import assert from 'node:assert/strict';
import {createSpatialAudioGraph, monoPointBuffer, crowdPointBuffers, createCoachImpactBuffer, SPATIAL_EMITTERS} from './audio-spatial.mjs';
import {createRailAudio,AUDIO_LIMITS} from './audio.mjs';
import {stereoFloatWav} from './tests/spatial-audio-probe.mjs';
import {Session,DT} from './session.mjs';
const EMITTER_COUNT=Object.keys(SPATIAL_EMITTERS).length;

class Param {
  constructor(value=0){this.value=value;}
  setTargetAtTime(v){this.value=v;}
  setValueAtTime(v){this.value=v;}
  linearRampToValueAtTime(v){this.value=v;}
  exponentialRampToValueAtTime(v){this.value=v;}
}
class AudioNode {
  constructor(context,type){this.context=context;this.typeName=type;this.connections=[];this.disconnected=false;context.nodes.push(this);
    for(const key of ['gain','frequency','threshold','knee','ratio','attack','release','positionX','positionY','positionZ','forwardX','forwardY','forwardZ','upX','upY','upZ'])this[key]=new Param();this.playbackRate=new Param(1);}
  connect(node){this.connections.push(node);return node;}
  disconnect(){this.connections=[];this.disconnected=true;}
  start(when=0,offset=0,duration){this.context.starts++;this.startedAt=when;this.stopAt=this.loop?Infinity:when+(duration??this.buffer?.duration??Infinity)/this.playbackRate.value;this.offset=offset;}
  stop(when=this.context.currentTime){this.stopAt=when;if(when<=this.context.currentTime)this.end();}
  end(){if(this.ended)return;this.ended=true;this.onended?.();}
}
class Context {
  static instances=[];
  constructor(){this.state='suspended';this.currentTime=0;this.sampleRate=8000;this.nodes=[];this.starts=0;this.destination=new AudioNode(this,'destination');this.listener=new AudioNode(this,'listener');Context.instances.push(this);}
  createGain(){return new AudioNode(this,'gain');}
  createPanner(){return new AudioNode(this,'panner');}
  createDynamicsCompressor(){return new AudioNode(this,'compressor');}
  createBiquadFilter(){return new AudioNode(this,'filter');}
  createOscillator(){return new AudioNode(this,'oscillator');}
  createBufferSource(){return new AudioNode(this,'source');}
  createBuffer(channels,length,sampleRate=this.sampleRate){const data=Array.from({length:channels},()=>new Float32Array(length));return {numberOfChannels:channels,length,sampleRate,duration:length/sampleRate,getChannelData:index=>data[index]};}
  async decodeAudioData(){const b=this.createBuffer(2,8000);b.getChannelData(0).fill(.1);b.getChannelData(1).fill(.3);return b;}
  async resume(){this.state='running';}
  async suspend(){this.state='suspended';}
  async close(){this.state='closed';}
  advance(seconds){if(this.state!=='running')return;this.currentTime+=seconds;for(const node of this.nodes)if(node.startedAt!==undefined&&node.stopAt<=this.currentTime)node.end();}
}
const fullFrame=(forward=[0,0,-1])=>({listener:{position:[2,3,4],forward,up:[0,1,0]},sources:Object.fromEntries(Object.keys(SPATIAL_EMITTERS).map((key,i)=>[key,[i,1,-3]]))});
const base={started:true,phase:'running',distance:0,elapsed:0,velocity:5,throttle:1,brake:false,station:{remaining:0},events:[]};
async function mockAudio(fn,{failFetch=false}={}){
  const priorContext=globalThis.AudioContext,priorFetch=globalThis.fetch;
  globalThis.AudioContext=Context;globalThis.fetch=async()=>{if(failFetch)throw new Error('intentional network failure');return {ok:true,arrayBuffer:async()=>new ArrayBuffer(2)};};
  try{await fn();}finally{globalThis.AudioContext=priorContext;globalThis.fetch=priorFetch;}
}

test('stereo point files downmix once while ambience preserves separate channel content',()=>{
  const ctx=new Context(),stereo=ctx.createBuffer(2,4);stereo.getChannelData(0).set([1,-1,.5,.25]);stereo.getChannelData(1).set([-1,1,.5,-.25]);
  const mono=monoPointBuffer(ctx,stereo);assert.equal(mono.numberOfChannels,1);assert.deepEqual([...mono.getChannelData(0)],[0,0,.5,0]);
  assert.equal(monoPointBuffer(ctx,mono),mono);assert.deepEqual([...stereo.getChannelData(0)],[1,-1,.5,.25]);
  const crowd=crowdPointBuffers(ctx,stereo);assert.equal(crowd[0].numberOfChannels,1);assert.deepEqual([...crowd[1].getChannelData(0)],[-1,1,.5,-.25]);
  assert.deepEqual(crowdPointBuffers(ctx,mono),[mono,mono]);
});

test('twelve reusable HRTF anchors, orthogonal listener, no source cone or facing-gain trick',()=>{
  const ctx=new Context(),graph=createSpatialAudioGraph(ctx);graph.setSpatialFrame(fullFrame());
  assert.equal(ctx.nodes.filter(n=>n.typeName==='panner').length,EMITTER_COUNT);
  for(const panner of ctx.nodes.filter(n=>n.typeName==='panner')){assert.equal(panner.panningModel,'HRTF');assert.equal(panner.distanceModel,'inverse');assert.equal(panner.coneInnerAngle,360);assert.equal(panner.coneOuterGain,1);assert.equal(panner.channelCount,1);}
  const nodes=ctx.nodes.length;for(let i=0;i<100;i++)graph.setSpatialFrame(fullFrame([Math.sin(i),0,-Math.cos(i)]));assert.equal(ctx.nodes.length,nodes);
  assert.deepEqual(graph.getState().sources.wheelFront.position,[0,1,-3]);assert.equal(graph.input('wheelFront').gain.value,1);
  graph.setSpatialFrame({listener:{position:[1,2,3],forward:[0,0,-2],up:[0,2,1]},sources:{wheelRear:[3,4,5]}});
  assert.deepEqual(graph.getState().listener,{position:[1,2,3],forward:[0,0,-1],up:[0,1,0]});assert.equal(graph.input('wheelFront').gain.value,0);assert.equal(graph.input('wheelRear').gain.value,1);
  graph.setSpatialFrame({listener:{position:[NaN,0,0],forward:[0,0,-1],up:[0,1,0]}});assert.deepEqual(graph.getState().listener.position,[1,2,3]);
  assert.throws(()=>graph.input('unbounded-new-role'),/Unknown/);graph.dispose();graph.dispose();assert.equal(graph.getState().pannerCount,0);
});

test('live mono routes, .61 quarter turns, one closing cue and camera turns do not restart voices',()=>mockAudio(async()=>{
  const audio=createRailAudio({volume:.65,crowdEnabled:true});audio.setSpatialFrame(fullFrame());await audio.unlock();const ctx=Context.instances.at(-1);
  assert.equal(audio.getState().volume,.65);assert.ok(Object.values(audio.getState().pointChannels).every(n=>n===1));
  const v={...base,brake:true};audio.update(v);audio.update({...v,distance:2*Math.PI*.61,elapsed:1});assert.equal(audio.getState().chuffs,4);assert.equal(audio.getState().wheelRadius,.61);
  assert.equal(audio.getState().loopCount,4);const starts=ctx.starts;
  for(let i=0;i<40;i++){audio.setSpatialFrame(fullFrame([Math.sin(i),0,-Math.cos(i)]));audio.update({...v,distance:2*Math.PI*.61,elapsed:1});}
  assert.equal(ctx.starts,starts,'turning the camera does not replace sources');
  ctx.advance(2);audio.update({...v,phase:'doors-closing',distance:2*Math.PI*.61,elapsed:3});assert.equal(audio.getState().guardCues,1);
  ctx.advance(2);audio.update({...v,phase:'running',distance:2*Math.PI*.61,elapsed:5,events:[{id:1,type:'departed'}]});assert.equal(audio.getState().guardCues,1);
  const voiceNodes=ctx.nodes.filter(n=>n.typeName==='source'||n.typeName==='oscillator');
  for(const source of voiceNodes.filter(n=>!n.disconnected)){
    let node=source,visited=new Set();while(node&&node.typeName!=='panner'){assert.ok(!visited.has(node));visited.add(node);node=node.connections[0];}assert.equal(node?.typeName,'panner','each active source reaches a spatial route');
  }
  audio.dispose();assert.equal(audio.getState().voices.active,0);assert.equal(audio.getState().loopCount,0);assert.equal(audio.getState().spatial.pannerCount,0);
  assert.ok(ctx.nodes.filter(n=>!['destination','listener'].includes(n.typeName)).every(n=>n.disconnected));
}));

test('source budgets are bounded, ended nodes disconnect and pause produces no backlog',()=>mockAudio(async()=>{
  const audio=createRailAudio({crowdEnabled:true});audio.setSpatialFrame(fullFrame());await audio.unlock();const ctx=Context.instances.at(-1);audio.update({...base,brake:true});
  for(let i=1;i<=180;i++){ctx.currentTime+=.02;audio.update({...base,brake:true,distance:i*.9,elapsed:i*.02});}
  let state=audio.getState();assert.ok(state.voices.active<=AUDIO_LIMITS.oneShots);assert.ok(state.voices.peak<=AUDIO_LIMITS.oneShots);assert.ok(state.voices.dropped>0);assert.ok(Object.values(state.voices.byRole).every(n=>n<=AUDIO_LIMITS.voicesPerEmitter));assert.equal(state.spatial.pannerCount,EMITTER_COUNT);assert.equal(state.loopCount,4);
  const clock=ctx.currentTime,chuffs=state.chuffs,starts=ctx.starts;await audio.setPlaybackPaused(true);ctx.advance(100);assert.equal(ctx.currentTime,clock);
  audio.update({...base,paused:true,distance:900,elapsed:90});audio.whistle();assert.equal(ctx.starts,starts);
  await audio.setPlaybackPaused(false);audio.update({...base,distance:900,elapsed:90});audio.update({...base,distance:900,elapsed:90});assert.equal(audio.getState().chuffs,chuffs);
  ctx.advance(20);state=audio.getState();assert.equal(state.voices.active,0);assert.ok(ctx.nodes.filter(n=>(n.typeName==='source'||n.typeName==='oscillator')&&n.ended).every(n=>n.disconnected));
  audio.dispose();assert.equal(audio.getState().voices.active,0);
}));

test('network fallbacks stay in the same HRTF routes, no hidden direct output',()=>mockAudio(async()=>{
  const audio=createRailAudio();audio.setSpatialFrame(fullFrame());await audio.unlock();const ctx=Context.instances.at(-1);audio.update({...base,brake:true});audio.update({...base,brake:true,distance:4,elapsed:1});audio.whistle();audio.release();audio.guardWhistle();
  assert.equal(Object.keys(audio.getState().errors).length,5);assert.equal(audio.getState().spatial.pannerCount,EMITTER_COUNT);assert.equal(audio.getState().loopCount,2);
  for(const source of ctx.nodes.filter(n=>n.typeName==='source'||n.typeName==='oscillator')){let node=source;for(let i=0;i<5&&node?.typeName!=='panner';i++)node=node?.connections[0];assert.equal(node?.typeName,'panner');}
  audio.dispose();
},{failFetch:true}));

test('PCM capture writes actual stereo IEEE float WAV values',()=>{
  const ctx=new Context(),buffer=ctx.createBuffer(2,2,48000);buffer.getChannelData(0).set([.25,-.5]);buffer.getChannelData(1).set([.75,-1]);
  const wav=stereoFloatWav(buffer),view=new DataView(wav.buffer);assert.equal(wav.length,60);assert.equal(view.getUint16(20,true),3);assert.equal(view.getUint16(22,true),2);assert.equal(view.getUint32(24,true),48000);assert.equal(view.getFloat32(44,true),.25);assert.equal(view.getFloat32(48,true),.75);assert.equal(view.getFloat32(56,true),-1);
});


test('far-field emitters fade before their bound and missing anchors stay silent',()=>{
  const context=new Context(),graph=createSpatialAudioGraph(context);
  const listener={position:[0,0,0],forward:[0,0,-1],up:[0,1,0]};
  for(const [distance,want] of [[45,1],[120,1],[150,.5],[180,0],[10000,0]]){
    graph.setSpatialFrame({listener,sources:{wheelFront:[0,0,-distance]}});
    assert.equal(graph.getState().sources.wheelFront.fadeGain,want);
  }
  graph.setSpatialFrame({listener,sources:{}});assert.equal(graph.input('wheelFront').gain.value,0);graph.dispose();
});

test('procedural coach impact is one bounded, deterministic mono transient with no new asset',()=>{
  const ctx=new Context(),a=createCoachImpactBuffer(ctx),b=createCoachImpactBuffer(ctx),data=a.getChannelData(0);
  assert.equal(a.numberOfChannels,1);assert.equal(a.duration,.24);assert.deepEqual(data,b.getChannelData(0));assert.equal(data[0],0);assert.equal(data.at(-1),0);
  assert.ok(Math.max(...data.map(Math.abs))<=.821);const energy=(start,end)=>data.slice(start,end).reduce((sum,x)=>sum+x*x,0);
  assert.ok(energy(0,Math.floor(data.length/4))>energy(Math.floor(data.length*3/4),data.length)*30);
});

test('real Session miss-stop emits one spatial clunk per collision, never on a throw',()=>mockAudio(async()=>{
  const game=new Session({seed:'R11-IMPACT-QA'}),audio=createRailAudio(),impactAnchors={};await audio.unlock();const ctx=Context.instances.at(-1);
  game.command('start');game.command('throttle-up');audio.update(game.view(),fullFrame());let seen=0,throws=0,observedHits=0,throwOnlyFrames=0;const hits=[];
  const transform=point=>[100+point[2],point[1],20-point[0]];
  for(let tick=0;tick<1600&&observedHits<4;tick++){
    game.stepTicks(1);ctx.advance(DT);const view=game.view(),fresh=view.events.filter(event=>event.id>seen),collisions=fresh.filter(event=>event.type==='stone-hit');
    for(const event of fresh){if(event.type==='stone-thrown')throws++;if(event.type==='stone-hit'){observedHits++;hits.push(event);impactAnchors['impact'+(event.id%4)]={position:transform(event.point),eventId:event.id};}seen=Math.max(seen,event.id);}
    const frame=fullFrame();frame.listener.position=[100,3,20];Object.assign(frame.sources,impactAnchors);
    const prior=audio.getState().impactCues;audio.update(view,frame);
    assert.equal(audio.getState().impactCues,prior+collisions.length,'each actual collision starts exactly one clunk');
    if(fresh.some(event=>event.type==='stone-thrown')&&!collisions.length){throwOnlyFrames++;assert.equal(audio.getState().impactCues,prior);}
    if(observedHits===2)audio.setCharacterVoicesEnabled(true);
    const state=audio.getState();assert.ok(state.voices.active<=40);assert.equal(state.spatial.pannerCount,12);
    for(const [role,count] of Object.entries(state.voices.byRole))if(role.startsWith('impact'))assert.ok(count<=1);
  }
  const state=audio.getState();assert.ok(game.stats.missed>0);assert.equal(observedHits,4);assert.equal(state.impactCues,game.stats.stoneHits);assert.ok(throwOnlyFrames>0);
  assert.equal(state.characterVoices.available,false);assert.equal(state.characterVoices.requested,throws);assert.equal(state.characterVoices.played,0);assert.equal(state.characterVoices.enabled,true);
  for(const [role,slot] of Object.entries(state.impactSlots)){const hit=hits.find(event=>event.id===slot.eventId);assert.deepEqual(slot.worldPosition,transform(hit.point));assert.deepEqual(state.spatial.sources[role].position,transform(hit.point));}
  const count=state.impactCues;audio.update(game.view());assert.equal(audio.getState().impactCues,count,'repeated event list is consumed once');audio.dispose();
}));

test('impact pool stays bounded and character toggle never mutes collision foley',()=>mockAudio(async()=>{
  const audio=createRailAudio(),view={...base,velocity:0,throttle:0};await audio.unlock();const ctx=Context.instances.at(-1);audio.update(view,fullFrame());
  const baseStarts=ctx.starts;audio.setCharacterVoicesEnabled(true);audio.update({...view,events:[{id:1,type:'stone-thrown',actor:'passenger-1'}]});assert.equal(ctx.starts,baseStarts);assert.equal(audio.getState().impactCues,0);assert.equal(audio.getState().characterVoices.played,0);
  for(let id=2;id<=101;id++){
    audio.setCharacterVoicesEnabled(id%2===0);const role='impact'+id%4,point=[-12,1.7,1.05],frame=fullFrame();frame.sources[role]={position:point,eventId:id};
    audio.update({...view,events:[{id,type:'stone-hit',point,car:2}]},frame);
  }
  assert.equal(audio.getState().impactCues,100);assert.equal(audio.getState().voices.active,4);assert.equal(audio.getState().spatial.pannerCount,12);assert.ok(audio.getState().voices.peak<=4);
  assert.equal(audio.getState().characterVoices.played,0);audio.dispose();assert.equal(audio.getState().voices.active,0);
}));

test('paused hits are consumed, stale/missing anchors do not play, fresh hit resumes normally',()=>mockAudio(async()=>{
  const audio=createRailAudio(),view={...base,velocity:0,throttle:0},point=[-17,1.7,1.05];await audio.unlock();audio.update(view,fullFrame());
  const hit=id=>({id,type:'stone-hit',point,car:3}),frameFor=(id,anchorId=id)=>{const frame=fullFrame();frame.sources['impact'+id%4]={position:point,eventId:anchorId};return frame;};
  await audio.setPlaybackPaused(true);audio.update({...view,paused:true,events:[hit(4)]},frameFor(4));assert.equal(audio.getState().impactCues,0);
  await audio.setPlaybackPaused(false);audio.update({...view,events:[hit(4)]},frameFor(4));audio.update({...view,events:[hit(4)]},frameFor(4));assert.equal(audio.getState().impactCues,0);
  audio.update({...view,events:[hit(5)]},frameFor(5,1));assert.equal(audio.getState().impactCues,0);
  audio.update({...view,events:[hit(6)]},{listener:fullFrame().listener,sources:{}});assert.equal(audio.getState().impactCues,0);
  audio.setCharacterVoicesEnabled(false);audio.update({...view,events:[hit(7)]},frameFor(7));assert.equal(audio.getState().impactCues,1);assert.equal(audio.getState().characterVoices.enabled,false);audio.dispose();
}));

test('collision gets one slot at a full mechanical voice budget without exceeding forty',()=>mockAudio(async()=>{
  const audio=createRailAudio();await audio.unlock();const ctx=Context.instances.at(-1);audio.update(base,fullFrame());
  for(let i=1;i<160;i++){ctx.currentTime+=.02;audio.update({...base,distance:i*.9,elapsed:i*.02});}
  assert.equal(audio.getState().voices.active,40);const role='impact0',frame=fullFrame();frame.sources[role]={position:[-12,1.5,1],eventId:400};
  audio.update({...base,distance:159*.9,elapsed:159*.02,events:[{id:400,type:'stone-hit',point:[-12,1.5,1],car:2}]},frame);
  assert.equal(audio.getState().impactCues,1);assert.equal(audio.getState().voices.active,40);assert.equal(audio.getState().voices.byRole.impact0,1);assert.equal(audio.getState().voices.peak,40);audio.dispose();
}));
