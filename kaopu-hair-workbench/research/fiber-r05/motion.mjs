/** R05 reduced bending response. Fur R02 supplies first-mode spring/forcing precedent.
 * Three clamped/free beam basis functions, not a full inextensible rod/contact solver.
 * Modal stiffness is artist calibrated for this swatch; not measured biological EI.
 */
export const GUIDE_COUNT=85;
export const MODE_COUNT=3;
export const BETAS=[1.875104068711961,4.694091132974175,7.854757438237612];
export function basis(t,m){
 if(!Number.isFinite(t)||t<0||t>1||!Number.isInteger(m)||m<0||m>2)throw Error('Invalid modal coordinate');
 const b=BETAS[m],s=(Math.cosh(b)+Math.cos(b))/(Math.sinh(b)+Math.sin(b));
 const f=x=>Math.cosh(b*x)-Math.cos(b*x)-s*(Math.sinh(b*x)-Math.sin(b*x));
 return f(t)/f(1);
}
export class FurGuideMotion {
 constructor(){
  this.offsets=new Float32Array(85*3*4);this.velocity=new Float64Array(85*3*3);this.positions=new Float64Array(85*3);
  this.phase=new Float64Array(85);this.brushWeights=new Float32Array(85);this.direction=[0,0,0];this.brushGain=0;this.brushT=.65;this.grabTarget=null;
  this.wind=.38;this.enabled=false;this.paused=false;this.time=0;this.accumulator=0;this.steps=0;this.droppedSeconds=0;this.cpuMS=0;this.active=false;this.revision=0;
  this.basisData=new Float32Array(81*4);this.mass=new Float64Array(3);this.load=new Float64Array(3);this.integrators=[];
  for(let j=0;j<5;j++)for(let i=0;i<17;i++){const n=j*17+i;this.positions.set([-.031+.062*i/16,.128,-.006+.012*j/4],n*3);this.phase[n]=((n*.61803398875)%1)*Math.PI*2;}
  for(let n=0;n<=80;n++)for(let m=0;m<3;m++){const f=basis(n/80,m),w=(n===0||n===80)?.5:1;this.basisData[n*4+m]=f;this.mass[m]+=w*f*f/80;this.load[m]+=w*f/80;}
  for(let m=0;m<3;m++)for(let i=0;i<85;i++){
   const lengthScale=.91+.09*(.5+.5*Math.sin(this.phase[i])),k=33*Math.pow(BETAS[m]/BETAS[0],4)/Math.pow(lengthScale,4);
   const zeta=m===0?.55:.18,c=2*zeta*Math.sqrt(k),a=c/2,w=Math.sqrt(k-a*a),dt=1/120;
   this.integrators[m*85+i]={k,a,w,e:Math.exp(-a*dt),cos:Math.cos(w*dt),sin:Math.sin(w*dt)};
  }
 }
 sample(i,t){
  const n=Math.max(0,Math.min(80,t*80)),lo=Math.floor(n),hi=Math.min(80,lo+1),f=n-lo,out=[0,0,0];
  for(let m=0;m<3;m++){const b=this.basisData[lo*4+m]*(1-f)+this.basisData[hi*4+m]*f;for(let k=0;k<3;k++)out[k]+=this.offsets[(m*85+i)*4+k]*b;}return out;
 }
 setWind(v){if(!Number.isFinite(v)||v<0||v>1.5)throw Error('Invalid wind');this.wind=v;}
 setBrush(weights,direction,gain=1,t=.65){
  if(weights.length!==85||direction.length!==3||!direction.every(Number.isFinite)||!Number.isFinite(gain)||gain<0||gain>1||!Number.isFinite(t))throw Error('Invalid brush');
  for(const w of weights)if(!Number.isFinite(w)||w<0||w>1)throw Error('Invalid influence');
  this.brushWeights.set(weights);this.direction=direction.slice();this.brushGain=gain;this.brushT=Math.max(.08,Math.min(1,t));this.grabTarget=null;this.active=true;
 }
 setGrab(weights,t,target){this.setBrush(weights,[0,0,0],1,t);if(target.length!==3||!target.every(Number.isFinite))throw Error('Invalid grab');const l=Math.hypot(...target),s=Math.min(1,.045/Math.max(l,1e-12));this.grabTarget=target.map(v=>v*s);}
 impulse(){this.release();for(let i=0;i<85;i++){const f=Math.exp(-(this.positions[i*3]**2)/.0001);for(let m=0;m<3;m++){const a=basis(.72,m)/this.mass[m];this.velocity[(m*85+i)*3]+=.07*f*a;this.velocity[(m*85+i)*3+2]+=.022*f*a;}}this.active=true;}
 release(){this.brushGain=0;this.grabTarget=null;}
 reset(){this.offsets.fill(0);this.velocity.fill(0);this.release();this.accumulator=0;this.active=false;this.time=0;this.revision++;}
 advance(seconds){
  if(!Number.isFinite(seconds)||seconds<0)throw Error('Invalid dt');
  if(this.paused||(!this.enabled&&!this.active&&this.brushGain===0))return false;
  const start=performance.now(),accepted=Math.min(seconds,.05);this.droppedSeconds+=seconds-accepted;this.accumulator+=accepted;let changed=false;
  while(this.accumulator+1e-12>=1/120){this.step();this.accumulator-=1/120;changed=true;}
  if(changed)this.revision++;this.cpuMS=performance.now()-start;return changed;
 }
 step(){
  this.time+=1/120;this.steps++;let peak=0;const b=[basis(this.brushT,0),basis(this.brushT,1),basis(this.brushT,2)];
  for(let i=0;i<85;i++){
   const q=i*3,w=this.enabled?this.wind:0;
   const fx=(Math.sin(this.time*1.6+this.positions[q+1]*3.3)+.36*Math.sin(this.time*3.1+this.phase[i]))*w*.50;
   const fz=(Math.sin(this.time*1.2+this.positions[q]*4.2)+.16*Math.sin(this.time*2.7+this.phase[i]))*w*.18;
   const displacement=[0,0,0],speed=[0,0,0];
   for(let m=0;m<3;m++)for(let k=0;k<3;k++){displacement[k]+=this.offsets[(m*85+i)*4+k]*b[m];speed[k]+=this.velocity[(m*85+i)*3+k]*b[m];}
   for(let m=0;m<3;m++){
    const id=m*85+i,o=id*4,v=id*3,z=this.integrators[id];
    for(let k=0;k<3;k++){
     let force=(k===0?fx:k===2?fz:0)*this.load[m]/this.mass[m];
     const interaction=this.grabTarget?95*(this.grabTarget[k]-displacement[k])-5*speed[k]:this.direction[k]*.27;
     force+=interaction*this.brushWeights[i]*this.brushGain*b[m]/this.mass[m];
     const equilibrium=force/z.k,x=this.offsets[o+k]-equilibrium,vel=this.velocity[v+k];
     this.offsets[o+k]=equilibrium+z.e*(x*z.cos+(vel+z.a*x)*z.sin/z.w);
     this.velocity[v+k]=z.e*(vel*z.cos-(z.a*vel+z.k*x)*z.sin/z.w);
    }
   }
   // Bound the entire sum, not just its endpoint; no collision claim.
   let envelope=0;for(let m=0;m<3;m++){const o=(m*85+i)*4;envelope+=Math.hypot(this.offsets[o],this.offsets[o+1],this.offsets[o+2]);}
   if(envelope>.040){const scale=.040/envelope;for(let m=0;m<3;m++)for(let k=0;k<3;k++){this.offsets[(m*85+i)*4+k]*=scale;this.velocity[(m*85+i)*3+k]*=scale;}}
   for(let m=0;m<3;m++)for(let k=0;k<3;k++)peak=Math.max(peak,Math.abs(this.offsets[(m*85+i)*4+k]),Math.abs(this.velocity[(m*85+i)*3+k])*.1);
  }
  this.active=peak>1e-7||this.brushGain>0;if(!this.enabled&&!this.active){this.offsets.fill(0);this.velocity.fill(0);}
 }
 snapshot(){
  let maxOffset=0,maxVelocity=0,modalEnergy=[0,0,0];
  for(let i=0;i<85;i++){let bound=0;for(let m=0;m<3;m++){const id=m*85+i,o=id*4,v=id*3;bound+=Math.hypot(this.offsets[o],this.offsets[o+1],this.offsets[o+2]);for(let k=0;k<3;k++){maxVelocity=Math.max(maxVelocity,Math.abs(this.velocity[v+k]));modalEnergy[m]+=.5*(this.velocity[v+k]**2+this.integrators[id].k*this.offsets[o+k]**2);}}maxOffset=Math.max(maxOffset,bound);}
  return {model:'three-mode reduced bending; not inextensible rod/contact',guides:85,modes:3,fixedStep:1/120,stiffness:33,rootPinned:true,maxOffset,maxVelocity,modalEnergy,steps:this.steps,time:this.time,wind:this.wind,windEnabled:this.enabled,paused:this.paused,active:this.active,cpuMS:this.cpuMS,droppedSeconds:this.droppedSeconds,revision:this.revision};
 }
}
