'use strict';

// Original, dependency-free diagnostics for the evaluated common native mesh.
// Input arrays stay in memory. The returned report contains bounded witnesses,
// never the complete positions, faces, recipes, or source component arrays.
// Analytic triangle/plane cuts use Float64 arithmetic and explicit tolerances;
// this is not a certified exact-predicate computational-geometry kernel.
const crypto = require('node:crypto');
const SCHEMA = 'joey-r44-native-geometry-qa/1';
const ENGINE_COMMIT = '0b4703359efbae10ffc6c0e5fe3fc081e7eca4fe';
const DEFAULTS = Object.freeze({
  distanceEpsilonM: 1e-10,
  doubleAreaEpsilonM2: 1e-14,
  parallelSineEpsilon: 1e-12,
  rayDepthEpsilonM: 1e-7,
  maxBodyDisplacementM: 1e-7,
  maxEyeDisplacementM: 1e-7,
  visibilitySampleSpacingPx: 0.5,
  maxSamplesPerWitness: 129,
  maxWitnesses: 1200,
  maxDiagnosticIds: 64,
});
const sub = (a, b) => [a[0]-b[0], a[1]-b[1], a[2]-b[2]];
const add = (a, b) => [a[0]+b[0], a[1]+b[1], a[2]+b[2]];
const mul = (a, t) => [a[0]*t, a[1]*t, a[2]*t];
const dot = (a, b) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const length = a => Math.hypot(a[0], a[1], a[2]);
const unit = a => { const n=length(a); if (!(n>0)) throw Error('Zero direction'); return mul(a,1/n); };
const lerp = (a,b,t) => add(a,mul(sub(b,a),t));
const point = (p,i) => [p[i*3],p[i*3+1],p[i*3+2]];
const toDisplay = p => [p[0],p[2],-p[1]];
const fromDisplay = p => [p[0],-p[2],p[1]];
const finite3 = p => p && p.length===3 && p.every(Number.isFinite);
const clamp = (x,a,b) => Math.max(a,Math.min(b,x));
function hashNumbers(values, type) {
  const buffer=Buffer.allocUnsafe(values.length*(type==='uint32'?4:8));
  for(let i=0;i<values.length;i++) type==='uint32' ? buffer.writeUInt32LE(values[i],i*4) : buffer.writeDoubleLE(values[i],i*8);
  return crypto.createHash('sha256').update(buffer).digest('hex');
}
function requireArray(a,name) {
  if(!a || typeof a.length!=='number' || typeof a[Symbol.iterator]!=='function') throw Error(name+' must be an array or typed array');
}
function settings(options={}) {
  const c={...DEFAULTS,...options};
  for(const [k,v] of Object.entries(c)) if(!Object.hasOwn(DEFAULTS,k)||!Number.isFinite(v)||v<0) throw Error('Invalid QA option '+k);
  for(const k of ['maxSamplesPerWitness','maxWitnesses','maxDiagnosticIds']) if(!Number.isSafeInteger(c[k])||c[k]<1) throw Error(k+' must be a positive integer');
  if(c.maxSamplesPerWitness<3||c.visibilitySampleSpacingPx===0) throw Error('Visibility sampling needs at least three samples and positive spacing');
  return c;
}
function classifyMapping(mapping, vertexCount, faces, config) {
  if(!mapping) throw Error('Native component mapping is required');
  const {bodyCount,gnmRecipes,componentId}=mapping;
  if(!Number.isSafeInteger(bodyCount)||bodyCount<0||bodyCount>vertexCount) throw Error('Invalid bodyCount');
  requireArray(gnmRecipes,'gnmRecipes'); requireArray(componentId,'componentId');
  if(gnmRecipes.length!==vertexCount-bodyCount) throw Error('Recipe count does not match native common vertices');
  const vertexComponents=new Int16Array(vertexCount).fill(-1), direct=new Map(), sourceCounts={}, commonCounts={body:bodyCount};
  for(const id of componentId) {
    if(!Number.isSafeInteger(id)||id<0||id>32767) throw Error('Invalid source component ID');
    sourceCounts[id]=(sourceCounts[id]||0)+1;
  }
  for(let i=0;i<gnmRecipes.length;i++) {
    const r=gnmRecipes[i];
    if(!r||r.length!==3) throw Error('Invalid native recipe '+i);
    const [a,b,t]=r;
    if(!Number.isSafeInteger(a)||!Number.isSafeInteger(b)||a<0||b<0||a>=componentId.length||b>=componentId.length||!Number.isFinite(t)||t<0||t>1) throw Error('Out-of-range native recipe '+i);
    const ca=componentId[a],cb=componentId[b];
    // Only endpoints with nonzero weight contribute to component identity.
    const component=t===0?ca:t===1?cb:ca===cb?ca:null;
    if(component===null) throw Error('Mixed-component native recipe '+i+' is not safe to omit');
    const index=bodyCount+i; vertexComponents[index]=component; commonCounts[component]=(commonCounts[component]||0)+1;
    if(a===b||t===0) { if(!direct.has(a)) direct.set(a,[]); direct.get(a).push(index); }
    else if(t===1) { if(!direct.has(b)) direct.set(b,[]); direct.get(b).push(index); }
  }
  const faceKinds=[],faceCounts={skin:0,eye1:0,eye2:0,other:0},eyeCommonKeys=new Set();
  for(let f=0;f<faces.length/3;f++) {
    const ids=[faces[f*3],faces[f*3+1],faces[f*3+2]], c=ids.map(v=>vertexComponents[v]);
    let kind;
    if(c.every(x=>x===-1||x===0)) kind='skin';
    else if(c.every(x=>x===1)) kind='eye1';
    else if(c.every(x=>x===2)) kind='eye2';
    else if(c.some(x=>x===1||x===2)) throw Error('Mixed eye-component triangle '+f+' is not safe to omit');
    else if(c.some(x=>x===-1||x===0)) throw Error('Mixed skin/other triangle '+f+' is not safe to omit');
    else kind='other';
    faceKinds.push(kind); faceCounts[kind]++;
    if(kind==='eye1'||kind==='eye2') eyeCommonKeys.add(ids.slice().sort((a,b)=>a-b).join(','));
  }
  const missingEyeVertices=[],sourceEyeVertexCounts={1:0,2:0};
  for(let i=0;i<componentId.length;i++) if(componentId[i]===1||componentId[i]===2) {
    sourceEyeVertexCounts[componentId[i]]++;
    if(!direct.has(i)) missingEyeVertices.push(i);
  }
  let sourceEyeFaces=null,missingEyeFaces=null;
  if(mapping.gnmTriangles) {
    requireArray(mapping.gnmTriangles,'gnmTriangles');
    if(mapping.gnmTriangles.length%3) throw Error('Native source triangles length must divide by three');
    sourceEyeFaces={1:0,2:0}; missingEyeFaces=[];
    for(let i=0;i<mapping.gnmTriangles.length;i+=3) {
      const ids=[mapping.gnmTriangles[i],mapping.gnmTriangles[i+1],mapping.gnmTriangles[i+2]];
      if(ids.some(v=>!Number.isInteger(v)||v<0||v>=componentId.length)) throw Error('Invalid native source face '+i/3);
      const component=componentId[ids[0]];
      if((component!==1&&component!==2)||!ids.every(v=>componentId[v]===component)) continue;
      sourceEyeFaces[component]++;
      const lists=ids.map(v=>direct.get(v)||[]);
      let found=false;
      for(const a of lists[0]) for(const b of lists[1]) for(const c of lists[2]) if(eyeCommonKeys.has([a,b,c].sort((x,y)=>x-y).join(','))) found=true;
      if(!found) missingEyeFaces.push(i/3);
    }
  }
  const report={bodyCount,headRecipeCount:gnmRecipes.length,sourceComponentCounts:sourceCounts,commonComponentCounts:commonCounts,faceCounts,sourceEyeVertexCounts,missingSourceEyeVertexCount:missingEyeVertices.length,missingSourceEyeVertexExamples:missingEyeVertices.slice(0,config.maxDiagnosticIds),sourceEyeFaces,missingSourceEyeFaceCount:missingEyeFaces?.length??null,missingSourceEyeFaceExamples:missingEyeFaces?.slice(0,config.maxDiagnosticIds)??null,fullNativeEyeTopologyVerified:missingEyeVertices.length===0&&missingEyeFaces!==null&&missingEyeFaces.length===0,classification:'body plus native component 0 = complete skin; native components 1 and 2 = full eyes; no anatomical, depth, front-cap, or camera exclusions',componentSemanticsSource:'HeadTransfer.mjs componentIds[eye+1], cavities on component 0'};
  if(!sourceEyeVertexCounts[1]||!sourceEyeVertexCounts[2]) throw Error('Both complete native eye components are required');
  return {vertexComponents,faceKinds,report};
}
function validateInputs(baseline,candidate,config) {
  const report={errors:[],baselineNonfiniteCount:0,candidateNonfiniteCount:0,nonfiniteExamples:[],invalidIndexCount:0,invalidIndexExamples:[]};
  if(!baseline||!candidate) throw Error('Baseline and candidate are required');
  for(const [label,m] of [['baseline',baseline],['candidate',candidate]]) {
    requireArray(m.positions,label+'.positions'); requireArray(m.faces,label+'.faces');
    if(m.positions.length%3||m.faces.length%3) report.errors.push(label+': array lengths must divide by three');
    for(let i=0;i<m.positions.length;i++) if(!Number.isFinite(m.positions[i])) {
      report[label+'NonfiniteCount']++;
      if(report.nonfiniteExamples.length<config.maxDiagnosticIds) report.nonfiniteExamples.push({mesh:label,coordinate:i,kind:String(m.positions[i])});
    }
    for(let i=0;i<m.faces.length;i++) if(!Number.isSafeInteger(m.faces[i])||m.faces[i]<0||m.faces[i]>=m.positions.length/3) {
      report.invalidIndexCount++;
      if(report.invalidIndexExamples.length<config.maxDiagnosticIds) report.invalidIndexExamples.push({mesh:label,slot:i,index:String(m.faces[i])});
    }
  }
  report.samePositionArrayLength=baseline.positions.length===candidate.positions.length;
  report.exactFaceIndices=baseline.faces.length===candidate.faces.length&&baseline.faces.every((v,i)=>v===candidate.faces[i]);
  report.vertexCount=baseline.positions.length/3; report.triangleCount=baseline.faces.length/3;
  if(!report.samePositionArrayLength) report.errors.push('Native vertex count changed');
  if(!report.exactFaceIndices) report.errors.push('Native face indices changed');
  report.valid=report.errors.length===0&&report.baselineNonfiniteCount===0&&report.candidateNonfiniteCount===0&&report.invalidIndexCount===0;
  return report;
}
function makeTriangles(positions,faces,faceKinds) {
  const triangles=[];
  for(let f=0;f<faces.length/3;f++) {
    const ids=[faces[f*3],faces[f*3+1],faces[f*3+2]],p=ids.map(i=>point(positions,i));
    const normal=cross(sub(p[1],p[0]),sub(p[2],p[0])),normalLength=length(normal);
    const min=[0,1,2].map(k=>Math.min(p[0][k],p[1][k],p[2][k])),max=[0,1,2].map(k=>Math.max(p[0][k],p[1][k],p[2][k]));
    triangles.push({id:f,ids,p,normal,normalLength,min,max,center:lerp(min,max,0.5),kind:faceKinds[f]});
  }
  return triangles;
}
function makeBVH(items) {
  if(!items.length) return null;
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(const t of items) for(let k=0;k<3;k++) {min[k]=Math.min(min[k],t.min[k]);max[k]=Math.max(max[k],t.max[k]);}
  if(items.length<=12) return {min,max,items};
  const spans=sub(max,min),axis=spans[1]>spans[0]?(spans[2]>spans[1]?2:1):(spans[2]>spans[0]?2:0);
  const sorted=items.slice().sort((a,b)=>a.center[axis]-b.center[axis]||a.id-b.id),mid=Math.floor(sorted.length/2);
  return {min,max,left:makeBVH(sorted.slice(0,mid)),right:makeBVH(sorted.slice(mid))};
}
const boxesOverlap=(a,b,eps)=>[0,1,2].every(k=>a.min[k]<=b.max[k]+eps&&b.min[k]<=a.max[k]+eps);
function queryBox(node,box,eps,out) {
  if(!node||!boxesOverlap(node,box,eps)) return;
  if(node.items) {for(const t of node.items) if(boxesOverlap(t,box,eps)) out.push(t);}
  else {queryBox(node.left,box,eps,out);queryBox(node.right,box,eps,out);}
}
function uniquePoints(points,eps) {
  const out=[];for(const p of points) if(!out.some(q=>length(sub(p,q))<=eps)) out.push(p);return out;
}
function planeCut(tri,distances,eps) {
  const out=[];
  for(let i=0;i<3;i++) {
    const j=(i+1)%3,di=distances[i],dj=distances[j];
    if(Math.abs(di)<=eps) out.push(tri[i]);
    if((di<0&&dj>0)||(di>0&&dj<0)) out.push(lerp(tri[i],tri[j],di/(di-dj)));
  }
  return uniquePoints(out,eps);
}
function longestChord(points) {
  let pair=[points[0],points[0]],max=0;
  for(let i=0;i<points.length;i++) for(let j=i+1;j<points.length;j++) {const d=length(sub(points[i],points[j]));if(d>max){max=d;pair=[points[i],points[j]];}}
  return {line:pair,lengthM:max};
}
function coplanarClip(a,b,normal,eps) {
  let polygon=a.slice();
  // Signed line distance in the shared plane; b's normal fixes orientation.
  for(let i=0;i<3&&polygon.length;i++) {
    const edge=sub(b[(i+1)%3],b[i]),edgeLength=length(edge),side=unit(cross(normal,edge));
    if(!edgeLength) return [];
    const output=[];
    for(let j=0;j<polygon.length;j++) {
      const p=polygon[j],q=polygon[(j+1)%polygon.length],dp=dot(sub(p,b[i]),side),dq=dot(sub(q,b[i]),side),insideP=dp>=-eps,insideQ=dq>=-eps;
      if(insideP) output.push(p);
      if(insideP!==insideQ) output.push(lerp(p,q,clamp(dp/(dp-dq),0,1)));
    }
    polygon=uniquePoints(output,eps);
  }
  return polygon;
}
function triangleIntersection(a,b,options={}) {
  const c={...DEFAULTS,...options},eps=c.distanceEpsilonM;
  const A=Array.isArray(a)?{p:a,normal:cross(sub(a[1],a[0]),sub(a[2],a[0]))}:a;
  const B=Array.isArray(b)?{p:b,normal:cross(sub(b[1],b[0]),sub(b[2],b[0]))}:b;
  const la=length(A.normal),lb=length(B.normal);
  if(la<=c.doubleAreaEpsilonM2||lb<=c.doubleAreaEpsilonM2) return {kind:'degenerate',line:null};
  const na=mul(A.normal,1/la),nb=mul(B.normal,1/lb);
  const da=A.p.map(p=>dot(sub(p,B.p[0]),nb)),db=B.p.map(p=>dot(sub(p,A.p[0]),na));
  const spanA=[Math.min(...da),Math.max(...da)],spanB=[Math.min(...db),Math.max(...db)];
  if(spanA[0]>eps||spanA[1]<-eps||spanB[0]>eps||spanB[1]<-eps) return null;
  const direction=cross(na,nb),sine=length(direction);
  if(sine<=c.parallelSineEpsilon) {
    if(Math.max(...da.map(Math.abs),...db.map(Math.abs))>eps) return {kind:'near_parallel_uncertain',line:null,planeSpansM:[spanA,spanB]};
    const polygon=coplanarClip(A.p,B.p,nb,eps);
    if(!polygon.length) return null;
    const chord=longestChord(polygon); let twiceArea=0;
    for(let i=1;i+1<polygon.length;i++) twiceArea+=Math.abs(dot(cross(sub(polygon[i],polygon[0]),sub(polygon[i+1],polygon[0])),nb));
    return {kind:twiceArea>c.doubleAreaEpsilonM2?'coplanar_overlap':chord.lengthM>eps?'tangent_segment':'point_contact',...chord,polygon,overlapAreaM2:twiceArea/2,planeSpansM:[spanA,spanB]};
  }
  const cutA=planeCut(A.p,da,eps),cutB=planeCut(B.p,db,eps);
  if(!cutA.length||!cutB.length) return null;
  const d=mul(direction,1/sine),origin=cutA[0],u=cutA.map(p=>dot(sub(p,origin),d)),v=cutB.map(p=>dot(sub(p,origin),d));
  const lo=Math.max(Math.min(...u),Math.min(...v)),hi=Math.min(Math.max(...u),Math.max(...v));
  if(lo>hi+eps) return null;
  const line=[add(origin,mul(d,lo)),add(origin,mul(d,Math.max(lo,hi)))],lengthM=Math.max(0,hi-lo);
  const proper=spanA[0]<-eps&&spanA[1]>eps&&spanB[0]<-eps&&spanB[1]>eps;
  return {kind:lengthM<=eps?'point_contact':proper?'proper_crossing':'tangent_segment',line,lengthM,planeSpansM:[spanA,spanB]};
}
function rayBox(origin,direction,node,maxDistance,eps) {
  let lo=0,hi=maxDistance;
  for(let k=0;k<3;k++) {
    if(Math.abs(direction[k])<1e-30) {if(origin[k]<node.min[k]-eps||origin[k]>node.max[k]+eps) return false;}
    else {const a=(node.min[k]-eps-origin[k])/direction[k],b=(node.max[k]+eps-origin[k])/direction[k];lo=Math.max(lo,Math.min(a,b));hi=Math.min(hi,Math.max(a,b));if(hi<lo)return false;}
  }
  return true;
}
function rayTriangle(origin,direction,tri,frontOnly=false,epsilon=1e-10) {
  const [a,b,c]=tri.p,e1=sub(b,a),e2=sub(c,a),h=cross(direction,e2),det=dot(e1,h);
  const determinantEpsilon=Math.max(1e-30,tri.normalLength*1e-13);
  if(frontOnly?det<=determinantEpsilon:Math.abs(det)<=determinantEpsilon) return null;
  const inv=1/det,s=sub(origin,a),u=dot(s,h)*inv,q=cross(s,e1),v=dot(direction,q)*inv;
  // A dimensionless barycentric tolerance is kept separate from metres.
  if(u < -1e-10||v < -1e-10||u+v > 1+1e-10) return null;
  const t=dot(e2,q)*inv;
  return t>=-epsilon?Math.max(0,t):null;
}
function firstRayHit(bvh,origin,direction,maxDistance,frontOnly,epsilon,minDistance=0) {
  let best=null,bestDistance=maxDistance;
  function visit(node) {
    if(!node||!rayBox(origin,direction,node,bestDistance,epsilon)) return;
    if(node.items) {
      for(const tri of node.items) {
        const distance=rayTriangle(origin,direction,tri,frontOnly,epsilon);
        if(distance!==null&&distance>=minDistance-epsilon&&distance<=bestDistance) {
          if(!best||distance<bestDistance||distance===bestDistance&&tri.id<best.face) {bestDistance=distance;best={face:tri.id,kind:tri.kind,distanceM:distance};}
        }
      }
    } else {visit(node.left);visit(node.right);}
  }
  visit(bvh);return best;
}
function transform4(m,p) {
  return [0,1,2,3].map(r=>m[r]*p[0]+m[4+r]*p[1]+m[8+r]*p[2]+m[12+r]*p[3]);
}
function prepareCamera(name,raw) {
  if(!raw||!finite3(raw.position)||!finite3(raw.target)) throw Error('Camera '+name+' needs exact position and target');
  const width=raw.width??raw.viewport?.width,height=raw.height??raw.viewport?.height;
  const fov=raw.fov,zoom=raw.zoom??1,aspect=raw.aspect??width/height,near=raw.near??0.01,far=raw.far??50;
  if(![width,height,fov,zoom,aspect,near,far].every(Number.isFinite)||width<=0||height<=0||fov<=0||fov>=180||zoom<=0||aspect<=0||near<=0||far<=near) throw Error('Invalid camera projection '+name);
  const forward=unit(sub(raw.target,raw.position)),up=raw.up||[0,1,0];
  if(!finite3(up)) throw Error('Invalid camera up '+name);
  const right=unit(cross(forward,up)),vertical=unit(cross(right,forward));
  if((raw.projectionMatrix&&!raw.matrixWorldInverse)||(!raw.projectionMatrix&&raw.matrixWorldInverse)) throw Error('Provide both exact camera matrices');
  for(const field of ['projectionMatrix','matrixWorldInverse']) if(raw[field]&&(raw[field].length!==16||!raw[field].every(Number.isFinite))) throw Error('Invalid '+field);
  return {name,position:raw.position.slice(),target:raw.target.slice(),width,height,fov,zoom,aspect,near,far,up:up.slice(),forward,right,vertical,projectionMatrix:raw.projectionMatrix?.slice(),matrixWorldInverse:raw.matrixWorldInverse?.slice(),originCommon:fromDisplay(raw.position),projectionSource:raw.projectionMatrix?'captured Three.js matrices':'saved perspective camera and look-at basis'};
}
function projectPoint(commonPoint,camera) {
  const p=toDisplay(commonPoint),delta=sub(p,camera.position),depth=dot(delta,camera.forward);
  let nx,ny,clipDepth;
  if(camera.projectionMatrix) {
    const view=transform4(camera.matrixWorldInverse,[...p,1]),clip=transform4(camera.projectionMatrix,view);
    if(!(clip[3]>0)) return {x:null,y:null,depthM:depth,inFrame:false,behind:true};
    nx=clip[0]/clip[3];ny=clip[1]/clip[3];clipDepth=clip[2]/clip[3];
  } else {
    if(!(depth>0)) return {x:null,y:null,depthM:depth,inFrame:false,behind:true};
    const halfY=Math.tan(camera.fov*Math.PI/360)*depth/camera.zoom;
    nx=dot(delta,camera.right)/(halfY*camera.aspect);ny=dot(delta,camera.vertical)/halfY;
    clipDepth=depth>=camera.near&&depth<=camera.far?0:2;
  }
  const x=(nx+1)*camera.width/2,y=(1-ny)*camera.height/2;
  return {x,y,depthM:depth,inFrame:nx>=-1&&nx<=1&&ny>=-1&&ny<=1&&clipDepth>=-1&&clipDepth<=1,behind:false};
}
function cameraWitness(hit,camera,bvh,config) {
  const line=hit.line;if(!line) return {status:'unresolved_no_line'};
  const pixels=line.map(p=>projectPoint(p,camera));
  const projectedLengthPx=pixels.every(p=>p.x!==null)?Math.hypot(pixels[1].x-pixels[0].x,pixels[1].y-pixels[0].y):null;
  const desired=projectedLengthPx===null?3:Math.max(3,Math.ceil(projectedLengthPx/config.visibilitySampleSpacingPx)+1);
  const samples=Math.min(config.maxSamplesPerWitness,desired),counts={inFrame:0,outsideFrame:0,twoSided:{visible:0,occluded:0,unresolved:0},frontSide:{visible:0,occluded:0,unresolved:0}};
  const examples={twoSided:{},frontSide:{}};
  const points=Array.from({length:samples},(_,i)=>lerp(line[0],line[1],i/(samples-1)));
  // Coplanar overlap includes its area centroid, beyond the longest chord.
  if(hit.polygon?.length>2) points.push(mul(hit.polygon.reduce(add,[0,0,0]),1/hit.polygon.length));
  for(let i=0;i<points.length;i++) {
    const p=points[i],pixel=projectPoint(p,camera);
    if(!pixel.inFrame) {counts.outsideFrame++;continue;}
    counts.inFrame++;
    const delta=sub(p,camera.originCommon),distance=length(delta),direction=mul(delta,1/distance),viewCos=dot(toDisplay(direction),camera.forward);
    for(const [key,frontOnly] of [['twoSided',false],['frontSide',true]]) {
      // Do not remove the intersecting faces or any other native face.
      const first=firstRayHit(bvh,camera.originCommon,direction,Math.min(camera.far/viewCos,distance+config.rayDepthEpsilonM),frontOnly,config.distanceEpsilonM,camera.near/viewCos);
      const state=!first?'unresolved':first.distanceM<distance-config.rayDepthEpsilonM?'occluded':Math.abs(first.distanceM-distance)<=config.rayDepthEpsilonM?'visible':'unresolved';
      counts[key][state]++;
      if(!examples[key][state]) examples[key][state]={sample:i,pixel:[pixel.x,pixel.y],linePointCommonM:p,targetDistanceM:distance,firstNativeHit:first,depthGapM:first?distance-first.distanceM:null};
    }
  }
  return {pixels,projectedLengthPx,samples:points.length,samplingCapped:desired>config.maxSamplesPerWitness,counts,examples,potentiallyVisibleFrontSide:counts.frontSide.visible>0,potentiallyVisibleTwoSided:counts.twoSided.visible>0,visibilityMeaning:'Sampled contact line is unobstructed by the native mesh. This is not proof of a visible rendering defect; optical overlays, brows, hair, antialiasing, and subpixel coverage need matched screenshots.'};
}
function eyeTopology(triangles,kind) {
  const edges=new Map(),vertices=new Set();let faces=0;
  for(const t of triangles) if(t.kind===kind) {
    faces++;t.ids.forEach(v=>vertices.add(v));
    for(let i=0;i<3;i++) {const a=t.ids[i],b=t.ids[(i+1)%3],key=a<b?a+','+b:b+','+a;edges.set(key,(edges.get(key)||0)+1);}
  }
  let boundaryEdges=0,nonmanifoldEdges=0;for(const n of edges.values()) {if(n===1)boundaryEdges++;if(n>2)nonmanifoldEdges++;}
  return {vertices:vertices.size,triangles:faces,edges:edges.size,boundaryEdges,nonmanifoldEdges,closedManifold:boundaryEdges===0&&nonmanifoldEdges===0,solidPenetrationDepthClaimed:false};
}
function summarizeContacts(triangles,cameras,config) {
  const valid=triangles.filter(t=>t.normalLength>config.doubleAreaEpsilonM2),eyes=valid.filter(t=>t.kind==='eye1'||t.kind==='eye2'),skin=valid.filter(t=>t.kind==='skin'),eyeBVH=makeBVH(eyes),allBVH=makeBVH(valid);
  const witnesses=[],kinds={},views=Object.fromEntries(cameras.map(c=>[c.name,{potentiallyVisibleFrontSidePairs:0,potentiallyVisibleTwoSidedPairs:0,inFramePairs:0,unresolvedFrontSidePairs:0,samplingCappedPairs:0,eye1FrontSidePairs:0,eye2FrontSidePairs:0}]));
  let broadphasePairs=0,analyticTests=0;
  for(const s of skin) {
    const candidates=[];queryBox(eyeBVH,s,config.distanceEpsilonM,candidates);
    broadphasePairs+=candidates.length;
    for(const eye of candidates) {
      analyticTests++;const hit=triangleIntersection(s,eye,config);if(!hit)continue;
      kinds[hit.kind]=(kinds[hit.kind]||0)+1;
      const w={pair:s.id+':'+eye.id,skinFace:s.id,eyeFace:eye.id,eye:eye.kind,...hit,views:{}};
      for(const camera of cameras) {
        const result=cameraWitness(hit,camera,allBVH,config);w.views[camera.name]=result;
        const v=views[camera.name];
        if(result.potentiallyVisibleFrontSide){v.potentiallyVisibleFrontSidePairs++;v[eye.kind+'FrontSidePairs']++;}
        if(result.potentiallyVisibleTwoSided)v.potentiallyVisibleTwoSidedPairs++;
        if(result.counts?.inFrame)v.inFramePairs++;
        if(result.counts?.frontSide.unresolved||result.status)v.unresolvedFrontSidePairs++;
        if(result.samplingCapped)v.samplingCappedPairs++;
      }
      witnesses.push(w);
    }
  }
  witnesses.sort((a,b)=>a.skinFace-b.skinFace||a.eyeFace-b.eyeFace);
  return {summary:{skinTrianglesTested:skin.length,fullEyeTrianglesTested:eyes.length,nativeTrianglesUsedAsOccluders:valid.length,broadphasePairs,analyticTests,totalContactPairs:witnesses.length,kinds,views},witnesses};
}
function geometryHealth(baseline,candidate,mapping,config) {
  const result={baselineDegenerateCount:0,candidateDegenerateCount:0,newDegenerateCount:0,newDegenerateExamples:[],reversedNormalCount:0,reversedNormalExamples:[],minimumNormalDot:1,minimumCandidateDoubleAreaM2:null,displacement:{}};
  let minArea=Infinity;
  for(let i=0;i<baseline.length;i++) {
    const a=baseline[i],b=candidate[i],oldDeg=a.normalLength<=config.doubleAreaEpsilonM2,newDeg=b.normalLength<=config.doubleAreaEpsilonM2;
    if(oldDeg)result.baselineDegenerateCount++;if(newDeg)result.candidateDegenerateCount++;
    if(newDeg&&!oldDeg){result.newDegenerateCount++;if(result.newDegenerateExamples.length<config.maxDiagnosticIds)result.newDegenerateExamples.push(i);}
    if(!oldDeg&&!newDeg) {
      const cos=clamp(dot(a.normal,b.normal)/(a.normalLength*b.normalLength),-1,1);result.minimumNormalDot=Math.min(result.minimumNormalDot,cos);
      if(cos<=0){result.reversedNormalCount++;if(result.reversedNormalExamples.length<config.maxDiagnosticIds)result.reversedNormalExamples.push({face:i,normalDot:cos});}
    }
    minArea=Math.min(minArea,b.normalLength);
  }
  result.minimumCandidateDoubleAreaM2=Number.isFinite(minArea)?minArea:null;
  result.normalCheckMeaning='A candidate face normal at least 90 degrees from its same-index baseline normal is flagged. This is a small-edit inversion guard, not a proof for arbitrary rigid rotations.';
  return result;
}
function displacementHealth(a,b,vertexComponents) {
  const groups={all:{},body:{},skin:{},eye1:{},eye2:{},other:{}};
  for(const g of Object.values(groups)) Object.assign(g,{vertices:0,movedExactly:0,maxM:0,rmsM:0,maxVertex:null,sumSquares:0});
  for(let i=0;i<vertexComponents.length;i++) {
    const d=length(sub(point(b,i),point(a,i))),c=vertexComponents[i],key=c===-1?'body':c===0?'skin':c===1?'eye1':c===2?'eye2':'other';
    for(const g of [groups.all,groups[key]]) {g.vertices++;if(d!==0)g.movedExactly++;g.sumSquares+=d*d;if(d>g.maxM){g.maxM=d;g.maxVertex=i;}}
  }
  for(const g of Object.values(groups)){g.rmsM=g.vertices?Math.sqrt(g.sumSquares/g.vertices):0;delete g.sumSquares;}
  return groups;
}
function boundedContactReport(contacts,max) {
  const priority=w=>Object.values(w.views).some(v=>v.potentiallyVisibleFrontSide)?0:Object.values(w.views).some(v=>v.potentiallyVisibleTwoSided)?1:2;
  const sorted=contacts.witnesses.slice().sort((a,b)=>priority(a)-priority(b)||a.skinFace-b.skinFace||a.eyeFace-b.eyeFace);
  return {...contacts.summary,witnesses:sorted.slice(0,max),witnessesIncluded:Math.min(max,sorted.length),witnessesOmitted:Math.max(0,sorted.length-max),witnessSelection:'Potentially visible contacts first, then stable native face order; all counts and visibility are computed before this report cap.'};
}
function compareContacts(a,b,cameras,config) {
  const old=new Map(a.witnesses.map(w=>[w.pair,w])),now=new Map(b.witnesses.map(w=>[w.pair,w]));
  const added=b.witnesses.filter(w=>!old.has(w.pair)),removed=a.witnesses.filter(w=>!now.has(w.pair));
  const views={};
  for(const c of cameras) {
    const visibleBefore=new Set(a.witnesses.filter(w=>w.views[c.name].potentiallyVisibleFrontSide).map(w=>w.pair)),visibleNow=new Set(b.witnesses.filter(w=>w.views[c.name].potentiallyVisibleFrontSide).map(w=>w.pair));
    const becameVisible=[...visibleNow].filter(p=>!visibleBefore.has(p)),noLongerVisible=[...visibleBefore].filter(p=>!visibleNow.has(p));
    views[c.name]={becamePotentiallyVisibleFrontSideCount:becameVisible.length,becamePotentiallyVisibleFrontSideExamples:becameVisible.slice(0,config.maxDiagnosticIds),noLongerPotentiallyVisibleFrontSideCount:noLongerVisible.length,noLongerPotentiallyVisibleFrontSideExamples:noLongerVisible.slice(0,config.maxDiagnosticIds)};
  }
  return {addedPairCount:added.length,removedPairCount:removed.length,addedPairExamples:added.slice(0,config.maxDiagnosticIds).map(w=>w.pair),removedPairExamples:removed.slice(0,config.maxDiagnosticIds).map(w=>w.pair),views,interpretation:'Pair IDs can change under small edits; neither total pair count nor its reduction proves appearance improvement.'};
}
function auditNativeGeometry({baseline,candidate,mapping,cameras,options={}}) {
  const config=settings(options),input=validateInputs(baseline,candidate,config);
  const report={schema:SCHEMA,algorithm:'complete native skin/full-eye AABB broadphase, analytic triangle-plane interval overlap, all-native-mesh camera rays',engineSourceCommit:ENGINE_COMMIT,options:config,input,structuralPass:false,appearanceAccepted:false,solidPenetrationDepthClaimed:false,rollbackCheckedHere:false};
  if(!input.valid){report.status='failed_input_validation';return report;}
  if(!cameras||!Object.keys(cameras).length) throw Error('Exact saved cameras are required');
  const preparedCameras=Object.entries(cameras).map(([n,c])=>prepareCamera(n,c));
  const classified=classifyMapping(mapping,input.vertexCount,baseline.faces,config);report.mapping=classified.report;
  report.cameras=Object.fromEntries(preparedCameras.map(c=>{const {forward,right,vertical,originCommon,...saved}=c;return [c.name,saved];}));
  report.hashes={encoding:'little-endian Float64 positions and UInt32 indices; these are QA hashes, not the renderer Float32 hash',baselinePositions:hashNumbers(baseline.positions,'float64'),candidatePositions:hashNumbers(candidate.positions,'float64'),faceIndices:hashNumbers(baseline.faces,'uint32')};
  const old=makeTriangles(baseline.positions,baseline.faces,classified.faceKinds),now=makeTriangles(candidate.positions,candidate.faces,classified.faceKinds);
  report.health=geometryHealth(old,now,classified,config);
  report.health.displacement=displacementHealth(baseline.positions,candidate.positions,classified.vertexComponents);
  report.eyeTopology={eye1:eyeTopology(now,'eye1'),eye2:eyeTopology(now,'eye2')};
  const d=report.health.displacement;
  report.gates={finite:true,exactTopology:input.exactFaceIndices,fullNativeEyes:classified.report.fullNativeEyeTopologyVerified,noNewDegenerateFaces:report.health.newDegenerateCount===0,noReversedNormals:report.health.reversedNormalCount===0,bodyWithinFrozenTolerance:d.body.maxM<=config.maxBodyDisplacementM,eyesWithinFrozenTolerance:Math.max(d.eye1.maxM,d.eye2.maxM)<=config.maxEyeDisplacementM};
  report.structuralPass=Object.values(report.gates).every(Boolean);
  const a=summarizeContacts(old,preparedCameras,config),b=report.hashes.baselinePositions===report.hashes.candidatePositions?a:summarizeContacts(now,preparedCameras,config);
  report.baselineContacts=boundedContactReport(a,config.maxWitnesses);report.candidateContacts=boundedContactReport(b,config.maxWitnesses);report.contactChange=compareContacts(a,b,preparedCameras,config);
  report.status=report.structuralPass?'structural_checks_passed_visual_review_required':'structural_checks_failed';
  report.limitations=[
    'Surface contacts use Float64 analytic intersections with the recorded tolerances; no exact-arithmetic predicate guarantee.',
    'Eye components may have open boundaries. No closed-solid assumption, signed inside/outside label, sphere replacement, or volumetric penetration depth is used.',
    'Camera rays include every nondegenerate native triangle, with no contact-pair or anatomical exclusions. FrontSide and two-sided results are both reported.',
    'Line visibility is sampled at recorded pixel spacing and capped when reported. It can miss a smaller visible interval; projected witnesses must be reviewed against the exact saved screenshots.',
    'Native mesh rays do not include appearance overlays, eyebrows, fixed hair, optical transparency, lighting, or antialiasing. A potential visible contact is not itself proof of an image defect.',
    'This helper checks skin/eye contacts only, not skin self-intersection, lip/dental contact, or other component/component collisions.',
    'Exact archive restoration and repeated pixel hashes remain renderer responsibilities.'
  ];
  return report;
}

