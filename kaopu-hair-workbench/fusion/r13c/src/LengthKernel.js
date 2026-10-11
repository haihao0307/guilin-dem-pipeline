import {partSign,canInterpolate,trimLength,rootVisibility,enforceTrim,growthDirection,coherentPhase,TOPOLOGY_SPEC} from './GroomTopology.js';
import {HeadSegmentGuard} from './HeadSegmentGuard.js';
import {NeutralEarGuard} from './NeutralEarGuard.js';
/** R13 self-authored length-conditioned rest-groom compiler.
 * Teachers: Perm global/local separation and root-relative curves;
 * Digital Salon guide/follower split, parallel-transport frames and collision field.
 * No PCA/neural weights, source hairstyle, CUDA solver or physical dynamics.
 */
import {FullerScalpBinding} from './HairLayer.js';
import {TeacherSkinBVH} from './TeacherGroomBinding.js';
import {scalpMargin} from './RegionFields.js';
export const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
export const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t)};
const mix=(a,b,t)=>a+(b-a)*t;
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const add=(a,b)=>a.map((v,k)=>v+b[k]);
const sub=(a,b)=>a.map((v,k)=>v-b[k]);
const mul=(a,t)=>a.map(v=>v*t);
export const unit=a=>{const d=Math.hypot(...a);return d>1e-10?a.map(v=>v/d):[0,1,0]};
const blend=(a,b,t)=>a.map((v,k)=>mix(v,b[k],t));
export function random01(id){let x=Math.imul(id+13,0x45d9f3b);x=Math.imul(x^(x>>>16),0x45d9f3b);return ((x^(x>>>16))>>>0)/4294967296;}
export function hashArray(a){let h=2166136261;for(const v of new Uint8Array(a.buffer,a.byteOffset,a.byteLength))h=Math.imul(h^v,16777619);return h>>>0;}
export const PRESETS={
 'textured-fringe':{name:'微分碎盖 · 耳侧收短',lengthMM:85,partMM:-7,partOpen:8,volumeMM:10,sideRatio:32,backRatio:40,fringeRatio:62,clump:25,waveMM:.40,tipVariation:22,flow:10,sideburnMM:14,napeMM:18},
 'side-flow':{name:'自然侧分 · 冠部后收',lengthMM:110,partMM:-24,partOpen:28,volumeMM:12,sideRatio:34,backRatio:43,fringeRatio:73,clump:22,waveMM:.28,tipVariation:16,flow:46,sideburnMM:16,napeMM:20},
 'curtain-layer':{name:'中分层次 · 短鬓角',lengthMM:135,partMM:0,partOpen:44,volumeMM:12,sideRatio:42,backRatio:50,fringeRatio:82,clump:23,waveMM:.45,tipVariation:17,flow:60,sideburnMM:18,napeMM:24}
};
export const RANGES={sideburnMM:[4,30],napeMM:[6,40],lengthMM:[45,160],partMM:[-40,40],partOpen:[0,100],volumeMM:[4,30],sideRatio:[20,90],backRatio:[20,100],fringeRatio:[50,120],clump:[0,65],waveMM:[0,1.5],tipVariation:[0,35],flow:[0,100],density:[30,100],width:[60,150],roughness:[25,75]};
export function validateRecipe(recipe){
 if(!recipe||typeof recipe!=='object'||!Object.hasOwn(PRESETS,recipe.style))throw Error('未知发型');
 for(const key of Object.keys(recipe))if(!['style','color','name',...Object.keys(RANGES)].includes(key))throw Error('未知参数：'+key);
 const d={...PRESETS[recipe.style],density:100,width:100,roughness:48,color:'#291c12',...recipe};delete d.name;
 for(const[k,[lo,hi]]of Object.entries(RANGES)){if(!Number.isFinite(d[k])||d[k]<lo||d[k]>hi)throw Error('参数超出范围：'+k);}
 if(!/^#[0-9a-f]{6}$/i.test(d.color))throw Error('发色无效');
 return d;
}
// Exact R12 neutral root domain / area weighting / follicular-unit random sequence.
// Only omit the old clipped surface paths; new guides must leave the scalp.
class RootSet extends FullerScalpBinding{setStyle(style){this.style=style}}
export function makeRootSet(model,count=64000){return new RootSet(model,{count,segments:1,seed:724,length:.13});}
const normalAt=(b,i)=>unit(b.point(b.rootTriangles[i],b.rootBarycentrics.subarray(i*3,i*3+3),b.templateNormals));
export const partSide=partSign;
export function regionAt(p){const[x,y,z]=p;return y>.355?'crown':z>.065&&Math.abs(x)<.06?'fringe':z<-.025?'back':x<0?'right':'left';}
export function lengthAt(p,d,r=.5){
 const crown=smooth(.305,.365,p[1]),frontal=smooth(.025,.08,p[2])*(1-smooth(.045,.083,Math.abs(p[0]))),rear=1-smooth(-.045,.01,p[2]);
 const lower=mix(d.sideRatio,d.backRatio,rear)/100;
 let scale=mix(lower,1,crown);scale=mix(scale,d.fringeRatio/100,frontal*.85);
 scale*=mix(.46,1,smooth(.0003,.010,scalpMargin(p)));
 return trimLength(p,d,d.lengthMM*.001*scale*(1-d.tipVariation*.01*(.5-r)));
}
/** Deterministic minimal-rotation transport; no random perturbation on straight segments. */
export function transportFrame(axis,t0,t1){
 const a=unit(t0),b=unit(t1),v=cross(a,b),c=clamp(dot(a,b),-1,1);
 let result;
 if(c<-.99999){const aux=unit(cross(a,Math.abs(a[0])<.8?[1,0,0]:[0,1,0]));result=sub(mul(aux,2*dot(aux,axis)),axis)}
 else{result=add(add(axis,cross(v,axis)),mul(cross(v,cross(v,axis)),1/Math.max(1e-8,1+c)));}
 const projected=sub(result,mul(b,dot(result,b)));return Math.hypot(...projected)>1e-9?unit(projected):unit(cross(b,Math.abs(b[0])<.8?[1,0,0]:[0,1,0]));
}
/** Lazy actual-triangle signed-distance cache, 3mm cells and trilinear interpolation.
 * Approximate neutral-head obstacle field, not a dynamic or full-body collision claim.
 */
export class SkinField{
 constructor(model){this.earGuard=new NeutralEarGuard(model);this.bvh=new TeacherSkinBVH(model);this.headGuard=new HeadSegmentGuard(this.bvh);this.step=.003;this.origin=[-.18,.14,-.20];this.dims=[121,121,151];this.values=new Map();this.samples=0;}
 corner(x,y,z){const key=x+this.dims[0]*(y+this.dims[1]*z);let v=this.values.get(key);if(v)return v;const p=[x,y,z].map((n,k)=>this.origin[k]+n*this.step),h=this.bvh.nearest(p);v=[dot(sub(p,h.p),h.n),...h.n];this.values.set(key,v);return v;}
 sample(p){const u=p.map((x,k)=>(x-this.origin[k])/this.step),c=u.map(Math.floor),f=u.map((x,k)=>x-c[k]),out=[0,0,0,0];
  if(c.some((x,k)=>x<0||x>=this.dims[k]-1)){const h=this.bvh.nearest(p);return{distance:dot(sub(p,h.p),h.n),normal:h.n};}
  for(let a=0;a<2;a++)for(let b=0;b<2;b++)for(let e=0;e<2;e++){const v=this.corner(c[0]+a,c[1]+b,c[2]+e),w=(a?f[0]:1-f[0])*(b?f[1]:1-f[1])*(e?f[2]:1-f[2]);for(let k=0;k<4;k++)out[k]+=w*v[k];}
  this.samples++;return{distance:out[0],normal:unit(out.slice(1))};
 }
 project(p,gap=.0007){let result=p;for(let it=0;it<3;it++){const q=this.sample(result);if(q.distance>=gap)break;result=add(result,mul(q.normal,gap-q.distance));}return result;}
}
export const fieldDirection=growthDirection;

const pause=()=>new Promise(r=>setTimeout(r,0));
function guard(cancel){if(cancel?.())throw new DOMException('已取消旧生成','AbortError');}
export function selectGuideRoots(b,spacing=.008){
 const ids=[],bins=new Map(),key=(x,y,z)=>`${x},${y},${z}`;
 for(let i=0;i<b.count;i++){
  const p=b.templateRoots.subarray(i*3,i*3+3),c=Array.from(p,v=>Math.floor(v/spacing));let near=false;
  for(let x=-1;x<=1&&!near;x++)for(let y=-1;y<=1&&!near;y++)for(let z=-1;z<=1&&!near;z++)for(const id of bins.get(key(c[0]+x,c[1]+y,c[2]+z))||[]){const q=b.templateRoots.subarray(id*3,id*3+3);if(Math.hypot(...sub(p,q))<spacing){near=true;break}}
  if(!near){ids.push(i);const k=key(...c);if(!bins.has(k))bins.set(k,[]);bins.get(k).push(i);}
 }
 return ids;
}
function makeGuide(b,id,d,skin,segments){
 const root=Array.from(b.templateRoots.subarray(id*3,id*3+3)),n=normalAt(b,id),rng=random01(id),length=lengthAt(root,d,rng),ds=length/segments,pts=[add(root,mul(n,.00002))],front=smooth(.025,.075,root[2])*(1-smooth(.05,.08,Math.abs(root[0]))),top=smooth(.325,.375,root[1]);
 let direction=fieldDirection(root,root,d),tan=unit(sub(direction,mul(n,dot(direction,n))));direction=unit(add(tan,mul(n,.35)));
 for(let j=1;j<=segments;j++){
  const s=j/segments,prev=pts[j-1],near=skin.bvh.nearest(prev),normal=near.n,aim=fieldDirection(prev,root,d),along=unit(sub(aim,mul(normal,dot(aim,normal))));
  const release=smooth(.32,.82,s)*(.30+.70*front);
  let free=unit([aim[0]*(1-.35*s),-.5-1.2*s,aim[2]*(1-.75*s)]);
  let target=unit(blend(along,free,release));
  const liftDerivative=d.volumeMM*.001/Math.max(.008,length)*Math.PI*Math.cos(Math.PI*s)*(.35+.65*top);
  target=unit(add(target,mul(normal,liftDerivative*(1-release))));
  direction=unit(blend(direction,target,.46));let p=add(prev,mul(direction,ds));
  // Contact clearance is sampled on the original head, not on a substitute sphere.
  p=skin.project(p,.00075);
  pts.push(p);
 }
 enforceTrim(root,pts,d);skin.earGuard.apply(pts);skin.headGuard.apply(pts);
 const arc=[0];for(let i=1;i<pts.length;i++)arc.push(arc.at(-1)+Math.hypot(...sub(pts[i],pts[i-1])));
 return{id,root,normal:n,points:pts,arc,length:arc.at(-1),side:partSide(root,d),region:regionAt(root),requestedLength:length};
}
function sampleGuide(g,s){const a=clamp(s)*g.length;let j=1;while(j<g.arc.length-1&&g.arc[j]<a)j++;return blend(g.points[j-1],g.points[j],(a-g.arc[j-1])/Math.max(1e-9,g.arc[j]-g.arc[j-1]));}
function nearestGuides(root,d,gs){const id=[-1,-1,-1],ds=[Infinity,Infinity,Infinity],side=partSide(root,d);for(let i=0;i<gs.length;i++){const g=gs[i];if(!canInterpolate(root,g.root,d))continue;const delta=sub(g.root,root),dist=dot(delta,delta);if(dist>=ds[2])continue;let k=2;while(k>0&&dist<ds[k-1]){ds[k]=ds[k-1];id[k]=id[k-1];k--;}ds[k]=dist;id[k]=i;}
 if(id[0]<0)throw Error('局部发区缺少兼容导向');for(let j=1;j<3;j++)if(id[j]<0){id[j]=id[0];ds[j]=ds[0];}let w=ds.map(x=>1/Math.max(x,1e-8)),sum=w.reduce((a,b)=>a+b,0);return{id,w:w.map(x=>x/sum)};
}
function rotateNormal(delta,a,b){const v=cross(a,b),c=clamp(dot(a,b),-1,1);if(c<-.95)return delta;return add(add(delta,cross(v,delta)),mul(cross(v,cross(v,delta)),1/Math.max(1e-5,1+c)));}
export async function compileGroom(b,skin,recipe,{segments=24,cancel,onProgress}={}){
 const started=performance.now(),d=validateRecipe(recipe),guideIds=selectGuideRoots(b),guides=[];
 for(let n=0;n<guideIds.length;n++){guides.push(makeGuide(b,guideIds[n],d,skin,48));if(n%64===0){guard(cancel);onProgress?.('导向分层',n/guideIds.length*.25);await pause();}}
 const per=segments+1,curves=new Float32Array(b.count*per*3),normals=new Float32Array(curves.length),tangents=new Float32Array(curves.length),randoms=new Float32Array(b.count),active=new Uint8Array(b.count),guideMap=new Uint32Array(b.count*3),weights=new Float32Array(b.count*3),lengths=new Float32Array(b.count),regions={crown:0,fringe:0,left:0,right:0,back:0};
 let activeCount=0,maxRootOffset=0,minimumY=Infinity,maximumY=-Infinity;
 for(let i=0;i<b.count;i++){
  const root=Array.from(b.templateRoots.subarray(i*3,i*3+3)),n=normalAt(b,i),near=nearestGuides(root,d,guides),seed=b.random[i*4],phase=coherentPhase(root),finePhase=random01(i+791)*Math.PI*2;
  guideMap.set(near.id,i*3);weights.set(near.w,i*3);randoms[i]=seed;
  active[i]=b.selectionRandom[i]<(d.density/100)*mix(.15,1,smooth(.0002,.005,scalpMargin(root)))*rootVisibility(root)?1:0;if(active[i]){activeCount++;regions[regionAt(root)]++;}
  const requested=lengthAt(root,d,seed),avg=near.id.reduce((a,id,j)=>a+guides[id].requestedLength*near.w[j],0),scale=clamp(requested/avg,.45,1.5),base=[];
  for(let j=0;j<=segments;j++){
   const s=j/segments,q=(i*per+j)*3;let delta=[0,0,0];
   for(let k=0;k<3;k++){const g=guides[near.id[k]],gp=sampleGuide(g,s),v=rotateNormal(sub(gp,g.root),g.normal,n);for(let z=0;z<3;z++)delta[z]+=v[z]*near.w[k]*scale;}
   let point=add(root,delta),primary=guides[near.id[0]],gather=d.clump*.01*Math.sin(Math.PI*s*.85)*.55;
   const bundle=[0,0,0];for(let k=0;k<3;k++)for(let z=0;z<3;z++)bundle[z]+=guides[near.id[k]].root[z]*near.w[k];
   point=add(point,mul(sub(bundle,root),gather));
   if(j===0)point=add(root,mul(n,.00002));else point=skin.project(point,.0008);
   base.push(point);
  }
  let frame=unit(cross(n,unit(sub(base[1],base[0])))),prevT=unit(sub(base[1],base[0]));
  for(let j=0;j<=segments;j++){
   const s=j/segments,q=(i*per+j)*3,t=unit(sub(base[Math.min(segments,j+1)],base[Math.max(0,j-1)]));
   frame=transportFrame(frame,prevT,t);prevT=t;const binormal=unit(cross(t,frame)),a=d.waveMM*.001*smooth(0,.25,s)*(0.65+.35*seed);
   let p=base[j];if(j>0){const low=Math.sin(s*Math.PI*2.2+phase)*a,hi=Math.sin(s*22+finePhase)*a*.14;p=add(p,add(mul(frame,low),mul(binormal,hi)));p=skin.project(p,.0007);}
   curves.set(p,q);normals.set(n,q);minimumY=Math.min(minimumY,p[1]);maximumY=Math.max(maximumY,p[1]);
  }
  const finalPoints=Array.from({length:per},(_,j)=>Array.from(curves.subarray((i*per+j)*3,(i*per+j+1)*3)));enforceTrim(root,finalPoints,d);skin.earGuard.apply(finalPoints);skin.headGuard.apply(finalPoints);for(let j=0;j<per;j++)curves.set(finalPoints[j],(i*per+j)*3);
  for(let j=0;j<=segments;j++){const q=(i*per+j)*3,a=(i*per+Math.max(0,j-1))*3,c=(i*per+Math.min(segments,j+1))*3,t=unit([curves[c]-curves[a],curves[c+1]-curves[a+1],curves[c+2]-curves[a+2]]);tangents.set(t,q);if(j)lengths[i]+=Math.hypot(curves[q]-curves[q-3],curves[q+1]-curves[q-2],curves[q+2]-curves[q-1]);}
  maxRootOffset=Math.max(maxRootOffset,Math.hypot(...sub(curves.subarray(i*per*3,i*per*3+3),root)));
  if(i%768===0){guard(cancel);onProgress?.('密集发丝 / 贴肤避让',.25+.75*i/b.count);await pause();}
 }
 guard(cancel);const sorted=Array.from(lengths).sort((a,b)=>a-b),stats={requestedTopLengthMM:d.lengthMM,actualArcLengthMM:{min:sorted[0]*1000,median:sorted[Math.floor(sorted.length*.5)]*1000,p95:sorted[Math.floor(sorted.length*.95)]*1000,max:sorted.at(-1)*1000}};
 return{topology:TOPOLOGY_SPEC,recipe:d,curves,normals,tangents,randoms,active,guideMap,weights,guides,lengths,count:b.count,segments,per,activeCount,regions,maxRootOffset,stats,minimumY,maximumY,curveHash:hashArray(curves),rootHash:hashArray(b.templateRoots),buildMs:performance.now()-started,fieldCacheCells:skin.values.size,earGuard:skin.earGuard.diagnostics(),headGuard:skin.headGuard.diagnostics()};
}
