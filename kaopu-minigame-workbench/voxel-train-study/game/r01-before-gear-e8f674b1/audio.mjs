import {WD_VERIFIED} from './metre-scale.mjs';
// Sound layers for the fictional 1960s KCR steam service. See audio/manifest.json.
// Samples are modern CC0 recordings / foley, not historical KCR archives.
import {createSpatialAudioGraph, createEffectsOutput, monoPointBuffer, crowdPointBuffers, createCoachImpactBuffer, SPATIAL_EMITTERS} from './audio-spatial.mjs';
import {brakeEffort} from './brake-effort.mjs';
const FILES = Object.freeze({whistle:'steam-whistle.mp3',chuff:'steam-chuff.mp3',release:'steam-release.mp3',brake:'metal-brake.mp3',crowd:'station-crowd.mp3'});
const clamp=(v,a,b)=>Math.min(b,Math.max(a,Number(v)||0));
export const AUDIO_LIMITS=Object.freeze({emitters:Object.keys(SPATIAL_EMITTERS).length,impactEmitters:4,oneShots:40,voicesPerEmitter:12,loops:4});
export const CHARACTER_VOICE_CUE=Object.freeze({id:'missed-stop-cantonese',language:'yue',text:'屌你老母',available:false});

export function createRailAudio({wheelRadius=WD_VERIFIED.driverDiameter/2,volume=.55,muted=false,crowdEnabled=false,characterVoicesEnabled=false}={}){
  let context,master,compressor,noise,impactBuffer,loading,spatial,spatialFrame,lastDistance=null,lastElapsed=null,lastPhase=null,lastBrake=false,lastThrottle=0,lastEvent=0,lastWhistle=-100,lastRelease=-100,lastGuard=-100,disposed=false,playbackPaused=false;
  let userVolume=clamp(volume,0,1),userMuted=!!muted,active=false,chuffs=0,clacks=0,guardCues=0,impactCues=0,peakVoices=0,droppedVoices=0;
  const characterVoices={enabled:!!characterVoicesEnabled,available:false,requested:0,played:0,lastRequest:null};
  const brakeFriction={strength:0,gain:0,active:false,roles:['wheelFront','wheelRear']};
  const impactSlots={};
  const buffers={},crowdBuffers=[],loops={},oneshots=new Set(),errors={},decodedChannels={};
  const radius=Math.max(.15,Number(wheelRadius)||WD_VERIFIED.driverDiameter/2),step=2*Math.PI*radius/4;
  function target(param,value,t=.055){if(!context)return;param.setTargetAtTime(value,context.currentTime,t);}
  function syncMaster(){if(master)target(master.gain,userMuted||globalThis.document?.hidden?0:userVolume,.025);}
  function canPlay(role){
    if(!context||context.state!=='running'||playbackPaused||userMuted||disposed||globalThis.document?.hidden)return false;
    if(oneshots.size>=AUDIO_LIMITS.oneShots||[...oneshots].filter(voice=>voice.role===role).length>=AUDIO_LIMITS.voicesPerEmitter){droppedVoices++;return false;}
    return true;
  }
  function makeGain(value,role){const gain=context.createGain();gain.gain.value=value;gain.connect(spatial.input(role));return gain;}
  function track(src,nodes,role){
    const voice={src,nodes,role};oneshots.add(voice);peakVoices=Math.max(peakVoices,oneshots.size);
    voice.cleanup=()=>{if(!oneshots.delete(voice))return;src.onended=null;for(const node of nodes)node.disconnect();};
    src.onended=voice.cleanup;return voice;
  }
  function stopOneShots(){for(const voice of [...oneshots]){try{voice.src.stop();}catch{}voice.cleanup();}}
  function play(name,{role='cylinderLeft',gain=.35,rate=1,offset=0,duration,delay=0}={}){
    const buffer=name==='coach-impact'?impactBuffer:buffers[name];
    if(!buffer||!canPlay(role))return false;
    const src=context.createBufferSource(),g=makeGain(gain,role);src.buffer=buffer;src.playbackRate.value=clamp(rate,.3,3);src.connect(g);
    track(src,[src,g],role);const when=context.currentTime+delay;
    if(duration)src.start(when,Math.min(offset,buffer.duration-.01),duration);else src.start(when,offset);
    return true;
  }
  function envelopeNoise({role='cylinderLeft',seconds=.2,gain=.2,frequency=800,highpass=80,delay=0}={}){
    if(!canPlay(role))return false;
    const src=context.createBufferSource(),hp=context.createBiquadFilter(),lp=context.createBiquadFilter(),g=makeGain(0,role),at=context.currentTime+delay;
    src.buffer=noise;src.loop=true;hp.type='highpass';hp.frequency.value=highpass;lp.type='lowpass';lp.frequency.value=frequency;
    src.connect(hp);hp.connect(lp);lp.connect(g);g.gain.setValueAtTime(0,at);g.gain.linearRampToValueAtTime(gain,at+.008);g.gain.exponentialRampToValueAtTime(.0001,at+seconds);
    track(src,[src,hp,lp,g],role);src.start(at);src.stop(at+seconds+.03);return true;
  }
  function tone(frequency,seconds,gain,delay=0,role='wheelFront'){
    if(!canPlay(role))return false;
    const src=context.createOscillator(),g=makeGain(0,role),at=context.currentTime+delay;src.type='sine';src.frequency.setValueAtTime(frequency,at);src.frequency.linearRampToValueAtTime(frequency*.98,at+seconds);src.connect(g);
    g.gain.setValueAtTime(0,at);g.gain.linearRampToValueAtTime(gain,at+.025);g.gain.setValueAtTime(gain,Math.max(at+.03,at+seconds-.08));g.gain.linearRampToValueAtTime(0,at+seconds);
    track(src,[src,g],role);src.start(at);src.stop(at+seconds+.01);return true;
  }
  function loop(key,{buffer,gain,rate=1,role,offset=0,fallback=false}){
    if(!context)return;
    if(!loops[key]&&gain>0&&(buffer||fallback)){
      const src=context.createBufferSource(),g=makeGain(0,role),nodes=[src,g];src.buffer=buffer||noise;src.loop=true;
      if(!buffer){const filter=context.createBiquadFilter();filter.type='bandpass';filter.frequency.value=1600;nodes.push(filter);src.connect(filter);filter.connect(g);}else src.connect(g);
      src.start(0,Math.min(offset,Math.max(0,(src.buffer.duration||2)-.01)));loops[key]={src,g,nodes,role};
    }
    const layer=loops[key];if(layer){target(layer.g.gain,gain,.12);target(layer.src.playbackRate,rate,.18);}
  }
  function release(gain=.23){
    if(!context||context.state!=='running'||playbackPaused||context.currentTime-lastRelease<.65)return false;
    lastRelease=context.currentTime;let played=false;
    for(const role of ['cylinderLeft','cylinderRight']){
      if(play('release',{role,gain:gain*.5,rate:.78}))played=true;
      else played=envelopeNoise({role,seconds:1.15,gain:gain*.5,frequency:3200,highpass:100})||played;
    }
    return played;
  }
  function whistle(){
    if(!context||context.state!=='running'||playbackPaused||userMuted||context.currentTime-lastWhistle<.5)return false;
    lastWhistle=context.currentTime;
    if(!play('whistle',{role:'whistle',gain:.48,rate:1.08})){
      // Explicitly synthetic fallback through the same world-positioned whistle.
      tone(830,1,.20,0,'whistle');tone(1660,.94,.035,0,'whistle');envelopeNoise({role:'whistle',seconds:1,gain:.08,frequency:4500,highpass:1300});
    }
    return true;
  }
  function guardWhistle(){
    if(!context||context.state!=='running'||playbackPaused||userMuted||context.currentTime-lastGuard<1.3)return false;
    lastGuard=context.currentTime;
    // One closing-door cue, no second departed-event cue or historical count claim.
    const played=tone(2280,.28,.075,0,'guard');if(played)guardCues++;return played;
  }
  function stoneImpact(event){
    const role='impact'+(event.id%AUDIO_LIMITS.impactEmitters),anchor=spatialFrame?.sources?.[role],position=anchor?.position??anchor;
    const worldPosition=Array.isArray(position)||ArrayBuffer.isView(position)?Array.from(position):position&&[position.x,position.y,position.z];
    if(!Array.isArray(event.point)||event.point.length!==3||!event.point.every(Number.isFinite)||worldPosition?.length!==3||!worldPosition.every(Number.isFinite)||anchor?.enabled===false||(anchor?.eventId!==undefined&&anchor.eventId!==event.id))return false;
    // Slots are reused, so retire the previous transient before moving its tail.
    for(const voice of [...oneshots])if(voice.role===role){try{voice.src.stop();}catch{}voice.cleanup();}
    if(oneshots.size>=AUDIO_LIMITS.oneShots){
      const old=[...oneshots].find(voice=>/^(wheel|cylinder)/.test(voice.role));
      if(old){try{old.src.stop();}catch{}old.cleanup();droppedVoices++;}
    }
    if(!play('coach-impact',{role,gain:.34,rate:.96+(event.id%3)*.035}))return false;
    impactCues++;impactSlots[role]={eventId:event.id,car:event.car,worldPosition};return true;
  }
  async function unlock(){
    if(disposed)return getState();
    if(!context){
      const AudioContext=globalThis.AudioContext||globalThis.webkitAudioContext;
      if(!AudioContext){errors.context='Web Audio is unavailable';return getState();}
      context=new AudioContext();({master,compressor}=createEffectsOutput(context));spatial=createSpatialAudioGraph(context,{destination:master});if(spatialFrame)spatial.setSpatialFrame(spatialFrame);
      noise=context.createBuffer(1,context.sampleRate*2,context.sampleRate);const data=noise.getChannelData(0);let seed=93475;for(let i=0;i<data.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;data[i]=(seed/4294967296)*2-1;}
      impactBuffer=createCoachImpactBuffer(context);
      globalThis.document?.addEventListener('visibilitychange',syncMaster);
      loading=Promise.all(Object.entries(FILES).map(async([key,file])=>{try{
        const response=await fetch(new URL('../audio/'+file,import.meta.url));if(!response.ok)throw new Error('HTTP '+response.status);
        const raw=await response.arrayBuffer(),decoded=await context.decodeAudioData(raw);if(disposed)return;
        decodedChannels[key]=decoded.numberOfChannels||1;
        if(key==='crowd'){crowdBuffers.push(...crowdPointBuffers(context,decoded));buffers[key]=crowdBuffers[0];}
        else buffers[key]=monoPointBuffer(context,decoded);
      }catch(error){if(!disposed)errors[key]=String(error.message||error);}}));
    }
    if(!playbackPaused)try{await context.resume();}catch(error){errors.context=String(error.message||error);}
    syncMaster();await loading;return getState();
  }
  function setSpatialFrame(frame){spatialFrame=frame;spatial?.setSpatialFrame(frame);}
  function update(view,frame){
    if(!view||disposed)return;if(frame)setSpatialFrame(frame);
    const distance=Number(view.distance)||0,elapsed=Number(view.elapsed)||0,phase=view.phase,velocity=Math.abs(Number(view.velocity)||(Number(view.speedKmh)||0)/3.6),throttle=Number(view.throttle)||0;
    const running=!!view.started&&!view.paused&&!playbackPaused&&phase!=='summary'&&!globalThis.document?.hidden;
    const effort=brakeEffort(view),brakeGain=running&&effort.active&&velocity>.22?Math.min(.2,.022+velocity*.012)*effort.strength:0;
    Object.assign(brakeFriction,{strength:effort.strength,gain:brakeGain,active:brakeGain>0});
    const hasAudio=!!context&&context.state==='running';
    if(lastElapsed!==null&&elapsed<lastElapsed){lastDistance=null;lastEvent=0;lastPhase=null;active=false;stopOneShots();}
    const wasActive=active;active=running;
    if(hasAudio&&!view.paused&&!playbackPaused){
      // No camera-facing gain scalar: location/rotation comes only from Web Audio's
      // listener and source positions. Crowd loudness is independent of train distance.
      for(const [i,role] of ['crowdFront','crowdRear'].entries())loop(role,{buffer:crowdBuffers[i],role,gain:running&&crowdEnabled?.024:0,offset:i*7.13});
      for(const [i,role] of ['wheelFront','wheelRear'].entries())loop('brake-'+role,{buffer:buffers.brake,role,gain:brakeGain*.65,rate:.82+Math.min(velocity,18)/50,offset:i*.73,fallback:true});
      if(running&&wasActive){
        if(view.brake&&!lastBrake&&velocity>1)release(.14);
        if(!view.brake&&lastBrake&&velocity<1)release(.19);
        if(throttle>0&&lastThrottle<=0&&velocity<2)release(.23);
        if(phase==='doors-opening'&&lastPhase!==phase)release(.27);
        if(phase==='doors-closing'&&lastPhase!==phase)guardWhistle();
        if(lastDistance!==null&&velocity>.06){
          const delta=Math.abs(distance-lastDistance);
          // Four chuffs per actual driving-wheel revolution, bounded catch-up.
          if(delta<12){
            const previousTurn=Math.floor(lastDistance/step),nextTurn=Math.floor(distance/step),direction=nextTurn>=previousTurn?1:-1,count=Math.min(6,Math.abs(nextTurn-previousTurn));
            const gain=(throttle>0?.12+.028*throttle:.048)*Math.min(1,velocity/.3),spacing=count>1?.012:0;
            for(let i=0;i<count;i++){
              const crossing=previousTurn+direction*(i+1),role=Math.abs(crossing)%2?'cylinderLeft':'cylinderRight';
              if(!play('chuff',{role,gain,rate:.86+Math.min(velocity,18)*.024,delay:i*spacing}))envelopeNoise({role,seconds:.18,gain,frequency:1200,delay:i*spacing});chuffs++;
            }
            // Two bounded bogie groups crossing 12.5 m joints; rear group is
            // separated by the actual longitudinal source spacing when available.
            const front=spatialFrame?.sources?.wheelFront,rear=spatialFrame?.sources?.wheelRear;
            const frontPosition=front?.position??front,rearPosition=rear?.position??rear;
            const rearOffset=Number.isFinite(frontPosition?.[0]-rearPosition?.[0])?rearPosition[0]-frontPosition[0]:-20;
            for(const [role,offset] of [['wheelFront',0],['wheelRear',rearOffset]])for(const axleOffset of [0,1.55])if(Math.floor((distance+offset+axleOffset)/12.5)!==Math.floor((lastDistance+offset+axleOffset)/12.5)){
              envelopeNoise({role,seconds:.075,gain:.075+velocity*.0025,frequency:3400,highpass:350});tone(520,.11,.021,0,role);clacks++;
            }
          }
        }
      }
      if(!running&&wasActive)stopOneShots();
    }
    // Events consumed during pause/unlock are never replayed in a resume burst.
    for(const event of view.events||[]){
      if(event.id<=lastEvent)continue;
      if(running&&wasActive){
        if(hasAudio&&event.type==='approach-steam')release(.28);
        if(hasAudio&&event.type==='stone-hit')stoneImpact(event);
        if(event.type==='stone-thrown'){
          characterVoices.requested++;
          characterVoices.lastRequest={eventId:event.id,actor:event.actor,cue:CHARACTER_VOICE_CUE.id,language:CHARACTER_VOICE_CUE.language,status:characterVoices.enabled?'recording-unavailable':'disabled'};
          // Deliberately no source, tone, TTS, fake recording, or replay queue.
        }
      }
      lastEvent=Math.max(lastEvent,event.id||0);
    }
    lastDistance=distance;lastElapsed=elapsed;lastPhase=phase;lastBrake=!!view.brake;lastThrottle=throttle;
  }
  function setPlaybackPaused(value){playbackPaused=!!value;active=false;lastDistance=null;if(!context||context.state==='closed')return Promise.resolve();return playbackPaused?context.suspend():context.resume();}
  function setCrowdEnabled(value){crowdEnabled=!!value;if(!crowdEnabled)for(const role of ['crowdFront','crowdRear'])if(loops[role])target(loops[role].g.gain,0,.05);}
  function setCharacterVoicesEnabled(value){characterVoices.enabled=!!value;}
  function setMuted(value){userMuted=!!value;syncMaster();}
  function setVolume(value){userVolume=clamp(value,0,1);syncMaster();}
  function getState(){return{supported:!!(globalThis.AudioContext||globalThis.webkitAudioContext),unlocked:!!context&&context.state==='running',state:context?.state||'locked',audioClock:context?.currentTime||0,muted:userMuted,paused:playbackPaused,volume:userVolume,samples:Object.keys(buffers),decodedChannels:{...decodedChannels},pointChannels:Object.fromEntries(Object.entries(buffers).map(([key,buffer])=>[key,buffer.numberOfChannels||1])),errors:{...errors},chuffs,clacks,guardCues,impactCues,impactSlots:Object.fromEntries(Object.entries(impactSlots).map(([key,slot])=>[key,{...slot,worldPosition:slot.worldPosition.slice()}])),impactFoley:'original procedural coach clunk; not a recording',characterVoices:{...characterVoices,lastRequest:characterVoices.lastRequest?{...characterVoices.lastRequest}:null},wheelRadius:radius,brakeFriction:{...brakeFriction,roles:brakeFriction.roles.slice()},voiceRecording:false,crowdEnabled,ambience:'two mono platform emitters; independent sample offsets',musicRoute:'separate stereo context; no effects Panner',spatial:spatial?.getState()||null,voices:{active:oneshots.size,peak:peakVoices,dropped:droppedVoices,limit:AUDIO_LIMITS.oneShots,byRole:Object.fromEntries(Object.keys(spatial?.getState().sources||{}).map(role=>[role,[...oneshots].filter(voice=>voice.role===role).length]))},loopCount:Object.keys(loops).length,limits:AUDIO_LIMITS};}
  function dispose(){
    if(disposed)return;disposed=true;globalThis.document?.removeEventListener('visibilitychange',syncMaster);
    for(const [key,layer] of Object.entries(loops)){try{layer.src.stop();}catch{}for(const node of layer.nodes)node.disconnect();delete loops[key];}
    stopOneShots();spatial?.dispose();master?.disconnect();compressor?.disconnect();context?.close();
  }
  return{unlock,setSpatialFrame,setPlaybackPaused,setCrowdEnabled,setCharacterVoicesEnabled,setMuted,setVolume,update,whistle,guardWhistle,release,getState,dispose};
}
