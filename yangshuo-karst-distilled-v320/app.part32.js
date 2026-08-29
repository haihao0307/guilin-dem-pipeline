/* v3.6.0 landscape composition pass: hierarchical karst masses, coherent paddy parcels, asymmetric river margins and semantic colour depth. */

state.tone=true;
$('toneToggle').classList.add('active');
$('toneToggle').textContent='桂林地貌综合色彩';

RICH_PALETTE_V330.karstDark.set(0x20362f);
RICH_PALETTE_V330.karstMid.set(0x3c5142);
RICH_PALETTE_V330.moss.set(0x4e673f);
RICH_PALETTE_V330.limestone.set(0x7c8174);
RICH_PALETTE_V330.limestoneLight.set(0xa4a493);
RICH_PALETTE_V330.talus.set(0x756a50);
RICH_PALETTE_V330.soil.set(0x62543b);
RICH_PALETTE_V330.fieldDark.set(0x4b632b);
RICH_PALETTE_V330.fieldGreen.set(0x64822f);
RICH_PALETTE_V330.fieldBright.set(0x819b35);
RICH_PALETTE_V330.fieldGold.set(0x94833b);
RICH_PALETTE_V330.bund.set(0x4b3f2e);
RICH_PALETTE_V330.channel.set(0x38584f);
RICH_PALETTE_V330.wet.set(0x4d7165);
RICH_PALETTE_V330.bank.set(0x675d46);
RICH_PALETTE_V330.sand.set(0x847b5d);
RICH_PALETTE_V330.distant.set(0x718596);
RICH_PALETTE_V330.waterDeep.set(0x24585d);
RICH_PALETTE_V330.waterMid.set(0x3d7473);
RICH_PALETTE_V330.waterEdge.set(0x73978b);

const detectPeaksRichV360Base=detectPeaksRichV330;
function refinePeakHierarchyV360(raw,maxPeaks){
  const ordered=[...raw].sort((a,b)=>(b.score||0)-(a.score||0));
  const limit=Math.min(maxPeaks??46,isMobile?26:38),selected=[];
  for(const peak of ordered){
    const prominence=Math.max(8,peak.prominence||0),minimumDistance=clamp(220+prominence*.72,235,520);
    if(selected.some(other=>Math.hypot(other.x-peak.x,other.y-peak.y)<minimumDistance))continue;
    const rank=selected.length,major=rank<(isMobile?8:13),compound=!major&&rank<(isMobile?17:27),seed=peak.seed||Math.floor(hash21(peak.x*.01,peak.y*.01,7201)*100000);
    const a=hash21(seed,.231,7213),b=hash21(seed,.619,7229),c=hash21(seed,.877,7243);
    peak.kindV360=major?'tower':compound?'compound':'minor';
    peak.seed=seed;
    peak.targetHeight=major?clamp(prominence*1.15+105+a*84,145,320):compound?clamp(prominence*.90+58+a*48,78,205):clamp(prominence*.55+24+a*30,42,118);
    peak.ratio=major?1.26+b*.58:compound?.88+b*.42:.68+b*.30;
    const meanRadius=clamp(peak.targetHeight/(2*Math.max(.62,peak.ratio)),major?48:52,major?142:compound?166:178),stretch=.76+c*.55;
    peak.radiusX=meanRadius*stretch;peak.radiusY=meanRadius/stretch;
    peak.angle=hash21(seed,.417,7253)*Math.PI;
    peak.superPower=major?2.15+b*.95:compound?1.72+b*.72:1.55+b*.55;
    peak.crownRadius=major?.29+a*.15:compound?.40+a*.18:.52+a*.15;
    peak.crownDrop=major?.17+c*.14:compound?.22+c*.17:.28+c*.16;
    peak.wallEnd=major?.87+b*.07:compound?.90+b*.05:.93+b*.035;
    peak.crownShiftX=(hash21(seed,.147,7277)-.5)*(major?.17:.11);
    peak.crownShiftY=(hash21(seed,.793,7297)-.5)*(major?.17:.11);
    peak.lobeCount=major?2+Math.floor(hash21(seed,.341,7307)*4):2+Math.floor(hash21(seed,.531,7321)*3);
    peak.faceSeed=Math.floor(hash21(seed,.911,7331)*100000);
    selected.push(peak);if(selected.length>=limit)break;
  }
  return selected;
}
detectPeaksRichV330=function(analysis,maxPeaks=46){return refinePeakHierarchyV360(detectPeaksRichV360Base(analysis,Math.max(maxPeaks||46,isMobile?38:64)),maxPeaks||46)};
detectPeaks=function(analysis,maxPeaks=46){const peaks=detectPeaksRichV330(analysis,maxPeaks);state.contextPeaksV346=peaks;return peaks};

