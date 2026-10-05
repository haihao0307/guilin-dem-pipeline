/**
 * Daniel Bystedt's original free 3D guides, adapted to GNM.
 * Geometry/data attribution: Daniel Bystedt. CC BY-SA license (source version
 * unspecified). This implementation is an independently written adaptation.
 * See TEACHER-GROOM-PROVENANCE.json for source and modification boundaries.
 *
 * API: new TeacherGroomBinding(model, data, {region:'scalp'|'brows',count,segments,seed})
 * update(modelPositions, modelNormals) reuses and returns this.
 * All output geometry is UNDUPLICATED: xyz arrays have count*(segments+1)*3
 * entries; radii and strandRandom have count*(segments+1) entries. Radii are
 * GNM-native world-space RADIUS values, including taper; do not taper twice.
 * roots/rootTriangles/rootBarycentrics bind only the strand root to GNM.
 * rootNormals is repeated per point for the renderer. sourceGuideIds and
 * guideWeights are count*3; roles: 0 original main/brow guide, 1 original
 * independent guide, 2 interpolated child, 3 independent-guide child.
 * Free neutral offsets deform in the exact root triangle's tangent frame.
 * Cached nearest-skin constraints only push near-skin penetration outward;
 * they do not pull free points back to skin. They are a bounded local collision
 * approximation, not a global proof against intersections for arbitrary poses.
 */
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const mul=(a,s)=>[a[0]*s,a[1]*s,a[2]*s];
const unit=a=>mul(a,1/(Math.hypot(...a)||1));
const xyz=(p,i)=>[p[i*3],p[i*3+1],p[i*3+2]];
function rng(seed){let s=seed>>>0;return()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};}
function baryPoint(positions,triangles,t,b){const p=[0,0,0];for(let k=0;k<3;k++){const v=triangles[t*3+k]*3;for(let d=0;d<3;d++)p[d]+=positions[v+d]*b[k];}return p;}
export function teacherVertexNormals(model,positions=model.template){const n=new Float32Array(positions.length),tr=model.triangles;for(let t=0;t<tr.length;t+=3){const a=xyz(positions,tr[t]),b=xyz(positions,tr[t+1]),c=xyz(positions,tr[t+2]),v=cross(sub(b,a),sub(c,a));for(let k=0;k<3;k++)for(let d=0;d<3;d++)n[tr[t+k]*3+d]+=v[d];}for(let v=0;v<n.length;v+=3){const l=Math.hypot(n[v],n[v+1],n[v+2])||1;n[v]/=l;n[v+1]/=l;n[v+2]/=l;}return n;}
function frame(model,p,n,t,b){const root=baryPoint(p,model.triangles,t,b),normal=unit(baryPoint(n,model.triangles,t,b)),a=xyz(p,model.triangles[t*3]),e=sub(xyz(p,model.triangles[t*3+1]),a);const u=unit(sub(e,mul(normal,dot(e,normal)))),v=unit(cross(normal,u));return {root,u,v,n:normal,edge:Math.hypot(...e)};}
function closestTriangle(p,a,b,c){
 const ab=sub(b,a),ac=sub(c,a),ap=sub(p,a),d1=dot(ab,ap),d2=dot(ac,ap);if(d1<=0&&d2<=0)return {p:a,b:[1,0,0]};
 const bp=sub(p,b),d3=dot(ab,bp),d4=dot(ac,bp);if(d3>=0&&d4<=d3)return {p:b,b:[0,1,0]};
 const vc=d1*d4-d3*d2;if(vc<=0&&d1>=0&&d3<=0){const v=d1/(d1-d3);return {p:add(a,mul(ab,v)),b:[1-v,v,0]};}
 const cp=sub(p,c),d5=dot(ab,cp),d6=dot(ac,cp);if(d6>=0&&d5<=d6)return {p:c,b:[0,0,1]};
 const vb=d5*d2-d1*d6;if(vb<=0&&d2>=0&&d6<=0){const w=d2/(d2-d6);return {p:add(a,mul(ac,w)),b:[1-w,0,w]};}
 const va=d3*d6-d5*d4;if(va<=0&&d4-d3>=0&&d5-d6>=0){const w=(d4-d3)/(d4-d3+d5-d6);return {p:add(b,mul(sub(c,b),w)),b:[0,1-w,w]};}
 const den=1/(va+vb+vc),v=vb*den,w=vc*den;return {p:add(a,add(mul(ab,v),mul(ac,w))),b:[1-v-w,v,w]};
}
/** Dependency-free neutral-skin BVH, used once while binding. */
export class TeacherSkinBVH{
 constructor(model,positions=model.template,allowed=null){this.model=model;this.positions=positions;this.faces=[];const tr=model.triangles;for(let t=0;t<tr.length/3;t++){if(allowed&&!allowed.has(t))continue;if([0,1,2].some(k=>model.componentId[tr[t*3+k]]!==0))continue;const a=xyz(positions,tr[t*3]),b=xyz(positions,tr[t*3+1]),c=xyz(positions,tr[t*3+2]);this.faces.push({t,a,b,c,n:unit(cross(sub(b,a),sub(c,a))),min:a.map((x,k)=>Math.min(x,b[k],c[k])),max:a.map((x,k)=>Math.max(x,b[k],c[k])),center:a.map((x,k)=>(x+b[k]+c[k])/3)});}this.root=this.build(this.faces);}
 build(f){const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(const a of f)for(let k=0;k<3;k++){min[k]=Math.min(min[k],a.min[k]);max[k]=Math.max(max[k],a.max[k]);}const node={min,max};if(f.length<=12){node.faces=f;return node;}let axis=0;for(let k=1;k<3;k++)if(max[k]-min[k]>max[axis]-min[axis])axis=k;f.sort((a,b)=>a.center[axis]-b.center[axis]);const mid=f.length>>1;node.left=this.build(f.slice(0,mid));node.right=this.build(f.slice(mid));return node;}
 segmentHit(a,b){const d=sub(b,a);let answer=null,best=1;const box=node=>{let lo=0,hi=best;for(let k=0;k<3;k++){if(Math.abs(d[k])<1e-16){if(a[k]<node.min[k]||a[k]>node.max[k])return false;}else{let x=(node.min[k]-a[k])/d[k],y=(node.max[k]-a[k])/d[k];if(x>y){const t=x;x=y;y=t;}lo=Math.max(lo,x);hi=Math.min(hi,y);if(lo>hi)return false;}}return true;};const visit=node=>{if(!box(node))return;if(node.faces){for(const f of node.faces){const e1=sub(f.b,f.a),e2=sub(f.c,f.a),h=cross(d,e2),det=dot(e1,h);if(Math.abs(det)<1e-16)continue;const inv=1/det,uvec=sub(a,f.a),u=dot(uvec,h)*inv;if(u<0||u>1)continue;const q=cross(uvec,e1),v=dot(d,q)*inv;if(v<0||u+v>1)continue;const t=dot(e2,q)*inv;if(t>=0&&t<=best){best=t;answer={t,point:add(a,mul(d,t)),normal:f.n,triangle:f.t};}}}else{visit(node.left);visit(node.right);}};visit(this.root);return answer;}
 nearest(p){let best=null,distance=Infinity;const box=n=>{let v=0;for(let k=0;k<3;k++)v+=(p[k]<n.min[k]?n.min[k]-p[k]:p[k]>n.max[k]?p[k]-n.max[k]:0)**2;return v;};const visit=node=>{if(box(node)>distance)return;if(node.faces){for(const f of node.faces){const q=closestTriangle(p,f.a,f.b,f.c),d=dot(sub(p,q.p),sub(p,q.p));if(d<distance){distance=d;best={...q,t:f.t,n:f.n,distance:Math.sqrt(d)};}}}else{const a=box(node.left),b=box(node.right);if(a<b){visit(node.left);visit(node.right);}else{visit(node.right);visit(node.left);}}};visit(this.root);return best;}
}
function lineDistance(p,line){let best=Infinity;for(let i=1;i<line.length;i++){const a=line[i-1],b=line[i],dx=b[0]-a[0],dy=b[1]-a[1],u=clamp(((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1),0,1);best=Math.min(best,Math.hypot(p[0]-a[0]-dx*u,p[1]-a[1]-dy*u));}return best;}
function guidePoint(g,s){const f=s*(g.points.length-1),i=Math.min(g.points.length-2,Math.floor(f)),u=f-i;return g.points[i].map((v,k)=>v*(1-u)+g.points[i+1][k]*u);}
export class TeacherGroomBinding{
 constructor(model,data,options={}){
  if(data.schema!=='gnm-teacher-groom-v1')throw Error('Teacher groom schema mismatch');
  this.model=model;this.data=data;this.region=options.region||'scalp';this.count=options.count||(this.region==='brows'?1000:14000);this.segments=options.segments||(this.region==='brows'?10:24);this.options={count:this.count,segments:this.segments,region:this.region,seed:options.seed||8124,...options};this.per=this.segments+1;this.guides=this.region==='brows'?data.groups.brows:[...data.groups.main,...data.groups.independent];this.mainCount=this.region==='brows'?this.guides.length:data.groups.main.length;
  const count=this.count,points=count*this.per;this.positions=new Float32Array(points*3);this.tangents=new Float32Array(points*3);this.rootNormals=new Float32Array(points*3);this.radii=new Float32Array(points);this.strandRandom=new Float32Array(points);this.roots=new Float32Array(count*3);this.rootTriangles=new Int32Array(count);this.rootBarycentrics=new Float32Array(count*3);this.templateRoots=new Float32Array(count*3);this.sourceGuideIds=new Uint16Array(count*3);this.guideWeights=new Float32Array(count*3);this.roles=new Uint8Array(count);this.zones=new Uint8Array(count);this.random=new Float32Array(count);this.islands=new Uint8Array(count);this.localOffsets=new Float32Array(points*3);this.neutralEdges=new Float32Array(count);this.collisionTriangles=new Int32Array(points).fill(-1);this.collisionBarycentrics=new Float32Array(points*3);this.collisionClearance=new Float32Array(points);this.midTriangles=new Int32Array(points).fill(-1);this.midBarycentrics=new Float32Array(points*3);this.clearance=this.region==='brows'?.00007:.00010;this.skinBVH=new TeacherSkinBVH(model);this.neutralNormals=teacherVertexNormals(model);this.makeLandmarks();this.bind();this.initializeEarEnvelopes();this.update(model.template,this.neutralNormals);
 }
 makeLandmarks(){const raw=new Float32Array(204);this.model.computeLandmarks(this.model.template,raw);const range=(a,b)=>Array.from({length:b-a+1},(_,i)=>xyz(raw,i+a));this.eyes=[range(36,41),range(42,47)];for(const eye of this.eyes)eye.push(eye[0]);}
 rootSafe(p){if(this.region==='scalp'){const [x,y,z]=p,front=clamp((z-.025)/.08,0,1),line=.273+front*.074+Math.max(0,Math.abs(x)-.05)*.2+.0025*Math.sin(Math.abs(x)*52)*front;return Math.min(y-line,Math.max(.073-Math.abs(x),y-.316,-.022-z))>.00015;}return Math.abs(p[0])>.007&&Math.abs(p[0])<.06&&p[1]>.308&&p[1]<.332&&p[2]>.09&&Math.min(...this.eyes.map(l=>lineDistance(p,l)))>.0055;}
 bind(){
  const start=performance.now(),random=rng(this.options.seed),m=this.model,per=this.per,items=[];let area=0;
  const allowed=this.region==='scalp'?new Set(this.data.scalpTriangles):null;
  for(const f of this.skinBVH.faces){if(allowed&&!allowed.has(f.t))continue;if(!this.rootSafe(f.center))continue;if(this.region==='brows'&&Math.min(...this.guides.map(g=>Math.hypot(...sub(f.center,g.root))))>.0034)continue;const ar=Math.hypot(...cross(sub(f.b,f.a),sub(f.c,f.a)))/2;if(ar<1e-12)continue;area+=ar;items.push({t:f.t,total:area});}
  if(!items.length)throw Error('No safe teacher root domain');this.candidateTriangleCount=items.length;this.maxNeutralCorrection=0;this.neutralCollisionRepairs=0;this.retainedSourceGuides=0;
  for(let i=0;i<this.count;i++){
   let t,b,p,given=i<this.guides.length;
   if(given){const g=this.guides[i];t=g.triangle;b=g.barycentric;p=baryPoint(m.template,m.triangles,t,b);if(!this.rootSafe(p))given=false;}
   if(!given){let attempts=0;do{if(attempts++>500)throw Error('Teacher roots could not fill safe domain');const choice=random()*area;let lo=0,hi=items.length-1;while(lo<hi){const mid=(lo+hi)>>1;if(items[mid].total<choice)lo=mid+1;else hi=mid;}t=items[lo].t;const u=Math.sqrt(random()),v=random();b=[1-u,u*(1-v),u*v];p=baryPoint(m.template,m.triangles,t,b);}while(!this.rootSafe(p));}
   this.rootTriangles[i]=t;this.rootBarycentrics.set(b,i*3);this.templateRoots.set(p,i*3);const f=frame(m,m.template,this.neutralNormals,t,b);this.neutralEdges[i]=f.edge;this.random[i]=random();
   const candidates=this.guides.map((g,id)=>({id,d:dot(sub(p,g.root),sub(p,g.root))})).sort((a,b)=>a.d-b.d);let primary=given?i:candidates[0].id;
   // Children never interpolate across the artist's original part or brow side.
   const island=this.guides[primary].island,independent=primary>=this.mainCount;const nearest=candidates.filter(c=>this.guides[c.id].island===island&&(this.region==='brows'||(c.id>=this.mainCount)===independent)).slice(0,3);
   if(given){nearest.length=0;nearest.push({id:primary,d:0});this.retainedSourceGuides++;}
   while(nearest.length<3)nearest.push(nearest[0]);let sum=0,weights=nearest.map(c=>1/Math.max(c.d,.00000002));for(const w of weights)sum+=w;weights=weights.map(w=>w/sum);if(given)weights=[1,0,0];
   for(let k=0;k<3;k++){this.sourceGuideIds[i*3+k]=nearest[k].id;this.guideWeights[i*3+k]=weights[k];}this.islands[i]=island;this.roles[i]=given?(independent?1:0):(independent?3:2);this.zones[i]=this.region==='brows'?({inner:0,middle:1,outer:2}[this.guides[primary].zone]):(independent?1:0);
   const gr=this.guides[primary],clump=given?0:(this.region==='brows'?.10:.30+.45*random()),phase=random()*Math.PI*2,neutralPoints=[];
   for(let j=0;j<per;j++){
    const s=j/this.segments,q=i*per+j;let point=p.slice();for(let k=0;k<3;k++){const guide=this.guides[nearest[k].id],gp=guidePoint(guide,s);for(let d=0;d<3;d++)point[d]+=weights[k]*(gp[d]-guide.root[d]);}
    // Hierarchy: smooth nearby authored guides, then converge gently toward the
    // dominant authored clump. Only seeded small fibre noise is added.
    const converge=clump*Math.pow(s,.72);for(let d=0;d<3;d++)point[d]+=(gr.root[d]-p[d])*converge;
    const noise=given?0:(this.region==='brows'?.000025:.00010)*s*s;for(let d=0;d<3;d++)point[d]+=noise*(f.u[d]*Math.sin(phase+s*14)+f.v[d]*Math.cos(phase*1.7+s*11));
    if(j===0)point=add(p,mul(f.n,this.clearance));
    let hit=this.skinBVH.nearest(point),signed=dot(sub(point,hit.p),hit.n);
    if(signed<this.clearance&&j>0){const correction=this.clearance-signed;point=add(point,mul(hit.n,correction));this.maxNeutralCorrection=Math.max(this.maxNeutralCorrection,correction);this.neutralCollisionRepairs++;hit=this.skinBVH.nearest(point);}
    neutralPoints.push(point);const delta=sub(point,p);this.localOffsets[q*3]=dot(delta,f.u);this.localOffsets[q*3+1]=dot(delta,f.v);this.localOffsets[q*3+2]=dot(delta,f.n);
    // Cache a collision surface only inside 0.012 native units of skin. Long hanging points
    // keep no skin support; geometry remains free in 3D.
    if(hit.distance<.012&&j>0){this.collisionTriangles[q]=hit.t;this.collisionBarycentrics.set(hit.b,q*3);this.collisionClearance[q]=this.clearance;}
    const base=this.region==='brows'?.000045:.000037,variation=.78+.42*this.random[i],taper=Math.max(.06,1-s);this.radii[q]=base*variation*taper;this.strandRandom[q]=this.random[i];
   }
   if(this.region==='scalp'){
    // Resolve shaft chords, not just sampled points. A root remains fixed;
    // internal endpoints move only outward when an actual midpoint penetrates.
    const shaftGap=.00045;
    for(let pass=0;pass<3;pass++)for(let j=0;j<this.segments;j++){
     const mid=mul(add(neutralPoints[j],neutralPoints[j+1]),.5),hit=this.skinBVH.nearest(mid),gap=dot(sub(mid,hit.p),hit.n);
     if(gap<shaftGap){const d=shaftGap-gap;neutralPoints[j+1]=add(neutralPoints[j+1],mul(hit.n,d*(j===0?2:1)));if(j>0)neutralPoints[j]=add(neutralPoints[j],mul(hit.n,d));this.maxNeutralCorrection=Math.max(this.maxNeutralCorrection,d);}
    }
    for(let j=0;j<per;j++){
     const q=i*per+j,point=neutralPoints[j],delta=sub(point,p),hit=this.skinBVH.nearest(point);this.localOffsets[q*3]=dot(delta,f.u);this.localOffsets[q*3+1]=dot(delta,f.v);this.localOffsets[q*3+2]=dot(delta,f.n);
     if(hit.distance<.016&&j>0){this.collisionTriangles[q]=hit.t;this.collisionBarycentrics.set(hit.b,q*3);this.collisionClearance[q]=shaftGap;}
     if(j<this.segments){const mid=mul(add(point,neutralPoints[j+1]),.5),mh=this.skinBVH.nearest(mid);if(mh.distance<.016){this.midTriangles[q]=mh.t;this.midBarycentrics.set(mh.b,q*3);}}
    }
   }
  }
  this.lastBindMs=performance.now()-start;this.skinBVH=null;
 }
 update(positions,normals){
  const start=performance.now(),m=this.model,per=this.per;this.maxLiveCorrection=0;this.liveCollisionRepairs=0;this.earEnvelopes=this.currentEarEnvelopes(positions);this.contactTriggered ||=new Uint8Array(this.count);this.contactTriggered.fill(0);this.earAvoidance={affectedStrands:0,proxyHitSegments:0,maxDisplacement:0,totalDisplacement:0,maxLengthChange:0,totalLengthChange:0,rootMoved:0,rootProxyConflicts:0,trueTriggerStrands:0,trueRayTriggerSegments:0,radiusOnlyTriggerSegments:0,radiusUnresolvedTriggerSegments:0,rootCapApplied:0,neckCorrectedStrands:0,neckMaxDisplacement:0};if(this.region==='scalp'){this.earCollisionBVH=new TeacherSkinBVH(m,positions,this.earTriangleSet);this.neckCollisionBVH=new TeacherSkinBVH(m,positions,this.neckTriangleSet);}
  for(let i=0;i<this.count;i++){
   const b=this.rootBarycentrics.subarray(i*3,i*3+3),f=frame(m,positions,normals,this.rootTriangles[i],b),scale=clamp(f.edge/this.neutralEdges[i],.72,1.3);this.roots.set(f.root,i*3);
   for(let j=0;j<per;j++){
    const q=i*per+j,o=q*3,u=this.localOffsets[o]*scale,v=this.localOffsets[o+1]*scale,n=this.localOffsets[o+2]*scale;let px=f.root[0]+f.u[0]*u+f.v[0]*v+f.n[0]*n,py=f.root[1]+f.u[1]*u+f.v[1]*v+f.n[1]*n,pz=f.root[2]+f.u[2]*u+f.v[2]*v+f.n[2]*n;
    if(j===0){px=f.root[0]+f.n[0]*this.clearance;py=f.root[1]+f.n[1]*this.clearance;pz=f.root[2]+f.n[2]*this.clearance;}
    const ct=this.collisionTriangles[q];if(ct>=0){let sx=0,sy=0,sz=0,nx=0,ny=0,nz=0;for(let k=0;k<3;k++){const id=m.triangles[ct*3+k]*3,w=this.collisionBarycentrics[o+k];sx+=positions[id]*w;sy+=positions[id+1]*w;sz+=positions[id+2]*w;nx+=normals[id]*w;ny+=normals[id+1]*w;nz+=normals[id+2]*w;}const nd=Math.hypot(nx,ny,nz)||1;nx/=nd;ny/=nd;nz/=nd;const signed=(px-sx)*nx+(py-sy)*ny+(pz-sz)*nz,correction=this.collisionClearance[q]-signed;if(correction>0){px+=nx*correction;py+=ny*correction;pz+=nz*correction;this.maxLiveCorrection=Math.max(this.maxLiveCorrection,correction);this.liveCollisionRepairs++;}}
    this.positions[o]=px;this.positions[o+1]=py;this.positions[o+2]=pz;this.rootNormals[o]=f.n[0];this.rootNormals[o+1]=f.n[1];this.rootNormals[o+2]=f.n[2];
   }
   if(this.region==='scalp')for(let pass=0;pass<2;pass++)for(let j=0;j<this.segments;j++){
    const q=i*per+j,o=q*3,t=this.midTriangles[q];if(t<0)continue;let sx=0,sy=0,sz=0,nx=0,ny=0,nz=0;
    for(let k=0;k<3;k++){const id=m.triangles[t*3+k]*3,w=this.midBarycentrics[o+k];sx+=positions[id]*w;sy+=positions[id+1]*w;sz+=positions[id+2]*w;nx+=normals[id]*w;ny+=normals[id+1]*w;nz+=normals[id+2]*w;}const nd=Math.hypot(nx,ny,nz)||1;nx/=nd;ny/=nd;nz/=nd;const signed=((this.positions[o]+this.positions[o+3])*.5-sx)*nx+((this.positions[o+1]+this.positions[o+4])*.5-sy)*ny+((this.positions[o+2]+this.positions[o+5])*.5-sz)*nz,d=.00045-signed;
    if(d>0){const r=j===0?2:1;this.positions[o+3]+=nx*d*r;this.positions[o+4]+=ny*d*r;this.positions[o+5]+=nz*d*r;if(j>0){this.positions[o]+=nx*d;this.positions[o+1]+=ny*d;this.positions[o+2]+=nz*d;}this.maxLiveCorrection=Math.max(this.maxLiveCorrection,d);this.liveCollisionRepairs++;}
   }
   if(this.region==='scalp'){this.avoidEarEnvelopes(i);this.repairNeckTip(i);}
   for(let j=0;j<per;j++){const q=i*per+j,o=q*3,a=(i*per+Math.max(0,j-1))*3,b=(i*per+Math.min(this.segments,j+1))*3;let x=this.positions[b]-this.positions[a],y=this.positions[b+1]-this.positions[a+1],z=this.positions[b+2]-this.positions[a+2],d=Math.hypot(x,y,z);if(d<1e-9){x=f.n[0];y=f.n[1];z=f.n[2];d=1;}this.tangents[o]=x/d;this.tangents[o+1]=y/d;this.tangents[o+2]=z/d;}
  }
  this.surfacePositions=positions;this.surfaceNormals=normals;this.lastUpdateMs=performance.now()-start;return this;
 }

 /** Local conservative ear envelopes derived from actual neutral GNM vertices.
  * The two fitted ellipsoids are a collision proxy only. They do not replace
  * the visible head or scalp. The axis-aligned fits were minimized offline
  * against all selected vertices (SLSQP log-volume objective), then refitted
  * conservatively to those exact same vertex IDs on every deformation.
  * Native units. Poses are unexposed and are not certified by this experiment.
  */
 initializeEarEnvelopes(){
  if(this.region!=='scalp'){this.earReference=[];return;}
  const fitted=[{side:-1,center:[-.07675252,.26868798,.02327114],radii:[.01916620,.05351353,.03739677]},{side:1,center:[.07671676,.26864847,.02327088],radii:[.01928778,.05340873,.03732307]}];
  this.earReference=fitted.map(f=>{const ids=[],min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(let i=0;i<this.model.numVertices;i++){const p=xyz(this.model.template,i);if(this.model.componentId[i]!==0||p[0]*f.side<=.063||p[1]<=.235||p[1]>=.314||p[2]<=-.005||p[2]>=.05)continue;ids.push(i);for(let k=0;k<3;k++){min[k]=Math.min(min[k],p[k]);max[k]=Math.max(max[k],p[k]);}}return {...f,ids,min,max};});
  const selected=new Set(this.earReference.flatMap(e=>e.ids));this.earTriangleSet=new Set();this.neckTriangleSet=new Set();const tr=this.model.triangles,p=this.model.template;
  for(let t=0;t<tr.length/3;t++){const vs=[tr[t*3],tr[t*3+1],tr[t*3+2]];if(vs.some(v=>this.model.componentId[v]!==0))continue;if(vs.some(v=>selected.has(v)))this.earTriangleSet.add(t);if(vs.some(v=>p[v*3+1]>.12&&p[v*3+1]<.205&&Math.abs(p[v*3])>.06&&p[v*3+2]>-.065&&p[v*3+2]<.05))this.neckTriangleSet.add(t);}
 }
 currentEarEnvelopes(positions){
  return (this.earReference||[]).map(ref=>{const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(const i of ref.ids)for(let k=0;k<3;k++){const v=positions[i*3+k];min[k]=Math.min(min[k],v);max[k]=Math.max(max[k],v);}const scale=min.map((v,k)=>(max[k]-v)/(ref.max[k]-ref.min[k])),center=ref.center.map((v,k)=>min[k]+(v-ref.min[k])*scale[k]),radii=ref.radii.map((v,k)=>v*scale[k]);let factor=1;for(const i of ref.ids){let d=0;for(let k=0;k<3;k++)d+=((positions[i*3+k]-center[k])/radii[k])**2;factor=Math.max(factor,Math.sqrt(d));}for(let k=0;k<3;k++)radii[k]*=factor*1.00001;return {side:ref.side,center,radii,vertexCount:ref.ids.length,maxVertexNormalizedRadius:1/1.00001,bbox:[center.map((v,k)=>v-radii[k]),center.map((v,k)=>v+radii[k])],radiusMargin:.0001254,safetyMargin:.00015};});
 }
 /** Maximum lateral displacement needed over an entire segment against the
  * convex ellipsoid. Exact quadratic identifies an intersection; a bounded
  * 28-step golden search maximizes the concave outer-envelope function. */
 earSegmentNeed(a,b,ear,radius){
  const inflate=1+(radius+.00015)/Math.min(...ear.radii),r=ear.radii.map(v=>v*inflate),c=ear.center,side=ear.side,px=side*a[0],qx=side*b[0],cx=side*c[0];
  if(Math.min(px,qx)>cx+r[0]||Math.max(px,qx)<cx-r[0]||Math.min(a[1],b[1])>c[1]+r[1]||Math.max(a[1],b[1])<c[1]-r[1]||Math.min(a[2],b[2])>c[2]+r[2]||Math.max(a[2],b[2])<c[2]-r[2])return 0;
  const u=a.map((v,k)=>(v-c[k])/r[k]),v=b.map((x,k)=>(x-a[k])/r[k]),vv=dot(v,v),near=clamp(-dot(u,v)/(vv||1),0,1);if(dot(add(u,mul(v,near)),add(u,mul(v,near)))>=1)return 0;
  const A=v[1]*v[1]+v[2]*v[2],B=2*(u[1]*v[1]+u[2]*v[2]),C=u[1]*u[1]+u[2]*u[2]-1;let lo=0,hi=1;
  if(A>1e-16){const disc=Math.max(0,B*B-4*A*C),root=Math.sqrt(disc);lo=Math.max(0,(-B-root)/(2*A));hi=Math.min(1,(-B+root)/(2*A));if(lo>hi)return 0;}else if(C>0)return 0;
  const need=t=>cx+r[0]*Math.sqrt(Math.max(0,1-(u[1]+v[1]*t)**2-(u[2]+v[2]*t)**2))-(px+(qx-px)*t),ratio=.6180339887498949;let l=lo,h=hi,x=h-(h-l)*ratio,y=l+(h-l)*ratio,fx=need(x),fy=need(y);
  for(let k=0;k<28;k++){if(fx<fy){l=x;x=y;fx=fy;y=l+(h-l)*ratio;fy=need(y);}else{h=y;y=x;fy=fx;x=h-(h-l)*ratio;fx=need(x);}}
  return Math.max(0,need(lo),need(hi),fx,fy)+.00001;
 }
 localContact(a,b,arc,j,radius,bvh){
  const length=Math.hypot(...sub(b,a));let start=arc<.0002?Math.min(1,(.0002-arc)/(length||1)):0;if(start>=1)return null;const aa=add(a,mul(sub(b,a),start)),box=bvh.root,maxRadius=radius*Math.max(.06,1-(j+start)/this.segments);
  for(let k=0;k<3;k++)if(Math.min(aa[k],b[k])>box.max[k]+maxRadius||Math.max(aa[k],b[k])<box.min[k]-maxRadius)return null;
  const ray=bvh.segmentHit(aa,b);if(ray)return {kind:'ray',hit:ray};
  const stack=[[start,1,0]];while(stack.length){const [u,v,depth]=stack.pop(),mid=(u+v)*.5,p=add(a,mul(sub(b,a),mid)),hit=bvh.nearest(p),r=radius*Math.max(.06,1-(j+mid)/this.segments);if(hit.distance<r)return {kind:'radius',hit};const maxR=radius*Math.max(.06,1-(j+u)/this.segments);if(hit.distance-length*(v-u)*.5>=maxR)continue;if(depth>=12)return {kind:'unresolved',hit};stack.push([u,mid,depth+1],[mid,v,depth+1]);}return null;
 }
 avoidEarEnvelopes(i){
  const per=this.per,start=i*per,points=Array.from({length:per},(_,j)=>xyz(this.positions,start+j)),original=points.map(p=>p.slice()),arc=[0];for(let j=1;j<per;j++)arc.push(arc[j-1]+Math.hypot(...sub(points[j],points[j-1])));let changed=false;
  const radius=.0001045*(.78+.42*this.random[i]),triggers=new Uint8Array(this.segments);this.contactTriggered ||=new Uint8Array(this.count);
  for(let repairPass=0;repairPass<3;repairPass++){
   triggers.fill(0);let triggerCount=0;for(let j=0;j<this.segments;j++){const contact=this.localContact(points[j],points[j+1],arc[j],j,radius,this.earCollisionBVH);if(contact){triggers[j]=1;triggerCount++;this.earAvoidance[contact.kind==='ray'?'trueRayTriggerSegments':contact.kind==='radius'?'radiusOnlyTriggerSegments':'radiusUnresolvedTriggerSegments']++;}}if(!triggerCount)break;if(repairPass===0){this.earAvoidance.trueTriggerStrands++;this.contactTriggered[i]|=1;}
  for(const ear of this.earEnvelopes){const required=new Float64Array(per);let hits=0;
   for(let j=0;j<this.segments;j++){if(!triggers[j])continue;const d=this.earSegmentNeed(points[j],points[j+1],ear,radius);if(d>0){required[j]=Math.max(required[j],d);required[j+1]=Math.max(required[j+1],d);hits++;}}
   if(!hits)continue;if(required[0]>0)this.earAvoidance.rootProxyConflicts++;this.earAvoidance.proxyHitSegments+=hits;changed=true;
   // Spread the nonnegative envelope displacements over a 0.022-native-unit
   // arc neighbourhood. Smoothstep falloff changes only the local shaft;
   // each constrained pair retains at least its exact required displacement.
   const shift=new Float64Array(per),span=.030;
   for(let j=1;j<per;j++)for(let k=1;k<per;k++){if(required[k]<=0)continue;const d=Math.abs(arc[j]-arc[k])/span;if(d>=1)continue;const w=1-d*d*(3-2*d);shift[j]=Math.max(shift[j],required[k]*w);}
   for(let j=1;j<per;j++){const rootRamp=clamp((arc[j]-.008)/.032,0,1),ramp=rootRamp*rootRamp*(3-2*rootRamp);if(ramp<1&&shift[j]>0)this.earAvoidance.rootCapApplied++;shift[j]*=ramp;points[j][0]+=ear.side*shift[j];}
  }
  }
  if(!changed)return;
  // Explicitly limit extra turning at the first two interior samples to15deg.
  // This preserves roots; if a contact cannot be cleared under that bound,
  // independent intersection QA reports the remaining contact as a failure.
  const turn=(p,j)=>Math.acos(clamp(dot(unit(sub(p[j],p[j-1])),unit(sub(p[j+1],p[j]))),-1,1));let scale=1;
  const limited=f=>{const q=points.map((p,j)=>j>0&&j<4?add(original[j],mul(sub(p,original[j]),f)):p);return [1,2].every(j=>turn(q,j)<=turn(original,j)+Math.PI/12+1e-12);};
  if(!limited(1)){let lo=0,hi=1;for(let n=0;n<18;n++){const mid=(lo+hi)*.5;if(limited(mid))lo=mid;else hi=mid;}scale=lo;for(let j=1;j<Math.min(4,per);j++)points[j]=add(original[j],mul(sub(points[j],original[j]),scale));this.earAvoidance.rootCapApplied++;}
  let newLength=0;for(let j=0;j<per;j++){const d=Math.hypot(...sub(points[j],original[j]));this.earAvoidance.maxDisplacement=Math.max(this.earAvoidance.maxDisplacement,d);this.earAvoidance.totalDisplacement+=d;this.positions.set(points[j],(start+j)*3);if(j)newLength+=Math.hypot(...sub(points[j],points[j-1]));}this.earAvoidance.affectedStrands++;const delta=newLength-arc[per-1];this.earAvoidance.maxLengthChange=Math.max(this.earAvoidance.maxLengthChange,Math.abs(delta));this.earAvoidance.totalLengthChange+=delta;
 }
 repairNeckTip(i){
  const per=this.per,start=i*per,tip=xyz(this.positions,start+this.segments),before=xyz(this.positions,start+this.segments-1),box=this.neckCollisionBVH.root,radius=.0001045*(.78+.42*this.random[i])*.06;
  for(let k=0;k<3;k++)if(Math.min(tip[k],before[k])>box.max[k]+radius||Math.max(tip[k],before[k])<box.min[k]-radius)return;
  const ray=this.neckCollisionBVH.segmentHit(before,tip),hit=this.neckCollisionBVH.nearest(tip);if(!ray&&hit.distance>=radius)return;const signed=dot(sub(tip,hit.p),hit.n),amount=clamp(radius+.00012-signed,0,.0006);if(amount<=0)return;
  for(let back=0;back<3;back++){const j=this.segments-back;if(j<=0)continue;const weight=back===0?1:back===1?.50:.15;for(let k=0;k<3;k++)this.positions[(start+j)*3+k]+=hit.n[k]*amount*weight;}
  this.contactTriggered ||=new Uint8Array(this.count);this.contactTriggered[i]|=2;this.earAvoidance.neckCorrectedStrands++;this.earAvoidance.neckMaxDisplacement=Math.max(this.earAvoidance.neckMaxDisplacement,amount);
 }
 diagnostics(){let minLength=Infinity,maxLength=0,meanLength=0,invalidRoots=0,invalidTriangles=0,maxRootGap=0,maxBaryError=0,minBary=1,minEyeGap=Infinity,freePoints=0;const roles=[0,0,0,0],zones=[0,0,0],bounds=[[Infinity,-Infinity],[Infinity,-Infinity],[Infinity,-Infinity]];for(let i=0;i<this.count;i++){roles[this.roles[i]]++;zones[this.zones[i]]++;const rt=this.rootTriangles[i];if(rt<0||rt>=this.model.triangles.length/3||[0,1,2].some(k=>this.model.componentId[this.model.triangles[rt*3+k]]!==0))invalidTriangles++;if(!this.rootSafe(xyz(this.templateRoots,i)))invalidRoots++;const b=this.rootBarycentrics.subarray(i*3,i*3+3);maxBaryError=Math.max(maxBaryError,Math.abs(b[0]+b[1]+b[2]-1));minBary=Math.min(minBary,...b);maxRootGap=Math.max(maxRootGap,Math.hypot(...sub(xyz(this.positions,i*this.per),xyz(this.roots,i))));minEyeGap=Math.min(minEyeGap,...this.eyes.map(l=>lineDistance(xyz(this.templateRoots,i),l)));let length=0;for(let j=0;j<this.per;j++){const q=i*this.per+j;if(j)length+=Math.hypot(...sub(xyz(this.positions,q),xyz(this.positions,q-1)));if(this.collisionTriangles[q]<0&&j>0)freePoints++;for(let k=0;k<3;k++){bounds[k][0]=Math.min(bounds[k][0],this.positions[q*3+k]);bounds[k][1]=Math.max(bounds[k][1],this.positions[q*3+k]);}}minLength=Math.min(minLength,length);maxLength=Math.max(maxLength,length);meanLength+=length;}return {earEnvelopes:this.earEnvelopes,earAvoidance:this.earAvoidance,region:this.region,count:this.count,segments:this.segments,sourceGuideCount:this.guides.length,retainedSourceGuides:this.retainedSourceGuides,roles:{originalMainOrBrow:roles[0],originalIndependent:roles[1],interpolatedChildren:roles[2],independentChildren:roles[3]},browZones:this.region==='brows'?{inner:zones[0],middle:zones[1],outer:zones[2]}:undefined,partIslands:[...new Set(this.islands)],finite:[this.positions,this.tangents,this.rootNormals,this.radii].every(a=>a.every(Number.isFinite)),invalidRoots,invalidTriangles,maxRootGap,maxBaryError,minBary,minTemplateEyeGap:minEyeGap,length:{min:minLength,max:maxLength,mean:meanLength/this.count},bounds,freePointCount:freePoints,nearSkinConstraintCount:this.collisionTriangles.length-this.count-freePoints,neutralCollisionRepairs:this.neutralCollisionRepairs,maxNeutralCorrection:this.maxNeutralCorrection,liveCollisionRepairs:this.liveCollisionRepairs,maxLiveCorrection:this.maxLiveCorrection,radius:{root:this.region==='brows'?.000045:.000037,tipFraction:.06},lastBindMs:this.lastBindMs,lastUpdateMs:this.lastUpdateMs,collisionLimit:'Cached local one-way constraints; no universal intersection-free guarantee'};}
}
