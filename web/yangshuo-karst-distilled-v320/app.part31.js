/* v3.5.2 paddy parcel correction: coarser field grammar, flat review normals and legible bund/channel hierarchy. */

function paddyGrammarV352(worldX,worldY,seed=0){
  const scale=state.preset.id==='paddy'?1.72:1,frame=parcelFrameV348(worldX,worldY,seed,scale);
  return{
    cell:{f1:Math.min(frame.du,frame.dv),f2:Math.max(frame.du,frame.dv),cellX:frame.cellU,cellZ:frame.cellV},
    coarse:{f1:Math.min(frame.du,frame.dv),f2:Math.max(frame.du,frame.dv),cellX:Math.floor(frame.cellU/3),cellZ:Math.floor(frame.cellV/2)},
    boundary:frame.boundary,irrigation:frame.irrigation,fieldSeed:frame.fieldSeed,wetness:frame.wetness,split:frame.split,orientation:frame.angle,parcelWidthMeters:[frame.widthU,frame.widthV],scale
  };
}
parcelGrammarV330=paddyGrammarV352;

paddyDetail=function(worldX,worldY,truth,base,valleyMask,slopeDeg,seed=0){
  const parent=valleyMask*smoothstep(11.5,2.0,slopeDeg);if(parent<.001)return{delta:0,bund:0,channel:0,mask:0};
  const grammar=paddyGrammarV352(worldX,worldY,seed),step=.18+grammar.fieldSeed*.10,offset=(grammar.fieldSeed-.5)*.07;
  const terrace=Math.round((base+offset)/step)*step-offset,flatten=clamp((terrace-base)*.42,-.16,.16);
  const bund=grammar.boundary*(.095+grammar.fieldSeed*.095),channel=grammar.irrigation*(.055+.060*(1-grammar.fieldSeed));
  const broad=fbm(worldX*.028,worldY*.028,7061,2)*.008*(1-grammar.boundary),delta=clamp((flatten+bund-channel+broad)*parent,-.22,.22);
  return{delta,bund:bund*parent,channel:channel*parent,mask:parent,fieldSeed:grammar.fieldSeed,wetness:grammar.wetness};
};

function paddyParcelColourV352(field,index,worldX,worldY,slopeDeg){
  const mask=clamp(field.paddyMask?.[index]??field.paddy?.[index]??0,0,1),valley=clamp(field.valley?.[index]||0,0,1),frame=parcelFrameV348(worldX,worldY,601,1.72),broad=fbm(worldX*.00072,worldY*.00072,7087,4);
  const stageIndex=Math.min(3,Math.floor(frame.fieldSeed*4)),stage=PADDY_STAGE_SCRATCH_V351.copy(PADDY_STAGES_V351[stageIndex]);
  stage.offsetHSL(0,broad*.0015,broad*.014);
  const wet=clamp(frame.wetness*.13*mask,0,.13),boundary=clamp(frame.boundary*.62*mask,0,.62),channel=clamp(frame.irrigation*.70*mask,0,.70);
  stage.lerp(PADDY_WET_V351,wet);stage.lerp(PADDY_BUND_V351,boundary);stage.lerp(PADDY_CHANNEL_V351,channel);
  const colour=PADDY_GROUND_SCRATCH_V351.copy(PADDY_GROUND_A_V351).lerp(PADDY_GROUND_B_V351,valley*.34).lerp(PADDY_GROUND_C_V351,smoothstep(5,16,slopeDeg)*.32).lerp(stage,mask*.97);
  colour.offsetHSL(0,0,broad*.004);return colour;
}
paddyParcelColourV351=paddyParcelColourV352;

smoothPaddyNormalsV351=function(mesh,field){
  const normal=mesh.geometry?.getAttribute('normal');if(!normal)return;
  for(let i=0;i<normal.count;i++)normal.setXYZ(i,0,1,0);
  normal.needsUpdate=true;mesh.geometry.normalizeNormals();mesh.userData.paddyNormalMode='flat-up-review';
};

const configureCameraV352Base=configureCamera;
configureCamera=function(view,build=state.currentBuild){
  if(!build||state.preset.id!=='paddy'){configureCameraV352Base(view,build);return}
  const field=build.local,offset=build.localOffset||{x:0,z:0},center=field.center,terrainHeight=sampleField(field,center.x,center.y,'final')-build.datum,clear=paddyCameraAzimuthV350(build),distance=isMobile?130:190,height=isMobile?540:560;
  camera.fov=isMobile?32:28;camera.position.set(offset.x+Math.cos(clear.angle)*distance,terrainHeight+height,offset.z+Math.sin(clear.angle)*distance);controls.target.set(offset.x,terrainHeight+2,offset.z);camera.updateProjectionMatrix();controls.update();
  state.paddyCameraV350={azimuthRadians:clear.angle,obstructionScore:clear.score,maxRiseMeters:clear.maxRise,meanPositiveRiseMeters:clear.meanRise,horizontalDistanceMeters:distance,heightMeters:height,fovDegrees:camera.fov};
};

const makeQAV352Base=makeQA;
makeQA=function(build){
  const qa=makeQAV352Base(build);qa.richTerrainPass='v3.5.2';qa.paddyParcelScaleMeters=[55,182];qa.paddyNormalMode='flat-up-review';qa.paddyReviewCamera='terrain-aware-oblique-cropped-512m';qa.visualAcceptance=false;qa.productionReady=false;return qa;
};

const buildPresetV352Base=buildPreset;
buildPreset=async function(id,options={}){
  const result=await buildPresetV352Base(id,options);if(window.__terrainV320QA?.ready)window.__terrainV320QA.richTerrainPass='v3.5.2';return result;
};

document.title='小王 · 桂林地貌蒸馏实验室 v3.5.2';
const brandSmallV352=document.querySelector('.brand small');if(brandSmallV352)brandSmallV352.textContent='XIAOWANG · GUILIN GEOMORPHOLOGY DISTILLATION v3.5.2';
