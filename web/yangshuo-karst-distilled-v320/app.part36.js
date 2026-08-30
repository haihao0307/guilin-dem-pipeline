/* v3.6.4 stability and karst character pass: anchored paddy coordinates, isolated tower selection and non-cylindrical cliff relief. */

function paddyGrammarV364(worldX,worldY,seed=0){
  const lx=worldX-450000,ly=worldY-2750000,broadAngle=fbm(lx*.00068,ly*.00068,seed+13,4)*1.05,ca=Math.cos(broadAngle),sa=Math.sin(broadAngle),warpX=fbm(lx*.00115,ly*.00115,seed+29,4)*29+fbm(lx*.0055,ly*.0055,seed+43,3)*4.8,warpY=fbm(lx*.00115+6.1,ly*.00115-4.7,seed+59,4)*29+fbm(lx*.0055-5.8,ly*.0055+7.3,seed+71,3)*4.8,px=lx+warpX,py=ly+warpY,u=px*ca+py*sa,v=-px*sa+py*ca;
  const coarse=worley(u*.0087,v*.0071,seed+89),fine=worley(u*.0225,v*.0178,seed+107),parentSeed=hash21(coarse.cellX,coarse.cellZ,seed+127),childSeed=hash21(fine.cellX,fine.cellZ,seed+149),coarseBoundary=smoothstep(.066,.011,coarse.f2-coarse.f1),fineBoundary=smoothstep(.047,.0075,fine.f2-fine.f1),subdivision=smoothstep(.32,.78,parentSeed),boundary=Math.max(coarseBoundary,fineBoundary*(.16+.72*subdivision));
  const canalWarp=fbm(lx*.0010,ly*.0010,seed+173,4)*63,canalA=ridged((u+canalWarp)*.0042,(v-canalWarp*.28)*.0012,seed+191,4),canalB=ridged((u-canalWarp*.35)*.0013,(v+canalWarp)*.0037,seed+211,4),irrigation=Math.max(smoothstep(.910,.982,canalA),smoothstep(.918,.984,canalB)*.62)*smoothstep(.075,.37,fine.f1),fieldSeed=clamp(childSeed*.68+parentSeed*.32,0,1),wetness=clamp((fieldSeed-.44)*1.68,0,1)*(.57+.43*fbm(lx*.0023,ly*.0023,seed+229,3));
  return{cell:fine,coarse,boundary,irrigation,fieldSeed,wetness,split:fineBoundary,orientation:broadAngle,parcelWidthMeters:[40,132],scale:1};
}
paddyGrammarV363=paddyGrammarV364;
paddyGrammarV362=paddyGrammarV364;
paddyGrammarV360=paddyGrammarV364;
parcelGrammarV330=paddyGrammarV364;

const chooseLocalCenterV364Base=chooseLocalCenter;
chooseLocalCenter=function(preset,focus,paddyFocus,riverModel){
  if(preset?.detailMode==='cliff'&&state.contextPeaksV346?.length){
    const towers=state.contextPeaksV346.filter(peak=>peak.kindV360==='tower');
    const ranked=towers.map(peak=>{
      let nearest=Infinity;for(const other of state.contextPeaksV346){if(other===peak)continue;nearest=Math.min(nearest,Math.hypot(other.x-peak.x,other.y-peak.y))}
      const isolation=clamp(nearest/Math.max(90,Math.sqrt(peak.radiusX*peak.radiusY)*2.2),.5,3.2),distancePenalty=Math.hypot(peak.x-focus.x,peak.y-focus.y)*.20,score=peak.targetHeight*(.72+.28*(peak.ratio||1))*isolation-distancePenalty;
      return{peak,score,isolation,nearest};
    }).sort((a,b)=>b.score-a.score);
    if(ranked.length){state.selectedCliffPeakV346=ranked[0].peak;state.selectedCliffPeakV364=ranked[0];return{x:ranked[0].peak.x,y:ranked[0].peak.y}}
  }
  return chooseLocalCenterV364Base(preset,focus,paddyFocus,riverModel);
};

