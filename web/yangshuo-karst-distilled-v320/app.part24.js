/* v3.4.5 morphology correction: slender karst towers, slope-led rock faces, field-scale paddy parcels and review cameras. */
state.tone=true;
$('toneToggle').classList.add('active');
$('toneToggle').textContent='桂林地貌色彩';

RICH_PALETTE_V330.karstDark.set(0x263a34);
RICH_PALETTE_V330.karstMid.set(0x47594a);
RICH_PALETTE_V330.moss.set(0x59684a);
RICH_PALETTE_V330.limestone.set(0x7f837a);
RICH_PALETTE_V330.limestoneLight.set(0xa3a397);
RICH_PALETTE_V330.talus.set(0x766b55);
RICH_PALETTE_V330.soil.set(0x685b43);
RICH_PALETTE_V330.fieldDark.set(0x4f6035);
RICH_PALETTE_V330.fieldGreen.set(0x66763d);
RICH_PALETTE_V330.fieldBright.set(0x788742);
RICH_PALETTE_V330.fieldGold.set(0x8b7d48);
RICH_PALETTE_V330.bund.set(0x554936);
RICH_PALETTE_V330.channel.set(0x49665f);
RICH_PALETTE_V330.wet.set(0x5b756c);
RICH_PALETTE_V330.bank.set(0x6c624d);
RICH_PALETTE_V330.sand.set(0x8a8062);
RICH_PALETTE_V330.waterDeep.set(0x2c6267);
RICH_PALETTE_V330.waterMid.set(0x447b79);
RICH_PALETTE_V330.waterEdge.set(0x76968a);

const detectPeaksV345Base=detectPeaksRichV330;
detectPeaksRichV330=function(analysis,maxPeaks=54){
  const peaks=detectPeaksV345Base(analysis,maxPeaks);
  for(let i=0;i<peaks.length;i++){
    const peak=peaks[i],major=i<20,shape=hash21(peak.seed,.239,4513),cross=hash21(peak.seed,.617,4523);
    const contraction=(major?.76:.80)*(.96+shape*.08);
    peak.radiusX*=contraction*(.90+cross*.20);
    peak.radiusY*=contraction*(1.10-cross*.20);
    peak.targetHeight*=major?1.075:1.045;
    peak.superPower=2.05+hash21(peak.seed,.811,4547)*1.15;
    peak.summitRadius=.11+hash21(peak.seed,.337,4561)*.12;
    peak.wallStart=.55+hash21(peak.seed,.449,4579)*.10;
    peak.wallEnd=.86+hash21(peak.seed,.733,4591)*.055;
    peak.crownDrop=.075+hash21(peak.seed,.913,4603)*.095;
    peak.buttressCount=3+Math.floor(hash21(peak.seed,.571,4621)*3);
    peak.crownShiftX=(hash21(peak.seed,.173,4637)-.5)*.18;
    peak.crownShiftY=(hash21(peak.seed,.827,4651)-.5)*.18;
    peak.faceSeed=Math.floor(hash21(peak.seed,.391,4663)*100000);
  }
  return peaks;
};
detectPeaks=detectPeaksRichV330;

