import {groom} from './specimen.mjs';
export const GUIDE_COUNT=85,NODES=25,DT=1/120;
/** Position based guide chains in metres. Display fibers inherit a continuous
 * displacement field; their own length and collisions are not independently solved.
 * Two fixed nodes preserve the follicle direction. Edge constraints are projected
 * last, and velocities are reconstructed after projection for dissipative motion.
 */
export class StrandDynamics{
 constructor(){
  this.offsets=new Float32Array(GUIDE_COUNT*NODES*4);this.basisData=new Float32Array(81*4);
  this.positions=new Float64Array(GUIDE_COUNT*3);this.rest=new Float64Array(GUIDE_COUNT*NODES*3);
  this.q=new Float64Array(this.rest.length);this.previous=new Float64Array(this.rest.length);this.velocity=new Float64Array(this.rest.length);
  this.lengths=new Float64Array(GUIDE_COUNT*(NODES-1));this.brushWeights=new Float32Array(GUIDE_COUNT);
  this.wave=1;this.wind=.38;this.stiffness=.5;this.damping=3.5;
  this.enabled=false;this.paused=false;this.active=false;this.time=0;this.accumulator=0;this.steps=0;this.revision=0;this.cpuMS=0;this.droppedSeconds=0;
  for(let j=0;j<5;j++)for(let i=0;i<17;i++)this.positions.set([-.031+.062*i/16,.128,-.006+.012*j/4],(j*17+i)*3);
  this.configure(1);
 }
 configure(wave=this.wave){
  if(!Number.isFinite(wave)||wave<0||wave>1.4)throw Error('Invalid groom');
  this.wave=wave;
  for(let g=0;g<85;g++)for(let n=0;n<NODES;n++)this.rest.set(groom(this.positions[g*3],this.positions[g*3+2],n/(NODES-1),wave),(g*NODES+n)*3);
  for(let g=0;g<85;g++)for(let n=1;n<NODES;n++){const a=(g*NODES+n)*3,b=a-3;this.lengths[g*(NODES-1)+n-1]=Math.hypot(...[0,1,2].map(k=>this.rest[a+k]-this.rest[b+k]));}
  this.reset();
 }
 reset(){this.q.set(this.rest);this.previous.set(this.rest);this.velocity.fill(0);this.offsets.fill(0);this.release();this.time=0;this.accumulator=0;this.active=false;this.revision++;}
 setWind(value){if(!Number.isFinite(value)||value<0||value>1.5)throw Error('Invalid wind');this.wind=value;}
 setGrab(weights,t,target){
  if(weights.length!==85||!Number.isFinite(t)||target.length!==3||!target.every(Number.isFinite)||![...weights].every(v=>v>=0&&v<=1&&Number.isFinite(v)))throw Error('Invalid grab');
  this.brushWeights.set(weights);this.grabT=Math.max(.12,Math.min(1,t));
  const magnitude=Math.hypot(...target),limit=.09;
  this.grabTarget=target.map(v=>v*Math.min(1,limit/Math.max(magnitude,1e-12)));this.active=true;
 }
 setBrush(weights,direction,gain=1,t=.65){this.setGrab(weights,t,direction.map(v=>v*.004*gain));}
 release(){this.grabTarget=null;}
 impulse(){
  this.release();for(let g=0;g<85;g++)for(let n=2;n<NODES;n++){const w=Math.exp(-(this.positions[g*3]**2)/.00025),a=(g*NODES+n)*3,t=n/(NODES-1);this.velocity[a]+=.27*w*t*t;this.velocity[a+2]+=.05*w*t*t;}this.active=true;
 }
 sample(g,t){const v=Math.max(0,Math.min(NODES-1,t*(NODES-1))),n=Math.floor(v),f=v-n,a=(n*85+g)*4,b=(Math.min(NODES-1,n+1)*85+g)*4;return [0,1,2].map(k=>this.offsets[a+k]*(1-f)+this.offsets[b+k]*f);}
 advance(seconds){
  if(!Number.isFinite(seconds)||seconds<0)throw Error('Invalid dt');
  if(this.paused||(!this.enabled&&!this.active&&!this.grabTarget))return false;
  const start=performance.now(),accepted=Math.min(seconds,.05);this.accumulator+=accepted;this.droppedSeconds+=seconds-accepted;let changed=false;
  while(this.accumulator+1e-12>=DT){this.step();this.accumulator-=DT;changed=true;}
  if(changed){this.writeOffsets();this.revision++;}this.cpuMS=performance.now()-start;return changed;
 }
 step(){
  this.time+=DT;this.steps++;this.previous.set(this.q);const drag=Math.exp(-this.damping*DT);
  for(let g=0;g<85;g++)for(let n=2;n<NODES;n++){
   const a=(g*NODES+n)*3,t=n/(NODES-1),wind=this.enabled?this.wind:0;
   const forces=[wind*.62*(Math.sin(this.time*1.5)+.3*Math.sin(this.time*3.1+g*.11)),0,wind*.20*Math.sin(this.time*1.2+g*.04)];
   for(let k=0;k<3;k++){
    // The groom is a gravity-equilibrated rest pose; forces below perturb it.
    const force=forces[k]-(this.q[a+k]-this.rest[a+k])*(10+this.stiffness*50);
    this.velocity[a+k]=(this.velocity[a+k]+force*DT)*drag;this.q[a+k]+=this.velocity[a+k]*DT;
   }
  }
  for(let iteration=0;iteration<20;iteration++){
   for(let g=0;g<85;g++){
    const base=g*NODES*3;
    // Local rest curvature preserves a coherent groom without locking the tip.
    for(let n=2;n<NODES;n++){
     const a=base+n*3,b=a-3;
     const strength=.005+this.stiffness*.018;
     for(let k=0;k<3;k++){const difference=this.q[a+k]-this.q[b+k]-(this.rest[a+k]-this.rest[b+k]);this.q[a+k]-=difference*strength;if(n>2)this.q[b+k]+=difference*strength;}
    }
    if(this.grabTarget){
     const n=Math.max(2,Math.round(this.grabT*(NODES-1))),a=base+n*3,w=this.brushWeights[g]*.12;
     for(let k=0;k<3;k++)this.q[a+k]+=(this.rest[a+k]+this.grabTarget[k]-this.q[a+k])*w;
    }
    this.q.set(this.rest.subarray(base,base+6),base);
    // Alternating sweeps reduce direction bias. A final edge projection follows.
    for(let sweep=0;sweep<2;sweep++)for(let index=1;index<NODES;index++){
     const n=sweep===0?index:NODES-index,a=base+n*3,b=a-3;
     const dx=this.q[a]-this.q[b],dy=this.q[a+1]-this.q[b+1],dz=this.q[a+2]-this.q[b+2],l=Math.hypot(dx,dy,dz),rest=this.lengths[g*(NODES-1)+n-1];
     const wa=n<2?0:1,wb=n<3?0:1;if(wa+wb===0)continue;const f=(l-rest)/Math.max(l,1e-12)/(wa+wb);
     for(let k=0;k<3;k++){const d=k===0?dx:k===1?dy:dz;this.q[a+k]-=d*f*wa;this.q[b+k]+=d*f*wb;}
    }
   }
  }
  // Root-to-tip inextensible reconstruction: exact guide-edge lengths even
  // under a grab. The interaction target yields when geometrically unreachable.
  let peak=0;
  for(let g=0;g<85;g++)for(let n=2;n<NODES;n++){
   const a=(g*NODES+n)*3,b=a-3,l=Math.hypot(this.q[a]-this.q[b],this.q[a+1]-this.q[b+1],this.q[a+2]-this.q[b+2]),scale=this.lengths[g*(NODES-1)+n-1]/Math.max(l,1e-12);
   for(let k=0;k<3;k++){this.q[a+k]=this.q[b+k]+(this.q[a+k]-this.q[b+k])*scale;this.velocity[a+k]=(this.q[a+k]-this.previous[a+k])/DT;peak=Math.max(peak,Math.abs(this.velocity[a+k]),Math.abs(this.q[a+k]-this.rest[a+k]));}
  }
  this.active=peak>1e-6||!!this.grabTarget;
 }
 writeOffsets(){for(let g=0;g<85;g++)for(let n=0;n<NODES;n++){const a=(g*NODES+n)*3,b=(n*85+g)*4;for(let k=0;k<3;k++)this.offsets[b+k]=this.q[a+k]-this.rest[a+k];}}
 snapshot(){
  let maxOffset=0,maxVelocity=0,maxRelativeStretch=0,rootError=0,kineticEnergy=0;
  for(let g=0;g<85;g++)for(let n=0;n<NODES;n++){
   const a=(g*NODES+n)*3;maxOffset=Math.max(maxOffset,Math.hypot(...[0,1,2].map(k=>this.q[a+k]-this.rest[a+k])));
   for(let k=0;k<3;k++){maxVelocity=Math.max(maxVelocity,Math.abs(this.velocity[a+k]));kineticEnergy+=.5*this.velocity[a+k]**2;if(n<2)rootError=Math.max(rootError,Math.abs(this.q[a+k]-this.rest[a+k]));}
   if(n){const b=a-3,l=Math.hypot(...[0,1,2].map(k=>this.q[a+k]-this.q[b+k])),rest=this.lengths[g*(NODES-1)+n-1];maxRelativeStretch=Math.max(maxRelativeStretch,Math.abs(l/rest-1));}
  }
  return {model:'position-based guide chains, artist-authored equilibrium rest groom',guides:85,nodes:NODES,fixedStep:DT,rootPinned:true,rootError,maxRelativeStretch,maxOffset,maxVelocity,kineticEnergy,steps:this.steps,time:this.time,wind:this.wind,windEnabled:this.enabled,paused:this.paused,active:this.active,cpuMS:this.cpuMS,droppedSeconds:this.droppedSeconds,revision:this.revision};
 }
}
