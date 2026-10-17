// Shared by the live sound engine and the browser OfflineAudioContext probe.
// World units are metres. These are fixed emitter roles, never per-wheel nodes.
export const SPATIAL_EMITTERS = Object.freeze({
  wheelFront: Object.freeze({refDistance: 3, rolloffFactor: 1.2}),
  wheelRear: Object.freeze({refDistance: 3, rolloffFactor: 1.2}),
  cylinderLeft: Object.freeze({refDistance: 4, rolloffFactor: 1.1}),
  cylinderRight: Object.freeze({refDistance: 4, rolloffFactor: 1.1}),
  whistle: Object.freeze({refDistance: 8, rolloffFactor: .9}),
  guard: Object.freeze({refDistance: 4, rolloffFactor: 1.2}),
  crowdFront: Object.freeze({refDistance: 5, rolloffFactor: 1.3}),
  crowdRear: Object.freeze({refDistance: 5, rolloffFactor: 1.3}),
  impact0: Object.freeze({refDistance: 4, rolloffFactor: 1.25}),
  impact1: Object.freeze({refDistance: 4, rolloffFactor: 1.25}),
  impact2: Object.freeze({refDistance: 4, rolloffFactor: 1.25}),
  impact3: Object.freeze({refDistance: 4, rolloffFactor: 1.25}),
});
const vector = value => {
  const v = Array.isArray(value) || ArrayBuffer.isView(value) ? Array.from(value) : value && [value.x, value.y, value.z];
  return v?.length === 3 && v.every(Number.isFinite) ? v : null;
};
function unit(v) { const n = Math.hypot(...v); return n > 1e-8 ? v.map(x => x / n) : null; }
function writeVector(node, prefix, values, now) {
  if (!node) return;
  const keys = ['X', 'Y', 'Z'];
  if (node[prefix + 'X']) values.forEach((value, i) => node[prefix + keys[i]].setValueAtTime(value, now));
  else if (prefix === 'position') node.setPosition?.(...values);
}

export function createEffectsOutput(context, volume = 0) {
  const master = context.createGain(), compressor = context.createDynamicsCompressor();
  master.gain.value = volume;
  compressor.threshold.value = -14; compressor.knee.value = 12; compressor.ratio.value = 5;
  compressor.attack.value = .008; compressor.release.value = .2;
  master.connect(compressor); compressor.connect(context.destination);
  return {master, compressor};
}

// Point emitters have one mono buffer each. Reuse already-mono decoded assets;
// stereo assets are averaged once during decode, never per voice or animation frame.
export function monoPointBuffer(context, buffer) {
  if (!(buffer.numberOfChannels > 1)) return buffer;
  const mono = context.createBuffer(1, buffer.length, buffer.sampleRate), out = mono.getChannelData(0);
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < out.length; i++) out[i] += data[i] / buffer.numberOfChannels;
  }
  return mono;
}

// A stereo ambience is not fed through one point Panner. Its channels become
// distinct platform emitters. The shipped mono crowd buffer is reused at two
// different offsets; its provenance and sample bytes remain unchanged.
export function crowdPointBuffers(context, buffer) {
  if (!(buffer.numberOfChannels > 1)) return [buffer, buffer];
  return [0, 1].map(channel => {
    const mono = context.createBuffer(1, buffer.length, buffer.sampleRate);
    mono.getChannelData(0).set(buffer.getChannelData(channel));
    return mono;
  });
}

// Original procedural coach-panel impact foley, not a field recording. One
// deterministic mono transient combines filtered noise with quickly damped,
// inharmonic body resonances. It is generated once, never used as speech.
export function createCoachImpactBuffer(context) {
  const sampleRate=context.sampleRate,length=Math.ceil(sampleRate*.24),buffer=context.createBuffer(1,length,sampleRate),data=buffer.getChannelData(0);
  let seed=0x51a7c3,low=0,previous=0,peak=0;
  const modes=[[163,.32,.048],[397,.23,.036],[683,.15,.027],[1097,.09,.018]];
  for(let i=0;i<length;i++){
    const t=i/sampleRate;seed=(Math.imul(seed,1664525)+1013904223)>>>0;
    const white=(seed/4294967296)*2-1;low+=.32*(white-low);
    const grit=(low-previous)*1.8;previous=low;
    let value=grit*.62*Math.exp(-t/.011);
    for(const [frequency,amplitude,decay] of modes)value+=Math.sin(2*Math.PI*frequency*t)*amplitude*Math.exp(-t/decay);
    value*=Math.min(1,t/.0015)*Math.min(1,(length-1-i)/(sampleRate*.018));
    data[i]=value;peak=Math.max(peak,Math.abs(value));
  }
  if(peak>0)for(let i=0;i<length;i++)data[i]*=.82/peak;
  data[0]=0;data[length-1]=0;
  return buffer;
}

