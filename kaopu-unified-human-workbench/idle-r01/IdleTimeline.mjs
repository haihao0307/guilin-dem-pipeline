/** Original event scheduler, informed by the supplied video's observable timing.
 * All numbers below are artistic test ranges, NOT recovered mocap/physiology.
 * Independent seeded streams, minimum dwell and fast-close/slow-open blinks.
 */
export const IDLE_DEFAULTS=Object.freeze({enabled:true,profile:'listening',seed:4197,intensity:.85,blink:true,gaze:true,mouth:true,head:true,breath:true,surface:true,surfaceGain:.75,wrinkleGain:.65});
export function validateIdle(input={}){
 const s={...IDLE_DEFAULTS,...input};
 for(const k of Object.keys(s))if(!(k in IDLE_DEFAULTS))throw Error('Unknown idle setting: '+k);
 for(const k of ['enabled','blink','gaze','mouth','head','breath','surface'])if(typeof s[k]!=='boolean')throw Error('Invalid idle toggle: '+k);
 if(!['quiet','listening','engaged'].includes(s.profile))throw Error('Unknown idle profile');
 if(!Number.isInteger(s.seed)||s.seed<0||s.seed>2147483647)throw Error('Seed must be an integer in [0,2147483647]');
 for(const k of ['intensity','surfaceGain','wrinkleGain'])if(!Number.isFinite(s[k])||s[k]<0||s[k]>1)throw Error(k+' must be in [0,1]');return s;
}
const sat=x=>Math.max(0,Math.min(1,x)),ease=x=>{x=sat(x);return x*x*(3-2*x);},lerp=(a,b,t)=>a+(b-a)*t;
function rng(seed){let a=seed>>>0;return()=>{a+=0x6D2B79F5;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
function latest(list,t){let lo=0,hi=list.length;while(lo<hi){const mid=(lo+hi)>>>1;if(list[mid].at<=t)lo=mid+1;else hi=mid;}return Math.max(0,lo-1);}
function pulse(t,e){const d=t-e.at;if(d<0||d>=e.dur)return 0;const attack=e.dur*.28,release=e.dur*.48;return d<attack?ease(d/attack):d>e.dur-release?ease((e.dur-d)/release):1;}
export function blinkEnvelope(age,scale=1){const close=.072*scale,hold=.025*scale,open=.155*scale;if(age<0||age>close+hold+open)return 0;if(age<close)return ease(age/close);if(age<close+hold)return 1;return 1-ease((age-close-hold)/open);}
export class IdleTimeline{
 constructor(seed=4197,profile='listening'){this.seed=seed;this.profile=profile;this.horizon=-1;this.ensure(60);}
 ensure(t){if(t<=this.horizon)return;this.horizon=Math.ceil((t+60)/60)*60;
  const r=rng(this.seed^0x346124),b=rng(this.seed^0x715243),m=rng(this.seed^0x273828);const factor={quiet:1.4,listening:1,engaged:.85}[this.profile]||1;
  this.looks=[{at:0,x:0,y:0,px:0,py:0,dur:.1}];let at=.9+r()*1.2,x=0,y=0,blinkCandidates=[];
  while(at<this.horizon){let px=x,py=y,center=r()<.38;x=center?(r()-.5)*.30:(r()-.5)*1.65;y=(r()-.55)*.95;this.looks.push({at,x,y,px,py,dur:.065+r()*.055});if(r()<.24)blinkCandidates.push({at:at+.015,scale:.90+r()*.22,coupled:true});at+=(1.8+r()*3.8)*factor;}
  at=1.25+b()*1.35;while(at<this.horizon){blinkCandidates.push({at,scale:.9+b()*.25,coupled:false,double:b()<.07});at+=2.3+b()*5.5;}
  blinkCandidates.sort((a,b)=>a.at-b.at);this.blinks=[];let previous=-10;
  for(const e of blinkCandidates){if(e.at-previous<1.05)continue;this.blinks.push(e);previous=e.at;if(e.double){this.blinks.push({...e,at:e.at+.34,scale:e.scale*.86,double:true});previous=e.at+.34;}}
  this.mouths=[];at=3.7+m()*2;while(at<this.horizon){const kind=m()<.46?'press':m()<.56?'jaw':'smile';this.mouths.push({at,kind,dur:1.1+m()*2.2,amp:.30+m()*.28,asym:.82+m()*.18});at+=(6.3+m()*8.4)*factor;}
  this.brows=[];at=5.6+m()*3;while(at<this.horizon){this.brows.push({at,dur:1.7+m()*2,amp:.15+m()*.22});at+=(10+m()*11)*factor;}
 }
 sample(t,settings=IDLE_DEFAULTS){if(!Number.isFinite(t)||t<0)throw Error('Idle time must be finite and >= 0');this.ensure(t);
  const e=this.looks[latest(this.looks,t)],lookT=ease((t-e.at)/e.dur),headT=ease((t-e.at-.18)/.62),s=settings,amp=s.intensity*({quiet:.65,listening:1,engaged:1.15}[s.profile]||1);
  const out={blinkL:0,blinkR:0,gazeX:0,gazeY:0,headX:0,headY:0,jaw:0,press:0,smile:0,brow:0,breath:0,events:[]};
  if(s.blink){const i=latest(this.blinks,t);for(let j=Math.max(0,i-1);j<=i;j++){const z=this.blinks[j];if(!z)continue;out.blinkL=Math.max(out.blinkL,blinkEnvelope(t-z.at,z.scale));out.blinkR=Math.max(out.blinkR,blinkEnvelope(t-z.at-.006,z.scale*1.018));}if(out.blinkL>.02)out.events.push('眨眼');}
  if(s.gaze){out.gazeX=lerp(e.px,e.x,lookT)*amp;out.gazeY=lerp(e.py,e.y,lookT)*amp;if(t-e.at<.28)out.events.push('视线转移');}
  if(s.head){out.headX=lerp(e.px,e.x,headT)*amp*.46;out.headY=lerp(e.py,e.y,headT)*amp*.38;}
  if(s.mouth){const a=this.mouths[latest(this.mouths,t)];if(a){out[a.kind]=pulse(t,a)*a.amp*amp;if(out[a.kind]>.025)out.events.push({press:'轻抿唇',jaw:'下颌放松',smile:'嘴角轻抬'}[a.kind]);}const b=this.brows[latest(this.brows,t)];if(b)out.brow=pulse(t,b)*b.amp*amp;}
  if(s.breath){const phase=t*(2*Math.PI/5.1)+.19*Math.sin(t*.19+(this.seed%31));out.breath=(.5-.5*Math.cos(phase))*.75*amp;}
  // A blink is a complete close even in a quiet profile; intensity controls other lanes.
  if(s.intensity===0)for(const k of Object.keys(out))if(k!=='events')out[k]=0;
  for(const k of Object.keys(out))if(k!=='events')out[k]=Math.max(-1,Math.min(1,out[k]));return out;
 }
 report(t=60){this.ensure(t);return{schema:'kaopu/idle-events@1',seed:this.seed,profile:this.profile,range:[0,t],blinks:this.blinks.filter(e=>e.at<t),gaze:this.looks.filter(e=>e.at<t),mouth:this.mouths.filter(e=>e.at<t),brows:this.brows.filter(e=>e.at<t),timingSource:'seeded artistic ranges, not video motion capture'};}
}