analyticCliffV362=function(field,contextField,localCenter,peak){
  const n=field.n,rx=Math.max(94,peak.radiusX*1.56),ry=Math.max(94,peak.radiusY*1.56),ca=Math.cos(peak.angle),sa=Math.sin(peak.angle);let floor=0;
  for(let k=0;k<32;k++){const a=k/32*Math.PI*2;floor+=sampleField(contextField,peak.x+Math.cos(a)*rx*1.13,peak.y+Math.sin(a)*ry*1.13,'final')}floor/=32;
  const towerHeight=peak.targetHeight*.86,notchAngle=hash21(peak.seed,.219,8101)*Math.PI*2,notchAngle2=notchAngle+1.55+hash21(peak.seed,.771,8117)*1.25;let detailMin=Infinity,detailMax=-Infinity;
  for(let z=0;z<n;z++)for(let x=0;x<n;x++){
    const i=z*n+x,wx=field.worldX[x],wy=field.worldY[z],dx=wx-peak.x,dy=wy-peak.y,warpA=fbm(wx*.00145,wy*.00145,peak.faceSeed+1001,4),warpB=fbm(wx*.0046+5.3,wy*.0046-3.7,peak.faceSeed+1019,3);let qx=(dx*ca+dy*sa)/rx,qy=(-dx*sa+dy*ca)/ry;
    const az0=Math.atan2(qy,qx),lobe=1+.082*Math.cos(az0*(peak.lobeCount||4)+peak.angle)+.034*Math.cos(az0*((peak.lobeCount||4)+2)+peak.seed*.0021)+warpA*.018;qx=(qx+warpA*.022+warpB*.007)/lobe;qy=(qy+fbm(wx*.00145+5.9,wy*.00145-4.2,peak.faceSeed+1011,4)*.022-warpB*.006)/lobe;
    const r=Math.hypot(qx,qy);if(r>1.22)continue;let profile=0;
    if(r<=.22)profile=lerp(1,.91,smoothstep(0,.22,r));
    else if(r<=.52)profile=lerp(.91,.79,smoothstep(.22,.52,r));
    else if(r<=.78)profile=lerp(.79,.64,smoothstep(.52,.78,r));
    else if(r<=1.04){const t=clamp((r-.78)/.26,0,1);profile=.045+(.64-.045)*Math.pow(1-t,.54)}
    else profile=.045*Math.pow(1-smoothstep(1.04,1.22,r),1.6);
    const az=Math.atan2(qy,qx),middle=smoothstep(.20,.50,r)*(1-smoothstep(.88,1.08,r)),sector=Math.pow(Math.max(0,Math.cos(az-notchAngle)),7),sector2=Math.pow(Math.max(0,Math.cos(az-notchAngle2)),10),collapse=(sector*.105+sector2*.060)*middle*(.55+.45*ridged(wx*.0031,wy*.0031,peak.faceSeed+1037,3)),buttress=Math.pow(Math.max(0,Math.cos(az*((peak.lobeCount||4)+1)+peak.angle)),3.0)*middle*.050;
    profile=clamp(profile-collapse+buttress,0,1.04);
    const context=field.contextFinalV346?.[i]??sampleField(contextField,wx,wy,'final'),terrainTilt=clamp(context-floor,-12,12)*.12,target=floor+terrainTilt+towerHeight*profile,flow=ridged((wx*Math.cos(az)+wy*Math.sin(az))*.0058,(wx*-Math.sin(az)+wy*Math.cos(az))*.0020,peak.faceSeed+1061,4),groove=-smoothstep(.80,.966,flow)*middle*1.25,cell=worley(wx*.0092+warpA*.22,wy*.0092-warpB*.18,peak.faceSeed+1087),fracture=-smoothstep(.050,.008,cell.f2-cell.f1)*middle*.72,ledge=(ridged(wx*.0037,wy*.0037,peak.faceSeed+1103,3)-.56)*middle*.78,detail=groove+fracture+ledge,edge=field.visualEdgeV347?.[i]??field.localEdge?.[i]??edgeFeather(wx-localCenter.x,wy-localCenter.y,field.extent,.31),support=(1-smoothstep(1.03,1.22,r))*edge;
    if(support<=.001)continue;field.final[i]=lerp(context,target+detail,support*support*(3-2*support));if(field.micro)field.micro[i]+=detail*support;detailMin=Math.min(detailMin,detail);detailMax=Math.max(detailMax,detail);
  }
  if(field.stats){field.stats.analyticCliffDetailRange=[Number.isFinite(detailMin)?detailMin:0,Number.isFinite(detailMax)?detailMax:0];field.stats.analyticCliffProfile='asymmetric-rounded-tower+collapse-notches+buttressed-wall+soft-toe';field.stats.cliffIsolation=state.selectedCliffPeakV364?.isolation||0}
};

const buildContextFieldsV364Base=buildContextFields;
buildContextFields=function(analysis,peaks,mode){
  const field=buildContextFieldsV364Base(analysis,peaks,mode);if(state.enhanceMix===0)return field;const blur=boxBlur(field.final,field.n,2);
  for(let i=0;i<field.final.length;i++){const mask=clamp(field.karst?.[i]||0,0,1)*smoothstep(28,62,field.slope?.[i]||0)*(1-clamp(field.valley?.[i]||0,0,1))*.38;if(mask>.001)field.final[i]=lerp(field.final[i],blur[i],mask)}return field;
};

