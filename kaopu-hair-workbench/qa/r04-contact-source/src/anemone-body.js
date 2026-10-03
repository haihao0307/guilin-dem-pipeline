/* Original KAOPU r04 shared closed body mesh and finite capsule contacts.
 * Collision geometry is the renderer's Float32 triangle mesh, not a fitted SDF.
 * Spatial queries are continuous along each segment; this is not temporal CCD.
 * No third-party runtime code. See the exported API notes at the end. */
(function(root){'use strict';
const C=root.AnemoneCore||(typeof require==='function'?require('./anemone-core.js'):null);
const EPS=1e-9, BOUNDARY=2e-7;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]], add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]], scale=(a,s)=>[a[0]*s,a[1]*s,a[2]*s];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2], cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm=v=>{const l=Math.hypot(...v);return v.map(x=>x/l);};
const lerp=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];
// Deliberately identical generation and accumulation order to r03 bodyMesh().
function mesh(){const positions=[],normals=[],indices=[],steps=C.DISC_SIDES,columnRows=14,totalRows=columnRows+C.DISC_RINGS;
 const point=(row,side)=>{const a=side/steps*Math.PI*2;if(row>=columnRows)return C.discPoint(row-columnRows,side);const t=row/columnRows,r=.63+(C.discRadius(a)-.63)*t*t*t;const top=C.discPoint(0,side)[1];return [r*Math.cos(a),top*t,r*Math.sin(a)];};
 for(let row=0;row<=totalRows;row++)for(let side=0;side<=steps;side++){const p=point(row,side);positions.push(...p);normals.push(0,0,0);if(row<totalRows&&side<steps){const k=row*(steps+1)+side;indices.push(k,k+steps+1,k+1,k+1,k+steps+1,k+steps+2);}}
 const center=positions.length/3;positions.push(0,0,0);normals.push(0,0,0);for(let j=0;j<steps;j++)indices.push(center,j,j+1);
 for(let i=0;i<indices.length;i+=3){const [a,b,c]=indices.slice(i,i+3),p=positions.slice(a*3,a*3+3),q=positions.slice(b*3,b*3+3),r=positions.slice(c*3,c*3+3),n=cross(q.map((x,k)=>x-p[k]),r.map((x,k)=>x-p[k]));for(const idx of [a,b,c])for(let k=0;k<3;k++)normals[idx*3+k]+=n[k];}
 for(let i=0;i<normals.length;i+=3){const v=norm(normals.slice(i,i+3));for(let k=0;k<3;k++)normals[i+k]=Number.isFinite(v[k])?v[k]:k===1?1:0;}
 return {positions:new Float32Array(positions),normals:new Float32Array(normals),indices:new Uint16Array(indices)};
}
function pointTriangle(p,a,b,c){
 const ab=sub(b,a),ac=sub(c,a),normal=cross(ab,ac);
 if(dot(normal,normal)<1e-28){let best=a.slice(),distance=Infinity;for(const [x,y]of [[a,b],[b,c],[c,a]]){const e=sub(y,x),t=clamp(dot(sub(p,x),e)/Math.max(1e-30,dot(e,e)),0,1),q=add(x,scale(e,t)),d=dot(sub(p,q),sub(p,q));if(d<distance){best=q;distance=d;}}return best;}
 const ap=sub(p,a),d1=dot(ab,ap),d2=dot(ac,ap);
 if(d1<=0&&d2<=0)return a.slice();
 const bp=sub(p,b),d3=dot(ab,bp),d4=dot(ac,bp);if(d3>=0&&d4<=d3)return b.slice();
 const vc=d1*d4-d3*d2;if(vc<=0&&d1>=0&&d3<=0)return add(a,scale(ab,d1/(d1-d3)));
 const cp=sub(p,c),d5=dot(ab,cp),d6=dot(ac,cp);if(d6>=0&&d5<=d6)return c.slice();
 const vb=d5*d2-d1*d6;if(vb<=0&&d2>=0&&d6<=0)return add(a,scale(ac,d2/(d2-d6)));
 const va=d3*d6-d5*d4;if(va<=0&&(d4-d3)>=0&&(d5-d6)>=0)return add(b,scale(sub(c,b),(d4-d3)/((d4-d3)+(d5-d6))));
 const den=va+vb+vc;if(Math.abs(den)<1e-30){let q=a,dist=Infinity;for(const [x,y]of [[a,b],[b,c],[c,a]]){const e=sub(y,x),t=clamp(dot(sub(p,x),e)/Math.max(1e-30,dot(e,e)),0,1),v=add(x,scale(e,t)),d=dot(sub(p,v),sub(p,v));if(d<dist){dist=d;q=v;}}return q.slice();}
 return add(a,add(scale(ab,vb/den),scale(ac,vc/den)));
}
// Exact minimum of |w+u*t|-dr*t on an interval, including a collapsed axis.
function coneMinimum(w,u,dr,lo,hi){const A=dot(u,u),B=dot(w,u),D=dot(w,w);let t=lo,score=Infinity;
 const check=s=>{const v=Math.sqrt(Math.max(0,A*s*s+2*B*s+D))-dr*s;if(v<score){score=v;t=s;}};
 check(lo);check(hi);if(A>1e-28){const mid=-B/A,h2=Math.max(0,D-B*B/A);check(clamp(mid,lo,hi));if(A>dr*dr+1e-25)check(clamp(mid+dr*Math.sqrt(h2/(A*(A-dr*dr))),lo,hi));}return t;
}
function clipLinear(interval,x,v,minimum=0){if(Math.abs(v)<1e-18)return x>=minimum-EPS;if(v>0)interval[0]=Math.max(interval[0],(minimum-x)/v);else interval[1]=Math.min(interval[1],(minimum-x)/v);return interval[0]<=interval[1]+1e-12;}
// Minimum of distance(axis(t), triangle) - lerp(r0,r1,t). Exact feature
// candidates: triangle vertices, interior edges and projected face interval.
function segmentTriangle(a,b,p,q,r,r0=0,r1=r0){const u=sub(b,a),dr=r1-r0;let result={clearance:Infinity,distance:Infinity,t:0,point:a.slice(),surface:p.slice()};
 const check=(t,surface)=>{t=clamp(t,0,1);const point=lerp(a,b,t),distance=Math.hypot(...sub(point,surface)),clearance=distance-r0-dr*t;if(clearance<result.clearance){result={clearance,distance,t,point,surface:surface.slice()};}};
 for(const v of [p,q,r]){const t=coneMinimum(sub(a,v),u,dr,0,1);check(t,v);}
 for(const [v,w]of [[p,q],[q,r],[r,p]]){const e=sub(w,v),ee=dot(e,e);if(ee<1e-28)continue;const av=sub(a,v),f0=dot(av,e)/ee,f1=dot(u,e)/ee,I=[0,1];if(!clipLinear(I,f0,f1)||!clipLinear(I,1-f0,-f1))continue;I[0]=clamp(I[0],0,1);I[1]=clamp(I[1],0,1);const t=coneMinimum(sub(av,scale(e,f0)),sub(u,scale(e,f1)),dr,I[0],I[1]);check(t,add(v,scale(e,clamp(f0+f1*t,0,1))));}
 const e=sub(q,p),f=sub(r,p),n=cross(e,f),nn=dot(n,n);if(nn>1e-26){const ap=sub(a,p),h0=dot(ap,n)/nn,h1=dot(u,n)/nn,v0=sub(ap,scale(n,h0)),v1=sub(u,scale(n,h1)),ee=dot(e,e),ff=dot(f,f),ef=dot(e,f),den=ee*ff-ef*ef;
  const x0=(dot(v0,e)*ff-dot(v0,f)*ef)/den,x1=(dot(v1,e)*ff-dot(v1,f)*ef)/den,y0=(dot(v0,f)*ee-dot(v0,e)*ef)/den,y1=(dot(v1,f)*ee-dot(v1,e)*ef)/den,I=[0,1];
  if(clipLinear(I,x0,x1)&&clipLinear(I,y0,y1)&&clipLinear(I,1-x0-y0,-x1-y1)){const lo=clamp(I[0],0,1),hi=clamp(I[1],0,1),ts=[lo,hi];if(Math.abs(h1)>1e-24)ts.push(clamp(-h0/h1,lo,hi));for(const t of ts)check(t,sub(lerp(a,b,t),scale(n,h0+h1*t)));}
 }return result;
}
function aabbDistance2(a,b,box){let d=0;for(let k=0;k<3;k++){const lo=Math.min(a[k],b[k]),hi=Math.max(a[k],b[k]),v=Math.max(0,box[k]-hi,lo-box[k+3]);d+=v*v;}return d;}
function rayBox(o,d,box,lo=0,hi=Infinity){for(let k=0;k<3;k++){if(Math.abs(d[k])<1e-20){if(o[k]<box[k]-EPS||o[k]>box[k+3]+EPS)return false;}else{let a=(box[k]-EPS-o[k])/d[k],b=(box[k+3]+EPS-o[k])/d[k];if(a>b){const q=a;a=b;b=q;}lo=Math.max(lo,a);hi=Math.min(hi,b);if(hi<lo)return false;}}return true;}
function rayTriangle(o,d,t){const h=cross(d,t.e2),det=dot(t.e1,h);if(Math.abs(det)<1e-15)return null;const inv=1/det,s=sub(o,t.a),u=dot(s,h)*inv;if(u<-1e-9||u>1+1e-9)return null;const q=cross(s,t.e1),v=dot(d,q)*inv;if(v<-1e-9||u+v>1+1e-9)return null;return dot(t.e2,q)*inv;}
class TriangleBVH{
 constructor(geometry,{leafSize=8}={}){if(!geometry||!geometry.positions||!geometry.indices)throw Error('Body triangle mesh is required');this.geometry=geometry;this.triangles=[];let degenerate=0;const v=geometry.positions,ids=geometry.indices;
  for(let i=0;i<ids.length;i+=3){const a=Array.from(v.slice(ids[i]*3,ids[i]*3+3)),b=Array.from(v.slice(ids[i+1]*3,ids[i+1]*3+3)),c=Array.from(v.slice(ids[i+2]*3,ids[i+2]*3+3)),e1=sub(b,a),e2=sub(c,a),n=cross(e1,e2),length=Math.hypot(...n);if(length<1e-14){degenerate++;continue;}this.triangles.push({a,b,c,e1,e2,normal:scale(n,1/length),index:i/3,box:[Math.min(a[0],b[0],c[0]),Math.min(a[1],b[1],c[1]),Math.min(a[2],b[2],c[2]),Math.max(a[0],b[0],c[0]),Math.max(a[1],b[1],c[1]),Math.max(a[2],b[2],c[2])]});}
  if(!this.triangles.length)throw Error('Body mesh has no nondegenerate triangles');this.degenerateTriangles=degenerate;this.nodeCount=0;
  const build=ts=>{this.nodeCount++;const box=[Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity];for(const t of ts)for(let k=0;k<3;k++){box[k]=Math.min(box[k],t.box[k]);box[k+3]=Math.max(box[k+3],t.box[k+3]);}if(ts.length<=leafSize)return {box,triangles:ts};let axis=0;for(let k=1;k<3;k++)if(box[k+3]-box[k]>box[axis+3]-box[axis])axis=k;ts.sort((a,b)=>(a.box[axis]+a.box[axis+3])-(b.box[axis]+b.box[axis+3]));const h=ts.length>>1;return {box,left:build(ts.slice(0,h)),right:build(ts.slice(h))};};this.root=build(this.triangles.slice());this.bounds=this.root.box;this.stats={triangleTests:0,pointTests:0,rayTests:0};
 }
 // A conservative broad phase: triangle boxes and infinite supporting planes.
 // Returning false proves no surface contact; callers still test closed volume.
 mayTouch(a,b,r0,r1=r0){const radius=Math.max(r0,r1),visit=node=>{if(aabbDistance2(a,b,node.box)>radius*radius)return false;if(node.triangles){for(const tri of node.triangles){if(aabbDistance2(a,b,tri.box)>radius*radius)continue;const h0=(a[0]-tri.a[0])*tri.normal[0]+(a[1]-tri.a[1])*tri.normal[1]+(a[2]-tri.a[2])*tri.normal[2],h1=(b[0]-tri.a[0])*tri.normal[0]+(b[1]-tri.a[1])*tri.normal[1]+(b[2]-tri.a[2])*tri.normal[2];if(h0*h1>=0&&Math.min(Math.abs(h0)-r0,Math.abs(h1)-r1)>BOUNDARY)continue;return true;}return false;}return visit(node.left)||visit(node.right);};return visit(this.root);}
 nearestPoint(p){let best={distance:Infinity,surface:null,normal:null,triangle:-1};const visit=node=>{if(aabbDistance2(p,p,node.box)>best.distance*best.distance)return;if(node.triangles){for(const tri of node.triangles){this.stats.pointTests++;const q=pointTriangle(p,tri.a,tri.b,tri.c),d=Math.hypot(...sub(p,q));if(d<best.distance)best={distance:d,surface:q,normal:tri.normal,triangle:tri.index};}}else{let x=node.left,y=node.right;if(aabbDistance2(p,p,x.box)>aabbDistance2(p,p,y.box)){x=node.right;y=node.left;}visit(x);visit(y);}};visit(this.root);return best;}
 nearestSegment(a,b,r0=0,r1=r0){let best={clearance:Infinity,distance:Infinity,t:0,point:a.slice(),surface:null,normal:null,triangle:-1};const radius=Math.max(r0,r1),visit=node=>{const lower=Math.sqrt(aabbDistance2(a,b,node.box))-radius;if(lower>best.clearance+1e-12)return;if(node.triangles){for(const tri of node.triangles){if(Math.sqrt(aabbDistance2(a,b,tri.box))-radius>best.clearance+1e-12)continue;this.stats.triangleTests++;const q=segmentTriangle(a,b,tri.a,tri.b,tri.c,r0,r1);if(q.clearance<best.clearance)best={...q,normal:tri.normal,triangle:tri.index};}}else{let x=node.left,y=node.right;if(aabbDistance2(a,b,x.box)>aabbDistance2(a,b,y.box)){x=node.right;y=node.left;}visit(x);visit(y);}};visit(this.root);return best;}
 intersections(o,d,lo=0,hi=Infinity){const hits=[],visit=node=>{if(!rayBox(o,d,node.box,lo,hi))return;if(node.triangles){for(const t of node.triangles){this.stats.rayTests++;const s=rayTriangle(o,d,t);if(s!==null&&s>=lo-EPS&&s<=hi+EPS)hits.push(s);}}else{visit(node.left);visit(node.right);}};visit(this.root);hits.sort((a,b)=>a-b);const unique=[];for(const t of hits)if(!unique.length||Math.abs(t-unique[unique.length-1])>1e-7)unique.push(t);return unique;}
 inside(p){const box=this.bounds;for(let k=0;k<3;k++)if(p[k]<box[k]-BOUNDARY||p[k]>box[k+3]+BOUNDARY)return false;
  // A non-axis ray avoids the shared radial seam and center for normal inputs.
  // Coincident shared-edge hits are merged. The mesh must be closed/non-self-intersecting.
  return this.intersections(p,[.3713906763541037,.8222341571851058,.4317716383589267],BOUNDARY).length%2===1;
 }
 signedPoint(p){const q=this.nearestPoint(p);q.inside=q.distance>BOUNDARY&&this.inside(p);q.signedDistance=q.inside?-q.distance:q.distance;if(q.distance<=BOUNDARY)q.signedDistance=0;q.point=p.slice();q.direction=q.distance>BOUNDARY?scale(sub(p,q.surface),(q.inside?-1:1)/q.distance):q.normal.slice();return q;}
 // Interior maxima use a certified Lipschitz upper bound. If the budget is
 // exhausted, the conservative upper bound is returned, NEVER false clearance.
 deepest(a,b,r0,r1,intervals,{tolerance=2e-6,maxSamples=96}={}){const length=Math.hypot(...sub(b,a)),dr=r1-r0,L=length+Math.abs(dr);let best=null,queue=[],samples=0;
  const evaluate=t=>{const p=lerp(a,b,t),q=this.nearestPoint(p),radius=r0+dr*t,depth=q.distance,score=depth+radius;const v={t,point:p,surface:q.surface,normal:q.normal,triangle:q.triangle,depth,score,distance:depth,inside:true};samples++;if(!best||score>best.score)best=v;return v;};
  const interval=(l,r,vl,vr)=>{const upper=Math.max(vl.score,vr.score,(vl.score+vr.score+L*(r-l))*.5);queue.push({l,r,vl,vr,upper});};
  for(const [l,r]of intervals){const vl=evaluate(l),vr=evaluate(r);interval(l,r,vl,vr);}
  let upper=best?best.score:-Infinity;
  while(queue.length){let j=0;for(let k=1;k<queue.length;k++)if(queue[k].upper>queue[j].upper)j=k;const span=queue[j];upper=Math.max(best.score,span.upper);if(upper-best.score<=tolerance||samples>=maxSamples)break;queue[j]=queue[queue.length-1];queue.pop();const m=(span.l+span.r)*.5,vm=evaluate(m);interval(span.l,m,span.vl,vm);interval(m,span.r,vm,span.vr);}
  return best?{...best,upperPenetration:upper,errorBound:Math.max(0,upper-best.score),samples}:null;
 }
 capsule(a,b,radius,{radiusEnd=radius,tolerance=2e-6,maxSamples=96}={}){const q=this.nearestSegment(a,b,radius,radiusEnd),u=sub(b,a),length=Math.hypot(...u),ts=length>EPS?this.intersections(a,u,0,1).filter(t=>t>1e-7&&t<1-1e-7):[],bounds=[0,...ts,1],interior=[];
  for(let i=0;i<bounds.length-1;i++){const l=bounds[i],r=bounds[i+1];if(this.inside(lerp(a,b,(l+r)*.5)))interior.push([l,r]);}
  let best={...q,penetration:-q.clearance,upperPenetration:-q.clearance,errorBound:0,inside:false,depth:0,samples:0};
  if(interior.length){const d=this.deepest(a,b,radius,radiusEnd,interior,{tolerance,maxSamples});if(d&&d.upperPenetration>best.upperPenetration)best={...d,penetration:d.score,clearance:-d.score};}
  const delta=sub(best.point,best.surface),d=Math.hypot(...delta);best.direction=d>BOUNDARY?scale(delta,(best.inside?-1:1)/d):best.normal.slice();best.intersections=ts.length;return best;
 }
}
// Intersect segment parameter interval with its own root's fixed material socket.
function socketInterval(a,b,frame,s0,s1){const R=frame.radius,span=1.5*R,I=[0,1];if(!clipLinear(I,span-s0,-(s1-s0)))return null;
 const w=sub(a,frame.point),v=sub(b,a),h=dot(w,frame.normal),dh=dot(v,frame.normal);if(!clipLinear(I,h,dh,-.25*R))return null;
 const x=sub(w,scale(frame.normal,h)),u=sub(v,scale(frame.normal,dh)),A=dot(u,u),B=dot(x,u),D=dot(x,x)-span*span;
 if(A<1e-24){if(D>EPS)return null;}else{const det=B*B-A*D;if(det<0)return null;const sq=Math.sqrt(Math.max(0,det));I[0]=Math.max(I[0],(-B-sq)/A);I[1]=Math.min(I[1],(-B+sq)/A);}
 I[0]=clamp(I[0],0,1);I[1]=clamp(I[1],0,1);return I[0]<=I[1]+1e-12?I:null;
}
class BodyCollider{
 constructor(geometry=mesh(),{skin=.001,tolerance=2e-6,maxInteriorSamples=96}={}){this.mesh=geometry;this.bvh=new TriangleBVH(geometry);this.skin=skin;this.tolerance=tolerance;this.maxInteriorSamples=maxInteriorSamples;this.cache=new WeakMap();}
 prepare(system){let data=this.cache.get(system);if(data&&data.roots===system.roots&&data.restLength===system.restLength)return data;const M=system.segmentA.length,arc=new Float64Array(M),byChain=new Map(),frames=system.roots.map(r=>{const point=[r.x,r.y,r.z],hit=this.bvh.nearestPoint(point);return {point,normal:(r.normal||hit.normal).slice(),radius:r.radius};});
  for(let i=0;i<M;i++){const chain=system.chain[i];let list=byChain.get(chain);if(!list){list=[];byChain.set(chain,list);}list.push(i);}for(const list of byChain.values()){list.sort((a,b)=>system.local[a]-system.local[b]);let s=0,expected=0;for(const i of list){if(system.local[i]!==expected)s=Infinity;arc[i]=s;s+=system.restLength[i];expected=system.local[i]+1;}}
  data={roots:system.roots,restLength:system.restLength,arc,frames};this.cache.set(system,data);return data;
 }
 segment(system,i,{project=false,raw=false}={}){const p=system.positions,ai=system.segmentA[i]*3,bi=system.segmentB[i]*3,a=[p[ai],p[ai+1],p[ai+2]],b=[p[bi],p[bi+1],p[bi+2]],R=system.radius[i],data=this.prepare(system),frame=data.frames[system.chain[i]],s0=data.arc[i],s1=s0+system.restLength[i],socket=frame?socketInterval(a,b,frame,s0,s1):null,parts=[];
  // Global AABB rejection is safe for both surface and interior queries.
  if(aabbDistance2(a,b,this.bvh.bounds)>(R+(project?this.skin:0))**2||(!this.bvh.mayTouch(a,b,R+(project?this.skin:0))&&!this.bvh.inside(lerp(a,b,.5))))return {penetration:0,upperPenetration:0,rawPenetration:0,excluded:0,inside:false,skipped:true};
  if(socket){if(socket[0]>1e-12)parts.push([0,socket[0],false]);if(socket[1]-socket[0]>1e-12)parts.push([socket[0],socket[1],true]);if(socket[1]<1-1e-12)parts.push([socket[1],1,false]);}else parts.push([0,1,false]);
  const options={tolerance:this.tolerance,maxSamples:this.maxInteriorSamples};let best={penetration:0,upperPenetration:0,rawPenetration:0,excluded:0,inside:false,skipped:false},socketCount=0;
  for(const [l,h,allowed]of parts){let r0=R,r1=R;
   if(allowed){const u0=clamp((s0+(s1-s0)*l)/(1.5*frame.radius),0,1),u1=clamp((s0+(s1-s0)*h)/(1.5*frame.radius),0,1);
    // Linear body-clearance radius plus a linearly disappearing entry allowance.
    r0=R*u0-.25*frame.radius*(1-u0);r1=R*u1-.25*frame.radius*(1-u1);if(project){r0+=this.skin*u0;r1+=this.skin*u1;}socketCount++;
   }else if(project){r0+=this.skin;r1+=this.skin;}
   const aa=lerp(a,b,l),bb=lerp(a,b,h);if(!this.bvh.mayTouch(aa,bb,Math.max(0,r0),Math.max(0,r1))&&!this.bvh.inside(lerp(aa,bb,.5)))continue;let q=this.bvh.capsule(aa,bb,r0,{...options,radiusEnd:r1});
   // Exact mesh depth is an additional socket bound, independent of tangent depth.
   if(allowed&&q.inside){const full=this.bvh.capsule(aa,bb,R+(project?this.skin:0),options);if(full.upperPenetration-(R+(project?this.skin:0))>.25*frame.radius)q=full;}
   q.t=l+(h-l)*q.t;q.socket=allowed;if(q.upperPenetration>best.upperPenetration)best={...best,...q};
  }
  if(raw){const q=socketCount?this.bvh.capsule(a,b,R,options):best;best.rawPenetration=Math.max(0,q.upperPenetration);best.centerlineEntry=q.inside?Math.max(0,q.upperPenetration-R):0;best.rawInside=!!q.inside;best.excluded=socketCount?Math.max(0,best.rawPenetration-Math.max(0,best.upperPenetration)):0;}
  best.socketParts=socketCount;return best;
 }
 measure(system){if(!system||!system.positions||!system.segmentA||!system.segmentB||!system.radius||!system.roots||!system.inverseMass)throw Error('Complete ContactSystem geometry is required');
  const res={bodyChecked:true,bodyPenetration:0,bodyRawPenetration:0,bodyViolations:0,bodyInsideSegments:0,bodyDeepestCenterlineEntry:0,bodySocketExclusions:0,bodySocketAllowedPenetration:0,bodyQueryErrorBound:0,bodyCheckedSegments:system.segmentA.length,bodyTriangles:this.bvh.triangles.length,bodyDegenerateTriangles:this.bvh.degenerateTriangles};
  for(let i=0;i<system.segmentA.length;i++){const q=this.segment(system,i,{raw:true});res.bodyPenetration=Math.max(res.bodyPenetration,Math.max(0,q.upperPenetration));res.bodyRawPenetration=Math.max(res.bodyRawPenetration,q.rawPenetration);res.bodyQueryErrorBound=Math.max(res.bodyQueryErrorBound,q.errorBound||0);if(q.upperPenetration>this.tolerance)res.bodyViolations++;if(q.rawInside)res.bodyInsideSegments++;res.bodyDeepestCenterlineEntry=Math.max(res.bodyDeepestCenterlineEntry,q.centerlineEntry||0);if(q.excluded>this.tolerance){res.bodySocketExclusions++;res.bodySocketAllowedPenetration=Math.max(res.bodySocketAllowedPenetration,q.excluded);}}
  return res;
 }
 project(system){const p=system.positions,m=system.inverseMass;let projected=0,unresolved=0,maximum=0;
  for(let i=0;i<system.segmentA.length;i++){const q=this.segment(system,i,{project:true});if(q.upperPenetration<=this.tolerance)continue;maximum=Math.max(maximum,q.upperPenetration);const a=system.segmentA[i],b=system.segmentB[i],s=q.t,wa=(1-s)*m[a],wb=s*m[b],den=(1-s)*wa+s*wb;if(den<1e-14||!q.direction){unresolved++;continue;}const amount=Math.max(0,q.penetration)/den;for(let k=0;k<3;k++){p[a*3+k]+=q.direction[k]*amount*wa;p[b*3+k]+=q.direction[k]*amount*wb;}projected++;
  }return {bodyProjected:projected,bodyUnresolved:unresolved,bodyProjectionMaximum:maximum};
 }
}
/* API: AnemoneBody.mesh() returns fresh Float32 positions/normals, Uint16 indices.
 * new BodyCollider(sharedMesh, options); project(system) mutates only positions;
 * measure(system) is read-only. Both use node indices, not xyz array offsets.
 * roots are {x,y,z,radius}; local is material segment index; restLength is fixed.
 * Changing roots/rest lengths in place requires collider.cache.delete(system).
 * TriangleBVH: nearestPoint, signedPoint, nearestSegment, capsule, intersections.
 * capsule radiusEnd gives a linearly varying clearance radius. Negative radii
 * are ONLY a socket signed-clearance allowance, never ordinary capsule geometry.
 * bodyPenetration is a conservative maximum forbidden penetration bound;
 * bodyRawPenetration retains original full-capsule overlap, including attachment.
 * bodySocketExclusions counts segments with explicitly permitted overlap and
 * bodySocketAllowedPenetration is the largest excluded depth. No pair exclusions.
 * Interior depth error <=2e-6 normally; exhaustion reports its larger upper bound.
 * Boundary tolerance 2e-7 handles Float32 root attachment and duplicated seams.
 * Arbitrary open/self-intersecting meshes have no supported inside semantics.
 * The exact r03 mesh includes 96 zero-area oral center triangles, omitted from
 * query acceleration only, never from the shared render geometry. */
const api={mesh,pointTriangle,segmentTriangle,TriangleBVH,BodyCollider,socketInterval,BOUNDARY};root.AnemoneBody=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
