'use strict';
// Read-only seam audit. Only its JSON result is written beside this script.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const assert = require('node:assert/strict');
const {createTerrainSeamClosure} = require('./close-terrain-seams.js');
const root=path.resolve(__dirname,'../../..');
const hostPath=path.join(root,'hong-kong-map-sea-r03/publish-final/index.html');
const manifestPath=process.argv[2]||path.join(__dirname,'data/manifest.json');
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
(async()=>{
  const {createPatch}=await import('./data/runtime/height-spectrum.mjs');
  const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
  const patches=manifest.patches.map(m=>{const raw=zlib.gunzipSync(fs.readFileSync(path.join(path.dirname(manifestPath),m.coefficients.url))),view=new DataView(raw.buffer,raw.byteOffset,raw.byteLength),a=new Float64Array(raw.byteLength/8);for(let i=0;i<a.length;i++)a[i]=view.getFloat64(i*8,true);return createPatch(m,a).hostPatch;});
  const patchBefore=patches.map(p=>digest(bytes(p.levels['2'].heights)));
  const start=performance.now(),out=createTerrainSeamClosure({patches,backgroundPositions:hkV,backgroundIndices:hkI,grid:HK,trace:true}),milliseconds=performance.now()-start;
  let maxOldEndpointGapM=0,maxNewEndpointGapM=0,maxXZOffsetM=0,internalFaces=0,wrongWinding=0,zeroAreaFaces=0;
  const p=out.positions;
  function originalPlane(ids,x,z){const [a,b,c]=ids.map(i=>[hkV[i*7],hkV[i*7+1],hkV[i*7+2]]),d=(b[0]-a[0])*(c[2]-a[2])-(b[2]-a[2])*(c[0]-a[0]),u=((x-a[0])*(c[2]-a[2])-(z-a[2])*(c[0]-a[0]))/d,t=((b[0]-a[0])*(z-a[2])-(b[2]-a[2])*(x-a[0]))/d;return a[1]+u*(b[1]-a[1])+t*(c[1]-a[1]);}
  function patchHeight(p,x,z){const l=p.levels['2'],cf=(x+HK.origin[0]-l.x0)/2,rf=(HK.origin[1]-z-l.y0)/-2,c=Math.min(l.width-2,Math.max(0,Math.floor(cf))),r=Math.min(l.height-2,Math.max(0,Math.floor(rf))),u=cf-c,v=rf-r,j=r*l.width+c,A=l.heights[j],B=l.heights[j+1],C=l.heights[j+l.width],D=l.heights[j+l.width+1];return u+v<=1?A+(B-A)*u+(C-A)*v:D+(C-D)*(1-u)+(B-D)*(1-v);}
  const rects=patches.map(q=>{const b=q.bounds_epsg2326;return{minX:b[0]-HK.origin[0],minZ:HK.origin[1]-b[3],maxX:b[2]-HK.origin[0],maxZ:HK.origin[1]-b[1]};});
  for(const s of out.segments){
    const d0=s.newHeights[0]-s.oldHeights[0],d1=s.newHeights[1]-s.oldHeights[1];assert(d0*d1>=0);
    const mid=(s.a+s.b)/2,x=s.axis==='x'?mid:s.fixed,z=s.axis==='z'?mid:s.fixed;
    for(let q=0;q<rects.length;q++){if(q===s.patchIndex)continue;const r=rects[q];if(s.edge==='north'?r.minZ<z&&r.maxZ>=z&&x>r.minX&&x<r.maxX:s.edge==='south'?r.maxZ>z&&r.minZ<=z&&x>r.minX&&x<r.maxX:s.edge==='west'?r.minX<x&&r.maxX>=x&&z>r.minZ&&z<r.maxZ:r.maxX>x&&r.minX<=x&&z>r.minZ&&z<r.maxZ)internalFaces++;}
    for(let k=0;k<4;k++){const i=(s.vertexStart+k)*7,x=p[i],y=p[i+1],z=p[i+2];assert.equal(p[i+6],1);if(k%2)maxNewEndpointGapM=Math.max(maxNewEndpointGapM,Math.abs(y-patchHeight(patches[s.patchIndex],x,z)));else maxOldEndpointGapM=Math.max(maxOldEndpointGapM,Math.abs(y-originalPlane(s.oldTriangleIndices,x,z)));const along=k<2?s.a:s.b;maxXZOffsetM=Math.max(maxXZOffsetM,Math.abs((s.axis==='x'?x:z)-along));}
    // Entire segments, not only vertices, must lie on both supporting edge planes.
    for(const fraction of [.17,.5,.83]){
      const ia=s.vertexStart*7,ib=(s.vertexStart+2)*7,x=p[ia]+fraction*(p[ib]-p[ia]),z=p[ia+2]+fraction*(p[ib+2]-p[ia+2]);
      const oldY=p[ia+1]+fraction*(p[ib+1]-p[ia+1]),newY=p[ia+8]+fraction*(p[ib+8]-p[ia+8]);
      maxOldEndpointGapM=Math.max(maxOldEndpointGapM,Math.abs(oldY-originalPlane(s.oldTriangleIndices,x,z)));
      maxNewEndpointGapM=Math.max(maxNewEndpointGapM,Math.abs(newY-patchHeight(patches[s.patchIndex],x,z)));
    }
  }
  for(const value of p)assert(Number.isFinite(value));
  for(let i=0;i<out.indices.length;i+=3){const[a,b,c]=[out.indices[i]*7,out.indices[i+1]*7,out.indices[i+2]*7],u=[p[b]-p[a],p[b+1]-p[a+1],p[b+2]-p[a+2]],v=[p[c]-p[a],p[c+1]-p[a+1],p[c+2]-p[a+2]],n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];if(Math.hypot(...n)===0)zeroAreaFaces++;if(n[0]*p[a+3]+n[2]*p[a+5]<=0)wrongWinding++;}
  assert.equal(internalFaces,0);assert.equal(zeroAreaFaces,0);assert.equal(wrongWinding,0);
  assert.equal(out.stats.noOriginalOutsideTriangleSkipped,0);assert.equal(out.stats.unsupportedSourceTriangles,0);
  assert.equal(out.stats.externalBoundaryLengthM,2752);assert.equal(out.stats.closedBoundaryLengthM,2752);
  assert.equal(digest(rawHeight),heightBefore);assert.equal(digest(rawMask),maskBefore);assert.equal(digest(bytes(hkV)),vBefore);assert.equal(digest(bytes(Uint32Array.from(hkI))),iBefore);assert.deepEqual(patches.map(p=>digest(bytes(p.levels['2'].heights))),patchBefore);assert.equal(digest(fs.readFileSync(hostPath)),digest(hostBytes));
  const result={status:maxOldEndpointGapM<1e-4&&maxNewEndpointGapM<1e-4?'PASS':'FAIL_ENDPOINT_TOLERANCE',schema:'hk-display-seam-closure-validation/1',hostSHA256:digest(hostBytes),manifestSHA256:digest(fs.readFileSync(manifestPath)),milliseconds,stats:out.stats,maxOldEndpointGapM,maxNewEndpointGapM,maxXZOffsetM,internalFaces,zeroAreaFaces,wrongWinding,originalSourceArraysUnchanged:true,newSourceHeightsUnchanged:true,sourceHostUnchanged:true,limits:['Synthetic vertical display closure; not real terrain, retaining-wall architecture, survey data or building foundations.','No source/floor mutation and no inward feathering.','Node geometry validation, not browser acceptance.']};
  fs.writeFileSync(path.join(__dirname,'close-terrain-seams.host-validation.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
  assert.equal(result.status,'PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});
