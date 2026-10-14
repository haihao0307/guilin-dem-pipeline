/** Port of FUR-ATELIER-R02 C3 bounded guide-tip springs.
 * Source: Humanoid-Rig-Lab-Next@e845835b3e04c56a65c405ff87aece955b161b4d/fur-workshop/r02/app.js
 * Keeps source spring/damping/forcing and 120 Hz. This is not an elastic rod or collision solver.
 */
export const MOTION_SOURCE='e845835b3e04c56a65c405ff87aece955b161b4d';
export const GW=17, GH=5, GUIDE_COUNT=GW*GH;
export function guideBinding(x,z){
 if(!Number.isFinite(x)||!Number.isFinite(z))throw Error('Invalid root');
 const a=Math.max(0,Math.min(GW-1,(x+.031)/.062*(GW-1)));
 const b=Math.max(0,Math.min(GH-1,(z+.006)/.012*(GH-1)));
 const i=Math.min(GW-2,Math.floor(a)),j=Math.min(GH-2,Math.floor(b)),s=a-i,t=b-j;
 return {ids:[j*GW+i,j*GW+i+1,(j+1)*GW+i,(j+1)*GW+i+1],weights:[(1-s)*(1-t),s*(1-t),(1-s)*t,s*t]};
}
export class FurGuideMotion {
 constructor(){
  this.offsets=new Float32Array(GUIDE_COUNT*4);this.velocity=new Float64Array(GUIDE_COUNT*3);
  this.positions=new Float64Array(GUIDE_COUNT*3);this.phase=new Float64Array(GUIDE_COUNT);this.brushWeights=new Float32Array(GUIDE_COUNT);
  this.direction=[0,0,0];this.brushGain=0;this.wind=.32;this.enabled=false;this.paused=false;
  this.time=0;this.accumulator=0;this.steps=0;this.droppedSeconds=0;this.cpuMS=0;this.active=false;this.revision=0;
  for(let j=0;j<GH;j++)for(let i=0;i<GW;i++){const n=j*GW+i;this.positions.set([-.031+.062*i/(GW-1),.128,-.006+.012*j/(GH-1)],n*3);this.phase[n]=((n*0.61803398875)%1)*Math.PI*2;}
 }
 setWind(value){if(!Number.isFinite(value)||value<0||value>1.5)throw Error('Invalid wind');this.wind=value;}
 setBrush(weights,direction,gain=1){
  if(weights.length!==GUIDE_COUNT||direction.length!==3||!direction.every(Number.isFinite)||!Number.isFinite(gain)||gain<0||gain>1)throw Error('Invalid brush');
  for(const w of weights)if(!Number.isFinite(w)||w<0||w>1)throw Error('Invalid influence');
  this.brushWeights.set(weights);const length=Math.hypot(...direction),s=Math.min(1,18/Math.max(length,1e-12));this.direction=direction.map(v=>v*s);this.brushGain=gain;this.active=true;
 }
 release(){this.brushGain=0;}
 reset(){this.offsets.fill(0);this.velocity.fill(0);this.brushGain=0;this.accumulator=0;this.active=false;this.time=0;this.revision++;}
 advance(seconds){
  if(!Number.isFinite(seconds)||seconds<0)throw Error('Invalid dt');
  if(this.paused||(!this.enabled&&!this.active&&this.brushGain===0))return false;
  const started=performance.now(),accepted=Math.min(seconds,.05);this.droppedSeconds+=seconds-accepted;this.accumulator+=accepted;let changed=false;
  while(this.accumulator+1e-12>=1/120){this.step(1/120);this.accumulator-=1/120;changed=true;}
  if(changed)this.revision++;this.cpuMS=performance.now()-started;return changed;
 }
 step(dt){
  this.time+=dt;this.steps++;let peak=0;
  for(let i=0;i<GUIDE_COUNT;i++){
   const q=i*3,o=i*4,wind=this.enabled?this.wind:0;
   const fx=(Math.sin(this.time*1.6+this.positions[q+1]*3.3)+.36*Math.sin(this.time*3.1+this.phase[i]))*wind*.50;
   const fz=Math.sin(this.time*1.2+this.positions[q]*4.2)*wind*.18;
   for(let k=0;k<3;k++){
    const force=(k===0?fx:k===2?fz:0)+this.direction[k]*this.brushWeights[i]*this.brushGain*.27;
    this.velocity[q+k]+=(force-33*this.offsets[o+k]-8.5*this.velocity[q+k])*dt;
    this.offsets[o+k]+=this.velocity[q+k]*dt;
   }
   const radius=Math.hypot(this.offsets[o],this.offsets[o+1],this.offsets[o+2]);
   if(radius>.035){const s=.035/radius;for(let k=0;k<3;k++)this.offsets[o+k]*=s;let v=0;for(let k=0;k<3;k++)v+=this.velocity[q+k]*this.offsets[o+k]/.035;if(v>0)for(let k=0;k<3;k++)this.velocity[q+k]-=v*this.offsets[o+k]/.035;}
   // Source's root-normal half-space bound, adapted to downward-growing swatch roots.
   // This does not check head, clothes or inter-strand contacts.
   if(this.offsets[o+1]>.004){this.offsets[o+1]=.004;if(this.velocity[q+1]>0)this.velocity[q+1]=0;}
   for(let k=0;k<3;k++)peak=Math.max(peak,Math.abs(this.offsets[o+k]),Math.abs(this.velocity[q+k])*.1);
  }
  this.active=peak>1e-7||this.brushGain>0;
  if(!this.enabled&&!this.active){this.offsets.fill(0);this.velocity.fill(0);}
 }
 snapshot(){let maxOffset=0,maxVelocity=0;for(let i=0;i<GUIDE_COUNT;i++){maxOffset=Math.max(maxOffset,Math.hypot(...this.offsets.subarray(i*4,i*4+3)));maxVelocity=Math.max(maxVelocity,Math.hypot(...this.velocity.subarray(i*3,i*3+3)));}return {source:MOTION_SOURCE,model:'bounded guide-tip spring; not rod/collision',guides:GUIDE_COUNT,fixedStep:1/120,stiffness:33,damping:8.5,maxOffset,maxVelocity,steps:this.steps,time:this.time,wind:this.wind,windEnabled:this.enabled,paused:this.paused,active:this.active,cpuMS:this.cpuMS,droppedSeconds:this.droppedSeconds,revision:this.revision};}
}
