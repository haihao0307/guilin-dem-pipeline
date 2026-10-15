import {bundleOf,bundleSpec} from './BundlePlan.mjs';
import {unit,add,sub,mul,dot,len,mix,clamp,smooth} from './approved/LegacyFoundation.mjs';
import {point} from './NativeSurface.mjs';
export const PHOTO_STUDY=Object.freeze({id:'front-bob-bundle-regions-03',sha256:'959b28381536f2b1fabb3683caaed71e8ccfbf8a994d2b7a344f1df0fecb2a91',width:688,height:832,view:'front',method:'direct-3D-authoring-from-user-photo-and-user-bundle-examples',observed:['asymmetric near-central part','diagonal image-left fringe and sparse central wisps','long face-framing layer inside outer shoulder-length layer','rounded sides with inward ends'],inferred:['all concealed scalp root patches','back layers and depth','occluded inner layers'],imagePublished:false});
const project=(v,n)=>sub(v,mul(n,dot(v,n)));
export function bobEmergence(p,r){
 const id=bundleOf({chartP:p},r),sign=p[0]>=r.partMM*.001?1:-1;
 if(id==='bang-sweep')return [-.065,-.06,.03];
 if(id==='bang-wisps')return [.012,-.08,.03];
 if(id.startsWith('back')||id==='nape')return [p[0]*.4,-.045,-.10];
 return [sign*.10,-.035,id.startsWith('frame')?.025:-.008];
}
export function bobProfile(root,r,bvh=null){
 const id=root.bundleId||bundleOf(root,r),spec=bundleSpec(id),p=root.p,c=root.chartP||p,sign=id.endsWith('left')||id==='bang-sweep'?-1:id.endsWith('right')||id==='bang-wisps'?1:c[0]>=r.partMM*.001?1:-1,phase=Math.sin(c[0]*85+c[2]*51),jitter=phase*.005+r.bobTuftMM*.00035*Math.sin(c[2]*110);
 let target,waypoint;
 const extra=(sign<0?r.bobLeftMM:r.bobRightMM)*.001,u=clamp(Math.abs(c[0])/.078,0,1),v=clamp((c[2]+.027)/.092,0,1),accent=Math.pow(.5+.5*Math.sin(v*Math.PI*3+(sign<0?0:1.2)),6)*smooth((u-.45)/.45),w=(r.bobWidthMM-10)*.001+r.bobTuftMM*.001*accent;
 if(id==='bang-sweep'){
  target=[clamp(p[0]*.65-.027,-.065,-.018),.306-r.bobFringeMM*.001+jitter+(p[0]+.03)*.20,.130];
  waypoint=[mix(p,target,.55)[0],p[1]-.020,.124];
 }else if(id==='bang-wisps'){
  target=[p[0]+.006,.320-r.bobFringeMM*.001+phase*.010,.132];waypoint=[p[0]+.003,p[1]-.018,.126];
 }else if(id.startsWith('frame')){
  const spread=clamp((c[0]*sign-.012)/.055,0,1);
  waypoint=[sign*(.074+.027*u+extra+w*.6),.290,.098+clamp((c[2]-.065)/.05,0,1)*.015];target=[sign*(.068+.029*u+extra+w*.6),.123-r.bobLengthMM*.001+jitter,.071+clamp((c[2]-.065)/.05,0,1)*.023];
 }else if(id.startsWith('outer')){
  const depth=clamp((c[2]+.027)/.092,0,1);
  waypoint=[sign*(.095+.023*u+extra+w),.290,-.060+depth*.143];target=[sign*(.087+.025*u+extra+w),.126-r.bobLengthMM*.001+jitter,-.059+depth*.140];
 }else if(id.startsWith('under')){
  const depth=clamp((c[2]+.027)/.092,0,1);
  waypoint=[sign*(.086+extra+w*.4),Math.min(.278,p[1]-.012),-.024+depth*.08];target=[sign*(.076+extra+w*.4),.151-r.bobLengthMM*.001+jitter,-.025+depth*.065];
 }else if(id.startsWith('back')){
  const x=clamp(p[0]*1.25,-.080,.080),depth=clamp(Math.abs(c[0])/.078,0,1);
  waypoint=[x,.286,-.099+depth*.020-r.bobBackMM*.001];target=[x*.94,.142-r.bobLengthMM*.001+jitter,-.098+depth*.020-r.bobBackMM*.001];
 }else{
  waypoint=[p[0]*1.08,p[1]-.025,-.086-r.bobBackMM*.001];target=[p[0]*1.12,.168-r.bobLengthMM*.001+jitter,-.088-r.bobBackMM*.001];
 }
 // Individual endpoint support against the native person, not a shell trim.
 if(spec.kind==='body'&&bvh){const h=bvh.segmentHit([target[0],.205,target[2]],[target[0],target[1]-.012,target[2]]);if(h&&h.point[1]>target[1])target[1]=h.point[1]+.005;}
 return {kind:spec.kind,bundleId:id,rootGroup:id,pathGroups:[id],sign,layer:spec.layer,evidence:spec.evidence,outlineAccent:accent>.65,tipVariationMM:jitter*1000,target,waypoint,hem:target[1],central:id==='bang-wisps'};
}
export function traceBob(builder,root,r){
 const e=builder.frames.get(root.id),profile=bobProfile(root,r,builder.bvh),bvh=builder.bvh,step=.001,points=[...root.p],arc=[0];let p=root.p.slice(),dir=e.dir.slice(),s=0,contactSteps=0,maxCorrection=0;
 const normal=h=>unit(point(builder.head,h.t,h.b,builder.normals));
 for(let k=1;k<=480;k++){
  const remain=p[1]-profile.hem;if(k>12&&remain<=0)break;
  const h=bvh.nearest(p),n=normal(h),rootBlend=smooth((s-.003)/.018),sign=profile.sign;
  const towardTip=smooth((profile.waypoint[1]+.028-p[1])/.095),goal=mix(profile.waypoint,profile.target,towardTip);
  const drop=profile.kind==='body'?Math.max(.020,p[1]-Math.max(profile.hem,profile.waypoint[1])):Math.max(.012,p[1]-profile.hem);
  let target=unit([clamp((goal[0]-p[0])/Math.max(.025,drop),-1.5,1.5),-1,clamp((goal[2]-p[2])/Math.max(.025,drop),-1.2,1.2)]);
  // Tip bend is part of the SAME path, never a separate surface-face group.
  if(profile.kind==='body'&&remain<.025&&s>.040){const curl=r.bobCurlMM*.001/.025*smooth((.025-remain)/.025);target=unit(add(target,[-sign*curl,0,profile.layer==='back'||profile.layer==='nape'?curl*.25:-curl*.25]));}
  target=unit(mix(e.dir,target,rootBlend));
  const hitAhead=bvh.segmentHit(add(p,mul(dir,.00005)),add(p,mul(dir,.012)));
  if(hitAhead&&s>.001){const N=normal(bvh.nearest(hitAhead.point)),t=project(target,N);if(len(t)>1e-7)target=unit(add(unit(t),mul(N,.25)));}
  if(h.distance<.005&&dot(target,n)<.10){const t=project(target,n);if(len(t)>1e-8)target=unit(add(unit(t),mul(n,.14)));}
  let d=k<=2?e.dir:unit(mix(dir,target,1-Math.exp(-step/(r.bendMM*.001)))),q=add(p,mul(d,step)),corrected=false;
  for(let iteration=0;iteration<12;iteration++){
   const near=bvh.nearest(q),N=normal(near),gap=k===1?0:.0008,sg=dot(sub(q,near.p),N),hit=bvh.segmentHit(add(p,mul(sub(q,p),.0001)),q);
   if(!hit&&sg>=gap-1e-8)break;corrected=true;
   const needed=clamp((gap-dot(sub(p,near.p),N))/step,-1,1),t=project(d,N),T=len(t)>1e-8?unit(t):unit(project([sign,-1,0],N)),a=clamp(Math.max(needed+.025,0),0,.97);
   d=unit(add(mul(T,Math.sqrt(1-a*a)),mul(N,a)));q=add(p,mul(d,step));
  }
  if(bvh.segmentHit(add(p,mul(sub(q,p),.0001)),q)){
   const near=bvh.nearest(p),N=normal(near);let found=false;for(const lift of [.1,.2,.4,.6,.85,1]){const t=project(d,N),T=len(t)>1e-8?unit(t):[0,-1,0],v=unit(add(mul(T,1-lift),mul(N,lift))),end=add(p,mul(v,step));if(!bvh.segmentHit(add(p,mul(v,.000001)),end)){d=v;q=end;found=true;break;}}if(!found)throw Error('发束导向未能绕开原人物表面');
  }
  if(corrected)contactSteps++;maxCorrection=Math.max(maxCorrection,Math.acos(clamp(dot(dir,d),-1,1)));
  if(q[1]<profile.hem&&p[1]>profile.hem&&k>12)q=mix(p,q,(p[1]-profile.hem)/(p[1]-q[1]));
  s+=len(sub(q,p));points.push(...q);arc.push(s);p=q;dir=d;
 }
 if(p[1]-profile.hem>.00001)throw Error('发束没有达到终点；请减小造型调整，保留旧方案');
 return {rootId:root.id,face:root.f,barycentric:root.b,region:e.region,bundleId:profile.bundleId,normal:e.n,tangent:e.t,emergence:e.dir,desiredAngle:e.requestedAngle,resolvedAngle:e.angle,rootAdjusted:e.clearanceAdjusted,singular:e.singular,points,arc,styleProfile:profile,gravityPreset:{mode:'authored root-patch -> full continuous path -> tip; no dynamics',contactSteps,maxStepAngleDegrees:maxCorrection*180/Math.PI}};
}
