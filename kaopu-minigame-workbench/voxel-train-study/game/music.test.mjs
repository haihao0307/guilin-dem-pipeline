import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createJourneyMusic, JOURNEY_TRACK} from './music.mjs';

class Param {
  value = 0;
  cancelScheduledValues() {}
  setValueAtTime(value) { this.value = value; }
  setTargetAtTime(value) { this.value = value; }
  linearRampToValueAtTime(value) { this.value = value; }
}
class Node {
  gain = new Param();
  starts = 0;
  stops = 0;
  connect() {}
  disconnect() {}
  start() { this.starts++; }
  stop() { this.stops++; this.onended?.(); }
}
class Context {
  static all = [];
  state = 'suspended';
  currentTime = 0;
  destination = new Node();
  nodes = [];
  resumes = 0;
  constructor() { Context.all.push(this); }
  createGain() { return new Node(); }
  createBufferSource() { const node = new Node(); this.nodes.push(node); return node; }
  async decodeAudioData() { return {duration: JOURNEY_TRACK.duration}; }
  async resume() { this.resumes++; this.state = 'running'; }
  async suspend() { this.state = 'suspended'; }
  async close() { this.state = 'closed'; }
  advance(seconds) { if (this.state === 'running') this.currentTime += seconds; }
}
const firstLeg = extra => ({line:'kcr1', started:true, paused:false, tick:100, elapsed:10, phase:'running',
  velocity:10, throttle:1, brake:false, station:{index:1, remaining:450}, events:[], ...extra});

async function fixture(fn, fetchImpl) {
  const original = {AudioContext:globalThis.AudioContext, fetch:globalThis.fetch, document:globalThis.document};
  const listeners = new Map(); let fetchCount = 0;
  Context.all = [];
  globalThis.AudioContext = Context;
  globalThis.fetch = async (...args) => { fetchCount++; return fetchImpl ? fetchImpl(...args) : {ok:true, arrayBuffer:async()=>new ArrayBuffer(32)}; };
  globalThis.document = {hidden:false, addEventListener:(name,fn)=>listeners.set(name,fn), removeEventListener:(name)=>listeners.delete(name)};
  try { await fn({context:()=>Context.all.at(-1), fetchCount:()=>fetchCount, listeners}); }
  finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete globalThis[key]; else globalThis[key] = value;
    }
  }
}

test('first-departure gating, repeated unlocks, independent volume and exactly one source',()=>fixture(async f=>{
  const music = createJourneyMusic();
  music.update(firstLeg({tick:0,elapsed:0,station:{index:0,remaining:0}}));
  await Promise.all([music.unlock(), music.unlock(), music.unlock()]);
  assert.equal(f.fetchCount(), 1); assert.equal(Context.all.length, 1);
  assert.equal(music.getState().stage, 'waiting-departure');
  assert.equal(music.getState().activeSources, 0);
  music.update(firstLeg()); f.context().advance(5); music.update(firstLeg({tick:250,elapsed:15}));
  assert.equal(music.getState().sourceStarts, 1);
  assert.equal(music.getState().activeSources, 1);
  assert.equal(music.getState().gainTarget, .32);
  await music.unlock(); music.update(firstLeg({tick:251,elapsed:15.03}));
  assert.equal(music.getState().sourceStarts, 1);
  music.setVolume(9); assert.equal(music.getState().volume, 1);
  music.setVolume(-2); assert.equal(music.getState().volume, 0);
  music.dispose(); assert.equal(music.getState().state, 'closed');
  assert.equal(f.context().nodes[0].stops, 1);
}));

test('pause freezes the music clock and toggle during pause cannot resume or stack sources',()=>fixture(async f=>{
  const music=createJourneyMusic(); music.update(firstLeg()); await music.unlock();
  f.context().advance(12); music.update(firstLeg({tick:460,elapsed:22}));
  await music.setPaused(true); const position=music.getState().position, resumes=f.context().resumes;
  f.context().advance(60); music.update(firstLeg({paused:true,tick:460,elapsed:22}));
  await music.setEnabled(false); await music.setEnabled(true); await music.unlock();
  assert.equal(music.getState().position, position); assert.equal(music.getState().gainTarget, 0);
  assert.equal(f.context().resumes, resumes); assert.equal(music.getState().activeSources, 1);
  await music.setPaused(false); music.update(firstLeg({tick:461,elapsed:22.03})); f.context().advance(1);
  assert.equal(music.getState().position, position+1); assert.equal(music.getState().sourceStarts,1);
  await music.setEnabled(false); const mutedPosition=music.getState().position;
  f.context().advance(8); assert.equal(music.getState().position, mutedPosition);
  await music.setEnabled(true); f.context().advance(1);
  assert.equal(music.getState().position,mutedPosition+1); assert.equal(music.getState().sourceStarts,1);
  music.dispose();
}));

