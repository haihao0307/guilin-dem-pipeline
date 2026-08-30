/* v3.6.6 field-layout and seam pass: warped parcel grid replaces contour bands, and cliff review uses one continuous context surface. */

function paddyGrammarV366(worldX,worldY,seed=0){
  const lx=worldX-450000,ly=worldY-2750000,angle=-.31+fbm(lx*.00012,ly*.00012,seed+17,3)*.22,ca=Math.cos(angle),sa=Math.sin(angle),warpX=fbm(lx*.0019,ly*.0019,seed+31,4)*9.5+fbm(lx*.007,ly*.007,seed+43,2)*1.8,warpY=fbm(lx*.0019+6.4,ly*.0019-4.1,seed+59,4)*9.5+fbm(lx*.007-5.1,ly*.007+7.3,seed+71,2)*1.8,u=(lx+warpX)*ca+(ly+warpY)*sa,v=-(lx+warpX)*sa+(ly+warpY)*ca,blockX=Math.floor(lx/900),blockY=Math.floor(ly/900),width=52+hash21(blockX,blockY,seed+89)*44,height=34+hash21(blockX,blockY,seed+101)*38,gu=u/width,gv=v/height,cellX=Math.floor(gu),cellZ=Math.floor(gv),fu=fract(gu),fv=fract(gv),du=Math.min(fu,1-fu),dv=Math.min(fv,1-fv),vertical=smoothstep(.082,.014,du),horizontal=smoothstep(.082,.014,dv),fieldSeed=hash21(cellX,cellZ,seed+127),splitGate=smoothstep(.73,.94,fieldSeed),diagPhase=Math.abs(fract((gu+gv)*.5+hash21(cellX,cellZ,seed+139))-.5),diagonal=smoothstep(.052,.010,diagPhase)*splitGate,boundary=Math.max(vertical,horizontal,diagonal*.66),majorU=Math.min(fract(u/(width*3.6)),1-fract(u/(width*3.6))),majorV=Math.min(fract(v/(height*4.2)),1-fract(v/(height*4.2))),curved=ridged((lx+fbm(lx*.0011,ly*.0011,seed+151,3)*45)*.0031,(ly+fbm(lx*.0011+4.8,ly*.0011-6.1,seed+167,3)*45)*.0011,seed+179,4),irrigation=Math.max(smoothstep(.035,.008,majorU),smoothstep(.030,.007,majorV)*.72,smoothstep(.925,.983,curved)*.58)*(1-boundary*.55),wetness=clamp((fieldSeed-.48)*1.65,0,1)*(.58+.42*fbm(lx*.0023,ly*.0023,seed+197,3));
  return{cell:{cellX,cellZ,f1:Math.min(du,dv),f2:Math.max(du,dv)},coarse:{cellX:blockX,cellZ:blockY},boundary,irrigation,fieldSeed,wetness,split:diagonal,orientation:angle,parcelWidthMeters:[width,height],scale:1};
}
paddyGrammarV364=paddyGrammarV366;
paddyGrammarV363=paddyGrammarV366;
paddyGrammarV362=paddyGrammarV366;
paddyGrammarV360=paddyGrammarV366;
parcelGrammarV330=paddyGrammarV366;

const PADDY_STAGE_V366=[new THREE.Color(0x506b30),new THREE.Color(0x638035),new THREE.Color(0x79913a),new THREE.Color(0x8f7d3d)],PADDY_BASE_V366=new THREE.Color(0x52603d),PADDY_SOIL_V366=new THREE.Color(0x64553c),PADDY_BUND_V366=new THREE.Color(0x4b402f),PADDY_CHANNEL_V366=new THREE.Color(0x34574f),PADDY_WET_V366=new THREE.Color(0x4a6d62),PADDY_STAGE_SCRATCH_V366=new THREE.Color(),PADDY_COLOUR_SCRATCH_V366=new THREE.Color();
function paddyColourV366(field,index,worldX,worldY,layer,slopeDeg){
  const semantic=clamp(field.valley?.[index]??field.paddy?.[index]??field.paddySmoothV360?.[index]??field.paddyMask?.[index]??0,0,1),mask=semantic*smoothstep(13.5,2.0,slopeDeg),grammar=paddyGrammarV366(worldX,worldY,601),stage=PADDY_STAGE_SCRATCH_V366.copy(PADDY_STAGE_V366[Math.min(3,Math.floor(grammar.fieldSeed*4))]),broad=fbm((worldX-450000)*.00072,(worldY-2750000)*.00072,8401,4);
  stage.offsetHSL(0,broad*.002,broad*.009);stage.lerp(PADDY_WET_V366,clamp(grammar.wetness*.12*mask,0,.12));stage.lerp(PADDY_BUND_V366,clamp(grammar.boundary*.44*mask,0,.44));stage.lerp(PADDY_CHANNEL_V366,clamp(grammar.irrigation*.52*mask,0,.52));
  const colour=PADDY_COLOUR_SCRATCH_V366.copy(PADDY_BASE_V366).lerp(PADDY_SOIL_V366,smoothstep(6,18,slopeDeg)*.32).lerp(stage,mask*.97);if(layer==='regional')colour.lerp(RICH_PALETTE_V330.distant,.10);else if(layer==='context')colour.offsetHSL(0,0,.006);return colour;
}
paddyParcelColourV351=paddyColourV366;