peakEnvelopeAt=function(worldX,worldY,zBase,fineResidual,peaks){
  let best=-Infinity,second=-Infinity,bestRatio=0,bestInfluence=0;
  for(const peak of peaks){
    const ca=Math.cos(peak.angle),sa=Math.sin(peak.angle),dx=worldX-peak.x,dy=worldY-peak.y;
    let qx=(dx*ca+dy*sa)/peak.radiusX,qy=(-dx*sa+dy*ca)/peak.radiusY;
    if(Math.abs(qx)>1.22||Math.abs(qy)>1.22)continue;
    const broad=fbm(worldX*.00108,worldY*.00108,peak.faceSeed+7,4),mid=fbm(worldX*.0030+4.7,worldY*.0030-5.4,peak.faceSeed+19,3);
    qx+=broad*.036+mid*.010;qy+=fbm(worldX*.00108+7.1,worldY*.00108-3.3,peak.faceSeed+13,4)*.036-mid*.009;
    const az=Math.atan2(qy,qx),lobe=1+.050*Math.cos(az*peak.lobeCount+peak.angle)+.021*Math.cos(az*(peak.lobeCount+2)+peak.seed*.0017);
    qx/=lobe;qy/=lobe;
    const r0=superellipseRadiusV340(qx,qy,peak.superPower),shiftFactor=1-clamp(r0,0,1);
    qx-=peak.crownShiftX*shiftFactor;qy-=peak.crownShiftY*shiftFactor;
    const r=superellipseRadiusV340(qx,qy,peak.superPower);if(r>1.075)continue;
    const support=1-smoothstep(.972,1.075,r);if(support<=0)continue;
    const crownR=peak.crownRadius,drop=peak.crownDrop,wallEnd=peak.wallEnd;
    let profile;
    if(r<=crownR){
      const t=clamp(r/Math.max(.08,crownR),0,1),tilt=(qx*.050-qy*.037)*(hash21(peak.seed,.369,7369)-.5);
      profile=1-drop*Math.pow(t,1.35+hash21(peak.seed,.587,7381)*.65)+tilt;
    }else if(r<=wallEnd){
      const t=clamp((r-crownR)/Math.max(.08,wallEnd-crownR),0,1);
      profile=(1-drop)*(1-.21*Math.pow(t,1.42));
    }else{
      const t=clamp((r-wallEnd)/Math.max(.025,1-wallEnd),0,1);
      profile=(1-drop)*.79*Math.pow(1-t,.28);
    }
    const middle=smoothstep(crownR*.82,.57,r)*(1-smoothstep(.78,.96,r));
    const buttress=Math.pow(Math.max(0,Math.cos(az*(peak.lobeCount+1)+peak.angle)),3.0)*middle*(peak.kindV360==='tower'?.060:.035);
    const face=ridged(worldX*.0036+mid*.22,worldY*.0036-broad*.18,peak.faceSeed+43,4),flute=-smoothstep(.76,.965,face)*middle*(peak.kindV360==='tower'?.040:.025);
    const summitNotch=smoothstep(.82,.97,ridged(worldX*.0063,worldY*.0063,peak.faceSeed+71,3))*(1-smoothstep(crownR*.55,crownR*1.08,r))*(peak.kindV360==='tower'?.050:.025);
    const inherited=clamp((zBase-peak.floor)/Math.max(28,peak.prominence),0,1.08);
    profile=clamp(profile+buttress+flute-summitNotch+Math.pow(inherited,1.55)*.045*(1-smoothstep(.48,.78,r)),0,1.08);
    const target=peak.floor+peak.targetHeight*profile+fineResidual*(peak.kindV360==='minor'?.09:.035),surface=lerp(zBase,target,support);
    if(surface>best){second=best;best=surface;bestRatio=peak.ratio;bestInfluence=support}else if(surface>second)second=surface;
  }
  if(!Number.isFinite(best))return{delta:0,influence:0,ratio:0};
  const surface=Number.isFinite(second)?smoothMaximumV340(best,second,9.0):best;
  return{delta:clamp(surface-zBase,-72,230),influence:bestInfluence,ratio:bestRatio};
};

