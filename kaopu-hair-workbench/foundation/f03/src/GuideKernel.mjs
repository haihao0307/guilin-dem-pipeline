/** F03: emergent directions and authored sparse rest guides on APPROVED F02.1.
 * Metres, native topology. No solver, dense followers, inferred biological
 * follicles or automatically reconstructed photograph are claimed here. */
import {SETTINGS,growth,enabled,point,V,normalArray,signature} from './approved/BoundaryKernel.mjs';
import {unit,add,sub,mul,dot,cross,len,mix,clamp,smooth} from './approved/LegacyFoundation.mjs';
import {TeacherSkinBVH} from './SurfaceQuery.mjs';
export const SCALP_LOCK='F02.1@ee3c7fac9f187dd9e5dc81d1363c4814b9a015a3';
export const REGIONS=['前额','左颞侧／鬓角','右颞侧／鬓角','冠部','后脑','后颈'];
export const COLORS=['#dcc08c','#76bfc1','#a2b4df','#adc898','#94b6d1','#c0a0be'];
export const DEFAULT=Object.freeze({schema:'kaopu/hair-guide-recipe@1',version:'F03',scalpLock:SCALP_LOCK,topology:SETTINGS.topology,rootBank:'a624b76f',family:'parted',partMM:0,whorlXMM:0,whorlZMM:-25,whorlTurn:25,rootAngleBias:0,lengths:[150,115,115,190,155,75],angles:[29,18,18,35,22,14],reference:{kind:'structural-fixture',note:'方向与长度测试；不是用户指定的完整照片发型'}});
export function validate(raw){
 if(!raw||raw.schema!==DEFAULT.schema||raw.scalpLock!==SCALP_LOCK||raw.topology!==DEFAULT.topology||raw.rootBank!==DEFAULT.rootBank)throw Error('方案必须引用已通过的 F02.1 范围与根点库');
 for(const k of Object.keys(raw))if(!(k in DEFAULT))throw Error('不支持的字段：'+k);
 if(!['natural','parted','swept'].includes(raw.family))throw Error('未知导向测试类型');
 const r=structuredClone(DEFAULT);for(const [k,a,b]of[['partMM',-24,24],['whorlXMM',-18,18],['whorlZMM',-45,-5],['whorlTurn',-70,70],['rootAngleBias',-6,15]]){if(!Number.isFinite(raw[k])||raw[k]<a||raw[k]>b)throw Error('数值越界：'+k);r[k]=raw[k];}
 for(const [k,a,b]of[['lengths',15,240],['angles',12,45]]){if(!Array.isArray(raw[k])||raw[k].length!==6||raw[k].some(v=>!Number.isFinite(v)||v<a||v>b))throw Error('区域参数无效：'+k);r[k]=raw[k].slice();}
 r.family=raw.family;return r;
}
export function region(p){if(p[1]<.265&&p[2]<-.01)return 5;if(p[1]>.373)return 3;if(p[2]<-.02)return 4;if(p[2]>.065&&Math.abs(p[0])<.058)return 0;return p[0]>=0?1:2;}
const tangent=(v,n,fallback)=>{const a=sub(v,mul(n,dot(v,n)));if(len(a)>1e-7)return unit(a);const b=sub(fallback,mul(n,dot(fallback,n)));return len(b)>1e-7?unit(b):unit(cross(n,[1,0,0]));};
export function emergence(p,n,r){
 const reg=region(p),dx=p[0]-r.whorlXMM*.001,dz=p[2]-r.whorlZMM*.001,rad=Math.hypot(dx,dz),crown=smooth((p[1]-.342)/.052),tw=r.whorlTurn*Math.PI/180*Math.exp(-rad/.067)*crown;
 let d=[dx-dz*tw,-.040-.07*(1-crown),dz+dx*tw];
 const burn=smooth((.332-p[1])/.042)*smooth((p[2]-.025)/.020)*smooth((Math.abs(p[0])-.044)/.027);
 d=mix(d,[Math.sign(p[0])*.016,-.13,.025],burn);
 const t=tangent(d,n,[0,0,1]),angle=clamp(r.angles[reg]+r.rootAngleBias,6,60),a=angle*Math.PI/180;
 return{t,n,dir:unit(add(mul(t,Math.cos(a)),mul(n,Math.sin(a)))),angle,region:reg,singular:rad<.003&&p[1]>.382};
}
function safePoint(p,q,bvh,clearance=.00025){
 const ds=len(sub(q,p));if(ds<1e-9)return q;let d=unit(sub(q,p));
 for(let j=0;j<7;j++){
  const h=bvh.nearest(q),sg=dot(sub(q,h.p),h.n),hit=bvh.segmentHit(add(p,mul(sub(q,p),.0001)),q);
  if(sg>=clearance-1e-7&&!hit)return q;
  if(hit){const t=tangent(d,hit.normal,[0,-1,0]);d=unit(add(mul(t,.68),mul(hit.normal,.72)));q=add(p,mul(d,ds));}
  else{q=add(q,mul(h.n,clearance-sg+.00006));d=unit(sub(q,p));q=add(p,mul(d,ds));}
 }
 // Conservative construction fallback, not a physical collision response.
 const n=bvh.nearest(p).n;
 for(const w of[.25,.5,.75,1]){q=add(p,mul(unit(mix(d,n,w)),ds));if(!bvh.segmentHit(add(p,mul(sub(q,p),.0001)),q)&&dot(sub(q,bvh.nearest(q).p),bvh.nearest(q).n)>=-1e-8)return q;}
 throw Error('导向曲线无法找到无穿面延续；不扩大生长域掩盖错误');
}
export function selectGuides(roots,count=192){
 const available=roots.filter(r=>enabled(r,SETTINGS)),chosen=[],dist=new Float64Array(available.length).fill(Infinity),used=new Uint8Array(available.length);
 // Region seeds ensure thin sideburn/nape areas are represented too.
 for(let reg=0;reg<6;reg++){const i=available.findIndex(r=>region(r.p)===reg);if(i>=0&&!used[i]){chosen.push(available[i]);used[i]=1;}}
 let last=0;while(chosen.length<count){for(;last<chosen.length;last++){const p=chosen[last].p;for(let i=0;i<available.length;i++){const q=available[i].p,d=(p[0]-q[0])**2+(p[1]-q[1])**2+(p[2]-q[2])**2;dist[i]=Math.min(dist[i],d);}}let best=-1,b=-1;for(let i=0;i<available.length;i++)if(!used[i]&&dist[i]>b){b=dist[i];best=i;}used[best]=1;chosen.push(available[best]);}return chosen;
}
function groomDirection(p,n,root,r,near,s){
 const sign=root.p[0]>=r.partMM*.001?1:-1;
 let desire=r.family==='natural'?emergence(p,n,r).t:r.family==='swept'?[.14,-.10,-1]:[sign,.0,-.13];
 if(p[1]<.34)desire=r.family==='natural'?[Math.sign(p[0])*.08,-1,-.06]:[Math.sign(p[0])*.11,-1,-.10];
 // Keep initial skin emergence distinct from sculpted part direction.
 let t=tangent(desire,n,[0,-1,0]),surface=unit(add(t,mul(n,.025))),free=[Math.sign(p[0])*.015,-1,-.025];
 const released=smooth((near-.005)/.011);return unit(mix(surface,free,released));
}
export class GuideBuilder{
 constructor(head,roots,normals){this.head=head;this.roots=roots;this.normals=normals;this.guides=selectGuides(roots);this.bvh=new TeacherSkinBVH({template:head.positions,triangles:head.triangles,componentId:head.components});this.key=null;this.paths=null;this.pathBuilds=0;}
 resolve(root,r){const n=unit(point(this.head,root.f,root.b,this.normals)),e=emergence(root.p,n,r);e.requestedAngle=e.angle;e.clearanceAdjusted=false;
  for(let angle=e.angle;angle<=86;angle+=2){const rad=angle*Math.PI/180,dir=unit(add(mul(e.t,Math.cos(rad)),mul(e.n,Math.sin(rad))));if(!this.bvh.segmentHit(add(root.p,mul(dir,.00005)),add(root.p,mul(dir,.008))))return{rootId:root.id,p:root.p,...e,dir,angle,clearanceAdjusted:angle>e.requestedAngle};}
  throw Error('局部出根探针无法绕开当前耳廓；保留已通过范围，不挪根');
 }
 build(raw){const r=validate(raw),start=performance.now(),ekey=JSON.stringify([r.angles,r.rootAngleBias,r.whorlXMM,r.whorlZMM,r.whorlTurn]);
 if(this.emergenceKey!==ekey){this.probes=this.roots.filter(root=>enabled(root,SETTINGS)).map(root=>this.resolve(root,r));this.frames=new Map(this.probes.map(e=>[e.rootId,e]));this.emergenceKey=ekey;}
 const key=JSON.stringify({...r,lengths:[]}),cache=this.key===key;
 if(!cache){this.paths=this.guides.map(root=>this.trace(root,r));this.key=key;this.pathBuilds++;}
 const curves=this.paths.map((g,i)=>{const wanted=r.lengths[g.region]*.001,points=g.points.slice(0,3),sums=g.arc;let j=1;while(j<sums.length&&sums[j]<wanted-1e-9){points.push(...g.points.slice(j*3,j*3+3));j++;}if(j<sums.length){const t=(wanted-sums[j-1])/(sums[j]-sums[j-1]);points.push(...mix(g.points.slice((j-1)*3,j*3),g.points.slice(j*3,j*3+3),t));}let actual=0;for(let k=3;k<points.length;k+=3)actual+=len(sub(points.slice(k,k+3),points.slice(k-3,k)));return{...g,points,arc:undefined,requestedMM:wanted*1000,actualMM:actual*1000};});
 const probes=this.probes;
 return{recipe:r,curves,probes,cacheHit:cache,pathBuilds:this.pathBuilds,buildMS:performance.now()-start,rootBankSignature:signature(this.roots.flatMap(r=>[r.f,...r.b])),scalpLock:SCALP_LOCK,rangeChanged:false,physicsSteps:0};
 }
 trace(root,r){const e=this.frames.get(root.id),points=[...root.p],arc=[0];let p=root.p.slice(),dir=e.dir,dist=0,rootAdjusted=e.clearanceAdjusted;
 for(let k=1;k<=120;k++){const ds=.002;let desired=dir;if(k>2){const h=this.bvh.nearest(p),g=groomDirection(p,h.n,root,r,h.distance,dist),blend=.18*smooth((dist-.002)/.012);desired=unit(mix(dir,g,blend));}
  const next=safePoint(p,add(p,mul(desired,ds)),this.bvh,k===1?0:.00022);if(k===1&&len(sub(unit(sub(next,p)),e.dir))>1e-5)rootAdjusted=true;dir=unit(sub(next,p));dist+=len(sub(next,p));points.push(...next);arc.push(dist);p=next;}
 return{rootId:root.id,face:root.f,barycentric:root.b,region:e.region,normal:e.n,tangent:e.t,emergence:e.dir,desiredAngle:e.requestedAngle,resolvedAngle:e.angle,rootAdjusted,singular:e.singular,points,arc};
 }
 audit(result,probeMM=6){let crossing=0,total=0,minClearance=Infinity,probeCrossings=0,rootDrift=0,lengthError=0;const bad=[];
 for(const c of result.curves){const rr=this.roots[c.rootId];rootDrift=Math.max(rootDrift,len(sub(V(c.points,0),rr.p)));lengthError=Math.max(lengthError,Math.abs(c.actualMM-c.requestedMM));for(let j=1;j<c.points.length/3;j++){const p=V(c.points,j-1),q=V(c.points,j);const h=this.bvh.segmentHit(add(p,mul(sub(q,p),j===1?.015:.00001)),q);total++;if(h){crossing++;bad.push([c.rootId,j]);}if(j>1){const h=this.bvh.nearest(q);minClearance=Math.min(minClearance,dot(sub(q,h.p),h.n));}}}
 for(const p of result.probes){const q=add(p.p,mul(p.dir,probeMM*.001));if(this.bvh.segmentHit(add(p.p,mul(p.dir,.00005)),q))probeCrossings++;}
 return{curveCount:result.curves.length,testedSegments:total,centerlineCrossings:crossing,badSegments:bad,probeCount:result.probes.length,probeMM,probeCrossings,rootDriftMM:rootDrift*1000,maxLengthErrorMM:lengthError,minEndpointSignedClearanceMM:minClearance*1000,method:'exact current native triangle centerline check; not swept CCD; signed nearest normal is not a closed solid',positiveControl:!!this.bvh.segmentHit([0,.46,.015],[0,.33,.015])};
 }
}