peakEnvelopeAt=function(worldX,worldY,zBase,fineResidual,peaks){
  let best=-Infinity,second=-Infinity,bestRatio=0,bestInfluence=0;
  for(const peak of peaks){
    const ca=Math.cos(peak.angle),sa=Math.sin(peak.angle),dx=worldX-peak.x,dy=worldY-peak.y;
    let qx=(dx*ca+dy*sa)/peak.radiusX,qy=(-dx*sa+dy*ca)/peak.radiusY;
    if(Math.abs(qx)>1.34||Math.abs(qy)>1.34)continue;
    const broad=fbm(worldX*.00125,worldY*.00125,peak.faceSeed+7,4),mid=fbm(worldX*.0038+6.3,worldY*.0038-4.9,peak.faceSeed+23,3);
    qx+=broad*.040+mid*.014;
    qy+=fbm(worldX*.00125+5.2,worldY*.00125-3.5,peak.faceSeed+17,4)*.040-mid*.011;
    const azimuth=Math.atan2(qy,qx),lobe=1+.055*Math.cos(azimuth*3+peak.angle)+.026*Math.cos(azimuth*5+peak.crownShiftX*15);
    qx/=lobe;qy/=lobe;
    const rawR=superellipseRadiusV340(qx,qy,peak.superPower);
    const shiftedX=qx-peak.crownShiftX*(1-clamp(rawR,0,1));
    const shiftedY=qy-peak.crownShiftY*(1-clamp(rawR,0,1));
    const r=superellipseRadiusV340(shiftedX,shiftedY,peak.superPower);if(r>1.095)continue;
    const support=1-smoothstep(.965,1.095,r);if(support<=0)continue;
    const crownT=clamp(r/Math.max(.18,peak.wallStart),0,1);
    const crown=1-peak.crownDrop*Math.pow(crownT,1.15+hash21(peak.seed,.227,4681)*.65);
    const wall=1-smoothstep(peak.wallStart,peak.wallEnd,r);
    const toe=1-smoothstep(peak.wallEnd,1.015,r);
    let profile=r<=peak.wallStart?crown:(1-peak.crownDrop)*(wall*.955+toe*.045);
    const buttressPhase=peak.angle+hash21(peak.seed,.681,4691)*Math.PI*2;
    const buttress=Math.pow(Math.max(0,Math.cos(azimuth*peak.buttressCount+buttressPhase)),3.2)*smoothstep(.36,.63,r)*(1-smoothstep(.82,1.01,r));
    const wallRibs=(ridged(worldX*.0048,worldY*.0048,peak.faceSeed+47,4)-.57)*.045*smoothstep(.34,.78,r)*(1-smoothstep(.88,1.02,r));
    const collapse=smoothstep(.78,.96,ridged(worldX*.0105+mid*.3,worldY*.0105-broad*.25,peak.faceSeed+71,3))*smoothstep(.42,.82,r)*(1-smoothstep(.86,1.0,r))*.045;
    const inherited=clamp((zBase-peak.floor)/Math.max(30,peak.prominence),0,1.08);
    profile=clamp(profile+buttress*.075+wallRibs-collapse+Math.pow(inherited,1.4)*.08*(1-smoothstep(.50,.83,r)),0,1.08);
    const target=peak.floor+peak.targetHeight*profile+fineResidual*.045;
    const surface=lerp(zBase,target,support);
    if(surface>best){second=best;best=surface;bestRatio=peak.ratio;bestInfluence=support}else if(surface>second)second=surface;
  }
  if(!Number.isFinite(best))return{delta:0,influence:0,ratio:0};
  const surface=Number.isFinite(second)?smoothMaximumV340(best,second,6.5):best;
  return{delta:clamp(surface-zBase,-64,235),influence:bestInfluence,ratio:bestRatio};
};

function parcelFrameV345(worldX,worldY,seed=0){
  const tileX=Math.floor(worldX/260),tileY=Math.floor(worldY/260),tileSeed=hash21(tileX,tileY,seed+31);
  const angle=(fbm(worldX*.00055,worldY*.00055,seed+47,4)*.72)+(tileSeed-.5)*.42;
  const ca=Math.cos(angle),sa=Math.sin(angle);
  const warpU=fbm(worldX*.0017,worldY*.0017,seed+61,4)*23+fbm(worldX*.0068,worldY*.0068,seed+79,3)*4.5;
  const warpV=fbm(worldX*.0017+6.4,worldY*.0017-4.2,seed+97,4)*23+fbm(worldX*.0068-4.1,worldY*.0068+7.3,seed+113,3)*4.5;
  const u=(worldX+warpU)*ca+(worldY+warpV)*sa;
  const v=-(worldX+warpU)*sa+(worldY+warpV)*ca;
  const widthU=26+hash21(tileX,tileY,seed+131)*20;
  const widthV=48+hash21(tileX,tileY,seed+149)*42;
  const cellU=Math.floor(u/widthU),cellV=Math.floor(v/widthV);
  const fu=fract(u/widthU),fv=fract(v/widthV),du=Math.min(fu,1-fu),dv=Math.min(fv,1-fv);
  const edgeU=1-smoothstep(.020,.070,du),edgeV=1-smoothstep(.012,.045,dv);
  const seedU=hash21(cellU,cellV,seed+173),seedV=hash21(cellU,cellV,seed+191);
  const mergeU=seedU<.19?.18:1,mergeV=seedV<.13?.24:1;
  const contour=Math.abs(Math.sin((u+fbm(worldX*.0023,worldY*.0023,seed+211,3)*18)*.0065));
  const contourBund=(1-smoothstep(.014,.055,contour))*smoothstep(.57,.88,tileSeed);
  const boundary=Math.max(edgeU*mergeU,edgeV*mergeV,contourBund*.52);
  const majorU=edgeU*(hash21(cellU,Math.floor(cellV/3),seed+229)>.78?1:0);
  const majorV=edgeV*(hash21(Math.floor(cellU/4),cellV,seed+241)>.84?1:0);
  const meander=Math.abs(Math.sin(worldX*.0036+worldY*.00145+fbm(worldX*.0012,worldY*.0012,seed+257,4)*3.2));
  const drainage=(1-smoothstep(.010,.042,meander))*.78;
  const irrigation=Math.max(majorU,majorV,drainage*smoothstep(.04,.25,Math.min(du,dv)));
  const fieldSeed=hash21(cellU,cellV,seed+277),wetness=clamp((fieldSeed-.40)*1.85,0,1)*(.56+.44*fbm(worldX*.0024,worldY*.0024,seed+293,3));
  return{angle,u,v,widthU,widthV,cellU,cellV,fu,fv,du,dv,boundary,irrigation,fieldSeed,wetness,split:Math.max(edgeU,edgeV)};
}

