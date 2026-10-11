import {createR312Wall,original} from '../r312-wall/r312-wall.mjs';
import {cubeLattice,rotateToWorld,rotatedHalf,doorCaps} from './geometry.mjs';
import {surfaceVertex,surfaceFragment} from './shaders.mjs';
import {sampleOriginalSurface} from './gpu-sampler.mjs';
const caches=new WeakMap();
const noVersion=s=>s.replace(/^#version 300 es\n/,'');
export const PROBE_VERSION='radial-surface-r01';
export function createR312SurfaceProbe({THREE,renderer,spacing=.06,cache=true,...options}={}){
 if(!renderer?.getContext)throw Error('Supply existing host WebGL2 renderer');
 if(options.showPlaster!==false)throw Error('First surface probe requires explicit showPlaster:false; original plaster is not approximated');
 if(options.mode&&options.mode!=='wall'&&options.mode!=='bricks'&&options.mode!=='soil')throw Error('First probe supports wall/bricks/soil');
 if(spacing<.01||spacing>.12)throw Error('Sampling spacing must be .01 to .12 metres');
 const start=performance.now(),wall=createR312Wall({THREE,...options,proxyCulling:'double'}),p=wall.parameters;
 wall.group.name='R3.12 isolated sampled surface probe';const stages=[];let retainedCPUBytes=0,triangles=0,cacheHits=0,peakTransientBytes=0;
 if(!caches.has(renderer))caches.set(renderer,new Map());const cacheMap=caches.get(renderer);
 try{for(const mesh of wall.meshes){
  const mat=mesh.material,kind=mat.name.includes('brick')?'brick':'soil',top=mat.uniforms.uSoilTop.value,half=kind==='brick'?[.134,.043,.070]:[2.17,top/2+.145,.365],center=kind==='brick'?[0,0,0]:[0,top/2,0],count=kind==='brick'?mesh.geometry.instanceCount:1;
  const lattice=cubeLattice(half,spacing),key=JSON.stringify({version:PROBE_VERSION,source:original.sourceSha256,kind,batch:mat.uniforms.uBatch?.value,spacing,count,parameters:p});
  let data=cache?cacheMap.get(key):null;
  if(data){cacheHits++;stages.push({kind,cacheHit:true,samples:lattice.vertexCount*count,totalSamplingThroughReadbackMs:0});}
  else{
   const sampled=sampleOriginalSurface({renderer,kind,lattice,instanceCount:count,uniforms:mat.uniforms,center});peakTransientBytes=Math.max(peakTransientBytes,sampled.metrics.temporaryReadbackBytes+sampled.metrics.temporaryGPUAttachmentBytes);
   const buildStart=performance.now();data=buildSurfaceData({kind,lattice,count,sampled,door:p.door,center,half});sampled.metrics.cpuBuildMs=performance.now()-buildStart;stages.push(sampled.metrics);if(cache)cacheMap.set(key,data);
  }
  const geo=new THREE.BufferGeometry();for(const [name,itemSize]of [['position',3],['probeNormal',3],['probeCap',1],...(kind==='brick'?[['probeMeta',4],['probeSeed',2]]:[])])geo.setAttribute(name,new THREE.BufferAttribute(data[name],itemSize));geo.setIndex(new THREE.BufferAttribute(data.indices,1));geo.computeBoundingBox();geo.computeBoundingSphere();
  // Original onBeforeRender and uniform controller are reused. No original file is modified.
  mesh.geometry.dispose();mesh.geometry=geo;mesh.frustumCulled=true;mesh.raycast=()=>{};
  if(!wall._surfaceGeometries)wall._surfaceGeometries=[];wall._surfaceGeometries.push(geo);
  mat.vertexShader=noVersion(surfaceVertex(kind));mat.fragmentShader=noVersion(surfaceFragment(kind));mat.side=THREE.DoubleSide;mat.needsUpdate=true;mat.name+='-sampled-surface';
  triangles+=data.indices.length/3;retainedCPUBytes+=data.bytes;
 }}catch(e){for(const g of wall._surfaceGeometries||[])g.dispose();wall.dispose();throw e;}
 const baseDispose=wall.dispose.bind(wall);wall.dispose=()=>{for(const g of wall._surfaceGeometries||[])g.dispose();baseDispose();};
 Object.assign(wall.proof,{adapter:PROBE_VERSION,sourceFunctionsPreserved:true,exactSurfaceEquivalence:false,gpuVerified:false,samplingSpacingM:spacing,triangles,retainedCPUBytes,estimatedGPUBufferBytes:retainedCPUBytes,peakTemporaryCPUPlusAttachmentBytes:peakTransientBytes,cacheHits,stages,totalBuildMs:performance.now()-start,framePath:'raster geometry + original exact normal + original material/light; no pixel raymarch',bakePath:'19 original-field evaluations/sample including validation; bounded 16-step radial bisection',limitations:[...wall.proof.limitations,'One radial shell: undercuts, disconnected cavities and sub-grid silhouette detail are not represented','Original source normals at interpolated surface positions differ from original exact ray hits','Door caps retain exact solid-occupancy fragment test; surrounding sampled shell may disagree sub-grid','Fixed sampler is not camera LOD; original material and four exact-normal field evaluations per pixel remain expensive','First probe deliberately excludes optional original plaster','Float render attachments are transient runtime numerical buffers, never image textures in a visible material','Whole wall full-detail sampling is measured, not guaranteed suitable startup']});
 return wall;
}
export function buildSurfaceData({kind,lattice,count,sampled,door,center,half}){
 const [positions,meta,seeds]=sampled.attachments,n=lattice.vertexCount,allCaps=[];let capVertices=0;
 for(let inst=0;inst<count;inst++){const i=inst*n*4,c=kind==='brick'?Array.from(meta.subarray(i,i+3)):center,yaw=kind==='brick'?meta[i+3]:0,caps=doorCaps(door,c,rotatedHalf(half,yaw));allCaps.push(caps);capVertices+=caps.length*4;}
 const vertices=n*count+capVertices,output={position:new Float32Array(vertices*3),probeNormal:new Float32Array(vertices*3),probeCap:new Float32Array(vertices),indices:new Uint32Array(lattice.indices.length*count+capVertices/4*6)};
 if(kind==='brick'){output.probeMeta=new Float32Array(vertices*4);output.probeSeed=new Float32Array(vertices*2);}
 let capOffset=n*count,indexOffset=0;
 const write=(i,p,m,s,normal=[0,0,0],cap=0)=>{output.position.set(p,i*3);output.probeNormal.set(normal,i*3);output.probeCap[i]=cap;if(kind==='brick'){output.probeMeta.set(m,i*4);output.probeSeed.set(s,i*2);}};
 for(let inst=0;inst<count;inst++){
  const off=inst*n,src=off*4,m=Array.from(meta.subarray(src,src+4)),seed=Array.from(seeds.subarray(src,src+2));
  for(let v=0;v<n;v++){const q=Array.from(positions.subarray((off+v)*4,(off+v)*4+3));write(off+v,kind==='brick'?rotateToWorld(q,m[3]).map((x,j)=>x+m[j]):q,m,seed);}
  for(const index of lattice.indices)output.indices[indexOffset++]=off+index;
  for(const cap of allCaps[inst]){for(let v=0;v<4;v++)write(capOffset+v,cap.positions.slice(v*3,v*3+3),m,seed,cap.normal,1);for(const index of cap.indices)output.indices[indexOffset++]=capOffset+index;capOffset+=4;}
 }
 output.bytes=Object.values(output).reduce((n,a)=>n+(a?.byteLength||0),0);return output;
}
export function clearR312SurfaceCache(renderer){caches.delete(renderer);}
