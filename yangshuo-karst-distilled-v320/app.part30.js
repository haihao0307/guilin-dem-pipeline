/* v3.5.1 paddy visual compiler: clean parcel albedo, wider normal filtering and a safe oblique review camera. */

function paddyParcelColourV351(field,index,worldX,worldY,slopeDeg){
  const mask=clamp(field.paddyMask?.[index]??field.paddy?.[index]??0,0,1),valley=clamp(field.valley?.[index]||0,0,1),frame=parcelFrameV348(worldX,worldY,601,1),broad=fbm(worldX*.00082,worldY*.00082,6901,4);
  const stages=[
    new THREE.Color(0x4d5b36),
    new THREE.Color(0x5b6a3b),
    new THREE.Color(0x6b7840),
    new THREE.Color(0x7d7546)
  ];
  const stageIndex=Math.min(3,Math.floor(frame.fieldSeed*4)),stage=stages[stageIndex].clone();
  stage.offsetHSL(0,broad*.002,broad*.018);
  const wet=clamp(frame.wetness*.16*mask,0,.16),boundary=clamp(frame.boundary*.68*mask,0,.68),channel=clamp(frame.irrigation*.72*mask,0,.72);
  stage.lerp(new THREE.Color(0x596c60),wet);
  stage.lerp(new THREE.Color(0x4b4234),boundary);
  stage.lerp(new THREE.Color(0x405a55),channel);
  const ground=new THREE.Color(0x5a5b3f).lerp(new THREE.Color(0x485a3d),valley*.38).lerp(new THREE.Color(0x665b43),smoothstep(5,16,slopeDeg)*.35);
  const colour=ground.lerp(stage,mask*.96);
  const parcelInterior=clamp((1-frame.boundary)*(1-frame.irrigation)*mask,0,1),furrowPhase=.5+.5*Math.sin((frame.u/frame.widthU*6.0+frame.v/frame.widthV*.35)*Math.PI*2);
  colour.offsetHSL(0,0,(furrowPhase-.5)*.012*parcelInterior);
  return colour;
}

const terrainColourV351Base=terrainColourRichV330;
terrainColourRichV330=function(field,index,heightNorm,worldX,worldY,layer,slopeDeg){
  if(layer==='local'&&state.preset.id==='paddy')return paddyParcelColourV351(field,index,worldX,worldY,slopeDeg);
  return terrainColourV351Base(field,index,heightNorm,worldX,worldY,layer,slopeDeg);
};

function smoothPaddyNormalsV351(mesh,field){
  const geometry=mesh.geometry,normal=geometry?.getAttribute('normal');if(!normal||normal.count!==field.n*field.n)return;
  const n=field.n,final=field.final,spacing=field.spacing,radius=isMobile?5:8;
  for(let z=0;z<n;z++)for(let x=0;x<n;x++){
    const i=z*n+x,x0=Math.max(0,x-radius),x1=Math.min(n-1,x+radius),z0=Math.max(0,z-radius),z1=Math.min(n-1,z+radius);
    const dx=(final[z*n+x1]-final[z*n+x0])/Math.max(1,(x1-x0)*spacing),dz=(final[z1*n+x]-final[z0*n+x])/Math.max(1,(z1-z0)*spacing),inv=1/Math.hypot(dx,1,dz);
    normal.setXYZ(i,-dx*inv,inv,-dz*inv);
  }
  normal.needsUpdate=true;geometry.normalizeNormals();
}

const createTerrainMeshV351Base=createTerrainMesh;
createTerrainMesh=function(field,origin,datum,layer,yOffset=0){
  const mesh=createTerrainMeshV351Base(field,origin,datum,layer,yOffset);
  if(layer==='local'&&state.preset.id==='paddy'){
    smoothPaddyNormalsV351(mesh,field);mesh.castShadow=false;mesh.receiveShadow=false;
    if(mesh.material){mesh.material.bumpMap=null;mesh.material.roughnessMap=null;mesh.material.roughness=1;mesh.material.metalness=0;mesh.material.needsUpdate=true}
    mesh.userData.paddyNormalRadiusMeters=(isMobile?5:8)*field.spacing;
  }
  return mesh;
};

const configureCameraV351Base=configureCamera;
configureCamera=function(view,build=state.currentBuild){
  if(!build||state.preset.id!=='paddy'){configureCameraV351Base(view,build);return}
  const field=build.local,offset=build.localOffset||{x:0,z:0},center=field.center,terrainHeight=sampleField(field,center.x,center.y,'final')-build.datum,clear=paddyCameraAzimuthV350(build),distance=isMobile?105:145,height=isMobile?580:610;
  camera.fov=isMobile?31:27;camera.position.set(offset.x+Math.cos(clear.angle)*distance,terrainHeight+height,offset.z+Math.sin(clear.angle)*distance);controls.target.set(offset.x,terrainHeight+2.5,offset.z);camera.near=.5;camera.updateProjectionMatrix();controls.update();
  state.paddyCameraV350={azimuthRadians:clear.angle,obstructionScore:clear.score,maxRiseMeters:clear.maxRise,meanPositiveRiseMeters:clear.meanRise,horizontalDistanceMeters:distance,heightMeters:height,fovDegrees:camera.fov};
};

const makeQAV351Base=makeQA;
makeQA=function(build){
  const qa=makeQAV351Base(build);qa.richTerrainPass='v3.5.1';qa.paddyAlbedo='discrete-parcel-stage+bund+channel+wetness';qa.paddyNormalFilterMeters=isMobile?10:8;qa.paddyReviewCamera='terrain-aware-safe-oblique-cropped-512m';qa.visualAcceptance=false;qa.productionReady=false;return qa;
};

const buildPresetV351Base=buildPreset;
buildPreset=async function(id,options={}){
  const result=await buildPresetV351Base(id,options);
  if(window.__terrainV320QA?.ready){
    const cameraState=state.paddyCameraV350||{};window.__terrainV320QA.richTerrainPass='v3.5.1';window.__terrainV320QA.paddyCameraDiagnostics={azimuthRadians:Number((cameraState.azimuthRadians||0).toFixed(4)),obstructionScore:Number((cameraState.obstructionScore||0).toFixed(3)),maxRiseMeters:Number((cameraState.maxRiseMeters||0).toFixed(3)),horizontalDistanceMeters:cameraState.horizontalDistanceMeters||0,heightMeters:cameraState.heightMeters||0,fovDegrees:cameraState.fovDegrees||0};
  }
  return result;
};

document.title='小王 · 桂林地貌蒸馏实验室 v3.5.1';
const brandSmallV351=document.querySelector('.brand small');if(brandSmallV351)brandSmallV351.textContent='XIAOWANG · GUILIN GEOMORPHOLOGY DISTILLATION v3.5.1';
