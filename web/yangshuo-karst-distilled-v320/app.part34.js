/* v3.6.2 geomorphology repair: continuous karst walls, engineered paddy floor and smooth asymmetric river banks. */

const buildContextFieldsV362Base=buildContextFields;
buildContextFields=function(analysis,peaks,mode){
  const field=buildContextFieldsV362Base(analysis,peaks,mode);
  if(state.enhanceMix===0)return field;
  const blur1=boxBlur(field.final,field.n,1),blur2=boxBlur(field.final,field.n,2);
  for(let i=0;i<field.final.length;i++){
    const karst=clamp(field.karst?.[i]||0,0,1),valley=clamp(field.valley?.[i]||0,0,1),slope=field.slope?.[i]||0;
    const mask=karst*smoothstep(17,48,slope)*(1-valley)*.62;
    if(mask>.001)field.final[i]=lerp(field.final[i],blur1[i]*.68+blur2[i]*.32,mask);
  }
  return field;
};

function paddyGrammarV362(worldX,worldY,seed=0){
  const warpX=fbm(worldX*.00105,worldY*.00105,seed+17,4)*31+fbm(worldX*.0052,worldY*.0052,seed+31,3)*5.2;
  const warpY=fbm(worldX*.00105+6.7,worldY*.00105-4.3,seed+47,4)*31+fbm(worldX*.0052-5.2,worldY*.0052+7.8,seed+61,3)*5.2;
  const coarse=worley((worldX+warpX)*.0090,(worldY+warpY)*.0081,seed+83),fine=worley((worldX+warpX*.48)*.0235,(worldY+warpY*.48)*.0205,seed+103);
  const coarseBoundary=smoothstep(.071,.012,coarse.f2-coarse.f1),fineBoundary=smoothstep(.052,.008,fine.f2-fine.f1),parentSeed=hash21(coarse.cellX,coarse.cellZ,seed+127),childSeed=hash21(fine.cellX,fine.cellZ,seed+149);
  const subdivision=smoothstep(.30,.76,parentSeed),boundary=Math.max(coarseBoundary,fineBoundary*(.18+.74*subdivision));
  const flowWarp=fbm(worldX*.0010,worldY*.0010,seed+173,4)*68,canalA=ridged((worldX+flowWarp)*.0040,(worldY-flowWarp*.32)*.00115,seed+191,4),canalB=ridged((worldX-flowWarp*.40)*.00125,(worldY+flowWarp)*.0035,seed+211,4);
  const irrigation=Math.max(smoothstep(.885,.978,canalA),smoothstep(.895,.980,canalB)*.64)*smoothstep(.07,.36,fine.f1);
  const fieldSeed=clamp(childSeed*.70+parentSeed*.30,0,1),wetness=clamp((fieldSeed-.43)*1.70,0,1)*(.56+.44*fbm(worldX*.0022,worldY*.0022,seed+229,3)),angle=fbm(worldX*.00072,worldY*.00072,seed+251,3)*.82;
  return{cell:fine,coarse,boundary,irrigation,fieldSeed,wetness,split:fineBoundary,orientation:angle,parcelWidthMeters:[38,124],scale:1};
}
paddyGrammarV360=paddyGrammarV362;
parcelGrammarV330=paddyGrammarV362;

paddyDetail=function(worldX,worldY,truth,base,valleyMask,slopeDeg,seed=0){
  const parent=valleyMask*smoothstep(8.2,1.15,slopeDeg);if(parent<.001)return{delta:0,bund:0,channel:0,mask:0};
  const grammar=paddyGrammarV362(worldX,worldY,seed),step=.12+grammar.fieldSeed*.085,offset=(grammar.fieldSeed-.5)*.055,terrace=Math.round((base+offset)/step)*step-offset;
  const flatten=clamp((terrace-base)*.70,-.16,.16),bund=grammar.boundary*(.105+grammar.fieldSeed*.070),channel=grammar.irrigation*(.062+.050*(1-grammar.fieldSeed)),micro=fbm(worldX*.018,worldY*.018,seed+277,2)*.004*(1-grammar.boundary),delta=clamp((flatten+bund-channel+micro)*parent,-.22,.22);
  return{delta,bund:bund*parent,channel:channel*parent,mask:parent,fieldSeed:grammar.fieldSeed,wetness:grammar.wetness};
};