const chooseLocalCenterV360Base=chooseLocalCenter;
chooseLocalCenter=function(preset,focus,paddyFocus,riverModel){
  if(preset?.detailMode==='cliff'&&state.contextPeaksV346?.length){
    const broad=state.contextPeaksV346
      .filter(peak=>peak.kindV360==='tower'&&Math.min(peak.radiusX,peak.radiusY)>=48)
      .map(peak=>({peak,score:(peak.targetHeight||0)*Math.sqrt(Math.max(1,peak.radiusX*peak.radiusY))*(.82+.18*(peak.ratio||1))-Math.hypot(peak.x-focus.x,peak.y-focus.y)*1.8}))
      .sort((a,b)=>b.score-a.score);
    if(broad.length){state.selectedCliffPeakV346=broad[0].peak;return{x:broad[0].peak.x,y:broad[0].peak.y}}
  }
  return chooseLocalCenterV360Base(preset,focus,paddyFocus,riverModel);
};

function paddyGrammarV360(worldX,worldY,seed=0){
  const warpX=fbm(worldX*.00125,worldY*.00125,seed+17,4)*34+fbm(worldX*.0048,worldY*.0048,seed+31,3)*6;
  const warpY=fbm(worldX*.00125+6.7,worldY*.00125-4.3,seed+47,4)*34+fbm(worldX*.0048-5.2,worldY*.0048+7.8,seed+61,3)*6;
  const coarse=worley((worldX+warpX)*.0056,(worldY+warpY)*.0052,seed+83),fine=worley((worldX+warpX*.55)*.0135,(worldY+warpY*.55)*.0118,seed+103);
  const coarseBoundary=smoothstep(.105,.018,coarse.f2-coarse.f1),fineBoundary=smoothstep(.082,.013,fine.f2-fine.f1),parentSeed=hash21(coarse.cellX,coarse.cellZ,seed+127);
  const subdivision=smoothstep(.28,.72,parentSeed),boundary=Math.max(coarseBoundary,fineBoundary*(.28+.68*subdivision));
  const fieldSeed=clamp(hash21(fine.cellX,fine.cellZ,seed+149)*.72+parentSeed*.28,0,1);
  const flowWarp=fbm(worldX*.0011,worldY*.0011,seed+173,4)*75,canalA=ridged((worldX+flowWarp)*.0035,(worldY-flowWarp*.35)*.00105,seed+191,4),canalB=ridged((worldX-flowWarp*.42)*.00115,(worldY+flowWarp)*.0030,seed+211,4);
  const irrigation=Math.max(smoothstep(.86,.975,canalA),smoothstep(.88,.977,canalB)*.66)*smoothstep(.06,.34,fine.f1);
  const wetness=clamp((fieldSeed-.44)*1.75,0,1)*(.55+.45*fbm(worldX*.0021,worldY*.0021,seed+229,3));
  const angle=fbm(worldX*.00075,worldY*.00075,seed+251,3)*.85;
  return{cell:fine,coarse,boundary,irrigation,fieldSeed,wetness,split:fineBoundary,orientation:angle,parcelWidthMeters:[58,178],scale:1};
}
parcelGrammarV330=paddyGrammarV360;

