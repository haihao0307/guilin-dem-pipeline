/* v3.6.3 visual consolidation: rounded karst tower, continuous paddy colour field and smoothed water edge. */

function paddyGrammarV363(worldX,worldY,seed=0){
  const broadAngle=fbm(worldX*.00068,worldY*.00068,seed+13,4)*1.05,ca=Math.cos(broadAngle),sa=Math.sin(broadAngle),warpX=fbm(worldX*.00115,worldY*.00115,seed+29,4)*29+fbm(worldX*.0055,worldY*.0055,seed+43,3)*4.8,warpY=fbm(worldX*.00115+6.1,worldY*.00115-4.7,seed+59,4)*29+fbm(worldX*.0055-5.8,worldY*.0055+7.3,seed+71,3)*4.8,px=worldX+warpX,py=worldY+warpY,u=px*ca+py*sa,v=-px*sa+py*ca;
  const coarse=worley(u*.0087,v*.0071,seed+89),fine=worley(u*.0225,v*.0178,seed+107),parentSeed=hash21(coarse.cellX,coarse.cellZ,seed+127),childSeed=hash21(fine.cellX,fine.cellZ,seed+149),coarseBoundary=smoothstep(.066,.011,coarse.f2-coarse.f1),fineBoundary=smoothstep(.047,.0075,fine.f2-fine.f1),subdivision=smoothstep(.32,.78,parentSeed),boundary=Math.max(coarseBoundary,fineBoundary*(.16+.72*subdivision));
  const canalWarp=fbm(worldX*.0010,worldY*.0010,seed+173,4)*63,canalA=ridged((u+canalWarp)*.0042,(v-canalWarp*.28)*.0012,seed+191,4),canalB=ridged((u-canalWarp*.35)*.0013,(v+canalWarp)*.0037,seed+211,4),irrigation=Math.max(smoothstep(.910,.982,canalA),smoothstep(.918,.984,canalB)*.62)*smoothstep(.075,.37,fine.f1),fieldSeed=clamp(childSeed*.68+parentSeed*.32,0,1),wetness=clamp((fieldSeed-.44)*1.68,0,1)*(.57+.43*fbm(worldX*.0023,worldY*.0023,seed+229,3));
  return{cell:fine,coarse,boundary,irrigation,fieldSeed,wetness,split:fineBoundary,orientation:broadAngle,parcelWidthMeters:[40,132],scale:1};
}
paddyGrammarV362=paddyGrammarV363;
paddyGrammarV360=paddyGrammarV363;
parcelGrammarV330=paddyGrammarV363;

const PADDY_STAGE_V363=[new THREE.Color(0x4d692d),new THREE.Color(0x648332),new THREE.Color(0x7c9638),new THREE.Color(0x94803c)],PADDY_GROUND_V363=new THREE.Color(0x50603a),PADDY_SOIL_V363=new THREE.Color(0x63543b),PADDY_WET_V363=new THREE.Color(0x4a6c60),PADDY_BUND_V363=new THREE.Color(0x4b402f),PADDY_CHANNEL_V363=new THREE.Color(0x355a51),PADDY_STAGE_SCRATCH_V363=new THREE.Color(),PADDY_COLOUR_SCRATCH_V363=new THREE.Color();
paddyParcelColourV351=function(field,index,worldX,worldY,slopeDeg){
  const inherited=field.paddySmoothV360?.[index]??field.paddyMask?.[index]??field.paddy?.[index]??field.valley?.[index]??0,mask=clamp(inherited,0,1),grammar=paddyGrammarV363(worldX,worldY,601),broad=fbm(worldX*.00082,worldY*.00082,7901,4),stageIndex=Math.min(3,Math.floor(grammar.fieldSeed*4)),stage=PADDY_STAGE_SCRATCH_V363.copy(PADDY_STAGE_V363[stageIndex]);
  stage.offsetHSL(0,broad*.002,broad*.011);stage.lerp(PADDY_WET_V363,clamp(grammar.wetness*.12*mask,0,.12));stage.lerp(PADDY_BUND_V363,clamp(grammar.boundary*.33*mask,0,.33));stage.lerp(PADDY_CHANNEL_V363,clamp(grammar.irrigation*.42*mask,0,.42));
  const colour=PADDY_COLOUR_SCRATCH_V363.copy(PADDY_GROUND_V363).lerp(PADDY_SOIL_V363,smoothstep(5,15,slopeDeg)*.26).lerp(stage,mask*.96),interior=clamp((1-grammar.boundary)*(1-grammar.irrigation)*mask,0,1),grain=fbm(worldX*.0105,worldY*.0105,7927,2);colour.offsetHSL(0,0,grain*.006*interior);return colour;
};

