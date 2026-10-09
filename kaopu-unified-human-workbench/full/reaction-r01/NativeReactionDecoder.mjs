/** Independent native task decoder, derived from our own R03 FK/IK math.
 * No authored timeline, future opponent sample, model weights or hit injection.
 * 104 bones/full CSR consumer contract: native Z-up, rest-axis rotvec degrees.
 * Current scope: stationary side evade, guard, bounded backward weight shift.
 * Counterattack, stepping retreat and physical surface response are pending.
 */
const PI=Math.PI, DEG=PI/180, EPS=1e-10;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const mix=(a,b,t)=>a+(b-a)*t;
const smooth=x=>{x=clamp(x,0,1);return x*x*x*(x*(x*6-15)+10);};
const mod=(x,n)=>((x%n)+n)%n;
const add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const scale=(a,s)=>[a[0]*s,a[1]*s,a[2]*s];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm=a=>Math.hypot(a[0],a[1],a[2]);
const unit=(a,fallback=[0,0,1])=>{const n=norm(a);return n>EPS?scale(a,1/n):fallback.slice();};
const lerp=(a,b,t)=>[mix(a[0],b[0],t),mix(a[1],b[1],t),mix(a[2],b[2],t)];
const pos=m=>[m[3],m[7],m[11]];
const I=()=>new Float64Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
const rotation=m=>[m[0],m[1],m[2],m[4],m[5],m[6],m[8],m[9],m[10]];
const mv=(r,v)=>[r[0]*v[0]+r[1]*v[1]+r[2]*v[2],r[3]*v[0]+r[4]*v[1]+r[5]*v[2],r[6]*v[0]+r[7]*v[1]+r[8]*v[2]];
const tr=r=>[r[0],r[3],r[6],r[1],r[4],r[7],r[2],r[5],r[8]];
function mm3(a,b){const o=Array(9);for(let i=0;i<3;i++)for(let j=0;j<3;j++)o[i*3+j]=a[i*3]*b[j]+a[i*3+1]*b[3+j]+a[i*3+2]*b[6+j];return o;}
function mul(a,b,out){for(let i=0;i<3;i++){const k=i*4;for(let j=0;j<3;j++)out[k+j]=a[k]*b[j]+a[k+1]*b[4+j]+a[k+2]*b[8+j];out[k+3]=a[k]*b[3]+a[k+1]*b[7]+a[k+2]*b[11]+a[k+3];}out[12]=out[13]=out[14]=0;out[15]=1;return out;}
function inv(m){const o=I();for(let r=0;r<3;r++){for(let c=0;c<3;c++)o[r*4+c]=m[c*4+r];o[r*4+3]=-(m[r]*m[3]+m[r+4]*m[7]+m[r+8]*m[11]);}return o;}
function axisRotation(axis,angle){const [x,y,z]=unit(axis),c=Math.cos(angle),s=Math.sin(angle),t=1-c;return [t*x*x+c,t*x*y-s*z,t*x*z+s*y,t*x*y+s*z,t*y*y+c,t*y*z-s*x,t*x*z-s*y,t*y*z+s*x,t*z*z+c];}
export function rotationVectorDegrees(v){const a=norm(v);return a<EPS?[1,0,0,0,1,0,0,0,1]:axisRotation(v,a*DEG);}
function shortestArc(a,b){a=unit(a);b=unit(b);const c=clamp(dot(a,b),-1,1),v=cross(a,b),n=norm(v);if(n<EPS)return c>0?[1,0,0,0,1,0,0,0,1]:axisRotation(cross(a,Math.abs(a[0])<.8?[1,0,0]:[0,1,0]),PI);return axisRotation(scale(v,1/n),Math.atan2(n,c));}
function pivotMatrix(r,p){const out=I(),rp=mv(r,p);for(let i=0;i<3;i++){for(let j=0;j<3;j++)out[i*4+j]=r[i*3+j];out[i*4+3]=p[i]-rp[i];}return out;}
function rotateMatrixInPlace(m,r,p){const ox=m[3]-p[0],oy=m[7]-p[1],oz=m[11]-p[2];for(let c=0;c<3;c++){const x=m[c],y=m[4+c],z=m[8+c];m[c]=r[0]*x+r[1]*y+r[2]*z;m[4+c]=r[3]*x+r[4]*y+r[5]*z;m[8+c]=r[6]*x+r[7]*y+r[8]*z;}m[3]=p[0]+r[0]*ox+r[1]*oy+r[2]*oz;m[7]=p[1]+r[3]*ox+r[4]*oy+r[5]*oz;m[11]=p[2]+r[6]*ox+r[7]*oy+r[8]*oz;}
function basisRotation(restForward,restPalm,forward,palm){const rf=unit(restForward),rn=unit(sub(restPalm,scale(rf,dot(rf,restPalm)))),rr=unit(cross(rf,rn));const f=unit(forward),n=unit(sub(palm,scale(f,dot(f,palm)))),r=unit(cross(f,n));const a=[f[0],n[0],r[0],f[1],n[1],r[1],f[2],n[2],r[2]],b=[rf[0],rn[0],rr[0],rf[1],rn[1],rr[1],rf[2],rn[2],rr[2]];return mm3(a,tr(b));}
function ordered(parents){const out=[],seen=new Set();while(out.length<parents.length){let found=false;for(let j=0;j<parents.length;j++)if(!seen.has(j)&&(parents[j]<0||seen.has(parents[j]))){seen.add(j);out.push(j);found=true;}if(!found)throw Error('Boxing rig has a cyclic or invalid hierarchy');}return out;}
function matrixToRotvec(r){const angle=Math.acos(clamp((r[0]+r[4]+r[8]-1)*.5,-1,1));if(angle<1e-8)return [0,0,0];if(PI-angle<1e-4){const axis=[Math.sqrt(Math.max(0,(r[0]+1)/2)),Math.sqrt(Math.max(0,(r[4]+1)/2)),Math.sqrt(Math.max(0,(r[8]+1)/2))];if(r[1]+r[3]<0)axis[1]*=-1;if(r[2]+r[6]<0)axis[2]*=-1;return scale(unit(axis),angle/DEG);}return scale([r[7]-r[5],r[2]-r[6],r[3]-r[1]],angle/(2*Math.sin(angle)*DEG));}
/** Analytic bend point, with a reachable endpoint and stable anatomical pole. */
export function solveTwoBone(hip,target,pole,upperLength,lowerLength,{extension=.995}={}){
  const delta=sub(target,hip),rawDistance=norm(delta),direction=unit(delta,[0,0,-1]);
  const distance=clamp(rawDistance,Math.abs(upperLength-lowerLength)+1e-5,(upperLength+lowerLength)*extension);
  const endpoint=add(hip,scale(direction,distance)),along=(upperLength*upperLength-lowerLength*lowerLength+distance*distance)/(2*distance);
  const bend=Math.sqrt(Math.max(0,upperLength*upperLength-along*along));let p=sub(pole,hip);p=sub(p,scale(direction,dot(p,direction)));if(norm(p)<1e-7)p=cross(direction,[1,0,0]);
  const joint=add(add(hip,scale(direction,along)),scale(unit(p,[0,-1,0]),bend));
  return {joint,endpoint,requested:target,clamped:Math.abs(rawDistance-distance)>1e-6,reachError:Math.abs(rawDistance-distance)};
}
export class NativeReactionDecoder {
 constructor({names,parents,restMatrices,stature=null,child=false}={}){
  if(!names||!parents||!restMatrices||names.length!==parents.length)throw Error('BoxingRig needs matching names, parents and restMatrices');
  this.names=Array.from(names);this.parents=Array.from(parents);this.count=names.length;this.index=new Map(names.map((n,i)=>[n,i]));this.order=ordered(this.parents);this.child=!!child;
  this.rest=Array.from({length:this.count},(_,i)=>new Float64Array(restMatrices[i]?.length===16?restMatrices[i]:restMatrices.slice(i*16,i*16+16)));
  if(this.rest.some(m=>m.length!==16||!m.every(Number.isFinite)))throw Error('Non-finite boxing rest skeleton');
  this.inverseRest=this.rest.map(inv);this.restP=this.rest.map(pos);
  for(const n of ['root','head',...['L','R'].flatMap(s=>['upperleg01','lowerleg01','foot','upperarm01','lowerarm01','wrist'].map(b=>b+'.'+s))])if(!this.index.has(n))throw Error('Boxing R01 requires canonical Anny bone '+n);
  this.descendants=Array.from({length:this.count},(_,a)=>this.order.filter(b=>{for(let p=b;p>=0;p=this.parents[p])if(p===a)return true;return false;}));
  this.stature=stature>0?stature:(this.restP[this.index.get('head')][2]-Math.min(this.restP[this.index.get('foot.L')][2],this.restP[this.index.get('foot.R')][2]))*1.13;
  this.posedMatrices=this.rest.map(m=>m.slice());this.skinMatrices=this.rest.map(I);this.pose={};this.rotationDeltas=this.rest.map(()=>[0,0,0]);
  this.rootTranslation=[0,0,0];this.footContacts={L:{},R:{}};this.metrics={};this.limbs={};this.hand={};
  for(const s of ['L','R']){
   const id=n=>this.index.get(n+'.'+s),p=n=>this.restP[id(n)];
   for(const [kind,a,b,c]of [['leg','upperleg01','lowerleg01','foot'],['arm','upperarm01','lowerarm01','wrist']])this.limbs[kind+s]={a:id(a),b:id(b),c:id(c),upper:norm(sub(p(b),p(a))),lower:norm(sub(p(c),p(b)))};
   const side=s==='L'?1:-1,forward=unit(sub(p('finger3-1'),p('wrist'))),across=unit(sub(p('finger2-1'),p('finger5-1'))),palm=scale(unit(cross(forward,across)),side);
   this.hand[s]={forward,palm};
  }
  this.result={schema:'native-observed-reaction-pose/1',posedMatrices:this.posedMatrices,skinMatrices:this.skinMatrices,rootTranslation:this.rootTranslation,footContacts:this.footContacts,pose:this.pose,metrics:this.metrics,state:null,source:'self-authored observation-to-task native decoder; no learned model'};
 }
 setRotation(name,x=0,y=0,z=0){const j=this.index.get(name);if(j!==undefined){const v=this.rotationDeltas[j];v[0]=x;v[1]=y;v[2]=z;}}
 fk(){const tmp=I();for(const j of this.order){const r=rotationVectorDegrees(this.rotationDeltas[j]),local=pivotMatrix(r,this.restP[j]),p=this.parents[j];if(p<0){this.skinMatrices[j].set(local);this.skinMatrices[j][3]+=this.rootTranslation[0];this.skinMatrices[j][7]+=this.rootTranslation[1];this.skinMatrices[j][11]+=this.rootTranslation[2];}else mul(this.skinMatrices[p],local,this.skinMatrices[j]);mul(this.skinMatrices[j],this.rest[j],this.posedMatrices[j]);}return tmp;}
 rotateSubtree(j,r,p=pos(this.posedMatrices[j])){for(const k of this.descendants[j]){rotateMatrixInPlace(this.posedMatrices[k],r,p);rotateMatrixInPlace(this.skinMatrices[k],r,p);}}
 orientSkin(j,absolute){const current=rotation(this.skinMatrices[j]),delta=mm3(absolute,tr(current));this.rotateSubtree(j,delta);}
 solveLimb(limb,target,pole,extension=.995,softReach=false){const p=pos(this.posedMatrices[limb.a]),requested=target; if(softReach){const delta=sub(target,p),d=norm(delta),total=limb.upper+limb.lower,start=total*.82,span=total*extension-start;if(d>start)target=add(p,scale(delta,(start+span*Math.tanh((d-start)/span))/d));} const solved=solveTwoBone(p,target,pole,limb.upper,limb.lower,{extension});solved.requested=requested;solved.reachError=norm(sub(requested,solved.endpoint));this.rotateSubtree(limb.a,shortestArc(sub(pos(this.posedMatrices[limb.b]),p),sub(solved.joint,p)),p);const knee=pos(this.posedMatrices[limb.b]);this.rotateSubtree(limb.b,shortestArc(sub(pos(this.posedMatrices[limb.c]),knee),sub(solved.endpoint,knee)),knee);return solved;}
 evaluate(intent,{child=this.child,contactIK=true,footLock=true,poseOutput=true}={}){
  if(intent?.schema!=='observed-reaction-task-intent/1'||!Number.isFinite(intent.time))throw Error('Observed task intent required');
  const w=intent.weights;
  for(const key of ['guard','slipLeft','slipRight','duck','retreat','counterIntent'])if(!Number.isFinite(w?.[key])||w[key]<-1e-6||w[key]>1.001)throw Error('Finite bounded intent weights required');
  if(Math.abs(w.counterIntent)>1e-9)throw Error('Counterattack decoder not implemented');
  const stationary={x:0,y:0,yaw:0,swing:0,lift:0,contact:true,kind:'fixed-support',eventId:null};
  const a={jab:0,cross:0,hook:0,windup:0,block:1,breath:0,slip:clamp(w.slipRight-w.slipLeft,-1,1),duck:w.duck,retreat:w.retreat,footwork:{L:{...stationary},R:{...stationary}}};
  const h=this.stature,power=child?.65:1,jab=0,crossAmount=0,hook=0,duck=a.duck*power,slip=a.slip*power,opponentStature=h,contactResponse=null;
  this.result.state={mode:'observed stationary evade and guard recovery',observationCutoff:intent.observationCutoff,action:intent.action,cause:intent.cause,nativeDecoded:true,collisionHit:false,retreatImplementation:'bounded backward weight shift with fixed feet; stepping retreat pending',counterImplemented:false,contactResponse:{accepted:false}};
  for(const v of this.rotationDeltas)v.fill(0);
  const aimHeightOffset=clamp(.84*((Number.isFinite(opponentStature)&&opponentStature>0?opponentStature:h)-h),-h*.22,h*(child?.07:.10));
  this.result.state.targeting=opponentStature>h*1.12?'opponent torso level':'opponent head level';this.result.state.targetHeightOffset=aimHeightOffset;
  const steps=a.footwork,centerX=(steps.L.x+steps.R.x)/2,centerY=(steps.L.y+steps.R.y)/2,stepYaw=(steps.L.yaw+steps.R.yaw)/2;
  const swingL=Math.sin(PI*steps.L.swing)**4,swingR=Math.sin(PI*steps.R.swing)**4;
  // One external spring already integrated by the controller. Explicit native
  // coordinates only; no physical collision is inferred from planned defence.
  let overlay=[0,0,0],headOverlay=[0,0,0];
  if(contactResponse&&!child){
   const c=contactResponse,valid=c.space==='native-local-z-up'&&c.source==='jolt-shape-cast'&&typeof c.eventId==='string'&&c.eventId.length>0&&[c.torsoDisplacementNative,c.headRotationVectorNativeRadians].every(v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite));
   if(valid){overlay=scale(c.torsoDisplacementNative,Math.min(1,.065/(norm(c.torsoDisplacementNative)||1)));headOverlay=scale(c.headRotationVectorNativeRadians,Math.min(1,.2/(norm(c.headRotationVectorNativeRadians)||1))/DEG);this.result.state.contactResponse={accepted:true,eventId:c.eventId,source:c.source,space:c.space,integrator:'external-only'};}
   else this.result.state.contactResponse={accepted:false,reason:'requires finite explicit native-local overlay and Jolt event provenance'};
  }
  const recoilPitch=clamp(-overlay[1]/(h*.35)/DEG,-9,9),recoilRoll=clamp(overlay[0]/(h*.35)/DEG,-9,9);
  const yaw=-16+stepYaw+crossAmount*20-jab*7+hook*16-a.windup*8;
  this.rootTranslation[0]=h*(centerX+.015*(swingR-swingL)+slip*.031+(crossAmount-jab)*.008);
  this.rootTranslation[1]=h*(centerY+.013*(swingL-swingR)-.016-jab*.008-crossAmount*.016+duck*.009+a.retreat*.017);
  this.rootTranslation[2]=-h*(.045+duck*.039)+h*.0013*a.breath;
  this.setRotation('root',1.5,0,yaw);
  this.setRotation('spine05',2+duck*3+recoilPitch*.12,slip*2+recoilRoll*.12,0);
  this.setRotation('spine04',2+duck*4+recoilPitch*.22,slip*4+recoilRoll*.22,crossAmount*2-jab);
  this.setRotation('spine03',2+duck*5+recoilPitch*.25,slip*4+recoilRoll*.25,crossAmount*3-jab*1.5+hook*2);
  this.setRotation('spine02',2+duck*3+recoilPitch*.23,slip*3+recoilRoll*.23,crossAmount*3-jab*1.5+hook*3);
  this.setRotation('spine01',1+duck*2+recoilPitch*.18,slip*2+recoilRoll*.18,crossAmount*2-jab+hook*3);
  this.setRotation('neck01',1-duck*2,slip*2,-yaw*.18);
  this.setRotation('neck02',1-duck*2,slip*2,-yaw*.17);
  this.setRotation('neck03',0,slip,-yaw*.12);
  this.setRotation('head',3-duck*2+headOverlay[0],slip+headOverlay[1],-yaw*.1+headOverlay[2]);
  for(const [s,side]of [['L',1],['R',-1]]){
   const attack=s==='L'?jab+hook:crossAmount;
   this.setRotation('clavicle.'+s,0,side*(2+attack*3),side*(-attack*2));
   this.setRotation('shoulder01.'+s,attack*2,side*(2+attack*2),-side*attack*3);
   const palm=this.hand[s].palm;
   for(let f=1;f<=5;f++)for(let segment=1;segment<=3;segment++){
    const name=`finger${f}-${segment}.${s}`,j=this.index.get(name);if(j===undefined)continue;
    const childIndex=this.index.get(`finger${f}-${Math.min(3,segment+1)}.${s}`),parentIndex=this.parents[j];
    const direction=segment<3?sub(this.restP[childIndex],this.restP[j]):sub(this.restP[j],this.restP[parentIndex]);
    const axis=unit(cross(unit(direction),palm));const angle=(f===1?[30,42,38]:[78,88,48])[segment-1]*(child?.90:1)*(1+.035*attack);
    this.rotationDeltas[j]=scale(axis,angle);if(f===1&&segment===1)this.rotationDeltas[j]=add(this.rotationDeltas[j],scale(this.hand[s].forward,side*28));
   }
  }
  this.fk();
  const ikEnabled=contactIK!==false&&footLock!==false;
  let maxFootError=0,maxReachClamp=0,maxFootLockError=0;
  for(const [s,side]of [['L',1],['R',-1]]){
   const limb=this.limbs['leg'+s],step=steps[s],rest=this.restP[limb.c],toeIndex=this.index.get('toe3-1.'+s),toeRest=this.restP[toeIndex],pitch=(s==='R'?crossAmount*.10:hook*.05),footYaw=((side===1?-9:-3)+step.yaw)*DEG;
   const orient=mm3(axisRotation([0,0,1],footYaw),axisRotation([1,0,0],pitch));
   const base=[side*Math.max(h*.073,Math.abs(rest[0])*.78)+step.x*h,((s==='L'?-.092:.10)+step.y)*h,rest[2]+step.lift*h];
   const footToe=sub(toeRest,rest),unpitched=mv(axisRotation([0,0,1],footYaw),footToe),pitched=mv(orient,footToe);
   // A planted rear foot can pivot at the toes; its contact point stays fixed.
   const target=add(base,sub(unpitched,pitched));
   const hip=pos(this.posedMatrices[limb.a]),pole=add(hip,[side*h*.025,-h*.35,-h*.05]);
   const solved=ikEnabled?this.solveLimb(limb,target,pole,.998):{reachError:0};if(ikEnabled)this.orientSkin(limb.c,orient);
   if(ikEnabled)for(let f=1;f<=5;f++){const j=this.index.get(`toe${f}-1.${s}`);if(j!==undefined)this.rotateSubtree(j,axisRotation([Math.cos(footYaw),Math.sin(footYaw),0],-pitch));}
   const actual=pos(this.posedMatrices[limb.c]),error=norm(sub(actual,target));maxFootError=Math.max(maxFootError,error);maxReachClamp=Math.max(maxReachClamp,solved.reachError);
   const contact=this.footContacts[s];contact.planted=step.contact;contact.locked=ikEnabled&&step.contact;contact.mode=step.contact?(pitch>.005?'toe-pivot':'flat'):'swing';contact.weight=step.contact?clamp(.5+(s==='L'?crossAmount*.2:-crossAmount*.2),.15,.85):0;contact.target=target;contact.position=actual;contact.error=error;contact.swing=step.swing;contact.footworkKind=step.kind;contact.eventId=step.eventId;contact.toePosition=pos(this.posedMatrices[toeIndex]);contact.contactAnchor=step.contact?add(base,unpitched):null;contact.lockError=step.contact?norm(sub(contact.toePosition,contact.contactAnchor)):0;maxFootLockError=Math.max(maxFootLockError,contact.lockError);
  }
  const supportTotal=this.footContacts.L.weight+this.footContacts.R.weight;if(supportTotal>0){this.footContacts.L.weight/=supportTotal;this.footContacts.R.weight/=supportTotal;}
  for(const [s,side]of [['L',1],['R',-1]]){
   const limb=this.limbs['arm'+s],shoulder=pos(this.posedMatrices[limb.a]),head=pos(this.posedMatrices[this.index.get('head')]),reach=limb.upper+limb.lower,attack=s==='L'?Math.max(jab,hook):crossAmount;
   const guard=[head[0]+side*h*.062,head[1]-h*(s==='L'?.105:.088),head[2]-h*.074+a.block*h*.023];
   const straight=[head[0]+side*h*.015,shoulder[1]-reach*(child?.83:.94),head[2]-h*(child?.080:.052)+aimHeightOffset];
   // Independent C2 punch envelopes; hook travels out then across, while the
   // opposite hand remains in guard. No threshold-based target switching.
   const straightWeight=s==='L'?jab:crossAmount;
   let target=lerp(guard,straight,clamp(straightWeight,0,1));
   if(s==='L'){
    const hookTarget=[head[0]-h*.09,shoulder[1]-reach*.72,head[2]-h*.056+aimHeightOffset*.9];
    const hw=clamp(hook,0,1);target=add(target,scale(sub(hookTarget,guard),hw));target[0]+=h*.18*hw*(1-hw);
   }
   const localHook=s==='L'?hook:0;const pole=add(shoulder,[side*h*(.105+localHook*.055),-h*.02,-h*(.22-localHook*.12)]);
   const solved=this.solveLimb(limb,target,pole,child?.94:.975,true);this.metrics['armReachClamp'+s]=solved.reachError;this.metrics['armReachRatio'+s]=norm(sub(pos(this.posedMatrices[limb.c]),shoulder))/reach;
   const forward=unit(lerp([side*.035,-.18,1],[0,-1,.06],clamp(attack,0,1)));
   const palm=unit(lerp([-side,0,-.12],[0,0,-1],clamp(attack,0,1)));
   this.orientSkin(limb.c,basisRotation(this.hand[s].forward,this.hand[s].palm,forward,palm));
  }
  this.metrics.contactIK=ikEnabled;this.metrics.externalContactOverlay=this.result.state.contactResponse.accepted;this.metrics.semanticProgramCount=0;this.metrics.maxFootLockError=maxFootLockError;this.metrics.maxAnkleTargetError=maxFootError;this.metrics.maxLegReachClamp=maxReachClamp;this.metrics.plantedFeet=Number(this.footContacts.L.planted)+Number(this.footContacts.R.planted);this.metrics.stature=h;this.metrics.shapeEvaluationsPerFrame=0;this.metrics.boneCount=this.count;
  if(poseOutput)this.exportNativePose(this.pose);else for(const key of Object.keys(this.pose))delete this.pose[key];
  return this.result;
 }
 /** Export exact native local-ref rotation vectors of the final IK skeleton. */
 exportNativePose(out={}){for(const j of this.order){const p=this.parents[j],r=rotation(this.skinMatrices[j]),local=p<0?r:mm3(tr(rotation(this.skinMatrices[p])),r);out[this.names[j]]={rotation:matrixToRotvec(local)};if(p<0)out[this.names[j]].translation=this.rootTranslation.slice();}return out;}
 /** O(J) diagnostic. Useful for test fixtures, not needed in the render loop. */
 validate(){let maxBoneLengthError=0,maxOrthogonalityError=0;for(let j=0;j<this.count;j++){const p=this.parents[j];if(p>=0)maxBoneLengthError=Math.max(maxBoneLengthError,Math.abs(norm(sub(pos(this.posedMatrices[j]),pos(this.posedMatrices[p])))-norm(sub(this.restP[j],this.restP[p]))));const r=rotation(this.skinMatrices[j]),m=mm3(r,tr(r));for(let k=0;k<9;k++)maxOrthogonalityError=Math.max(maxOrthogonalityError,Math.abs(m[k]-(k%4===0?1:0)));}return {finite:this.posedMatrices.every(m=>m.every(Number.isFinite))&&this.skinMatrices.every(m=>m.every(Number.isFinite)),maxBoneLengthError,maxOrthogonalityError,...this.metrics};}
}
export function createNativeReactionDecoder(options){return new NativeReactionDecoder(options);}