paddyDetail=function(worldX,worldY,truth,base,valleyMask,slopeDeg,seed=0){
  const parent=valleyMask*smoothstep(9.0,1.35,slopeDeg);if(parent<.001)return{delta:0,bund:0,channel:0,mask:0};
  const grammar=paddyGrammarV360(worldX,worldY,seed),step=.15+grammar.fieldSeed*.12,offset=(grammar.fieldSeed-.5)*.075;
  const terrace=Math.round((base+offset)/step)*step-offset,flatten=clamp((terrace-base)*.64,-.19,.19);
  const bund=grammar.boundary*(.13+grammar.fieldSeed*.08),channel=grammar.irrigation*(.075+.055*(1-grammar.fieldSeed));
  const micro=fbm(worldX*.020,worldY*.020,seed+277,2)*.006*(1-grammar.boundary),delta=clamp((flatten+bund-channel+micro)*parent,-.27,.27);
  return{delta,bund:bund*parent,channel:channel*parent,mask:parent,fieldSeed:grammar.fieldSeed,wetness:grammar.wetness};
};

const buildLocalFieldsV360Base=buildLocalFields;
buildLocalFields=function(contextField,localCenter,mode,data,candidate,riverSections){
  const field=buildLocalFieldsV360Base(contextField,localCenter,mode,data,candidate,riverSections);
  if(mode!=='paddy'||state.enhanceMix===0)return field;
  const n=field.n,count=n*n,raw=field.paddyMask||new Float32Array(count),blurA=boxBlur(raw,n,isMobile?5:9),blurB=boxBlur(blurA,n,isMobile?3:5),smoothMask=new Float32Array(count),baseField=new Float32Array(count);
  let bundMax=0,channelMax=0,active=0;
  for(let z=0;z<n;z++)for(let x=0;x<n;x++){
    const i=z*n+x,wx=field.worldX[x],wy=field.worldY[z],contextHeight=field.contextFinalV346?.[i]??sampleField(contextField,wx,wy,'final');baseField[i]=contextHeight;
  }
  const baseSmooth=boxBlur(baseField,n,isMobile?2:4);
  for(let z=0;z<n;z++)for(let x=0;x<n;x++){
    const i=z*n+x,x0=Math.max(0,x-3),x1=Math.min(n-1,x+3),z0=Math.max(0,z-3),z1=Math.min(n-1,z+3),dx=(baseSmooth[z*n+x1]-baseSmooth[z*n+x0])/Math.max(1,(x1-x0)*field.spacing),dz=(baseSmooth[z1*n+x]-baseSmooth[z0*n+x])/Math.max(1,(z1-z0)*field.spacing),slope=Math.atan(Math.hypot(dx,dz))*180/Math.PI;
    const parent=smoothstep(.18,.58,blurB[i])*smoothstep(8.0,1.2,slope),wx=field.worldX[x],wy=field.worldY[z],grammar=paddyGrammarV360(wx,wy,601),step=.15+grammar.fieldSeed*.12,offset=(grammar.fieldSeed-.5)*.075,terrace=Math.round((baseSmooth[i]+offset)/step)*step-offset;
    const flatten=clamp((terrace-baseField[i])*.70,-.20,.20),bund=grammar.boundary*(.13+grammar.fieldSeed*.08),channel=grammar.irrigation*(.075+.055*(1-grammar.fieldSeed)),micro=fbm(wx*.020,wy*.020,7381,2)*.006*(1-grammar.boundary),detail=clamp((flatten+bund-channel+micro)*parent,-.27,.27);
    const edge=field.visualEdgeV347?.[i]??field.localEdge?.[i]??edgeFeather(wx-localCenter.x,wy-localCenter.y,field.extent,.36),blend=edge*edge*(3-2*edge);
    field.final[i]=lerp(baseField[i],baseField[i]+detail*state.bund,blend);smoothMask[i]=parent;
    bundMax=Math.max(bundMax,bund*parent);channelMax=Math.max(channelMax,channel*parent);if(parent>.45)active++;
  }
  field.paddyMask=smoothMask;field.paddySmoothV360=smoothMask;
  if(field.stats){field.stats.paddyVertices=active;field.stats.bundMax=bundMax;field.stats.paddyChannelMaximum=channelMax;field.stats.paddyMaskSmoothingMeters=(isMobile?8:14)*field.spacing}
  return field;
};

