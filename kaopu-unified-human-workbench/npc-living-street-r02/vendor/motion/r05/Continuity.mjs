import {THREE,RigidPoseSampler} from '../../../src/NativeBinding.mjs';
import {NativeRig,math} from '../../../src/NativeRig.mjs';
const {sub,lerp,pos,rotation}=math;
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const smooth=x=>{x=clamp(x);return x*x*x*(10+x*(-15+6*x));};
const copy=p=>({q:new Float64Array(p.q),p:new Float64Array(p.p)});
const Q=(a,j)=>new THREE.Quaternion().fromArray(a,j*4).normalize();
const axis=new THREE.Vector3(0,0,1);
function log(q){q.normalize();if(q.w<0)q.set(-q.x,-q.y,-q.z,-q.w);const n=Math.hypot(q.x,q.y,q.z),a=2*Math.atan2(n,q.w);return n<1e-10?[0,0,0]:[q.x*a/n,q.y*a/n,q.z*a/n];}
function exp(v){const a=Math.hypot(...v);return a<1e-10?new THREE.Quaternion():new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(...v).multiplyScalar(1/a),a);}
function unwrap(v,reference){const a=Math.hypot(...v);if(a<1e-8)return v;let result=v,score=Infinity;for(const turn of [-1,0,1]){const candidate=v.map(x=>x*(a+turn*2*Math.PI)/a),d=candidate.reduce((n,x,k)=>n+(x-reference[k])**2,0);if(d<score){score=d;result=candidate;}}return result;}
const yaw=q=>{const v=new THREE.Vector3(1,0,0).applyQuaternion(q);return Math.atan2(v.y,v.x);};
function bendDirection(world,l,fallback){const h=new THREE.Vector3().setFromMatrixPosition(world[l.a]),k=new THREE.Vector3().setFromMatrixPosition(world[l.b]),a=new THREE.Vector3().setFromMatrixPosition(world[l.c]),d=a.sub(h).normalize(),v=k.sub(h);v.addScaledVector(d,-v.dot(d));return v.length()>.003?v.normalize().toArray():fallback;}

/** Independently authored deterministic transition layer. Research provenance:
 * Harvey et al. 2020, Robust Motion In-betweening, sections 3.1, 3.3, 4.4.
 * Uses explicit timing, global root context, FK and contact constraints.
 * This is a small analytic solver, NOT their trained recurrent model or data.
 */