parcelGrammarV330=function(worldX,worldY,seed=0){
  const frame=parcelFrameV345(worldX,worldY,seed);
  return{
    cell:{f1:Math.min(frame.du,frame.dv),f2:Math.max(frame.du,frame.dv),cellX:frame.cellU,cellZ:frame.cellV},
    coarse:{f1:Math.min(frame.du,frame.dv),f2:Math.max(frame.du,frame.dv),cellX:Math.floor(frame.cellU/3),cellZ:Math.floor(frame.cellV/2)},
    boundary:frame.boundary,irrigation:frame.irrigation,fieldSeed:frame.fieldSeed,wetness:frame.wetness,split:frame.split,
    orientation:frame.angle,parcelWidthMeters:[frame.widthU,frame.widthV]
  };
};

paddyDetail=function(worldX,worldY,truth,base,valleyMask,slopeDeg,seed=0){
  const parent=valleyMask*smoothstep(11.5,2.0,slopeDeg);if(parent<.001)return{delta:0,bund:0,channel:0,mask:0};
  const grammar=parcelGrammarV330(worldX,worldY,seed),step=.17+grammar.fieldSeed*.12,offset=(grammar.fieldSeed-.5)*.09;
  const terrace=Math.round((base+offset)/step)*step-offset,flatten=clamp((terrace-base)*.48,-.19,.19);
  const bund=grammar.boundary*(.105+grammar.fieldSeed*.105),channel=grammar.irrigation*(.065+.070*(1-grammar.fieldSeed));
  const crown=(.5-Math.abs(fract(grammar.cell.f1*8)-.5))*.015;
  const micro=fbm(worldX*.065,worldY*.065,seed+317,2)*.010*(1-grammar.boundary);
  const delta=clamp((flatten+bund-channel+crown+micro)*parent,-.25,.25);
  return{delta,bund:bund*parent,channel:channel*parent,mask:parent,fieldSeed:grammar.fieldSeed,wetness:grammar.wetness};
};

fieldColourV330=function(worldX,worldY,mask,layer){
  const grammar=parcelGrammarV330(worldX,worldY,601),seed=grammar.fieldSeed;
  let colour=seed<.22?RICH_PALETTE_V330.fieldDark.clone():seed<.56?RICH_PALETTE_V330.fieldGreen.clone():seed<.84?RICH_PALETTE_V330.fieldBright.clone():RICH_PALETTE_V330.fieldGold.clone();
  const broad=fbm(worldX*.00115,worldY*.00115,4721,4),fine=fbm(worldX*.0105,worldY*.0105,4733,3),stubble=Math.abs(Math.sin((worldX*Math.cos(grammar.orientation)+worldY*Math.sin(grammar.orientation))*.16));
  colour.offsetHSL(broad*.004,fine*.006,(fine-.2)*.007);
  colour.lerp(RICH_PALETTE_V330.soil,clamp(stubble*.032*(1-grammar.wetness)*mask,0,.032));
  colour.lerp(RICH_PALETTE_V330.bund,clamp(grammar.boundary*.42*mask,0,.42));
  colour.lerp(RICH_PALETTE_V330.channel,clamp(grammar.irrigation*.64*mask,0,.64));
  colour.lerp(RICH_PALETTE_V330.wet,clamp(grammar.wetness*.17*mask,0,.17));
  if(layer==='regional')colour.lerp(RICH_PALETTE_V330.distant,.095);return colour;
};

