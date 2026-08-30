/* v3.6.5 terrain inheritance pass: paddy follows the real valley floor and cliff detail carves the contextual tower without replacing its mass. */

const buildContextFieldsV365Base=buildContextFields;
buildContextFields=function(analysis,peaks,mode){
  const field=buildContextFieldsV365Base(analysis,peaks,mode);if(state.enhanceMix===0)return field;
  const blur1=boxBlur(field.final,field.n,1),blur2=boxBlur(field.final,field.n,2);
  for(let i=0;i<field.final.length;i++){
    const karst=clamp(field.karst?.[i]||0,0,1),valley=clamp(field.valley?.[i]||0,0,1),slope=field.slope?.[i]||0,mask=karst*smoothstep(34,69,slope)*(1-valley)*.44;
    if(mask>.001)field.final[i]=lerp(field.final[i],blur1[i]*.72+blur2[i]*.28,mask);
  }
  return field;
};

function karstFaceDetailV365(worldX,worldY,height,gx,gy,mask,seed=0){
  const mag=Math.hypot(gx,gy)||1,ux=gx/mag,uy=gy/mag,along=worldX*ux+worldY*uy,across=-worldX*uy+worldY*ux,warp=fbm(worldX*.0020,worldY*.0020,seed+17,4),flow=ridged(across*.015+warp*.55,along*.0032,seed+37,4),groove=-smoothstep(.79,.965,flow)*.72,large=worley(worldX*.0082+warp*.25,worldY*.0082-warp*.18,seed+59),small=worley(worldX*.023,worldY*.023,seed+83),fracture=-smoothstep(.070,.011,large.f2-large.f1)*.42-smoothstep(.047,.007,small.f2-small.f1)*.18,bedding=Math.sin(height*.082+across*.019+warp*2.1)*.16,ledge=(ridged(worldX*.0051,worldY*.0051,seed+107,3)-.56)*.36;
  return clamp((groove+fracture+bedding+ledge)*mask,-1.35,.62);
}

