import * as THREE from 'three';

const MANIFEST_URL='../r3-5/data/osm/osm-context.json';
const TERRAIN_URL='../r3-1/data/terrain.json';
const OSM_DATA_BASE=new URL('../r3-5/data/osm/',import.meta.url);
const SOURCE_RELEASE_SHA256='f3ae1c9051b25fc1d23c8df1dd951a9138d6b188b1e46bff56a352c324a90101';
const CORRECTED_REPORT_SHA256='d9a2d7986f74cfd4309174151dbc36920e188080f4c1daf21ae865efa3dd4364';
const FLAG=Symbol.for('wenzhou.r3.6.osm-runtime-installed');
const ROAD_LIFT_M=0.18;
const BUILDING_LIFT_M=0.14;
const CPU_YIELD_BUDGET_MS=6;
const CPU_CHECK_INTERVAL=2048;
const PAYLOAD_CACHE_LIMIT=2;
let fetchAbortCount=0;

function abortError(message='aborted'){try{return new DOMException(message,'AbortError');}catch{return Object.assign(new Error(message),{name:'AbortError'});}}
function throwIfAborted(signal){if(signal?.aborted)throw abortError(typeof signal.reason==='string'?signal.reason:'superseded');}
function isAbort(error){return error?.name==='AbortError';}
function fetchJson(url){return fetch(url).then(r=>{if(!r.ok)throw Error(`R3.6 JSON读取失败 (${r.status})`);return r.json();});}
async function checkedBytes(url,expectedSha,expectedBytes,signal){
  throwIfAborted(signal);let r;
  try{r=await fetch(url,{signal});}catch(error){if(isAbort(error))fetchAbortCount++;throw error;}
  if(!r.ok)throw Error(`R3.6 对象证据读取失败 (${r.status})`);let b;
  try{b=await r.arrayBuffer();}catch(error){if(isAbort(error))fetchAbortCount++;throw error;}
  throwIfAborted(signal);
  if(b.byteLength!==expectedBytes)throw Error(`R3.6 对象证据字节数不一致 ${b.byteLength} != ${expectedBytes}`);
  if(!crypto.subtle)throw Error('当前浏览器不能执行 R3.6 SHA-256 证据校验');
  const actual=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),v=>v.toString(16).padStart(2,'0')).join('');
  throwIfAborted(signal);if(actual!==expectedSha)throw Error(`R3.6 对象证据 SHA-256 不一致: ${actual}`);return b;
}
function evidenceUrl(item){return new URL(item.path.split('/').at(-1),OSM_DATA_BASE);}
function terrainOrigin(contract,patch){
  const t=contract.source.transform,east=col=>t[2]+t[0]*(col+.5),north=row=>t[5]+t[4]*(row+.5);
  const e0=east(patch.columnIndices[0]),e1=east(patch.columnIndices.at(-1)),n0=north(patch.rowIndices[0]),n1=north(patch.rowIndices.at(-1));
  return[(e0+e1)/2,(n0+n1)/2];
}
function isTerrainCandidate(object){return !!(object?.isMesh&&!object.userData?.wenzhouSeaDemo&&!object.userData?.wenzhouSurfaceEvidence&&!object.userData?.wenzhouLandcoverEvidence&&!object.userData?.wenzhouOsmEvidence&&object.material?.alphaMap&&object.geometry?.attributes?.position);}
function lowerCell(values,v){
  if(values.length<2||v<values[0]||v>values.at(-1))return-1;let lo=0,hi=values.length-1;
  while(hi-lo>1){const m=(lo+hi)>>1;if(values[m]<=v)lo=m;else hi=m;}return Math.min(values.length-2,Math.max(0,lo));
}
function axisLocator(values){
  const n=values.length,first=values[0],last=values[n-1],step=n>1?values[1]-first:0,tol=Math.max(1e-8,Math.abs(step)*2e-5);let regular=n>=2&&step>0;
  if(regular){for(let i=1;i<n-2;i++){if(Math.abs((values[i+1]-values[i])-step)>tol){regular=false;break;}}}
  if(regular&&n>2){const tail=values[n-1]-values[n-2];if(!(tail>0&&tail<=step+tol))regular=false;}
  function locate(v){
    if(v<first||v>last)return-1;if(!regular)return lowerCell(values,v);
    let i=Math.floor((v-first)/step);if(i<0)i=0;if(i>=n-1)i=n-2;
    if(i>0&&v<values[i])i--;else if(i<n-2&&v>=values[i+1])i++;
    return i;
  }
  return{locate,regular,step};
}
function terrainSampler(terrain){
  const pos=terrain.geometry?.attributes?.position,index=terrain.geometry?.index;if(!pos||!index)throw Error('R3.6 无法建立显示曲面锚定：地形缺少 position/index');
  const pa=pos.array,itemSize=pos.itemSize,count=pos.count,z0=pa[2];let nc=1;
  while(nc<count&&Math.abs(pa[nc*itemSize+2]-z0)<1e-8)nc++;
  if(nc<2||count%nc!==0)throw Error('R3.6 无法识别规则地形网格');
  const nr=count/nc,xs=new Float64Array(nc),zs=new Float64Array(nr);
  for(let i=0;i<nc;i++)xs[i]=pa[i*itemSize];for(let j=0;j<nr;j++)zs[j]=pa[(j*nc)*itemSize+2];
  const xloc=axisLocator(xs),zloc=axisLocator(zs),valid=new Uint8Array((nr-1)*(nc-1)),ia=index.array;
  for(let k=0;k+5<ia.length;k+=6){const a=Number(ia[k]),j=Math.floor(a/nc),i=a-j*nc;if(i>=0&&i<nc-1&&j>=0&&j<nr-1)valid[j*(nc-1)+i]=1;}
  const scaleY=terrain.scale?.y??1;
  function sample(x,z){
    const i=xloc.locate(x),j=zloc.locate(z);if(i<0||j<0||!valid[j*(nc-1)+i])return null;
    const x0=xs[i],x1=xs[i+1],z0v=zs[j],z1=zs[j+1];if(x1===x0||z1===z0v)return null;
    const u=(x-x0)/(x1-x0),v=(z-z0v)/(z1-z0v),row0=j*nc,row1=(j+1)*nc;
    const a=pa[(row0+i)*itemSize+1]*scaleY,b=pa[(row0+i+1)*itemSize+1]*scaleY,c=pa[(row1+i)*itemSize+1]*scaleY,d=pa[(row1+i+1)*itemSize+1]*scaleY;
    return u+v<=1?a+(b-a)*u+(c-a)*v:d+(c-d)*(1-u)+(b-d)*(1-v);
  }
  let validCellCount=0;for(let i=0;i<valid.length;i++)validCellCount+=valid[i];
  return{sample,nc,nr,validCellCount,mode:xloc.regular&&zloc.regular?'regular-o1-with-boundary-correction':'binary-fallback',stepX:xloc.step,stepZ:zloc.step};
}
function roadColor(code,flags){if(flags&1)return[.97,.77,.33];if(flags&2)return[.46,.69,.82];if(code<=4)return[.95,.61,.28];if(code<=10)return[.91,.78,.48];if(code===11||code===12)return[.82,.76,.67];if(code===13||code===14)return[.66,.65,.61];return[.55,.68,.55];}
function maxSegmentCount(parts){let n=0;for(let p=0;p<parts.length;p+=4)n+=Math.max(0,Number(parts[p+1])-1);return n;}
function cpuState(){return{chunkStart:performance.now(),maxChunkMs:0,yieldCount:0,processed:0};}
async function maybeYield(state,signal){
  throwIfAborted(signal);const now=performance.now(),chunk=now-state.chunkStart;state.maxChunkMs=Math.max(state.maxChunkMs,chunk);
  if(chunk>=CPU_YIELD_BUDGET_MS){state.yieldCount++;await new Promise(r=>setTimeout(r,0));throwIfAborted(signal);state.chunkStart=performance.now();}
}
function finishCpu(state,signal){throwIfAborted(signal);state.maxChunkMs=Math.max(state.maxChunkMs,performance.now()-state.chunkStart);return state;}