function analyticCliffV362(field,contextField,localCenter,peak){
  const n=field.n,rx=Math.max(54,peak.radiusX*1.13),ry=Math.max(54,peak.radiusY*1.13),ca=Math.cos(peak.angle),sa=Math.sin(peak.angle);
  let detailMin=Infinity,detailMax=-Infinity;
  for(let z=0;z<n;z++)for(let x=0;x<n;x++){
    const i=z*n+x,wx=field.worldX[x],wy=field.worldY[z],dx=wx-peak.x,dy=wy-peak.y;
    let qx=(dx*ca+dy*sa)/rx,qy=(-dx*sa+dy*ca)/ry;
    const warpA=fbm(wx*.0018,wy*.0018,peak.faceSeed+801,4),warpB=fbm(wx*.0052+4.1,wy*.0052-6.3,peak.faceSeed+823,3),az0=Math.atan2(qy,qx),lobe=1+.050*Math.cos(az0*(peak.lobeCount||4)+peak.angle)+.020*Math.cos(az0*((peak.lobeCount||4)+2)+peak.seed*.002);
    qx=(qx+warpA*.028+warpB*.009)/lobe;qy=(qy+fbm(wx*.0018+5.2,wy*.0018-3.8,peak.faceSeed+811,4)*.028-warpB*.007)/lobe;
    const r=superellipseRadiusV340(qx,qy,peak.superPower||2.7);if(r>1.20)continue;
    const az=Math.atan2(qy,qx),crownR=.27+hash21(peak.seed,.349,7603)*.11,wallKnee=.72+hash21(peak.seed,.617,7619)*.07;
    let profile=0;
    if(r<=crownR){const t=r/crownR;profile=1-(.12+hash21(peak.seed,.479,7639)*.08)*Math.pow(t,1.45)}
    else if(r<=wallKnee){const t=(r-crownR)/(wallKnee-crownR);profile=.84-.105*Math.pow(t,1.35)}
    else if(r<=1){const t=(r-wallKnee)/(1-wallKnee);profile=.735*Math.pow(1-smoothstep(0,1,t),.34)}
    else profile=.070*Math.pow(1-smoothstep(1,1.20,r),1.65);
    const mid=smoothstep(crownR*.85,.56,r)*(1-smoothstep(.83,1.03,r)),buttress=Math.pow(Math.max(0,Math.cos(az*((peak.lobeCount||4)+1)+peak.angle)),3.4)*mid*.055;
    const ledge=Math.sin((peak.floor+peak.targetHeight*profile)*.092+fbm(wx*.0061,wy*.0061,peak.faceSeed+839,3)*1.5)*mid*.010;
    const cell=worley(wx*.0105+warpA*.25,wy*.0105-warpB*.20,peak.faceSeed+853),fracture=-smoothstep(.045,.007,cell.f2-cell.f1)*mid*.020;
    const target=peak.floor+peak.targetHeight*clamp(profile+buttress+ledge+fracture,0,1.07),context=field.contextFinalV346?.[i]??sampleField(contextField,wx,wy,'final'),support=(1-smoothstep(.96,1.20,r))*(field.visualEdgeV347?.[i]??field.localEdge?.[i]??edgeFeather(wx-localCenter.x,wy-localCenter.y,field.extent,.28));
    if(support<=.001)continue;
    const detail=(ridged(wx*.0082+warpA*.22,wy*.0082-warpB*.18,peak.faceSeed+877,4)-.56)*1.05*mid,desired=Math.max(context,target+detail);
    field.final[i]=lerp(context,desired,support*support*(3-2*support));if(field.micro)field.micro[i]+=detail*support;
    detailMin=Math.min(detailMin,detail);detailMax=Math.max(detailMax,detail);
  }
  if(field.stats){field.stats.analyticCliffDetailRange=[Number.isFinite(detailMin)?detailMin:0,Number.isFinite(detailMax)?detailMax:0];field.stats.analyticCliffProfile='rounded-crown+resolved-wall+buttress+talus-toe'}
}