export class MotionContinuity {
 constructor(binding){this.binding=binding;this.sampler=new RigidPoseSampler(binding.rig);this.rig=new NativeRig({...binding.rig,stature:binding.height});this.root=binding.rig.parents.findIndex(p=>p<0);this.features=['foot.L','foot.R','lowerleg01.L','lowerleg01.R','wrist.L','wrist.R','head'].map(n=>binding.names.indexOf(n));this.phase=0;this.placement={yaw:0,x:0,y:0};this.transition=null;this.rootMode='forward';this.method='inertial';this.lastReport={};this.soles={L:[],R:[]};
  // Ground proxies are calibrated from this person's own weighted surface.
  for(const s of ['L','R']){const cells=new Map();for(let i=0;i<binding.N;i++){const z=binding.positions[i*3+2];if(z>-binding.floorOffset+binding.height*.12)continue;let w=0;for(let k=0;k<binding.range[i*2+1];k++){const slot=(binding.range[i*2]+k)*8,name=binding.names[binding.packed[slot+3]];if(/^(foot|toe)/.test(name)&&name.endsWith('.'+s))w+=binding.packed[slot+4];}if(w<.65)continue;const p=Array.from(binding.positions.slice(i*3,i*3+3)),key=Math.round(p[0]/.012)+':'+Math.round(p[1]/.012),old=cells.get(key);if(!old||p[2]<old[2])cells.set(key,p);}this.soles[s]=[...cells.values()];}
 }
 raw(c,t){const D=c.duration,n=c.frames.length-1,cyclic=!!c.continuous,cycles=cyclic?Math.floor(t/D):0,local=cyclic?t-cycles*D:clamp(t,0,D),x=clamp(local*c.fps,0,n),i=Math.floor(x),u=this.interpolate===false?0:x-i,a=c.frames[i],b=c.frames[Math.min(n,i+1)],o=copy(a);for(let j=0;j<o.q.length;j+=4)THREE.Quaternion.slerpFlat(o.q,j,a.q,j,b.q,j,u);for(let j=0;j<o.p.length;j++)o.p[j]+=(b.p[j]-a.p[j])*u;if(cyclic){const d=c.displacement||[0,0,0];for(let k=0;k<3;k++)o.p[this.root*3+k]+=d[k]*(this.rootMode==='forward'?cycles:-local/D);}return o;}
 contacts(c,t){if(c.contactWeights){const D=c.duration,local=c.continuous?((t%D)+D)%D:clamp(t,0,D),x=clamp(local*c.fps,0,c.contactWeights.length-1),i=Math.floor(x),a=c.contactWeights[i],b=c.contactWeights[Math.min(i+1,c.contactWeights.length-1)];return{L:a.L+(b.L-a.L)*(x-i),R:a.R+(b.R-a.R)*(x-i)};}if(c.row.kind==='basic')return{L:1,R:1};return{L:0,R:0};}
 place(p,placement=this.placement){const o=copy(p),r=this.root,q=new THREE.Quaternion().setFromAxisAngle(axis,placement.yaw),v=new THREE.Vector3(p.p[r*3],p.p[r*3+1],0).applyQuaternion(q);o.p[r*3]=v.x+placement.x;o.p[r*3+1]=v.y+placement.y;Q(o.q,r).premultiply(q).toArray(o.q,r*4);return o;}
 aligned(p,previous){const r=this.root,a=yaw(Q(previous.q,r))-yaw(Q(p.q,r)),v=new THREE.Vector3(p.p[r*3],p.p[r*3+1],0).applyAxisAngle(axis,a);return{yaw:a,x:previous.p[r*3]-v.x,y:previous.p[r*3+1]-v.y};}
 feature(p){this.sampler.apply(p);return this.features.map(j=>Array.from(this.sampler.world[j].elements.slice(12,15)));}
 configure(c,{previous=null,past=null,dt=1/120,contacts={L:0,R:0},blend=true,method='inertial',duration=null,rootMode='forward',support=true,phaseOverride=null}={}){
  this.clip=c;this.phase=0;this.rootMode=rootMode;this.method=method;this.transition=null;this.placement={yaw:0,x:0,y:0};const begin=performance.now();let best=Infinity,zero=Infinity,candidates=0;const options=[];
  if(previous){const f=this.feature(previous),fp=this.feature(past||previous),H=this.binding.height,N=phaseOverride===null&&c.continuous&&c.contactWeights?Math.min(96,c.frames.length-1):1;
   for(let k=0;k<N;k++){const phase=phaseOverride??k*c.duration/N,p=this.raw(c,phase),placement=this.aligned(p,previous),a=this.place(p,placement),b=this.place(this.raw(c,phase+dt),placement),fa=this.feature(a),fb=this.feature(b),w=this.contacts(c,phase);let cost=0;
    for(let j=0;j<f.length;j++){const weight=j<2?3:j<4?2:.4;for(let z=0;z<3;z++){cost+=weight*((fa[j][z]-f[j][z])/H)**2;cost+=weight*.012*((fb[j][z]-fa[j][z]-(f[j][z]-fp[j][z]))/(dt*H))**2;}}
    cost+=.18*((w.L-contacts.L)**2+(w.R-contacts.R)**2);options.push({phase,cost});candidates++;if(k===0)zero=cost;if(cost<best){best=cost;this.phase=phase;this.placement=placement;}
   }
   if(blend){const epsilon=1e-4,a=this.target(0),b=this.target(epsilon),r=this.root,x=[],v=[],rootX=[],rootV=[];let maxAngle=0;
    for(let j=0;j<this.sampler.count;j++){const out=Q(previous.q,j),old=Q((past||previous).q,j),omega=log(out.clone().multiply(old.invert())).map(n=>n*epsilon/dt),pred=exp(omega).multiply(out.clone()),offset=log(out.clone().multiply(Q(a.q,j).invert())),next=unwrap(log(pred.multiply(Q(b.q,j).invert())),offset);x.push(offset);v.push(next.map((n,k)=>(n-offset[k])/epsilon));maxAngle=Math.max(maxAngle,Math.hypot(...offset));}
    for(let k=0;k<3;k++){const j=r*3+k;rootX[k]=previous.p[j]-a.p[j];rootV[k]=(previous.p[j]-(past||previous).p[j])/dt-(b.p[j]-a.p[j])/epsilon;}
    const D=duration??clamp(.28+maxAngle*.13+Math.hypot(...rootV)*.035,.32,.65),anchors={};
    // Let a velocity change cover ground. A stationary target anchored exactly
    // at the switch position would force a moving root to advance then retreat.
    // Half the velocity difference over D yields a natural braking distance.
    for(let k=0;k<2;k++){const advance=rootV[k]*D*.5;this.placement[k===0?'x':'y']+=advance;rootX[k]-=advance;}
    this.sampler.apply(previous);
    for(const s of ['L','R']){const j=this.binding.names.indexOf('foot.'+s);anchors[s]={p:Array.from(this.sampler.world[j].elements.slice(12,15)),confidence:contacts[s],bend:bendDirection(this.sampler.world,this.rig.limbs['leg'+s],[0,-1,0])};}
    this.transition={previous:copy(previous),duration:D,x,v,rootX,rootV,anchors,support};
   }
  }
  this.lastReport={method:blend?method:'direct',phaseSeconds:this.phase,phaseCandidates:candidates,phaseCost:Number.isFinite(best)?best:null,firstFrameCost:Number.isFinite(zero)?zero:null,durationSeconds:this.transition?.duration||0,worldPlacement:{...this.placement},prepareMS:performance.now()-begin,sourceContacts:{...contacts},supportEnabled:support,model:'independently authored analytic; no trained neural network',maxReachErrorM:0};
  if(this.transition&&phaseOverride===null&&blend&&method==='inertial'){
   // A close first frame can still lead to a poor knee/foot transition. Check
   // the complete short transition before accepting a phase; never judge just
   // the switch endpoints. This is a tiny deterministic search, not training.
   let quality=this.quality(),winner=null,winnerQuality=quality,score=best+quality.penalty,tested=1;
   if(quality.maxStepDegrees>10){this.trial??=new MotionContinuity(this.binding);const shortlist=[],sorted=options.slice().sort((a,b)=>a.cost-b.cost);for(const candidate of sorted){if(shortlist.every(x=>Math.min(Math.abs(x.phase-candidate.phase),c.duration-Math.abs(x.phase-candidate.phase))>c.duration*.07))shortlist.push(candidate);if(shortlist.length>=8)break;}
    for(const candidate of shortlist){if(Math.abs(candidate.phase-this.phase)<1e-6)continue;this.trial.configure(c,{previous,past,dt,contacts,blend,method,duration,rootMode,support,phaseOverride:candidate.phase});const q=this.trial.quality(),s=candidate.cost+q.penalty;tested++;if(s<score){score=s;winner={phase:this.trial.phase,placement:{...this.trial.placement},transition:this.trial.transition,cost:candidate.cost};winnerQuality=q;}}
   }
   if(winner){this.phase=winner.phase;this.placement=winner.placement;this.transition=winner.transition;this.lastReport.phaseCost=winner.cost;}
   let durationTrials=0;
   if(winnerQuality.maxStepDegrees>12){this.trial??=new MotionContinuity(this.binding);const initialDuration=this.transition.duration;for(const factor of [1.2,1.4,.85]){const candidateDuration=clamp(initialDuration*factor,.28,.9);this.trial.configure(c,{previous,past,dt,contacts,blend,method,duration:candidateDuration,rootMode,support,phaseOverride:this.phase});const q=this.trial.quality();durationTrials++;if(q.maxStepDegrees<winnerQuality.maxStepDegrees&&q.minSole>-.008){this.placement={...this.trial.placement};this.transition=this.trial.transition;winnerQuality=q;}if(winnerQuality.maxStepDegrees<10)break;}}
   Object.assign(this.lastReport,{phaseSeconds:this.phase,durationSeconds:this.transition.duration,worldPlacement:{...this.placement},shortlistedTransitions:tested,durationTrials,transitionMaxStepDegrees:winnerQuality.maxStepDegrees,transitionSoleMinimumM:winnerQuality.minSole,prepareMS:performance.now()-begin});
  }
  return this.lastReport;
 }
 quality(){let previous=this.sample(0),maxStepDegrees=0,minSole=Infinity;for(let i=1;i<=Math.ceil(this.transition.duration*120);i++){const p=this.sample(i/120);for(let j=0;j<p.q.length;j+=4){let d=0;for(let k=0;k<4;k++)d+=p.q[j+k]*previous.q[j+k];const n=Math.hypot(...p.q.slice(j,j+4))*Math.hypot(...previous.q.slice(j,j+4));maxStepDegrees=Math.max(maxStepDegrees,2*Math.acos(clamp(Math.abs(d)/n))*180/Math.PI);}this.sampler.apply(p);for(const s of ['L','R']){const m=this.sampler.skin[this.rig.limbs['leg'+s].c];for(const v of this.soles[s])minSole=Math.min(minSole,m[8]*v[0]+m[9]*v[1]+m[10]*v[2]+m[11]+this.binding.floorOffset);}previous=p;}
  return{maxStepDegrees,minSole,penalty:Math.max(0,maxStepDegrees-10)**2*.03+Math.max(0,-minSole-.006)*20};}
 target(t){return this.place(this.raw(this.clip,t+this.phase));}
 sample(t,{support=true}={}){
  const o=this.target(t),tr=this.transition;if(!tr||t>=tr.duration)return o;if(t<=0)return copy(tr.previous);
  const s=clamp(t/tr.duration),h0=1-smooth(s),h1=s-6*s**3+8*s**4-3*s**5;
  if(this.method==='baseline'){const w=s*s*(3-2*s);for(let j=0;j<o.q.length;j+=4)THREE.Quaternion.slerpFlat(o.q,j,tr.previous.q,j,o.q,j,w);for(let k=0;k<3;k++){const j=this.root*3+k;o.p[j]=tr.previous.p[j]+(o.p[j]-tr.previous.p[j])*w;}return o;}
  for(let j=0;j<this.sampler.count;j++)exp(tr.x[j].map((x,k)=>x*h0+tr.v[j][k]*tr.duration*h1)).multiply(Q(o.q,j)).normalize().toArray(o.q,j*4);
  for(let k=0;k<3;k++)o.p[this.root*3+k]+=tr.rootX[k]*h0+tr.rootV[k]*tr.duration*h1;
  if(support&&tr.support)return this.support(o,t,h0);return o;
 }
 support(p,t,release){const tr=this.transition,c=this.contacts(this.clip,t+this.phase),r=this.rig,bends={};this.sampler.apply(this.target(t));for(const s of ['L','R'])bends[s]=bendDirection(this.sampler.world,r.limbs['leg'+s],tr.anchors[s].bend);this.sampler.apply(p);for(let j=0;j<r.count;j++){r.posedMatrices[j].set(this.sampler.world[j].clone().transpose().toArray());r.skinMatrices[j].set(this.sampler.skin[j]);}
  const groundWeight=smooth(t/.035)*smooth((tr.duration-t)/.035);
  let changed=false;for(const s of ['L','R']){const a=tr.anchors[s],weight=this.rootMode==='forward'?a.confidence*c[s]*smooth(t/.07)*release*.85:0,l=r.limbs['leg'+s],P=pos(r.posedMatrices[l.c]),R=rotation(r.skinMatrices[l.c]),target=lerp(P,a.p,weight),skin=r.skinMatrices[l.c];let low=Infinity;
   for(const p of this.soles[s])low=Math.min(low,skin[8]*p[0]+skin[9]*p[1]+skin[10]*p[2]+skin[11]);
   const floor=-this.binding.floorOffset-.001,raise=Math.max(0,floor-low);target[2]=Math.max(target[2],P[2]+raise*groundWeight);
   if(Math.hypot(...sub(target,P))<1e-7)continue;const knee=pos(r.posedMatrices[l.b]),hip=pos(r.posedMatrices[l.a]),bend=lerp(a.bend,bends[s],smooth(t/tr.duration)),pole=hip.map((x,k)=>x+bend[k]*this.binding.height);
   // Main-joint spans cross native helper bones. Measure the current spans for
   // the analytic solve; using rest spans here changes a knee even at zero
   // requested correction. The final FK still uses immutable native offsets.
   const effective={...l,upper:Math.hypot(...sub(hip,knee)),lower:Math.hypot(...sub(knee,P))},result=r.solveLimb(effective,target,pole,.99999999);r.orientSkin(l.c,R);this.lastReport.maxReachErrorM=Math.max(this.lastReport.maxReachErrorM,result.reachError);changed=true;}
  return changed?this.sampler.pack(r.posedMatrices):p;
 }
 endTime(){return this.clip.continuous?Infinity:Math.max(0,this.clip.duration-this.phase);}
 report(t=0){return{...this.lastReport,remainingSeconds:Math.max(0,(this.transition?.duration||0)-t),phaseSeconds:this.phase,deterministic:true};}
}

