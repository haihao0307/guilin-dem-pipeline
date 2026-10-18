import {ROD_PARAMETERS} from './rod-parameters.mjs';
export {ROD_PARAMETERS};
const dot=(a,b)=>a.reduce((sum,x,i)=>sum+x*b[i],0);
const sub=(a,b)=>a.map((x,i)=>x-b[i]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=a=>{const l=Math.hypot(...a);if(!l)throw Error('Zero normal');return a.map(x=>x/l);};
const lerp=(a,b,t)=>a.map((x,i)=>x+(b[i]-x)*t);
function fnv32(array){let h=2166136261;for(const b of new Uint8Array(array.buffer,array.byteOffset,array.byteLength))h=Math.imul(h^b,16777619)>>>0;return h.toString(16).padStart(8,'0');}
function requireSource(g,p){
  for(const name of ['position','normal','uv','index']){
    if(!ArrayBuffer.isView(g[name]))throw Error('Missing typed source attribute '+name);
    if(fnv32(g[name])!==p.source.fnv1a32IdentityGuards[name])throw Error('Source identity guard mismatch '+name);
  }
  if(g.position.length!==p.source.vertexCount*3||g.index.length!==p.source.triangleCount*3)throw Error('Source geometry count mismatch');
}

/** Eight corners are computed from plane dimensions, not copied source vertices. */
export function channelSection(section=ROD_PARAMETERS.section){
  const {outerBackU:a,grooveFloorU:b,openSideU:c,bottomV:d,grooveBottomV:e,grooveTopV:f,topV:g}=section;
  if(!(c<b&&b<a&&d<e&&e<f&&f<g))throw Error('Invalid open C-section dimensions');
  return [[a,d],[a,g],[c,g],[c,f],[b,f],[b,e],[c,e],[c,d]];
}
function pointAt(p,u,v,w){return p.frame.origin.map((x,i)=>x+p.frame.u[i]*u+p.frame.v[i]*v+p.frame.w[i]*w);}

/** Parametric open-channel lateral surface. Ends remain open to the retained source. */
export function generateCentralChannel(p=ROD_PARAMETERS,{axialSegments=1}={}){
  if(!Number.isInteger(axialSegments)||axialSegments<1||axialSegments>256)throw Error('Invalid axialSegments');
  const profile=channelSection(p.section),[lo,hi]=p.generatedRangeW;
  if(!(lo<hi))throw Error('Invalid generated range');
  const position=[],normal=[],uv=[],index=[];
  for(let edge=0;edge<profile.length;edge++){
    const a=profile[edge],b=profile[(edge+1)%profile.length],du=b[0]-a[0],dv=b[1]-a[1];
    const n=unit(p.frame.u.map((x,i)=>dv*x-du*p.frame.v[i]));
    for(let j=0;j<axialSegments;j++){
      const wa=lo+(hi-lo)*j/axialSegments,wb=lo+(hi-lo)*(j+1)/axialSegments,base=position.length/3;
      for(const [q,w,t,s]of[[a,wa,0,j/axialSegments],[b,wa,1,j/axialSegments],[b,wb,1,(j+1)/axialSegments],[a,wb,0,(j+1)/axialSegments]]){
        position.push(...pointAt(p,q[0],q[1],w));normal.push(...n);uv.push(t,s);
      }
      index.push(base,base+1,base+2,base,base+2,base+3);
    }
  }
  return {position:new Float32Array(position),normal:new Float32Array(normal),uv:new Float32Array(uv),index:new Uint32Array(index)};
}

// Each generated shape below is independent of source positions, indices and normals.
const TAU=2*Math.PI,EPS=1e-10;
const sortedUnique=xs=>[...xs].sort((a,b)=>a-b).filter((x,i,a)=>!i||Math.abs(x-a[i-1])>1e-9);
function validate(p){
 channelSection(p.section);const e=p.endConnections,s=p.section;
 if(!(e.radialSegments>=16&&e.radialSegments<=256&&e.radialSegments%4===0&&Number.isInteger(e.radialSegments)&&Number.isInteger(e.cornerSegments)&&e.cornerSegments>=1&&e.cornerSegments<=32))throw Error('Invalid circle tessellation');
 if(!(e.backU<s.openSideU&&s.outerBackU<e.frontU&&e.frontU<e.bossFrontU&&e.bossRadius>0&&e.bossRadius<e.outerRadius&&s.bottomV>e.circleCenterV-e.outerRadius&&s.topV<e.circleCenterV+e.outerRadius&&e.tabCornerRadius>0))throw Error('Invalid collar/section relationship');
 if(!(e.collarCentersW[0]<e.channelTerminalCircleCenterW))throw Error('Invalid rod length');
}
function meshWriter(p){
 const position=[],normal=[],uv=[],index=[],parts=[];
 const worldN=n=>unit(p.frame.u.map((x,i)=>x*n[0]+p.frame.v[i]*n[1]+p.frame.w[i]*n[2]));
 function tri(q,ns,tex){
  const aa=q.map(x=>pointAt(p,...x)),expected=worldN(ns.reduce((a,b)=>a.map((x,i)=>x+b[i]),[0,0,0]));
  const cr=cross(sub(aa[1],aa[0]),sub(aa[2],aa[0]));if(Math.hypot(...cr)<1e-14)return;
  const order=dot(cr,expected)<0?[0,2,1]:[0,1,2],base=position.length/3;
  for(const j of order){position.push(...aa[j]);normal.push(...worldN(ns[j]));uv.push(...(tex?.[j]??[q[j][2],q[j][1]]));}index.push(base,base+1,base+2);
 }
 function quad(q,ns){tri(q.slice(0,3),ns.slice(0,3));tri([q[0],q[2],q[3]],[ns[0],ns[2],ns[3]]);}
 function part(name,fn){const indexStart=index.length;fn();parts.push({name,indexStart,indexCount:index.length-indexStart});}
 return {tri,quad,part,finish:()=>({position:new Float32Array(position),normal:new Float32Array(normal),uv:new Float32Array(uv),index:new Uint32Array(index),parts})};
}
/** Polygonal circle preserves the teacher's facets; changing radialSegments is a real edit. */
export function circleProfile(p=ROD_PARAMETERS,radius=p.endConnections.outerRadius){
 const e=p.endConnections;return Array.from({length:e.radialSegments},(_,k)=>{const a=k*TAU/e.radialSegments;return [radius*Math.cos(a),e.circleCenterV+radius*Math.sin(a)];});
}
/** A circular collar with a rounded upper ear, derived from 8 shared scalar dimensions. */
export function collarProfile(p=ROD_PARAMETERS){
 const e=p.endConnections,N=e.radialSegments,k=e.tabShoulderCircleStep,r=e.outerRadius,cv=e.circleCenterV,a=k*TAU/N;
 if(!(k>0&&k<N/4&&Number.isInteger(k)))throw Error('Invalid tab shoulder step');
 const x=r*Math.cos(a),y=cv+r*Math.sin(a),rr=e.tabCornerRadius,top=e.tabTopV,cy=top-rr;
 if(!(cy>y&&rr<x))throw Error('Invalid rounded tab');
 const pts=[];for(let j=0;j<=k;j++){const t=j*TAU/N;pts.push({w:r*Math.cos(t),v:cv+r*Math.sin(t),n:[0,Math.sin(t),Math.cos(t)],sharp:j===k});}
 // Positive-w vertical shoulder and top-right quarter-circle.
 pts.push({w:x,v:cy,n:[0,0,1]});
 for(let j=1;j<=e.cornerSegments;j++){const t=j*Math.PI/(2*e.cornerSegments);pts.push({w:x-rr+rr*Math.cos(t),v:cy+rr*Math.sin(t),n:[0,Math.sin(t),Math.cos(t)]});}
 // Collinear top breaks follow the same circle formula, not stored teacher coordinates.
 for(let j=k+1;j<e.radialSegments/2-k;j++){const ww=r*Math.cos(j*TAU/N);if(ww<x-rr-EPS&&ww>-x+rr+EPS)pts.push({w:ww,v:top,n:[0,1,0]});}
 pts.push({w:-x+rr,v:top,n:[0,1,0]});
 for(let j=1;j<=e.cornerSegments;j++){const t=Math.PI/2+j*Math.PI/(2*e.cornerSegments);pts.push({w:-x+rr+rr*Math.cos(t),v:cy+rr*Math.sin(t),n:[0,Math.sin(t),Math.cos(t)]});}
 pts.push({w:-x,v:y,n:[0,Math.sin(Math.PI-a),Math.cos(Math.PI-a)],sharp:true});
 for(let j=N/2-k+1;j<N;j++){const t=j*TAU/N;pts.push({w:r*Math.cos(t),v:cv+r*Math.sin(t),n:[0,Math.sin(t),Math.cos(t)]});}
 const face=pts.map((a,j)=>{const b=pts[(j+1)%pts.length];return unit([0,a.w-b.w,b.v-a.v]);});
 for(let j=0;j<pts.length;j++){const current=face[j],previous=face[(j+pts.length-1)%pts.length];pts[j].n=unit(current.map((x,i)=>x+previous[i]));pts[j].outNormal=pts[j].sharp?current:pts[j].n;pts[j].inNormal=pts[j].sharp?previous:pts[j].n;}
 return pts;
}
function rayPolygon(profile,angle,cv){
 const d=[Math.cos(angle),Math.sin(angle)];let best=null;
 for(let j=0;j<profile.length;j++){
  const a=profile[j],b=profile[(j+1)%profile.length],ax=a.w,ay=a.v-cv,ex=b.w-a.w,ey=b.v-a.v,den=d[0]*ey-d[1]*ex;
  if(Math.abs(den)<1e-12)continue;
  const r=(ax*ey-ay*ex)/den,t=(ax*d[1]-ay*d[0])/den;
  if(r>=0&&t>=-1e-8&&t<=1+1e-8&&(!best||r<best.r))best={w:d[0]*r,v:cv+d[1]*r,r};
 }if(!best)throw Error('Cannot intersect radial profile');return best;
}
function sectionFilled(s,u,v){return u>s.openSideU-EPS&&u<s.outerBackU+EPS&&v>s.bottomV-EPS&&v<s.topV+EPS&&!(u<s.grooveFloorU&&v>s.grooveBottomV&&v<s.grooveTopV);}
function genCollar(writer,p,cw,notch=false){
 const e=p.endConnections,s=p.section,profile=collarProfile(p),inner=circleProfile(p,e.bossRadius).map(([w,v])=>({w,v})),cv=e.circleCenterV;
 const q=(u,t)=>[u,t.v,cw+t.w];
 // Outer wall: the source's low collar has a true C-shaped socket for the long body.
 for(let j=0;j<profile.length;j++){
  const a=profile[j],b=profile[(j+1)%profile.length];let ts=[0,1];
  if(notch&&(a.w+b.w)>0&&Math.abs(b.v-a.v)>EPS)for(const v of [s.bottomV,s.grooveBottomV,s.grooveTopV,s.topV]){const t=(v-a.v)/(b.v-a.v);if(t>EPS&&t<1-EPS)ts.push(t);}
  ts=sortedUnique(ts);
  const us=notch&&(a.w+b.w)>0?[e.backU,s.openSideU,s.grooveFloorU,s.outerBackU,e.frontU]:[e.backU,e.frontU];
  for(let k=0;k+1<ts.length;k++){
   const A={w:a.w+(b.w-a.w)*ts[k],v:a.v+(b.v-a.v)*ts[k]},B={w:a.w+(b.w-a.w)*ts[k+1],v:a.v+(b.v-a.v)*ts[k+1]},na=lerp(a.outNormal,b.inNormal,ts[k]),nb=lerp(a.outNormal,b.inNormal,ts[k+1]);
   for(let m=0;m+1<us.length;m++){
    if(notch&&(a.w+b.w)>0&&sectionFilled(s,(us[m]+us[m+1])/2,(A.v+B.v)/2))continue;
    writer.quad([q(us[m],A),q(us[m+1],A),q(us[m+1],B),q(us[m],B)],[na,na,nb,nb]);
   }
  }
 }
 // Back is a covered face in the teacher, not a newly invented through-hole.
 for(let j=0;j<profile.length;j++)writer.tri([[e.backU,cv,cw],q(e.backU,profile[j]),q(e.backU,profile[(j+1)%profile.length])],Array(3).fill([-1,0,0]));
 const angle=t=>{let x=Math.atan2(t.v-cv,t.w);return x<0?x+TAU:x;};
 const angles=sortedUnique([...profile.map(angle),...inner.map(angle)]);
 for(let j=0;j<angles.length;j++){
  const aa=angles[j],bb=angles[(j+1)%angles.length],a=rayPolygon(profile,aa,cv),b=rayPolygon(profile,bb,cv),ia=rayPolygon(inner,aa,cv),ib=rayPolygon(inner,bb,cv);
  writer.quad([q(e.frontU,a),q(e.frontU,b),q(e.frontU,ib),q(e.frontU,ia)],Array(4).fill([1,0,0]));
 }
 for(let j=0;j<inner.length;j++){
  const a=inner[j],b=inner[(j+1)%inner.length],aa=j*TAU/inner.length,bb=(j+1)*TAU/inner.length,na=[0,Math.sin(aa),Math.cos(aa)],nb=[0,Math.sin(bb),Math.cos(bb)];
  writer.quad([q(e.frontU,a),q(e.bossFrontU,a),q(e.bossFrontU,b),q(e.frontU,b)],[na,na,nb,nb]);
  writer.tri([[e.bossFrontU,cv,cw],q(e.bossFrontU,a),q(e.bossFrontU,b)],Array(3).fill([1,0,0]));
 }
}
function rightCircleAtV(p,v){
 const e=p.endConnections,points=circleProfile(p),cv=e.circleCenterV;
 for(let j=0;j<points.length;j++){
  const a=points[j],b=points[(j+1)%points.length];if((a[0]+b[0])<0||v<Math.min(a[1],b[1])-EPS||v>Math.max(a[1],b[1])+EPS)continue;
  const t=(v-a[1])/(b[1]-a[1]);return {w:a[0]+(b[0]-a[0])*t,n:[0,(v-cv)/e.outerRadius,(a[0]+(b[0]-a[0])*t)/e.outerRadius]};
 }throw Error('Channel height exceeds circle');
}
function subdivideSection(p){
 const profile=channelSection(p.section),vs=circleProfile(p).map(q=>q[1]),result=[];
 for(let j=0;j<profile.length;j++){
  const a=profile[j],b=profile[(j+1)%profile.length],ts=[0];if(Math.abs(b[1]-a[1])>EPS)for(const v of vs){const t=(v-a[1])/(b[1]-a[1]);if(t>EPS&&t<1-EPS)ts.push(t);}
  for(const t of sortedUnique(ts))result.push(lerp(a,b,t));
 }return result;
}
function genConnectedChannel(writer,p,axialSegments){
 const e=p.endConnections,s=p.section,profile=subdivideSection(p),low=e.collarCentersW[0],high=e.channelTerminalCircleCenterW;
 for(let j=0;j<profile.length;j++){
  const a=profile[j],b=profile[(j+1)%profile.length],ca=rightCircleAtV(p,a[1]),cb=rightCircleAtV(p,b[1]),du=b[0]-a[0],dv=b[1]-a[1],n=unit([dv,-du,0]);
  for(let k=0;k<axialSegments;k++){
   const x=low+(high-low)*k/axialSegments,y=low+(high-low)*(k+1)/axialSegments;
   writer.quad([[a[0],a[1],x+ca.w],[b[0],b[1],x+cb.w],[b[0],b[1],y+cb.w],[a[0],a[1],y+ca.w]],Array(4).fill(n));
  }
 }
 const vs=sortedUnique([s.bottomV,s.grooveBottomV,s.grooveTopV,s.topV,...circleProfile(p).map(x=>x[1]).filter(v=>v>s.bottomV&&v<s.topV)]);
 for(let j=0;j+1<vs.length;j++){
  const a=rightCircleAtV(p,vs[j]),b=rightCircleAtV(p,vs[j+1]),q=(u,v,r)=>[u,v,high+r.w];
  // Preserve the teacher's complete terminal cap and its opposite-wound groove overlay.
  writer.quad([q(s.openSideU,vs[j],a),q(s.outerBackU,vs[j],a),q(s.outerBackU,vs[j+1],b),q(s.openSideU,vs[j+1],b)],[a.n,a.n,b.n,b.n]);
  if((vs[j]+vs[j+1])/2>s.grooveBottomV&&(vs[j]+vs[j+1])/2<s.grooveTopV){const na=a.n.map(x=>-x),nb=b.n.map(x=>-x);writer.quad([q(s.openSideU,vs[j],a),q(s.grooveFloorU,vs[j],a),q(s.grooveFloorU,vs[j+1],b),q(s.openSideU,vs[j+1],b)],[na,na,nb,nb]);}
 }
}
export function generateRodEndConnections(p=ROD_PARAMETERS,{axialSegments=1}={}){
 validate(p);if(!Number.isInteger(axialSegments)||axialSegments<1||axialSegments>256)throw Error('Invalid axialSegments');
 const w=meshWriter(p);
 w.part('low-end-collar-with-C-socket',()=>genCollar(w,p,p.endConnections.collarCentersW[0],true));
 w.part('curved-end-channel-and-source-double-cap',()=>genConnectedChannel(w,p,axialSegments));
 w.part('middle-independent-collar',()=>genCollar(w,p,p.endConnections.collarCentersW[1]));
 w.part('high-independent-collar',()=>genCollar(w,p,p.endConnections.collarCentersW[2]));
 return w.finish();
}
function sourceComponents(g,p){
 const count=g.position.length/3,parent=Array.from({length:count},(_,i)=>i),find=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;},join=(a,b)=>{a=find(a);b=find(b);if(a!==b)parent[b]=a;},seen=new Map();
 for(let i=0;i<count;i++){const key=Array.from(g.position.subarray(i*3,i*3+3),x=>Math.round(x*1e6)).join(',');if(seen.has(key))join(i,seen.get(key));else seen.set(key,i);}
 for(let i=0;i<g.index.length;i+=3){join(g.index[i],g.index[i+1]);join(g.index[i],g.index[i+2]);}
 const groups=new Map();for(let i=0;i<g.index.length;i+=3){const root=find(g.index[i]);if(!groups.has(root))groups.set(root,[]);groups.get(root).push(i/3);}
 return [...groups.values()].map(triangleIds=>{let minimumW=Infinity;for(const tid of triangleIds)for(let j=0;j<3;j++){const k=g.index[tid*3+j];minimumW=Math.min(minimumW,dot(Array.from(g.position.subarray(k*3,k*3+3)),p.frame.w));}return {triangleIds,minimumW};});
}
/** Replace only learned components, retaining unknown source components byte-for-byte. */
export function rebuildRodArrays(source,{parameters=ROD_PARAMETERS,axialSegments=1}={}){
 const p=parameters;requireSource(source,p);validate(p);const components=sourceComponents(source,p),replaced=[],selection=[];
 for(const expected of p.endConnections.sourceComponents){const found=components.filter(c=>c.triangleIds.length===expected.sourceTriangleCount&&Math.abs(c.minimumW-expected.minimumW)<3e-6);if(found.length!==1)throw Error('Source component mismatch: '+expected.name);selection.push({...expected,triangleIds:found[0].triangleIds});replaced.push(...found[0].triangleIds);}
 const remove=new Set(replaced),retainedSourceTriangleIds=[],position=Array.from(source.position),normal=Array.from(source.normal),uv=Array.from(source.uv),index=[];
 for(let tid=0;tid<source.index.length/3;tid++)if(!remove.has(tid)){retainedSourceTriangleIds.push(tid);index.push(...source.index.subarray(tid*3,tid*3+3));}
 const generated=generateRodEndConnections(p,{axialSegments}),generatedIndexStart=index.length,offset=position.length/3;
 position.push(...generated.position);normal.push(...generated.normal);uv.push(...generated.uv);for(const i of generated.index)index.push(i+offset);
 const report={version:'source-103-channel-and-end-connections/2',status:'partial-source-retained-candidate',sourceNodeIndex:103,sourceParentName:'Main Gear_42',units:p.units,
 originalVertexCount:source.position.length/3,originalTriangleCount:source.index.length/3,retainedUnmodifiedTriangleCount:retainedSourceTriangleIds.length,retainedSourceTriangleIds,
 replacedSourceTriangleCount:replaced.length,replacedSourceTriangleIds:replaced,sourceComponentSelection:selection,
 generatedTriangleCount:generated.index.length/3,generatedIndexStart,generatedIndexCount:generated.index.length,generatedParts:generated.parts,
 section:p.section,dimensions:p.measuredDimensions,endConnections:p.endConnections,parameterization:p.parameterization,
 generatedFrom:'C-section planes, shared circle/fillet/axial-step scalar dimensions, and independent placements. No source coordinate table or source topology is used by generateRodEndConnections.',
 residualPolicy:'Five unlearned components remain untouched: three hex fasteners and two offset small collars (700 source triangles). Source attributes retained verbatim only for residual geometry; unused old vertices remain for audit, not generation.',
 sourceInputIdentityGuard:'FNV-1a source attribute identity; CPU tests also enforce locked SHA256.',sourceVertexTableRetained:true,originalMaterialPreservedByCaller:true,sourceMaterialHasTextures:false,
 originalResidualNormalsAndUVsPreserved:true,generatedNormals:'Analytic/smoothed profile normals; not copied source normals.',generatedUVs:'New profile/planar mapping; not accepted for a future textured material.',
 fullParametricReconstruction:false,sourceEndEyesParametric:true,allSourceCollarsParametric:false,throughHoleClaim:false,engineeringUnitsVerified:false,
 sourceOverlapsAndSeparateCollarsRetained:true,highTerminalCoincidentOppositeGroovePatchRetained:true,limits:p.limits};
 return {position:new Float32Array(position),normal:new Float32Array(normal),uv:new Float32Array(uv),index:new Uint32Array(index),report};
}
export function rebuildSourceRod(T,sourceGeometry,options={}){
 const names=Object.keys(sourceGeometry.attributes).sort();if(JSON.stringify(names)!==JSON.stringify(['normal','position','uv']))throw Error('Unmapped source attributes: preserve original geometry');
 if(sourceGeometry.morphAttributes&&Object.keys(sourceGeometry.morphAttributes).length)throw Error('Unmapped morph attributes: preserve original geometry');
 const data=rebuildRodArrays({position:sourceGeometry.getAttribute('position').array,normal:sourceGeometry.getAttribute('normal').array,uv:sourceGeometry.getAttribute('uv').array,index:sourceGeometry.index.array},options);
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(data.position,3));geometry.setAttribute('normal',new T.BufferAttribute(data.normal,3));geometry.setAttribute('uv',new T.BufferAttribute(data.uv,2));geometry.setIndex(new T.BufferAttribute(data.index,1));
 geometry.name='source-node-103-channel-and-end-connections-r02';geometry.userData={...sourceGeometry.userData,rodRebuild:data.report};geometry.computeBoundingBox();geometry.computeBoundingSphere();return {geometry,report:data.report};
}