const buildLocalFieldsV362Base=buildLocalFields;
buildLocalFields=function(contextField,localCenter,mode,data,candidate,riverSections){
  const field=buildLocalFieldsV362Base(contextField,localCenter,mode,data,candidate,riverSections),n=field.n,count=n*n;
  if(state.enhanceMix===0)return field;
  if(mode==='cliff'&&state.selectedCliffPeakV346)analyticCliffV362(field,contextField,localCenter,state.selectedCliffPeakV346);
  if(mode!=='paddy')return field;
  const raw=field.paddyMask||new Float32Array(count),maskA=boxBlur(raw,n,isMobile?6:11),maskB=boxBlur(maskA,n,isMobile?4:7),smoothMask=new Float32Array(count),contextBase=new Float32Array(count);
  for(let z=0;z<n;z++)for(let x=0;x<n;x++){const i=z*n+x,wx=field.worldX[x],wy=field.worldY[z];contextBase[i]=field.contextFinalV346?.[i]??sampleField(contextField,wx,wy,'final')}
  const broad=boxBlur(contextBase,n,isMobile?18:36),regional=boxBlur(contextBase,n,isMobile?34:68);
  let bundMax=0,channelMax=0,active=0;
  for(let z=0;z<n;z++)for(let x=0;x<n;x++){
    const i=z*n+x,wx=field.worldX[x],wy=field.worldY[z],parent=smoothstep(.20,.62,maskB[i]),grammar=paddyGrammarV362(wx,wy,601),base=regional[i]+clamp(broad[i]-regional[i],-.34,.34)*.22,step=.12+grammar.fieldSeed*.085,offset=(grammar.fieldSeed-.5)*.055,terrace=Math.round((base+offset)/step)*step-offset;
    const bund=grammar.boundary*(.105+grammar.fieldSeed*.070),channel=grammar.irrigation*(.062+.050*(1-grammar.fieldSeed)),micro=fbm(wx*.018,wy*.018,7703,2)*.004*(1-grammar.boundary),detail=bund-channel+micro,target=terrace+detail;
    const visualEdge=field.visualEdgeV347?.[i]??field.localEdge?.[i]??edgeFeather(wx-localCenter.x,wy-localCenter.y,field.extent,.38),blend=parent*visualEdge*visualEdge*(3-2*visualEdge);
    field.final[i]=lerp(contextBase[i],target,blend);smoothMask[i]=parent;bundMax=Math.max(bundMax,bund*parent);channelMax=Math.max(channelMax,channel*parent);if(parent>.45)active++;
  }
  field.paddyMask=smoothMask;field.paddySmoothV360=smoothMask;
  if(field.stats){field.stats.paddyVertices=active;field.stats.bundMax=bundMax;field.stats.paddyChannelMaximum=channelMax;field.stats.paddyMaskSmoothingMeters=(isMobile?10:18)*field.spacing;field.stats.paddyFloorModel='regional-lowpass+quantized-field-levels'}
  return field;
};