const terrainColourV363Base=terrainColourRichV330;
terrainColourRichV330=function(field,index,heightNorm,worldX,worldY,layer,slopeDeg){
  const colour=terrainColourV363Base(field,index,heightNorm,worldX,worldY,layer,slopeDeg);
  if(['paddy','atlas'].includes(state.preset.id)&&layer!=='local'){
    const mask=clamp(field.paddy?.[index]??field.valley?.[index]??0,0,1)*smoothstep(15,2.2,slopeDeg);
    if(mask>.015)colour.lerp(paddyParcelColourV351(field,index,worldX,worldY,slopeDeg),mask*(layer==='context'?.90:.62));
  }
  return colour;
};

analyticCliffV362=function(field,contextField,localCenter,peak){
  const n=field.n,rx=Math.max(76,peak.radiusX*1.38),ry=Math.max(76,peak.radiusY*1.38),ca=Math.cos(peak.angle),sa=Math.sin(peak.angle);let floor=0;
  for(let k=0;k<24;k++){const a=k/24*Math.PI*2;floor+=sampleField(contextField,peak.x+Math.cos(a)*rx*1.14,peak.y+Math.sin(a)*ry*1.14,'final')}floor/=24;
  const towerHeight=peak.targetHeight*.96;let detailMin=Infinity,detailMax=-Infinity;
  for(let z=0;z<n;z++)for(let x=0;x<n;x++){
    const i=z*n+x,wx=field.worldX[x],wy=field.worldY[z],dx=wx-peak.x,dy=wy-peak.y,warpA=fbm(wx*.00155,wy*.00155,peak.faceSeed+901,4),warpB=fbm(wx*.0048+5.3,wy*.0048-3.7,peak.faceSeed+919,3);let qx=(dx*ca+dy*sa)/rx,qy=(-dx*sa+dy*ca)/ry;
    const az0=Math.atan2(qy,qx),lobe=1+.038*Math.cos(az0*(peak.lobeCount||4)+peak.angle)+.015*Math.cos(az0*((peak.lobeCount||4)+2)+peak.seed*.0021);qx=(qx+warpA*.024+warpB*.007)/lobe;qy=(qy+fbm(wx*.00155+5.9,wy*.00155-4.2,peak.faceSeed+911,4)*.024-warpB*.006)/lobe;
    const r=Math.hypot(qx,qy);if(r>1.20)continue;let profile=0;
    if(r<=.24)profile=lerp(1,.92,smoothstep(0,.24,r));
    else if(r<=.56)profile=lerp(.92,.80,smoothstep(.24,.56,r));
    else if(r<=.80)profile=lerp(.80,.66,smoothstep(.56,.80,r));
    else if(r<=1.03){const t=clamp((r-.80)/.23,0,1);profile=.055+(.66-.055)*Math.pow(1-t,.48)}
    else profile=.055*Math.pow(1-smoothstep(1.03,1.20,r),1.55);
    const az=Math.atan2(qy,qx),middle=smoothstep(.24,.55,r)*(1-smoothstep(.87,1.06,r)),buttress=Math.pow(Math.max(0,Math.cos(az*((peak.lobeCount||4)+1)+peak.angle)),3.2)*middle*.032,context=field.contextFinalV346?.[i]??sampleField(contextField,wx,wy,'final'),terrainTilt=clamp(context-floor,-10,10)*.10,target=floor+terrainTilt+towerHeight*clamp(profile+buttress,0,1.04),flow=ridged((wx*Math.cos(az)+wy*Math.sin(az))*0.0065,(wx*-Math.sin(az)+wy*Math.cos(az))*0.0022,peak.faceSeed+947,4),groove=-smoothstep(.78,.965,flow)*middle*.72,cell=worley(wx*.012+warpA*.22,wy*.012-warpB*.18,peak.faceSeed+967),fracture=-smoothstep(.042,.007,cell.f2-cell.f1)*middle*.32,ledge=(ridged(wx*.0052,wy*.0052,peak.faceSeed+983,3)-.55)*middle*.42,detail=groove+fracture+ledge,edge=field.visualEdgeV347?.[i]??field.localEdge?.[i]??edgeFeather(wx-localCenter.x,wy-localCenter.y,field.extent,.30),support=(1-smoothstep(1.02,1.20,r))*edge;
    if(support<=.001)continue;field.final[i]=lerp(context,target+detail,support*support*(3-2*support));if(field.micro)field.micro[i]+=detail*support;detailMin=Math.min(detailMin,detail);detailMax=Math.max(detailMax,detail);
  }
  if(field.stats){field.stats.analyticCliffDetailRange=[Number.isFinite(detailMin)?detailMin:0,Number.isFinite(detailMax)?detailMax:0];field.stats.analyticCliffProfile='continuous-rounded-crown+resolved-wall+soft-toe'}
};

