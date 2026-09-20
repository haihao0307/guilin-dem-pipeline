import * as THREE from 'three';

const FLAG=Symbol.for('wenzhou.ng51-registration-contract-r1-installed');
const CONTRACT='shared-final-refined-land-mask-r1';
const MIN_RELIEF_HEIGHT_M=1;
const CELL_QUAD_ORDER=[0,1,3,2];

function canvasMask(texture,box){
  const image=texture?.image;if(!image||!box)return null;
  const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
  const context=canvas.getContext('2d',{willReadFrequently:true});context.drawImage(image,0,0);
  return{data:context.getImageData(0,0,canvas.width,canvas.height).data,width:canvas.width,height:canvas.height,box:box.slice()};
}
function maskPixel(mask,e,n){
  const b=mask.box,x=Math.floor((e-b[0])/(b[2]-b[0])*mask.width),y=Math.floor((b[3]-n)/(b[3]-b[1])*mask.height);
  return x<0||y<0||x>=mask.width||y>=mask.height?-1:y*mask.width+x;
}
function isLand(mask,e,n){const p=maskPixel(mask,e,n);return p>=0&&mask.data[p*4+1]>=128;}
function localToEN(box,x,z){return[(box[0]+box[2])*.5+x*1000,(box[1]+box[3])*.5-z*1000];}
function findReliefMesh(scene){let found=null;scene.traverse(object=>{if(!found&&object.userData?.wenzhouNg51IslandRelief)found=object;});return found;}
function copyTerrainTransform(terrain,mesh){
  terrain.updateMatrixWorld(true);const p=new THREE.Vector3(),q=new THREE.Quaternion(),s=new THREE.Vector3();terrain.matrixWorld.decompose(p,q,s);
  mesh.position.copy(p);mesh.quaternion.copy(q);mesh.scale.copy(s);mesh.updateMatrixWorld(true);
  const positionDelta=mesh.position.distanceTo(p),scaleDelta=mesh.scale.distanceTo(s),quaternionDelta=1-Math.abs(mesh.quaternion.dot(q));
  return{matched:positionDelta<1e-9&&scaleDelta<1e-9&&quaternionDelta<1e-9,positionDelta,scaleDelta,quaternionDelta};
}
function inspectCells(mesh,mask){
  const geometry=mesh.geometry,position=geometry?.attributes?.position,index=geometry?.index;if(!position||!index)throw Error('NG51 注册缺少岛体 position/index');
  const sourceCells=Math.min(Math.floor(position.count/4),Math.floor(index.count/6));
  if(sourceCells<=0||position.count!==sourceCells*4||index.count!==sourceCells*6)throw Error('NG51 岛体单元布局不符合 4 顶点/6 索引合同');
  const accepted=[],keptIndices=[];let rejectedWater=0,rejectedLowRelief=0,acceptedCenterOutsideFinalLand=0;
  for(let cell=0;cell<sourceCells;cell++){
    const first=cell*4,corners=[];let sx=0,sz=0,maxHeightM=-Infinity,landSamples=0;
    for(let j=0;j<4;j++){
      const vertex=first+j,x=position.getX(vertex),z=position.getZ(vertex),h=position.getY(vertex)*1000,[e,n]=localToEN(mask.box,x,z);
      sx+=x;sz+=z;maxHeightM=Math.max(maxHeightM,h);corners.push([e,n]);if(isLand(mask,e,n))landSamples++;
    }
    const[ce,cn]=localToEN(mask.box,sx*.25,sz*.25),centerLand=isLand(mask,ce,cn);if(centerLand)landSamples++;
    if(!centerLand||landSamples<2){rejectedWater++;continue;}
    if(maxHeightM<=MIN_RELIEF_HEIGHT_M){rejectedLowRelief++;continue;}
    if(!centerLand)acceptedCenterOutsideFinalLand++;
    accepted.push({cell,corners});const q=cell*6;for(let k=0;k<6;k++)keptIndices.push(Number(index.array[q+k]));
  }
  if(!accepted.length)throw Error('NG51 注册后没有可用岛体单元');
  const Ctor=index.array.constructor;geometry.setIndex(new THREE.BufferAttribute(new Ctor(keptIndices),1));geometry.computeBoundingBox();geometry.computeBoundingSphere();
  return{sourceCells,accepted,rejectedWater,rejectedLowRelief,acceptedCenterOutsideFinalLand,triangles:keptIndices.length/3};
}
function buildSharedCutTexture(terrain,mask,accepted){
  const source=terrain.userData?.wenzhouMapMotherRefinedAlphaMap;if(!source?.image)throw Error('NG51 注册缺少最终历史海陆 mask');
  const canvas=document.createElement('canvas');canvas.width=source.image.width;canvas.height=source.image.height;
  const context=canvas.getContext('2d',{willReadFrequently:true});context.drawImage(source.image,0,0,canvas.width,canvas.height);context.fillStyle='#000';
  for(const item of accepted){
    context.beginPath();
    for(let step=0;step<CELL_QUAD_ORDER.length;step++){
      const[e,n]=item.corners[CELL_QUAD_ORDER[step]],x=(e-mask.box[0])/(mask.box[2]-mask.box[0])*canvas.width,y=(mask.box[3]-n)/(mask.box[3]-mask.box[1])*canvas.height;
      if(step===0)context.moveTo(x,y);else context.lineTo(x,y);
    }
    context.closePath();context.fill();
  }
  const texture=new THREE.CanvasTexture(canvas);texture.minFilter=THREE.LinearFilter;texture.magFilter=THREE.LinearFilter;texture.generateMipmaps=false;texture.needsUpdate=true;
  texture.userData={wenzhouNg51RegisteredCut:true,contract:CONTRACT,cells:accepted.length,quadOrder:CELL_QUAD_ORDER.join(',')};
  const previous=terrain.userData.wenzhouNg51RegisteredCutTexture;if(previous&&previous!==texture)previous.dispose?.();
  terrain.userData.wenzhouNg51RegisteredCutTexture=texture;terrain.material.alphaMap=texture;terrain.material.alphaTest=.5;terrain.material.needsUpdate=true;
  return{texture,cutCells:accepted.length,quadOrder:CELL_QUAD_ORDER.slice()};
}
function applyRegistration(active){
  const{scene,terrain,patchId}=active,zone=terrain.userData?.wenzhouMapMotherStrictHistoricalIslands,finalTexture=terrain.userData?.wenzhouMapMotherRefinedAlphaMap;
  if(!zone?.image||!zone?.box||!finalTexture?.image)throw Error('NG51 注册缺少历史岛区或最终海陆 mask');
  const mesh=findReliefMesh(scene);if(!mesh)throw Error('NG51 注册找不到 50m 岛体层');
  const mask=canvasMask(finalTexture,zone.box);if(!mask)throw Error('NG51 注册无法读取最终海陆 mask');
  const inspected=inspectCells(mesh,mask),transform=copyTerrainTransform(terrain,mesh),oldAlpha=mesh.material?.alphaMap;
  mesh.material.alphaMap=finalTexture;mesh.material.alphaTest=.5;mesh.material.needsUpdate=true;
  const cut=buildSharedCutTexture(terrain,mask,inspected.accepted);
  Object.assign(mesh.userData,{wenzhouNg51RegistrationContract:CONTRACT,historicalIslandRole:'coarse-ownership-zone-only',renderMaskSource:'final-refined-land-mask'});
  const prior=window.__wenzhouNg51IslandRelief||{},state={...prior,
    schema:'wenzhou-ng51-island-relief-runtime/v3',ready:true,patchId,registrationContract:CONTRACT,sharedShorelineMask:true,
    renderMaskSource:'final-refined-land-mask',historicalIslandRole:'coarse-ownership-zone-only',sourceCells:inspected.sourceCells,
    registeredCells:inspected.accepted.length,triangles:inspected.triangles,registrationRejectedWaterCells:inspected.rejectedWater,
    registrationRejectedLowReliefCells:inspected.rejectedLowRelief,acceptedCenterOutsideFinalLand:inspected.acceptedCenterOutsideFinalLand,
    registeredCutCells:cut.cutCells,registeredCutQuadOrder:cut.quadOrder,terrainTransformMatched:transform.matched,terrainTransformDelta:transform,
    registrationPolicy:'Historical map island holes select coarse ownership only. Final refined land mask owns the exact shoreline for island relief, base-terrain cut, sea surface and seabed exclusion.',
  };
  window.__wenzhouNg51IslandRelief=state;window.__wenzhouNg51Registration=state;
  const canvas=document.getElementById('terrain');if(canvas){
    delete canvas.dataset.ng51RegistrationError;canvas.dataset.ng51Registration=CONTRACT;canvas.dataset.ng51RegistrationSharedMask='true';
    canvas.dataset.ng51RegistrationCells=String(state.registeredCells);canvas.dataset.ng51RegistrationRejectedWater=String(state.registrationRejectedWaterCells);
    canvas.dataset.ng51RegistrationOutsideLand=String(state.acceptedCenterOutsideFinalLand);canvas.dataset.ng51RegistrationTransformMatched=String(state.terrainTransformMatched);
    canvas.dataset.ng51RegistrationCutQuadOrder=cut.quadOrder.join(',');
  }
  if(oldAlpha&&oldAlpha!==finalTexture)oldAlpha.userData={...(oldAlpha.userData||{}),supersededBy:CONTRACT};
  window.dispatchEvent(new CustomEvent('wenzhou:ng51-registration-ready',{detail:state}));requestAnimationFrame(()=>window.dispatchEvent(new Event('resize')));
}

export function installNg51RegistrationContract(){
  if(window[FLAG])return;window[FLAG]=true;let active=null;
  window.addEventListener('wenzhou:terrain-added',event=>{const{scene,terrain,patchId}=event.detail||{};if(scene?.isScene&&terrain?.isMesh&&patchId)active={scene,terrain,patchId};});
  window.addEventListener('wenzhou:ng51-island-relief-ready',event=>{
    try{if(!active||active.patchId!==event.detail?.patchId)return;applyRegistration(active);}
    catch(error){const message=String(error?.message||error);window.__wenzhouNg51Registration={ready:false,error:message};const canvas=document.getElementById('terrain');if(canvas)canvas.dataset.ng51RegistrationError=message;console.error(error);}
  });
}
