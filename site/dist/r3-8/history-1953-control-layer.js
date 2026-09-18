import * as THREE from 'three';

const FLAG=Symbol.for('wenzhou.map-mother.1940s-coast-installed');
const TERRAIN_URL='../r3-1/data/terrain.json';
const MASK_MAX=1024;
const EDGE_EPS_DEG=.004;
const CONTROLS=[
  {sheet:'NH51-13',bounds:[120,28,121.5,29],urls:[
    '../../../records/R3_10/HISTORICAL_1953_WATER_CONTROL_NH51_13_P1.geojson',
    '../../../records/R3_10/HISTORICAL_1953_WATER_CONTROL_NH51_13_P2.geojson',
    '../../../records/R3_10/HISTORICAL_1953_WATER_CONTROL_NH51_13_P3.geojson',
  ]},
  {sheet:'NG51-1',bounds:[120,27,121.5,28],strict:true,authority:'user-provided-authoritative-sheet-20260918',urls:['../../../records/R3_10/HISTORICAL_1953_WATER_CONTROL_NG51_1.geojson']},
  {sheet:'NH51-14',bounds:[121.5,28,123,29],urls:['../../../records/R3_10/HISTORICAL_1953_WATER_CONTROL_NH51_14.geojson']},
];

function fetchJson(url){return fetch(url).then(r=>{if(!r.ok)throw Error(`1940s 历史控制资料读取失败 (${r.status})`);return r.json();});}
function currentPatchId(){return document.getElementById('location')?.value||document.getElementById('terrain')?.dataset.patch||'';}
function utm51(lonDeg,latDeg){
  const a=6378137,f=1/298.257223563,e2=f*(2-f),ep2=e2/(1-e2),k0=.9996,lon0=123*Math.PI/180,lat=latDeg*Math.PI/180,lon=lonDeg*Math.PI/180,s=Math.sin(lat),c=Math.cos(lat),t=Math.tan(lat),N=a/Math.sqrt(1-e2*s*s),T=t*t,C=ep2*c*c,A=c*(lon-lon0),e4=e2*e2,e6=e4*e2;
  const M=a*((1-e2/4-3*e4/64-5*e6/256)*lat-(3*e2/8+3*e4/32+45*e6/1024)*Math.sin(2*lat)+(15*e4/256+45*e6/1024)*Math.sin(4*lat)-(35*e6/3072)*Math.sin(6*lat));
  return[500000+k0*N*(A+(1-T+C)*A**3/6+(5-18*T+T*T+72*C-58*ep2)*A**5/120),k0*(M+N*t*(A*A/2+(5-T+9*C+4*C*C)*A**4/24+(61-58*T+T*T+600*C-330*ep2)*A**6/720))];
}
function featurePolygons(geo){const out=[];for(const f of geo.features||[]){const g=f.geometry;if(!g)continue;if(g.type==='Polygon')out.push({coordinates:g.coordinates||[],properties:f.properties||{}});else if(g.type==='MultiPolygon')for(const p of g.coordinates||[])out.push({coordinates:p,properties:f.properties||{}});}return out;}
function patchBounds(contract,patch){const t=contract.source.transform,east=col=>t[2]+t[0]*(col+.5),north=row=>t[5]+t[4]*(row+.5),e0=east(patch.columnIndices[0]),e1=east(patch.columnIndices.at(-1)),n0=north(patch.rowIndices[0]),n1=north(patch.rowIndices.at(-1));return[Math.min(e0,e1),Math.min(n0,n1),Math.max(e0,e1),Math.max(n0,n1)];}
function projectedPolygon(poly){return poly.map(ring=>ring.map(([lon,lat])=>utm51(lon,lat)));}
function polygonBounds(poly){let w=Infinity,s=Infinity,e=-Infinity,n=-Infinity;for(const ring of poly)for(const p of ring){w=Math.min(w,p[0]);s=Math.min(s,p[1]);e=Math.max(e,p[0]);n=Math.max(n,p[1]);}return[w,s,e,n];}
function boxesIntersect(a,b){return !(a[2]<b[0]||a[0]>b[2]||a[3]<b[1]||a[1]>b[3]);}
function maskSize(box){const dx=Math.max(1,box[2]-box[0]),dy=Math.max(1,box[3]-box[1]);if(dx>=dy)return[MASK_MAX,Math.max(256,Math.round(MASK_MAX*dy/dx))];return[Math.max(256,Math.round(MASK_MAX*dx/dy)),MASK_MAX];}
function makeCanvas(w,h,fill){const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d',{willReadFrequently:true});x.fillStyle=fill;x.fillRect(0,0,w,h);return[c,x];}
function drawWaterPolygons(ctx,polygons,box,w,h,fill='#fff'){ctx.fillStyle=fill;for(const item of polygons){ctx.beginPath();for(const ring of item.rings){let first=true;for(const[e,n]of ring){const x=(e-box[0])/(box[2]-box[0])*w,y=(box[3]-n)/(box[3]-box[1])*h;if(first){ctx.moveTo(x,y);first=false;}else ctx.lineTo(x,y);}ctx.closePath();}ctx.fill('evenodd');}}
function touchingEdges(poly,bounds){const[w,s,e,n]=bounds,edges=new Set();for(const ring of poly)for(const[lon,lat]of ring){if(Math.abs(lon-w)<=EDGE_EPS_DEG)edges.add('west');if(Math.abs(lon-e)<=EDGE_EPS_DEG)edges.add('east');if(Math.abs(lat-s)<=EDGE_EPS_DEG)edges.add('south');if(Math.abs(lat-n)<=EDGE_EPS_DEG)edges.add('north');}return[...edges];}
function buildProjectedControls(controls,box){const polygons=[];let sourcePolygonCount=0,pointCount=0;for(const control of controls)for(const geo of control.geos)for(const source of featurePolygons(geo)){sourcePolygonCount++;const p=projectedPolygon(source.coordinates),b=polygonBounds(p);if(!boxesIntersect(b,box))continue;for(const r of p)pointCount+=r.length;polygons.push({sheet:control.sheet,strict:control.strict===true,authority:control.authority||'derived-coarse-control',rings:p,bounds:b,touchEdges:touchingEdges(source.coordinates,control.bounds),sourcePixelArea:Number(source.properties?.pixelArea||0)});}return{polygons,sourcePolygonCount,pointCount};}
function classifyControlPolygons(polygons,base,box,w,h){
  const fullPixels=w*h,accepted=[],rejected=[],[candidateCanvas,candidateCtx]=makeCanvas(w,h,'#000');
  for(let index=0;index<polygons.length;index++){
    const item=polygons[index];candidateCtx.clearRect(0,0,w,h);candidateCtx.fillStyle='#000';candidateCtx.fillRect(0,0,w,h);drawWaterPolygons(candidateCtx,[item],box,w,h,'#fff');
    const candidate=candidateCtx.getImageData(0,0,w,h).data;let areaPixels=0,modernLandPixels=0;for(let i=0;i<candidate.length;i+=4)if(candidate[i+1]>=128){areaPixels++;if(base[i+1]>=128)modernLandPixels++;}
    if(!areaPixels)continue;const coverage=areaPixels/fullPixels,landFraction=modernLandPixels/areaPixels,waterSupport=1-landFraction,edgeCount=item.touchEdges.length;let reason='accepted';
    if(item.strict)reason='accepted-authoritative-sheet';
    else if(edgeCount>=2&&item.sourcePixelArea>=8000&&waterSupport<.55)reason='reject-frame-connected-weak-modern-water-support';
    else if(coverage>=.20&&landFraction>=.42)reason='reject-very-large-mostly-modern-land';
    else if(coverage>=.08&&landFraction>=.62)reason='reject-large-mostly-modern-land';
    else if(edgeCount>=2&&coverage>=.08&&landFraction>=.50)reason='reject-frame-connected-background';
    const diagnostic={index,sheet:item.sheet,strict:item.strict,authority:item.authority,areaPixels,coverage:+coverage.toFixed(5),modernLandPixels,landFraction:+landFraction.toFixed(5),modernWaterSupport:+waterSupport.toFixed(5),touchEdges:item.touchEdges,sourcePixelArea:item.sourcePixelArea,reason};if(reason==='accepted'){accepted.push(item);diagnostic.accepted=true;}else{rejected.push(diagnostic);diagnostic.accepted=false;}item.quality=diagnostic;
  }
  return{accepted,rejected,all:polygons.map(p=>p.quality).filter(Boolean)};
}
function buildHistoricalMasks(terrain,projected,box){
  const baseTexture=terrain.userData.wenzhouMapMotherBaseAlphaMap||terrain.material?.alphaMap;if(!baseTexture?.image)throw Error('1940s 海陆回退缺少当前地形 land mask');terrain.userData.wenzhouMapMotherBaseAlphaMap=baseTexture;
  const[w,h]=maskSize(box),[baseCanvas,baseCtx]=makeCanvas(w,h,'#000'),[waterCanvas,waterCtx]=makeCanvas(w,h,'#000'),[landCanvas,landCtx]=makeCanvas(w,h,'#000');baseCtx.drawImage(baseTexture.image,0,0,w,h);const base=baseCtx.getImageData(0,0,w,h).data,quality=classifyControlPolygons(projected.polygons,base,box,w,h);if(!quality.accepted.length)throw Error('1940s 历史水域控制全部被质量门拒绝');
  drawWaterPolygons(waterCtx,quality.accepted,box,w,h,'#fff');landCtx.drawImage(baseCanvas,0,0,w,h);drawWaterPolygons(landCtx,quality.accepted,box,w,h,'#000');const water=waterCtx.getImageData(0,0,w,h).data,land=landCtx.getImageData(0,0,w,h).data;let historicalWaterPixels=0,reclaimedPixels=0,currentLandPixels=0;
  for(let i=0;i<base.length;i+=4){const b=base[i+1],q=water[i+1];if(b>=128)currentLandPixels++;if(q>=128){historicalWaterPixels++;if(b>=128)reclaimedPixels++;}}
  const texture=new THREE.CanvasTexture(landCanvas);texture.minFilter=THREE.NearestFilter;texture.magFilter=THREE.NearestFilter;texture.generateMipmaps=false;texture.needsUpdate=true;texture.userData={wenzhouMapMother:true,epoch:'1940s',kind:'derived-land-water-mask'};
  const strictAccepted=quality.all.filter(x=>x.strict&&x.accepted);return{texture,landPixels:land,width:w,height:h,historicalWaterPixels,reclaimedPixels,currentLandPixels,acceptedControlPolygons:quality.accepted.length,rejectedControlPolygons:quality.rejected.length,rejectedControls:quality.rejected,controlQuality:quality.all,strictAcceptedControlPolygons:strictAccepted.length,strictAcceptedSheets:[...new Set(strictAccepted.map(x=>x.sheet))]};
}
function applyHistoricalLandMask(scene,terrain,masks){const old=terrain.userData.wenzhouMapMotherHistoryAlphaMap;if(old&&old!==masks.texture)old.dispose?.();terrain.userData.wenzhouMapMotherHistoryAlphaMap=masks.texture;terrain.userData.wenzhouMapMother1940s=true;terrain.material.alphaMap=masks.texture;terrain.material.alphaTest=Math.max(.5,Number(terrain.material.alphaTest||0));terrain.material.needsUpdate=true;let seaUpdated=false;scene.traverse(object=>{if(object.userData?.wenzhouSeaDemo&&object.material?.uniforms?.uLandMask){object.material.uniforms.uLandMask.value=masks.texture;object.material.needsUpdate=true;seaUpdated=true;}});return seaUpdated;}
function historicalLandAt(masks,box,x,z){const e=(box[0]+box[2])*.5+x*1000,n=(box[1]+box[3])*.5-z*1000,px=Math.floor((e-box[0])/(box[2]-box[0])*masks.width),py=Math.floor((box[3]-n)/(box[3]-box[1])*masks.height);if(px<0||py<0||px>=masks.width||py>=masks.height)return false;return masks.landPixels[(py*masks.width+px)*4+1]>=128;}
function filterOsmObject(object,masks,box){
  const g=object.geometry,pos=g?.attributes?.position,index=g?.index;if(!pos||!index)return{removed:0,kept:0};if(!object.userData.wenzhouMapMotherBaseIndex)object.userData.wenzhouMapMotherBaseIndex=index.array.slice();const base=object.userData.wenzhouMapMotherBaseIndex,kept=[];let removed=0;
  for(let k=0;k+1<base.length;k+=2){const a=Number(base[k]),b=Number(base[k+1]),ax=pos.getX(a),az=pos.getZ(a),bx=pos.getX(b),bz=pos.getZ(b),mx=(ax+bx)*.5,mz=(az+bz)*.5;if(historicalLandAt(masks,box,ax,az)&&historicalLandAt(masks,box,bx,bz)&&historicalLandAt(masks,box,mx,mz))kept.push(a,b);else removed++;}
  const Ctor=base.constructor,next=new Ctor(kept);g.setIndex(new THREE.BufferAttribute(next,1));object.userData.wenzhouMapMother1940sMasked=true;object.userData.wenzhouMapMotherHiddenSegments=removed;return{removed,kept:kept.length/2};
}
function applyHistoricalOsmMask(scene,masks,box,patchId){
  let roadHidden=0,buildingHidden=0,roadKept=0,buildingKept=0,objects=0;scene.traverse(object=>{if(!object.userData?.wenzhouOsmEvidence)return;objects++;const r=filterOsmObject(object,masks,box);if(object.userData.kind==='osm-road-centerline-evidence'){roadHidden+=r.removed;roadKept+=r.kept;}else if(object.userData.kind==='osm-building-footprint-boundary-evidence'){buildingHidden+=r.removed;buildingKept+=r.kept;}});
  const c=document.getElementById('terrain');if(c){c.dataset.history1940sOsmObjects=String(objects);c.dataset.history1940sRoadSegmentsHiddenWater=String(roadHidden);c.dataset.history1940sBuildingSegmentsHiddenWater=String(buildingHidden);c.dataset.history1940sRoadSegmentsKept=String(roadKept);c.dataset.history1940sBuildingSegmentsKept=String(buildingKept);}
  document.getElementById('show-osm-roads')?.dispatchEvent(new Event('change'));document.getElementById('show-osm-buildings')?.dispatchEvent(new Event('change'));
  const state=window.__wenzhouMapMother1940s;if(state&&state.patchId===patchId){state.osmHistoricalWaterMask={objects,roadHidden,buildingHidden,roadKept,buildingKept};}
  return{objects,roadHidden,buildingHidden,roadKept,buildingKept};
}
function removeLegacyVisualUi(){document.getElementById('history-1953-toggle')?.remove();document.getElementById('history-1953-layer-card')?.remove();document.getElementById('history-1953-style')?.remove();}
function updateUi(state){const brand=document.querySelector('.brand p');if(brand)brand.textContent='1940s Map Mother · 历史海陆回退';const card=document.getElementById('history-1942-card');if(card){const strong=card.querySelector('strong'),span=card.querySelector('span'),small=card.querySelector('small');if(strong)strong.textContent='1940s Map Mother · 海陆差分 V1';if(span)span.textContent=`历史水域控制 ${state.acceptedControlPolygons} 个 · 排除误提取 ${state.rejectedControlPolygons} 个 · 现代陆地回退 ${state.reclaimedPixels.toLocaleString()} mask px`;if(small)small.textContent='NG51-1 已按用户提供原图冻结为强历史控制：图内历史水域不会因为现代填海占用而被质量门否决；其它粗图仍保留误提取质量门。恢复成历史水域的现代围垦地，会同步隐藏其上的现代 OSM 道路/桥梁/建筑证据。';}}
export function installHistorical1953ControlLayer(){
  if(window[FLAG])return;window[FLAG]=true;removeLegacyVisualUi();document.documentElement.setAttribute('data-wenzhou-history-1953-visual','false');document.documentElement.dataset.wenzhouHistory1953ControlIndex='true';document.documentElement.dataset.wenzhouMapMotherEpoch='1940s';
  const contractPromise=fetchJson(TERRAIN_URL),controlPromise=Promise.all(CONTROLS.map(async c=>({...c,geos:await Promise.all(c.urls.map(fetchJson))})));let buildToken=0,terrainEvents=0,staleEvents=0,activeHistorical=null;const canvas=()=>document.getElementById('terrain');function diag(values){const c=canvas();if(!c)return;for(const[k,v]of Object.entries(values))c.dataset[k]=String(v);}
  async function build(scene,terrain,patchId){
    const token=++buildToken;diag({history1953LastPatch:patchId,history1953LastError:'',history1953Visualized:false,mapMotherEpoch:'1940s'});
    try{
      const[contract,controls]=await Promise.all([contractPromise,controlPromise]);if(token!==buildToken||currentPatchId()!==patchId){staleEvents++;diag({history1953StaleEvents:staleEvents});return;}const patch=contract.patches.find(p=>p.id===patchId);if(!patch)throw Error(`1940s Map Mother 缺少地形 patch ${patchId}`);const box=patchBounds(contract,patch),projected=buildProjectedControls(controls,box);if(!projected.polygons.length)throw Error('当前视域没有可用的历史水域控制');
      const masks=buildHistoricalMasks(terrain,projected,box);if(token!==buildToken||currentPatchId()!==patchId){masks.texture.dispose();staleEvents++;diag({history1953StaleEvents:staleEvents});return;}const seaUpdated=applyHistoricalLandMask(scene,terrain,masks);
      const state={schema:'wenzhou-map-mother/1940s-land-water-delta-v1',patchId,crs:'EPSG:32651',visualizedAsState:true,rawGuideLinesVisible:false,sourceSheets:CONTROLS.map(x=>x.sheet),historicalControlPolygonCount:projected.polygons.length,acceptedControlPolygons:masks.acceptedControlPolygons,rejectedControlPolygons:masks.rejectedControlPolygons,rejectedControls:masks.rejectedControls,controlQuality:masks.controlQuality,strictAcceptedControlPolygons:masks.strictAcceptedControlPolygons,strictAcceptedSheets:masks.strictAcceptedSheets,sourcePolygonCount:projected.sourcePolygonCount,projectedPointCount:projected.pointCount,maskWidth:masks.width,maskHeight:masks.height,historicalWaterPixels:masks.historicalWaterPixels,reclaimedPixels:masks.reclaimedPixels,currentLandPixels:masks.currentLandPixels,seaMaskUpdated:seaUpdated,storage:'runtime-derived-from-vector-controls-no-epoch-dem-copy',truthBoundary:'1940s candidate coast/water is derived from registered historical controls. User-provided NG51-1 is frozen as authoritative inside its footprint on 2026-09-18 and is not rejected merely because modern reclamation now occupies historical water. Other coarse sheets retain the frame-connected false-water quality gate. Historical masking never modifies terrain Y. No invented elevation claim.'};
      window.__wenzhouHistoricalControl1953={schema:'wenzhou-historical-control-index/1953-v4',patchId,crs:'EPSG:32651',visualized:false,polygonCount:projected.polygons.length,accepted:masks.acceptedControlPolygons,rejected:masks.rejectedControlPolygons,sourceSheets:CONTROLS.map(x=>x.sheet)};window.__wenzhouMapMother1940s=state;activeHistorical={scene,masks,box,patchId};const osmMask=applyHistoricalOsmMask(scene,masks,box,patchId);state.osmHistoricalWaterMask=osmMask;
      diag({history1953ControlSegments:projected.pointCount,history1953CommittedPatch:patchId,history1953Visualized:false,history1953LastError:'',history1940sMaskWidth:masks.width,history1940sMaskHeight:masks.height,history1940sHistoricalWaterPixels:masks.historicalWaterPixels,history1940sReclaimedPixels:masks.reclaimedPixels,history1940sAcceptedControlPolygons:masks.acceptedControlPolygons,history1940sRejectedControlPolygons:masks.rejectedControlPolygons,history1940sStrictAcceptedControlPolygons:masks.strictAcceptedControlPolygons,history1940sStrictAcceptedSheets:masks.strictAcceptedSheets.join(','),history1940sSeaMaskUpdated:seaUpdated,history1940sRawGuideLinesVisible:false});updateUi(state);window.dispatchEvent(new CustomEvent('wenzhou:map-mother-1940s-ready',{detail:state}));
    }catch(error){diag({history1953LastError:error.message||error});console.error(error);}
  }
  window.addEventListener('wenzhou:terrain-added',event=>{const {scene,terrain,patchId}=event.detail||{};if(!scene?.isScene||!terrain?.isMesh||!patchId)return;terrainEvents++;diag({history1953TerrainEvents:terrainEvents,history1953LastEventPatch:patchId,history1953Visualized:false});if(currentPatchId()!==patchId){staleEvents++;diag({history1953StaleEvents:staleEvents});return;}queueMicrotask(()=>build(scene,terrain,patchId));});
  const c=canvas();if(c)new MutationObserver(()=>{if(!activeHistorical)return;if(c.dataset.osmLoaded==='true'&&c.dataset.osmPatch===activeHistorical.patchId)queueMicrotask(()=>applyHistoricalOsmMask(activeHistorical.scene,activeHistorical.masks,activeHistorical.box,activeHistorical.patchId));}).observe(c,{attributes:true,attributeFilter:['data-osm-loaded','data-osm-patch']});
}
