'use strict';
// Read-only host audit. Only the optional JSON receipt is written beside this script.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const assert = require('node:assert/strict');
const {clipTerrainOutsideRects, rectanglesFromManifest} = require('./clip-background-rects.js');
const root=path.resolve(__dirname,'../../..');
const hostPath=path.join(root,'hong-kong-map-sea-r03/publish-final/index.html');
const manifestPath=process.argv[2]||'/workspace/shared/hk_kowloon_cedd_ground_r01/terrain-increment/manifest.json';
const digest=data=>crypto.createHash('sha256').update(data).digest('hex');
const bytes=v=>Buffer.from(v.buffer,v.byteOffset,v.byteLength);
const hostBytes=fs.readFileSync(hostPath),host=hostBytes.toString('utf8');
assert.equal(digest(hostBytes),'54487b03d7314edb19ed3ed37aab47bb662c8633e05cf96fdef7d28ac10a4117');
function embedded(name){
  const m=new RegExp('window\\.'+name+'\\s*=\\s*').exec(host);assert.ok(m);
  const start=m.index+m[0].length;let depth=0,inString=false,escape=false;
  for(let i=start;i<host.length;i++){
    const c=host[i];if(inString){if(escape)escape=false;else if(c==='\\')escape=true;else if(c==='"')inString=false;continue;}
    if(c==='"')inString=true;else if(c==='{')depth++;else if(c==='}'&&--depth===0)return JSON.parse(host.slice(start,i+1));
  }
  throw Error('Unterminated embedded JSON: '+name);
}
const HK=embedded('HK_MAP_DATA'),details=embedded('HK_DETAIL_DATA');
const rawHeight=zlib.gunzipSync(Buffer.from(HK.heights,'base64')),rawMask=zlib.gunzipSync(Buffer.from(HK.mask,'base64'));
const hkHeights=new Float32Array(rawHeight.buffer,rawHeight.byteOffset,rawHeight.byteLength/4),hkMask=new Uint8Array(rawMask.buffer,rawMask.byteOffset,rawMask.byteLength);
const heightBefore=digest(rawHeight),maskBefore=digest(rawMask);
const hkBox=[HK.x0-HK.origin[0],HK.origin[1]-HK.y0,HK.step*(HK.width-1),HK.step*(HK.height-1)];
const oldRects=details.patches.map(p=>{const b=p.bounds_epsg2326;return{minX:b[0]-HK.origin[0],minZ:HK.origin[1]-b[3],maxX:b[2]-HK.origin[0],maxZ:HK.origin[1]-b[1]};});
const insideDetail=(x,z)=>oldRects.some(r=>x>r.minX&&x<r.maxX&&z>r.minZ&&z<r.maxZ);
const norm=v=>{const length=Math.hypot(...v)||1;return v.map(x=>x/length);};
const begin=host.indexOf('const hkV=new Float32Array('),end=host.indexOf('function hkMesh(',begin);
assert.ok(begin>=0&&end>begin);
// Execute only the identified, pinned host's existing vertex/index generation loop.
const {hkV,hkI}=new Function('HK','hkHeights','hkMask','hkBox','insideDetail','norm',host.slice(begin,end)+';return{hkV,hkI};')(HK,hkHeights,hkMask,hkBox,insideDetail,norm);
const vBefore=digest(bytes(hkV)),iBefore=digest(bytes(Uint32Array.from(hkI)));
function rawFloor(x,z){const col=(x-hkBox[0])/HK.step,row=(z-hkBox[1])/HK.step,c=Math.min(HK.width-2,Math.floor(col)),r=Math.min(HK.height-2,Math.floor(row));const u=col-c,v=row-r,j=r*HK.width+c,A=hkHeights[j],B=hkHeights[j+1],C=hkHeights[j+HK.width],D=hkHeights[j+HK.width+1];return u+v<=1?A+(B-A)*u+(C-A)*v:D+(C-D)*(1-u)+(B-D)*(1-v);}
const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8')),rects=rectanglesFromManifest(manifest);
const queries=[];
for(const r of rects)for(let k=0;k<257;k++){const f=(k+.37)/257,g=((k*67)%257+.21)/257;queries.push([r.minX-30+f*(r.maxX-r.minX+60),r.minZ-30+g*(r.maxZ-r.minZ+60)]);}
const floorsBefore=queries.map(p=>rawFloor(...p));
const started=performance.now(),out=clipTerrainOutsideRects(hkV,hkI,rects,{traceSources:true}),durationMs=performance.now()-started;
const gpuPositions=Float32Array.from(out.positions);
assert.equal(digest(rawHeight),heightBefore);assert.equal(digest(rawMask),maskBefore);assert.equal(digest(bytes(hkV)),vBefore);assert.equal(digest(bytes(Uint32Array.from(hkI))),iBefore);
assert.deepEqual(queries.map(p=>rawFloor(...p)),floorsBefore);
assert.equal(digest(fs.readFileSync(hostPath)),digest(hostBytes));
for(let i=0;i<hkV.length;i++)assert.equal(out.positions[i],hkV[i]);
const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
function tri(v,ids,i){return [0,1,2].map(j=>[v[ids[i+j]*7],v[ids[i+j]*7+2]]);}
function intersectArea(t,r){let p=t;for(const[axis,b,sign]of[[0,r.minX,1],[0,r.maxX,-1],[1,r.minZ,1],[1,r.maxZ,-1]]){const q=[];for(let i=0;i<p.length;i++){const a=p[i],c=p[(i+1)%p.length],da=sign*(a[axis]-b),dc=sign*(c[axis]-b);if(da>=0)q.push(a);if((da<0)!==(dc<0)){const f=(b-a[axis])/(c[axis]-a[axis]),v=[a[0]+f*(c[0]-a[0]),a[1]+f*(c[1]-a[1])];v[axis]=b;q.push(v);}}p=q;}let a=0;for(let i=1;i+1<p.length;i++)a+=cross(p[0],p[i],p[i+1]);return Math.abs(a)/2;}
let maxInteriorArea=0,maxGpuInteriorArea=0,maxPlaneError=0,maxGpuPlaneError=0,maxAttributeError=0,unchangedIndexTriples=0,outputCandidateTriangles=0;
for(let i=0;i<out.indices.length;i+=3){
  const source=out.triangleSources[i/3]*3;
  if(out.indices[i]===hkI[source]&&out.indices[i+1]===hkI[source+1]&&out.indices[i+2]===hkI[source+2]){unchangedIndexTriples++;continue;}
  outputCandidateTriangles++;
  const original=tri(hkV,hkI,source),t=tri(out.positions,out.indices,i),g=tri(gpuPositions,out.indices,i),den=cross(...original);
  assert.ok(cross(...t)*den>0);assert.ok(cross(...g)*den>0);
  for(const r of rects){maxInteriorArea=Math.max(maxInteriorArea,intersectArea(t,r));maxGpuInteriorArea=Math.max(maxGpuInteriorArea,intersectArea(g,r));}
  for(let j=0;j<3;j++)for(const component of [1,3,4,5,6]){
    const w1=cross(original[0],t[j],original[2])/den,w2=cross(original[0],original[1],t[j])/den;
    const a=hkV[hkI[source]*7+component],b=hkV[hkI[source+1]*7+component],c=hkV[hkI[source+2]*7+component];
    const error=Math.abs(out.positions[out.indices[i+j]*7+component]-(a+w1*(b-a)+w2*(c-a)));
    maxAttributeError=Math.max(maxAttributeError,error);if(component===1)maxPlaneError=Math.max(maxPlaneError,error);
    if(component===1){const u=cross(original[0],g[j],original[2])/den,v=cross(original[0],original[1],g[j])/den;maxGpuPlaneError=Math.max(maxGpuPlaneError,Math.abs(gpuPositions[out.indices[i+j]*7+1]-(a+u*(b-a)+v*(c-a))));}
  }
}
// Verify all unchanged triangles too: strict bbox rejection is safe; candidate
// originals must have no positive rectangle interior remaining.
for(let i=0;i<out.indices.length;i+=3){const t=tri(out.positions,out.indices,i);for(const r of rects){if(Math.max(...t.map(p=>p[0]))<=r.minX||Math.min(...t.map(p=>p[0]))>=r.maxX||Math.max(...t.map(p=>p[1]))<=r.minZ||Math.min(...t.map(p=>p[1]))>=r.maxZ)continue;maxInteriorArea=Math.max(maxInteriorArea,intersectArea(t,r));}}
const expectedArea=rects.reduce((s,r)=>s+(r.maxX-r.minX)*(r.maxZ-r.minZ),0);
assert.ok(Math.abs(out.stats.removedAreaXZ-expectedArea)<1e-7);
assert.ok(Math.abs(out.stats.sourceAreaXZ-out.stats.outputAreaXZ-expectedArea)<1e-7);
assert.equal(maxInteriorArea,0);assert.equal(maxGpuInteriorArea,0);
assert.ok(maxPlaneError<1e-10);assert.ok(maxAttributeError<1e-10);
assert.equal(unchangedIndexTriples,out.stats.untouchedTriangles);
assert.equal(out.stats.droppedRoundoffTriangles,0);
const receipt={status:'PASS',hostSHA256:digest(hostBytes),manifestSHA256:digest(fs.readFileSync(manifestPath)),rectangles:rects,clipMilliseconds:durationMs,stats:out.stats,expectedRemovedUnionAreaXZ:expectedArea,unchangedIndexTriples,outputCandidateTriangles,maxInteriorAreaXZ:maxInteriorArea,maxFloat32InteriorAreaXZ:maxGpuInteriorArea,maxNewVertexOriginalPlaneErrorM:maxPlaneError,maxNewVertexAttributeError:maxAttributeError,maxFloat32OriginalPlaneErrorM:maxGpuPlaneError,rawFloorQueriesUnchanged:queries.length,sourceArraysUnchanged:true,sourceHostUnchanged:true,sourceHeightsRawSHA256:heightBefore,sourceMaskRawSHA256:maskBefore,sourceVertexSHA256:vBefore,sourceIndexSHA256:iBefore,limits:['Read-only Node geometry audit; not a browser/render acceptance.','Float32 GPU storage introduces the separately reported interpolation rounding; no source-floor samples are changed.','No bridging, inward feathering, source editing, publication or R02 changes.']};
fs.writeFileSync(path.join(__dirname,'clip-background-rects.host-validation.json'),JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify(receipt,null,2));
