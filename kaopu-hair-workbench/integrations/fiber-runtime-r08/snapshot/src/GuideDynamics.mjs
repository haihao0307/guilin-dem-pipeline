import {BundleFriction} from './BundleFriction.mjs';
import {matrixPoint} from './NativeHeadBinding.mjs';
import {airAt,exposureAt,guideMaterial} from './wind.mjs';
import {StrandDetailDynamics} from './detail-dynamics.mjs';
import {GUIDE_COUNT,NODES,NODE_POWER,STYLES,COUNT} from './Groom.mjs';
export {GUIDE_COUNT,NODES};export const DT=1/60;const BUNDLE_BEND_SCALE=4;const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
// Own XPBD guide solver. Gravity and linear rod curvature replace position springs.
// EI uses an authored effective bundle cohesion multiplier, not measured hair EI.
// Material values are engineering priors. Guide-bundle friction and ordered
// GPU display-strand contacts are separate from individual rod force simulation.
export class StrandDynamics {
 constructor(groom){
  this.groom=groom;this.binding=groom.binding;this.collisions=groom.collisions;const style=groom.style;
  const size=GUIDE_COUNT*NODES*3;for(const key of ['q','rest','previous','velocity','equilibrium','sleepReference'])this[key]=new Float64Array(size);
  this.anchors=new Float64Array(GUIDE_COUNT*6);this.offsets=new Float32Array(GUIDE_COUNT*NODES*4);this.frames=new Float32Array(this.offsets.length);this.positions=new Float64Array(GUIDE_COUNT*3);
  this.lengths=new Float64Array(GUIDE_COUNT*(NODES-1));this.restAngles=new Float64Array(GUIDE_COUNT*(NODES-2));this.invMass=new Float64Array(GUIDE_COUNT*NODES);this.bendLambda=new Float64Array(this.restAngles.length*3);this.restTurns=new Float64Array(this.restAngles.length*3);this.localBend=new Float64Array(this.restAngles.length*3);this.bendAlpha=new Float64Array(this.restAngles.length);
  this.bendDiag=new Float64Array(NODES);this.bendSub1=new Float64Array(NODES);this.bendSub2=new Float64Array(NODES);this.bendRhs=new Float64Array(NODES*3);this.bendIncrement=new Float64Array(NODES*3);this.bendRatio=new Float64Array(NODES);
  this.solveDiag=new Float64Array(NODES);this.solveOff=new Float64Array(NODES);this.solveRhs=new Float64Array(NODES);this.solveLambda=new Float64Array(NODES);this.solveDir=new Float64Array(NODES*3);
  for(const key of ['cacheD','cacheE','cacheF','cacheAlpha','cacheRatio'])this[key]=new Float64Array(GUIDE_COUNT*NODES);this.matrixStiffness=NaN;this.matrixBuilds=0;this.nodeParam=Float64Array.from({length:NODES},(_,n)=>(n/(NODES-1))**NODE_POWER);this.contactArcs=new Float64Array(GUIDE_COUNT*NODES);this.dragCoefficient=new Float64Array(GUIDE_COUNT*NODES);for(let g=0;g<GUIDE_COUNT;g++)for(let n=0;n<NODES;n++){const t=this.nodeParam[n];this.contactArcs[g*NODES+n]=groom.curves[g].length*t;this.dragCoefficient[g*NODES+n]=(2.1/guideMaterial(g))*(.35+.65*(.4+.45*Math.abs(groom.guides[g].n[0])+.15*t));}
  this.velocityScratch=[0,0,0];this.contactPoint=[0,0,0];this.contactCache=new Array(GUIDE_COUNT*NODES).fill(null);this.brushWeights=new Float32Array(GUIDE_COUNT);this.basisData=new Float32Array(81*4);
  Object.assign(this,{enabled:false,paused:false,active:false,wind:.38,stiffness:.5,damping:1.7,sway:false,rootShift:[0,0,0],rootAngle:0,time:0,accumulator:0,steps:0,revision:0,cpuMS:0,droppedSeconds:0,style,wave:1});this.bundleFriction=new BundleFriction(this);this.detail=new StrandDetailDynamics(groom);this.configure(style,1);
 }
 configure(style=this.style,wave=this.wave){
  if(!STYLES[style]||!Number.isFinite(wave)||wave<0||wave>1.4)throw Error('Invalid groom');this.style=style;this.wave=wave;this.matrixStiffness=NaN;this.anchorKey=null;this.sleepReferenceValid=false;
  for(let g=0;g<GUIDE_COUNT;g++){
   const local=this.groom.curves[g].points,p=new Float64Array(local.length);for(let n=0;n<NODES;n++)p.set(n<2?matrixPoint(this.binding.frame,[...local.subarray(n*3,n*3+3)]):this.collisions.projectWorld(matrixPoint(this.binding.frame,[...local.subarray(n*3,n*3+3)]),true,this.contactArcs[g*NODES+n],this.groom.guides[g].bodySide).p,n*3);this.rest.set(p,g*NODES*3);this.positions.set(p.subarray(0,3),g*3);
   for(let n=1;n<NODES;n++){const a=n*3,b=a-3;this.lengths[g*(NODES-1)+n-1]=Math.hypot(p[a]-p[b],p[a+1]-p[b+1],p[a+2]-p[b+2]);}
   for(let n=0;n<NODES;n++){const t=n/(NODES-1),d=70e-6*guideMaterial(g)*(1-.28*t),h=(this.lengths[g*(NODES-1)+Math.max(0,n-1)]+this.lengths[g*(NODES-1)+Math.min(NODES-2,n)])*.5,mass=1300*Math.PI*d*d*.25*h;this.invMass[g*NODES+n]=n<2?0:1/mass;}
   for(let n=1;n<NODES-1;n++){const a=n*3,b=a-3,c=a+3,l1=this.lengths[g*(NODES-1)+n-1],l2=this.lengths[g*(NODES-1)+n],cos=((p[a]-p[b])*(p[c]-p[a])+(p[a+1]-p[b+1])*(p[c+1]-p[a+1])+(p[a+2]-p[b+2])*(p[c+2]-p[a+2]))/(l1*l2);this.restAngles[g*(NODES-2)+n-1]=Math.acos(clamp(cos,-1,1));const t=(n/(NODES-1))**NODE_POWER,d=70e-6*guideMaterial(g)*(1-.28*t),EI=3e9*Math.PI*d**4/64*BUNDLE_BEND_SCALE,support=1+8*Math.exp(-this.groom.curves[g].length*t/.018);this.bendAlpha[g*(NODES-2)+n-1]=(l1+l2)*.5/(EI*support)/(DT*DT);}
  }
  // Linear rod curvature is expressed in the moving native head frame.
  // This consistent SPD curvature constraint avoids injecting energy through
  // an approximate Jacobian of a repeatedly reoriented large rest bend.
  const inv=this.binding.inverse.elements;
  for(let g=0;g<GUIDE_COUNT;g++)for(let n=1;n<NODES-1;n++){const a=(g*NODES+n)*3,b=a-3,c=a+3,ratio=this.lengths[g*(NODES-1)+n]/this.lengths[g*(NODES-1)+n-1],d=[0,1,2].map(k=>this.rest[c+k]-(1+ratio)*this.rest[a+k]+ratio*this.rest[b+k]),id=(g*(NODES-2)+n-1)*3;this.localBend.set([inv[0]*d[0]+inv[4]*d[1]+inv[8]*d[2],inv[1]*d[0]+inv[5]*d[1]+inv[9]*d[2],inv[2]*d[0]+inv[6]*d[1]+inv[10]*d[2]],id);}
  this.detail.reset();this.q.set(this.rest);this.velocity.fill(0);this.grabTarget=null;this.rootShift=[0,0,0];this.rootAngle=0;this.time=0;
  const old=[this.damping,this.sway,this.enabled];this.settling=true;this.damping=5;this.sway=false;this.enabled=false;for(let n=0;n<160;n++)this.step();[this.damping,this.sway,this.enabled]=old;this.settling=false;this.quietSteps=0;
  this.equilibrium.set(this.q);this.equilibriumFrame=this.binding.frame.clone();this.velocity.fill(0);this.time=0;this.steps=0;this.accumulator=0;this.active=false;this.revision++;this.writeOffsets();
 }
 reset(){this.detail.reset();this.binding.updateFrame();this.updateAnchors();const delta=this.binding.frame.clone().multiply(this.equilibriumFrame.clone().invert());for(let i=0;i<this.q.length;i+=3)this.q.set(matrixPoint(delta,[...this.equilibrium.subarray(i,i+3)]),i);for(let g=0;g<GUIDE_COUNT;g++)for(let n=0;n<2;n++)for(let k=0;k<3;k++)this.q[(g*NODES+n)*3+k]=this.anchor(g,n,k);this.velocity.fill(0);this.release();this.time=0;this.accumulator=0;this.active=false;this.rootShift=[0,0,0];this.rootAngle=0;this.sway=false;this.writeOffsets();this.revision++;}
 setWind(v){if(!Number.isFinite(v)||v<0||v>1.5)throw Error('Invalid wind');this.wind=v;}
 setGrab(weights,t,target){
  if(weights.length!==GUIDE_COUNT||!Number.isFinite(t)||target.length!==3||!target.every(Number.isFinite)||![...weights].every(v=>v>=0&&v<=1&&Number.isFinite(v)))throw Error('Invalid grab');
  this.brushWeights.set(weights);this.grabT=clamp(t,.08,1);const l=Math.hypot(...target),limit=STYLES[this.style].length*.5;this.grabTarget=target.map(v=>v*Math.min(1,limit/Math.max(l,1e-12)));if(!this.grabReference)this.grabReference=this.q.slice();this.active=true;
 }
 setBrush(w,d,gain=1,t=.65){this.setGrab(w,t,d.map(v=>v*.004*gain));}
 release(){this.grabTarget=null;this.grabReference=null;}
 impulse(){this.release();for(let g=0;g<GUIDE_COUNT;g++)for(let n=2;n<NODES;n++){const a=(g*NODES+n)*3,t=(n/(NODES-1))**NODE_POWER,w=Math.exp(-(this.positions[g*3]**2)/.0003);this.velocity[a]+=.32*w*Math.sin(Math.PI*t*.8);this.velocity[a+2]+=.12*w*t;}this.active=true;}
 sample(g,t){const f=clamp(t,0,1)**(1/NODE_POWER)*(NODES-1),a=Math.floor(f),b=Math.min(NODES-1,a+1),w=f-a;return [0,1,2].map(k=>this.q[(g*NODES+a)*3+k]*(1-w)+this.q[(g*NODES+b)*3+k]*w);}
 advance(seconds){
  if(!Number.isFinite(seconds)||seconds<0)throw Error('Invalid dt');if(this.paused||(!this.enabled&&!this.active&&!this.grabTarget&&!this.sway))return false;
  const start=performance.now(),accepted=Math.min(seconds,.1);this.accumulator+=accepted;this.droppedSeconds+=seconds-accepted;let changed=false;
  if(this.accumulator+1e-12>=DT){this.stepDT=Math.min(.1,this.accumulator);this.step();this.accumulator=0;changed=true;this.writeOffsets();this.revision++;}this.cpuMS=performance.now()-start;return changed;
 }

