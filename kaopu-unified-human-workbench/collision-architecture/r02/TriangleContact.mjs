import {closestTriangle,SURFACE_TOLERANCE} from './SurfaceNarrowPhase.mjs';
const sub=(a,b)=>a.map((v,k)=>v-b[k]),add=(a,b)=>a.map((v,k)=>v+b[k]),scale=(a,s)=>a.map(v=>v*s),dot=(a,b)=>a.reduce((s,v,k)=>s+v*b[k],0),length=a=>Math.hypot(...a),lerp=(a,b,t)=>a.map((v,k)=>v+(b[k]-v)*t),clamp=x=>Math.max(0,Math.min(1,x));
function segments(p1,q1,p2,q2){const d1=sub(q1,p1),d2=sub(q2,p2),r=sub(p1,p2),a=dot(d1,d1),e=dot(d2,d2),f=dot(d2,r);let s=0,t=0;if(a<1e-25){t=e>1e-25?clamp(f/e):0;}else{const c=dot(d1,r);if(e<1e-25)s=clamp(-c/a);else{const b=dot(d1,d2),den=a*e-b*b;s=den>1e-25?clamp((b*f-c*e)/den):0;t=(b*s+f)/e;if(t<0){t=0;s=clamp(-c/a);}else if(t>1){t=1;s=clamp((b-c)/a);}}}return {a:lerp(p1,q1,s),b:lerp(p2,q2,t),s,t};}
function segmentTriangle(p,q,a,b,c){const cross=(u,v)=>[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],d=sub(q,p),e1=sub(b,a),e2=sub(c,a),h=cross(d,e2),det=dot(e1,h);if(Math.abs(det)<1e-16)return null;const f=1/det,s=sub(p,a),u=f*dot(s,h);if(u<0||u>1)return null;const v=f*dot(d,cross(s,e1));if(v<0||u+v>1)return null;const t=f*dot(e2,cross(s,e1));if(t<0||t>1)return null;return {point:lerp(p,q,t),t,barycentric:[1-u-v,u,v]};}
export function triangleDistance(a,b){let best={distance:Infinity};const record=(p,q,wa,wb)=>{const distance=length(sub(q,p));if(distance<best.distance)best={distance,attackerPoint:p,contactPoint:q,attackerBarycentric:wa,barycentric:wb};};
 for(const [i,j]of [[0,1],[1,2],[2,0]]){let q=segmentTriangle(a[i],a[j],...b);if(q){const wa=[0,0,0];wa[i]=1-q.t;wa[j]=q.t;record(q.point,q.point,wa,q.barycentric);return best;}q=segmentTriangle(b[i],b[j],...a);if(q){const wb=[0,0,0];wb[i]=1-q.t;wb[j]=q.t;record(q.point,q.point,q.barycentric,wb);return best;}}
 for(let i=0;i<3;i++){const one=[0,0,0];one[i]=1;let q=closestTriangle(a[i],...b);record(a[i],q.point,one,q.barycentric);q=closestTriangle(b[i],...a);record(q.point,b[i],q.barycentric,one);}
 for(const [i,j] of [[0,1],[1,2],[2,0]])for(const [k,l]of [[0,1],[1,2],[2,0]]){const q=segments(a[i],a[j],b[k],b[l]),wa=[0,0,0],wb=[0,0,0];wa[i]=1-q.s;wa[j]=q.s;wb[k]=1-q.t;wb[l]=q.t;record(q.a,q.b,wa,wb);}return best;
}
/** Both triangles retain the actual visible vertices. Continuous motion is
 * linear interpolation of the two fixed-step snapshots, including rotation
 * and deformation of vertices; no frozen capsule orientation is involved. */
function translatedTOI(a,b,velocity){
 const cross=(u,v)=>[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],edges=p=>[[0,1],[1,2],[2,0]].map(([i,j])=>sub(p[j],p[i])),ea=edges(a),eb=edges(b),na=cross(ea[0],ea[1]),nb=cross(eb[0],eb[1]),axes=[na,nb,...ea.flatMap(u=>eb.map(v=>cross(u,v))),...ea.map(v=>cross(na,v)),...eb.map(v=>cross(nb,v))];let enter=0,exit=1;
 for(const axis of axes){const L=length(axis);if(L<1e-14)continue;const n=scale(axis,1/L),pa=a.map(p=>dot(p,n)),pb=b.map(p=>dot(p,n)),lo=Math.min(...pb)-Math.max(...pa),hi=Math.max(...pb)-Math.min(...pa),v=dot(velocity,n);if(Math.abs(v)<1e-14){if(lo>1e-12||hi< -1e-12)return null;}else{const x=lo/v,y=hi/v;enter=Math.max(enter,Math.min(x,y));exit=Math.min(exit,Math.max(x,y));if(enter>exit+1e-12)return null;}}
 return enter>=0&&enter<=1?enter:null;
}
export function sweepTriangles(a0,a1,b0,b1,{tolerance=SURFACE_TOLERANCE,maxIterations=512}={}){
 const da=a1.map((p,i)=>sub(p,a0[i])),db=b1.map((p,i)=>sub(p,b0[i])),speed=Math.max(...da.flatMap(v=>db.map(w=>length(sub(v,w)))));let t=0;
 if(da.every(v=>length(sub(v,da[0]))<1e-12)&&db.every(v=>length(sub(v,db[0]))<1e-12)){const exact=translatedTOI(a0,b0,sub(da[0],db[0]));if(exact===null)return null;t=exact;}
 for(let iteration=0;iteration<maxIterations;iteration++){
  const a=a0.map((v,i)=>lerp(v,a1[i],t)),b=b0.map((v,i)=>lerp(v,b1[i],t)),q=triangleDistance(a,b);if(q.distance<=tolerance){const v=[0,1,2].map(k=>da.reduce((s,p,i)=>s+p[k]*q.attackerBarycentric[i],0)-db.reduce((s,p,i)=>s+p[k]*q.barycentric[i],0)),delta=sub(q.contactPoint,q.attackerPoint);let normal;
   if(q.distance>1e-12)normal=scale(delta,1/q.distance);else{const u=sub(b[1],b[0]),w=sub(b[2],b[0]),n=[u[1]*w[2]-u[2]*w[1],u[2]*w[0]-u[0]*w[2],u[0]*w[1]-u[1]*w[0]],L=length(n);if(L<1e-15)return {unresolved:true,reason:'degenerate-contact'};normal=scale(n,(dot(n,v)<0?-1:1)/L);}
   return {...q,toi:t,normal,relativeDisplacement:v,iterations:iteration+1,surfaceSeparation:q.distance,initialOverlap:t===0};
  }
  if(speed<1e-14||q.distance>speed*(1-t)+tolerance)return null;
  const advance=(q.distance-tolerance*.5)/speed;if(!(advance>0)||t+advance===t)return {unresolved:true,reason:'convergence'};t+=advance;if(t>1)return null;
 }return {unresolved:true,reason:'triangle-iteration-budget'};
}