const buildLocalFieldsV345Base=buildLocalFields;
buildLocalFields=function(contextField,localCenter,mode,data,candidate,riverSections){
  const field=buildLocalFieldsV345Base(contextField,localCenter,mode,data,candidate,riverSections);
  if(mode==='cliff'){
    let detailMin=Infinity,detailMax=-Infinity;
    for(let z=2;z<field.n-2;z++)for(let x=2;x<field.n-2;x++){
      const i=z*field.n+x,k=field.karst?.[i]||0,edge=field.localEdge?.[i]||0;if(k<.02||edge<=0)continue;
      const gx=(field.final[i+1]-field.final[i-1])/(field.spacing*2),gy=(field.final[i+field.n]-field.final[i-field.n])/(field.spacing*2),magnitude=Math.hypot(gx,gy);
      const slopeMask=smoothstep(.18,.95,magnitude);if(slopeMask<=.001)continue;
      const downX=-gx/(magnitude||1),downY=-gy/(magnitude||1),acrossX=-downY,acrossY=downX,wx=field.worldX[x],wy=field.worldY[z];
      const along=wx*downX+wy*downY,across=wx*acrossX+wy*acrossY,warp=fbm(wx*.0045,wy*.0045,4783,3);
      const bedding=Math.sin(along*.095+warp*2.4)*.105;
      const flute=-Math.pow(smoothstep(.69,.96,ridged(along*.015,across*.0038,4799,4)),2.2)*.31;
      const ledge=(ridged(wx*.020+warp*.2,wy*.020-warp*.15,4813,3)-.58)*.18;
      const fracture=worley(wx*.0135+warp*.25,wy*.0135-warp*.18,4829),crack=-smoothstep(.062,.008,fracture.f2-fracture.f1)*.22;
      const detail=clamp((bedding+flute+ledge+crack)*k*edge*slopeMask,-.58,.26);
      field.final[i]+=state.enhanceMix*state.process*detail;if(field.micro)field.micro[i]+=detail;
      detailMin=Math.min(detailMin,detail);detailMax=Math.max(detailMax,detail);
    }
    if(field.stats){field.stats.cliffDetailMin=Number.isFinite(detailMin)?detailMin:0;field.stats.cliffDetailMax=Number.isFinite(detailMax)?detailMax:0}
  }
  return field;
};

const terrainColourV345Base=terrainColourRichV330;
terrainColourRichV330=function(field,index,heightNorm,worldX,worldY,layer,slopeDeg){
  const colour=terrainColourV345Base(field,index,heightNorm,worldX,worldY,layer,slopeDeg);
  if(layer==='local'&&state.preset.id==='cliff'){
    const height=field.final?.[index]||field.truth?.[index]||0,karst=field.karst?.[index]||0,exposure=field.exposure?.[index]||smoothstep(25,56,slopeDeg);
    const strata=.5+.5*Math.sin(height*.135+fbm(worldX*.004,worldY*.004,4861,3)*2.2),flute=ridged(worldX*.0085,worldY*.0028,4877,4);
    colour.lerp(RICH_PALETTE_V330.limestoneLight,clamp(exposure*(.13+.16*strata)*karst,0,.25));
    colour.lerp(RICH_PALETTE_V330.karstDark,clamp(smoothstep(.70,.95,flute)*karst*.16,0,.16));
    colour.lerp(RICH_PALETTE_V330.moss,clamp((1-exposure)*karst*.08,0,.08));
  }
  return colour;
};

const makeTerrainMaterialV345Base=makeTerrainMaterialRichV330;
makeTerrainMaterialRichV330=function(layer){
  const material=makeTerrainMaterialV345Base(layer);material.metalness=0;material.dithering=true;
  if(layer==='local'&&state.preset.id==='cliff'){
    material.bumpMap=null;material.roughnessMap=null;material.roughness=.955;material.needsUpdate=true;
  }else if(layer==='local'&&state.preset.id==='paddy'){
    material.bumpMap=null;material.roughnessMap=null;material.roughness=.985;material.needsUpdate=true;
  }
  return material;
};

