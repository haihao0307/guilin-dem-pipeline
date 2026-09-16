import * as THREE from 'three';

const FLAG=Symbol.for('wenzhou.map-mother.1940s-refine-r27-installed');
const TERRAIN_URL='../r3-1/data/terrain.json';
const REFINE_MAX=2048;
const HIGH_GROUND_M=8;
const XUANMEN_CENTER=[121.3,28.1333333333];
const XUANMEN_RX_M=3650;
const XUANMEN_RY_M=4650;

function fetchJson(url){return fetch(url).then(r=>{if(!r.ok)throw Error(`1940s refine JSON读取失败 (${r.status})`);return r.json();});}
function utm51(lonDeg,latDeg){
  const a=6378137,f=1/298.257223563,e2=f*(2-f),ep2=e2/(1-e2),k0=.9996,lon0=123*Math.PI/180,lat=latDeg*Math.PI/180,lon=lonDeg*Math.PI/180,s=Math.sin(lat),c=Math.cos(lat),t=Math.tan(lat),N=a/Math.sqrt(1-e2*s*s),T=t*t,C=ep2*c*c,A=c*(lon-lon0),e4=e2*e2,e6=e4*e2;
  const M=a*((1-e2/4-3*e4/64-5*e6/256)*lat-(3*e2/8+3*e4/32+45*e6/1024)*Math.sin(2*lat)+(15*e4/256+45*e6/1024)*Math.sin(4*lat)-(35*e6/3072)*Math.sin(6*lat));
  return[500000+k0*N*(A+(1-T+C)*A**3/6+(5-18*T+T*T+72*C-58*ep2)*A**5/120),k0*(M+N*t*(A*A/2+(5-T+9*C+4*C*C)*A**4/24+(61-58*T+T*T+600*C-330*ep2)*A**6/720))];
}
function patchBounds(contract,patch){const t=contract.source.transform,east=col=>t[2]+t[0]*(col+.5),north=row=>t[5]+t[4]*(row+.5),e0=east(patch.columnIndices[0]),e1=east(patch.columnIndices.at(-1)),n0=north(patch.rowIndices[0]),n1=north(patch.rowIndices.at(-1));return[Math.min(e0,e1),Math.min(n0,n1),Math.max(e0,e1),Math.max(n0,n1)];}
function maskSize(box){const dx=Math.max(1,box[2]-box[0]),dy=Math.max(1,box[3]-box[1]);if(dx>=dy)return[REFINE_MAX,Math.max(512,Math.round(REFINE_MAX*dy/dx))];return[Math.max(512,Math.round(REFINE_MAX*dx/dy)),REFINE_MAX];}
function makeCanvas(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return[c,c.getContext('2d',{willReadFrequently:true})];}
function pixelFromLocal(box,w,h,x,z){const e=(box[0]+box[2])*.5+x*1000,n=(box[1]+box[3])*.5-z*1000;return[Math.floor((e-box[0])/(box[2]-box[0])*w),Math.floor((box[3]-n)/(box[3]-box[1])*h)];}
function historicalLandAt(data,w,h,box,x,z){const[px,py]=pixelFromLocal(box,w,h,x,z);if(px<0||py<0||px>=w||py>=h)return false;return data[(py*w+px)*4+1]>=128;}
function buildHighGroundProtection(terrain,baseData,w,h,box){
  const protect=new Uint8Array(w*h),pos=terrain.geometry?.attributes?.position;if(!pos)return{protect,seeds:0};const scaleY=terrain.scale?.y??1;let seeds=0;
  for(let i=0;i<pos.count;i++){
    const hm=pos.getY(i)*scaleY*1000;if(hm<HIGH_GROUND_M)continue;const[px,py]=pixelFromLocal(box,w,h,pos.getX(i),pos.getZ(i));if(px<0||py<0||px>=w||py>=h)continue;const q=(py*w+px)*4;if(baseData[q+1]<128)continue;seeds++;
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const x=px+dx,y=py+dy;if(x>=0&&y>=0&&x<w&&y<h)protect[y*w+x]=1;}
  }
  return{protect,seeds};
}
function refineMask(terrain,box){
  const histImage=terrain.material?.alphaMap?.image,baseImage=terrain.userData?.wenzhouMapMotherBaseAlphaMap?.image;if(!histImage||!baseImage)throw Error('1940s refine 缺少历史/现代 land mask');
  const[w,h]=maskSize(box),[baseCanvas,baseCtx]=makeCanvas(w,h),[histCanvas,histCtx]=makeCanvas(w,h),[binaryCanvas,binaryCtx]=makeCanvas(w,h),[smoothCanvas,smoothCtx]=makeCanvas(w,h);
  baseCtx.imageSmoothingEnabled=true;baseCtx.imageSmoothingQuality='high';baseCtx.drawImage(baseImage,0,0,w,h);histCtx.imageSmoothingEnabled=true;histCtx.imageSmoothingQuality='high';histCtx.drawImage(histImage,0,0,w,h);
  const base=baseCtx.getImageData(0,0,w,h).data,img=histCtx.getImageData(0,0,w,h),{protect,seeds}=buildHighGroundProtection(terrain,base,w,h,box),xc=utm51(...XUANMEN_CENTER);let xuanmenOpened=0,islandRestored=0;
  const minX=Math.max(0,Math.floor((xc[0]-XUANMEN_RX_M-box[0])/(box[2]-box[0])*w)),maxX=Math.min(w-1,Math.ceil((xc[0]+XUANMEN_RX_M-box[0])/(box[2]-box[0])*w)),minY=Math.max(0,Math.floor((box[3]-(xc[1]+XUANMEN_RY_M))/(box[3]-box[1])*h)),maxY=Math.min(h-1,Math.ceil((box[3]-(xc[1]-XUANMEN_RY_M))/(box[3]-box[1])*h));
  for(let py=minY;py<=maxY;py++)for(let px=minX;px<=maxX;px++){
    const e=box[0]+(px+.5)/w*(box[2]-box[0]),n=box[3]-(py+.5)/h*(box[3]-box[1]),inside=((e-xc[0])/XUANMEN_RX_M)**2+((n-xc[1])/XUANMEN_RY_M)**2<=1;if(!inside)continue;const q=(py*w+px)*4;if(base[q+1]>=128&&img[q+1]>=128){img[q]=img[q+1]=img[q+2]=0;img[q+3]=255;xuanmenOpened++;}
  }
  for(let p=0;p<protect.length;p++)if(protect[p]){const q=p*4;if(base[q+1]>=128&&img[q+1]<128){img[q]=base[q];img[q+1]=base[q+1];img[q+2]=base[q+2];img[q+3]=255;islandRestored++;}}
  binaryCtx.putImageData(new ImageData(new Uint8ClampedArray(img),w,h),0,0);smoothCtx.imageSmoothingEnabled=true;smoothCtx.imageSmoothingQuality='high';smoothCtx.filter='blur(0.85px)';smoothCtx.drawImage(binaryCanvas,0,0,w,h);smoothCtx.filter='none';
  const smooth=smoothCtx.getImageData(0,0,w,h).data,texture=new THREE.CanvasTexture(smoothCanvas);texture.minFilter=THREE.LinearFilter;texture.magFilter=THREE.LinearFilter;texture.generateMipmaps=false;texture.needsUpdate=true;texture.userData={wenzhouMapMother:true,epoch:'1940s',kind:'refined-land-water-mask-r27'};
  return{texture,data:smooth,width:w,height:h,xuanmenOpened,islandRestored,highGroundSeeds:seeds};
}
function applyTexture(scene,terrain,refined){
  const old=terrain.userData.wenzhouMapMotherRefinedAlphaMap;if(old&&old!==refined.texture)old.dispose?.();terrain.userData.wenzhouMapMotherRefinedAlphaMap=refined.texture;terrain.material.alphaMap=refined.texture;terrain.material.alphaTest=.5;terrain.material.needsUpdate=true;let seaUpdated=false;
  scene.traverse(object=>{if(object.userData?.wenzhouSeaDemo&&object.material?.uniforms?.uLandMask){object.material.uniforms.uLandMask.value=refined.texture;object.material.needsUpdate=true;seaUpdated=true;}});return seaUpdated;
}
function refilterOsm(scene,refined,box){let roadHidden=0,roadKept=0,buildingHidden=0,buildingKept=0,objects=0;scene.traverse(object=>{if(!object.userData?.wenzhouOsmEvidence)return;const g=object.geometry,pos=g?.attributes?.position,index=g?.index;if(!pos||!index)return;objects++;if(!object.userData.wenzhouMapMotherBaseIndex)object.userData.wenzhouMapMotherBaseIndex=index.array.slice();const base=object.userData.wenzhouMapMotherBaseIndex,kept=[];let removed=0;for(let k=0;k+1<base.length;k+=2){const a=Number(base[k]),b=Number(base[k+1]),ax=pos.getX(a),az=pos.getZ(a),bx=pos.getX(b),bz=pos.getZ(b),mx=(ax+bx)*.5,mz=(az+bz)*.5;if(historicalLandAt(refined.data,refined.width,refined.height,box,ax,az)&&historicalLandAt(refined.data,refined.width,refined.height,box,bx,bz)&&historicalLandAt(refined.data,refined.width,refined.height,box,mx,mz))kept.push(a,b);else removed++;}const Ctor=base.constructor;g.setIndex(new THREE.BufferAttribute(new Ctor(kept),1));object.userData.wenzhouMapMotherR27Masked=true;if(object.userData.kind==='osm-road-centerline-evidence'){roadHidden+=removed;roadKept+=kept.length/2;}else if(object.userData.kind==='osm-building-footprint-boundary-evidence'){buildingHidden+=removed;buildingKept+=kept.length/2;}});return{objects,roadHidden,roadKept,buildingHidden,buildingKept};}

