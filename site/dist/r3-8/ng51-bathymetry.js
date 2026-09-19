import * as THREE from 'three';

const FLAG=Symbol.for('wenzhou.full-bathymetry-r2-installed');
const META_URL='./data/bathymetry/wenzhou-etopo2022-15s-full.json';
const DATA_URL='./data/bathymetry/wenzhou-etopo2022-15s-full.i16.gz';
const EXPECTED_TILE_HASHES=new Set([
  '1137f43b1420917ed5771aa8cd9acbf9060efa73393d4bc422b7aaca84499df5',
  '5b46d290694fb0b5019b800334c6eb42157fe4fea0bc0b253c54424db924bb70',
]);
const BUILD_BUDGET_MS=8;
const RUNTIME_STRIDE=2;
const DEPTH_STOPS=[[-240,0x0c2742],[-120,0x164c68],[-60,0x246d7b],[-25,0x3d8b88],[-8,0x68a69a],[0,0x8ab9a2]].map(([h,c])=>[h,new THREE.Color(c)]);

function sha(buffer){
  return crypto.subtle.digest('SHA-256',buffer).then(b=>Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,'0')).join(''));
}
async function fetchJson(url){
  const r=await fetch(url);
  if(!r.ok)throw Error(`温州海床 JSON读取失败 (${r.status})`);
  return r.json();
}
async function fetchGzip(url,meta){
  const r=await fetch(url);
  if(!r.ok)throw Error(`温州海床数据读取失败 (${r.status})`);
  if(typeof DecompressionStream==='undefined')throw Error('浏览器缺少 gzip 流解压能力');
  const compressed=await r.arrayBuffer();
  if(compressed.byteLength!==meta.gzipBytes)throw Error(`温州海床压缩长度不符 ${compressed.byteLength} != ${meta.gzipBytes}`);
  if(await sha(compressed)!==meta.gzipSha256)throw Error('温州海床 gzip SHA-256 不一致');
  const body=new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'));
  const raw=await new Response(body).arrayBuffer();
  if(raw.byteLength!==meta.rawBytes)throw Error(`温州海床解压长度不符 ${raw.byteLength} != ${meta.rawBytes}`);
  if(await sha(raw)!==meta.rawSha256)throw Error('温州海床原始栅格 SHA-256 不一致');
  return raw;
}
function littleEndianInt16(buffer){
  const little=new Uint16Array(new Uint8Array([1,0]).buffer)[0]===1;
  if(little)return new Int16Array(buffer);
  const v=new DataView(buffer),out=new Int16Array(buffer.byteLength/2);
  for(let i=0;i<out.length;i++)out[i]=v.getInt16(i*2,true);
  return out;
}
const payloadPromise=(async()=>{
  const meta=await fetchJson(META_URL);
  const hashes=new Set((meta.sourceTiles||[]).map(x=>x.sha256));
  if(meta.schema!=='wenzhou-full-bathymetry-basis/v1'||meta.sourceCrs!=='EPSG:9518'||EXPECTED_TILE_HASHES.size!==hashes.size||![...EXPECTED_TILE_HASHES].every(x=>hashes.has(x)))throw Error('温州海床元数据身份不符');
  if(!String(meta.displayBoundaryPolicy||'').includes('buffered beyond the active terrain window'))throw Error('温州海床缺少外扩边界合同');
  const raw=await fetchGzip(DATA_URL,meta),values=littleEndianInt16(raw),[rows,columns]=meta.shape;
  if(values.length!==rows*columns)throw Error('温州海床栅格尺寸不符');
  return{meta,values};
})();

