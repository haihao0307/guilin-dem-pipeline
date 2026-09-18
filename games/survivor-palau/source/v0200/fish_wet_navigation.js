/* Local wet-area navigation, not hydrodynamic advection.
 * Guarantees are sampled: 8 footprint rim points + centre, swept at <= .10 m;
 * planning sees .8 m and 2 s ahead. Endpoints reserve the next .1 s of water
 * at start/mid/end samples, covering fractional-step display time. Thin/unresolved obstacles and arbitrary
 * discontinuous water changes cannot be made continuously safe by this model.
 * All state is JSON data; callers retain fish identity and captured state.
 */
function createFishWetNavigation(env){
'use strict';
const STEP=.1,SPEED=.65,TAU=Math.PI*2,finite=Number.isFinite;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const angle=v=>Math.atan2(Math.sin(v),Math.cos(v));
const point=p=>Array.isArray(p)&&p.length===3&&p.every(finite);
function bounds(f,x,z,t){
 const r=.98*f.length+.025,top=.45*f.length+.035,bottom=.35*f.length+.035;
 let lo=-Infinity,hi=Infinity;
 try{
  for(let i=-1;i<8;i++){
   const a=i*TAU/8,px=x+(i<0?0:Math.cos(a)*r),pz=z+(i<0?0:Math.sin(a)*r);
   const bed=env.floor(px,pz),sea=env.water(px,pz,t);
   if(!finite(bed)||!finite(sea))return{valid:false,reason:'non-finite-environment'};
   lo=Math.max(lo,bed+bottom);hi=Math.min(hi,sea-top);
  }
  return{valid:true,lo,hi,room:hi-lo,r};
 }catch(e){return{valid:false,reason:'environment-error'};}
}
function at(f,p,t){
 if(!point(p)||!finite(t))return{valid:false,safe:false,reason:'invalid-position-or-time'};
 const b=bounds(f,p[0],p[2],t);
 if(!b.valid)return{...b,safe:false};
 let blocked=false;
 try{if(env.blocked)blocked=!!env.blocked(p[0],p[1],p[2],b.r);}catch(e){return{...b,valid:false,safe:false,reason:'obstacle-query-error'};}
 const safe=b.room>=0&&p[1]>=b.lo-1e-8&&p[1]<=b.hi+1e-8&&!blocked;
 return{...b,safe,reason:safe?'clear':blocked?'solid-obstacle':b.room<0?'insufficient-water':'body-outside-water'};
}
function holdingBounds(f,x,z,t){
 // A completed fixed step is displayed until the next one. Reserve its whole
 // following STEP, including the midpoint, instead of clamping to only its end.
 const b=bounds(f,x,z,t);if(!b.valid)return b;
 for(const offset of [STEP/2,STEP]){
  const q=bounds(f,x,z,t+offset);if(!q.valid)return q;
  b.lo=Math.max(b.lo,q.lo);b.hi=Math.min(b.hi,q.hi);
 }
 b.room=b.hi-b.lo;return b;
}
function segment(f,a,b,t0,t1){
 const n=Math.max(2,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1],b[2]-a[2])/.10));
 for(let j=0;j<=n;j++){
  const u=j/n,p=a.map((v,k)=>v+(b[k]-v)*u),q=at(f,p,t0+(t1-t0)*u);
  if(!q.safe)return q;
 }
 return{valid:true,safe:true,reason:'clear'};
}
function inspect(f,nav,time=nav?.time){
 if(!nav)return{valid:false,safe:false,status:'unavailable',reason:'navigation-not-initialized',time};
 if(!f||!finite(f.length)||f.length<=0)return{valid:false,safe:false,reason:'invalid-fish'};
 return{...at(f,nav.pos,time),status:nav.status,time,simulationTime:nav.simTime,
  limitation:'sampled footprint and sweep; 0.8m / 2s local forecast; no water-current velocity'};
}
function fail(nav,status,reason){nav.status=status;nav.reason=reason;return nav;}
function initialize(f,time,saved){
 const nav={version:1,id:f.id,pos:point(f.pos)?[...f.pos]:[0,0,0],yaw:finite(f.yaw)?f.yaw:0,
  status:'unavailable',reason:'uninitialized',time,simTime:time,remainder:0,planAt:time,heading:0,initialization:'authored-spawn'};
 if(saved!==undefined&&saved!==null){
  const v=JSON.parse(JSON.stringify(saved));
  if(v&&point(v.pos))nav.pos=[...v.pos];
  if(v&&finite(v.yaw))nav.yaw=v.yaw;
  if(!v||v.version!==1||v.id!==f.id||!point(v.pos)||!finite(v.yaw)||!finite(v.time)||!finite(v.simTime)||
   !finite(v.remainder)||v.remainder<0||v.remainder>=STEP+1e-8||!finite(v.heading)||!finite(v.planAt)||
   !['swimming','stranded','unavailable'].includes(v.status)||Math.abs(v.time-v.simTime-v.remainder)>1e-6)
   return fail(nav,'unavailable','invalid-saved-navigation');
  // Restoring never chooses a replacement location, even if water has changed.
  Object.assign(nav,v);nav.initialization='restored';
  if(Math.abs(time-nav.time)>1e-7)return fail(nav,'unavailable','restore-time-mismatch');
  const q=inspect(f,nav,time);
  if(!q.safe)fail(nav,q.valid?'stranded':'unavailable',q.reason);
  return nav;
 }
 if(!finite(time)||!finite(f.length)||f.length<=0||!Array.isArray(f.anchor)||f.anchor.length!==2||!f.anchor.every(finite))
  return fail(nav,'unavailable','invalid-initial-input');
 // Authored/new or legacy-without-navigation placement, deterministic and labeled.
 const phase=finite(f.phase)?f.phase:0,origin=[f.anchor[0]+Math.sin(phase)*1.25,f.anchor[1]+Math.cos(phase*.87)*.85];
 for(let ring=0;ring<=20;ring++){
  const count=ring?16:1;
  for(let j=0;j<count;j++){
   const a=phase+j*TAU/count,x=origin[0]+Math.sin(a)*ring*.5,z=origin[1]+Math.cos(a)*ring*.5,b=bounds(f,x,z,time);
   if(!b.valid)return fail(nav,'unavailable',b.reason);
   if(b.room<.10)continue;
   const p=[x,(b.lo+b.hi)/2,z];
   if(at(f,p,time).safe){nav.pos=p;nav.heading=nav.yaw;nav.status='swimming';nav.reason='clear';
    nav.initialization=ring?'relocated-spawn-or-legacy-migration':'authored-spawn-or-legacy-migration';return nav;}
  }
 }
 return fail(nav,'unavailable','no-safe-spawn-within-10m');
}
function plan(f,nav,t){
 const p=nav.pos,now=holdingBounds(f,p[0],p[2],t),future=holdingBounds(f,p[0],p[2],t+2);
 if(!now.valid||!future.valid)return fail(nav,'unavailable',(!now.valid?now:future).reason);
 const retreat=Math.min(now.room,future.room)<.35;
 const phase=(finite(f.phase)?f.phase:0)+t*.19;
 const goal=[f.anchor[0]+Math.sin(phase)*1.25,f.anchor[1]+Math.cos(phase*.87)*.85];
 let best=-Infinity,heading=nav.yaw+Math.PI/2;
 for(let j=0;j<8;j++){
  const a=j*TAU/8,x=p[0]+Math.sin(a)*.8,z=p[2]+Math.cos(a)*.8,b=holdingBounds(f,x,z,t+1.25),b2=holdingBounds(f,x,z,t+2);
  if(!b.valid||!b2.valid)return fail(nav,'unavailable',(!b.valid?b:b2).reason);
  if(Math.min(b.room,b2.room)<.03)continue;
  const dest=[x,clamp(p[1],b.lo+.01,b.hi-.01),z];
  if(!segment(f,p,dest,t,t+1.25).safe)continue;
  const score=(retreat?8:1)*Math.min(b.room,b2.room)-.32*Math.hypot(x-goal[0],z-goal[1])+.10*Math.cos(a-nav.yaw);
  if(score>best){best=score;heading=a;}
 }
 nav.heading=heading;nav.planAt=t+.5;nav.behavior=retreat?'wet-area-retreat':'local-patrol';
 return nav;
}
function step(f,nav,t){
 const start=nav.pos,q=at(f,start,t);
 if(!q.safe)return fail(nav,q.valid?'stranded':'unavailable',q.reason);
 if(t+1e-8>=nav.planAt){plan(f,nav,t);if(nav.status==='unavailable')return nav;}
 const turn=clamp(angle(nav.heading-nav.yaw),-1.8*STEP,1.8*STEP),a=nav.yaw+turn;
 // Try short, physically connected steps only. No snapping to a remote refuge.
 {
  const direction=a,x=start[0]+Math.sin(direction)*SPEED*STEP,z=start[2]+Math.cos(direction)*SPEED*STEP;
  const b=holdingBounds(f,x,z,t+STEP);
  if(!b.valid)return fail(nav,'unavailable',b.reason);
  if(b.room>=.02){
  const target=clamp(start[1],b.lo+.01,b.hi-.01),y=start[1]+clamp(target-start[1],-.9*STEP,.9*STEP),dest=[x,y,z];
  if(segment(f,start,dest,t,t+STEP).safe){
  nav.pos=dest;nav.yaw=direction;nav.status='swimming';nav.reason='clear';return nav;
  }
  }
 }
 // Keep a visible fish waiting/turning when the full body can safely remain here.
 // Vertical adjustment is speed-limited and checked over the entire time interval.
 nav.yaw=a;nav.planAt=t;
 const hold=holdingBounds(f,start[0],start[2],t+STEP);
 if(!hold.valid)return fail(nav,'unavailable',hold.reason);
 if(hold.room>=.02){
  const goal=clamp(start[1],hold.lo+.01,hold.hi-.01),p=[start[0],start[1]+clamp(goal-start[1],-.9*STEP,.9*STEP),start[2]];
  if(segment(f,start,p,t,t+STEP).safe){nav.pos=p;nav.behavior='waiting-for-turn';return fail(nav,'swimming','waiting-for-turn');}
 }
 return fail(nav,'stranded','no-safe-local-step');
}
function advance(f,nav,time){
 if(!finite(time)||!finite(nav.time)||time<nav.time-1e-8)return fail(nav,'unavailable','invalid-or-reversed-time');
 const elapsed=time-nav.time;
 if(elapsed>600)return fail(nav,'unavailable','time-jump-exceeds-600s-budget');
 if(nav.status==='unavailable')return nav;
 nav.remainder+=Math.max(0,elapsed);nav.time=time;
 while(nav.remainder>=STEP-1e-8){
  step(f,nav,nav.simTime);nav.simTime+=STEP;nav.remainder=Math.max(0,nav.remainder-STEP);
  if(nav.status==='unavailable')break;
 }
 // A fractional step does not move the fish, but its requested-time water must
 // still be valid. Abrupt drops can strand it; never report the old water as safe.
 if(nav.status!=='unavailable'){
  const q=inspect(f,nav,time);if(!q.safe)fail(nav,q.valid?'stranded':'unavailable',q.reason);
 }
 // Unavailable stops simulation explicitly; retain unprocessed duration for diagnosis.
 return nav;
}
return{initialize,advance,inspect,limits:{stepSeconds:STEP,speed:SPEED,forecastSeconds:2,lookAheadMetres:.8,
 footprintRimSamples:8,sweepMetres:.10,holdingForecastSeconds:STEP,holdingForecastSamples:3,maximumAdvanceSeconds:600,hasWaterCurrent:false}};
}