async function buildIndexedRoads(xy,parts,meta,origin,sampler,signal){
  if(parts.length%4)throw Error('R3.6 road parts 格式错误');const t0=performance.now(),vertexCount=xy.length/2;
  const positions=new Float32Array(vertexCount*3),colors=new Float32Array(vertexCount*3),valid=new Uint8Array(vertexCount),maxSegments=maxSegmentCount(parts),IndexType=vertexCount<=65535?Uint16Array:Uint32Array,indices=new IndexType(maxSegments*2);
  let iw=0,drawnParts=0,drawnSegments=0,rejectedSegments=0,sampleCalls=0;const cpu=cpuState(),west=meta.bounds[0],south=meta.bounds[1],sx=(meta.bounds[2]-west)/65535,sy=(meta.bounds[3]-south)/65535;
  for(let p=0;p<parts.length;p+=4){
    throwIfAborted(signal);const start=Number(parts[p]),count=Number(parts[p+1]),code=Number(parts[p+2]),flags=Number(parts[p+3]);if(count<2)continue;const color=roadColor(code,flags);let partDrawn=false;
    for(let j=0;j<count;j++){
      const vi=start+j,a2=vi*2;if(a2+1>=xy.length)throw Error('R3.6 road xy 索引越界');
      const e=west+xy[a2]*sx,n=south+xy[a2+1]*sy,x=(e-origin[0])/1000,z=(origin[1]-n)/1000,h=sampler.sample(x,z);sampleCalls++;
      const q=vi*3;positions[q]=x;positions[q+2]=z;colors[q]=color[0];colors[q+1]=color[1];colors[q+2]=color[2];if(h!==null){positions[q+1]=h+ROAD_LIFT_M/1000;valid[vi]=1;}
      if(++cpu.processed>=CPU_CHECK_INTERVAL){cpu.processed=0;await maybeYield(cpu,signal);}
    }
    for(let j=0;j<count-1;j++){const a=start+j,b=a+1;if(valid[a]&&valid[b]){indices[iw++]=a;indices[iw++]=b;drawnSegments++;partDrawn=true;}else rejectedSegments++;}if(partDrawn)drawnParts++;
  }
  finishCpu(cpu,signal);const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(positions,3));g.setAttribute('color',new THREE.BufferAttribute(colors,3));g.setIndex(new THREE.BufferAttribute(indices.subarray(0,iw),1));
  const m=new THREE.LineBasicMaterial({vertexColors:true,transparent:true,opacity:.78,depthWrite:false}),line=new THREE.LineSegments(g,m);line.frustumCulled=false;line.renderOrder=2.5;line.userData.wenzhouOsmEvidence=true;line.userData.kind='osm-road-centerline-evidence';line.userData.heightClaim='display-surface-anchor-only';line.userData.physicalWidthClaim='none';line.userData.runtime='indexed-r36';
  return{object:line,drawnParts,drawnSegments,rejectedSegments,sourceVertexCount:vertexCount,gpuVertexCount:vertexCount,gpuIndexCount:iw,sampleCalls,indexType:IndexType===Uint16Array?'uint16':'uint32',buildMs:performance.now()-t0,maxChunkMs:cpu.maxChunkMs,yieldCount:cpu.yieldCount};
}
async function buildIndexedBuildings(xy,parts,meta,origin,sampler,signal){
  if(parts.length%4)throw Error('R3.6 building parts 格式错误');const t0=performance.now(),vertexCount=xy.length/2;
  const positions=new Float32Array(vertexCount*3),valid=new Uint8Array(vertexCount),maxSegments=maxSegmentCount(parts),IndexType=vertexCount<=65535?Uint16Array:Uint32Array,indices=new IndexType(maxSegments*2);
  let iw=0,drawnBoundaryParts=0,drawnSegments=0,rejectedSegments=0,sampleCalls=0;const cpu=cpuState(),west=meta.bounds[0],south=meta.bounds[1],sx=(meta.bounds[2]-west)/65535,sy=(meta.bounds[3]-south)/65535;
  for(let p=0;p<parts.length;p+=4){
    throwIfAborted(signal);const start=Number(parts[p]),count=Number(parts[p+1]);if(count<2)continue;let partDrawn=false;
    for(let j=0;j<count;j++){
      const vi=start+j,a2=vi*2;if(a2+1>=xy.length)throw Error('R3.6 building xy 索引越界');
      const e=west+xy[a2]*sx,n=south+xy[a2+1]*sy,x=(e-origin[0])/1000,z=(origin[1]-n)/1000,h=sampler.sample(x,z);sampleCalls++;
      const q=vi*3;positions[q]=x;positions[q+2]=z;if(h!==null){positions[q+1]=h+BUILDING_LIFT_M/1000;valid[vi]=1;}
      if(++cpu.processed>=CPU_CHECK_INTERVAL){cpu.processed=0;await maybeYield(cpu,signal);}
    }
    for(let j=0;j<count-1;j++){const a=start+j,b=a+1;if(valid[a]&&valid[b]){indices[iw++]=a;indices[iw++]=b;drawnSegments++;partDrawn=true;}else rejectedSegments++;}if(partDrawn)drawnBoundaryParts++;
  }
  finishCpu(cpu,signal);const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(positions,3));g.setIndex(new THREE.BufferAttribute(indices.subarray(0,iw),1));
  const m=new THREE.LineBasicMaterial({color:0xe3d3bd,transparent:true,opacity:.6,depthWrite:false}),line=new THREE.LineSegments(g,m);line.frustumCulled=false;line.renderOrder=2.4;line.userData.wenzhouOsmEvidence=true;line.userData.kind='osm-building-footprint-boundary-evidence';line.userData.heightClaim='unknown-not-generated';line.userData.extrusionClaim='none';line.userData.syntheticPatchClosure=false;line.userData.runtime='indexed-r36';
  return{object:line,drawnBoundaryParts,drawnSegments,rejectedSegments,sourceVertexCount:vertexCount,gpuVertexCount:vertexCount,gpuIndexCount:iw,sampleCalls,indexType:IndexType===Uint16Array?'uint16':'uint32',buildMs:performance.now()-t0,maxChunkMs:cpu.maxChunkMs,yieldCount:cpu.yieldCount};
}