const PADDY_STAGE_V362=[new THREE.Color(0x4c672b),new THREE.Color(0x638431),new THREE.Color(0x7f9d39),new THREE.Color(0x98813a)],PADDY_GROUND_V362=new THREE.Color(0x53613b),PADDY_SOIL_V362=new THREE.Color(0x66553a),PADDY_WET_V362=new THREE.Color(0x4a6d61),PADDY_BUND_V362=new THREE.Color(0x493d2d),PADDY_CHANNEL_V362=new THREE.Color(0x32564e),PADDY_STAGE_SCRATCH_V362=new THREE.Color(),PADDY_COLOUR_SCRATCH_V362=new THREE.Color();
paddyParcelColourV351=function(field,index,worldX,worldY,slopeDeg){
  const mask=clamp(field.paddySmoothV360?.[index]??field.paddyMask?.[index]??0,0,1),grammar=paddyGrammarV362(worldX,worldY,601),broad=fbm(worldX*.00082,worldY*.00082,7733,4),stageIndex=Math.min(3,Math.floor(grammar.fieldSeed*4)),stage=PADDY_STAGE_SCRATCH_V362.copy(PADDY_STAGE_V362[stageIndex]);
  stage.offsetHSL(0,broad*.002,broad*.012);stage.lerp(PADDY_WET_V362,clamp(grammar.wetness*.14*mask,0,.14));stage.lerp(PADDY_BUND_V362,clamp(grammar.boundary*.47*mask,0,.47));stage.lerp(PADDY_CHANNEL_V362,clamp(grammar.irrigation*.58*mask,0,.58));
  const colour=PADDY_COLOUR_SCRATCH_V362.copy(PADDY_GROUND_V362).lerp(PADDY_SOIL_V362,smoothstep(5,15,slopeDeg)*.30).lerp(stage,mask*.98),interior=clamp((1-grammar.boundary)*(1-grammar.irrigation)*mask,0,1),grain=fbm(worldX*.010,worldY*.010,7759,2);
  colour.offsetHSL(0,0,grain*.007*interior);return colour;
};

const createTerrainMeshV362Base=createTerrainMesh;
createTerrainMesh=function(field,origin,datum,layer,yOffset=0){
  const mesh=createTerrainMeshV362Base(field,origin,datum,layer,yOffset);
  if(layer==='context'&&state.pendingLocalCenter&&mesh.geometry?.getAttribute('position')){
    const n=field.n,maxIndices=(n-1)*(n-1)*6,indices=new Uint32Array(maxIndices),half=DETAIL_EXTENT*.492;let p=0;
    for(let z=0;z<n-1;z++)for(let x=0;x<n-1;x++){
      const cx=(field.worldX[x]+field.worldX[x+1])*.5,cy=(field.worldY[z]+field.worldY[z+1])*.5;if(Math.abs(cx-state.pendingLocalCenter.x)<half&&Math.abs(cy-state.pendingLocalCenter.y)<half)continue;
      const a=z*n+x,b=a+1,c=a+n,d=c+1;if((x+z)&1){indices[p++]=a;indices[p++]=c;indices[p++]=d;indices[p++]=a;indices[p++]=d;indices[p++]=b}else{indices[p++]=a;indices[p++]=c;indices[p++]=b;indices[p++]=b;indices[p++]=c;indices[p++]=d}
    }
    mesh.geometry.setIndex(new THREE.BufferAttribute(indices.slice(0,p),1));mesh.geometry.computeBoundingSphere();mesh.userData.localContextOverlapMeters=DETAIL_EXTENT*.5-half;
  }
  if(layer==='local'&&state.preset.id==='paddy'){mesh.castShadow=false;mesh.receiveShadow=false;if(mesh.material){mesh.material.bumpMap=null;mesh.material.roughnessMap=null;mesh.material.roughness=1;mesh.material.needsUpdate=true}}
  return mesh;
};

createSandbarsV330=function(){return null};

function smoothRiverSectionV362(sections,index,radius=7){
  let x=0,y=0,width=0,water=0,nx=0,ny=0,curvature=0,weightSum=0;
  for(let j=Math.max(0,index-radius);j<=Math.min(sections.length-1,index+radius);j++){
    const w=1-Math.abs(j-index)/(radius+1),s=sections[j];x+=s.x*w;y+=s.y*w;width+=s.width*w;water+=s.water*w;nx+=s.nx*w;ny+=s.ny*w;curvature+=(s.curvature||0)*w;weightSum+=w;
  }
  const length=Math.hypot(nx,ny)||1;return{x:x/weightSum,y:y/weightSum,width:width/weightSum,water:water/weightSum,nx:nx/length,ny:ny/length,curvature:curvature/weightSum};
}