 updateAnchors(){const key=this.binding.nativeKey+'/'+this.binding.frameVersion;if(this.anchorKey===key)return;this.anchorKey=key;for(let g=0;g<GUIDE_COUNT;g++){const root=this.binding.rootWorld(this.groom.guides[g]),old=matrixPoint(this.binding.frame,this.groom.guides[g].p),next=matrixPoint(this.binding.frame,[...this.groom.curves[g].points.subarray(3,6)]);for(let k=0;k<3;k++){this.anchors[g*6+k]=root[k];this.anchors[g*6+3+k]=root[k]+next[k]-old[k];}}}
 anchor(g,n,k){return this.anchors[g*6+n*3+k];}
 projectContact(g){for(let n=2;n<NODES;n++){const a=(g*NODES+n)*3,result=this.collisions.projectWorld([this.q[a],this.q[a+1],this.q[a+2]],true,this.contactArcs[g*NODES+n],this.groom.guides[g].bodySide);if(result.contact)this.contactCache[g*NODES+n]=result.contact;if(result.changed)this.q.set(result.p,a);}}

 step(){
  const DT=this.stepDT||1/60;const clock=performance.now();this.constraintFallbacks=0;this.infeasibleConstraints=0;if(!this.settling)this.beforeStep?.(DT);this.collisions.update(DT);this.contactCache.fill(null);this.updateAnchors();const afterBinding=performance.now();this.time+=DT;this.steps++;this.previous.set(this.q);this.bendLambda.fill(0);
  if(this.sway){this.rootShift=[.008*Math.sin(this.time*3.1),.002*Math.sin(this.time*1.8),.003*Math.sin(this.time*2.2)];this.rootAngle=.09*Math.sin(this.time*3.1);}
  const damping=Math.exp(-this.damping*DT),air=this.airScratch||(this.airScratch=[0,0,0]),wind=this.enabled?this.wind:0;
  for(let g=0;g<GUIDE_COUNT;g++)for(let n=0;n<NODES;n++){
   const a=(g*NODES+n)*3;if(n<2){for(let k=0;k<3;k++)this.q[a+k]=this.anchor(g,n,k);continue;}
   if(wind)airAt(this.q[a],this.q[a+1],this.q[a+2],this.time,wind,air);else air[0]=air[1]=air[2]=0;
   const travel=this.binding.viewer.hairNativeMotion?.airVelocity;if(travel){air[0]+=travel[0];air[2]+=travel[2];}
   const b=a-3,dx=this.q[a]-this.q[b],dy=this.q[a+1]-this.q[b+1],dz=this.q[a+2]-this.q[b+2],l=Math.max(1e-12,Math.hypot(dx,dy,dz)),ux=dx/l,uy=dy/l,uz=dz/l,rx=air[0]-this.velocity[a],ry=air[1]-this.velocity[a+1],rz=air[2]-this.velocity[a+2],parallel=rx*ux+ry*uy+rz*uz,drag=this.dragCoefficient[g*NODES+n];
   this.velocity[a]=(this.velocity[a]+drag*(rx-.88*parallel*ux)*DT)*damping;this.velocity[a+1]=(this.velocity[a+1]+(-9.81+drag*(ry-.88*parallel*uy))*DT)*damping;this.velocity[a+2]=(this.velocity[a+2]+drag*(rz-.88*parallel*uz)*DT)*damping;this.q[a]+=this.velocity[a]*DT;this.q[a+1]+=this.velocity[a+1]*DT;this.q[a+2]+=this.velocity[a+2]*DT;
  }
  const afterIntegration=performance.now();for(let g=0;g<GUIDE_COUNT;g++)for(let n=2;n<NODES;n++){const a=(g*NODES+n)*3,dx=this.q[a]-this.previous[a],dy=this.q[a+1]-this.previous[a+1],dz=this.q[a+2]-this.previous[a+2];if(this.collisions.fastMotion||dx*dx+dy*dy+dz*dz>.000036)this.q.set(this.collisions.sweepWorld([...this.previous.subarray(a,a+3)],[...this.q.subarray(a,a+3)],this.contactArcs[g*NODES+n]),a);}
  const afterForces=performance.now();for(let iteration=0;iteration<(this.fastSolve?1:2);iteration++)for(let g=0;g<GUIDE_COUNT;g++){
   const base=g*NODES*3;
   this.projectBending(g);

   if(this.grabTarget){const center=Math.round(this.grabT**(1/NODE_POWER)*(NODES-1));for(let n=Math.max(2,center-2);n<=Math.min(NODES-1,center+2);n++){const a=base+n*3,fall=Math.exp(-(((n-center)/1.5)**2))*this.brushWeights[g]*.22;for(let k=0;k<3;k++)this.q[a+k]+=(this.grabReference[a+k]+this.grabTarget[k]-this.q[a+k])*fall;}}
   if(!this.fastSolve){this.projectContact(g);this.projectLengths(g,3);}

  }
  const afterSolves=performance.now();for(let g=0;g<GUIDE_COUNT;g++)this.projectChainContact(g);const afterChain=performance.now();
  let peak=0;
  for(let g=0;g<GUIDE_COUNT;g++)for(let n=2;n<NODES;n++){const a=(g*NODES+n)*3;const v=this.velocityScratch;for(let k=0;k<3;k++)v[k]=(this.q[a+k]-this.previous[a+k])/DT;this.collisions.resolveVelocity(null,v,this.contactArcs[g*NODES+n],this.contactCache[g*NODES+n]);for(let k=0;k<3;k++){this.velocity[a+k]=v[k];peak=Math.max(peak,Math.abs(v[k]));}}
  this.bundleFriction.solve(DT);
  const afterConstraints=performance.now();const motion=this.binding.viewer.hairNativeMotion;if(this.enabled||this.detail.peak>1e-7||motion?.active)this.detail.step(DT,this.time,this.enabled?this.wind:0,this.style,this.stiffness,this.damping,!this.settling&&motion?.active?motion.input:null);
  this.timings={binding:afterBinding-clock,integration:afterIntegration-afterBinding,sweep:afterForces-afterIntegration,solves:afterSolves-afterForces,chain:afterChain-afterSolves,friction:afterConstraints-afterChain,forces:afterForces-clock,constraints:afterConstraints-afterForces,detail:performance.now()-afterConstraints};this.active=peak>.0003||this.detail.peak>1e-6||!!this.grabTarget||this.sway;
  if(this.settling||this.enabled||this.grabTarget||this.sway||motion?.playing||this.collisions.propMode!=='off'){this.quietSteps=0;this.sleepReferenceValid=false;this.sleepPeakDrift=0;this.sleepPeakVelocity=0;}
  else if(!this.sleepReferenceValid){this.sleepReference.set(this.q);this.sleepReferenceValid=true;this.quietSteps=0;this.sleepPeakDrift=0;this.sleepPeakVelocity=peak;}
  else{let drift2=0;for(let i=0;i<this.q.length;i+=3){const dx=this.q[i]-this.sleepReference[i],dy=this.q[i+1]-this.sleepReference[i+1],dz=this.q[i+2]-this.sleepReference[i+2];drift2=Math.max(drift2,dx*dx+dy*dy+dz*dz);}this.sleepPeakDrift=Math.max(this.sleepPeakDrift||0,Math.sqrt(drift2));this.sleepPeakVelocity=Math.max(this.sleepPeakVelocity||0,peak);if(++this.quietSteps>=60){this.sleepDrift=this.sleepPeakDrift;const tolerance=this.style==='long'?.0030:.0020;if(this.sleepDrift<tolerance&&this.sleepPeakVelocity<.08&&this.detail.peak<1e-6){this.active=false;this.velocity.fill(0);}else{this.sleepReference.set(this.q);this.quietSteps=0;this.sleepPeakDrift=0;this.sleepPeakVelocity=0;}}}


 }
 prepareBendCache(){if(this.matrixStiffness===this.stiffness&&this.matrixDT===this.stepDT)return;this.matrixStiffness=this.stiffness;this.matrixDT=this.stepDT;this.matrixBuilds++;
  const D=this.cacheD,E=this.cacheE,F=this.cacheF,A=this.cacheAlpha,T=this.cacheRatio,last=NODES-2;
  for(let g=0;g<GUIDE_COUNT;g++){const off=g*NODES;for(let n=1;n<=last;n++){const l1=this.lengths[g*(NODES-1)+n-1],l2=this.lengths[g*(NODES-1)+n],ratio=l2/l1,id=g*(NODES-2)+n-1,alpha=this.bendAlpha[id]*l2*l2/(.45+this.stiffness*2)*(DT/(this.stepDT||DT))**2;T[off+n]=ratio;A[off+n]=alpha;D[off+n]=this.invMass[g*NODES+n-1]*ratio*ratio+this.invMass[g*NODES+n]*(1+ratio)**2+this.invMass[g*NODES+n+1]+alpha;}
   for(let n=1;n<=last;n++){const i=off+n,off1=n>1?-(this.invMass[g*NODES+n-1]*(1+T[i-1])*T[i]+this.invMass[g*NODES+n]*(1+T[i])):0,off2=n>2?this.invMass[g*NODES+n-1]*T[i]:0;F[i]=n>2?off2/D[i-2]:0;E[i]=n>1?(off1-F[i]*E[i-1])/D[i-1]:0;D[i]=Math.sqrt(Math.max(1e-8,D[i]-E[i]*E[i]-F[i]*F[i]));}}
 }
 projectBending(g){
  this.prepareBendCache();const base=g*NODES*3,off=g*NODES,D=this.cacheD,E=this.cacheE,F=this.cacheF,R=this.bendRhs,L=this.bendIncrement,ratios=this.bendRatio,last=NODES-2,frame=this.binding.frame.elements;
  for(let n=1;n<=last;n++){const a=base+n*3,b=a-3,c=a+3,ratio=this.cacheRatio[off+n],j=(g*(NODES-2)+n-1)*3,alpha=this.cacheAlpha[off+n],lx=this.localBend[j],ly=this.localBend[j+1],lz=this.localBend[j+2];ratios[n]=ratio;R[n*3]=-(this.q[c]-(1+ratio)*this.q[a]+ratio*this.q[b]-(frame[0]*lx+frame[4]*ly+frame[8]*lz))-alpha*this.bendLambda[j];R[n*3+1]=-(this.q[c+1]-(1+ratio)*this.q[a+1]+ratio*this.q[b+1]-(frame[1]*lx+frame[5]*ly+frame[9]*lz))-alpha*this.bendLambda[j+1];R[n*3+2]=-(this.q[c+2]-(1+ratio)*this.q[a+2]+ratio*this.q[b+2]-(frame[2]*lx+frame[6]*ly+frame[10]*lz))-alpha*this.bendLambda[j+2];}
  for(let n=1;n<=last;n++)for(let k=0;k<3;k++)R[n*3+k]=(R[n*3+k]-(n>1?E[off+n]*R[(n-1)*3+k]:0)-(n>2?F[off+n]*R[(n-2)*3+k]:0))/D[off+n];
  for(let n=last;n>=1;n--)for(let k=0;k<3;k++)L[n*3+k]=(R[n*3+k]-(n<last?E[off+n+1]*L[(n+1)*3+k]:0)-(n<last-1?F[off+n+2]*L[(n+2)*3+k]:0))/D[off+n];
  for(let n=1;n<=last;n++)for(let k=0;k<3;k++){L[n*3+k]*=.60;this.bendLambda[(g*(NODES-2)+n-1)*3+k]+=L[n*3+k];}
  for(let n=2;n<NODES;n++){
   const a=base+n*3,w=this.invMass[g*NODES+n];
   for(let k=0;k<3;k++)this.q[a+k]+=w*(L[(n-1)*3+k]-(n<=last?(1+ratios[n])*L[n*3+k]:0)+(n<last?ratios[n+1]*L[(n+1)*3+k]:0));
  }
 }
 // Forward constraint sweep: keep each solved parent fixed while intersecting
 // the segment-length sphere with the native collision approximation.
 projectChainContact(g){const p=this.contactPoint;for(let n=2;n<NODES;n++){const a=(g*NODES+n)*3,b=a-3,rest=this.lengths[g*(NODES-1)+n-1];let lastNormal=null,clearResult=false;for(let pass=0;pass<12;pass++){let dx=this.q[a]-this.q[b],dy=this.q[a+1]-this.q[b+1],dz=this.q[a+2]-this.q[b+2],len=Math.hypot(dx,dy,dz);if(len<1e-10){dx=0;dy=-1;dz=0;len=1;}const ux=dx/len,uy=dy/len,uz=dz/len;p[0]=this.q[b]+ux*rest;p[1]=this.q[b+1]+uy*rest;p[2]=this.q[b+2]+uz*rest;let result=this.collisions.projectWorld(p,true,this.contactArcs[g*NODES+n]);if(result.contact)this.contactCache[g*NODES+n]=result.contact;
 // Intersect the length sphere with the contact tangent half-space directly.
 // Alternating radial projection alone can converge very slowly at grazing contact.
 if(result.changed&&result.contact){const N=this.collisions.worldNormal(result.contact),h=(this.q[b]-result.p[0])*N[0]+(this.q[b+1]-result.p[1])*N[1]+(this.q[b+2]-result.p[2])*N[2];lastNormal=N;if(h>-rest+.000001){const along=ux*N[0]+uy*N[1]+uz*N[2],cos=Math.min(1,Math.max(along,(-h+.000015)/rest)),tx=ux-N[0]*along,ty=uy-N[1]*along,tz=uz-N[2]*along,tl=Math.hypot(tx,ty,tz);if(tl>1e-8){const side=rest*Math.sqrt(Math.max(0,1-cos*cos))/tl;p[0]=this.q[b]+N[0]*rest*cos+tx*side;p[1]=this.q[b+1]+N[1]*rest*cos+ty*side;p[2]=this.q[b+2]+N[2]*rest*cos+tz*side;result=this.collisions.projectWorld(p,true,this.contactArcs[g*NODES+n]);if(result.contact)this.contactCache[g*NODES+n]=result.contact;}}}
 this.q.set(result.p,a);clearResult=!result.changed;if(Math.abs(Math.hypot(this.q[a]-this.q[b],this.q[a+1]-this.q[b+1],this.q[a+2]-this.q[b+2])/rest-1)<.001&&(!result.changed||this.collisions.penetration([this.q[a],this.q[a+1],this.q[a+2]],this.contactArcs[g*NODES+n])<.00010))break;}
 let len=Math.hypot(this.q[a]-this.q[b],this.q[a+1]-this.q[b+1],this.q[a+2]-this.q[b+2]);if(Math.abs(len/rest-1)>.005||(!clearResult&&this.collisions.penetration([this.q[a],this.q[a+1],this.q[a+2]],this.contactArcs[g*NODES+n])>.00015)){const target=[(this.q[a]-this.q[b])/len,(this.q[a+1]-this.q[b+1])/len,(this.q[a+2]-this.q[b+2])/len],candidates=[lastNormal||target,[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]],previous=[this.q[b]-this.q[b-3],this.q[b+1]-this.q[b-2],this.q[b+2]-this.q[b-1]];candidates.push(previous);for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++)if(x||y||z)candidates.push([x,y,z]);let best=-Infinity,winner=null;for(const D of candidates){const L=Math.hypot(...D)||1,unit=D.map(x=>x/L),candidate=unit.map((x,k)=>this.q[b+k]+x*rest),r=this.collisions.projectWorld(candidate,true,this.contactArcs[g*NODES+n]),score=unit[0]*target[0]+unit[1]*target[1]+unit[2]*target[2];if(!r.changed&&score>best){best=score;winner=candidate;}}if(winner){this.q.set(winner,a);this.constraintFallbacks=(this.constraintFallbacks||0)+1;}else this.infeasibleConstraints=(this.infeasibleConstraints||0)+1;}
 }}


 projectLengths(g,passes=3){
  const base=g*NODES*3,D=this.solveDiag,U=this.solveOff,R=this.solveRhs,L=this.solveLambda,T=this.solveDir;
  for(let pass=0;pass<passes;pass++){
   for(let n=2;n<NODES;n++){
    const a=base+n*3,b=a-3,dx=this.q[a]-this.q[b],dy=this.q[a+1]-this.q[b+1],dz=this.q[a+2]-this.q[b+2],length=Math.max(1e-12,Math.sqrt(dx*dx+dy*dy+dz*dz));
    T[n*3]=dx/length;T[n*3+1]=dy/length;T[n*3+2]=dz/length;
    D[n]=this.invMass[g*NODES+n-1]+this.invMass[g*NODES+n];R[n]=this.lengths[g*(NODES-1)+n-1]-length;
   }
   for(let n=2;n<NODES-1;n++)U[n]=-this.invMass[g*NODES+n]*(T[n*3]*T[(n+1)*3]+T[n*3+1]*T[(n+1)*3+1]+T[n*3+2]*T[(n+1)*3+2]);
   for(let n=3;n<NODES;n++){const factor=U[n-1]/D[n-1];D[n]-=factor*U[n-1];R[n]-=factor*R[n-1];}
   L[NODES-1]=R[NODES-1]/D[NODES-1];for(let n=NODES-2;n>=2;n--)L[n]=(R[n]-U[n]*L[n+1])/D[n];
   for(let n=2;n<NODES;n++){const a=base+n*3,w=this.invMass[g*NODES+n];for(let k=0;k<3;k++)this.q[a+k]+=.75*w*(T[n*3+k]*L[n]-(n<NODES-1?T[(n+1)*3+k]*L[n+1]:0));}
  }
 }
 writeOffsets(){
  this.detail.write();
  for(let g=0;g<GUIDE_COUNT;g++){let normal=[this.binding.frame.elements[0],this.binding.frame.elements[1],this.binding.frame.elements[2]];for(let n=0;n<NODES;n++){const a=(g*NODES+n)*3,b=(n*GUIDE_COUNT+g)*4,prev=(g*NODES+Math.max(0,n-1))*3,next=(g*NODES+Math.min(NODES-1,n+1))*3,t=[this.q[next]-this.q[prev],this.q[next+1]-this.q[prev+1],this.q[next+2]-this.q[prev+2]],l=Math.hypot(...t);for(let k=0;k<3;k++)t[k]/=l;const dot=normal[0]*t[0]+normal[1]*t[1]+normal[2]*t[2];normal=normal.map((v,k)=>v-dot*t[k]);let norm=Math.hypot(...normal);if(norm<1e-8){normal=[-t[2],0,t[0]];norm=Math.hypot(...normal);}normal=normal.map(v=>v/norm);for(let k=0;k<3;k++){this.offsets[b+k]=this.q[a+k];this.frames[b+k]=normal[k];}this.offsets[b+3]=1;}}
 }
 snapshot(){
  let maxOffset=0,maxVelocity=0,maxRelativeStretch=0,rootError=0,kineticEnergy=0,tipSpeed=0,maxPenetration=0;
  for(let g=0;g<GUIDE_COUNT;g++)for(let n=0;n<NODES;n++){const a=(g*NODES+n)*3;maxOffset=Math.max(maxOffset,Math.hypot(this.q[a]-this.equilibrium[a],this.q[a+1]-this.equilibrium[a+1],this.q[a+2]-this.equilibrium[a+2]));for(let k=0;k<3;k++){maxVelocity=Math.max(maxVelocity,Math.abs(this.velocity[a+k]));if(n>1)kineticEnergy+=.5*this.velocity[a+k]**2/this.invMass[g*NODES+n];else rootError=Math.max(rootError,Math.abs(this.q[a+k]-this.anchor(g,n,k)));}if(n){const b=a-3,ratio=Math.hypot(this.q[a]-this.q[b],this.q[a+1]-this.q[b+1],this.q[a+2]-this.q[b+2])/this.lengths[g*(NODES-1)+n-1];maxRelativeStretch=Math.max(maxRelativeStretch,Math.abs(ratio-1));}if(n>1)maxPenetration=Math.max(maxPenetration,this.collisions.penetration([...this.q.subarray(a,a+3)],this.contactArcs[g*NODES+n]));if(n===NODES-1)tipSpeed=Math.max(tipSpeed,Math.hypot(this.velocity[a],this.velocity[a+1],this.velocity[a+2]));}
  return {constraintFallbacks:this.constraintFallbacks||0,infeasibleConstraints:this.infeasibleConstraints||0,maxPenetration,bundleContact:this.bundleFriction.report(),contactFriction:this.collisions.friction,matrixBuilds:this.matrixBuilds,quietSteps:this.quietSteps||0,sleepDrift:this.sleepDrift||0,timings:this.timings,detailModes:COUNT*2,detailPeakMetres:this.detail.peak,airModel:'advected spatial field, transverse drag and exposure approximation',model:'gravity + XPBD head-frame linear rod curvature + chain length/contact intersections',style:this.style,nominalLength:STYLES[this.style].length,guides:GUIDE_COUNT,nodes:NODES,nominalStep:DT,actualStep:this.stepDT||DT,workQuality:this.workQuality||1,solverMode:this.fastSolve?'single implicit bend and rooted length/contact sweep':'two coupled bend/contact/length iterations',rootPinned:true,rootError,maxRelativeStretch,maxOffset,maxVelocity,tipSpeed,kineticEnergy,steps:this.steps,time:this.time,wind:this.wind,windEnabled:this.enabled,paused:this.paused,active:this.active,cpuMS:this.cpuMS,droppedSeconds:this.droppedSeconds,revision:this.revision,rootSway:this.sway,stiffness:this.stiffness,damping:this.damping};
 }
}
