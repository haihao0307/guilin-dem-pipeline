import {bobProfile,bobEmergence,goalAtHeight} from './PortraitBob.mjs';
import {point} from './NativeSurface.mjs';
import {add,sub,mul,mix,dot,len,unit,smooth,clamp} from './approved/LegacyFoundation.mjs';
const project=(v,n)=>sub(v,mul(n,dot(v,n)));
export function traceRootFlow(node,id,clumpId,recipe,builder){
 builder.flowPlanes??=new Map();const cache=builder.flowPlanes;
 function nearest(p){const h=.002,key=p.map(v=>Math.round(v/h)),k=key.join(',');let plane=cache.get(k);if(!plane){const h=builder.bvh.nearest(key.map(v=>v*.002));plane={p:h.p,n:unit(point(builder.head,h.t,h.b,builder.normals))};cache.set(k,plane);}return {...plane,distance:len(sub(p,plane.p)),signed:dot(sub(p,plane.p),plane.n)};}
 const profile=bobProfile({...node,bundleId:id,clumpId},recipe,builder.bvh),normal=unit(point(builder.head,node.f,node.b,builder.normals)),t=unit(project(bobEmergence(node.chartP,recipe),normal)),initial=unit(add(mul(t,.94),mul(normal,.34))),points=[node.p.slice()],arcs=[0];let p=node.p.slice(),dir=initial,arc=0;
 for(let k=0;k<260;k++){
  const remain=p[1]-profile.hem;if(k>8&&remain<=0)break;const step=arc<.016?.0013:.0025,h=nearest(p),goal=goalAtHeight(profile,p[1]-.014),drop=profile.route&&p[1]<profile.waypoint[1]+.015?.020:Math.max(.025,p[1]-Math.max(profile.hem,profile.waypoint[1]));
  let wanted=unit([clamp((profile.kind==='fringe'?1.55:1)*(goal[0]-p[0])/Math.max(.025,drop),-1.5,1.5),-1,clamp((goal[2]-p[2])/Math.max(.025,drop),-1.2,1.2)]);
  if(profile.kind==='body'&&remain<.025&&arc>.040){const curl=recipe.bobCurlMM*.001/.025*(profile.curlScale??1)*smooth((.025-remain)/.025);wanted=unit(add(wanted,[-profile.sign*curl,0,profile.layer==='back'||profile.layer==='nape'?curl*.25:-curl*.25]));}
  const blend=smooth((arc-(profile.kind==='fringe'?.003:.006))/(profile.kind==='fringe'?.020:.038));wanted=unit(mix(initial,wanted,blend));if(h.distance<.008&&dot(wanted,h.n)<.12){const v=project(wanted,h.n);if(len(v)>1e-8)wanted=unit(add(unit(v),mul(h.n,.12)));}
  // Steer toward the scalp-relative support before the continuous direction
  // filter. Projecting finished points back onto a height cap creates kinks.
  const support=smooth((p[1]-.338)/.030)*smooth((node.chartP[1]-.345)/.030),lift=.0048+.0012*Math.sin(node.chartP[0]*71+node.chartP[2]*37);
  if(h.distance<.030&&h.signed>lift&&support>0)wanted=unit(sub(wanted,mul(h.n,clamp((h.signed-lift)/.010,0,.9)*support)));
  dir=unit(mix(dir,wanted,1-Math.exp(-step/.018)));let q=add(p,mul(dir,step));for(let j=0;j<2;j++){const f=nearest(q),gap=Math.min(.0012,arc*.10);if(f.signed>=gap)break;q=add(q,mul(f.n,gap-f.signed));}
  if(q[1]<profile.hem&&p[1]>profile.hem&&k>8)q=mix(p,q,(p[1]-profile.hem)/(p[1]-q[1]));arc+=len(sub(q,p));points.push(q);arcs.push(arc);dir=unit(sub(q,p));p=q;
 }
 return {points,arcs,length:arc,at(u){const d=clamp(u)*arc;let lo=0,hi=arcs.length-1;while(lo+1<hi){const m=(lo+hi)>>1;if(arcs[m]<d)lo=m;else hi=m;}return mix(points[lo],points[hi],(d-arcs[lo])/Math.max(1e-9,arcs[hi]-arcs[lo]));}};
}
