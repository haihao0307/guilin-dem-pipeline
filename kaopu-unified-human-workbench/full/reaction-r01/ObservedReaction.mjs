/** Independent causal geometry policy inspired by online observation/reaction.
 * No Ready-to-React code, weights, learned latents, future events or hit injection.
 * Output is a task intent, NOT an already-decoded native pose or collision result.
 */
const sub=(a,b)=>a.map((v,i)=>v-b[i]),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),norm=a=>Math.hypot(...a),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const vec=v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite);
export class ObservationHistory{
 constructor({capacity=90}={}){if(!Number.isInteger(capacity)||capacity<4||capacity>2400)throw Error('History capacity must be 4..2400 frames');this.capacity=capacity;this.frames=[];}
 push(frame){if(!Number.isFinite(frame.time)||frame.time<0||this.frames.length&&frame.time<=this.frames.at(-1).time)throw Error('Monotonic observed time required');for(const side of ['self','opponent']){const a=frame[side];for(const key of ['root','head','torso','leftHand','rightHand'])if(!vec(a?.[key]))throw Error('Incomplete observed pose');}
  // Only observed positions are retained: authored event tables cannot leak in.
  const copy=a=>Object.fromEntries(['root','head','torso','leftHand','rightHand'].map(k=>[k,[...a[k]]]));this.frames.push({time:frame.time,self:copy(frame.self),opponent:copy(frame.opponent)});if(this.frames.length>this.capacity)this.frames.shift();}
 through(time){return this.frames.filter(f=>f.time<=time);}
 reset(){this.frames=[];}
}
export class ObservedReactionPolicy{
 constructor({latency=.10,horizon=.32,missRadius=.16,minClosingSpeed=.55}={}){if(![latency,horizon,missRadius,minClosingSpeed].every(Number.isFinite)||latency<0||latency>.5||horizon<=0||horizon>1||missRadius<=0||missRadius>.5||minClosingSpeed<=0)throw Error('Invalid causal policy parameters');this.history=new ObservationHistory();this.latency=latency;this.horizon=horizon;this.missRadius=missRadius;this.minClosingSpeed=minClosingSpeed;this.reset();}
 reset(){this.history?.reset();this.active=null;this.lastTime=null;this.lastThreatTime=-Infinity;this.weights={guard:1,slipLeft:0,slipRight:0,duck:0,retreat:0,counterIntent:0};this.velocity=Object.fromEntries(Object.keys(this.weights).map(k=>[k,0]));}
 observe(f){this.history.push(f);}
 step(now){if(!Number.isFinite(now)||this.lastTime!==null&&now<=this.lastTime)throw Error('Monotonic policy clock required');const dt=this.lastTime===null?1/120:now-this.lastTime;if(dt>1/30)throw Error('Advance policy with bounded fixed steps');this.lastTime=now;
  const seen=this.history.through(now-this.latency),current=seen.at(-1),older=seen[Math.max(0,seen.length-4)];let threats=[];
  if(current&&older&&current.time>older.time){const duration=current.time-older.time;
   for(const hand of ['leftHand','rightHand'])for(const region of ['head','torso']){const p=current.opponent[hand],v=sub(sub(p,older.opponent[hand]),sub(current.self[region],older.self[region])).map(x=>x/duration),r=sub(current.self[region],p),speed=norm(v),closing=dot(r,v)/Math.max(norm(r),1e-9),ttc=dot(r,v)/Math.max(dot(v,v),1e-9),miss=norm(sub(r,v.map(x=>x*ttc)));
    const observedHandVelocity=sub(p,older.opponent[hand]).map(x=>x/duration),opponentClosing=dot(r,observedHandVelocity)/Math.max(norm(r),1e-9);
    if(opponentClosing>this.minClosingSpeed*.7&&closing>this.minClosingSpeed&&ttc>=0&&ttc<=this.horizon&&miss<this.missRadius)threats.push({hand,region,ttc,miss,closingSpeed:closing,observedAt:current.time,incomingSide:(()=>{const f=sub(current.opponent.root,current.self.root),right=[f[2],0,-f[0]];return Math.sign(dot(sub(p,current.self[region]),right))||1;})()});
   }
  }
  threats.sort((a,b)=>a.ttc-b.ttc||a.miss-b.miss);const threat=threats[0];
  if(threat){this.lastThreatTime=now;if(!this.active||now>=this.active.until){const action=threat.region==='torso'?'retreat':threat.incomingSide>0?'slipLeft':'slipRight';this.active={action,start:now,until:now+.24,cause:{...threat}};}}
  else if(this.active&&now>=this.active.until)this.active=null;
  const target=Object.fromEntries(Object.keys(this.weights).map(k=>[k,0]));target.guard=1;target[this.active?.action||'guard']=1;
  // Continuous critically damped intent state; native foot/body task decoder pending.
  const omega=18;
  for(const k of Object.keys(this.weights)){const a=omega*omega*(target[k]-this.weights[k])-2*omega*this.velocity[k];this.velocity[k]+=a*dt;this.weights[k]+=this.velocity[k]*dt;if(Math.abs(this.weights[k]-target[k])<1e-10&&Math.abs(this.velocity[k])<1e-10){this.weights[k]=target[k];this.velocity[k]=0;}}
  return {schema:'observed-reaction-task-intent/1',time:now,observationCutoff:now-this.latency,latestObservation:current?.time??null,action:this.active?.action||'guard',cause:this.active?.cause||null,weights:{...this.weights},threats,nativeDecoded:false,collisionHit:false,source:'self-authored causal geometry policy; no learned latent model'};
 }
}
