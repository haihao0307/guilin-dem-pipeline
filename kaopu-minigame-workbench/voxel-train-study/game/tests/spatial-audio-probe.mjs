// Browser-only measured-output fixture. It imports the exact live HRTF and
// effects-master graph, and decodes the shipped CC0 chuff once for every trial.
// No synthetic gain calculation is accepted as evidence of rendered sound.
import {createSpatialAudioGraph, createEffectsOutput, monoPointBuffer, createCoachImpactBuffer, SPATIAL_EMITTERS} from '../audio-spatial.mjs';

export const SPATIAL_PROBE_CASES = Object.freeze([
  {name:'near', position:[0,0,-3], forward:[0,0,-1]},
  {name:'far', position:[0,0,-45], forward:[0,0,-1]},
  {name:'left', position:[-6,0,-5], forward:[0,0,-1]},
  {name:'right', position:[6,0,-5], forward:[0,0,-1]},
  {name:'turn0', position:[0,0,-6], forward:[0,0,-1]},
  {name:'turn90', position:[0,0,-6], forward:[1,0,0]},
  {name:'turn180', position:[0,0,-6], forward:[0,0,1]},
  {name:'turn270', position:[0,0,-6], forward:[-1,0,0]},
]);
const db = value => 20 * Math.log10(Math.max(value, 1e-12));
function channelRms(data) { let sum=0; for (const v of data) sum+=v*v; return Math.sqrt(sum/data.length); }
function measure(buffer) {
  const channels=[buffer.getChannelData(0),buffer.getChannelData(1)],rms=channels.map(channelRms);
  let peak=0;for(const channel of channels)for(const value of channel)peak=Math.max(peak,Math.abs(value));
  return {leftRms:rms[0],rightRms:rms[1],stereoRms:Math.hypot(...rms)/Math.SQRT2,lrDb:db(rms[0]/Math.max(rms[1],1e-12)),peak,sampleRate:buffer.sampleRate,frames:buffer.length};
}
function normalizedDifference(first,second) {
  let difference=0,energy=0;
  for(let channel=0;channel<2;channel++){
    const a=first.getChannelData(channel),b=second.getChannelData(channel);
    for(let i=0;i<a.length;i++){difference+=(a[i]-b[i])**2;energy+=a[i]*a[i];}
  }
  return Math.sqrt(difference/Math.max(energy,1e-20));
}
export async function renderSpatialTrial({decodedBuffer,position,forward,listenerPosition=[0,0,0],role='wheelFront',sampleRate=48000,seconds=2.25,volume=.65,gain=.148}) {
  const Offline=globalThis.OfflineAudioContext||globalThis.webkitOfflineAudioContext;
  if(!Offline)throw new Error('OfflineAudioContext unavailable');
  const context=new Offline(2,Math.ceil(seconds*sampleRate),sampleRate),{master,compressor}=createEffectsOutput(context,volume);
  const graph=createSpatialAudioGraph(context,{destination:master});
  graph.setSpatialFrame({listener:{position:listenerPosition,forward,up:[0,1,0]},sources:{[role]:position}});
  const nodes=[];
  // Identical source, amplitude, pitch, start times and output graph in all cases.
  for(const start of [.12,1.12]){
    const source=context.createBufferSource(),voice=context.createGain();source.buffer=decodedBuffer;voice.gain.value=gain;
    source.connect(voice);voice.connect(graph.input(role));source.start(start);nodes.push(source,voice);
  }
  const buffer=await context.startRendering(),measurements=measure(buffer),state=graph.getState();
  for(const node of nodes)node.disconnect();graph.dispose();master.disconnect();compressor.disconnect();
  return {buffer,measurements,state};
}

