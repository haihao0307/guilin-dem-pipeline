/** Fixed native attachment loops, not a world-space box. The GNM metadata has
 * NO ear label (pinna and scalp both use 255), so 255 is never an ownership mask.
 * These authored loops follow existing edges on the retained GNM v3 topology.
 * Flood-fill selects the pinna side; all scalp and the attachment ring are pinned.
 * Distance is computed ON that surface at bind time, then interpolated by the
 * original canonical recipes / display stencils. No posed nearest search. */
export const DOMAIN_VERSION='kaopu/ear-root-domain@1';
export const ATTACHMENT_LOOPS=Object.freeze({
 left:[3010,3006,3007,4974,4880,3697,5122,3708,3709,3712,3720,3715,4264,2489,2491,2487,3047,3046,3051,2854,2855,2851,4467,4444,4445,4440,2755,2753,2752,2362,2360,2359,4478,4477,4469,4472,4426,4423,2932,2930,2929,3013],
 right:[9138,9134,9135,11102,11008,9825,11250,9836,9837,9840,9848,9843,10392,8617,8619,8615,9175,9174,9179,8982,8983,8979,10595,10572,10573,10568,8883,8881,8880,8490,8488,8487,10606,10605,10597,10600,10554,10551,9060,9058,9057,9141]
});
const SEEDS={left:2377,right:8505};
export const quintic=x=>{const t=Math.max(0,Math.min(1,x));return t*t*t*(t*(t*6-15)+10);};
const point=(P,i)=>[P[i*3],P[i*3+1],P[i*3+2]];
function distanceField(P,adj,inside,boundary){
 const d=new Float64Array(inside.length).fill(Infinity),heap=[];
 const push=(v,c)=>{let i=heap.length;heap.push([v,c]);while(i){const j=(i-1)>>1;if(heap[j][1]<=c)break;heap[i]=heap[j];i=j;}heap[i]=[v,c];};
 const pop=()=>{const r=heap[0],last=heap.pop();if(heap.length){let i=0;while(i*2+1<heap.length){let j=i*2+1;if(j+1<heap.length&&heap[j+1][1]<heap[j][1])j++;if(heap[j][1]>=last[1])break;heap[i]=heap[j];i=j;}heap[i]=last;}return r;};
 for(const v of boundary){d[v]=0;push(v,0);}
 while(heap.length){const[u,c]=pop();if(c!==d[u])continue;for(const v of adj[u]){if(!inside[v])continue;const n=c+Math.hypot(P[u*3]-P[v*3],P[u*3+1]-P[v*3+1],P[u*3+2]-P[v*3+2]);if(n<d[v]){d[v]=n;push(v,n);}}}return d;
}
export function buildNativeDomain(g){
 const P=g.template,I=g.triangles,N=P.length/3;
 if(N!==17821||g.meta.gnmVersion!=='3.0')throw Error('EAR-R04: unsupported native topology; refusing spatial-box fallback');
 const adj=Array.from({length:N},()=>new Set());for(let k=0;k<I.length;k+=3)for(let e=0;e<3;e++){const a=I[k+e],b=I[k+(e+1)%3];adj[a].add(b);adj[b].add(a);}
 const ownership=new Uint8Array(N),weight=new Float32Array(N),hinges={},report={schema:DOMAIN_VERSION,source:'authored edge loops on retained native GNM topology',region255IsNotEar:true,falloff:'surface geodesic, 0.7mm pinned collar + 10mm quintic ramp',sides:{}};
 for(const side of ['left','right']){
  const loop=ATTACHMENT_LOOPS[side],ring=new Set(loop),sign=side==='left'?1:-1;
  if(ring.size!==loop.length||loop.some((v,i)=>!adj[v].has(loop[(i+1)%loop.length])))throw Error('EAR-R04: attachment loop is not a simple closed edge path');
  const inside=new Uint8Array(N),queue=[SEEDS[side]];inside[queue[0]]=1;
  for(let j=0;j<queue.length;j++)for(const v of adj[queue[j]])if(!ring.has(v)&&!inside[v]&&g.materialId[v]===0){inside[v]=1;queue.push(v);}
  if(queue.length!==511||queue.some(v=>P[v*3]*sign<.06))throw Error('EAR-R04: pinna component changed; skull must remain excluded');
  const d=distanceField(P,adj,inside,loop);let moving=0,max=0;
  for(const i of queue){ownership[i]=side==='left'?1:2;weight[i]=quintic((d[i]-.0007)/.010);if(weight[i]>0)moving++;max=Math.max(max,d[i]);}
  const lower=point(P,side==='left'?3715:9843),upper=point(P,side==='left'?3010:9138);lower[0]=Math.abs(lower[0]);upper[0]=Math.abs(upper[0]);const axis=upper.map((v,k)=>v-lower[k]),length=Math.hypot(...axis);hinges[side]={origin:lower,axis:axis.map(v=>v/length)};
  report.sides[side]={interiorVertices:queue.length,pinnedBoundaryVertices:loop.length,movingNativeVertices:moving,maximumGeodesicMM:max*1000,seed:SEEDS[side],hinge:hinges[side]};
 }
 return {weight,ownership,hinges,report};
}
export function buildEarDomain(model){
 const native=buildNativeDomain(model.gnm),weight=new Float32Array(model.vertexCount),owned=new Float32Array(model.vertexCount);
 for(let h=0;h<model.canonical.gnmRecipes.length;h++){const[a,b,t]=model.canonical.gnmRecipes[h],i=model.bodyCount+h;weight[i]=native.weight[a]*(1-t)+native.weight[b]*t;owned[i]=(native.ownership[a]?1:0)*(1-t)+(native.ownership[b]?1:0)*t;}
 return {...native,nativeWeight:native.weight,weight,owned,report:{...native.report,canonicalVertices:model.vertexCount,canonicalMovingVertices:weight.reduce((n,w)=>n+(w>0),0)}};
}