createRiverMarginMeshV330=function(build){
  const sections=build.riverSections;if(!sections?.length)return null;const field=build.context,vertices=[],colours=[],indices=[];
  const add=(x,h,y,c)=>{vertices.push(x-build.origin.x,h-build.datum,y-build.origin.y);colours.push(c.r,c.g,c.b);return vertices.length/3-1};
  for(const side of [-1,1]){
    let previous=null;
    for(let i=0;i<sections.length;i+=3){
      const section=smoothRiverSectionV362(sections,i,8),bend=clamp(Math.abs(section.curvature)*90,0,1),outer=side===-Math.sign(section.curvature||1),bands=outer?[1.006,1.075+bend*.018,1.185+bend*.035]:[1.006,1.145+bend*.035,1.335+bend*.075],caps=outer?[.020,.16,.68]:[.020,.10,.38],palettes=outer?[RICH_PALETTE_V330.wet,RICH_PALETTE_V330.bank,RICH_PALETTE_V330.soil]:[RICH_PALETTE_V330.wet,RICH_PALETTE_V330.sand,RICH_PALETTE_V330.bank],pair=[];
      for(let b=0;b<bands.length;b++){
        const q=bands[b],x=section.x+section.nx*section.width*.5*q*side,y=section.y+section.ny*section.width*.5*q*side,sampled=sampleField(field,x,y,'final'),h=b===0?section.water+.016:Math.min(sampled+.010,section.water+caps[b]),colour=palettes[b].clone();colour.offsetHSL(0,0,fbm(x*.0032,y*.0032,7801+b,2)*.005);pair.push(add(x,h,y,colour));
      }
      if(previous)for(let b=0;b<bands.length-1;b++)indices.push(previous[b],pair[b],previous[b+1],previous[b+1],pair[b],pair[b+1]);previous=pair;
    }
  }
  if(!indices.length)return null;const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colours,3));geometry.setIndex(indices);geometry.computeVertexNormals();const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.99,metalness:0,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-.9,polygonOffsetUnits:-.9});material.dithering=true;const mesh=new THREE.Mesh(geometry,material);mesh.name='river-margin-smoothed-asymmetric';mesh.castShadow=false;mesh.receiveShadow=false;mesh.renderOrder=5;return mesh;
};

function applyLandscapeLightingV362(){
  const id=state.preset?.id||'atlas',settings=id==='atlas'?{exposure:1.13,sun:2.82,hemi:1.27,fill:.38,near:6000,far:23500,sky:0xc5ced1}:id==='paddy'?{exposure:1.12,sun:2.76,hemi:1.32,fill:.42,near:7200,far:24000,sky:0xc8d0ce}:id==='cliff'?{exposure:1.10,sun:2.96,hemi:1.18,fill:.32,near:6700,far:22200,sky:0xc4ccce}:{exposure:1.11,sun:2.84,hemi:1.25,fill:.36,near:6600,far:22800,sky:0xc5cdcf};
  renderer.toneMappingExposure=settings.exposure;scene.background.set(settings.sky);if(scene.fog){scene.fog.color.set(settings.sky);scene.fog.near=settings.near;scene.fog.far=settings.far}sun.intensity=settings.sun;sun.color.set(0xffe6bd);scene.traverse(object=>{if(object.isHemisphereLight)object.intensity=settings.hemi;if(object.name==='cool-fill')object.intensity=settings.fill});
}

