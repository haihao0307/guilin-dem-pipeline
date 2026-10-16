import {RigidPoseSampler} from './platform-motion/bridge.mjs';

/** Display live solved endpoints on the refresh clock. Physics remains fixed
 * step and authoritative. Eight pooled snapshots bound memory; a two-step
 * display delay brackets normal Worker delivery jitter. Never extrapolate.
 * Body local rotations use quaternion interpolation with original bind lengths;
 * cloth positions/normals use the same two endpoints and interpolation time.
 */
export class LivePresentation{
 constructor({actor,viewer,controller,apply}){
  Object.assign(this,{actor,viewer,controller,apply});this.sampler=new RigidPoseSampler(actor.rig);
  this.restPose=this.sampler.pack(actor.rig.restMatrices);this.queue=[];this.pool=[];this.output=[];this.cursor=0;this.running=false;this.raf=0;
  this.stats={snapshots:0,presented:0,underflows:0,maxSnapshots:0,delaySeconds:2/60,displaySeconds:0,alpha:0,boneLengthErrorMM:0,liveEndpointsOnly:true};
 }
 layout(rows){
  if(this.output.length===rows.length&&rows.every((r,i)=>this.output[i].positions.length===r.positions.length))return;
  this.queue.length=0;this.cursor=0;
  this.output=rows.map(r=>({positions:new Float32Array(r.positions.length),normals:new Float32Array(r.normals.length)}));
  this.pool=Array.from({length:8},()=>({rows:rows.map(r=>({positions:new Float32Array(r.positions.length),normals:new Float32Array(r.normals.length)})),pose:{q:new Float32Array(this.actor.rig.names.length*4),p:new Float32Array(this.actor.rig.names.length*3)}}));
 }
 push(rows,data){
  if(!data?.audit?.skinMatrices)return;
  this.layout(rows);const time=data.audit.simulationSeconds,last=this.queue.at(-1);
  if(last&&time<last.time)this.queue.length=0;
  let slot;
  if(last&&last.time===time)slot=last;
  else{slot=this.pool[this.cursor++%this.pool.length];const old=this.queue.indexOf(slot);if(old>=0)this.queue.splice(0,old+1);this.queue.push(slot);}
  for(let i=0;i<rows.length;i++){slot.rows[i].positions.set(rows[i].positions);slot.rows[i].normals.set(rows[i].normals);slot.rows[i].audit=rows[i].audit;slot.rows[i].indices=rows[i].indices;slot.rows[i].orientation=rows[i].orientation;}
  const pose=data.audit.localPose||this.restPose;slot.pose.q.set(pose.q);slot.pose.p.set(pose.p);slot.time=time;slot.data=data;
  this.stats.snapshots++;this.stats.maxSnapshots=Math.max(this.stats.maxSnapshots,this.queue.length);
 }
 reset(rows,data){this.queue.length=0;this.cursor=0;this.push(rows,data);}
 start(){if(this.running)return;this.running=true;const tick=()=>{if(!this.running)return;const c=this.controller();if(c?.running&&!this.viewer.lost)this.viewer.render();this.raf=requestAnimationFrame(tick);};this.raf=requestAnimationFrame(tick);}
 stop(){this.running=false;if(this.raf)cancelAnimationFrame(this.raf);this.raf=0;}
 present(now){
  if(!this.running||!this.queue.length)return;
  const c=this.controller();if(!c?.running)return;
  const target=c.segmentTarget+(now-c.wallStart)/1000-this.stats.delaySeconds;
  const first=this.queue[0],last=this.queue.at(-1),time=Math.max(first.time,Math.min(last.time,target));
  if(target>last.time+1e-5)this.stats.underflows++;
  let lo=first,hi=first;
  for(let i=1;i<this.queue.length;i++){hi=this.queue[i];if(hi.time>=time)break;lo=hi;}
  const alpha=hi.time>lo.time?Math.max(0,Math.min(1,(time-lo.time)/(hi.time-lo.time))):0;
  for(let i=0;i<this.output.length;i++){
   const a=lo.rows[i],b=hi.rows[i],out=this.output[i];
   for(let k=0;k<out.positions.length;k++)out.positions[k]=a.positions[k]+(b.positions[k]-a.positions[k])*alpha;
   for(let k=0;k<out.normals.length;k+=3){let x=a.normals[k]+(b.normals[k]-a.normals[k])*alpha,y=a.normals[k+1]+(b.normals[k+1]-a.normals[k+1])*alpha,z=a.normals[k+2]+(b.normals[k+2]-a.normals[k+2])*alpha;const f=1/(Math.hypot(x,y,z)||1);out.normals[k]=x*f;out.normals[k+1]=y*f;out.normals[k+2]=z*f;}
   out.audit=b.audit;out.indices=b.indices;out.orientation=b.orientation;
  }
  const pose=this.sampler.interpolate(lo.pose,hi.pose,alpha),skin=this.sampler.apply(pose);
  this.apply(this.output,{body:null,audit:{...hi.data.audit,skinMatrices:skin,presentationSeconds:time,presentationAlpha:alpha}});
  this.stats.presented++;this.stats.displaySeconds=time;this.stats.alpha=alpha;this.stats.lowSequence=lo.data.audit.frameSequence;this.stats.highSequence=hi.data.audit.frameSequence;
  this.stats.boneLengthErrorMM=this.sampler.boneError()*1000;
 }
 audit(){return{...this.stats,running:this.running,queuedSnapshots:this.queue.length,poolSlots:this.pool.length,pooledBytes:this.pool.reduce((n,s)=>n+s.rows.reduce((a,r)=>a+r.positions.byteLength+r.normals.byteLength,0)+s.pose.q.byteLength+s.pose.p.byteLength,0),physicsTimeScale:1,extrapolated:false};}
}
