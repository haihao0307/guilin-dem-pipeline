import {airAt,exposureAt,guideMaterial} from './wind.mjs';
import {StrandDetailDynamics} from './detail-dynamics.mjs';
import {GUIDE_COUNT,NODES,NODE_POWER,guideRest,STYLES} from './specimen.mjs';
export {GUIDE_COUNT,NODES};export const DT=1/120;const BUNDLE_BEND_SCALE=3;const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
// Own XPBD guide solver. Gravity and angular compliance replace position springs.
// EI uses an authored effective bundle cohesion multiplier, not measured hair EI.
// Material values are engineering priors; no per-fiber contact is implemented.
export class StrandDynamics {
 constructor(style='medium'){
  const size=GUIDE_COUNT*NODES*3;for(const key of ['q','rest','previous','velocity','equilibrium'])this[key]=new Float64Array(size);
  this.offsets=new Float32Array(GUIDE_COUNT*NODES*4);this.frames=new Float32Array(this.offsets.length);this.positions=new Float64Array(GUIDE_COUNT*3);
  this.lengths=new Float64Array(GUIDE_COUNT*(NODES-1));this.restAngles=new Float64Array(GUIDE_COUNT*(NODES-2));this.invMass=new Float64Array(GUIDE_COUNT*NODES);this.bendLambda=new Float64Array(this.restAngles.length*3);this.restTurns=new Float64Array(this.restAngles.length*3);this.bendAlpha=new Float64Array(this.restAngles.length);
  this.bendDiag=new Float64Array(NODES);this.bendSub1=new Float64Array(NODES);this.bendSub2=new Float64Array(NODES);this.bendRhs=new Float64Array(NODES*3);this.bendIncrement=new Float64Array(NODES*3);this.bendRatio=new Float64Array(NODES);
  this.solveDiag=new Float64Array(NODES);this.solveOff=new Float64Array(NODES);this.solveRhs=new Float64Array(NODES);this.solveLambda=new Float64Array(NODES);this.solveDir=new Float64Array(NODES*3);
  this.brushWeights=new Float32Array(GUIDE_COUNT);this.basisData=new Float32Array(81*4);
  Object.assign(this,{enabled:false,paused:false,active:false,wind:.38,stiffness:.5,damping:1.7,sway:false,rootShift:[0,0,0],rootAngle:0,time:0,accumulator:0,steps:0,revision:0,cpuMS:0,droppedSeconds:0,style,wave:1});this.detail=new StrandDetailDynamics();this.configure(style,1);
 }
 configure(style=this.style,wave=this.wave){
  if(!STYLES[style]||!Number.isFinite(wave)||wave<0||wave>1.4)throw Error('Invalid groom');this.style=style;this.wave=wave;
  for(let g=0;g<GUIDE_COUNT;g++){
   const p=guideRest(g,style,wave);this.rest.set(p,g*NODES*3);this.positions.set(p.subarray(0,3),g*3);
   for(let n=1;n<NODES;n++){const a=n*3,b=a-3;this.lengths[g*(NODES-1)+n-1]=Math.hypot(p[a]-p[b],p[a+1]-p[b+1],p[a+2]-p[b+2]);}
   for(let n=0;n<NODES;n++){const t=n/(NODES-1),d=70e-6*guideMaterial(g)*(1-.28*t),h=(this.lengths[g*(NODES-1)+Math.max(0,n-1)]+this.lengths[g*(NODES-1)+Math.min(NODES-2,n)])*.5,mass=1300*Math.PI*d*d*.25*h;this.invMass[g*NODES+n]=n<2?0:1/mass;}
   for(let n=1;n<NODES-1;n++){const a=n*3,b=a-3,c=a+3,l1=this.lengths[g*(NODES-1)+n-1],l2=this.lengths[g*(NODES-1)+n],cos=((p[a]-p[b])*(p[c]-p[a])+(p[a+1]-p[b+1])*(p[c+1]-p[a+1])+(p[a+2]-p[b+2])*(p[c+2]-p[a+2]))/(l1*l2);this.restAngles[g*(NODES-2)+n-1]=Math.acos(clamp(cos,-1,1));const t=(n/(NODES-1))**NODE_POWER,d=70e-6*guideMaterial(g)*(1-.28*t),EI=3e9*Math.PI*d**4/64*BUNDLE_BEND_SCALE,support=1+8*Math.exp(-STYLES[style].length*t/.018);this.bendAlpha[g*(NODES-2)+n-1]=(l1+l2)*.5/(EI*support)/(DT*DT);}
  }
  // Store intrinsic turn direction in the follicle-anchored transported frame.
  for(let g=0;g<85;g++){
   let nx=1,ny=0,nz=0;
   for(let n=1;n<NODES-1;n++){
    const a=(g*NODES+n)*3,b=a-3,c=a+3,l1=this.lengths[g*(NODES-1)+n-1],l2=this.lengths[g*(NODES-1)+n];
    const tx=(this.rest[a]-this.rest[b])/l1,ty=(this.rest[a+1]-this.rest[b+1])/l1,tz=(this.rest[a+2]-this.rest[b+2])/l1,dot=nx*tx+ny*ty+nz*tz;
    nx-=dot*tx;ny-=dot*ty;nz-=dot*tz;const norm=Math.hypot(nx,ny,nz);nx/=norm;ny/=norm;nz/=norm;
    const bx=ty*nz-tz*ny,by=tz*nx-tx*nz,bz=tx*ny-ty*nx,vx=(this.rest[c]-this.rest[a])/l2,vy=(this.rest[c+1]-this.rest[a+1])/l2,vz=(this.rest[c+2]-this.rest[a+2])/l2,id=(g*(NODES-2)+n-1)*3;
    this.restTurns[id]=vx*tx+vy*ty+vz*tz;this.restTurns[id+1]=vx*nx+vy*ny+vz*nz;this.restTurns[id+2]=vx*bx+vy*by+vz*bz;
   }
  }
  this.detail.reset();this.q.set(this.rest);this.velocity.fill(0);this.grabTarget=null;this.rootShift=[0,0,0];this.rootAngle=0;this.time=0;
  const old=[this.damping,this.sway,this.enabled];this.damping=5;this.sway=false;this.enabled=false;for(let n=0;n<300;n++)this.step();[this.damping,this.sway,this.enabled]=old;
  this.equilibrium.set(this.q);this.velocity.fill(0);this.time=0;this.steps=0;this.accumulator=0;this.active=false;this.revision++;this.writeOffsets();
 }
 reset(){this.detail.reset();this.q.set(this.equilibrium);this.velocity.fill(0);this.release();this.time=0;this.accumulator=0;this.active=false;this.rootShift=[0,0,0];this.rootAngle=0;this.sway=false;this.writeOffsets();this.revision++;}
 setWind(v){if(!Number.isFinite(v)||v<0||v>1.5)throw Error('Invalid wind');this.wind=v;}
 setGrab(weights,t,target){
  if(weights.length!==85||!Number.isFinite(t)||target.length!==3||!target.every(Number.isFinite)||![...weights].every(v=>v>=0&&v<=1&&Number.isFinite(v)))throw Error('Invalid grab');
  this.brushWeights.set(weights);this.grabT=clamp(t,.08,1);const l=Math.hypot(...target),limit=STYLES[this.style].length*.5;this.grabTarget=target.map(v=>v*Math.min(1,limit/Math.max(l,1e-12)));if(!this.grabReference)this.grabReference=this.q.slice();this.active=true;
 }
 setBrush(w,d,gain=1,t=.65){this.setGrab(w,t,d.map(v=>v*.004*gain));}
 release(){this.grabTarget=null;this.grabReference=null;}
 impulse(){this.release();for(let g=0;g<85;g++)for(let n=2;n<NODES;n++){const a=(g*NODES+n)*3,t=(n/(NODES-1))**NODE_POWER,w=Math.exp(-(this.positions[g*3]**2)/.0003);this.velocity[a]+=.32*w*Math.sin(Math.PI*t*.8);this.velocity[a+2]+=.12*w*t;}this.active=true;}
 sample(g,t){const f=clamp(t,0,1)**(1/NODE_POWER)*(NODES-1),a=Math.floor(f),b=Math.min(NODES-1,a+1),w=f-a;return [0,1,2].map(k=>this.q[(g*NODES+a)*3+k]*(1-w)+this.q[(g*NODES+b)*3+k]*w);}
 advance(seconds){
  if(!Number.isFinite(seconds)||seconds<0)throw Error('Invalid dt');if(this.paused||(!this.enabled&&!this.active&&!this.grabTarget&&!this.sway))return false;
  const start=performance.now(),accepted=Math.min(seconds,.05);this.accumulator+=accepted;this.droppedSeconds+=seconds-accepted;let changed=false;
  while(this.accumulator+1e-12>=DT){this.step();this.accumulator-=DT;changed=true;if(!this.enabled&&!this.active&&!this.grabTarget&&!this.sway){this.accumulator=0;break;}}if(changed){this.writeOffsets();this.revision++;}this.cpuMS=performance.now()-start;return changed;
 }
 anchor(g,n,k){const a=(g*NODES+n)*3,x=this.rest[a],y=this.rest[a+1]-STYLES[this.style].rootY,z=this.rest[a+2],c=Math.cos(this.rootAngle),s=Math.sin(this.rootAngle);return (k===0?c*x-s*y:k===1?s*x+c*y+STYLES[this.style].rootY:z)+this.rootShift[k];}
 step(){
  this.time+=DT;this.steps++;this.previous.set(this.q);this.bendLambda.fill(0);
  if(this.sway){this.rootShift=[.008*Math.sin(this.time*3.1),.002*Math.sin(this.time*1.8),.003*Math.sin(this.time*2.2)];this.rootAngle=.09*Math.sin(this.time*3.1);}
  for(let g=0;g<85;g++)for(let n=0;n<NODES;n++){
   const a=(g*NODES+n)*3;if(n<2){for(let k=0;k<3;k++)this.q[a+k]=this.anchor(g,n,k);continue;}
   const w=this.enabled?this.wind:0,t=(n/(NODES-1))**NODE_POWER,air=airAt(this.q[a],this.q[a+1],this.q[a+2],this.time,w),exposed=exposureAt(this.positions[g*3],this.positions[g*3+2],t);
   const b=a-3,dx=this.q[a]-this.q[b],dy=this.q[a+1]-this.q[b+1],dz=this.q[a+2]-this.q[b+2],l=Math.max(1e-12,Math.hypot(dx,dy,dz)),u=[dx/l,dy/l,dz/l],relative=air.map((v,k)=>v-this.velocity[a+k]),parallel=relative[0]*u[0]+relative[1]*u[1]+relative[2]*u[2],damping=Math.exp(-this.damping*DT);
   for(let k=0;k<3;k++){const force=(k===1?-9.81:0)+(2.8/guideMaterial(g))*(.35+.65*exposed)*(relative[k]-.88*parallel*u[k]);this.velocity[a+k]=(this.velocity[a+k]+force*DT)*damping;this.q[a+k]+=this.velocity[a+k]*DT;}
  }
  for(let iteration=0;iteration<4;iteration++)for(let g=0;g<85;g++){
   const base=g*NODES*3;
   this.projectBending(g);

   if(this.grabTarget){const center=Math.round(this.grabT**(1/NODE_POWER)*(NODES-1));for(let n=Math.max(2,center-2);n<=Math.min(NODES-1,center+2);n++){const a=base+n*3,fall=Math.exp(-(((n-center)/1.5)**2))*this.brushWeights[g]*.22;for(let k=0;k<3;k++)this.q[a+k]+=(this.grabReference[a+k]+this.grabTarget[k]-this.q[a+k])*fall;}}
   this.projectLengths(g,4);

  }
  for(let g=0;g<85;g++)this.projectLengths(g,6);
  let peak=0;
  for(let g=0;g<85;g++)for(let n=2;n<NODES;n++){const a=(g*NODES+n)*3;for(let k=0;k<3;k++){this.velocity[a+k]=(this.q[a+k]-this.previous[a+k])/DT;peak=Math.max(peak,Math.abs(this.velocity[a+k]));}}
  if(this.enabled||this.detail.peak>1e-7)this.detail.step(DT,this.time,this.enabled?this.wind:0,this.style,this.stiffness,this.damping);
  this.active=peak>.0003||this.detail.peak>1e-6||!!this.grabTarget||this.sway;
 }
 projectBending(g){
  const base=g*NODES*3,D=this.bendDiag,E=this.bendSub1,F=this.bendSub2,R=this.bendRhs,L=this.bendIncrement,ratios=this.bendRatio,last=NODES-2;
  let nx=Math.cos(this.rootAngle),ny=Math.sin(this.rootAngle),nz=0;
  for(let n=1;n<=last;n++){
   const a=base+n*3,b=a-3,c=a+3,dx=this.q[a]-this.q[b],dy=this.q[a+1]-this.q[b+1],dz=this.q[a+2]-this.q[b+2],length=Math.max(1e-12,Math.hypot(dx,dy,dz)),tx=dx/length,ty=dy/length,tz=dz/length,dot=nx*tx+ny*ty+nz*tz;
   nx-=dot*tx;ny-=dot*ty;nz-=dot*tz;const norm=Math.max(1e-12,Math.hypot(nx,ny,nz));nx/=norm;ny/=norm;nz/=norm;
   const bx=ty*nz-tz*ny,by=tz*nx-tx*nz,bz=tx*ny-ty*nx,id=g*(NODES-2)+n-1,j=id*3,c0=this.restTurns[j],cn=this.restTurns[j+1],cb=this.restTurns[j+2],l1=this.lengths[g*(NODES-1)+n-1],l2=this.lengths[g*(NODES-1)+n],ratio=l2/l1,alpha=this.bendAlpha[id]*l2*l2/(.45+this.stiffness*2);
   ratios[n]=ratio;D[n]=this.invMass[g*NODES+n-1]*ratio*ratio+this.invMass[g*NODES+n]*(1+ratio)**2+this.invMass[g*NODES+n+1]+alpha;
   const target=[(c0*tx+cn*nx+cb*bx)*l2,(c0*ty+cn*ny+cb*by)*l2,(c0*tz+cn*nz+cb*bz)*l2];
   for(let k=0;k<3;k++)R[n*3+k]=-(this.q[c+k]-this.q[a+k]-target[k])-alpha*this.bendLambda[j+k];
  }
  // Solve J M^-1 J^T + compliance globally, avoiding iteration-count stiffness.
  // The three coordinate RHS share one banded Cholesky factorisation.
  for(let n=1;n<=last;n++){
   const off1=n>1?-(this.invMass[g*NODES+n-1]*(1+ratios[n-1])*ratios[n]+this.invMass[g*NODES+n]*(1+ratios[n])):0;
   const off2=n>2?this.invMass[g*NODES+n-1]*ratios[n]:0;
   F[n]=n>2?off2/D[n-2]:0;E[n]=n>1?(off1-F[n]*E[n-1])/D[n-1]:0;D[n]=Math.sqrt(Math.max(1e-8,D[n]-E[n]*E[n]-F[n]*F[n]));
   for(let k=0;k<3;k++)R[n*3+k]=(R[n*3+k]-(n>1?E[n]*R[(n-1)*3+k]:0)-(n>2?F[n]*R[(n-2)*3+k]:0))/D[n];
  }
  for(let n=last;n>=1;n--)for(let k=0;k<3;k++){
   const v=(R[n*3+k]-(n<last?E[n+1]*L[(n+1)*3+k]:0)-(n<last-1?F[n+2]*L[(n+2)*3+k]:0))/D[n];L[n*3+k]=v;
  }
  for(let n=1;n<=last;n++)for(let k=0;k<3;k++){L[n*3+k]*=.45;this.bendLambda[(g*(NODES-2)+n-1)*3+k]+=L[n*3+k];}
  for(let n=2;n<NODES;n++){
   const a=base+n*3,w=this.invMass[g*NODES+n];
   for(let k=0;k<3;k++)this.q[a+k]+=w*(L[(n-1)*3+k]-(n<=last?(1+ratios[n])*L[n*3+k]:0)+(n<last?ratios[n+1]*L[(n+1)*3+k]:0));
  }
 }
 projectLengths(g,passes=3){
  const base=g*NODES*3,D=this.solveDiag,U=this.solveOff,R=this.solveRhs,L=this.solveLambda,T=this.solveDir;
  for(let pass=0;pass<passes;pass++){
   for(let n=2;n<NODES;n++){
    const a=base+n*3,b=a-3,dx=this.q[a]-this.q[b],dy=this.q[a+1]-this.q[b+1],dz=this.q[a+2]-this.q[b+2],length=Math.max(1e-12,Math.hypot(dx,dy,dz));
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
  for(let g=0;g<85;g++){let normal=[1,0,0];for(let n=0;n<NODES;n++){const a=(g*NODES+n)*3,b=(n*85+g)*4,prev=(g*NODES+Math.max(0,n-1))*3,next=(g*NODES+Math.min(NODES-1,n+1))*3,t=[this.q[next]-this.q[prev],this.q[next+1]-this.q[prev+1],this.q[next+2]-this.q[prev+2]],l=Math.hypot(...t);for(let k=0;k<3;k++)t[k]/=l;const dot=normal[0]*t[0]+normal[1]*t[1]+normal[2]*t[2];normal=normal.map((v,k)=>v-dot*t[k]);let norm=Math.hypot(...normal);if(norm<1e-8){normal=[-t[2],0,t[0]];norm=Math.hypot(...normal);}normal=normal.map(v=>v/norm);for(let k=0;k<3;k++){this.offsets[b+k]=this.q[a+k];this.frames[b+k]=normal[k];}this.offsets[b+3]=1;}}
 }
 snapshot(){
  let maxOffset=0,maxVelocity=0,maxRelativeStretch=0,rootError=0,kineticEnergy=0,tipSpeed=0;
  for(let g=0;g<85;g++)for(let n=0;n<NODES;n++){const a=(g*NODES+n)*3;maxOffset=Math.max(maxOffset,Math.hypot(this.q[a]-this.equilibrium[a],this.q[a+1]-this.equilibrium[a+1],this.q[a+2]-this.equilibrium[a+2]));for(let k=0;k<3;k++){maxVelocity=Math.max(maxVelocity,Math.abs(this.velocity[a+k]));if(n>1)kineticEnergy+=.5*this.velocity[a+k]**2/this.invMass[g*NODES+n];else rootError=Math.max(rootError,Math.abs(this.q[a+k]-this.anchor(g,n,k)));}if(n){const b=a-3,ratio=Math.hypot(this.q[a]-this.q[b],this.q[a+1]-this.q[b+1],this.q[a+2]-this.q[b+2])/this.lengths[g*(NODES-1)+n-1];maxRelativeStretch=Math.max(maxRelativeStretch,Math.abs(ratio-1));}if(n===NODES-1)tipSpeed=Math.max(tipSpeed,Math.hypot(this.velocity[a],this.velocity[a+1],this.velocity[a+2]));}
  return {detailModes:20000,detailPeakMetres:this.detail.peak,airModel:'advected spatial field, transverse drag and exposure approximation',model:'gravity + XPBD oriented curvature + global chain lengths',style:this.style,nominalLength:STYLES[this.style].length,guides:85,nodes:NODES,fixedStep:DT,rootPinned:true,rootError,maxRelativeStretch,maxOffset,maxVelocity,tipSpeed,kineticEnergy,steps:this.steps,time:this.time,wind:this.wind,windEnabled:this.enabled,paused:this.paused,active:this.active,cpuMS:this.cpuMS,droppedSeconds:this.droppedSeconds,revision:this.revision,rootSway:this.sway,stiffness:this.stiffness,damping:this.damping};
 }
}
