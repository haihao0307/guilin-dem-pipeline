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

function clipPolygon(vertices,axis,limit,keepLower){
  const result=[];
  for(let i=0;i<vertices.length;i++){
    const a=vertices[i],b=vertices[(i+1)%vertices.length],da=dot(a.position,axis)-limit,db=dot(b.position,axis)-limit;
    const ina=keepLower?da<=0:da>=0,inb=keepLower?db<=0:db>=0;
    if(ina)result.push(a);
    if(ina!==inb){const t=da/(da-db);result.push({position:lerp(a.position,b.position,t),normal:lerp(a.normal,b.normal,t),uv:lerp(a.uv,b.uv,t)});}
  }
  return result;
}

/** Retains all unknown geometry; only removes the selected long-face portions in the slab. */
export function rebuildRodArrays(source,{parameters=ROD_PARAMETERS,axialSegments=1}={}){
  const p=parameters;requireSource(source,p);
  if(p.frame.origin.some(x=>x!==0))throw Error('This source clipping adapter requires the measured zero-origin frame');
  const position=Array.from(source.position),normal=Array.from(source.normal),uv=Array.from(source.uv),index=[];
  const retainedSourceTriangleIds=[],replacedLongFaceTriangleIds=[],clipRanges=[];
  const row=(a,i,n)=>Array.from(a.subarray(i*n,(i+1)*n));
  function appendPolygon(poly,sourceTriangleId,side){
    if(poly.length<3)return;
    const start=index.length,base=position.length/3;
    for(const v of poly){position.push(...v.position);normal.push(...v.normal);uv.push(...v.uv);}
    for(let j=1;j+1<poly.length;j++)index.push(base,base+j,base+j+1);
    clipRanges.push({sourceTriangleId,side,indexStart:start,indexCount:index.length-start});
  }
  for(let i=0;i<source.index.length;i+=3){
    const ids=Array.from(source.index.subarray(i,i+3)),positions=ids.map(j=>row(source.position,j,3));
    if(Math.max(...positions.map(q=>q[2]))-Math.min(...positions.map(q=>q[2]))<=p.sourceTriangleSelection.threshold){
      retainedSourceTriangleIds.push(i/3);index.push(...ids);continue;
    }
    replacedLongFaceTriangleIds.push(i/3);
    const poly=ids.map((j,k)=>({position:positions[k],normal:row(source.normal,j,3),uv:row(source.uv,j,2)}));
    appendPolygon(clipPolygon(poly,p.frame.w,p.generatedRangeW[0],true),i/3,'low-end-source');
    appendPolygon(clipPolygon(poly,p.frame.w,p.generatedRangeW[1],false),i/3,'high-end-source');
  }
  if(replacedLongFaceTriangleIds.length!==p.sourceTriangleSelection.expectedCount)throw Error('Long-face selection changed');
  const generated=generateCentralChannel(p,{axialSegments}),generatedIndexStart=index.length,offset=position.length/3;
  position.push(...generated.position);normal.push(...generated.normal);uv.push(...generated.uv);index.push(...Array.from(generated.index,i=>i+offset));
  const report={version:'source-103-partial-channel-rebuild/1',status:'partial-source-retained-candidate',units:p.units,
    sourceNodeIndex:103,sourceParentName:'Main Gear_42',originalVertexCount:source.position.length/3,originalTriangleCount:source.index.length/3,
    retainedUnmodifiedTriangleCount:retainedSourceTriangleIds.length,retainedSourceTriangleIds,
    selectedOriginalLongFaceTriangleCount:replacedLongFaceTriangleIds.length,replacedLongFaceTriangleIds,
    sourceEndClipTriangleCount:clipRanges.reduce((n,x)=>n+x.indexCount/3,0),clipRanges,
    generatedTriangleCount:generated.index.length/3,generatedIndexStart,generatedIndexCount:generated.index.length,
    generatedRangeW:p.generatedRangeW,section:p.section,dimensions:p.measuredDimensions,
    generatedFrom:'Seven scalar C-section planes, a three-vector frame, and an extrusion interval; no source point table used to generate the central shape.',
    residualPolicy:'All original attributes remain verbatim for untouched triangles. Only long faces are clipped outside the generated slab. Source eyes/collars/caps/fasteners are not replaced.',
    sourceInputIdentityGuard:'FNV-1a attribute guard for adapter identity only, not cryptographic validation. CPU test additionally verifies source SHA256.',
    originalMaterialPreservedByCaller:true,sourceMaterialHasTextures:false,sourceVertexTableRetained:true,
    fullParametricReconstruction:false,sourceEndEyesParametric:false,throughHoleClaim:false,engineeringUnitsVerified:false,
    limits:p.limits};
  return {position:new Float32Array(position),normal:new Float32Array(normal),uv:new Float32Array(uv),index:new Uint32Array(index),report};
}

/** Requested integration interface; does not mutate the source geometry or material. */
export function rebuildSourceRod(T,sourceGeometry,options={}){
  const names=Object.keys(sourceGeometry.attributes).sort();
  if(JSON.stringify(names)!==JSON.stringify(['normal','position','uv']))throw Error('Unmapped source attributes: preserve original geometry');
  if(sourceGeometry.morphAttributes&&Object.keys(sourceGeometry.morphAttributes).length)throw Error('Unmapped morph attributes: preserve original geometry');
  const data=rebuildRodArrays({position:sourceGeometry.getAttribute('position').array,normal:sourceGeometry.getAttribute('normal').array,
    uv:sourceGeometry.getAttribute('uv').array,index:sourceGeometry.index.array},options);
  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.BufferAttribute(data.position,3));geometry.setAttribute('normal',new T.BufferAttribute(data.normal,3));
  geometry.setAttribute('uv',new T.BufferAttribute(data.uv,2));geometry.setIndex(new T.BufferAttribute(data.index,1));
  geometry.name='source-node-103-partial-channel-candidate';geometry.userData={...sourceGeometry.userData,rodRebuild:data.report};
  geometry.computeBoundingBox();geometry.computeBoundingSphere();return {geometry,report:data.report};
}