const buildLocalFieldsV365Base=buildLocalFields;
buildLocalFields=function(contextField,localCenter,mode,data,candidate,riverSections){
  const field=buildLocalFieldsV365Base(contextField,localCenter,mode,data,candidate,riverSections);if(state.enhanceMix===0)return field;
  const n=field.n,count=n*n,contextBase=new Float32Array(count);
  for(let z=0;z<n;z++)for(let x=0;x<n;x++){
    const i=z*n+x,wx=field.worldX[x],wy=field.worldY[z];contextBase[i]=field.contextFinalV346?.[i]??sampleField(contextField,wx,wy,'final');
  }
  if(mode==='paddy'){
    const rawMask=field.paddyMask||new Float32Array(count),maskA=boxBlur(rawMask,n,isMobile?5:9),maskB=boxBlur(maskA,n,isMobile?3:5),smoothMask=new Float32Array(count);let bundMax=0,channelMax=0,active=0;
    for(let z=0;z<n;z++)for(let x=0;x<n;x++){
      const i=z*n+x,wx=field.worldX[x],wy=field.worldY[z],x0=Math.max(0,x-4),x1=Math.min(n-1,x+4),z0=Math.max(0,z-4),z1=Math.min(n-1,z+4),gx=(contextBase[z*n+x1]-contextBase[z*n+x0])/Math.max(1,(x1-x0)*field.spacing),gy=(contextBase[z1*n+x]-contextBase[z0*n+x])/Math.max(1,(z1-z0)*field.spacing),slope=Math.atan(Math.hypot(gx,gy))*180/Math.PI,parent=smoothstep(.18,.62,maskB[i])*smoothstep(7.5,1.0,slope),grammar=paddyGrammarV364(wx,wy,601),bund=grammar.boundary*(.080+grammar.fieldSeed*.055),channel=grammar.irrigation*(.045+.040*(1-grammar.fieldSeed)),micro=fbm((wx-450000)*.018,(wy-2750000)*.018,8209,2)*.0035*(1-grammar.boundary),detail=(bund-channel+micro)*parent,edge=field.visualEdgeV347?.[i]??field.localEdge?.[i]??edgeFeather(wx-localCenter.x,wy-localCenter.y,field.extent,.38),blend=edge*edge*(3-2*edge);
      field.final[i]=contextBase[i]+detail*state.bund*blend;smoothMask[i]=parent;bundMax=Math.max(bundMax,bund*parent);channelMax=Math.max(channelMax,channel*parent);if(parent>.45)active++;
    }
    field.paddyMask=smoothMask;field.paddySmoothV360=smoothMask;
    if(field.stats){field.stats.paddyVertices=active;field.stats.bundMax=bundMax;field.stats.paddyChannelMaximum=channelMax;field.stats.paddyFloorModel='context-inherited+micro-bunds+micro-canals';field.stats.paddyTerraceQuantization=false}
    return field;
  }
  if(mode==='cliff'){
    const rawDetail=new Float32Array(count),smoothedContext=boxBlur(contextBase,n,isMobile?2:3);let detailMin=Infinity,detailMax=-Infinity,active=0;
    for(let z=0;z<n;z++)for(let x=0;x<n;x++){
      const i=z*n+x,x0=Math.max(0,x-3),x1=Math.min(n-1,x+3),z0=Math.max(0,z-3),z1=Math.min(n-1,z+3),gx=(smoothedContext[z*n+x1]-smoothedContext[z*n+x0])/Math.max(1,(x1-x0)*field.spacing),gy=(smoothedContext[z1*n+x]-smoothedContext[z0*n+x])/Math.max(1,(z1-z0)*field.spacing),slope=Math.atan(Math.hypot(gx,gy))*180/Math.PI,karst=clamp(field.karst?.[i]??sampleField(contextField,field.worldX[x],field.worldY[z],'karst')??smoothstep(18,45,slope),0,1),mask=karst*smoothstep(18,50,slope),edge=field.visualEdgeV347?.[i]??field.localEdge?.[i]??edgeFeather(field.worldX[x]-localCenter.x,field.worldY[z]-localCenter.y,field.extent,.32);
      rawDetail[i]=karstFaceDetailV365(field.worldX[x],field.worldY[z],smoothedContext[i],gx,gy,mask,8303)*edge;if(mask>.25)active++;
    }
    const detailBlur=boxBlur(rawDetail,n,isMobile?1:2);
    for(let i=0;i<count;i++){
      const detail=rawDetail[i]*.72+detailBlur[i]*.28;field.final[i]=contextBase[i]+detail*state.process;detailMin=Math.min(detailMin,detail);detailMax=Math.max(detailMax,detail);if(field.micro)field.micro[i]=detail;
    }
    if(field.stats){field.stats.karstVertices=active;field.stats.analyticCliffProfile='context-mass-preserved+slope-led-carving';field.stats.analyticCliffDetailRange=[Number.isFinite(detailMin)?detailMin:0,Number.isFinite(detailMax)?detailMax:0];field.stats.cliffMassReplacement=false}
  }
  return field;
};

function clearCliffCameraV365(build,peak){
  const origin=build.origin,datum=build.datum,base=(peak.floor??build.localTargetHeight)-datum,height=peak.targetHeight??210,targetY=base+height*.43,distance=clamp(height*3.45,780,1160);let best=null;
  for(let k=0;k<20;k++){
    const angle=(peak.angle??0)+k/20*Math.PI*2,worldX=peak.x+Math.cos(angle)*distance,worldY=peak.y+Math.sin(angle)*distance,ground=Math.max(sampleField(build.context,worldX,worldY,'final'),sampleField(build.regional,worldX,worldY,'final'))-datum,camY=Math.max(base+height*.82+135,ground+145);let obstruction=-Infinity,roughness=0,last=null;
    for(let s=1;s<=14;s++){
      const t=s/15,sx=lerp(worldX,peak.x,t),sy=lerp(worldY,peak.y,t),terrain=Math.max(sampleField(build.context,sx,sy,'final'),sampleField(build.regional,sx,sy,'final'))-datum,line=lerp(camY,targetY,t);obstruction=Math.max(obstruction,terrain-line);if(last!==null)roughness+=Math.abs(terrain-last);last=terrain;
    }
    const score=Math.max(0,obstruction)*12+roughness*.08+Math.abs(Math.sin(angle-(peak.angle??0)))*4;if(!best||score<best.score)best={angle,worldX,worldY,camY,score,obstruction,distance,targetY};
  }
  return best;
}

