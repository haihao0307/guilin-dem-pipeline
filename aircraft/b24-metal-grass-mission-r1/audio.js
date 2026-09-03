export class FlightAudio {
  constructor(){this.ctx=null;this.volume=.45;this.muted=false;this.events=[];this.engines=[];this.paused=true;this.enabled=false;}
  async unlock(){if(!this.ctx)this.init();if(this.ctx.state==='suspended')await this.ctx.resume();this.enabled=this.ctx.state==='running';return this.enabled;}
  init(){
    const C=window.AudioContext||window.webkitAudioContext;if(!C)throw new Error('浏览器缺少 Web Audio 支持');this.ctx=new C();const c=this.ctx;
    this.master=c.createGain();this.master.gain.value=this.volume;const limiter=c.createDynamicsCompressor();limiter.threshold.value=-9;limiter.knee.value=12;limiter.ratio.value=8;this.master.connect(limiter);this.analyser=c.createAnalyser();this.analyser.fftSize=1024;limiter.connect(this.analyser);this.analyser.connect(c.destination);
    const data=new Float32Array(c.sampleRate*2);let seed=48291,last=0;for(let i=0;i<data.length;i++){seed=(seed*16807)%2147483647;last=(last+(seed/2147483647*2-1)*.025)/1.025;data[i]=last*5;}
    const buf=c.createBuffer(1,data.length,c.sampleRate);buf.copyToChannel(data,0);this.noiseBuffer=buf;
    for(let i=0;i<4;i++){
      const gain=c.createGain();gain.gain.value=0;const pan=c.createStereoPanner();pan.pan.value=(i/3-.5)*1.0;gain.connect(pan);pan.connect(this.master);
      const motor=c.createOscillator(),harmonic=c.createOscillator(),harmGain=c.createGain(),filter=c.createBiquadFilter();motor.type='sawtooth';motor.frequency.value=20;harmonic.type='triangle';harmGain.gain.value=.35;filter.type='lowpass';filter.frequency.value=340;filter.Q.value=.4;motor.connect(filter);harmonic.connect(harmGain);harmGain.connect(filter);filter.connect(gain);motor.start();harmonic.start();this.engines.push({gain,motor,harmonic,filter});
    }
    this.wind=c.createBufferSource();this.wind.buffer=buf;this.wind.loop=true;this.windGain=c.createGain();this.windGain.gain.value=0;const f=c.createBiquadFilter();f.type='bandpass';f.frequency.value=550;f.Q.value=.3;this.wind.connect(f);f.connect(this.windGain);this.windGain.connect(this.master);this.wind.start();
  }
  update(rpm,speed,ground,paused){if(!this.ctx)return;const t=this.ctx.currentTime;this.paused=paused;this.master.gain.setTargetAtTime(this.muted?0:this.volume,t,.1);
    this.engines.forEach((e,i)=>{const r=rpm[i],a=paused?0:(r/2200)**.65*.065;e.gain.gain.setTargetAtTime(a,t,.12);e.motor.frequency.setTargetAtTime(22+r/60*2.8+i*.32,t,.12);e.harmonic.frequency.setTargetAtTime(38+r/60*5.6,t,.12);e.filter.frequency.setTargetAtTime(160+r*.31,t,.15);});
    this.windGain.gain.setTargetAtTime(paused?0:Math.min(.22,speed/500)+(ground&&speed>3?.035:0),t,.2);
  }
  oneShot(kind,strength=1){this.events.push({kind,strength,time:performance.now()});if(!this.ctx||!this.enabled||this.muted)return;
    const c=this.ctx,t=c.currentTime,src=c.createBufferSource(),gain=c.createGain(),f=c.createBiquadFilter();src.buffer=this.noiseBuffer;f.type='lowpass';f.frequency.value=kind==='explosion'?700:kind==='release'?2200:kind==='touchdown'?480:1000;src.connect(f);f.connect(gain);gain.connect(this.master);const dur=kind==='explosion'?2.2:kind==='release'?.28:.7,vol=kind==='explosion'?.7:kind==='release'?.09:.19;gain.gain.setValueAtTime(.001,t);gain.gain.exponentialRampToValueAtTime(vol*strength+.001,t+.025);gain.gain.exponentialRampToValueAtTime(.001,t+dur);src.start(t);src.stop(t+dur+.1);src.onended=()=>{src.disconnect();f.disconnect();gain.disconnect();};
    if(kind==='explosion'){const osc=c.createOscillator(),g=c.createGain();osc.frequency.setValueAtTime(85,t);osc.frequency.exponentialRampToValueAtTime(25,t+1.4);g.gain.setValueAtTime(.6*strength,t);g.gain.exponentialRampToValueAtTime(.001,t+1.4);osc.connect(g);g.connect(this.master);osc.start(t);osc.stop(t+1.5);osc.onended=()=>{osc.disconnect();g.disconnect();};}
  }
  rms(){if(!this.analyser)return 0;const buf=new Float32Array(this.analyser.fftSize);this.analyser.getFloatTimeDomainData(buf);return Math.sqrt(buf.reduce((s,x)=>s+x*x,0)/buf.length);}
}