export function installHistorical1940sRefine(){
  if(window[FLAG])return;window[FLAG]=true;const contractPromise=fetchJson(TERRAIN_URL);let active=null,run=0;const canvas=()=>document.getElementById('terrain');
  window.addEventListener('wenzhou:terrain-added',e=>{const {scene,terrain,patchId}=e.detail||{};if(scene?.isScene&&terrain?.isMesh&&patchId)active={scene,terrain,patchId};});
  window.addEventListener('wenzhou:map-mother-1940s-ready',async e=>{const token=++run;try{const state=e.detail;if(!active||active.patchId!==state?.patchId)return;const contract=await contractPromise;if(token!==run)return;const patch=contract.patches.find(p=>p.id===active.patchId);if(!patch)throw Error(`1940s refine 缺少 patch ${active.patchId}`);const box=patchBounds(contract,patch),refined=refineMask(active.terrain,box),seaUpdated=applyTexture(active.scene,active.terrain,refined),osm=refilterOsm(active.scene,refined,box),result={schema:'wenzhou-map-mother/1940s-refine-r27',patchId:active.patchId,mask:[refined.width,refined.height],highGroundThresholdM:HIGH_GROUND_M,highGroundSeeds:refined.highGroundSeeds,islandPixelsRestored:refined.islandRestored,xuanmenForcedWaterPixels:refined.xuanmenOpened,xuanmenCenter:XUANMEN_CENTER,xuanmenEllipseM:[XUANMEN_RX_M,XUANMEN_RY_M],seaMaskUpdated:seaUpdated,osm};window.__wenzhouMapMother1940sRefine=result;const c=canvas();if(c){c.dataset.history1940sRefine='r27';c.dataset.history1940sRefineMask=`${refined.width}x${refined.height}`;c.dataset.history1940sIslandPixelsRestored=String(refined.islandRestored);c.dataset.history1940sXuanmenForcedWaterPixels=String(refined.xuanmenOpened);c.dataset.history1940sRefineRoadHidden=String(osm.roadHidden);}window.__wenzhouMapMother1940s.refinement=result;window.dispatchEvent(new CustomEvent('wenzhou:map-mother-1940s-refined',{detail:result}));}catch(error){const c=canvas();if(c)c.dataset.history1940sRefineError=String(error?.message||error);console.error(error);}});
  const c=canvas();if(c)new MutationObserver(()=>{const r=window.__wenzhouMapMother1940sRefine;if(!r||!active||c.dataset.osmLoaded!=='true'||c.dataset.osmPatch!==active.patchId)return;const contract=window.__wenzhouMapMother1940s;void contract;}).observe(c,{attributes:true,attributeFilter:['data-osm-loaded','data-osm-patch']});
}
