import {envelopeAt,shapePoint,volumeGroup,supportHem} from './HairVolumes.mjs';
import {unit,add,sub,mul,dot,len,mix,clamp,smooth} from './approved/LegacyFoundation.mjs';
import {point} from './NativeSurface.mjs';
// Authored guide field from a single frontal photograph. Hidden views are
// proposed construction, never camera-calibrated or recovered geometry.
export const PHOTO_STUDY=Object.freeze({id:'front-bob-01',sha256:'959b28381536f2b1fabb3683caaed71e8ccfbf8a994d2b7a344f1df0fecb2a91',width:688,height:832,view:'front',method:'manual-front-reference',observed:['near-central asymmetric part','open forehead and sparse loose fringe','rounded side silhouette','shoulder-level inward ends'],inferred:['back volume','side depth','crown flow','hidden hairline'],imagePublished:false});
const project=(v,n)=>sub(v,mul(n,dot(v,n)));
export function bobEmergence(p,r){const sign=p[0]>=r.partMM*.001?1:-1;return [sign*.10,-.025,p[2]<-.015?-.06:-.012];}
export function bobProfile(root,r){
 const p=root.chartP||root.p,part=r.partMM*.001,front=p[2]>.077&&p[1]>.333,central=front&&Math.abs(p[0]-part)<.013&&p[1]<.382,fringe=central||(front&&p[0]<part-.013&&p[0]>part-.055&&p[1]<.378);
 const phase=Math.sin(root.id*2.399963),hem=fringe?.314-r.bobFringeMM*.001+phase*.006:.122-r.bobLengthMM*.001+phase*.004;
 const sign=p[0]>=part?1:-1;let azimuth=Math.atan2(p[0]-part,p[2]-.008);if(Math.abs(azimuth)<.98)azimuth=sign*.98;return {kind:fringe?'fringe':'body',sign,hem,front,central,width:.084+r.bobWidthMM*.001,azimuth};
}
export function traceBob(builder,root,r){
 const e=builder.frames.get(root.id),profile=bobProfile(root,r),bvh=builder.bvh,step=.001,points=[...root.p],arc=[0];let p=root.p.slice(),dir=e.dir.slice(),s=0,contactSteps=0,maxCorrection=0;
 if(profile.kind==='body'){const env=envelopeAt(profile.hem,r),target=shapePoint(profile.hem,profile.azimuth,r),x=env.centerX+(target[0]-env.centerX)*.94,z=env.centerZ+(target[2]-env.centerZ)*.94;profile.designedHem=profile.hem;profile.hem=supportHem(bvh,x,z,profile.hem);}
 const normal=h=>unit(point(builder.head,h.t,h.b,builder.normals));
 for(let k=1;k<=480;k++){
  const remain=p[1]-profile.hem;if(k>12&&remain<=0)break;
  const h=bvh.nearest(p),n=normal(h),rootBlend=smooth((s-.002)/.022),sign=profile.sign;
  const sideGoal=profile.kind==='fringe'?(profile.central?root.p[0]+sign*.007:sign*.054):(shapePoint(p[1],profile.azimuth,r)[0]-envelopeAt(p[1],r).centerX)*.94+envelopeAt(p[1],r).centerX;
  let lateral=clamp((sideGoal-p[0])*20,-1.4,1.4),foreaft=0;
  if(profile.kind==='body'){
   const env=envelopeAt(p[1],r),goal=shapePoint(p[1],profile.azimuth,r),goalZ=env.centerZ+(goal[2]-env.centerZ)*.94;
   foreaft=clamp((goalZ-p[2])*11,-.55,.55);
   // Keep volume around the cheek/ear, then curl only the last 25 mm inward.
   if(remain<.028&&s>.04){const curl=(r.bobCurlMM*.001/.028)*smooth((.028-remain)/.028);lateral-=Math.sin(profile.azimuth)*curl;foreaft-=Math.cos(profile.azimuth)*curl;}
  }else foreaft=.08;
  let target=unit([lateral,-1,foreaft]);target=unit(mix(e.dir,target,rootBlend));
  const hitAhead=bvh.segmentHit(add(p,mul(dir,.00005)),add(p,mul(dir,.012)));
  if(hitAhead&&s>.001){const N=normal(bvh.nearest(hitAhead.point)),t=project(target,N);if(len(t)>1e-7)target=unit(add(unit(t),mul(N,.25)));}
  if(h.distance<.006&&dot(target,n)<.10){const t=project(target,n);if(len(t)>1e-8)target=unit(add(unit(t),mul(n,.14)));}
  let d=k<=2?e.dir:unit(mix(dir,target,1-Math.exp(-step/(r.bendMM*.001)))),q=add(p,mul(d,step)),corrected=false;
  for(let iteration=0;iteration<12;iteration++){
   const near=bvh.nearest(q),N=normal(near),gap=k===1?0:.0008,sg=dot(sub(q,near.p),N),hit=bvh.segmentHit(add(p,mul(sub(q,p),.0001)),q);
   if(!hit&&sg>=gap-1e-8)break;corrected=true;
   const needed=clamp((gap-dot(sub(p,near.p),N))/step,-1,1),t=project(d,N),T=len(t)>1e-8?unit(t):unit(project([sign,-1,0],N)),a=clamp(Math.max(needed+.025,0),0,.97);
   d=unit(add(mul(T,Math.sqrt(1-a*a)),mul(N,a)));q=add(p,mul(d,step));
  }
  if(bvh.segmentHit(add(p,mul(sub(q,p),.0001)),q)){
   const near=bvh.nearest(p),N=normal(near);let found=false;for(const lift of [.1,.2,.4,.6,.85,1]){const t=project(d,N),T=len(t)>1e-8?unit(t):[0,-1,0],v=unit(add(mul(T,1-lift),mul(N,lift))),end=add(p,mul(v,step));if(!bvh.segmentHit(add(p,mul(v,.000001)),end)){d=v;q=end;found=true;break;}}if(!found)throw Error('照片方案导向未能绕开原人物表面');
  }
  if(corrected)contactSteps++;maxCorrection=Math.max(maxCorrection,Math.acos(clamp(dot(dir,d),-1,1)));
  if(q[1]<profile.hem&&p[1]>profile.hem&&k>12)q=mix(p,q,(p[1]-profile.hem)/(p[1]-q[1]));
  s+=len(sub(q,p));points.push(...q);arc.push(s);p=q;dir=d;
 }
 return {rootId:root.id,face:root.f,barycentric:root.b,region:e.region,normal:e.n,tangent:e.t,emergence:e.dir,desiredAngle:e.requestedAngle,resolvedAngle:e.angle,rootAdjusted:e.clearanceAdjusted,singular:e.singular,points,arc,styleProfile:{...profile,rootGroup:volumeGroup(root.p[1],profile.azimuth,profile.hem),pathGroups:profile.kind==='fringe'?['fringe']:[volumeGroup(root.p[1],profile.azimuth,profile.hem),volumeGroup(.30,profile.azimuth,profile.hem),volumeGroup(profile.hem,profile.azimuth,profile.hem)]},gravityPreset:{mode:'authored frontal-reference bob construction; no dynamics',contactSteps,maxStepAngleDegrees:maxCorrection*180/Math.PI}};
}