configureCamera=function(view,build=state.currentBuild){
  if(!build)return;const offset=build.localOffset||{x:0,z:0},targetHeight=build.localTargetHeight||260,id=state.preset.id;
  if(id==='atlas'){camera.fov=37;camera.position.set(3000,1390,4250);controls.target.set(0,230,-350)}
  else if(id==='paddy'){const clear=paddyCameraAzimuthV350(build),terrainHeight=sampleField(build.local,build.local.center.x,build.local.center.y,'final')-build.datum,distance=isMobile?285:380,height=isMobile?355:430;camera.fov=isMobile?39:37;camera.position.set(offset.x+Math.cos(clear.angle)*distance,terrainHeight+height,offset.z+Math.sin(clear.angle)*distance);controls.target.set(offset.x,terrainHeight+4,offset.z-18);state.paddyCameraV350={azimuthRadians:clear.angle,obstructionScore:clear.score,maxRiseMeters:clear.maxRise,meanPositiveRiseMeters:clear.meanRise,horizontalDistanceMeters:distance,heightMeters:height,fovDegrees:camera.fov}}
  else if(id==='river'){camera.fov=38;camera.position.set(offset.x+1120,targetHeight+500,offset.z+1510);controls.target.set(offset.x-105,targetHeight+12,offset.z-270)}
  else{const peak=state.selectedCliffPeakV346,clear=clearCliffCameraV365(build,peak),px=peak.x-build.origin.x,pz=peak.y-build.origin.y;camera.fov=40;camera.position.set(clear.worldX-build.origin.x,clear.camY,clear.worldY-build.origin.y);controls.target.set(px,clear.targetY,pz);state.cliffCameraV365=clear}
  camera.updateProjectionMatrix();controls.update();
};

const makeQAV365Base=makeQA;
makeQA=function(build){const qa=makeQAV365Base(build),stats=build.local?.stats||{};qa.richTerrainPass='v3.6.5';qa.paddyFloorModel=stats.paddyFloorModel||null;qa.paddyTerraceQuantization=stats.paddyTerraceQuantization??null;qa.cliffMassReplacement=stats.cliffMassReplacement??null;qa.cliffLocalProfile=stats.analyticCliffProfile||null;qa.cliffLocalDetailRange=stats.analyticCliffDetailRange||[0,0];qa.cliffCameraClearance=state.cliffCameraV365?{obstructionMeters:Number(state.cliffCameraV365.obstruction.toFixed(3)),score:Number(state.cliffCameraV365.score.toFixed(3))}:null;qa.visualAcceptance=false;qa.productionReady=false;return qa};

const buildPresetV365Base=buildPreset;
buildPreset=async function(id,options={}){const result=await buildPresetV365Base(id,options);configureCamera(state.preset.view,state.currentBuild);if(window.__terrainV320QA?.ready)window.__terrainV320QA.richTerrainPass='v3.6.5';setStatus('桂林多场地貌 v3.6.5 已加载',`${state.currentBuild.candidate.name} · 真实谷底继承、细田埂、坡向溶沟和无替换塔峰协作`);return result};

document.title='小王 · 桂林多场地貌蒸馏实验室 v3.6.5';
const brandSmallV365=document.querySelector('.brand small');if(brandSmallV365)brandSmallV365.textContent='XIAOWANG · GUILIN MULTI-FIELD TERRAIN DISTILLATION v3.6.5';
