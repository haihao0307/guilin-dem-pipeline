// Sound layers for the fictional 1960s KCR steam service. See audio/manifest.json.
// Samples are modern CC0 recordings / foley, not historical KCR archives.
const FILES = Object.freeze({whistle:'steam-whistle.mp3',chuff:'steam-chuff.mp3',release:'steam-release.mp3',brake:'metal-brake.mp3',crowd:'station-crowd.mp3'});
const clamp=(v,a,b)=>Math.min(b,Math.max(a,Number(v)||0));

export function createRailAudio({wheelRadius=.72,volume=.55,muted=false,crowdEnabled=false}={}){
  let context,master,compressor,noise,loading,lastDistance=null,lastElapsed=null,lastPhase=null,lastBrake=false,lastThrottle=0,lastEvent=0,lastWhistle=-100,lastRelease=-100,lastGuard=-100,disposed=false;
  let userVolume=clamp(volume,0,1),userMuted=!!muted,active=false,chuffs=0,clacks=0;
  const buffers={},loops={},oneshots=new Set(),errors={};
  const step=2*Math.PI*Math.max(.15,Number(wheelRadius)||.72)/4;
  function target(param,value,t=.055){if(!context)return;param.setTargetAtTime(value,context.currentTime,t);}
  function syncMaster(){if(master)target(master.gain,userMuted||globalThis.document?.hidden?0:userVolume,.025);}
  function makeGain(value){const gain=context.createGain();gain.gain.value=value;gain.connect(master);return gain;}
  function play(name,{gain=.35,rate=1,offset=0,duration,delay=0}={}){
    if(!context||context.state!=='running'||userMuted||disposed)return false;
    const buffer=buffers[name];if(!buffer)return false;
    const src=context.createBufferSource(),g=makeGain(gain);src.buffer=buffer;src.playbackRate.value=clamp(rate,.3,3);src.connect(g);
    oneshots.add(src);src.onended=()=>{oneshots.delete(src);src.disconnect();g.disconnect();};
    const when=context.currentTime+delay;
    if(duration)src.start(when,Math.min(offset,buffer.duration-.01),duration);else src.start(when,offset);
    return true;
  }
  function envelopeNoise({seconds=.2,gain=.2,frequency=800,highpass=80,delay=0}={}){
    if(!context||context.state!=='running'||userMuted||disposed)return;
    const src=context.createBufferSource(),hp=context.createBiquadFilter(),lp=context.createBiquadFilter(),g=makeGain(0),at=context.currentTime+delay;
    src.buffer=noise;src.loop=true;hp.type='highpass';hp.frequency.value=highpass;lp.type='lowpass';lp.frequency.value=frequency;
    src.connect(hp);hp.connect(lp);lp.connect(g);g.gain.setValueAtTime(0,at);g.gain.linearRampToValueAtTime(gain,at+.008);g.gain.exponentialRampToValueAtTime(.0001,at+seconds);
    oneshots.add(src);src.onended=()=>{oneshots.delete(src);src.disconnect();hp.disconnect();lp.disconnect();g.disconnect();};src.start(at);src.stop(at+seconds+.03);
  }
  function tone(frequency,seconds,gain,delay=0){
    if(!context||context.state!=='running'||userMuted||disposed)return;
    const src=context.createOscillator(),g=makeGain(0),at=context.currentTime+delay;src.type='sine';src.frequency.setValueAtTime(frequency,at);src.frequency.linearRampToValueAtTime(frequency*.98,at+seconds);src.connect(g);
    g.gain.setValueAtTime(0,at);g.gain.linearRampToValueAtTime(gain,at+.025);g.gain.setValueAtTime(gain,Math.max(at+.03,at+seconds-.08));g.gain.linearRampToValueAtTime(0,at+seconds);
    oneshots.add(src);src.onended=()=>{oneshots.delete(src);src.disconnect();g.disconnect();};src.start(at);src.stop(at+seconds+.01);
  }
  function loop(name,gain,rate=1){
    if(!context)return;
    if(!loops[name]&&buffers[name]){const src=context.createBufferSource(),g=makeGain(0);src.buffer=buffers[name];src.loop=true;src.connect(g);src.start();loops[name]={src,g};}
    const layer=loops[name];if(layer){target(layer.g.gain,gain,.12);target(layer.src.playbackRate,rate,.18);}
  }
  function release(gain=.23){
    if(!context||context.currentTime-lastRelease<.65)return;
    lastRelease=context.currentTime;
    if(!play('release',{gain,rate:.78}))envelopeNoise({seconds:1.15,gain,frequency:3200,highpass:100});
  }
  function whistle(){
    if(!context||context.state!=='running'||context.currentTime-lastWhistle<.5)return false;
    lastWhistle=context.currentTime;
    if(!play('whistle',{gain:.48,rate:1.08})){
      // Explicitly synthetic fallback; never presented as a recorded locomotive.
      tone(830,1,.20);tone(1660,.94,.035);envelopeNoise({seconds:1,gain:.08,frequency:4500,highpass:1300});
    }
    return true;
  }
  function guardWhistle(){
    if(!context||context.currentTime-lastGuard<1.3)return;
    lastGuard=context.currentTime;
    // Dry hand-whistle cue, no PA, electronic chime, or fabricated archival voice.
    tone(2280,.19,.075);tone(2280,.32,.07,.27);
  }
  async function unlock(){
    if(disposed)return getState();
    if(!context){
      const AudioContext=globalThis.AudioContext||globalThis.webkitAudioContext;
      if(!AudioContext){errors.context='Web Audio is unavailable';return getState();}
      context=new AudioContext();master=context.createGain();compressor=context.createDynamicsCompressor();master.gain.value=0;
      compressor.threshold.value=-14;compressor.knee.value=12;compressor.ratio.value=5;compressor.attack.value=.008;compressor.release.value=.2;
      master.connect(compressor);compressor.connect(context.destination);
      noise=context.createBuffer(1,context.sampleRate*2,context.sampleRate);const data=noise.getChannelData(0);let seed=93475;for(let i=0;i<data.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;data[i]=(seed/4294967296)*2-1;}
      globalThis.document?.addEventListener('visibilitychange',syncMaster);
      loading=Promise.all(Object.entries(FILES).map(async([key,file])=>{try{
        const response=await fetch(new URL('./audio/'+file,import.meta.url));if(!response.ok)throw new Error('HTTP '+response.status);
        const raw=await response.arrayBuffer();buffers[key]=await context.decodeAudioData(raw);
      }catch(error){errors[key]=String(error.message||error);}}));
    }
    try{await context.resume();}catch(error){errors.context=String(error.message||error);}
    syncMaster();await loading;return getState();
  }
  function update(view){
    if(!view||disposed)return;
    const distance=Number(view.distance)||0,elapsed=Number(view.elapsed)||0,phase=view.phase,velocity=Math.abs(Number(view.velocity)||(Number(view.speedKmh)||0)/3.6),throttle=Number(view.throttle)||0;
    const running=!!view.started&&!view.paused&&phase!=='summary'&&!globalThis.document?.hidden;
    const hasAudio=!!context&&context.state==='running';
    if(lastElapsed!==null&&elapsed<lastElapsed){lastDistance=null;lastEvent=0;lastPhase=null;}
    const wasActive=active;active=running;
    if(hasAudio){
      const remaining=Number(view.station?.remaining),near=Number.isFinite(remaining)?Math.abs(remaining):999,stationLevel=near<42?Math.max(0,1-near/42):0;
      loop('crowd',running&&crowdEnabled?stationLevel*.035:0);
      const braking=!!view.brake||throttle<0;
      loop('brake',running&&braking&&velocity>.22?Math.min(.2,.022+velocity*.012):0,.82+Math.min(velocity,18)/50);
      if(running&&wasActive){
        if(view.brake&&!lastBrake&&velocity>1)release(.14);
        if(!view.brake&&lastBrake&&velocity<1)release(.19);
        if(throttle>0&&lastThrottle<=0&&velocity<2)release(.23);
        if(phase==='doors-opening'&&lastPhase!==phase)release(.27);
        if(phase==='doors-closing'&&lastPhase!==phase)guardWhistle();
        if(lastDistance!==null&&velocity>.06){
          const delta=Math.abs(distance-lastDistance);
          // Count actual quarter-turn crossings, so wheel animation and chuff share distance.
          if(delta<12){
            const count=Math.min(6,Math.abs(Math.floor(distance/step)-Math.floor(lastDistance/step)));
            const gain=(throttle>0?.12+.028*throttle:.048)*Math.min(1,velocity/.3),spacing=count>1?.012:0;
            for(let i=0;i<count;i++){if(!play('chuff',{gain,rate:.86+Math.min(velocity,18)*.024,delay:i*spacing}))envelopeNoise({seconds:.18,gain,frequency:1200,delay:i*spacing});chuffs++;}
            // Paired wheels crossing 12.5 m rail joints. The sound is original synthesis.
            for(const offset of [0,1.55])if(Math.floor((distance+offset)/12.5)!==Math.floor((lastDistance+offset)/12.5)){
              envelopeNoise({seconds:.075,gain:.09+velocity*.003,frequency:3400,highpass:350});tone(520,.11,.024);clacks++;
            }
          }
        }
      }
      if(!running&&wasActive){for(const src of oneshots){try{src.stop();}catch{}}}
    }
    for(const event of view.events||[]){if(event.id<=lastEvent)continue;if(hasAudio&&running&&wasActive&&event.type==='departed')guardWhistle();lastEvent=Math.max(lastEvent,event.id||0);}
    lastDistance=distance;lastElapsed=elapsed;lastPhase=phase;lastBrake=!!view.brake;lastThrottle=throttle;
  }
  function setCrowdEnabled(value){crowdEnabled=!!value;}
  function setMuted(value){userMuted=!!value;syncMaster();}
  function setVolume(value){userVolume=clamp(value,0,1);syncMaster();}
  function getState(){return{supported:!!(globalThis.AudioContext||globalThis.webkitAudioContext),unlocked:!!context&&context.state==='running',state:context?.state||'locked',muted:userMuted,volume:userVolume,samples:Object.keys(buffers),errors:{...errors},chuffs,clacks,wheelRadius:Number(wheelRadius)||.72,voiceRecording:false,crowdEnabled};}
  function dispose(){disposed=true;globalThis.document?.removeEventListener('visibilitychange',syncMaster);for(const layer of Object.values(loops)){try{layer.src.stop();}catch{}}for(const src of oneshots){try{src.stop();}catch{}}context?.close();}
  return{unlock,setCrowdEnabled,setMuted,setVolume,update,whistle,guardWhistle,release,getState,dispose};
}