test('update and visibility events never resume playback without a gesture API',()=>fixture(async f=>{
  const music=createJourneyMusic(); music.update(firstLeg()); await music.unlock();
  music.update(firstLeg({paused:true})); await music.setPaused(true); const resumes=f.context().resumes;
  music.update(firstLeg({paused:false}));
  assert.equal(f.context().resumes,resumes); assert.equal(f.context().state,'suspended');
  await music.setPaused(false); globalThis.document.hidden=true; f.listeners.get('visibilitychange')();
  await new Promise(resolve=>setTimeout(resolve,25));
  globalThis.document.hidden=false; f.listeners.get('visibilitychange')();
  const hiddenResumes=f.context().resumes; music.update(firstLeg());
  assert.equal(f.context().resumes,hiddenResumes); assert.equal(f.context().state,'suspended');
  await music.unlock(); assert.equal(f.context().state,'running'); music.dispose();
}));

test('whistle, steam and braking duck the music and recover gently after the cues',()=>fixture(async f=>{
  const music=createJourneyMusic(); music.update(firstLeg()); await music.unlock(); f.context().advance(5);
  music.update(firstLeg({events:[{id:1,type:'whistle'}]})); assert.equal(music.getState().duckFactor,.2);
  assert.ok(music.getState().gainTarget<.07);
  f.context().advance(3.3); music.update(firstLeg({events:[{id:1,type:'whistle'}]}));
  assert.equal(music.getState().duckFactor,1); assert.equal(music.getState().gainTarget,.32);
  music.update(firstLeg({events:[{id:2,type:'approach-steam'}]})); assert.equal(music.getState().duckFactor,.25);
  f.context().advance(3.1); music.update(firstLeg({brake:true})); assert.equal(music.getState().duckFactor,.3);
  f.context().advance(2); music.update(firstLeg({brake:true})); assert.equal(music.getState().duckFactor,.34);
  music.update(firstLeg({brake:true,velocity:0})); assert.equal(music.getState().duckFactor,1);
  music.dispose();
}));

test('Yaumati settlement recovers quietly then ends, and later stations cannot restart it',()=>fixture(async f=>{
  const music=createJourneyMusic(); music.update(firstLeg()); await music.unlock(); f.context().advance(25);
  music.update(firstLeg({station:{index:1,remaining:50}})); assert.ok(music.getState().duckFactor<.5);
  const arrival=firstLeg({velocity:0,throttle:0,station:{index:1,remaining:0,canOpen:true},phase:'doors-opening',events:[{id:1,type:'doors-opening'}]});
  music.update(arrival); const entry=music.getState().gainTarget;
  assert.equal(music.getState().stage,'settling');
  f.context().advance(5); music.update({...arrival,phase:'boarding'}); assert.ok(music.getState().gainTarget>entry);
  f.context().advance(10.1); music.update({...arrival,phase:'ready-depart'});
  assert.equal(music.getState().stage,'completed'); assert.equal(music.getState().activeSources,0);
  music.update(firstLeg({station:{index:2,remaining:900}})); await music.unlock();
  assert.equal(music.getState().sourceStarts,1); music.dispose();
}));

test('new game resets the score while old saves beyond Yaumati stay silent',()=>fixture(async f=>{
  const music=createJourneyMusic(); music.update(firstLeg()); await music.unlock(); f.context().advance(10);
  music.update(firstLeg({tick:900,elapsed:30}));
  music.update(firstLeg({tick:0,elapsed:0,station:{index:0,remaining:0}}));
  assert.equal(music.getState().position,0); assert.equal(music.getState().activeSources,0);
  assert.equal(music.getState().stage,'waiting-departure');
  music.update(firstLeg()); assert.equal(music.getState().sourceStarts,2); assert.equal(music.getState().activeSources,1);
  assert.equal(f.context().nodes[0].stops,1); music.dispose();
  const restored=createJourneyMusic(); restored.update(firstLeg({station:{index:3,remaining:1200}})); await restored.unlock();
  assert.equal(restored.getState().stage,'completed'); assert.equal(restored.getState().sourceStarts,0);
  await restored.setEnabled(false); await restored.setEnabled(true);
  assert.equal(restored.getState().activeSources,0); restored.dispose();
  const arrived=createJourneyMusic(); arrived.update(firstLeg({station:{index:1,opened:true,remaining:0}})); await arrived.unlock();
  assert.equal(arrived.getState().sourceStarts,0); assert.equal(arrived.getState().completedReason,'first-leg-already-arrived'); arrived.dispose();
}));