const PADDY_STAGE_V360=[new THREE.Color(0x4c652a),new THREE.Color(0x60802e),new THREE.Color(0x789638),new THREE.Color(0x92803c)];
const PADDY_GROUND_V360=new THREE.Color(0x58603d),PADDY_SOIL_V360=new THREE.Color(0x67563a),PADDY_WET_V360=new THREE.Color(0x4d7165),PADDY_BUND_V360=new THREE.Color(0x493d2d),PADDY_CHANNEL_V360=new THREE.Color(0x34564f),PADDY_SCRATCH_V360=new THREE.Color(),PADDY_COLOUR_SCRATCH_V360=new THREE.Color();
paddyParcelColourV351=function(field,index,worldX,worldY,slopeDeg){
  const mask=clamp(field.paddySmoothV360?.[index]??field.paddyMask?.[index]??0,0,1),grammar=paddyGrammarV360(worldX,worldY,601),broad=fbm(worldX*.00080,worldY*.00080,7411,4),stageIndex=Math.min(3,Math.floor(grammar.fieldSeed*4));
  const stage=PADDY_SCRATCH_V360.copy(PADDY_STAGE_V360[stageIndex]);stage.offsetHSL(0,broad*.002,broad*.012);
  stage.lerp(PADDY_WET_V360,clamp(grammar.wetness*.16*mask,0,.16));
  stage.lerp(PADDY_BUND_V360,clamp(grammar.boundary*.76*mask,0,.76));
  stage.lerp(PADDY_CHANNEL_V360,clamp(grammar.irrigation*.82*mask,0,.82));
  const colour=PADDY_COLOUR_SCRATCH_V360.copy(PADDY_GROUND_V360).lerp(PADDY_SOIL_V360,smoothstep(5,15,slopeDeg)*.38).lerp(stage,mask*.98);
  const interior=clamp((1-grammar.boundary)*(1-grammar.irrigation)*mask,0,1),grain=fbm(worldX*.008,worldY*.008,7433,2);
  colour.offsetHSL(0,0,grain*.008*interior);return colour;
};

const terrainColourV360Base=terrainColourRichV330;
terrainColourRichV330=function(field,index,heightNorm,worldX,worldY,layer,slopeDeg){
  if(layer==='local'&&state.preset.id==='paddy')return paddyParcelColourV351(field,index,worldX,worldY,slopeDeg);
  const colour=terrainColourV360Base(field,index,heightNorm,worldX,worldY,layer,slopeDeg),karst=clamp(field.karst?.[index]??smoothstep(10,38,slopeDeg),0,1),valley=clamp(field.valley?.[index]??0,0,1),exposure=smoothstep(25,57,slopeDeg)*(1-valley),broad=fbm(worldX*.00058,worldY*.00058,7463,4),patch=ridged(worldX*.0028+broad*.30,worldY*.0028-broad*.20,7481,4);
  colour.lerp(RICH_PALETTE_V330.limestoneLight,clamp(karst*exposure*smoothstep(.60,.92,patch)*(layer==='local'?.32:.25),0,.34));
  const dampFoot=karst*smoothstep(5,23,slopeDeg)*(1-smoothstep(30,48,slopeDeg))*(.45+.55*(1-heightNorm));
  colour.lerp(RICH_PALETTE_V330.karstDark,clamp(dampFoot*.22,0,.22));
  if(layer==='regional')colour.lerp(RICH_PALETTE_V330.distant,.16+.12*(1-heightNorm));
  else if(layer==='context')colour.offsetHSL(0,broad*.005,broad*.008);
  return colour;
};