const terrainColourV366Base=terrainColourRichV330;
terrainColourRichV330=function(field,index,heightNorm,worldX,worldY,layer,slopeDeg){
  if(state.preset.id==='paddy')return paddyColourV366(field,index,worldX,worldY,layer,slopeDeg);
  const colour=terrainColourV366Base(field,index,heightNorm,worldX,worldY,layer,slopeDeg);
  if(state.preset.id==='atlas'){
    const semantic=clamp(field.valley?.[index]??field.paddy?.[index]??field.paddyMask?.[index]??0,0,1),mask=semantic*smoothstep(14,2.2,slopeDeg);if(mask>.015)colour.lerp(paddyColourV366(field,index,worldX,worldY,layer,slopeDeg),mask*.78);
  }
  return colour;
};

const buildLocalFieldsV366Base=buildLocalFields;
buildLocalFields=function(contextField,localCenter,mode,data,candidate,riverSections){
  const field=buildLocalFieldsV366Base(contextField,localCenter,mode,data,candidate,riverSections);if(mode!=='paddy'||state.enhanceMix===0)return field;
  const n=field.n,count=n*n,contextBase=new Float32Array(count),rawMask=field.paddyMask||new Float32Array(count),maskA=boxBlur(rawMask,n,isMobile?5:9),maskB=boxBlur(maskA,n,isMobile?3:5),smoothMask=new Float32Array(count);let bundMax=0,channelMax=0,active=0;
  for(let z=0;z<n;z++)for(let x=0;x<n;x++){const i=z*n+x,wx=field.worldX[x],wy=field.worldY[z];contextBase[i]=field.contextFinalV346?.[i]??sampleField(contextField,wx,wy,'final')}
  for(let z=0;z<n;z++)for(let x=0;x<n;x++){
    const i=z*n+x,wx=field.worldX[x],wy=field.worldY[z],x0=Math.max(0,x-4),x1=Math.min(n-1,x+4),z0=Math.max(0,z-4),z1=Math.min(n-1,z+4),gx=(contextBase[z*n+x1]-contextBase[z*n+x0])/Math.max(1,(x1-x0)*field.spacing),gy=(contextBase[z1*n+x]-contextBase[z0*n+x])/Math.max(1,(z1-z0)*field.spacing),slope=Math.atan(Math.hypot(gx,gy))*180/Math.PI,parent=smoothstep(.18,.62,maskB[i])*smoothstep(7.5,1.0,slope),grammar=paddyGrammarV366(wx,wy,601),bund=grammar.boundary*(.075+grammar.fieldSeed*.050),channel=grammar.irrigation*(.040+.035*(1-grammar.fieldSeed)),micro=fbm((wx-450000)*.018,(wy-2750000)*.018,8423,2)*.003*(1-grammar.boundary),detail=(bund-channel+micro)*parent,edge=field.visualEdgeV347?.[i]??field.localEdge?.[i]??edgeFeather(wx-localCenter.x,wy-localCenter.y,field.extent,.38),blend=edge*edge*(3-2*edge);
    field.final[i]=contextBase[i]+detail*state.bund*blend;smoothMask[i]=parent;bundMax=Math.max(bundMax,bund*parent);channelMax=Math.max(channelMax,channel*parent);if(parent>.45)active++;
  }
  field.paddyMask=smoothMask;field.paddySmoothV360=smoothMask;if(field.stats){field.stats.paddyVertices=active;field.stats.bundMax=bundMax;field.stats.paddyChannelMaximum=channelMax;field.stats.paddyFloorModel='context-inherited+warped-rectilinear-parcels';field.stats.paddyTerraceQuantization=false}return field;
};