const createWaterMeshV363Base=createWaterMesh;
createWaterMesh=function(sections,...args){
  if(!sections?.length)return createWaterMeshV363Base(sections,...args);
  const smooth=sections.map((section,index)=>({...section,...smoothRiverSectionV362(sections,index,7),s:section.s,tx:section.tx,ty:section.ty}));
  return createWaterMeshV363Base(smooth,...args);
};

configureCamera=function(view,build=state.currentBuild){
  if(!build)return;const offset=build.localOffset||{x:0,z:0},targetHeight=build.localTargetHeight||260,id=state.preset.id;
  if(id==='atlas'){camera.fov=37;camera.position.set(3000,1390,4250);controls.target.set(0,230,-350)}
  else if(id==='paddy'){const clear=paddyCameraAzimuthV350(build),terrainHeight=sampleField(build.local,build.local.center.x,build.local.center.y,'final')-build.datum,distance=isMobile?235:300,height=isMobile?300:350;camera.fov=isMobile?38:36;camera.position.set(offset.x+Math.cos(clear.angle)*distance,terrainHeight+height,offset.z+Math.sin(clear.angle)*distance);controls.target.set(offset.x,terrainHeight+3,offset.z-12);state.paddyCameraV350={azimuthRadians:clear.angle,obstructionScore:clear.score,maxRiseMeters:clear.maxRise,meanPositiveRiseMeters:clear.meanRise,horizontalDistanceMeters:distance,heightMeters:height,fovDegrees:camera.fov}}
  else if(id==='river'){camera.fov=38;camera.position.set(offset.x+1120,targetHeight+500,offset.z+1510);controls.target.set(offset.x-105,targetHeight+12,offset.z-270)}
  else{const peak=state.selectedCliffPeakV346,base=(peak?.floor??build.localTargetHeight)-build.datum,height=peak?.targetHeight??210,angle=(peak?.angle??0)+1.02,distance=clamp(height*3.0,700,980),px=(peak?.x??build.local.center.x)-build.origin.x,pz=(peak?.y??build.local.center.y)-build.origin.y,cameraX=px+Math.cos(angle)*distance,cameraZ=pz+Math.sin(angle)*distance,worldX=build.origin.x+cameraX,worldY=build.origin.y+cameraZ,ground=Math.max(sampleField(build.context,worldX,worldY,'final')-build.datum,sampleField(build.regional,worldX,worldY,'final')-build.datum);camera.fov=40;camera.position.set(cameraX,Math.max(base+height*.76+120,ground+150),cameraZ);controls.target.set(px,base+height*.43,pz)}
  camera.updateProjectionMatrix();controls.update();
};

const makeQAV363Base=makeQA;
makeQA=function(build){const qa=makeQAV363Base(build);qa.richTerrainPass='v3.6.3';qa.paddyColourContinuity='regional+context+local-shared-grammar';qa.cliffLocalProfile=build.local?.stats?.analyticCliffProfile||null;qa.waterEdgeModel='seven-section-smoothed-cross-sections';qa.visualAcceptance=false;qa.productionReady=false;return qa};

const buildPresetV363Base=buildPreset;
buildPreset=async function(id,options={}){const result=await buildPresetV363Base(id,options);configureCamera(state.preset.view,state.currentBuild);if(window.__terrainV320QA?.ready)window.__terrainV320QA.richTerrainPass='v3.6.3';setStatus('桂林多场地貌 v3.6.3 已加载',`${state.currentBuild.candidate.name} · 峰壁圆化、田块连续和水岸平滑协作`);return result};

document.title='小王 · 桂林多场地貌蒸馏实验室 v3.6.3';
const brandSmallV363=document.querySelector('.brand small');if(brandSmallV363)brandSmallV363.textContent='XIAOWANG · GUILIN MULTI-FIELD TERRAIN DISTILLATION v3.6.3';