// Pass this function directly to page.evaluate. Never serialize its returned raw
// arrays to a published artifact; feed them into auditNativeGeometry in memory.
function captureNativeSnapshot() {
  const model=fullCommonWorkbench.motion().controller.model;
  return {positions:Array.from(model.positions),faces:Array.from(model.faces),mapping:{bodyCount:model.bodyCount,gnmRecipes:model.canonical.gnmRecipes.map(r=>Array.from(r)),componentId:Array.from(model.gnm.componentId),gnmTriangles:Array.from(model.gnm.triangles)}};
}
// Pass directly to page.evaluate AFTER restoreCamera and updateProjectionMatrix.
function captureCamera() {
  const viewer=fullCommonWorkbench.motion().viewer,c=viewer.camera,r=viewer.canvas.getBoundingClientRect();
  c.updateMatrixWorld(true);
  return {position:c.position.toArray(),target:viewer.orbit.target.toArray(),up:c.up.toArray(),zoom:c.zoom,fov:c.fov,aspect:c.aspect,near:c.near,far:c.far,width:r.width,height:r.height,projectionMatrix:c.projectionMatrix.toArray(),matrixWorldInverse:c.matrixWorldInverse.toArray(),drawingBufferWidth:viewer.canvas.width,drawingBufferHeight:viewer.canvas.height};
}