test('pending decode cannot start music after pause or disposal',()=>fixture(async f=>{
  let release; const originalDecode=Context.prototype.decodeAudioData;
  Context.prototype.decodeAudioData=()=>new Promise(resolve=>{release=resolve;});
  try {
    const music=createJourneyMusic(); music.update(firstLeg()); const unlocking=music.unlock();
    while(!release) await Promise.resolve();
    await music.setPaused(true); release({duration:JOURNEY_TRACK.duration}); await unlocking;
    assert.equal(music.getState().activeSources,0); assert.equal(f.context().state,'suspended');
    await music.setPaused(false); assert.equal(music.getState().activeSources,1); music.dispose();
    release=null;
    const removed=createJourneyMusic(); removed.update(firstLeg()); const removedUnlock=removed.unlock();
    while(!release) await Promise.resolve(); removed.dispose(); release({duration:JOURNEY_TRACK.duration}); await removedUnlock;
    assert.equal(removed.getState().activeSources,0); assert.equal(removed.getState().state,'closed');
  } finally { Context.prototype.decodeAudioData=originalDecode; }
}));

test('missing music reports its error and leaves the rest of the game untouched',()=>fixture(async()=>{
  const music=createJourneyMusic(); music.update(firstLeg()); await music.unlock();
  assert.match(music.getState().errors.asset,/HTTP 404/); assert.equal(music.getState().activeSources,0); music.dispose();
}, async()=>({ok:false,status:404})));

test('a disabled first-leg source ends immediately when the game advances beyond Yaumati',()=>fixture(async f=>{
  const music=createJourneyMusic(); music.update(firstLeg()); await music.unlock(); f.context().advance(20);
  await music.setEnabled(false);
  music.update(firstLeg({tick:2000,elapsed:66,station:{index:2,remaining:1200}}));
  assert.equal(music.getState().finished,true); assert.equal(music.getState().activeSources,0);
  await music.setEnabled(true); music.update(firstLeg({tick:2001,elapsed:66.03,station:{index:2,remaining:1199}}));
  assert.equal(music.getState().activeSources,0); assert.equal(music.getState().sourceStarts,1);
  music.dispose();
}));

test('a rapid off/on or pause/resume invalidates the older delayed suspend without overlap',()=>fixture(async f=>{
  const music=createJourneyMusic(); music.update(firstLeg()); await music.unlock(); f.context().advance(20);
  const off=music.setEnabled(false); const on=music.setEnabled(true); await Promise.all([off,on]);
  assert.equal(f.context().state,'running'); assert.equal(music.getState().activeSources,1);
  assert.equal(music.getState().sourceStarts,1);
  const pause=music.setPaused(true); const resume=music.setPaused(false); await Promise.all([pause,resume]);
  assert.equal(f.context().state,'running'); assert.equal(music.getState().activeSources,1);
  await music.setPaused(true); assert.equal(f.context().state,'suspended');
  music.dispose();
}));

test('published MP3 matches its manifest and fully decodes into a non-clipping stereo score',async()=>{
  const directory=new URL('./music/',import.meta.url);
  const manifest=JSON.parse(await readFile(new URL('manifest.json',directory),'utf8'));
  const path=fileURLToPath(new URL(manifest.file,directory));
  const encoded=await readFile(path);
  assert.equal(encoded.byteLength,manifest.bytes);
  assert.equal(createHash('sha256').update(encoded).digest('hex'),manifest.sha256);
  const probe=JSON.parse(execFileSync('ffprobe',['-v','error','-show_entries','format=duration:stream=codec_name,sample_rate,channels','-of','json',path],{encoding:'utf8'}));
  assert.equal(probe.streams[0].codec_name,'mp3'); assert.equal(probe.streams[0].channels,2);
  assert.equal(Number(probe.streams[0].sample_rate),44100);
  assert.ok(Math.abs(Number(probe.format.duration)-manifest.renderedDurationSeconds)<.08);
  const raw=execFileSync('ffmpeg',['-v','error','-i',path,'-f','f32le','-acodec','pcm_f32le','-'],{maxBuffer:40*1024*1024});
  let peak=0, sum=0;
  for(let offset=0;offset<raw.length;offset+=4) { const v=raw.readFloatLE(offset); assert.ok(Number.isFinite(v)); peak=Math.max(peak,Math.abs(v)); sum+=v*v; }
  const rms=Math.sqrt(sum/(raw.length/4));
  assert.ok(peak>.2&&peak<.95,`decoded peak ${peak}`);
  assert.ok(rms>.06&&rms<.25,`decoded RMS ${rms}`);
});