configureCamera=function(view,build=state.currentBuild){
  if(!build)return;const offset=build.localOffset||{x:0,z:0},targetHeight=build.localTargetHeight||260,id=state.preset.id;
  if(id==='atlas'){camera.fov=37;camera.position.set(3000,1390,4250);controls.target.set(0,230,-350)}
  else if(id==='paddy'){const clear=paddyCameraAzimuthV350(build),terrainHeight=sampleField(build.local,build.local.center.x,build.local.center.y,'final')-build.datum,distance=isMobile?390:520,height=isMobile?455:545;camera.fov=isMobile?40:38;camera.position.set(offset.x+Math.cos(clear.angle)*distance,terrainHeight+height,offset.z+Math.sin(clear.angle)*distance);controls.target.set(offset.x,terrainHeight+5,offset.z-24);state.paddyCameraV350={azimuthRadians:clear.angle,obstructionScore:clear.score,maxRiseMeters:clear.maxRise,meanPositiveRiseMeters:clear.meanRise,horizontalDistanceMeters:distance,heightMeters:height,fovDegrees:camera.fov}}
  else if(id==='river'){camera.fov=38;camera.position.set(offset.x+1120,targetHeight+500,offset.z+1510);controls.target.set(offset.x-105,targetHeight+12,offset.z-270)}
  else{const peak=state.selectedCliffPeakV346,base=(peak?.floor??build.localTargetHeight)-build.datum,height=peak?.targetHeight??210,angle=(peak?.angle??0)+.92,distance=clamp(height*2.20,480,720),px=(peak?.x??build.local.center.x)-build.origin.x,pz=(peak?.y??build.local.center.y)-build.origin.y,cameraX=px+Math.cos(angle)*distance,cameraZ=pz+Math.sin(angle)*distance,worldX=build.origin.x+cameraX,worldY=build.origin.y+cameraZ,ground=Math.max(sampleField(build.context,worldX,worldY,'final')-build.datum,sampleField(build.regional,worldX,worldY,'final')-build.datum);camera.fov=42;camera.position.set(cameraX,Math.max(base+height*.58+85,ground+130),cameraZ);controls.target.set(px,base+height*.48,pz)}
  camera.updateProjectionMatrix();controls.update();
};

const makeQAV362Base=makeQA;
makeQA=function(build){
  const qa=makeQAV362Base(build),stats=build.local?.stats||{};qa.richTerrainPass='v3.6.2';qa.contextWallFilter='karst-steep-bilateral-like-25m';qa.cliffLocalProfile=stats.analyticCliffProfile||null;qa.cliffLocalDetailRange=stats.analyticCliffDetailRange||[0,0];qa.paddyGrammar='two-scale-domain-warped-voronoi+flow-canals';qa.paddyFloorModel=stats.paddyFloorModel||null;qa.paddyMaskSmoothingMeters=Number((stats.paddyMaskSmoothingMeters||0).toFixed(3));qa.paddyChannelMaximumMeters=Number((stats.paddyChannelMaximum||0).toFixed(3));qa.localContextOverlapMeters=Number((DETAIL_EXTENT*(.5-.492)).toFixed(3));qa.riverMarginProfile='smoothed-curvature-aware-three-band';qa.sandbarOverlayDisabled=true;qa.visualAcceptance=false;qa.productionReady=false;return qa;
};

const buildPresetV362Base=buildPreset;
buildPreset=async function(id,options={}){
  const result=await buildPresetV362Base(id,options);applyLandscapeLightingV362();configureCamera(state.preset.view,state.currentBuild);if(window.__terrainV320QA?.ready){window.__terrainV320QA.richTerrainPass='v3.6.2';window.__terrainV320QA.visualAcceptance=false;window.__terrainV320QA.productionReady=false}setStatus('桂林多场地貌 v3.6.2 已加载',`${state.currentBuild.candidate.name} · 峰壁连续化、稻田工程化、河岸非对称化和综合色彩协作`);return result;
};

document.title='小王 · 桂林多场地貌蒸馏实验室 v3.6.2';
const brandSmallV362=document.querySelector('.brand small');if(brandSmallV362)brandSmallV362.textContent='XIAOWANG · GUILIN MULTI-FIELD TERRAIN DISTILLATION v3.6.2';
