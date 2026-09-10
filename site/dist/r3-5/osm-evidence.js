import * as THREE from 'three';

const MANIFEST_URL='./data/osm/osm-context.json';
const TERRAIN_URL='../r3-1/data/terrain.json';
const SOURCE_RELEASE_SHA256='f3ae1c9051b25fc1d23c8df1dd951a9138d6b188b1e46bff56a352c324a90101';
const CORRECTED_REPORT_SHA256='d9a2d7986f74cfd4309174151dbc36920e188080f4c1daf21ae865efa3dd4364';
const FLAG=Symbol.for('wenzhou.r3.5.osm-evidence-installed');
const ROAD_LIFT_M=0.18;
const BUILDING_LIFT_M=0.14;

function fetchJson(url){return fetch(url).then(r=>{if(!r.ok)throw Error(`R3.5 JSON读取失败 (${r.status})`);return r.json();});}
async function checkedBytes(url,expectedSha,expectedBytes){
  const r=await fetch(url);if(!r.ok)throw Error(`R3.5 对象证据读取失败 (${r.status})`);
  const b=await r.arrayBuffer();
  if(b.byteLength!==expectedBytes)throw Error(`R3.5 对象证据字节数不一致 ${b.byteLength} != ${expectedBytes}`);
  if(!crypto.subtle)throw Error('当前浏览器不能执行 R3.5 SHA-256 证据校验');
  const actual=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),v=>v.toString(16).padStart(2,'0')).join('');
  if(actual!==expectedSha)throw Error(`R3.5 对象证据 SHA-256 不一致: ${actual}`);
  return b;
}
function terrainOrigin(contract,patch){
  const t=contract.source.transform;
  const east=col=>t[2]+t[0]*(col+.5),north=row=>t[5]+t[4]*(row+.5);
  const e0=east(patch.columnIndices[0]),e1=east(patch.columnIndices.at(-1));
  const n0=north(patch.rowIndices[0]),n1=north(patch.rowIndices.at(-1));
  return[(e0+e1)/2,(n0+n1)/2];
}
function isTerrainCandidate(object){
  return !!(object?.isMesh&&!object.userData?.wenzhouSeaDemo&&!object.userData?.wenzhouSurfaceEvidence&&!object.userData?.wenzhouLandcoverEvidence&&!object.userData?.wenzhouOsmEvidence&&object.material?.alphaMap&&object.geometry?.attributes?.position);
}
function lowerCell(values,v){
  if(values.length<2||v<values[0]||v>values.at(-1))return -1;
  let lo=0,hi=values.length-1;
  while(hi-lo>1){const m=(lo+hi)>>1;if(values[m]<=v)lo=m;else hi=m;}
  return Math.min(values.length-2,Math.max(0,lo));
}
function terrainSampler(terrain){
  const pos=terrain.geometry?.attributes?.position,index=terrain.geometry?.index;
  if(!pos||!index)throw Error('R3.5 无法建立显示曲面锚定：地形缺少 position/index');
  const count=pos.count,z0=pos.getZ(0);let nc=1;
  while(nc<count&&Math.abs(pos.getZ(nc)-z0)<1e-8)nc++;
  if(nc<2||count%nc!==0)throw Error('R3.5 无法识别规则地形网格');
  const nr=count/nc,xs=Array.from({length:nc},(_,i)=>pos.getX(i)),zs=Array.from({length:nr},(_,j)=>pos.getZ(j*nc));
  const valid=new Uint8Array((nr-1)*(nc-1));
  const arr=index.array;
  for(let k=0;k+5<arr.length;k+=6){const a=Number(arr[k]);const j=Math.floor(a/nc),i=a-j*nc;if(i>=0&&i<nc-1&&j>=0&&j<nr-1)valid[j*(nc-1)+i]=1;}
  const sy=terrain.scale?.y??1;
  function sample(x,z){
    const i=lowerCell(xs,x),j=lowerCell(zs,z);if(i<0||j<0||!valid[j*(nc-1)+i])return null;
    const x0=xs[i],x1=xs[i+1],zz0=zs[j],zz1=zs[j+1];if(x1===x0||zz1===zz0)return null;
    const u=(x-x0)/(x1-x0),v=(z-zz0)/(zz1-zz0);
    const a=pos.getY(j*nc+i)*sy,b=pos.getY(j*nc+i+1)*sy,c=pos.getY((j+1)*nc+i)*sy,d=pos.getY((j+1)*nc+i+1)*sy;
    return u+v<=1?a+(b-a)*u+(c-a)*v:d+(c-d)*(1-u)+(b-d)*(1-v);
  }
  return{sample,nc,nr,validCellCount:valid.reduce((s,v)=>s+v,0)};
}
function decodeProjected(qx,qy,bounds){
  const[west,south,east,north]=bounds;
  return[west+(qx/65535)*(east-west),south+(qy/65535)*(north-south)];
}
function roadColor(code,flags){
  if(flags&1)return[.97,.77,.33];
  if(flags&2)return[.46,.69,.82];
  if(code<=4)return[.95,.61,.28];
  if(code<=10)return[.91,.78,.48];
  if(code===11||code===12)return[.82,.76,.67];
  if(code===13||code===14)return[.66,.65,.61];
  return[.55,.68,.55];
}
function makeRoadSegments(xy,parts,meta,origin,sampler){
  if(parts.length%4)throw Error('R3.5 road parts 格式错误');
  const positions=[],colors=[];let drawnParts=0,drawnSegments=0,rejectedSegments=0;
  for(let p=0;p<parts.length;p+=4){
    const start=parts[p],count=parts[p+1],code=parts[p+2],flags=parts[p+3];if(count<2)continue;
    const color=roadColor(code,flags);let partDrawn=false;
    for(let i=0;i<count-1;i++){
      const a=(start+i)*2,b=(start+i+1)*2;
      if(b+1>=xy.length)throw Error('R3.5 road xy 索引越界');
      const[e0,n0]=decodeProjected(xy[a],xy[a+1],meta.bounds),[e1,n1]=decodeProjected(xy[b],xy[b+1],meta.bounds);
      const x0=(e0-origin[0])/1000,z0=(origin[1]-n0)/1000,x1=(e1-origin[0])/1000,z1=(origin[1]-n1)/1000;
      const h0=sampler.sample(x0,z0),h1=sampler.sample(x1,z1);
      if(h0===null||h1===null){rejectedSegments++;continue;}
      positions.push(x0,h0+ROAD_LIFT_M/1000,z0,x1,h1+ROAD_LIFT_M/1000,z1);
      colors.push(...color,...color);drawnSegments++;partDrawn=true;
    }
    if(partDrawn)drawnParts++;
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.computeBoundingSphere();
  const m=new THREE.LineBasicMaterial({vertexColors:true,transparent:true,opacity:.78,depthWrite:false});
  const line=new THREE.LineSegments(g,m);line.renderOrder=2.5;line.userData.wenzhouOsmEvidence=true;line.userData.kind='osm-road-centerline-evidence';line.userData.heightClaim='display-surface-anchor-only';line.userData.physicalWidthClaim='none';
  return{object:line,drawnParts,drawnSegments,rejectedSegments};
}
function makeBuildingSegments(xy,parts,meta,origin,sampler){
  if(parts.length%4)throw Error('R3.5 building parts 格式错误');
  const positions=[];let drawnBoundaryParts=0,drawnSegments=0,rejectedSegments=0;
  for(let p=0;p<parts.length;p+=4){
    const start=parts[p],count=parts[p+1];if(count<2)continue;let partDrawn=false;
    for(let i=0;i<count-1;i++){
      const a=(start+i)*2,b=(start+i+1)*2;if(b+1>=xy.length)throw Error('R3.5 building xy 索引越界');
      const[e0,n0]=decodeProjected(xy[a],xy[a+1],meta.bounds),[e1,n1]=decodeProjected(xy[b],xy[b+1],meta.bounds);
      const x0=(e0-origin[0])/1000,z0=(origin[1]-n0)/1000,x1=(e1-origin[0])/1000,z1=(origin[1]-n1)/1000;
      const h0=sampler.sample(x0,z0),h1=sampler.sample(x1,z1);if(h0===null||h1===null){rejectedSegments++;continue;}
      positions.push(x0,h0+BUILDING_LIFT_M/1000,z0,x1,h1+BUILDING_LIFT_M/1000,z1);drawnSegments++;partDrawn=true;
    }
    if(partDrawn)drawnBoundaryParts++;
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.computeBoundingSphere();
  const m=new THREE.LineBasicMaterial({color:0xe3d3bd,transparent:true,opacity:.6,depthWrite:false});
  const line=new THREE.LineSegments(g,m);line.renderOrder=2.4;line.userData.wenzhouOsmEvidence=true;line.userData.kind='osm-building-footprint-boundary-evidence';line.userData.heightClaim='unknown-not-generated';line.userData.extrusionClaim='none';line.userData.syntheticPatchClosure=false;
  return{object:line,drawnBoundaryParts,drawnSegments,rejectedSegments};
}

export function installOsmObjectEvidence(){
  if(THREE.Object3D.prototype[FLAG])return;
  THREE.Object3D.prototype[FLAG]=true;
  const originalAdd=THREE.Object3D.prototype.add;
  const manifestPromise=fetchJson(MANIFEST_URL).then(m=>{
    if(m.schema!=='wenzhou-r3.5-osm-browser-bundle/r2'||m.sourceReleaseAssetSha256!==SOURCE_RELEASE_SHA256||m.sourceCorrectedReportSha256!==CORRECTED_REPORT_SHA256||m.sourceIdentity!=='external_mapped_observation'||m.canonicalTruth!==false||m.surveyGradeGeometry!==false||m.individualPhysicalTruth!==false||m.productionReady!==false||!m.buildingPolicy?.includes('before clipping')||!m.buildingPolicy?.includes('synthetic closure'))throw Error('R3.5 OSM manifest evidence boundary mismatch');
    return m;
  });
  const contractPromise=fetchJson(TERRAIN_URL);
  let active=null,activeRenderer=null,activeScene=null,activeCamera=null,buildToken=0;
  const canvas=()=>document.getElementById('terrain');
  function setDataset(values){const c=canvas();if(!c)return;for(const[k,v]of Object.entries(values)){if(v===null||v===undefined)delete c.dataset[k];else c.dataset[k]=String(v);}}
  function forceRender(){if(activeRenderer&&activeScene&&activeCamera)activeRenderer.render(activeScene,activeCamera);}
  function captureRenderer(terrain,scene){const prior=terrain.onAfterRender;terrain.onAfterRender=function(renderer,renderScene,camera,...rest){activeRenderer=renderer;activeScene=scene;activeCamera=camera;if(typeof prior==='function')prior.call(this,renderer,renderScene,camera,...rest);};}
  function dispose(){if(!active)return;for(const object of[active.roads?.object,active.buildings?.object])if(object){active.scene.remove(object);object.geometry?.dispose();object.material?.dispose();}active=null;}
  function updateCard(meta,roads,buildings){
    const card=document.getElementById('osm-card');if(!card)return;card.hidden=false;
    document.getElementById('osm-title').textContent='OpenStreetMap · 道路/建筑映射证据';
    document.getElementById('osm-status').textContent=`${meta.id} · 道路线段 ${roads?.drawnSegments?.toLocaleString?.()||0} · 建筑真实边界段 ${buildings?.drawnSegments?.toLocaleString?.()||0}`;
    document.getElementById('osm-road-count').textContent=`中心线 parts ${meta.roads.partCount.toLocaleString()}`;
    document.getElementById('osm-building-count').textContent=meta.id==='overview'?'全域不载入建筑':`boundary parts ${meta.buildings.boundaryPartCount.toLocaleString()}`;
    document.getElementById('osm-source').textContent='道路屏幕线宽不代表物理宽度；建筑只画源 MultiPolygon 的真实 boundary，先取边界再裁视域，不生成 patch 闭合假边，也不生成高度。© OpenStreetMap contributors · ODbL';
  }
  function hideCard(){const card=document.getElementById('osm-card');if(card)card.hidden=true;}
  async function fileArray(item,Type){const b=await checkedBytes(new URL(item.path,import.meta.url),item.sha256,item.bytes);return new Type(b);}
  async function buildForTerrain(scene,terrain){
    const token=++buildToken;captureRenderer(terrain,scene);await new Promise(resolve=>requestAnimationFrame(resolve));
    const patchId=canvas()?.dataset.patch||document.getElementById('location')?.value||'';
    try{
      const[manifest,contract]=await Promise.all([manifestPromise,contractPromise]);if(token!==buildToken)return;
      const meta=manifest.patches.find(p=>p.id===patchId),patch=contract.patches.find(p=>p.id===patchId);if(!meta||!patch)throw Error(`R3.5 缺少 OSM 视域 ${patchId}`);
      if(meta.buildings?.sourceMultiPolygonBoundaryOnly!==true||meta.buildings?.clippingCreatesPatchClosure!==false||meta.buildings?.heightClaim!=='unknown-not-generated')throw Error(`R3.5 ${patchId} 建筑证据边界不一致`);
      const sampler=terrainSampler(terrain),origin=terrainOrigin(contract,patch),f=meta.files;
      const[roadXY,roadParts]=await Promise.all([fileArray(f.roadXY,Uint16Array),fileArray(f.roadParts,Uint32Array)]);if(token!==buildToken)return;
      const roads=makeRoadSegments(roadXY,roadParts,meta,origin,sampler);
      let buildings=null;
      if(f.buildingXY&&f.buildingParts){const[buildingXY,buildingParts]=await Promise.all([fileArray(f.buildingXY,Uint16Array),fileArray(f.buildingParts,Uint32Array)]);if(token!==buildToken){roads.object.geometry.dispose();roads.object.material.dispose();return;}buildings=makeBuildingSegments(buildingXY,buildingParts,meta,origin,sampler);}
      dispose();
      const roadToggle=document.getElementById('show-osm-roads'),buildingToggle=document.getElementById('show-osm-buildings');
      roads.object.visible=roadToggle?.checked??true;originalAdd.call(scene,roads.object);
      if(buildings){buildings.object.visible=buildingToggle?.checked??true;originalAdd.call(scene,buildings.object);}
      active={scene,roads,buildings,meta,terrainUuid:terrain.uuid};updateCard(meta,roads,buildings);
      setDataset({
        osmKind:'external-mapped-observation',osmPatch:patchId,osmRoadsVisible:roads.object.visible,osmBuildingsVisible:!!buildings&&buildings.object.visible,
        osmRoadParts:meta.roads.partCount,osmRoadSegmentsDrawn:roads.drawnSegments,osmRoadSegmentsRejectedNoSurface:roads.rejectedSegments,
        osmBuildingBoundaryParts:meta.buildings.boundaryPartCount,osmBuildingSegmentsDrawn:buildings?.drawnSegments||0,osmBuildingSegmentsRejectedNoSurface:buildings?.rejectedSegments||0,
        osmBuildingSyntheticPatchClosure:false,osmRoadWidthClaim:'none-screen-style-only',osmBuildingHeightClaim:'unknown-not-generated',osmSurfaceAnchor:'current-display-triangles',
        osmSourceReleaseSha256:SOURCE_RELEASE_SHA256,osmCorrectedReportSha256:CORRECTED_REPORT_SHA256,osmQuantizationMaxStepM:meta.quantization.maxStepM,osmLoaded:true,osmError:null
      });forceRender();
    }catch(error){if(token!==buildToken)return;dispose();hideCard();setDataset({osmKind:'error',osmPatch:patchId,osmLoaded:false,osmError:error.message});console.error(error);}
  }
  THREE.Object3D.prototype.add=function(...objects){const result=originalAdd.apply(this,objects);if(this.isScene)for(const object of objects)if(isTerrainCandidate(object)){void buildForTerrain(this,object);break;}return result;};
  const roadToggle=document.getElementById('show-osm-roads');if(roadToggle&&!roadToggle.dataset.boundOsm){roadToggle.dataset.boundOsm='true';roadToggle.addEventListener('change',()=>{if(active)active.roads.object.visible=roadToggle.checked;setDataset({osmRoadsVisible:!!active&&roadToggle.checked});forceRender();});}
  const buildingToggle=document.getElementById('show-osm-buildings');if(buildingToggle&&!buildingToggle.dataset.boundOsm){buildingToggle.dataset.boundOsm='true';buildingToggle.addEventListener('change',()=>{if(active?.buildings)active.buildings.object.visible=buildingToggle.checked;setDataset({osmBuildingsVisible:!!active?.buildings&&buildingToggle.checked});forceRender();});}
}
