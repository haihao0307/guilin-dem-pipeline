/** Exact rendered CSR surface, CPU narrow phase. No collision proxy is used as
 * skin. Vertex trajectories are piecewise linear between fixed-step poses.
 * Conservative advancement uses a distance Lipschitz bound, never animation
 * phase. A 20 micrometre distance tolerance bounds accepted early contact.
 */
export const SURFACE_TOLERANCE=2e-5;
const add=(a,b)=>a.map((x,k)=>x+b[k]),sub=(a,b)=>a.map((x,k)=>x-b[k]),mul=(a,s)=>a.map(x=>x*s),dot=(a,b)=>a.reduce((s,x,k)=>s+x*b[k],0),len=a=>Math.hypot(...a),mix=(a,b,t)=>a.map((x,k)=>x+(b[k]-x)*t);
const box=()=>({min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]});
const extend=(b,p)=>{for(let k=0;k<3;k++){b.min[k]=Math.min(b.min[k],p[k]);b.max[k]=Math.max(b.max[k],p[k]);}return b;};
const overlaps=(a,b,r=0)=>[0,1,2].every(k=>a.min[k]-r<=b.max[k]&&a.max[k]+r>=b.min[k]);
const point=(m,p)=>[0,1,2].map(k=>m[k*4]*p[0]+m[k*4+1]*p[1]+m[k*4+2]*p[2]+m[k*4+3]);
const world=(m,p)=>[0,1,2].map(k=>m[k]*p[0]+m[4+k]*p[2]-m[8+k]*p[1]+m[12+k]);
/** Ericson triangle Voronoi regions; weights also transport surface velocity. */
export function closestTriangle(p,a,b,c){
 const ab=sub(b,a),ac=sub(c,a),ap=sub(p,a),d1=dot(ab,ap),d2=dot(ac,ap);let w;
 if(d1<=0&&d2<=0)w=[1,0,0];else{const bp=sub(p,b),d3=dot(ab,bp),d4=dot(ac,bp);
 if(d3>=0&&d4<=d3)w=[0,1,0];else{const vc=d1*d4-d3*d2;
 if(vc<=0&&d1>=0&&d3<=0){const v=d1/(d1-d3);w=[1-v,v,0];}else{const cp=sub(p,c),d5=dot(ab,cp),d6=dot(ac,cp);
 if(d6>=0&&d5<=d6)w=[0,0,1];else{const vb=d5*d2-d1*d6;
 if(vb<=0&&d2>=0&&d6<=0){const v=d2/(d2-d6);w=[1-v,0,v];}else{const va=d3*d6-d5*d4;
 if(va<=0&&d4-d3>=0&&d5-d6>=0){const v=(d4-d3)/((d4-d3)+(d5-d6));w=[0,1-v,v];}else{const total=va+vb+vc;if(Math.abs(total)<1e-30)return closestDegenerate(p,a,b,c);const v=vb/total,u=vc/total;w=[1-v-u,v,u];}}}}}}
 const q=a.map((x,k)=>x*w[0]+b[k]*w[1]+c[k]*w[2]);return {point:q,barycentric:w,distance:len(sub(q,p))};
}
function closestDegenerate(p,a,b,c){let best;for(const [i,j] of [[0,1],[1,2],[2,0]]){const v=[a,b,c],d=sub(v[j],v[i]),t=Math.max(0,Math.min(1,dot(sub(p,v[i]),d)/(dot(d,d)||1))),q=add(v[i],mul(d,t)),distance=len(sub(q,p));if(!best||distance<best.distance){const w=[0,0,0];w[i]=1-t;w[j]=t;best={point:q,barycentric:w,distance};}}return best;}
function staticSweep(from,to,r,a,b,c){
 const d=sub(to,from),ab=sub(b,a),ac=sub(c,a),cross=(u,v)=>[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],raw=cross(ab,ac),nl=len(raw),candidates=[];
 const start=closestTriangle(from,a,b,c);if(start.distance<=r)return {toi:0,...start};
 if(nl>1e-14){const n=mul(raw,1/nl),h=dot(sub(from,a),n),speed=dot(d,n);if(Math.abs(speed)>1e-15)for(const sign of [-1,1]){const t=(sign*r-h)/speed;if(t>=0&&t<=1){const p=add(from,mul(d,t)),q=closestTriangle(p,a,b,c);if(q.distance<=r+1e-10)candidates.push({toi:t,...q});}}}
 const roots=(A,B,C)=>{if(A<1e-25)return [];const disc=B*B-4*A*C;if(disc<0)return [];const z=Math.sqrt(Math.max(0,disc));return [(-B-z)/(2*A),(-B+z)/(2*A)];};
 for(const v of [a,b,c])for(const t of roots(dot(d,d),2*dot(sub(from,v),d),dot(sub(from,v),sub(from,v))-r*r))if(t>=0&&t<=1)candidates.push({toi:t,...closestTriangle(add(from,mul(d,t)),a,b,c)});
 for(const [v,w] of [[a,b],[b,c],[c,a]]){const edge=sub(w,v),L=dot(edge,edge);if(L<1e-25)continue;const f=sub(from,v),ed=dot(edge,d)/L,ef=dot(edge,f)/L,D=sub(d,mul(edge,ed)),F=sub(f,mul(edge,ef));for(const t of roots(dot(D,D),2*dot(F,D),dot(F,F)-r*r)){const u=ef+t*ed;if(t>=0&&t<=1&&u>=0&&u<=1)candidates.push({toi:t,...closestTriangle(add(from,mul(d,t)),a,b,c)});}}
 candidates.sort((a,b)=>a.toi-b.toi);return candidates[0]||null;
}
export function sweepSphereTriangle(from,to,radius,previous,current,{tolerance=SURFACE_TOLERANCE,maxIterations=512}={}){
 const motion=sub(to,from),moves=current.map((v,i)=>sub(v,previous[i]));
 if(moves.every(v=>len(sub(v,moves[0]))<1e-12)){
  const q=staticSweep(from,sub(to,moves[0]),radius,...previous);if(!q)return null;const center=mix(from,to,q.toi),contactPoint=add(q.point,mul(moves[0],q.toi)),d=sub(contactPoint,center),distance=len(d);if(distance<1e-12)return {unresolved:true,reason:'sphere-center-on-surface'};
  return {toi:q.toi,contactPoint,normal:mul(d,1/distance),barycentric:q.barycentric,relativeDisplacement:sub(motion,moves[0]),surfaceSeparation:distance-radius,iterations:1,initialOverlap:q.toi===0&&distance<radius};
 }
 const relative=current.map((v,i)=>sub(sub(v,previous[i]),motion)),speed=Math.max(...relative.map(len));let t=0,lastGap=Infinity;
 for(let iteration=0;iteration<maxIterations;iteration++){
  const p=mix(from,to,t),vertices=previous.map((v,i)=>mix(v,current[i],t)),q=closestTriangle(p,...vertices),gap=q.distance-radius;
  if(gap<=tolerance){const d=sub(q.point,p),n=len(d);if(n<1e-12)return {unresolved:true,reason:'sphere-center-on-surface'};
   const surfaceMove=[0,1,2].map(k=>relative.reduce((s,v,i)=>s+(v[k]+motion[k])*q.barycentric[i],0));
   return {toi:t,contactPoint:q.point,normal:mul(d,1/n),barycentric:q.barycentric,relativeDisplacement:sub(motion,surfaceMove),surfaceSeparation:gap,iterations:iteration+1,initialOverlap:t===0&&gap<0};
  }
  if(speed<1e-14||gap>speed*(1-t)+tolerance)return null;
  const advance=(gap-tolerance*.5)/speed;if(!(advance>0)||t+advance===t)return {unresolved:true,reason:'convergence'};
  t+=advance;if(t>1)return null;lastGap=gap;
 }
 // A solver budget is never relabelled a miss or hit.
 return {unresolved:true,reason:'iteration-budget',lastGap};
}
function region(name){const side=/\.L|_l|left/i.test(name)?'.L':/\.R|_r|right/i.test(name)?'.R':'';
 if(/head|jaw|eye|face/.test(name))return 'head';if(/neck/.test(name))return 'neck';if(/clav|shoulder/.test(name))return 'shoulder'+side;if(/upperarm|lowerarm|hand|finger|thumb/.test(name))return 'arm'+side;if(/upperleg|lowerleg|foot|toe/.test(name))return 'leg'+side;if(/pelvis|hip/.test(name))return 'pelvis';return 'torso';}