export function installOptimizedOsmRuntime(){
  if(THREE.Object3D.prototype[FLAG])return;THREE.Object3D.prototype[FLAG]=true;const originalAdd=THREE.Object3D.prototype.add;
  const manifestPromise=fetchJson(MANIFEST_URL).then(m=>{if(m.schema!=='wenzhou-r3.5-osm-browser-bundle/r2'||m.sourceReleaseAssetSha256!==SOURCE_RELEASE_SHA256||m.sourceCorrectedReportSha256!==CORRECTED_REPORT_SHA256||m.sourceIdentity!=='external_mapped_observation'||m.canonicalTruth!==false||m.surveyGradeGeometry!==false||m.individualPhysicalTruth!==false||m.productionReady!==false||!m.buildingPolicy?.includes('before clipping')||!m.buildingPolicy?.includes('synthetic closure'))throw Error('R3.6 inherited OSM manifest evidence boundary mismatch');return m;});
  const contractPromise=fetchJson(TERRAIN_URL),payloadCache=new Map();let active=null,activeRenderer=null,activeScene=null,activeCamera=null,buildToken=0,currentController=null,abortCount=0,cacheHits=0,cacheMisses=0;
  const canvas=()=>document.getElementById('terrain');
  function setDataset(values){const c=canvas();if(!c)return;for(const[k,v]of Object.entries(values)){if(v===null||v===undefined)delete c.dataset[k];else c.dataset[k]=String(v);}}
  function forceRender(){if(activeRenderer&&activeScene&&activeCamera)activeRenderer.render(activeScene,activeCamera);}
  function captureRenderer(terrain,scene){const prior=terrain.onAfterRender;terrain.onAfterRender=function(renderer,renderScene,camera,...rest){activeRenderer=renderer;activeScene=scene;activeCamera=camera;if(typeof prior==='function')prior.call(this,renderer,renderScene,camera,...rest);};}
  function disposeActive(){if(!active)return;for(const object of[active.roads?.object,active.buildings?.object])if(object){active.scene.remove(object);object.geometry?.dispose();object.material?.dispose();}active=null;}
  function updateCard(meta,roads,buildings,totalBuildMs){const card=document.getElementById('osm-card');if(!card)return;card.hidden=false;document.getElementById('osm-title').textContent='OpenStreetMap · R3.6 索引化映射证据';document.getElementById('osm-status').textContent=`${meta.id} · 道路 ${roads?.drawnSegments?.toLocaleString?.()||0} 段 · 建筑 ${buildings?.drawnSegments?.toLocaleString?.()||0} 段 · 构建 ${totalBuildMs.toFixed(1)} ms`;document.getElementById('osm-road-count').textContent=`道路顶点 ${roads.sourceVertexCount.toLocaleString()} · index ${roads.gpuIndexCount.toLocaleString()}`;document.getElementById('osm-building-count').textContent=meta.id==='overview'?'全域不载入建筑':`建筑顶点 ${(buildings?.sourceVertexCount||0).toLocaleString()} · index ${(buildings?.gpuIndexCount||0).toLocaleString()}`;document.getElementById('osm-source').textContent='证据与 R3.5 完全相同；R3.6 只改变运行时组织：每个源顶点采样/上传一次，index 连边，过时请求可取消。道路线宽仍非物理宽度，建筑仍无生成高度。';}
  function hideCard(){const card=document.getElementById('osm-card');if(card)card.hidden=true;}
  function touchCache(key,value){if(payloadCache.has(key))payloadCache.delete(key);payloadCache.set(key,value);while(payloadCache.size>PAYLOAD_CACHE_LIMIT){const oldest=payloadCache.keys().next().value;payloadCache.delete(oldest);}}
  async function typedFile(item,Type,signal){const b=await checkedBytes(evidenceUrl(item),item.sha256,item.bytes,signal);return new Type(b);}
  async function loadPayload(meta,signal){const cached=payloadCache.get(meta.id);if(cached){cacheHits++;touchCache(meta.id,cached);return cached;}cacheMisses++;const f=meta.files,tasks=[typedFile(f.roadXY,Uint16Array,signal),typedFile(f.roadParts,Uint32Array,signal)];if(f.buildingXY&&f.buildingParts)tasks.push(typedFile(f.buildingXY,Uint16Array,signal),typedFile(f.buildingParts,Uint32Array,signal));const values=await Promise.all(tasks);throwIfAborted(signal);const payload={roadXY:values[0],roadParts:values[1],buildingXY:values[2]||null,buildingParts:values[3]||null};touchCache(meta.id,payload);return payload;}
  async function buildForTerrain(scene,terrain){
    const token=++buildToken;if(currentController&&!currentController.signal.aborted){currentController.abort('superseded-view');abortCount++;}const controller=new AbortController(),signal=controller.signal;currentController=controller;disposeActive();captureRenderer(terrain,scene);let patchId='';const buildStart=performance.now();
    try{
      await new Promise(resolve=>requestAnimationFrame(resolve));throwIfAborted(signal);if(token!==buildToken)throw abortError('superseded-token');patchId=canvas()?.dataset.patch||document.getElementById('location')?.value||'';
      setDataset({osmRuntime:'indexed-r36',osmIndexed:true,osmLoading:true,osmLoaded:false,osmPatch:patchId,osmAbortController:true,osmAbortCount:abortCount,osmFetchAbortCount:fetchAbortCount,osmError:null});
      const[manifest,contract]=await Promise.all([manifestPromise,contractPromise]);throwIfAborted(signal);if(token!==buildToken)throw abortError('superseded-token');const meta=manifest.patches.find(p=>p.id===patchId),patch=contract.patches.find(p=>p.id===patchId);if(!meta||!patch)throw Error(`R3.6 缺少 OSM 视域 ${patchId}`);if(meta.buildings?.sourceMultiPolygonBoundaryOnly!==true||meta.buildings?.clippingCreatesPatchClosure!==false||meta.buildings?.heightClaim!=='unknown-not-generated')throw Error(`R3.6 ${patchId} 建筑证据边界不一致`);
      const payload=await loadPayload(meta,signal);throwIfAborted(signal);if(token!==buildToken)throw abortError('superseded-token');const sampler=terrainSampler(terrain),origin=terrainOrigin(contract,patch),roads=await buildIndexedRoads(payload.roadXY,payload.roadParts,meta,origin,sampler,signal);throwIfAborted(signal);let buildings=null;if(payload.buildingXY?.length&&payload.buildingParts?.length)buildings=await buildIndexedBuildings(payload.buildingXY,payload.buildingParts,meta,origin,sampler,signal);throwIfAborted(signal);if(token!==buildToken)throw abortError('superseded-token');
      const roadToggle=document.getElementById('show-osm-roads'),buildingToggle=document.getElementById('show-osm-buildings');roads.object.visible=roadToggle?.checked??true;originalAdd.call(scene,roads.object);if(buildings){buildings.object.visible=buildingToggle?.checked??true;originalAdd.call(scene,buildings.object);}const totalBuildMs=performance.now()-buildStart,maxChunkMs=Math.max(roads.maxChunkMs,buildings?.maxChunkMs||0),yieldCount=roads.yieldCount+(buildings?.yieldCount||0);active={scene,roads,buildings,meta,terrainUuid:terrain.uuid};updateCard(meta,roads,buildings,totalBuildMs);
      setDataset({osmKind:'external-mapped-observation',osmPatch:patchId,osmRoadsVisible:roads.object.visible,osmBuildingsVisible:!!buildings&&buildings.object.visible,osmRoadParts:meta.roads.partCount,osmRoadSegmentsDrawn:roads.drawnSegments,osmRoadSegmentsRejectedNoSurface:roads.rejectedSegments,osmBuildingBoundaryParts:meta.buildings.boundaryPartCount,osmBuildingSegmentsDrawn:buildings?.drawnSegments||0,osmBuildingSegmentsRejectedNoSurface:buildings?.rejectedSegments||0,osmBuildingSyntheticPatchClosure:false,osmRoadWidthClaim:'none-screen-style-only',osmBuildingHeightClaim:'unknown-not-generated',osmSurfaceAnchor:'current-display-triangles',osmSourceReleaseSha256:SOURCE_RELEASE_SHA256,osmCorrectedReportSha256:CORRECTED_REPORT_SHA256,osmQuantizationMaxStepM:meta.quantization.maxStepM,osmRuntime:'indexed-r36',osmIndexed:true,osmAbortController:true,osmAbortCount:abortCount,osmFetchAbortCount:fetchAbortCount,osmCacheHits:cacheHits,osmCacheMisses:cacheMisses,osmBuildMs:totalBuildMs.toFixed(3),osmMaxChunkMs:maxChunkMs.toFixed(3),osmYieldCount:yieldCount,osmSamplerMode:sampler.mode,osmSamplerStepX:sampler.stepX,osmSamplerStepZ:sampler.stepZ,osmRoadSourceVertices:roads.sourceVertexCount,osmRoadGpuVertices:roads.gpuVertexCount,osmRoadGpuIndexCount:roads.gpuIndexCount,osmRoadSampleCalls:roads.sampleCalls,osmRoadIndexType:roads.indexType,osmBuildingSourceVertices:buildings?.sourceVertexCount||0,osmBuildingGpuVertices:buildings?.gpuVertexCount||0,osmBuildingGpuIndexCount:buildings?.gpuIndexCount||0,osmBuildingSampleCalls:buildings?.sampleCalls||0,osmBuildingIndexType:buildings?.indexType||'none',osmLoading:false,osmLoaded:true,osmError:null});if(currentController===controller)currentController=null;forceRender();
    }catch(error){if(isAbort(error)){if(token===buildToken)setDataset({osmLoading:false,osmLoaded:false,osmAbortCount:abortCount,osmFetchAbortCount:fetchAbortCount});return;}if(token!==buildToken)return;disposeActive();hideCard();if(currentController===controller)currentController=null;setDataset({osmKind:'error',osmPatch:patchId,osmLoading:false,osmLoaded:false,osmAbortCount:abortCount,osmFetchAbortCount:fetchAbortCount,osmError:error.message});console.error(error);}
  }
  THREE.Object3D.prototype.add=function(...objects){const result=originalAdd.apply(this,objects);if(this.isScene)for(const object of objects)if(isTerrainCandidate(object)){void buildForTerrain(this,object);break;}return result;};
  const roadToggle=document.getElementById('show-osm-roads');if(roadToggle&&!roadToggle.dataset.boundOsm){roadToggle.dataset.boundOsm='true';roadToggle.addEventListener('change',()=>{if(active)active.roads.object.visible=roadToggle.checked;setDataset({osmRoadsVisible:!!active&&roadToggle.checked});forceRender();});}
  const buildingToggle=document.getElementById('show-osm-buildings');if(buildingToggle&&!buildingToggle.dataset.boundOsm){buildingToggle.dataset.boundOsm='true';buildingToggle.addEventListener('change',()=>{if(active?.buildings)active.buildings.object.visible=buildingToggle.checked;setDataset({osmBuildingsVisible:!!active?.buildings&&buildingToggle.checked});forceRender();});}
}