const terrainColourV364Base=terrainColourRichV330;
terrainColourRichV330=function(field,index,heightNorm,worldX,worldY,layer,slopeDeg){
  const colour=terrainColourV364Base(field,index,heightNorm,worldX,worldY,layer,slopeDeg);
  if(layer==='local'&&state.preset.id==='cliff'){
    const broad=fbm(worldX*.0018,worldY*.0018,8131,4),patch=ridged(worldX*.0045+broad*.25,worldY*.0045-broad*.18,8147,4),cell=worley(worldX*.0078,worldY*.0078,8161),fracture=smoothstep(.055,.009,cell.f2-cell.f1),exposure=smoothstep(28,62,slopeDeg),lower=(1-heightNorm)*smoothstep(18,48,slopeDeg),rock=RICH_PALETTE_V330.karstMid.clone().lerp(RICH_PALETTE_V330.limestone,.34+.26*patch);
    rock.lerp(RICH_PALETTE_V330.limestoneLight,clamp(exposure*smoothstep(.63,.91,patch)*.34,0,.34));rock.lerp(RICH_PALETTE_V330.karstDark,clamp(fracture*.18+lower*.20,0,.26));rock.lerp(RICH_PALETTE_V330.moss,clamp((1-exposure)*.15+lower*.13,0,.24));colour.copy(rock);colour.offsetHSL(0,broad*.006,broad*.012);
  }
  return colour;
};

const makeTerrainMaterialV364Base=makeTerrainMaterialRichV330;
makeTerrainMaterialRichV330=function(layer){const material=makeTerrainMaterialV364Base(layer);if(layer==='local'&&state.preset.id==='cliff'){material.bumpMap=null;material.roughnessMap=null;material.roughness=.97;material.metalness=0;material.needsUpdate=true}return material};

configureCamera=function(view,build=state.currentBuild){
  if(!build)return;const offset=build.localOffset||{x:0,z:0},targetHeight=build.localTargetHeight||260,id=state.preset.id;
  if(id==='atlas'){camera.fov=37;camera.position.set(3000,1390,4250);controls.target.set(0,230,-350)}
  else if(id==='paddy'){const clear=paddyCameraAzimuthV350(build),terrainHeight=sampleField(build.local,build.local.center.x,build.local.center.y,'final')-build.datum,distance=isMobile?270:350,height=isMobile?340:410;camera.fov=isMobile?39:37;camera.position.set(offset.x+Math.cos(clear.angle)*distance,terrainHeight+height,offset.z+Math.sin(clear.angle)*distance);controls.target.set(offset.x,terrainHeight+4,offset.z-18);state.paddyCameraV350={azimuthRadians:clear.angle,obstructionScore:clear.score,maxRiseMeters:clear.maxRise,meanPositiveRiseMeters:clear.meanRise,horizontalDistanceMeters:distance,heightMeters:height,fovDegrees:camera.fov}}
  else if(id==='river'){camera.fov=38;camera.position.set(offset.x+1120,targetHeight+500,offset.z+1510);controls.target.set(offset.x-105,targetHeight+12,offset.z-270)}
  else{const peak=state.selectedCliffPeakV346,base=(peak?.floor??build.localTargetHeight)-build.datum,height=peak?.targetHeight??210,angle=(peak?.angle??0)+1.10,distance=clamp(height*4.0,980,1380),px=(peak?.x??build.local.center.x)-build.origin.x,pz=(peak?.y??build.local.center.y)-build.origin.y,cameraX=px+Math.cos(angle)*distance,cameraZ=pz+Math.sin(angle)*distance,worldX=build.origin.x+cameraX,worldY=build.origin.y+cameraZ,ground=Math.max(sampleField(build.context,worldX,worldY,'final')-build.datum,sampleField(build.regional,worldX,worldY,'final')-build.datum);camera.fov=40;camera.position.set(cameraX,Math.max(base+height*.92+160,ground+170),cameraZ);controls.target.set(px,base+height*.40,pz)}
  camera.updateProjectionMatrix();controls.update();
};

const makeQAV364Base=makeQA;
makeQA=function(build){const qa=makeQAV364Base(build);qa.richTerrainPass='v3.6.4';qa.paddyCoordinateFrame='anchored-epsg32649-local-metric';qa.cliffSelection='isolated-tower-score';qa.cliffIsolation=Number((build.local?.stats?.cliffIsolation||0).toFixed(3));qa.cliffLocalProfile=build.local?.stats?.analyticCliffProfile||null;qa.cliffColourModel='limestone-exposure+wet-fracture+moss-foot';qa.visualAcceptance=false;qa.productionReady=false;return qa};

const buildPresetV364Base=buildPreset;
buildPreset=async function(id,options={}){const result=await buildPresetV364Base(id,options);configureCamera(state.preset.view,state.currentBuild);if(window.__terrainV320QA?.ready)window.__terrainV320QA.richTerrainPass='v3.6.4';setStatus('桂林多场地貌 v3.6.4 已加载',`${state.currentBuild.candidate.name} · 稳定田块坐标、独立塔峰、崩塌缺口和岩面色层协作`);return result};

document.title='小王 · 桂林多场地貌蒸馏实验室 v3.6.4';
const brandSmallV364=document.querySelector('.brand small');if(brandSmallV364)brandSmallV364.textContent='XIAOWANG · GUILIN MULTI-FIELD TERRAIN DISTILLATION v3.6.4';