createRiverMarginMeshV330=function(build){
  const sections=build.riverSections;if(!sections?.length)return null;
  const field=build.context,vertices=[],colours=[],indices=[];
  const add=(x,h,y,c)=>{vertices.push(x-build.origin.x,h-build.datum,y-build.origin.y);colours.push(c.r,c.g,c.b);return vertices.length/3-1};
  for(const side of [-1,1]){
    let previous=null;
    for(let i=0;i<sections.length;i+=2){
      const section=sections[i],curve=clamp(Math.abs(section.curvature||0)*95,0,1),outer=side===Math.sign(section.curvature||0),bands=outer?[1.003,1.040+curve*.015,1.105+curve*.030,1.205+curve*.045]:[1.003,1.095+curve*.025,1.265+curve*.080,1.455+curve*.115],caps=outer?[.025,.15,.52,1.32]:[.025,.10,.28,.72],palettes=outer?[RICH_PALETTE_V330.wet,RICH_PALETTE_V330.bank,RICH_PALETTE_V330.soil,RICH_PALETTE_V330.karstMid]:[RICH_PALETTE_V330.wet,RICH_PALETTE_V330.sand,RICH_PALETTE_V330.bank,RICH_PALETTE_V330.soil],pair=[];
      for(let b=0;b<bands.length;b++){
        const q=bands[b],x=section.x+section.nx*section.width*.5*q*side,y=section.y+section.ny*section.width*.5*q*side,sampled=sampleField(field,x,y,'final'),h=b===0?section.water+.018:Math.min(sampled+.012,section.water+caps[b]),colour=palettes[b].clone();colour.offsetHSL(0,0,fbm(x*.0038,y*.0038,7517+b,2)*.007);pair.push(add(x,h,y,colour));
      }
      if(previous)for(let b=0;b<bands.length-1;b++)indices.push(previous[b],pair[b],previous[b+1],previous[b+1],pair[b],pair[b+1]);previous=pair;
    }
  }
  if(!indices.length)return null;const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colours,3));geometry.setIndex(indices);geometry.computeVertexNormals();const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.99,metalness:0,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1.05,polygonOffsetUnits:-1.05});material.dithering=true;const mesh=new THREE.Mesh(geometry,material);mesh.name='river-margin-asymmetric';mesh.castShadow=false;mesh.receiveShadow=false;mesh.renderOrder=5;return mesh;
};

const createWaterMeshV360Base=createWaterMesh;
createWaterMesh=function(...args){
  const water=createWaterMeshV360Base(...args);water?.traverse?.(object=>{
    if(!object.isMesh||!object.material)return;
    if(object.name==='lijiang-water-surface'){
      object.material.roughness=.31;object.material.opacity=.76;object.material.clearcoat=.42;object.material.clearcoatRoughness=.24;object.material.depthWrite=false;object.material.needsUpdate=true;
    }else if(object.name==='lijiang-water-depth'){
      object.material.opacity=.17;object.material.color?.set?.(0x214f55);object.material.needsUpdate=true;
    }
  });return water;
};

function applyLandscapeLightingV360(){
  const id=state.preset?.id||'atlas',settings=id==='atlas'?{exposure:1.16,sun:2.90,hemi:1.30,fill:.38,near:6100,far:23200,sky:0xc5ced1}:id==='paddy'?{exposure:1.15,sun:2.84,hemi:1.34,fill:.40,near:7200,far:23800,sky:0xc8d0ce}:id==='cliff'?{exposure:1.12,sun:3.10,hemi:1.20,fill:.29,near:6800,far:22000,sky:0xc4ccce}:{exposure:1.13,sun:2.92,hemi:1.27,fill:.35,near:6700,far:22500,sky:0xc5cdcf};
  renderer.toneMappingExposure=settings.exposure;scene.background.set(settings.sky);if(scene.fog){scene.fog.color.set(settings.sky);scene.fog.near=settings.near;scene.fog.far=settings.far}sun.intensity=settings.sun;sun.color.set(0xffe7bc);
  scene.traverse(object=>{if(object.isHemisphereLight)object.intensity=settings.hemi;if(object.name==='cool-fill')object.intensity=settings.fill});
}

