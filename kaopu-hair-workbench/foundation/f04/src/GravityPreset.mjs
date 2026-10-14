import {unit,add,sub,mul,dot,len,mix,clamp,smooth} from './approved/LegacyFoundation.mjs';
import {point} from './approved/BoundaryKernel.mjs';
const DOWN=[0,-1,0];
const project=(v,n)=>sub(v,mul(n,dot(v,n)));
const angle=(a,b)=>Math.acos(clamp(dot(a,b),-1,1));

/** Static, gravity-directed hanging preset. This constructs a guide reference;
 * it is NOT a dynamic rod solver or a material-calibrated equilibrium solution.
 * Gravity is world Y-down. Skin supplies only an exclusion constraint, never
 * an attractive force. Arc distance replaces F03's world-height release bands.
 */
export function traceHanging(builder,root,r){
 const e=builder.frames.get(root.id),bvh=builder.bvh,points=[...root.p],arc=[0],step=.001,clearance=.0004;
 const posterior=e.region===4||e.region===5,sign=root.p[0]>=r.partMM*.001?1:-1;
 let p=root.p.slice(),dir=e.dir.slice(),s=0,rootAdjusted=e.clearanceAdjusted,maxCorrection=0,contactSteps=0;
 const normal=h=>unit(point(builder.head,h.t,h.b,builder.normals));
 for(let k=1;k<=240;k++){
  const h=bvh.nearest(p),n=normal(h),rootBlend=smooth((s-.002)/.014),freeWeight=(1-Math.exp(-Math.max(0,s-.002)/.018))*r.gravity;
  let style=r.family==='swept'?[.06,-.35,-1]:r.family==='natural'?e.t:[sign,-.18,-.18];
  if(posterior)style=[Math.sign(root.p[0])*.025,-1,-.025];
  // Styling is a root/near-scalp preference. Released lengths settle toward
  // gravity rather than continuing a transverse part field behind the head.
  const styleWeight=(posterior?.1:.48)*Math.exp(-s/.050),desired=unit(add(mul(style,styleWeight),mul(DOWN,freeWeight)));
  let target=unit(mix(e.dir,desired,rootBlend));
  // Anticipate contact across the bend scale. Waiting until the next 1 mm
  // point hits an ear rim or shoulder produces a sharp, visible elbow.
  const look=.012,hitAhead=bvh.segmentHit(add(p,mul(dir,.00005)),add(p,mul(dir,look)));
  if(hitAhead&&s>.001){const N=normal(bvh.nearest(hitAhead.point)),t=project(target,N);if(len(t)>1e-7)target=unit(add(unit(t),mul(N,.22)));}
  if(h.distance<clearance+.006&&dot(target,n)<.08){const tangent=project(target,n),lift=.10*smooth((clearance+.006-h.distance)/.006);target=len(tangent)>1e-7?unit(add(unit(tangent),mul(n,lift))):unit(project(style,n));}
  const bend=1-Math.exp(-step/(r.bendMM*.001));let d=k<=2?e.dir:unit(mix(dir,target,bend));
  let q=add(p,mul(d,step)),corrected=false;
  for(let iteration=0;iteration<9;iteration++){
   const near=bvh.nearest(q),N=normal(near),sg=dot(sub(q,near.p),N),hit=bvh.segmentHit(add(p,mul(sub(q,p),.0001)),q),gap=k===1?0:clearance;
   if(!hit&&sg>=gap-1e-8)break;
   corrected=true;
   // Move the direction into a local contact half-space. Avoid the former
   // strong outward fallback which made shoulder/nape stair steps.
   const needed=clamp((gap-dot(sub(p,near.p),N))/step,-1,1),t=project(d,N),T=len(t)>1e-8?unit(t):unit(project(style,N)),a=clamp(Math.max(needed+.015,0),0,.95);
   d=unit(add(mul(T,Math.sqrt(1-a*a)),mul(N,a)));q=add(p,mul(d,step));
  }
  // Verify against original triangle geometry. Smooth vertex normals guide
  // construction, but they cannot waive a segment intersection.
  if(bvh.segmentHit(add(p,mul(sub(q,p),.0001)),q)){
   const near=bvh.nearest(p),N=normal(near);let found=false;
   for(const lift of [.08,.16,.30,.50,.75]){const t=project(d,N),T=len(t)>1e-8?unit(t):unit(project(style,N)),candidate=unit(add(mul(T,1-lift),mul(N,lift))),end=add(p,mul(candidate,step));if(!bvh.segmentHit(add(p,mul(candidate,step*.0001)),end)){d=candidate;q=end;found=true;break;}}
   if(!found)throw Error('静态下垂导向无法绕开原生表面；不移动毛根或修改已通过范围');
  }
  if(corrected)contactSteps++;maxCorrection=Math.max(maxCorrection,angle(dir,d));
  if(k===1&&len(sub(d,e.dir))>1e-5)rootAdjusted=true;
  s+=len(sub(q,p));points.push(...q);arc.push(s);p=q;dir=d;
 }
 return{rootId:root.id,face:root.f,barycentric:root.b,region:e.region,normal:e.n,tangent:e.t,emergence:e.dir,desiredAngle:e.requestedAngle,resolvedAngle:e.angle,rootAdjusted,singular:e.singular,points,arc,gravityPreset:{mode:'static gravity-directed construction; no dynamic solver',contactSteps,maxStepAngleDegrees:maxCorrection*180/Math.PI}};
}

