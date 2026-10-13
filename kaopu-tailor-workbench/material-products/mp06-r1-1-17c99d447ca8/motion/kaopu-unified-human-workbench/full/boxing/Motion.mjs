/**
 * Self-authored deterministic boxing study, R01. No downloaded motion capture.
 * Native convention: metres, Z-up, +X subject-left, -Y forward; row-major
 * matrices acting on column vectors. Anny local-ref rotations are ROTATION
 * VECTORS in degrees (not Euler angles). Geometry/shape is never evaluated here.
 *
 * createBoxingRig({names,parents,restMatrices,stature?,child?})
 *   .evaluate(seconds,{pairIndex:0,fighter:0,child?,intensity:1,contactIK:true,footLock:true,poseOutput:false})
 * returns cached {posedMatrices,skinMatrices,rootTranslation,footContacts,state,
 *                 metrics,pose}. Copy these if retaining more than one frame.
 * Translation is already included in the matrices. Neutral native grounding is
 * deliberately unchanged; a renderer can retain its neutral floor offset.
 */
const PI=Math.PI, DEG=PI/180, EPS=1e-10;
export const BOXING_CYCLE_SECONDS=12;
export const BOXING_PAIR_COUNT=18;
export const BOXING_MOTION_PROVENANCE=Object.freeze({
  author:'Self-authored procedural choreography and analytic two-bone IK',
  captureSource:null,version:'boxing-motion-r01',units:'metres',upAxis:'Z',
  nativeForward:'-Y',rotationProtocol:'Anny local-ref rotation-vector degrees',
  pairCount:18,variantCount:3,childMode:'light non-contact target practice',
});
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
function pulse(t,start,end,peak=.43){if(t<=start||t>=end)return 0;const k=(t-start)/(end-start);return k<peak?smooth(k/peak):1-smooth((k-peak)/(1-peak));}
const EVENTS=Object.freeze([
  {actor:0,start:1,end:1.65,kind:'jab',response:'slip',direction:1},
  {actor:0,start:1.82,end:2.54,kind:'cross',response:'duck',direction:-1},
  {actor:1,start:2.88,end:3.59,kind:'jab',response:'slip',direction:-1,counter:true},
  {actor:1,start:3.79,end:4.53,kind:'cross',response:'block',direction:1},
  {actor:1,start:5.82,end:6.47,kind:'jab',response:'slip',direction:-1},
  {actor:1,start:6.66,end:7.4,kind:'cross',response:'duck',direction:1},
  {actor:0,start:7.77,end:8.51,kind:'cross',response:'slip',direction:1,counter:true},
  {actor:0,start:8.7,end:9.48,kind:'hook',response:'block',direction:-1},
]);
export const BOXING_EVENTS=EVENTS;
const variantEvents=(changes)=>Object.freeze(EVENTS.map((e,i)=>Object.freeze({...e,...(changes[i]||{})})));
/** Three distinct authored action/response grammars, each used by six arenas. */
export const BOXING_VARIANTS=Object.freeze([
 Object.freeze({id:'jab-slip',label:'刺拳 · 侧闪回击',description:'Double jabs draw alternating slips; the defender returns a straight jab.',events:variantEvents({
  1:{kind:'jab',response:'slip',direction:-1},2:{kind:'jab',response:'slip',direction:1},3:{kind:'jab',response:'block'},5:{kind:'jab',response:'slip',direction:1},6:{kind:'jab',response:'slip',direction:-1},7:{kind:'cross',response:'block'},
 })}),
 Object.freeze({id:'cross-duck',label:'直拳 · 下潜回守',description:'Jab setup, rear-hand cross, level-change defence and a compact hook return.',events:variantEvents({
  0:{kind:'jab',response:'block'},1:{kind:'cross',response:'duck'},2:{kind:'hook',response:'block'},3:{kind:'cross',response:'duck'},4:{kind:'cross',response:'duck'},5:{kind:'jab',response:'block'},6:{kind:'cross',response:'duck'},7:{kind:'hook',response:'block'},
 })}),
 Object.freeze({id:'cross-counter',label:'交叉攻防 · 抢时反击',description:'Jab/cross pressure is answered by an earlier cross counter during recovery.',events:variantEvents({
  0:{response:'block'},1:{response:'slip',direction:-1},2:{start:2.66,end:3.39,kind:'cross',response:'slip',direction:1},3:{kind:'hook',response:'block'},4:{response:'block'},5:{response:'slip',direction:1},6:{start:7.53,end:8.26,kind:'cross',response:'slip',direction:-1},7:{kind:'jab',response:'duck'},
 })}),
]);
const PHASE_LABELS={guard:'守架',jab:'左刺拳',cross:'右直拳',hook:'左短钩',slip:'侧闪',duck:'下潜',block:'格挡',recover:'恢复','counter-jab':'刺拳反击','counter-cross':'直拳反击','counter-hook':'短钩反击'};
export function sampleBoxingPair(seconds,pairIndex=0,{child=false}={}){
  pairIndex=mod(Math.floor(pairIndex),BOXING_PAIR_COUNT);
  const speed=child?.82:.91+.035*(pairIndex%5),offset=mod(pairIndex*.618033988749895,1)*BOXING_CYCLE_SECONDS;
  const t=mod(seconds*speed+offset,BOXING_CYCLE_SECONDS),variantIndex=pairIndex%BOXING_VARIANTS.length,variant=BOXING_VARIANTS[variantIndex];
  const actors=[0,1].map(fighter=>({fighter,jab:0,cross:0,hook:0,slip:0,duck:0,block:0,windup:0,counter:false,phase:t<.9?'guard':t>9.48||t>4.53&&t<5.82?'recover':'guard',opponentAction:'guard'}));
  for(const e of variant.events){const p=pulse(t,e.start,e.end),defence=pulse(t,e.start+.065,e.end+.17,.5);const a=actors[e.actor],d=actors[1-e.actor];a[e.kind]=Math.max(a[e.kind],p);a.windup+=pulse(t,e.start-.2,e.start+.06)*.12;a.counter ||= !!e.counter&&p>0;if(p>0){a.phase=(e.counter?'counter-':'')+e.kind;d.opponentAction=e.kind;}if(e.response==='slip')d.slip+=defence*e.direction;else d[e.response]=Math.max(d[e.response],defence);if(defence>.035&&d.jab+d.cross+d.hook<.03)d.phase=e.response;}
  for(const a of actors){a.attack=Math.max(a.jab,a.cross,a.hook);a.breath=Math.sin(t*PI*2/3+a.fighter*.65);a.child=child;a.label=PHASE_LABELS[a.phase]||a.phase;a.variant=variant.label;a.variantId=variant.id;a.variantIndex=variantIndex;}
  return {time:t,cycle:BOXING_CYCLE_SECONDS,pairIndex,phaseOffset:offset,speed,actors,child,variant:variant.label,variantId:variant.id,variantIndex};
}
// Each shuffle begins and ends with zero velocity/acceleration. Plant targets do
// not move between swing windows: there is no sinusoidal 'treadmill' foot drift.
const STEPS_L=[[.10,.44,-.118],[5.13,5.53,-.092],[10.0,10.4,-.118],[10.72,11.10,-.092]];
const STEPS_R=[[.53,.93,.074],[4.70,5.09,.10],[9.52,9.93,.074],[11.18,11.60,.10]];
function stepSample(t,side,child){let y=side==='L'?-.092:.10;const steps=side==='L'?STEPS_L:STEPS_R;for(const [start,end,target]of steps){if(t<start)break;if(t<end){const u=(t-start)/(end-start),s=smooth(u);return {y:mix(y,target,s),lift:Math.sin(PI*u)**2*(child?.009:.018),contact:false,swing:u};}y=target;}return {y,lift:0,contact:true,swing:0};}
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
export class BoxingRig {
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
  this.result={schema:'canonical-boxing-motion/1',posedMatrices:this.posedMatrices,skinMatrices:this.skinMatrices,rootTranslation:this.rootTranslation,footContacts:this.footContacts,pose:this.pose,metrics:this.metrics,state:null,source:BOXING_MOTION_PROVENANCE};
 }
 setRotation(name,x=0,y=0,z=0){const j=this.index.get(name);if(j!==undefined){const v=this.rotationDeltas[j];v[0]=x;v[1]=y;v[2]=z;}}
 fk(){const tmp=I();for(const j of this.order){const r=rotationVectorDegrees(this.rotationDeltas[j]),local=pivotMatrix(r,this.restP[j]),p=this.parents[j];if(p<0){this.skinMatrices[j].set(local);this.skinMatrices[j][3]+=this.rootTranslation[0];this.skinMatrices[j][7]+=this.rootTranslation[1];this.skinMatrices[j][11]+=this.rootTranslation[2];}else mul(this.skinMatrices[p],local,this.skinMatrices[j]);mul(this.skinMatrices[j],this.rest[j],this.posedMatrices[j]);}return tmp;}
 rotateSubtree(j,r,p=pos(this.posedMatrices[j])){for(const k of this.descendants[j]){rotateMatrixInPlace(this.posedMatrices[k],r,p);rotateMatrixInPlace(this.skinMatrices[k],r,p);}}
 orientSkin(j,absolute){const current=rotation(this.skinMatrices[j]),delta=mm3(absolute,tr(current));this.rotateSubtree(j,delta);}
 solveLimb(limb,target,pole,extension=.995){const p=pos(this.posedMatrices[limb.a]),solved=solveTwoBone(p,target,pole,limb.upper,limb.lower,{extension});this.rotateSubtree(limb.a,shortestArc(sub(pos(this.posedMatrices[limb.b]),p),sub(solved.joint,p)),p);const knee=pos(this.posedMatrices[limb.b]);this.rotateSubtree(limb.b,shortestArc(sub(pos(this.posedMatrices[limb.c]),knee),sub(solved.endpoint,knee)),knee);return solved;}
 evaluate(seconds,{pairIndex=0,fighter=0,child=this.child,intensity=1,contactIK=true,footLock=true,poseOutput=false,opponentStature=this.stature}={}){
  if(!Number.isFinite(seconds))throw Error('Boxing time must be finite');fighter=fighter?1:0;intensity=clamp(intensity,0,1.25);
  const pair=sampleBoxingPair(seconds,pairIndex,{child}),a=pair.actors[fighter],h=this.stature,t=pair.time,power=intensity*(child?.65:1),jab=a.jab*power,crossAmount=a.cross*power,hook=a.hook*power,duck=a.duck*power,slip=a.slip*power;
  this.result.state={...a,pairIndex:pair.pairIndex,cycleTime:t,phaseOffset:pair.phaseOffset,speed:pair.speed,mode:child?'light target practice':'responsive technical sparring',opponent:pair.actors[1-fighter]};
  for(const v of this.rotationDeltas)v.fill(0);
  const aimHeightOffset=clamp(.84*((Number.isFinite(opponentStature)&&opponentStature>0?opponentStature:h)-h),-h*.22,h*(child?.07:.10));
  this.result.state.targeting=opponentStature>h*1.12?'opponent torso level':'opponent head level';this.result.state.targetHeightOffset=aimHeightOffset;
  const yaw=-16+crossAmount*20-jab*7+hook*16;
  this.rootTranslation[0]=h*(slip*.023+(crossAmount-jab)*.008);
  this.rootTranslation[1]=h*(-.016-jab*.008-crossAmount*.016+duck*.009);
  this.rootTranslation[2]=-h*(.045+duck*.039)+h*.0013*a.breath;
  this.setRotation('root',1.5,0,yaw);
  this.setRotation('spine05',2+duck*3,slip*2,0);
  this.setRotation('spine04',2+duck*4,-slip*4,crossAmount*2-jab);
  this.setRotation('spine03',2+duck*5,-slip*4,crossAmount*3-jab*1.5+hook*2);
  this.setRotation('spine02',2+duck*3,-slip*3,crossAmount*3-jab*1.5+hook*3);
  this.setRotation('spine01',1+duck*2,-slip*2,crossAmount*2-jab+hook*3);
  this.setRotation('neck01',1-duck*2,slip*2,-yaw*.18);
  this.setRotation('neck02',1-duck*2,slip*2,-yaw*.17);
  this.setRotation('neck03',0,slip,-yaw*.12);
  this.setRotation('head',3-duck*2,slip,-yaw*.1);
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
   const limb=this.limbs['leg'+s],step=stepSample(t,s,child),rest=this.restP[limb.c],toeIndex=this.index.get('toe3-1.'+s),toeRest=this.restP[toeIndex],pitch=(s==='R'?crossAmount*.10:hook*.05),footYaw=side===1?-9*DEG:-3*DEG;
   const orient=mm3(axisRotation([0,0,1],footYaw),axisRotation([1,0,0],pitch));
   const base=[side*Math.max(h*.073,Math.abs(rest[0])*.78),step.y*h,rest[2]+step.lift*h];
   const footToe=sub(toeRest,rest),unpitched=mv(axisRotation([0,0,1],footYaw),footToe),pitched=mv(orient,footToe);
   // A planted rear foot can pivot at the toes; its contact point stays fixed.
   const target=step.contact?add(base,sub(unpitched,pitched)):base;
   const hip=pos(this.posedMatrices[limb.a]),pole=add(hip,[side*h*.025,-h*.35,-h*.05]);
   const solved=ikEnabled?this.solveLimb(limb,target,pole,.998):{reachError:0};if(ikEnabled)this.orientSkin(limb.c,orient);
   if(ikEnabled&&pitch>1e-5)for(let f=1;f<=5;f++){const j=this.index.get(`toe${f}-1.${s}`);if(j!==undefined)this.rotateSubtree(j,axisRotation([Math.cos(footYaw),Math.sin(footYaw),0],-pitch));}
   const actual=pos(this.posedMatrices[limb.c]),error=norm(sub(actual,target));maxFootError=Math.max(maxFootError,error);maxReachClamp=Math.max(maxReachClamp,solved.reachError);
   const contact=this.footContacts[s];contact.planted=step.contact;contact.locked=ikEnabled&&step.contact;contact.mode=step.contact?(pitch>.005?'toe-pivot':'flat'):'swing';contact.weight=step.contact?clamp(.5+(s==='L'?crossAmount*.2:-crossAmount*.2),.15,.85):0;contact.target=target;contact.position=actual;contact.error=error;contact.swing=step.swing;contact.toePosition=pos(this.posedMatrices[toeIndex]);contact.contactAnchor=step.contact?add(base,unpitched):null;contact.lockError=step.contact?norm(sub(contact.toePosition,contact.contactAnchor)):0;maxFootLockError=Math.max(maxFootLockError,contact.lockError);
  }
  for(const [s,side]of [['L',1],['R',-1]]){
   const limb=this.limbs['arm'+s],shoulder=pos(this.posedMatrices[limb.a]),head=pos(this.posedMatrices[this.index.get('head')]),reach=limb.upper+limb.lower,attack=s==='L'?Math.max(jab,hook):crossAmount;
   const guard=[head[0]+side*h*.062,head[1]-h*(s==='L'?.105:.088),head[2]-h*.074+a.block*h*.023];
   const straight=[head[0]+side*h*.015,shoulder[1]-reach*(child?.83:.94),head[2]-h*(child?.080:.052)+aimHeightOffset];
   let target=lerp(guard,straight,clamp(attack,0,1));
   if(s==='L'&&hook>.001){const hookTarget=[head[0]-h*.085,shoulder[1]-reach*.70,head[2]-h*.056+aimHeightOffset*.9];target=lerp(guard,hookTarget,clamp(hook,0,1));}
   const pole=add(shoulder,[side*h*(.105+hook*.055),-h*.02,-h*(.22-hook*.12)]);
   this.solveLimb(limb,target,pole,child?.94:.975);
   const forward=unit(lerp([side*.035,-.18,1],[0,-1,.06],clamp(attack,0,1)));
   const palm=unit(lerp([-side,0,-.12],[0,0,-1],clamp(attack,0,1)));
   this.orientSkin(limb.c,basisRotation(this.hand[s].forward,this.hand[s].palm,forward,palm));
  }
  this.metrics.contactIK=ikEnabled;this.metrics.maxFootLockError=maxFootLockError;this.metrics.maxAnkleTargetError=maxFootError;this.metrics.maxLegReachClamp=maxReachClamp;this.metrics.plantedFeet=Number(this.footContacts.L.planted)+Number(this.footContacts.R.planted);this.metrics.stature=h;this.metrics.shapeEvaluationsPerFrame=0;this.metrics.boneCount=this.count;
  if(poseOutput)this.exportNativePose(this.pose);else for(const key of Object.keys(this.pose))delete this.pose[key];
  return this.result;
 }
 /** Export exact native local-ref rotation vectors of the final IK skeleton. */
 exportNativePose(out={}){for(const j of this.order){const p=this.parents[j],r=rotation(this.skinMatrices[j]),local=p<0?r:mm3(tr(rotation(this.skinMatrices[p])),r);out[this.names[j]]={rotation:matrixToRotvec(local)};if(p<0)out[this.names[j]].translation=this.rootTranslation.slice();}return out;}
 /** O(J) diagnostic. Useful for test fixtures, not needed in the render loop. */
 validate(){let maxBoneLengthError=0,maxOrthogonalityError=0;for(let j=0;j<this.count;j++){const p=this.parents[j];if(p>=0)maxBoneLengthError=Math.max(maxBoneLengthError,Math.abs(norm(sub(pos(this.posedMatrices[j]),pos(this.posedMatrices[p])))-norm(sub(this.restP[j],this.restP[p]))));const r=rotation(this.skinMatrices[j]),m=mm3(r,tr(r));for(let k=0;k<9;k++)maxOrthogonalityError=Math.max(maxOrthogonalityError,Math.abs(m[k]-(k%4===0?1:0)));}return {finite:this.posedMatrices.every(m=>m.every(Number.isFinite))&&this.skinMatrices.every(m=>m.every(Number.isFinite)),maxBoneLengthError,maxOrthogonalityError,...this.metrics};}
}
export function createBoxingRig(options){return new BoxingRig(options);}