createPaddyWaterV330=function(build){
  if(!['atlas','paddy'].includes(state.preset.id)||state.enhanceMix===0)return null;
  const field=build.local,{n,spacing,worldX,worldY,final}=field,step=isMobile?20:17,positions=[],colours=[],indices=[];
  const add=(x,h,y,c)=>{positions.push(x-build.origin.x,h-build.datum,y-build.origin.y);colours.push(c.r,c.g,c.b);return positions.length/3-1};
  for(let z=step;z<n-step;z+=step)for(let x=step;x<n-step;x+=step){
    const i=z*n+x,mask=field.paddyMask?.[i]||0;if(mask<.54)continue;const grammar=parcelGrammarV330(worldX[x],worldY[z],601),chance=hash21(Math.floor(worldX[x]/23),Math.floor(worldY[z]/23),4919);if(grammar.wetness<.64||grammar.boundary>.20||chance<.72)continue;
    const halfX=step*spacing*(.11+.035*chance),halfY=halfX*(1.25+.45*grammar.fieldSeed),angle=grammar.orientation||0,ca=Math.cos(angle),sa=Math.sin(angle),corners=[[-halfX,-halfY],[halfX,-halfY],[-halfX,halfY],[halfX,halfY]],ids=[],colour=RICH_PALETTE_V330.wet.clone().lerp(RICH_PALETTE_V330.waterEdge,.10+.10*grammar.wetness),h=final[i]+.020;
    for(const [px,py] of corners)ids.push(add(worldX[x]+px*ca-py*sa,h,worldY[z]+px*sa+py*ca,colour));indices.push(ids[0],ids[2],ids[1],ids[1],ids[2],ids[3]);
  }
  if(!indices.length)return null;const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colours,3));geometry.setIndex(indices);geometry.computeVertexNormals();const material=new THREE.MeshPhysicalMaterial({vertexColors:true,roughness:.46,transparent:true,opacity:.28,depthWrite:false,clearcoat:.10,side:THREE.DoubleSide});const mesh=new THREE.Mesh(geometry,material);mesh.name='paddy-shallow-water';mesh.renderOrder=6;return mesh;
};

const initRendererV345Base=initRenderer;
initRenderer=async function(){
  await initRendererV345Base();renderer.toneMappingExposure=1.14;scene.background.set(0xc7ceca);scene.fog.color.set(0xc7ceca);scene.fog.near=7200;scene.fog.far=23500;
  sun.intensity=2.72;sun.position.set(-5000,6900,2850);sun.shadow.bias=.00045;sun.shadow.normalBias=1.15;sun.shadow.radius=2.0;
  scene.traverse(object=>{if(object.isHemisphereLight){object.intensity=1.44;object.color.set(0xe2e8e1);object.groundColor.set(0x585846)}if(object.name==='cool-fill')object.intensity=.42});
};

configureCamera=function(view,build=state.currentBuild){
  if(!build)return;const offset=build.localOffset||{x:0,z:0},targetHeight=build.localTargetHeight||260,id=state.preset.id;
  if(id==='atlas'){camera.fov=38;camera.position.set(3000,1320,4200);controls.target.set(0,220,-270)}
  else if(id==='paddy'){camera.fov=38;camera.position.set(offset.x+640,targetHeight+760,offset.z+900);controls.target.set(offset.x-35,targetHeight+10,offset.z-75)}
  else if(id==='river'){camera.fov=39;camera.position.set(offset.x+1180,targetHeight+525,offset.z+1550);controls.target.set(offset.x-75,targetHeight+12,offset.z-205)}
  else{camera.fov=40;camera.position.set(offset.x+690,targetHeight+355,offset.z+920);controls.target.set(offset.x-25,targetHeight+118,offset.z-65)}
  camera.updateProjectionMatrix();controls.update();
};

const makeQAV345Base=makeQA;
makeQA=function(build){
  const qa=makeQAV345Base(build);qa.richTerrainPass='v3.4.5';qa.karstTowerProfile='contracted-foot+small-crown+steep-wall+buttress-ribs';qa.cliffDetail='slope-led-bedding+flutes+ledges+fractures';qa.paddyParcelGrammar='rotated-field-grid+merged-bunds+major-irrigation';qa.paddyReviewCamera='oblique-valley-context';qa.materialAliasControl='geometry-first-no-worldspace-bump';qa.toneMappingExposure=1.14;return qa;
};

document.title='小王 · 桂林地貌蒸馏实验室 v3.4.5';
const brandSmallV345=document.querySelector('.brand small');if(brandSmallV345)brandSmallV345.textContent='XIAOWANG · GUILIN GEOMORPHOLOGY DISTILLATION v3.4.5';