configureCamera=function(view,build=state.currentBuild){
  if(!build)return;const offset=build.localOffset||{x:0,z:0},targetHeight=build.localTargetHeight||260,id=state.preset.id;
  if(id==='atlas'){
    camera.fov=36;camera.position.set(2920,1260,4070);controls.target.set(0,238,-330);
  }else if(id==='paddy'){
    const clear=paddyCameraAzimuthV350(build),terrainHeight=sampleField(build.local,build.local.center.x,build.local.center.y,'final')-build.datum,distance=isMobile?360:475,height=isMobile?430:505;
    camera.fov=isMobile?39:37;camera.position.set(offset.x+Math.cos(clear.angle)*distance,terrainHeight+height,offset.z+Math.sin(clear.angle)*distance);controls.target.set(offset.x,terrainHeight+7,offset.z-28);
    state.paddyCameraV350={azimuthRadians:clear.angle,obstructionScore:clear.score,maxRiseMeters:clear.maxRise,meanPositiveRiseMeters:clear.meanRise,horizontalDistanceMeters:distance,heightMeters:height,fovDegrees:camera.fov};
  }else if(id==='river'){
    camera.fov=38;camera.position.set(offset.x+1110,targetHeight+470,offset.z+1480);controls.target.set(offset.x-95,targetHeight+12,offset.z-260);
  }else{
    const peak=state.selectedCliffPeakV346,base=(peak?.floor??build.localTargetHeight)-build.datum,height=peak?.targetHeight??210,angle=(peak?.angle??0)+.82,distance=clamp(height*1.78,390,560),px=(peak?.x??build.local.center.x)-build.origin.x,pz=(peak?.y??build.local.center.y)-build.origin.y;
    const cameraX=px+Math.cos(angle)*distance,cameraZ=pz+Math.sin(angle)*distance,worldX=build.origin.x+cameraX,worldY=build.origin.y+cameraZ,ground=Math.max(sampleField(build.context,worldX,worldY,'final')-build.datum,sampleField(build.regional,worldX,worldY,'final')-build.datum);
    camera.fov=42;camera.position.set(cameraX,Math.max(base+height*.56+65,ground+115),cameraZ);controls.target.set(px,base+height*.48,pz);
  }
  camera.updateProjectionMatrix();controls.update();
};

const makeQAV360Base=makeQA;
makeQA=function(build){
  const qa=makeQAV360Base(build),stats=build.local?.stats||{},kinds={tower:0,compound:0,minor:0};for(const peak of build.context?.peaks||[])kinds[peak.kindV360||'minor']=(kinds[peak.kindV360||'minor']||0)+1;
  qa.richTerrainPass='v3.6.0';qa.karstHierarchy=kinds;qa.karstProfile='broad-crown+near-vertical-wall+tight-foot+compound-mass';qa.paddyGrammar='domain-warped-hierarchical-voronoi+flow-irrigation';qa.paddyMaskSmoothingMeters=Number((stats.paddyMaskSmoothingMeters||0).toFixed(3));qa.paddyChannelMaximumMeters=Number((stats.paddyChannelMaximum||0).toFixed(3));qa.riverMarginProfile='curvature-aware-outer-cut+inner-point-bar';qa.colourModel='semantic-karst-paddy-water-depth-v3';qa.atmosphereModel='preset-depth-separated';qa.visualAcceptance=false;qa.productionReady=false;return qa;
};

const buildPresetV360Base=buildPreset;
buildPreset=async function(id,options={}){
  const result=await buildPresetV360Base(id,options);applyLandscapeLightingV360();configureCamera(state.preset.view,state.currentBuild);
  if(window.__terrainV320QA?.ready){window.__terrainV320QA.richTerrainPass='v3.6.0';window.__terrainV320QA.visualAcceptance=false;window.__terrainV320QA.productionReady=false}
  setStatus('桂林多场地貌 v3.6 已加载',`${state.currentBuild.candidate.name} · 峰林层级、稻田田块、河岸沉积和综合色彩协作`);return result;
};

document.title='小王 · 桂林多场地貌蒸馏实验室 v3.6.0';
const brandSmallV360=document.querySelector('.brand small');if(brandSmallV360)brandSmallV360.textContent='XIAOWANG · GUILIN MULTI-FIELD TERRAIN DISTILLATION v3.6.0';