function fullGridIndexV366(n){const indices=new Uint32Array((n-1)*(n-1)*6);let p=0;for(let z=0;z<n-1;z++)for(let x=0;x<n-1;x++){const a=z*n+x,b=a+1,c=a+n,d=c+1;if((x+z)&1){indices[p++]=a;indices[p++]=c;indices[p++]=d;indices[p++]=a;indices[p++]=d;indices[p++]=b}else{indices[p++]=a;indices[p++]=c;indices[p++]=b;indices[p++]=b;indices[p++]=c;indices[p++]=d}}return indices}
const createTerrainMeshV366Base=createTerrainMesh;
createTerrainMesh=function(field,origin,datum,layer,yOffset=0){
  const mesh=createTerrainMeshV366Base(field,origin,datum,layer,yOffset);
  if(state.preset.id==='cliff'&&layer==='context'){
    mesh.geometry.setIndex(new THREE.BufferAttribute(fullGridIndexV366(field.n),1));mesh.geometry.computeBoundingSphere();mesh.userData.fullContextSurface=true;
  }
  if(state.preset.id==='cliff'&&layer==='local'){
    mesh.visible=false;mesh.userData.suppressedForContinuousContext=true;
  }
  if(state.preset.id==='paddy'&&layer==='local'){mesh.castShadow=false;mesh.receiveShadow=false}
  return mesh;
};

const makeTerrainMaterialV366Base=makeTerrainMaterialRichV330;
makeTerrainMaterialRichV330=function(layer){const material=makeTerrainMaterialV366Base(layer);if(state.preset.id==='cliff'&&layer==='context'){material.bumpMap=rockTextureV330;material.bumpScale=.16;material.roughnessMap=null;material.roughness=.96;material.needsUpdate=true}if(state.preset.id==='paddy'){material.bumpMap=null;material.roughnessMap=null;material.roughness=.99;material.needsUpdate=true}return material};

configureCamera=function(view,build=state.currentBuild){
  if(!build)return;const offset=build.localOffset||{x:0,z:0},targetHeight=build.localTargetHeight||260,id=state.preset.id;
  if(id==='atlas'){camera.fov=37;camera.position.set(3000,1390,4250);controls.target.set(0,230,-350)}
  else if(id==='paddy'){const clear=paddyCameraAzimuthV350(build),terrainHeight=sampleField(build.context,build.local.center.x,build.local.center.y,'final')-build.datum,distance=isMobile?430:620,height=isMobile?360:470;camera.fov=isMobile?39:37;camera.position.set(offset.x+Math.cos(clear.angle)*distance,terrainHeight+height,offset.z+Math.sin(clear.angle)*distance);controls.target.set(offset.x,terrainHeight+3,offset.z-24);state.paddyCameraV350={azimuthRadians:clear.angle,obstructionScore:clear.score,maxRiseMeters:clear.maxRise,meanPositiveRiseMeters:clear.meanRise,horizontalDistanceMeters:distance,heightMeters:height,fovDegrees:camera.fov}}
  else if(id==='river'){camera.fov=38;camera.position.set(offset.x+1120,targetHeight+500,offset.z+1510);controls.target.set(offset.x-105,targetHeight+12,offset.z-270)}
  else{const peak=state.selectedCliffPeakV346,clear=clearCliffCameraV365(build,peak),px=peak.x-build.origin.x,pz=peak.y-build.origin.y;camera.fov=39;camera.position.set(clear.worldX-build.origin.x,clear.camY+70,clear.worldY-build.origin.y);controls.target.set(px,clear.targetY,pz);state.cliffCameraV365=clear}
  camera.updateProjectionMatrix();controls.update();
};

const makeQAV366Base=makeQA;
makeQA=function(build){const qa=makeQAV366Base(build);qa.richTerrainPass='v3.6.6';qa.paddyGrammar='warped-rectilinear-parcels+major-flow-canals';qa.paddyColourContinuity='shared-all-terrain-tiers';qa.cliffLocalGeometryVisible=false;qa.cliffContextSurfaceContinuous=true;qa.cliffDetailMode='context-geometry+procedural-material-micro';qa.visualAcceptance=false;qa.productionReady=false;return qa};

const buildPresetV366Base=buildPreset;
buildPreset=async function(id,options={}){const result=await buildPresetV366Base(id,options);configureCamera(state.preset.view,state.currentBuild);if(window.__terrainV320QA?.ready)window.__terrainV320QA.richTerrainPass='v3.6.6';setStatus('桂林多场地貌 v3.6.6 已加载',`${state.currentBuild.candidate.name} · 曲折田块网、连续塔峰面和统一综合色彩协作`);return result};

document.title='小王 · 桂林多场地貌蒸馏实验室 v3.6.6';
const brandSmallV366=document.querySelector('.brand small');if(brandSmallV366)brandSmallV366.textContent='XIAOWANG · GUILIN MULTI-FIELD TERRAIN DISTILLATION v3.6.6';