export function createSpatialAudioGraph(context, {destination = context.destination} = {}) {
  const emitters = {}, supported = typeof context.createPanner === 'function';
  let disposed = false, frameCount = 0;
  const fadeStart=120,fadeEnd=180;
  let listener = {position: [0, 0, 0], forward: [0, 0, -1], up: [0, 1, 0]};
  for (const [role, config] of Object.entries(SPATIAL_EMITTERS)) {
    const input = context.createGain();
    input.gain.value = 0; // A missing world anchor is silent, not stuck at the origin.
    const panner = supported ? context.createPanner() : null;
    if (panner) {
      panner.panningModel = 'HRTF'; panner.distanceModel = 'inverse';
      panner.refDistance = config.refDistance; panner.rolloffFactor = config.rolloffFactor;
      panner.maxDistance = 300;
      // Source cone is omnidirectional. Listener rotation is handled by HRTF.
      panner.coneInnerAngle = 360; panner.coneOuterAngle = 360; panner.coneOuterGain = 1;
      panner.channelCount = 1; panner.channelCountMode = 'explicit';
      input.connect(panner); panner.connect(destination);
    }
    // A Web Audio implementation lacking PannerNode fails silent; do not pretend
    // that a gain-only route provides spatial sound. Old minimal test mocks work.
    emitters[role] = {input, panner, position: null, enabled: false, gainTarget:0, distance:Infinity};
  }
  function setSpatialFrame(frame) {
    if (disposed || !frame) return;
    const position = vector(frame.listener?.position), forward = vector(frame.listener?.forward), up = vector(frame.listener?.up);
    if (position && forward && up) {
      const f = unit(forward), u0 = unit(up);
      if (f && u0) {
        const dot = f.reduce((sum, x, i) => sum + x * u0[i], 0), u = unit(u0.map((x, i) => x - dot * f[i]));
        if (u) {
          listener = {position, forward: f, up: u};
          writeVector(context.listener, 'position', position, context.currentTime);
          if (context.listener?.forwardX) {
            writeVector(context.listener, 'forward', f, context.currentTime);
            writeVector(context.listener, 'up', u, context.currentTime);
          } else context.listener?.setOrientation?.(...f, ...u);
        }
      }
    }
    if (frame.sources) for (const [role, emitter] of Object.entries(emitters)) {
      const source = frame.sources[role], position = vector(source?.position ?? source);
      const freshImpact=role.startsWith('impact')&&position&&(!emitter.enabled||(source?.eventId!==undefined&&source.eventId!==emitter.eventId));
      emitter.enabled = !!position && source?.enabled !== false;
      const distance=position?Math.hypot(...position.map((x,i)=>x-listener.position[i])):Infinity;
      const t=Math.min(1,Math.max(0,(distance-fadeStart)/(fadeEnd-fadeStart)));
      const gain=emitter.enabled?1-t*t*(3-2*t):0;emitter.distance=distance;
      if(Math.abs(gain-emitter.gainTarget)>1e-5||freshImpact){
        // A new impact starts from silence: preserve its short initial attack.
        // Continuous emitters and camera-distance changes retain smooth fades.
        if(freshImpact)emitter.input.gain.setValueAtTime(gain,context.currentTime);
        else emitter.input.gain.setTargetAtTime(gain,context.currentTime,.035);
        emitter.gainTarget=gain;
      }
      emitter.eventId=source?.eventId;
      if (position) {
        emitter.position = position;
        writeVector(emitter.panner, 'position', position, context.currentTime);
      }
    }
    frameCount++;
  }
  function input(role) {
    if (!emitters[role]) throw new Error('Unknown spatial audio role: ' + role);
    return emitters[role].input;
  }
  function getState() {
    return {supported, model: 'HRTF', distanceModel: 'inverse', frameCount,
      pannerCount: disposed ? 0 : supported ? Object.keys(emitters).length : 0,
      emitterLimit: Object.keys(SPATIAL_EMITTERS).length,
      listener: Object.fromEntries(Object.entries(listener).map(([key, v]) => [key, v.slice()])),
      sources: Object.fromEntries(Object.entries(emitters).map(([role, emitter]) => [role, {
        position: emitter.position?.slice() ?? null, enabled: emitter.enabled && !disposed,
        ...SPATIAL_EMITTERS[role], maxDistance: 300, fadeStart, fadeEnd, distance:emitter.distance, fadeGain:emitter.gainTarget,
        route: 'mono source → voice gain → ' + role + ' HRTF → effects master → compressor → output',
      }]))};
  }
  function dispose() {
    if (disposed) return; disposed = true;
    for (const emitter of Object.values(emitters)) { emitter.input.disconnect(); emitter.panner?.disconnect(); }
  }
  return {input, setSpatialFrame, getState, dispose};
}