// Floating-point WAV preserves the actual rendered PCM without requantization.
export function stereoFloatWav(buffer) {
  const bytes=new Uint8Array(44+buffer.length*8),view=new DataView(bytes.buffer);
  const text=(at,value)=>{for(let i=0;i<value.length;i++)view.setUint8(at+i,value.charCodeAt(i));};
  text(0,'RIFF');view.setUint32(4,bytes.length-8,true);text(8,'WAVE');text(12,'fmt ');view.setUint32(16,16,true);
  view.setUint16(20,3,true);view.setUint16(22,2,true);view.setUint32(24,buffer.sampleRate,true);view.setUint32(28,buffer.sampleRate*8,true);
  view.setUint16(32,8,true);view.setUint16(34,32,true);text(36,'data');view.setUint32(40,buffer.length*8,true);
  const left=buffer.getChannelData(0),right=buffer.getChannelData(1);
  for(let i=0;i<buffer.length;i++){view.setFloat32(44+i*8,left[i],true);view.setFloat32(48+i*8,right[i],true);}
  return bytes;
}
export async function runSpatialAudioProbe({sampleUrl=new URL('../audio/steam-chuff.mp3',import.meta.url),sampleRate=48000,includePcm=false,source='chuff'}={}) {
  const Offline=globalThis.OfflineAudioContext||globalThis.webkitOfflineAudioContext;
  if(!Offline)throw new Error('OfflineAudioContext unavailable');
  const decoder=new Offline(2,1,sampleRate);let decoded;
  if(source==='coach-impact')decoded=createCoachImpactBuffer(decoder);
  else {const response=await fetch(sampleUrl);if(!response.ok)throw new Error('Probe sample HTTP '+response.status);decoded=await decoder.decodeAudioData(await response.arrayBuffer());}
  const mono=monoPointBuffer(decoder,decoded),trials={},measurements={};
  for(const scenario of SPATIAL_PROBE_CASES){const result=await renderSpatialTrial({decodedBuffer:mono,...scenario,sampleRate,...(source==='coach-impact'?{role:'impact0',gain:.34}:{})});trials[scenario.name]=result;measurements[scenario.name]=result.measurements;}
  const distanceDropDb=db(measurements.near.stereoRms/Math.max(measurements.far.stereoRms,1e-12));
  const frontBackDifference=normalizedDifference(trials.turn0.buffer,trials.turn180.buffer);
  const checks={
    audible: Object.values(measurements).every(m=>m.stereoRms>1e-7),
    distance: distanceDropDb>15,
    left: measurements.left.lrDb>2,
    right: measurements.right.lrDb< -2,
    turnedLeft: measurements.turn90.lrDb>2,
    turnedRight: measurements.turn270.lrDb< -2,
    behindAudible: measurements.turn180.stereoRms>measurements.turn0.stereoRms*.15,
    frontBackHrtf: frontBackDifference>.02,
    boundedPanners: Object.values(trials).every(t=>t.state.pannerCount===Object.keys(SPATIAL_EMITTERS).length),
  };
  const result={passed:Object.values(checks).every(Boolean),checks,distanceDropDb,frontBackDifference,measurements,
    source:{kind:source,url:source==='coach-impact'?null:String(sampleUrl),decodedChannels:decoded.numberOfChannels,pointChannels:mono.numberOfChannels,duration:mono.duration},
    method:(source==='coach-impact'?'Original procedural coach-impact buffer':'Actual decoded chuff')+' → fixed HRTF Panner → shared .65 effects master → shared compressor → rendered stereo PCM',
  };
  // For browser automation capture, serialize only explicitly requested cases.
  // Use stereoFloatWav(trials[name].buffer) inside the browser to preserve floats.
  if(includePcm)result.pcm=Object.fromEntries(Object.entries(trials).filter(([name])=>includePcm===true||includePcm.includes(name)).map(([name,t])=>[name,{sampleRate:t.buffer.sampleRate,channels:[Array.from(t.buffer.getChannelData(0)),Array.from(t.buffer.getChannelData(1))]}]));
  return result;
}