export class SurfaceNarrowPhase {
 constructor(human,{leafTriangles=48}={}){
  this.human=human;this.stats={verticesSkinned:0,nodesVisited:0,trianglesTested:0,unresolved:0};
  const {faces,positions,range,packed}=human,cover=human.geometry?.getAttribute('csRegion'),ids=[];this.triangleRegion=[];
  for(let t=0;t<faces.length/3;t++){const vertices=[faces[t*3],faces[t*3+1],faces[t*3+2]];
   if(cover&&vertices.every(v=>cover.getX(v)<.5))continue;
   const weights=new Map();for(const v of vertices)for(let i=0;i<range[v*2+1];i++){const s=(range[v*2]+i)*8,j=packed[s+3];weights.set(j,(weights.get(j)||0)+packed[s+4]);}
   this.triangleRegion[t]=region(human.names[[...weights].sort((a,b)=>b[1]-a[1])[0][0]]);ids.push(t);
  }
  this.triangleIds=ids;let nodeId=0;
  const build=triangles=>{const influence=new Map(),b=box();let minSum=Infinity,maxSum=-Infinity;const vertices=new Set(triangles.flatMap(t=>[faces[t*3],faces[t*3+1],faces[t*3+2]]));
   for(const v of vertices){extend(b,positions.subarray(v*3,v*3+3));let sum=0;for(let i=0;i<range[v*2+1];i++){const s=(range[v*2]+i)*8,j=packed[s+3],weight=packed[s+4];if(weight<0)throw Error('Negative CSR weight');if(!weight)continue;sum+=weight;if(!influence.has(j))influence.set(j,box());extend(influence.get(j),packed.subarray(s,s+3));}minSum=Math.min(minSum,sum);maxSum=Math.max(maxSum,sum);}
   const node={id:nodeId++,influence:[...influence],minSum,maxSum};if(triangles.length<=leafTriangles){node.triangles=triangles;return node;}
   const axis=b.max.map((x,k)=>x-b.min[k]).reduce((best,x,k,a)=>x>a[best]?k:best,0);triangles.sort((t,u)=>{let v=0;for(let i=0;i<3;i++)v+=positions[faces[t*3+i]*3+axis]-positions[faces[u*3+i]*3+axis];return v;});const half=triangles.length>>1;node.children=[build(triangles.slice(0,half)),build(triangles.slice(half))];return node;};
  this.root=build(ids.slice());this.nodeCount=nodeId;this.previous=null;this.current=null;
 }
 snapshot(skinMatrices,matrixWorld){return {matrices:skinMatrices.map(m=>Array.from(m)),world:Array.from(matrixWorld),cache:new Map(),bounds:new Map()};}
 setStep(previous,current){this.previous=previous;this.current=current;for(const k in this.stats)this.stats[k]=0;}
 vertex(v,snapshot){if(snapshot.cache.has(v))return snapshot.cache.get(v);const h=this.human,p=[0,0,0];for(let i=0;i<h.range[v*2+1];i++){const s=(h.range[v*2]+i)*8,m=snapshot.matrices[h.packed[s+3]],w=h.packed[s+4];for(let k=0;k<3;k++)p[k]+=w*(m[k*4]*h.packed[s]+m[k*4+1]*h.packed[s+1]+m[k*4+2]*h.packed[s+2]+m[k*4+3]);}const q=world(snapshot.world,p);snapshot.cache.set(v,q);this.stats.verticesSkinned++;return q;}
 bounds(node,snapshot){if(snapshot.bounds.has(node.id))return snapshot.bounds.get(node.id);const native=box();for(const [j,b] of node.influence)for(let c=0;c<8;c++)extend(native,point(snapshot.matrices[j],[0,1,2].map(k=>(c>>k)&1?b.max[k]:b.min[k])));
  // Any weighted vertex lies in this convex influence envelope. Preserve the
  // actual (slightly non-unit Float32) CSR weight sums in the bound.
  for(let k=0;k<3;k++){const values=[native.min[k]*node.minSum,native.min[k]*node.maxSum,native.max[k]*node.minSum,native.max[k]*node.maxSum];native.min[k]=Math.min(...values);native.max[k]=Math.max(...values);}
  const b=box();for(let c=0;c<8;c++)extend(b,world(snapshot.world,[0,1,2].map(k=>(c>>k)&1?native.max[k]:native.min[k])));snapshot.bounds.set(node.id,b);return b;
 }
 cast({from,to,radius,allowedRegions=null}){
  if(!this.previous||!this.current)throw Error('Surface step requires both actual poses');const swept=extend(extend(box(),from),to);let best=null,unresolved=false;
  const visit=node=>{this.stats.nodesVisited++;const a=this.bounds(node,this.previous),b=this.bounds(node,this.current),union={min:a.min.map((v,k)=>Math.min(v,b.min[k])),max:a.max.map((v,k)=>Math.max(v,b.max[k]))};const active=best?extend(extend(box(),from),mix(from,to,best.toi)):swept;if(!overlaps(active,union,radius+SURFACE_TOLERANCE))return;
   if(node.children){node.children.forEach(visit);return;}
   for(const t of node.triangles){const bodyRegion=this.triangleRegion[t];if(allowedRegions&&!allowedRegions.includes(bodyRegion))continue;const ids=[0,1,2].map(k=>this.human.faces[t*3+k]),p=ids.map(v=>this.vertex(v,this.previous)),q=ids.map(v=>this.vertex(v,this.current)),tb=box();p.forEach(v=>extend(tb,v));q.forEach(v=>extend(tb,v));const active=best?extend(extend(box(),from),mix(from,to,best.toi)):swept;if(!overlaps(active,tb,radius+SURFACE_TOLERANCE))continue;this.stats.trianglesTested++;
    const hit=sweepSphereTriangle(from,to,radius,p,q);if(hit?.unresolved){unresolved=true;this.stats.unresolved++;continue;}if(hit&&(!best||hit.toi<best.toi))best={...hit,triangleId:t,vertexIds:ids,bodyRegion,source:'full-CSR surface continuous sphere/triangle',proxyApproximation:false,surfaceToleranceM:SURFACE_TOLERANCE,trajectory:'linear rendered vertices per fixed step'};
   }
  };visit(this.root);if(unresolved)return {unresolved:true,reason:'surface-cast-budget',candidate:best};return best;
 }
 allPositions(snapshot){const out=new Float32Array(this.human.N*3);for(let i=0;i<this.human.N;i++)out.set(this.vertex(i,snapshot),i*3);return out;}
}