/** Calibrated against the 36 accepted presets and palm-centred R01 gloves.
 * Each separation conservatively keeps the nearest peak attack clear.
 * Child/teen target practice uses 12 cm rather than the adult 6.5 cm gap. */
export const BOXING_PAIR_RANGE=Object.freeze([{"pairIndex":0,"referenceAverageHeight":1.0385922342538834,"separation":0.7451829894882206,"clearance":0.12},{"pairIndex":1,"referenceAverageHeight":1.051154837012291,"separation":0.7344781602603649,"clearance":0.12},{"pairIndex":2,"referenceAverageHeight":1.0919053554534912,"separation":0.7435206678360323,"clearance":0.12},{"pairIndex":3,"referenceAverageHeight":1.583908349275589,"separation":1.0529964062660386,"clearance":0.12},{"pairIndex":4,"referenceAverageHeight":1.5863260626792908,"separation":1.019847383335449,"clearance":0.12},{"pairIndex":5,"referenceAverageHeight":1.5908218920230865,"separation":1.0078893596423317,"clearance":0.12},{"pairIndex":6,"referenceAverageHeight":1.7142891585826874,"separation":1.2326246546107247,"clearance":0.065},{"pairIndex":7,"referenceAverageHeight":1.7162680923938751,"separation":1.2182896230541345,"clearance":0.065},{"pairIndex":8,"referenceAverageHeight":1.7214924693107605,"separation":1.199372115580337,"clearance":0.065},{"pairIndex":9,"referenceAverageHeight":1.7142722010612488,"separation":1.213394686946074,"clearance":0.065},{"pairIndex":10,"referenceAverageHeight":1.7178281843662262,"separation":1.2122704325259441,"clearance":0.065},{"pairIndex":11,"referenceAverageHeight":1.7277375757694244,"separation":1.1892920785222039,"clearance":0.065},{"pairIndex":12,"referenceAverageHeight":1.6994035243988037,"separation":1.1752182931324968,"clearance":0.065},{"pairIndex":13,"referenceAverageHeight":1.7009539306163788,"separation":1.1897860378955087,"clearance":0.065},{"pairIndex":14,"referenceAverageHeight":1.715985655784607,"separation":1.1571339948332364,"clearance":0.065},{"pairIndex":15,"referenceAverageHeight":1.6841349005699158,"separation":1.1284757904643568,"clearance":0.065},{"pairIndex":16,"referenceAverageHeight":1.6857004761695862,"separation":1.1668211038928105,"clearance":0.065},{"pairIndex":17,"referenceAverageHeight":1.6938249468803406,"separation":1.1058538837772176,"clearance":0.065}].map(Object.freeze));
export const BOXING_PAIR_SEPARATIONS=Object.freeze(BOXING_PAIR_RANGE.map(row=>row.separation));
/** Locked to the current 36-preset catalogue; not a generalized collision solver. */
export function recommendPairSeparation(pairIndex){return BOXING_PAIR_SEPARATIONS[mod(Math.floor(pairIndex),BOXING_PAIR_COUNT)];}