function utm51(lonDeg,latDeg){
  const a=6378137,f=1/298.257223563,e2=f*(2-f),ep2=e2/(1-e2),k0=.9996,lon0=123*Math.PI/180;
  const lat=latDeg*Math.PI/180,lon=lonDeg*Math.PI/180,s=Math.sin(lat),c=Math.cos(lat),t=Math.tan(lat),N=a/Math.sqrt(1-e2*s*s),T=t*t,C=ep2*c*c,A=c*(lon-lon0),e4=e2*e2,e6=e4*e2;
  const M=a*((1-e2/4-3*e4/64-5*e6/256)*lat-(3*e2/8+3*e4/32+45*e6/1024)*Math.sin(2*lat)+(15*e4/256+45*e6/1024)*Math.sin(4*lat)-(35*e6/3072)*Math.sin(6*lat));
  return[500000+k0*N*(A+(1-T+C)*A**3/6+(5-18*T+T*T+72*C-58*ep2)*A**5/120),k0*(M+N*t*(A*A/2+(5-T+9*C+4*C*C)*A**4/24+(61-58*T+T*T+600*C-330*ep2)*A**6/720))];
}
function landMaskForTerrain(terrain){
  const texture=terrain.userData?.wenzhouMapMotherRefinedAlphaMap;
  const image=texture?.image;
  const box=terrain.userData?.wenzhouMapMotherStrictHistoricalWater?.box||terrain.userData?.wenzhouMapMotherStrictHistoricalIslands?.box;
  if(!image||!box)throw Error('温州海床缺少最终历史海陆 mask 或地形范围');
  const c=document.createElement('canvas');c.width=image.width;c.height=image.height;
  const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(image,0,0);
  return{data:x.getImageData(0,0,c.width,c.height).data,width:c.width,height:c.height,box:box.slice()};
}
function isHistoricalWater(mask,e,n){
  const b=mask.box;
  const px=Math.floor((e-b[0])/(b[2]-b[0])*mask.width),py=Math.floor((b[3]-n)/(b[3]-b[1])*mask.height);
  if(px<0||py<0||px>=mask.width||py>=mask.height)return false;
  return mask.data[(py*mask.width+px)*4+1]<128;
}
function depthColor(h,out){
  const v=Math.min(0,h);let k=1;while(k<DEPTH_STOPS.length-1&&v>DEPTH_STOPS[k][0])k++;
  const a=DEPTH_STOPS[k-1],b=DEPTH_STOPS[k],t=THREE.MathUtils.clamp((v-a[0])/(b[0]-a[0]),0,1);
  return out.copy(a[1]).lerp(b[1],t);
}
async function yieldIfNeeded(state,runIsCurrent){
  const elapsed=performance.now()-state.chunkStart;
  state.maxChunkMs=Math.max(state.maxChunkMs,elapsed);
  if(elapsed<BUILD_BUDGET_MS)return;
  if(!runIsCurrent())throw Error('温州海床构建已被新地形替代');
  state.yieldCount++;await new Promise(r=>setTimeout(r,0));state.chunkStart=performance.now();
}
async function buildGeometry(payload,landMask,runIsCurrent){
  const started=performance.now(),{meta,values}=payload,[sourceRows,sourceColumns]=meta.shape,tr=meta.transform,noData=meta.noData,box=landMask.box;
  const rowIndices=[];for(let r=0;r<sourceRows;r+=RUNTIME_STRIDE)rowIndices.push(r);
  const columnIndices=[];for(let c=0;c<sourceColumns;c+=RUNTIME_STRIDE)columnIndices.push(c);
  const rows=rowIndices.length,columns=columnIndices.length,vertexCount=rows*columns;
  const positions=new Float32Array(vertexCount*3),colors=new Float32Array(vertexCount*3),valid=new Uint8Array(vertexCount),col=new THREE.Color();
  const centerE=(box[0]+box[2])*.5,centerN=(box[1]+box[3])*.5;
  let vp=0,validVertices=0,sourceMinE=Infinity,sourceMinN=Infinity,sourceMaxE=-Infinity,sourceMaxN=-Infinity;
  const work={chunkStart:performance.now(),maxChunkMs:0,yieldCount:0};
  for(let rr=0;rr<rows;rr++){
    const sourceRow=rowIndices[rr],lat=tr[5]+tr[4]*(sourceRow+.5);
    for(let cc=0;cc<columns;cc++){
      const sourceColumn=columnIndices[cc],lon=tr[2]+tr[0]*(sourceColumn+.5),sourceIndex=sourceRow*sourceColumns+sourceColumn,q=rr*columns+cc,h=values[sourceIndex],[e,n]=utm51(lon,lat);
      sourceMinE=Math.min(sourceMinE,e);sourceMinN=Math.min(sourceMinN,n);sourceMaxE=Math.max(sourceMaxE,e);sourceMaxN=Math.max(sourceMaxN,n);
      positions[vp]=(e-centerE)/1000;positions[vp+1]=(h===noData?0:h)/1000;positions[vp+2]=(centerN-n)/1000;
      depthColor(h===noData?0:h,col);colors[vp]=col.r;colors[vp+1]=col.g;colors[vp+2]=col.b;vp+=3;
      if(h!==noData&&h<=0&&isHistoricalWater(landMask,e,n)){valid[q]=1;validVertices++;}
    }
    if((rr&3)===0)await yieldIfNeeded(work,runIsCurrent);
  }
  const sourceProjectedBounds=[sourceMinE,sourceMinN,sourceMaxE,sourceMaxN];
  const sourceBufferM=[box[0]-sourceMinE,box[1]-sourceMinN,sourceMaxE-box[2],sourceMaxN-box[3]].map(x=>Math.round(x));
  const sourceBoundsContainPatch=sourceBufferM.every(x=>x>0);
  if(!sourceBoundsContainPatch)throw Error(`温州海床源范围未包住地形视域 ${sourceBufferM.join(',')}`);
  const maxIndices=(rows-1)*(columns-1)*6,indices=new Uint32Array(maxIndices);let iw=0,waterCells=0;
  for(let r=0;r<rows-1;r++){
    for(let c=0;c<columns-1;c++){
      const a=r*columns+c,b=a+1,d=(r+1)*columns+c,e=d+1;
      if(!(valid[a]&&valid[b]&&valid[d]&&valid[e]))continue;
      indices[iw++]=a;indices[iw++]=d;indices[iw++]=b;indices[iw++]=b;indices[iw++]=d;indices[iw++]=e;waterCells++;
    }
    if((r&7)===0)await yieldIfNeeded(work,runIsCurrent);
  }
  if(!waterCells)throw Error('温州海床未生成历史海域单元');
  work.maxChunkMs=Math.max(work.maxChunkMs,performance.now()-work.chunkStart);
  const finalizeStarted=performance.now(),g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.BufferAttribute(positions,3));g.setAttribute('color',new THREE.BufferAttribute(colors,3));g.setIndex(new THREE.BufferAttribute(indices.subarray(0,iw),1));g.computeVertexNormals();g.computeBoundingSphere();
  return{
    geometry:g,waterCells,validVertices,triangles:iw/3,rows,columns,runtimeStride:RUNTIME_STRIDE,effectiveArcSeconds:15*RUNTIME_STRIDE,
    yieldCount:work.yieldCount,maxChunkMs:+work.maxChunkMs.toFixed(3),geometryFinalizeMs:+(performance.now()-finalizeStarted).toFixed(3),buildMs:+(performance.now()-started).toFixed(3),
    sourceProjectedBounds,sourceBufferM,sourceBoundsContainPatch,
  };
}

