/* v3.4.9 review correction: crop the paddy LOD seam, suppress local shadow aliasing and strengthen non-periodic karst face relief. */

const buildContextFieldsV349Base=buildContextFields;
buildContextFields=function(analysis,peaks,mode){
  const field=buildContextFieldsV349Base(analysis,peaks,mode);
  if(state.enhanceMix===0)return field;
  let detailMin=Infinity,detailMax=-Infinity;
  for(let z=1;z<field.n-1;z++)for(let x=1;x<field.n-1;x++){
    const i=z*field.n+x,karst=field.karst?.[i]||0,valley=field.valley?.[i]||0,slope=field.slope?.[i]||0;
    const mask=karst*smoothstep(17,43,slope)*(1-smoothstep(.28,.62,valley));if(mask<.012)continue;
    const wx=field.worldX[x],wy=field.worldY[z],gx=field.gradX?.[i]||0,gy=field.gradY?.[i]||0,magnitude=Math.hypot(gx,gy)||1,downX=-gx/magnitude,downY=-gy/magnitude,acrossX=-downY,acrossY=downX;
    const along=wx*downX+wy*downY,across=wx*acrossX+wy*acrossY,warp=fbm(wx*.00145,wy*.00145,6401,4);
    const ribs=(ridged((wx+warp*61)*.0032,(wy-warp*39)*.0032,6413,4)-.58)*2.35;
    const grooves=-smoothstep(.75,.965,ridged(along*.0071+warp*.34,across*.0021,6427,4))*3.25;
    const ledges=Math.sin((field.final[i]||field.truth[i])*.145+fbm(wx*.0048,wy*.0048,6449,3)*1.7)*.62;
    const fracture=worley(wx*.0092+warp*.24,wy*.0092-warp*.18,6469),collapse=-smoothstep(.20,.044,fracture.f1)*1.05;
    const edge=edgeFeather(wx-field.center.x,wy-field.center.y,field.extent,.10),detail=clamp((ribs+grooves+ledges+collapse)*mask*edge*state.process,-4.25,1.82);
    field.final[i]+=detail;if(field.micro)field.micro[i]+=detail;detailMin=Math.min(detailMin,detail);detailMax=Math.max(detailMax,detail);
  }
  if(field.stats){
    field.stats.contextFaceRefineMin=Number.isFinite(detailMin)?detailMin:0;field.stats.contextFaceRefineMax=Number.isFinite(detailMax)?detailMax:0;
    field.stats.microMin=Math.min(field.stats.microMin||0,field.stats.contextFaceRefineMin);field.stats.microMax=Math.max(field.stats.microMax||0,field.stats.contextFaceRefineMax);
  }
  return field;
};

const createTerrainMeshV349Base=createTerrainMesh;
createTerrainMesh=function(field,origin,datum,layer,yOffset=0){
  const mesh=createTerrainMeshV349Base(field,origin,datum,layer,yOffset);
  if(layer==='local'&&state.preset.id==='paddy'){
    mesh.castShadow=false;mesh.receiveShadow=false;
    if(mesh.material){mesh.material.roughness=1;mesh.material.bumpMap=null;mesh.material.roughnessMap=null;mesh.material.needsUpdate=true}
    mesh.userData.paddyShadowAliasingSuppressed=true;
  }
  return mesh;
};

const terrainColourV349Base=terrainColourRichV330;
terrainColourRichV330=function(field,index,heightNorm,worldX,worldY,layer,slopeDeg){
  const colour=terrainColourV349Base(field,index,heightNorm,worldX,worldY,layer,slopeDeg);
  if(layer==='context'||layer==='regional'){
    const karst=field.karst?.[index]||smoothstep(12,40,slopeDeg),valley=field.valley?.[index]||0,breakup=smoothstep(.62,.94,ridged(worldX*.0034+fbm(worldX*.0008,worldY*.0008,6503,3)*.25,worldY*.0034,6521,4));
    const rock=clamp(karst*(1-valley)*smoothstep(22,52,slopeDeg)*breakup*.075,0,.075);
    colour.lerp(RICH_PALETTE_V330.limestoneLight,rock);
  }
  return colour;
};

const configureCameraV349Base=configureCamera;
configureCamera=function(view,build=state.currentBuild){
  if(!build)return;if(state.preset.id!=='paddy'){configureCameraV349Base(view,build);return}
  const offset=build.localOffset||{x:0,z:0},targetHeight=build.localTargetHeight||260;
  camera.fov=37;camera.position.set(offset.x+185,targetHeight+710,offset.z+285);controls.target.set(offset.x-22,targetHeight+7,offset.z-28);camera.updateProjectionMatrix();controls.update();
};

function applyReviewLightingV349(){
  const id=state.preset?.id||'atlas';
  const settings=id==='cliff'?{exposure:1.14,sun:3.02,hemi:1.30,fill:.31,fogNear:7600}:id==='paddy'?{exposure:1.15,sun:2.68,hemi:1.47,fill:.46,fogNear:8200}:id==='river'?{exposure:1.15,sun:2.76,hemi:1.40,fill:.41,fogNear:7900}:{exposure:1.16,sun:2.78,hemi:1.39,fill:.41,fogNear:7900};
  renderer.toneMappingExposure=settings.exposure;sun.intensity=settings.sun;if(scene.fog){scene.fog.near=settings.fogNear;scene.fog.far=24600}
  scene.traverse(object=>{if(object.isHemisphereLight)object.intensity=settings.hemi;if(object.name==='cool-fill')object.intensity=settings.fill});
}

const buildPresetV349Base=buildPreset;
buildPreset=async function(id,options={}){
  const result=await buildPresetV349Base(id,options);applyReviewLightingV349();configureCamera(state.preset.view,state.currentBuild);return result;
};

const makeQAV349Base=makeQA;
makeQA=function(build){
  const qa=makeQAV349Base(build),stats=build.context?.stats||{};
  qa.richTerrainPass='v3.4.9';qa.paddyReviewCamera='cropped-512m-local-aerial-oblique';qa.paddyShadowAliasingSuppressed=true;qa.contextFaceRefineRangeMeters=[Number((stats.contextFaceRefineMin||0).toFixed(3)),Number((stats.contextFaceRefineMax||0).toFixed(3))];qa.reviewLighting='preset-balanced-relief';qa.visualAcceptance=false;qa.productionReady=false;return qa;
};

document.title='小王 · 桂林地貌蒸馏实验室 v3.4.9';
const brandSmallV349=document.querySelector('.brand small');if(brandSmallV349)brandSmallV349.textContent='XIAOWANG · GUILIN GEOMORPHOLOGY DISTILLATION v3.4.9';