// A bounded, transparent vector diagnostic, aligned to the exact screenshot
// dimensions. Place over the unmodified matching PNG; this is not a beauty render.
function witnessOverlaySVG(report,stage,view) {
  if(!['baseline','candidate'].includes(stage)) throw Error('Overlay stage must be baseline or candidate');
  const contacts=report[stage+'Contacts'],camera=report.cameras?.[view];
  if(!contacts||!camera) throw Error('Missing contact report or saved camera');
  const escape=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
  const fmt=n=>Number(n.toFixed(5));
  const lines=[];
  for(const w of contacts.witnesses) {
    const v=w.views[view];if(!v?.pixels?.every(p=>p.x!==null&&p.y!==null))continue;
    const [a,b]=v.pixels,visible=v.potentiallyVisibleFrontSide,uncertain=!!v.counts?.frontSide.unresolved;
    const color=visible?'#ff3355':uncertain?'#c04cff':'#ffba33';
    lines.push(`<line x1="${fmt(a.x)}" y1="${fmt(a.y)}" x2="${fmt(b.x)}" y2="${fmt(b.y)}" stroke="${color}" stroke-width="${visible?1.5:0.65}" opacity="${visible?0.95:0.4}"><title>${escape(w.pair+' '+w.kind+' '+w.eye+(visible?' potentially visible':uncertain?' unresolved ray':' occluded/outside'))}</title></line>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${camera.width}" height="${camera.height}" viewBox="0 0 ${camera.width} ${camera.height}"><title>${escape(stage+' '+view+' native surface contact witnesses')}</title><desc>Transparent diagnostic for the same saved camera. Red: sampled line potentially visible with native FrontSide. Amber: occluded or outside sampled frame. Purple: unresolved ray samples. No raw mesh. ${contacts.witnessesOmitted} contact witnesses omitted by output cap.</desc><g>${lines.join('')}</g></svg>`;
}

module.exports={auditNativeGeometry,captureNativeSnapshot,captureCamera,witnessOverlaySVG,DEFAULTS,SCHEMA,
  _testing:{cameraWitness,triangleIntersection,makeTriangles,makeBVH,firstRayHit,rayTriangle,prepareCamera,projectPoint,toDisplay,fromDisplay,classifyMapping}};