export function installNg51Bathymetry(){
  if(window[FLAG])return;window[FLAG]=true;
  let active=null,layer=null,token=0;const canvas=()=>document.getElementById('terrain');
  function dispose(){if(!layer)return;layer.mesh?.parent?.remove(layer.mesh);layer.mesh?.geometry?.dispose();layer.mesh?.material?.dispose();layer=null;}
  window.addEventListener('wenzhou:terrain-added',e=>{const{scene,terrain,patchId}=e.detail||{};if(scene?.isScene&&terrain?.isMesh&&patchId){token++;dispose();active={scene,terrain,patchId};}});
  window.addEventListener('wenzhou:map-mother-1940s-refined',async e=>{
    const run=++token,runIsCurrent=()=>run===token&&active?.patchId===e.detail?.patchId;
    try{
      if(!active||active.patchId!==e.detail?.patchId)return;
      const landMask=landMaskForTerrain(active.terrain),payload=await payloadPromise;if(!runIsCurrent())return;dispose();
      const built=await buildGeometry(payload,landMask,runIsCurrent);if(!runIsCurrent()){built.geometry.dispose();return;}
      const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,metalness:0,side:THREE.FrontSide});
      const mesh=new THREE.Mesh(built.geometry,material);mesh.renderOrder=.8;mesh.userData={wenzhouNg51Bathymetry:true,wenzhouFullBathymetry:true,source:payload.meta.source,sourceCrs:payload.meta.sourceCrs,verticalReference:payload.meta.sourceVerticalReference,truthBoundary:payload.meta.truthBoundary};
      active.scene.add(mesh);layer={mesh};
      const state={
        schema:'wenzhou-full-bathymetry-runtime/v2',ready:true,patchId:active.patchId,source:payload.meta.source,sourceTiles:payload.meta.sourceTiles,sourceCrs:payload.meta.sourceCrs,sourceVerticalReference:payload.meta.sourceVerticalReference,
        sourceShape:payload.meta.shape,runtimeShape:[built.rows,built.columns],runtimeStride:built.runtimeStride,effectiveArcSeconds:built.effectiveArcSeconds,heightRangeM:payload.meta.heightRangeM,
        waterCells:built.waterCells,validVertices:built.validVertices,triangles:built.triangles,buildMs:built.buildMs,yieldCount:built.yieldCount,maxChunkMs:built.maxChunkMs,geometryFinalizeMs:built.geometryFinalizeMs,
        sourceProjectedBounds:built.sourceProjectedBounds,sourceBufferM:built.sourceBufferM,sourceBoundsContainPatch:built.sourceBoundsContainPatch,displayBoundaryPolicy:payload.meta.displayBoundaryPolicy,truthBoundary:payload.meta.truthBoundary,
        registrationGuard:'derived seabed has no alphaMap at scene registration and cannot emit a terrain-added event',cellPolicy:'all four 30 arc-second runtime corners must be at or below 0 m and inside the final historical water mask; uncertain shoreline cells remain unrendered',
        role:'derived broad seabed basis under the final historical water mask; independent of the dynamic sea surface',
      };
      window.__wenzhouNg51Bathymetry=state;window.__wenzhouFullBathymetry=state;
      const c=canvas();if(c){delete c.dataset.ng51BathymetryError;c.dataset.ng51Bathymetry='true';c.dataset.ng51BathymetryCells=String(built.waterCells);c.dataset.ng51BathymetryTriangles=String(built.triangles);c.dataset.ng51BathymetryBuildMs=String(built.buildMs);c.dataset.ng51BathymetrySourceBuffered=String(built.sourceBoundsContainPatch);}
      window.dispatchEvent(new CustomEvent('wenzhou:ng51-bathymetry-ready',{detail:state}));
    }catch(error){window.__wenzhouNg51Bathymetry={ready:false,error:String(error?.message||error)};const c=canvas();if(c)c.dataset.ng51BathymetryError=String(error?.message||error);console.error(error);}
  });
}
